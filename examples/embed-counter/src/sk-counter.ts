import {
  ShadowComponent,
  createStore,
  defineElement,
  watchStore,
  type Store,
} from "@shadowkit/core";
import { injectTailwind } from "@shadowkit/tailwind";
import { counterTheme } from "./theme.js";
import { counterStyles } from "./counter-styles.js";
import type { CounterBridge } from "./bridge.js";

interface CounterState {
  value: number;
}

// Stable cache key for the component stylesheet — injectTailwind dedupes by
// object identity, so a module-scope sentinel is right.
const STYLES_KEY = {};

/**
 * `<sk-counter>` — one Web Component that uses every shadowkit package.
 *
 *  - `@shadowkit/core`     → ShadowComponent base, createStore, watchStore,
 *                            defineElement
 *  - `@shadowkit/theme`    → :host CSS vars from the design-token DSL
 *  - `@shadowkit/tailwind` → cascade-boundary-safe stylesheet injection
 *                            (used here to attach our hand-rolled CSS the
 *                            same way real Tailwind output would attach;
 *                            same call site, same dedupe story)
 *  - `@shadowkit/bridge`   → typed pub/sub so every counter instance shares
 *                            the same value across the page
 */
export class SkCounter extends ShadowComponent {
  // Each counter has its own local store. The bridge fans out changes across
  // instances. The store survives disconnect; subscriptions don't.
  private readonly store: Store<CounterState>;
  private readonly bridge: CounterBridge;
  private valueEl?: HTMLDivElement;

  constructor(bridge: CounterBridge, initial = 0) {
    super();
    this.store = createStore<CounterState>({ value: initial });
    this.bridge = bridge;

    // 1. Theme tokens → :host CSS vars (scoped, no cascade leak).
    // 2. Component stylesheet → adopted via the same Shadow-DOM-safe path.
    // The cache keys mean every <sk-counter> on the page reuses the same
    // two CSSStyleSheet objects.
    injectTailwind(this.shadow, counterTheme.css, { cacheKey: SkCounter });
    injectTailwind(this.shadow, counterStyles, { cacheKey: STYLES_KEY });

    this.shadow.innerHTML = `
      <div class="card">
        <div class="label">count</div>
        <div class="value" part="value">0</div>
        <div class="row">
          <button type="button" data-act="dec" aria-label="decrement">−</button>
          <button type="button" data-act="inc" aria-label="increment">+</button>
        </div>
      </div>
    `;
    this.valueEl = this.shadow.querySelector(".value") as HTMLDivElement;
  }

  protected override onConnect(): void {
    // Local store → DOM
    watchStore(
      this,
      this.store,
      (s) => s.value,
      (value) => {
        if (this.valueEl) this.valueEl.textContent = String(value);
      }
    );

    // Cross-instance sync: when *anyone* broadcasts `count.changed` and it's
    // not us, update our local store too. The auto-unsubscribe lives on
    // addCleanup, so disconnecting the element kills the listener.
    const off = this.bridge.on("count.changed", ({ value, by }) => {
      if (by === this.id) return;
      this.store.set({ value });
    });
    this.addCleanup(off);

    // Click → mutate local, broadcast to peers.
    const onClick = (ev: Event) => {
      const t = ev.target as HTMLElement | null;
      const act = t?.dataset.act;
      if (act !== "inc" && act !== "dec") return;
      const delta = act === "inc" ? 1 : -1;
      this.store.set((p) => ({ value: p.value + delta }));
      this.bridge.emit("count.changed", {
        value: this.store.getState().value,
        by: this.id || "?",
      });
    };
    this.shadow.addEventListener("click", onClick);
    this.addCleanup(() => this.shadow.removeEventListener("click", onClick));
  }

  /** Read-only accessor — useful for the host-page log. */
  get value(): number {
    return this.store.getState().value;
  }
}

/**
 * Element registration is split out so the host page can wire the bridge
 * into the constructor — Web Component constructors don't take arguments,
 * so we close over the shared bridge.
 */
export function registerSkCounter(bridge: CounterBridge): void {
  class BoundSkCounter extends SkCounter {
    constructor() {
      super(bridge);
    }
  }
  defineElement("sk-counter", BoundSkCounter);
}
