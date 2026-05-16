import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore, watchStore } from "../src/store.js";
import { ShadowComponent } from "../src/shadow-component.js";

let nextTag = 0;
function uniqueTag(): string {
  return `sk-store-${++nextTag}-${Date.now().toString(36)}`;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createStore", () => {
  it("returns the current state from getState()", () => {
    const store = createStore({ count: 0 });
    expect(store.getState()).toEqual({ count: 0 });
  });

  it("replaces state via set(value)", () => {
    const store = createStore({ count: 0 });
    store.set({ count: 5 });
    expect(store.getState()).toEqual({ count: 5 });
  });

  it("applies set(updater) with previous state", () => {
    const store = createStore({ count: 1 });
    store.set((prev) => ({ count: prev.count + 1 }));
    expect(store.getState()).toEqual({ count: 2 });
  });

  it("notifies subscribers with (next, prev)", () => {
    const store = createStore(0);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(1);
    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it("does not notify when set() yields the identical value", () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    const same = store.getState();
    store.set(same);
    expect(listener).not.toHaveBeenCalled();
  });

  it("subscribe() returns an unsubscribe that stops further notifications", () => {
    const store = createStore(0);
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    store.set(1);
    unsub();
    store.set(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tolerates listeners unsubscribing other listeners mid-batch", () => {
    const store = createStore(0);
    const a = vi.fn();
    let unsubB: () => void = () => {};
    const fa = (..._args: unknown[]) => {
      a(..._args);
      unsubB();
    };
    const b = vi.fn();
    store.subscribe(fa);
    unsubB = store.subscribe(b);
    store.set(1);
    // a fires; b may or may not depending on snapshot order, but neither
    // should throw.
    expect(a).toHaveBeenCalledTimes(1);
  });
});

describe("watchStore", () => {
  it("calls listener immediately with current selected value", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    document.body.appendChild(el);

    const store = createStore({ count: 7, theme: "dark" });
    const fn = vi.fn();
    watchStore(el, store, (s) => s.count, fn);
    expect(fn).toHaveBeenCalledWith(7, 7);
  });

  it("only fires when the selected slice changes", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    document.body.appendChild(el);

    const store = createStore({ count: 0, theme: "dark" });
    const fn = vi.fn();
    watchStore(el, store, (s) => s.count, fn, { immediate: false });
    store.set({ count: 0, theme: "light" }); // count unchanged
    expect(fn).not.toHaveBeenCalled();
    store.set({ count: 1, theme: "light" });
    expect(fn).toHaveBeenCalledWith(1, 0);
  });

  it("auto-unsubscribes when the host element disconnects", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    document.body.appendChild(el);

    const store = createStore({ count: 0 });
    const fn = vi.fn();
    watchStore(el, store, (s) => s.count, fn, { immediate: false });

    store.set({ count: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    document.body.removeChild(el);
    store.set({ count: 2 });
    expect(fn).toHaveBeenCalledTimes(1); // no additional call after disconnect
  });

  it("state survives disconnect (store outlives the host)", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    document.body.appendChild(el);

    const store = createStore({ count: 0 });
    watchStore(el, store, (s) => s.count, () => {}, { immediate: false });
    store.set({ count: 42 });

    document.body.removeChild(el);
    expect(store.getState()).toEqual({ count: 42 });

    document.body.appendChild(el);
    // Subscription was severed on disconnect; new watchStore needed.
    const fn = vi.fn();
    watchStore(el, store, (s) => s.count, fn);
    expect(fn).toHaveBeenCalledWith(42, 42);
  });

  it("respects immediate: false", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    document.body.appendChild(el);

    const store = createStore(0);
    const fn = vi.fn();
    watchStore(el, store, (s) => s, fn, { immediate: false });
    expect(fn).not.toHaveBeenCalled();
    store.set(1);
    expect(fn).toHaveBeenCalledWith(1, 0);
  });

  it("returns an unsubscribe that can be called manually before disconnect", () => {
    class El extends ShadowComponent {}
    const tag = uniqueTag();
    customElements.define(tag, El);
    const el = document.createElement(tag) as El;
    document.body.appendChild(el);

    const store = createStore(0);
    const fn = vi.fn();
    const unsub = watchStore(el, store, (s) => s, fn, { immediate: false });
    unsub();
    store.set(1);
    expect(fn).not.toHaveBeenCalled();
  });
});
