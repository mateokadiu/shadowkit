import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineBridge } from "../src/define-bridge.js";
import type { MessageEndpoint } from "../src/define-bridge.js";
import { BridgeError } from "../src/errors.js";

/**
 * In-memory pair of endpoints. Anything posted to A appears as a message on B
 * and vice versa. Mirrors the runtime shape of window↔window or port↔port.
 */
function makePair(origin = "https://host.example") {
  type Listener = (ev: MessageEvent) => void;
  const listenersA = new Set<Listener>();
  const listenersB = new Set<Listener>();

  const endpointA: MessageEndpoint = {
    postMessage(data: unknown) {
      const ev = new MessageEvent("message", { data, origin });
      for (const l of listenersB) l(ev);
    },
    addEventListener(_t, l) {
      listenersA.add(l as Listener);
    },
    removeEventListener(_t, l) {
      listenersA.delete(l as Listener);
    },
  };

  const endpointB: MessageEndpoint = {
    postMessage(data: unknown) {
      const ev = new MessageEvent("message", { data, origin });
      for (const l of listenersA) l(ev);
    },
    addEventListener(_t, l) {
      listenersB.add(l as Listener);
    },
    removeEventListener(_t, l) {
      listenersB.delete(l as Listener);
    },
  };

  return { endpointA, endpointB };
}

const schema = {
  requests: {
    "order.fetch": {
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), total: z.number() }),
    },
    "auth.whoami": {
      input: z.object({}),
      output: z.object({ user: z.string() }),
    },
  },
  events: {
    "order.updated": z.object({ id: z.string() }),
  },
} as const;

