import type { ShadowComponent } from "./shadow-component.js";

/**
 * Reactive store for Web Components.
 *
 * Design choices, each with a reason:
 *
 *  - **Selector-based watchers**, not whole-state watchers. Components only
 *    re-render when the slice they care about changes, so a counter component
 *    watching `state.count` doesn't react when an unrelated `state.theme`
 *    field changes.
 *
 *  - **Reference equality on selector output**, not deep-equality. If you want
 *    structural equality, derive a primitive in the selector (`s.items.length`
 *    instead of `s.items`). Cheap and predictable.
 *
 *  - **Lifecycle-aware**: `watchStore(host, store, sel, fn)` registers the
 *    unsubscribe as a cleanup on the host component, so the subscription dies
 *    exactly when the element disconnects. This is the load-bearing fix for
 *    the "my Web Component leaks subscriptions on detach" class of bug.
 *
 *  - **State survives disconnect**: the store is a separate object from any
 *    one host element. Disconnecting an element removes its subscription, not
 *    the data. Moving an element across the DOM with `appendChild` then
 *    re-subscribes on the next `connectedCallback` and sees the latest state.
 */

export type StoreListener<T> = (state: T, prev: T) => void;
export type StoreSelector<T, U> = (state: T) => U;
export type StoreUpdater<T> = (prev: T) => T;
export type StoreUnsubscribe = () => void;

export interface Store<T> {
  /** Current state. Never mutate it — call `set()` instead. */
  getState(): T;
  /** Replace state with `next`, or with the return value of `next(prev)`. */
  set(next: T | StoreUpdater<T>): void;
  /** Subscribe to every change. Returns an unsubscribe. */
  subscribe(listener: StoreListener<T>): StoreUnsubscribe;
}

interface InternalStore<T> extends Store<T> {
  _listeners: Set<StoreListener<T>>;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<StoreListener<T>>();

  const store: InternalStore<T> = {
    _listeners: listeners,
    getState: () => state,
    set: (next) => {
      const prev = state;
      const value =
        typeof next === "function" ? (next as StoreUpdater<T>)(prev) : next;
      if (Object.is(value, prev)) return; // no-op identity change
      state = value;
      // Snapshot listeners — handlers may unsubscribe during iteration.
      for (const fn of [...listeners]) {
        try {
          fn(state, prev);
        } catch (err) {
          // Re-throw async so one bad listener doesn't poison the whole batch.
          queueMicrotask(() => {
            throw err;
          });
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return store;
}

export interface WatchStoreOptions {
  /**
   * When `true` (default), `listener` is called once synchronously with the
   * current selected value. When `false`, only future changes notify. Most
   * components want `true` so the first render reflects current state.
   */
  immediate?: boolean;
}

/**
 * Subscribe to a slice of `store`, auto-unsubscribing when `host` disconnects.
 *
 * Implementation note: we register the unsubscribe via `host.addCleanup`,
 * which means the subscription dies in the *next* `disconnectedCallback`.
 * If the host is currently disconnected, `addCleanup` runs the disposer
 * synchronously — so an early call still doesn't leak.
 */
export function watchStore<T, U>(
  host: ShadowComponent,
  store: Store<T>,
  selector: StoreSelector<T, U>,
  listener: (selected: U, prevSelected: U) => void,
  options: WatchStoreOptions = {}
): StoreUnsubscribe {
  let last = selector(store.getState());

  if (options.immediate !== false) {
    try {
      listener(last, last);
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
  }

  const unsubscribe = store.subscribe((state) => {
    const next = selector(state);
    if (Object.is(next, last)) return;
    const prev = last;
    last = next;
    listener(next, prev);
  });

  host.addCleanup(unsubscribe);
  return unsubscribe;
}
