# @shadowkit/core

> Lifecycle-safe base class + reactive store for embeddable Web Components.

The base layer of [shadowkit](https://github.com/mateokadiu/shadowkit). One
required dep; everything else is opt-in.

## What's here

- **`ShadowComponent`** — base class for Web Components with the shadow root
  attached, scoped stylesheets wired through `adoptedStyleSheets` (with a
  `<style>` fallback on Safari <16.4), and a disposer registry that runs in
  LIFO order on `disconnectedCallback`.
- **`defineElement(name, ctor)`** — safe registry helper that no-ops on
  duplicate registration. Embeds get shipped twice on the same page in the
  real world; `customElements.define` throwing kills the host page.
- **`createStore<T>` + `watchStore`** — minimal reactive store with
  selector-based subscriptions that auto-unsubscribe when the host element
  disconnects. State survives detach; subscriptions don't.

## Install

```bash
pnpm add @shadowkit/core
```

## Usage

```ts
import {
  ShadowComponent,
  defineElement,
  createStore,
  watchStore,
} from "@shadowkit/core";

class Counter extends ShadowComponent {
  private store = createStore({ value: 0 });

  constructor() {
    super({ styles: `:host { display: inline-block; } button { padding: .5rem 1rem; }` });
    this.shadow.innerHTML = `<button data-act="inc">+</button> <span>0</span>`;
  }

  protected override onConnect(): void {
    const span = this.shadow.querySelector("span")!;
    watchStore(this, this.store, (s) => s.value, (n) => (span.textContent = String(n)));

    const onClick = () => this.store.set((p) => ({ value: p.value + 1 }));
    this.shadow.addEventListener("click", onClick);
    this.addCleanup(() => this.shadow.removeEventListener("click", onClick));
  }
}

defineElement("sk-counter", Counter);
```

## API

### `class ShadowComponent extends HTMLElement`

```ts
new ShadowComponent({ mode?, delegatesFocus?, styles? })
```

| Option           | Type              | Default  | Notes                                                |
| ---------------- | ----------------- | -------- | ---------------------------------------------------- |
| `mode`           | `ShadowRootMode`  | `"open"` | Forwarded to `attachShadow`.                         |
| `delegatesFocus` | `boolean`         | `false`  | Forwarded to `attachShadow`.                         |
| `styles`         | `string`          | —        | Scoped CSS attached via `adoptedStyleSheets`.        |

**Hooks** (override these; don't override `connectedCallback` directly):

- `protected onConnect(): void` — runs once per connect.
- `protected onDisconnect(): void` — runs once per disconnect, after disposers.

**Instance**:

- `shadow: ShadowRoot` — open shadow root, attached in the constructor.
- `isConnected: boolean` — true between connect and disconnect.
- `addCleanup(fn: () => void): void` — register a disposer. Runs in LIFO order
  on `disconnectedCallback`. If called while already disconnected, runs
  synchronously.

### `defineElement(name, ctor, options?)`

Registers `ctor` under `name`. No-ops (and warns once by default) on duplicate.

```ts
const result = defineElement("sk-foo", Foo);
if (!result.defined) console.warn("already registered:", result.existing);
```

`options.warnOnDuplicate: false` silences the warning. `options.registry`
overrides the default `customElements` registry (useful in tests).

### `createStore<T>(initial)`

Returns a `Store<T>` with `getState`, `set(value | updater)`, and `subscribe`.
Identity-equal `set()` calls no-op; listeners are snapshotted before iteration
so handlers can unsubscribe mid-batch.

### `watchStore(host, store, selector, listener, options?)`

Subscribe to a slice of `store`, auto-unsubscribing on `host.disconnectedCallback`.
The unsubscribe goes through `host.addCleanup`, so the contract is exactly
"the subscription dies when the element does."

| Option      | Type      | Default | Notes                                                     |
| ----------- | --------- | ------- | --------------------------------------------------------- |
| `immediate` | `boolean` | `true`  | Fire `listener` once synchronously with the current value |

Returns the unsubscribe so callers can also tear it down manually.

### Stylesheet helpers (advanced)

- `attachStyles(shadowRoot, css, cacheKey)` — what `ShadowComponent` uses
  internally. Exposed for cases where you want to attach more sheets to the
  same root.
- `supportsConstructableStyleSheets: boolean` — feature flag.

## License

MIT.
