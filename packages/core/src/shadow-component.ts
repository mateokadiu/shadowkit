import { attachStyles } from "./style-sheets.js";

/**
 * Disposer function — returned by `addCleanup`, invoked on disconnect.
 *
 * Most Web Component memory leaks come from one mistake: subscribing to
 * something external in `connectedCallback` and forgetting to unsubscribe in
 * `disconnectedCallback`. This base class centralizes that contract.
 */
export type Cleanup = () => void;

export interface ShadowComponentOptions {
  /** Shadow root mode. Default: `"open"`. */
  mode?: ShadowRootMode;
  /** Delegate focus to the first focusable descendant. Default: `false`. */
  delegatesFocus?: boolean;
  /**
   * CSS scoped to this component's shadow root, attached at construction time
   * via `adoptedStyleSheets`. Shared across instances of the same subclass.
   */
  styles?: string;
}

const stylesCacheKey = Symbol("shadowkit.styles.cacheKey");

/**
 * Base class for embeddable Web Components.
 *
 * Responsibilities:
 *  - Attach an open shadow root in the constructor.
 *  - Wire `adoptedStyleSheets` (with `<style>` fallback) for scoped CSS.
 *  - Track disposers and run them on `disconnectedCallback`.
 *  - Provide hooks (`onConnect`, `onDisconnect`) subclasses override instead of
 *    `connectedCallback`/`disconnectedCallback` directly — this keeps the
 *    cleanup contract intact even if subclasses forget to call `super`.
 *
 * State (instance fields, store data) deliberately survives disconnect so that
 * an element moved across the DOM via `appendChild` doesn't lose its data.
 * Only subscriptions, timers, and message listeners die.
 */
export abstract class ShadowComponent extends HTMLElement {
  /** Shadow root, always attached. Read-only after construction. */
  readonly shadow: ShadowRoot;

  /** Disposers registered while the element is connected. */
  private _cleanups: Cleanup[] = [];

  /** True between `connectedCallback` and `disconnectedCallback`. */
  private _connected = false;

  constructor(options: ShadowComponentOptions = {}) {
    super();
    this.shadow = this.attachShadow({
      mode: options.mode ?? "open",
      delegatesFocus: options.delegatesFocus ?? false,
    });

    if (options.styles) {
      // One CSSStyleSheet per (subclass + style string) pair via cache key on
      // the constructor — every instance of the same subclass shares it.
      const ctor = this.constructor as unknown as Record<symbol, object>;
      let key = ctor[stylesCacheKey];
      if (!key) {
        key = {};
        ctor[stylesCacheKey] = key;
      }
      attachStyles(this.shadow, options.styles, key);
    }
  }

  /**
   * Register a disposer. Runs on `disconnectedCallback`. If the element is
   * already disconnected, the disposer runs synchronously — avoids the
   * "registered after I detached" race.
   */
  addCleanup(fn: Cleanup): void {
    if (!this._connected) {
      // Defensive: caller likely meant "do this and clean up on disconnect."
      // If disconnect has already happened, just run it now.
      try {
        fn();
      } catch {
        /* swallow — disposer errors must not crash the element */
      }
      return;
    }
    this._cleanups.push(fn);
  }

  /** True while the element is in the document. */
  override get isConnected(): boolean {
    return this._connected;
  }

  /** Override in subclasses instead of `connectedCallback`. */
  protected onConnect(): void {}

  /** Override in subclasses instead of `disconnectedCallback`. */
  protected onDisconnect(): void {}

  // Final on purpose: subclasses use the hooks above, which keeps the cleanup
  // semantics intact even if they forget `super.connectedCallback()`.
  connectedCallback(): void {
    if (this._connected) return; // guard against double-connect
    this._connected = true;
    try {
      this.onConnect();
    } catch (err) {
      // Re-throw async so the element still ends up in a "connected" state and
      // its disconnect hook will fire. Errors during render should not wedge
      // the lifecycle machine.
      queueMicrotask(() => {
        throw err;
      });
    }
  }

  disconnectedCallback(): void {
    if (!this._connected) return;
    this._connected = false;
    // Run disposers in reverse registration order (LIFO) — mirrors how `defer`
    // works in Go, which is the right shape for nested resource ownership.
    for (let i = this._cleanups.length - 1; i >= 0; i--) {
      try {
        this._cleanups[i]?.();
      } catch {
        /* swallow */
      }
    }
    this._cleanups = [];
    try {
      this.onDisconnect();
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
  }
}