describe("defineBridge", () => {
  it("round-trips a typed request/response", async () => {
    const { endpointA, endpointB } = makePair();
    const host = defineBridge(schema, { endpoint: endpointA });
    const embed = defineBridge(schema, { endpoint: endpointB });

    embed.handle("order.fetch", async ({ id }) => ({ id, total: 42 }));

    const result = await host.request("order.fetch", { id: "abc" });
    expect(result).toEqual({ id: "abc", total: 42 });

    host.dispose();
    embed.dispose();
  });

  it("rejects with BRIDGE_TIMEOUT when peer does not respond", async () => {
    const { endpointA, endpointB } = makePair();
    const host = defineBridge(schema, {
      endpoint: endpointA,
      timeoutMs: 25,
    });
    defineBridge(schema, { endpoint: endpointB });
    // intentionally no handler registered

    // BRIDGE_NO_HANDLER will actually come back first — let's also test pure timeout
    // by making a request before any handler exists AND with no endpoint receiver.
    // Drop the embed bridge so nothing answers:
    const lonelyA = defineBridge(schema, {
      endpoint: {
        postMessage() {},
        addEventListener() {},
        removeEventListener() {},
      },
      timeoutMs: 25,
    });
    await expect(
      lonelyA.request("order.fetch", { id: "x" })
    ).rejects.toMatchObject({
      name: "BridgeError",
      code: "BRIDGE_TIMEOUT",
    });
    host.dispose();
    lonelyA.dispose();
  });

  it("returns BRIDGE_NO_HANDLER when peer has no handler", async () => {
    const { endpointA, endpointB } = makePair();
    const host = defineBridge(schema, { endpoint: endpointA });
    const embed = defineBridge(schema, { endpoint: endpointB });

    await expect(
      host.request("order.fetch", { id: "abc" })
    ).rejects.toMatchObject({ code: "BRIDGE_NO_HANDLER" });

    host.dispose();
    embed.dispose();
  });

  it("rejects on input validation failure (caller-side, no wire round-trip)", async () => {
    const { endpointA, endpointB } = makePair();
    const host = defineBridge(schema, { endpoint: endpointA });
    const embed = defineBridge(schema, { endpoint: endpointB });
    embed.handle("order.fetch", async ({ id }) => ({ id, total: 1 }));

    await expect(
      host.request("order.fetch", { id: 123 as unknown as string })
    ).rejects.toMatchObject({ code: "BRIDGE_VALIDATION" });

    host.dispose();
    embed.dispose();
  });

  it("rejects on output validation failure", async () => {
    const { endpointA, endpointB } = makePair();
    const host = defineBridge(schema, { endpoint: endpointA });
    const embed = defineBridge(schema, { endpoint: endpointB });
    embed.handle(
      "order.fetch",
      async () =>
        ({ id: "x", total: "not a number" }) as unknown as {
          id: string;
          total: number;
        }
    );

    await expect(
      host.request("order.fetch", { id: "abc" })
    ).rejects.toMatchObject({ code: "BRIDGE_VALIDATION" });

    host.dispose();
    embed.dispose();
  });

  it("surfaces handler exceptions as BRIDGE_HANDLER_THREW", async () => {
    const { endpointA, endpointB } = makePair();
    const host = defineBridge(schema, { endpoint: endpointA });
    const embed = defineBridge(schema, { endpoint: endpointB });
    embed.handle("order.fetch", async () => {
      throw new Error("boom");
    });

    await expect(
      host.request("order.fetch", { id: "x" })
    ).rejects.toMatchObject({ code: "BRIDGE_HANDLER_THREW", message: "boom" });

    host.dispose();
    embed.dispose();
  });

  it("broadcasts events to subscribed channels only", async () => {
    const { endpointA, endpointB } = makePair();
    const host = defineBridge(schema, { endpoint: endpointA });
    const embed = defineBridge(schema, { endpoint: endpointB });
    const fn = vi.fn();
    embed.on("order.updated", fn);
    host.emit("order.updated", { id: "z" });
    expect(fn).toHaveBeenCalledWith({ id: "z" });

    host.dispose();
    embed.dispose();
  });

  it("on(channel, ...) returns an unsubscribe", async () => {
    const { endpointA, endpointB } = makePair();
    const host = defineBridge(schema, { endpoint: endpointA });
    const embed = defineBridge(schema, { endpoint: endpointB });
    const fn = vi.fn();
    const off = embed.on("order.updated", fn);
    host.emit("order.updated", { id: "1" });
    off();
    host.emit("order.updated", { id: "2" });
    expect(fn).toHaveBeenCalledTimes(1);

    host.dispose();
    embed.dispose();
  });

  it("emit() throws BRIDGE_VALIDATION on malformed payload", () => {
    const { endpointA } = makePair();
    const host = defineBridge(schema, { endpoint: endpointA });
    expect(() =>
      host.emit("order.updated", { id: 123 as unknown as string })
    ).toThrow(BridgeError);
    host.dispose();
  });

  it("filters messages by allowedOrigins", async () => {
    type Listener = (ev: MessageEvent) => void;
    const listenersA = new Set<Listener>();
    const listenersB = new Set<Listener>();
    const endpointA: MessageEndpoint = {
      postMessage(data: unknown) {
        const ev = new MessageEvent("message", {
          data,
          origin: "https://evil.example",
        });
        for (const l of listenersB) l(ev);
      },
      addEventListener(_t, l) {
        listenersA.add(l as Listener);
      },
      removeEventListener(_t, l) {
        listenersA.delete(l as Listener);
      },
    };
    const endpointB: MessageEndpoint = {
      postMessage(data: unknown) {
        const ev = new MessageEvent("message", {
          data,
          origin: "https://evil.example",
        });
        for (const l of listenersA) l(ev);
      },
      addEventListener(_t, l) {
        listenersB.add(l as Listener);
      },
      removeEventListener(_t, l) {
        listenersB.delete(l as Listener);
      },
    };

    const host = defineBridge(schema, {
      endpoint: endpointA,
      allowedOrigins: ["https://host.example"],
      timeoutMs: 30,
    });
    const embed = defineBridge(schema, {
      endpoint: endpointB,
      allowedOrigins: ["https://host.example"],
      timeoutMs: 30,
    });
    embed.handle("order.fetch", async ({ id }) => ({ id, total: 1 }));

    // Both sides drop messages because they originate from evil.example, not
    // the allow-listed host.example. Request must time out.
    await expect(
      host.request("order.fetch", { id: "x" })
    ).rejects.toMatchObject({ code: "BRIDGE_TIMEOUT" });

    host.dispose();
    embed.dispose();
  });

  it("dispose() rejects all pending requests with BRIDGE_DISPOSED", async () => {
    // Use a sink endpoint with no peer so the request truly sits pending.
    const sink: MessageEndpoint = {
      postMessage() {},
      addEventListener() {},
      removeEventListener() {},
    };
    const host = defineBridge(schema, { endpoint: sink, timeoutMs: 1000 });
    const inflight = host.request("auth.whoami", {});
    host.dispose();
    await expect(inflight).rejects.toMatchObject({ code: "BRIDGE_DISPOSED" });
  });

  it("duplicate handle() registration throws", () => {
    const { endpointA } = makePair();
    const bridge = defineBridge(schema, { endpoint: endpointA });
    bridge.handle("order.fetch", async ({ id }) => ({ id, total: 1 }));
    expect(() =>
      bridge.handle("order.fetch", async ({ id }) => ({ id, total: 2 }))
    ).toThrow(BridgeError);
    bridge.dispose();
  });
});
