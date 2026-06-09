# @shadowkit/tailwind

> Tailwind v4 that actually works inside Shadow DOM.

The one OSS package that solves the cascade-boundary problem end-to-end:
compile Tailwind once, attach the result to every shadow root via
`adoptedStyleSheets`, share one `CSSStyleSheet` across every instance on the
page. No FOUC, no per-instance parse cost, no `@apply` workarounds, no
`<style>` proliferation.

## The problem

Tailwind v4 declares its design tokens (`--color-red-500`, `--spacing-4`, etc.)
on `:root`. Tailwind utilities reference those vars: `bg-red-500` compiles to
`background-color: var(--color-red-500)`. On a regular page that works,
because `:root` cascades into every descendant.

Shadow DOM is a cascade boundary. Variables on `:root` **do not cross into a
shadow tree**. So utility classes resolve to `unset` inside your widget and
your `bg-red-500` button is invisible.

## The fix

1. **Build:** compile Tailwind with its theme scoped to `:host` instead of
   `:root` — see `examples/tailwind-shadow.config.ts`.
2. **Runtime:** call `injectTailwind(shadowRoot, compiledCss)`.

The runtime helper:
- Wraps the CSS string in one shared `CSSStyleSheet`, keyed by component
  constructor (or any object you pass).
- Adds it to `shadowRoot.adoptedStyleSheets`.
- De-dupes on repeat calls.
- Hot-updates the cached sheet contents (HMR works for free).
- Falls back to a `<style>` element on Safari <16.4 and old WebViews.

## Usage

```ts
import { ShadowComponent, defineElement } from "@shadowkit/core";
import { injectTailwind } from "@shadowkit/tailwind";
import compiledTailwind from "./tailwind.compiled.css?inline";

class ReviewWidget extends ShadowComponent {
  constructor() {
    super();
    injectTailwind(this.shadow, compiledTailwind, {
      cacheKey: ReviewWidget, // one sheet per component class
    });
    this.shadow.innerHTML = `<button class="bg-red-500 p-4">Submit</button>`;
  }
}

defineElement("review-widget", ReviewWidget);
```

## API

### `injectTailwind(shadowRoot, compiledCss, options?)`

Attach compiled Tailwind CSS to a shadow root.

| Option     | Type      | Default     | Notes                                                        |
| ---------- | --------- | ----------- | ------------------------------------------------------------ |
| `cacheKey` | `object`  | internal    | Reuse the same `CSSStyleSheet` across instances of this key. |
| `replace`  | `boolean` | `false`     | Replace existing adopted sheets on the root.                 |

Returns the `CSSStyleSheet` (or `null` on the `<style>` fallback path).

### `supportsAdoptedTailwind: boolean`

Feature-detection flag — `true` when constructable stylesheets are available.

## Build recipes

See [`examples/tailwind-shadow.config.ts`](./examples/tailwind-shadow.config.ts)
for two integration shapes:

- **Option A** — programmatic `postcss + @tailwindcss/postcss`, for custom
  bundlers / build scripts.
- **Option B** — `@tailwindcss/vite` emitting a `?inline` raw import.

Both end in the same place: a CSS string that scopes Tailwind's theme to
`:host`, ready to hand to `injectTailwind`.
