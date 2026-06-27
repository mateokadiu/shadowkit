/**
 * Devtools runtime tap.
 *
 * The shadowkit Chrome extension listens for postMessage events tagged with
 * `DEVTOOLS_MESSAGE_TAG` and renders them in the panel. To enable that
 * pipeline, your component code calls `tap()` once per process — it returns
 * a `dispose()` that turns the firehose off.
 *
 * No network, no eval, no globals beyond `postMessage`. Keeping it that way
 * means the devtools integration can ship behind a dev-only flag without
 * dragging extra weight into production embeds.
 */

import { DEVTOOLS_MESSAGE_TAG } from "./index.js";

export type DevtoolsEventKind =
  | "bridge.request"
  | "bridge.response"
  | "bridge.event"
  | "store.snapshot"
  | "lifecycle.connect"
  | "lifecycle.disconnect";

export interface DevtoolsEvent {
  /** Tag both sides agree on. Always `"shadowkit/devtools"`. */
  tag: typeof DEVTOOLS_MESSAGE_TAG;
  /** Event category — drives panel grouping. */
  kind: DevtoolsEventKind;
  /** Custom-element tag the event originated from, if known. */
  tag_name?: string;
  /** UNIX ms timestamp at emit time. */
  ts: number;
  /** Free-form payload — JSON-serializable. */
  data: unknown;
}

export interface TapOptions {
  /** Override the target endpoint (defaults to `globalThis`). */
  target?: Pick<Window, "postMessage">;
}

export interface TapHandle {
  /**
   * Emit a devtools event. Cheap when no listener is attached — postMessage
   * is fire-and-forget, the extension is the only thing that reads them.
   */
  emit(kind: DevtoolsEventKind, data: unknown, tagName?: string): void;
  /** Stop emitting (no-op for postMessage, but keeps the API consistent). */
  dispose(): void;
}

export function tap(options: TapOptions = {}): TapHandle {
  const target = options.target ?? (globalThis as unknown as Window);
  let disposed = false;

  return {
    emit(kind, data, tagName) {
      if (disposed) return;
      const event: DevtoolsEvent = {
        tag: DEVTOOLS_MESSAGE_TAG,
        kind,
        tag_name: tagName,
        ts: Date.now(),
        data,
      };
      try {
        target.postMessage(event, "*");
      } catch {
        /* swallow — devtools must never crash the host */
      }
    },
    dispose() {
      disposed = true;
    },
  };
}

/**
 * Type guard used by the extension's content script to filter the flood of
 * window messages down to shadowkit's own.
 */
export function isDevtoolsEvent(value: unknown): value is DevtoolsEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<DevtoolsEvent>;
  return v.tag === DEVTOOLS_MESSAGE_TAG && typeof v.kind === "string";
}
