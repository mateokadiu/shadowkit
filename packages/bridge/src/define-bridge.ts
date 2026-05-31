import { z } from "zod";
import { BridgeError } from "./errors.js";
import {
  wireMessage,
  type BridgeSchema,
  type EventPayload,
  type RequestInput,
  type RequestOutput,
  type WireMessage,
  type WireRequest,
  type WireResponse,
} from "./schema.js";

/**
 * Minimal "thing that can postMessage". Covers `window`, `Worker`, `MessagePort`,
 * `BroadcastChannel`, or any test double — we don't care which.
 */
export interface MessageEndpoint {
  postMessage(data: unknown, ...rest: unknown[]): void;
  addEventListener(
    type: "message",
    listener: (ev: MessageEvent) => void,
    options?: AddEventListenerOptions | boolean
  ): void;
  removeEventListener(
    type: "message",
    listener: (ev: MessageEvent) => void,
    options?: EventListenerOptions | boolean
  ): void;
}

export interface DefineBridgeOptions {
  /** Endpoint to receive messages on. Defaults to `globalThis` when present. */
  endpoint?: MessageEndpoint;
  /**
   * Endpoint to post messages *to*. Often the same as `endpoint` (window-to-
   * window same-origin), but for iframes you pass the contentWindow here.
   */
  target?: MessageEndpoint;
  /**
   * Allow-listed origins for inbound messages. `"*"` disables the check (only
   * appropriate inside a trusted same-origin shell). Defaults to `["*"]` to
   * stay convenient for tests; production callers should pin it.
   */
  allowedOrigins?: readonly string[] | "*";
  /**
   * postMessage targetOrigin. Defaults to `"*"`; pin in production.
   */
  postTargetOrigin?: string;
  /** Per-request timeout in milliseconds. Default 10_000. */
  timeoutMs?: number;
  /** Override message id generator (tests). */
  generateId?: () => string;
}

export interface Bridge<S extends BridgeSchema> {
  /** Send a typed request, return the typed response. */
  request<M extends keyof NonNullable<S["requests"]> & string>(
    method: M,
    payload: RequestInput<S, M>
  ): Promise<RequestOutput<S, M>>;

  /** Register a handler for a request method. Throws on duplicate. */
  handle<M extends keyof NonNullable<S["requests"]> & string>(
    method: M,
    handler: (
      payload: RequestOutput<S, M> extends never
        ? never
        : z.infer<NonNullable<S["requests"]>[M]["input"]>
    ) => Promise<RequestOutput<S, M>> | RequestOutput<S, M>
  ): () => void;

  /** Broadcast an event on a named channel. */
  emit<E extends keyof NonNullable<S["events"]> & string>(
    channel: E,
    payload: EventPayload<S, E>
  ): void;

  /** Subscribe to an event channel. Returns an unsubscribe. */
  on<E extends keyof NonNullable<S["events"]> & string>(
    channel: E,
    listener: (payload: z.infer<NonNullable<S["events"]>[E]>) => void
  ): () => void;

  /** Tear down the bridge. All pending requests reject with BRIDGE_DISPOSED. */
  dispose(): void;
}

const randomId = (): string => {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

function defaultEndpoint(): MessageEndpoint | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const g = globalThis as unknown as Partial<MessageEndpoint>;
  if (
    typeof g.postMessage === "function" &&
    typeof g.addEventListener === "function" &&
    typeof g.removeEventListener === "function"
  ) {
    return g as MessageEndpoint;
  }
  return undefined;
}

/**
 * Build a typed postMessage bridge.
 *
 * `schema` is the contract; same schema literal lives on both sides (typically
 * exported from a shared package). Type information flows from the schema, so
 * `bridge.request('order.fetch', { id })` is fully checked at compile time.
 *
 * Both ends call `defineBridge(schema, opts)` — there is no separate host/embed
 * factory. The bridge is symmetric: anyone can request, anyone can handle.
 */
