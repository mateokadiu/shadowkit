# shadowkit

> A production toolkit for shipping framework-agnostic embeddable Web Components.
> Tailwind v4 inside Shadow DOM, typed postMessage bridge, design-token contract, lifecycle-aware reactive store.

[![CI](https://github.com/mateokadiu/shadowkit/actions/workflows/ci.yml/badge.svg)](https://github.com/mateokadiu/shadowkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

`shadowkit` is what you reach for when you have to ship a widget that lives on
someone else's page — a checkout helper, a review widget, a price calculator,
an inline app. It solves the three things every team hits when they try to
embed a Web Component and one nobody ever budgets for:

1. **Tailwind v4 doesn't cross the Shadow DOM cascade boundary.** Its `@theme`
   vars sit on `:root`, your shadow root can't see them, every utility resolves
   to `unset`. `@shadowkit/tailwind` fixes that with a single shared
   `CSSStyleSheet` adopted into every shadow root that needs it.
2. **postMessage is the soft underbelly of every embed.** Untyped, no
   request/response correlation, no schema validation, no versioning.
   `@shadowkit/bridge` ships a symmetric typed RPC + event bus over postMessage
   with Zod-validated payloads, timeouts, structured errors, and origin
   allow-listing.
3. **Theme contracts drift.** Your embed exposes CSS vars, your host page
   hard-codes the old names, you ship a redesign, sites break.
   `@shadowkit/theme` puts the token source of truth in TypeScript, emits the
   `:host` CSS at build time, and lets you treat drift as a type error.

On top of those: `@shadowkit/core` gives you a `ShadowComponent` base class
with the lifecycle wired up properly — state survives `disconnectedCallback`,
subscriptions and listeners do not, and a reactive `createStore` /
`watchStore` pair makes the cleanup contract impossible to forget.

## Status

**v0.1** — the four packages above and a runnable demo. Stable enough to use
in production for the things it claims to do; not yet stable enough that the
API is frozen.

Shipping in [v0.2](#roadmap): `@shadowkit/ssr` (declarative shadow DOM
hydration), `@shadowkit/cdn` (Cloudflare Workers starter).

## Quick start

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @shadowkit-examples/embed-counter dev
# → http://localhost:5173
```

A minimal component looks like this:

```ts
import {
  ShadowComponent,
  defineElement,
  createStore,
  watchStore,
} from "@shadowkit/core";
import { defineTheme } from "@shadowkit/theme";
import { injectTailwind } from "@shadowkit/tailwind";
import { defineBridge } from "@shadowkit/bridge";
import { z } from "zod";

const theme = defineTheme({
  name: "review-widget",
  tokens: {
    color: { primary: "#3b82f6", surface: "#f8fafc" },
    radius: "0.5rem",
  },
});

const bridge = defineBridge(
  {
    requests: {
      "review.submit": {
        input: z.object({ text: z.string() }),
        output: z.object({ id: z.string() }),
      },
    },
    events: { "review.posted": z.object({ id: z.string() }) },
  } as const,
  { endpoint: window, allowedOrigins: [window.location.origin] }
);

class ReviewWidget extends ShadowComponent {
  private store = createStore({ count: 0 });

  constructor() {
    super();
    injectTailwind(this.shadow, theme.css, { cacheKey: ReviewWidget });
    this.shadow.innerHTML = `<button class="bg-[--color-primary]">Submit</button>`;
  }

  protected override onConnect(): void {
    watchStore(this, this.store, (s) => s.count, (n) => console.log(n));
  }
}

defineElement("review-widget", ReviewWidget);
```

## Packages

| Package                                                                         | What it does                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`@shadowkit/core`](./packages/core)                                            | `ShadowComponent` base class, `defineElement`, `createStore`/`watchStore` reactive store, lifecycle-aware cleanup         |
| [`@shadowkit/theme`](./packages/theme)                                          | `defineTheme({ tokens })` → `:host` CSS variables + generated TypeScript types. Zod-validated at build time               |
| [`@shadowkit/bridge`](./packages/bridge)                                        | `defineBridge<Schema>()` typed postMessage RPC + event channels, Zod-validated payloads, timeouts, origin allow-listing   |
| [`@shadowkit/tailwind`](./packages/tailwind)                                    | `injectTailwind(shadowRoot, compiledCss)` — Tailwind v4 inside Shadow DOM via shared `adoptedStyleSheets`. Headline fix |

## Why not just use Lit / FAST / Stencil?

Each is great at the thing it's designed for. None of them ship the
Shadow-DOM-Tailwind fix, the typed postMessage bridge, or the design-token
contract — those are the embed-shaped problems shadowkit exists for.

| Toolkit       | Shape                              | Where it falls short for embeds                                           |
| ------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| Lit           | Templating + reactive controllers  | No bridge, no Tailwind story, no theme DSL, controllers couple to Lit     |
| FAST          | Design system + WC framework       | Heavy, opinionated DI, design-system-shaped, not embed-shaped             |
| Stencil       | Compiler that emits WCs            | Compile-time-heavy, JSX, opinionated build; not a runtime                 |
| `@open-wc/*`  | Recipes + test helpers             | Recipes, not a runtime. No store, no bridge.                              |

shadowkit composes — you can use it with Lit (swap renderer), without Lit,
alongside FAST, alongside React on the host page.

## Browser support

ES2020 floor: Chrome 88+, Firefox 78+, Safari 14+. Constructable stylesheets
(`adoptedStyleSheets`) land in Safari 16.4; before that, `@shadowkit/tailwind`
falls back to a tagged `<style>` element per root.

## Roadmap

**v0.2** — Declarative Shadow DOM SSR (`@shadowkit/ssr`) + Cloudflare Worker
starter (`@shadowkit/cdn`). See [`PLAN.md`](./PLAN.md) §3-4 for the design.

**Beyond v0.2**:

- Playwright-based browser tests for real `adoptedStyleSheets` behavior
- A `@shadowkit/devtools` panel for inspecting the bridge in flight
- A `tailwindcss` build plugin so the `theme(:host)` rewrite happens
  automatically rather than as a documented pattern
- npm publish under `@shadowkit/*` once the v0.1 API has soaked

## License

MIT. See [LICENSE](./LICENSE).
