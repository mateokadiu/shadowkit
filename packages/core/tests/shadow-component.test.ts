import { afterEach, describe, expect, it, vi } from "vitest";
import { ShadowComponent } from "../src/shadow-component.js";

let nextTag = 0;
function uniqueTag(): string {
  return `sk-test-${++nextTag}-${Date.now().toString(36)}`;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ShadowComponent", () => {
  it("attaches an open shadow root in the constructor", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    expect(el.shadow).toBeInstanceOf(ShadowRoot);
    expect(el.shadow.mode).toBe("open");
  });

  it("calls onConnect then onDisconnect in order", () => {
    const calls: string[] = [];
    class El extends ShadowComponent {
      protected override onConnect(): void {
        calls.push("connect");
      }
      protected override onDisconnect(): void {
        calls.push("disconnect");
      }
    }
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag);
    document.body.appendChild(el);
    document.body.removeChild(el);
    expect(calls).toEqual(["connect", "disconnect"]);
  });

  it("runs registered cleanups in LIFO order on disconnect", () => {
    const calls: number[] = [];
    class El extends ShadowComponent {
      protected override onConnect(): void {
        this.addCleanup(() => calls.push(1));
        this.addCleanup(() => calls.push(2));
        this.addCleanup(() => calls.push(3));
      }
    }
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag);
    document.body.appendChild(el);
    document.body.removeChild(el);
    expect(calls).toEqual([3, 2, 1]);
  });

  it("does not double-fire onConnect if already connected", () => {
    const connect = vi.fn();
    class El extends ShadowComponent {
      protected override onConnect(): void {
        connect();
      }
    }
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    document.body.appendChild(el);
    // jsdom-only: re-invoking connectedCallback directly.
    el.connectedCallback();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("clears the cleanup list after disconnect (so reconnect does not re-run)", () => {
    const cleanup = vi.fn();
    class El extends ShadowComponent {
      protected override onConnect(): void {
        this.addCleanup(cleanup);
      }
    }
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag);
    document.body.appendChild(el);
    document.body.removeChild(el);
    document.body.appendChild(el);
    document.body.removeChild(el);
    // First disconnect runs the original cleanup. Second disconnect runs the
    // re-registered one. Total: 2.
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("runs a cleanup synchronously if registered while disconnected", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    const cleanup = vi.fn();
    el.addCleanup(cleanup);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("attaches scoped styles via the options.styles option", () => {
    class El extends ShadowComponent {
      constructor() {
        super({ styles: ":host { color: red; }" });
      }
    }
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    // adoptedStyleSheets is preferred; jsdom v25 supports it. <style> fallback
    // also acceptable for this assertion.
    const hasSheet =
      (el.shadow.adoptedStyleSheets?.length ?? 0) > 0 ||
      el.shadow.querySelector("style") !== null;
    expect(hasSheet).toBe(true);
  });

  it("isConnected reflects lifecycle", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    expect(el.isConnected).toBe(false);
    document.body.appendChild(el);
    expect(el.isConnected).toBe(true);
    document.body.removeChild(el);
    expect(el.isConnected).toBe(false);
  });
});
