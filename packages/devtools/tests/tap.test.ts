import { afterEach, describe, expect, it, vi } from "vitest";
import { DEVTOOLS_MESSAGE_TAG } from "../src/index.js";
import { isDevtoolsEvent, tap } from "../src/tap.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tap", () => {
  it("emits a devtools event via postMessage", () => {
    const post = vi.fn();
    const handle = tap({ target: { postMessage: post } });
    handle.emit("bridge.request", { method: "order.fetch" }, "sk-x-tap");

    expect(post).toHaveBeenCalledTimes(1);
    const [payload] = post.mock.calls[0] as [unknown, string];
    expect(isDevtoolsEvent(payload)).toBe(true);
    const evt = payload as {
      tag: string;
      kind: string;
      tag_name: string;
      data: { method: string };
    };
    expect(evt.tag).toBe(DEVTOOLS_MESSAGE_TAG);
    expect(evt.kind).toBe("bridge.request");
    expect(evt.tag_name).toBe("sk-x-tap");
    expect(evt.data).toEqual({ method: "order.fetch" });
  });

  it("does not emit after dispose", () => {
    const post = vi.fn();
    const handle = tap({ target: { postMessage: post } });
    handle.dispose();
    handle.emit("bridge.event", {});
    expect(post).not.toHaveBeenCalled();
  });

  it("swallows postMessage throws so devtools cannot crash the host", () => {
    const post = vi.fn(() => {
      throw new Error("structured clone failed");
    });
    const handle = tap({ target: { postMessage: post } });
    expect(() => handle.emit("store.snapshot", { x: 1 })).not.toThrow();
  });

  it("isDevtoolsEvent gates third-party messages out", () => {
    expect(isDevtoolsEvent(null)).toBe(false);
    expect(isDevtoolsEvent({ tag: "other", kind: "x" })).toBe(false);
    expect(
      isDevtoolsEvent({ tag: DEVTOOLS_MESSAGE_TAG, kind: "store.snapshot" })
    ).toBe(true);
  });
});