export function defineBridge<S extends BridgeSchema>(
  schema: S,
  options: DefineBridgeOptions = {}
): Bridge<S> {
  const endpoint = options.endpoint ?? defaultEndpoint();
  if (!endpoint) {
    throw new BridgeError(
      "BRIDGE_DISPOSED",
      "defineBridge: no endpoint provided and no global postMessage target available"
    );
  }
  const target = options.target ?? endpoint;
  const allowed = options.allowedOrigins ?? "*";
  const timeoutMs = options.timeoutMs ?? 10_000;
  const generateId = options.generateId ?? randomId;
  const postTargetOrigin = options.postTargetOrigin ?? "*";

  const pending = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: BridgeError) => void;
      method: string;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  const handlers = new Map<
    string,
    (payload: unknown) => Promise<unknown> | unknown
  >();
  const eventListeners = new Map<string, Set<(payload: unknown) => void>>();

  let disposed = false;

  function onMessage(ev: MessageEvent): void {
    if (disposed) return;
    if (allowed !== "*") {
      if (!allowed.includes(ev.origin)) return; // silent drop — not an error
    }
    const parsed = wireMessage.safeParse(ev.data);
    if (!parsed.success) return; // not for us
    const msg: WireMessage = parsed.data;

    if (msg.kind === "req") {
      void dispatchRequest(msg);
      return;
    }
    if (msg.kind === "res") {
      dispatchResponse(msg);
      return;
    }
    if (msg.kind === "evt") {
      dispatchEvent(msg.channel, msg.payload);
    }
  }

  async function dispatchRequest(msg: WireRequest): Promise<void> {
    const def = schema.requests?.[msg.method];
    const handler = handlers.get(msg.method);
    if (!def || !handler) {
      send({
        v: 1,
        kind: "res",
        id: msg.id,
        ok: false,
        error: {
          code: "BRIDGE_NO_HANDLER",
          message: `no handler registered for method '${msg.method}'`,
        },
      });
      return;
    }
    const inputParsed = def.input.safeParse(msg.payload);
    if (!inputParsed.success) {
      send({
        v: 1,
        kind: "res",
        id: msg.id,
        ok: false,
        error: {
          code: "BRIDGE_VALIDATION",
          message: `input failed validation: ${inputParsed.error.message}`,
        },
      });
      return;
    }
    try {
      const output = await handler(inputParsed.data);
      const outParsed = def.output.safeParse(output);
      if (!outParsed.success) {
        send({
          v: 1,
          kind: "res",
          id: msg.id,
          ok: false,
          error: {
            code: "BRIDGE_VALIDATION",
            message: `output failed validation: ${outParsed.error.message}`,
          },
        });
        return;
      }
      send({
        v: 1,
        kind: "res",
        id: msg.id,
        ok: true,
        payload: outParsed.data,
      });
    } catch (err) {
      send({
        v: 1,
        kind: "res",
        id: msg.id,
        ok: false,
        error: {
          code: "BRIDGE_HANDLER_THREW",
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  function dispatchResponse(msg: WireResponse): void {
    const entry = pending.get(msg.id);
    if (!entry) return; // late / orphan response
    clearTimeout(entry.timer);
    pending.delete(msg.id);

    if (!msg.ok) {
      entry.reject(new BridgeError(msg.error.code as never, msg.error.message));
      return;
    }
    const def = schema.requests?.[entry.method];
    if (!def) {
      entry.reject(
        new BridgeError(
          "BRIDGE_NO_HANDLER",
          `received response for method '${entry.method}' not in schema`
        )
      );
      return;
    }
    const parsed = def.output.safeParse(msg.payload);
    if (!parsed.success) {
      entry.reject(
        new BridgeError(
          "BRIDGE_VALIDATION",
          `response failed validation: ${parsed.error.message}`
        )
      );
      return;
    }
    entry.resolve(parsed.data);
  }

  function dispatchEvent(channel: string, payload: unknown): void {
    const def = schema.events?.[channel];
    if (!def) return;
    const parsed = def.safeParse(payload);
    if (!parsed.success) return; // drop malformed broadcasts silently
    const listeners = eventListeners.get(channel);
    if (!listeners) return;
    for (const fn of [...listeners]) {
      try {
        fn(parsed.data);
      } catch (err) {
        queueMicrotask(() => {
          throw err;
        });
      }
    }
  }

  function send(data: unknown): void {
    // postMessage signatures vary across endpoints (window vs MessagePort).
    // Pass targetOrigin where the receiver accepts it; harmless otherwise.
    try {
      target.postMessage(data, postTargetOrigin);
    } catch {
      target.postMessage(data);
    }
  }

  endpoint.addEventListener("message", onMessage);

  return {
    request(method, payload) {
      if (disposed) {
        return Promise.reject(
          new BridgeError("BRIDGE_DISPOSED", "bridge has been disposed")
        );
      }
      const def = schema.requests?.[method as string];
      if (!def) {
        return Promise.reject(
          new BridgeError(
            "BRIDGE_NO_HANDLER",
            `method '${String(method)}' is not in the bridge schema`
          )
        );
      }
      const inputParsed = def.input.safeParse(payload);
      if (!inputParsed.success) {
        return Promise.reject(
          new BridgeError(
            "BRIDGE_VALIDATION",
            `request payload failed validation: ${inputParsed.error.message}`
          )
        );
      }
      const id = generateId();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(
            new BridgeError(
              "BRIDGE_TIMEOUT",
              `request '${String(method)}' (id=${id}) timed out after ${timeoutMs}ms`
            )
          );
        }, timeoutMs);
        pending.set(id, {
          resolve: resolve as (v: unknown) => void,
          reject,
          method: method as string,
          timer,
        });
        send({
          v: 1,
          kind: "req",
          id,
          method: method as string,
          payload: inputParsed.data,
        });
      });
    },

    handle(method, handler) {
      const key = method as string;
      if (handlers.has(key)) {
        throw new BridgeError(
          "BRIDGE_NO_HANDLER",
          `handler for '${key}' is already registered`
        );
      }
      handlers.set(key, handler as (p: unknown) => Promise<unknown> | unknown);
      return () => {
        handlers.delete(key);
      };
    },

    emit(channel, payload) {
      const def = schema.events?.[channel as string];
      if (!def) return;
      const parsed = def.safeParse(payload);
      if (!parsed.success) {
        throw new BridgeError(
          "BRIDGE_VALIDATION",
          `event '${String(channel)}' payload failed validation: ${parsed.error.message}`
        );
      }
      send({ v: 1, kind: "evt", channel: channel as string, payload: parsed.data });
    },

    on(channel, listener) {
      const key = channel as string;
      let set = eventListeners.get(key);
      if (!set) {
        set = new Set();
        eventListeners.set(key, set);
      }
      set.add(listener as (p: unknown) => void);
      return () => {
        set?.delete(listener as (p: unknown) => void);
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      endpoint.removeEventListener("message", onMessage);
      for (const [id, entry] of pending) {
        clearTimeout(entry.timer);
        entry.reject(
          new BridgeError(
            "BRIDGE_DISPOSED",
            `bridge disposed; aborting request '${entry.method}' (id=${id})`
          )
        );
      }
      pending.clear();
      handlers.clear();
      eventListeners.clear();
    },
  };
}
