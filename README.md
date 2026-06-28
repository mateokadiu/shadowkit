# shadowkit

> A production toolkit for shipping framework-agnostic embeddable Web Components.
> Tailwind v4 inside Shadow DOM, typed postMessage bridge, design-token contract,
> lifecycle-aware reactive store, declarative-shadow-DOM SSR, Cloudflare-Workers
> CDN starter, and a Chrome DevTools panel.

[![CI](https://github.com/mateokadiu/shadowkit/actions/workflows/ci.yml/badge.svg)](https://github.com/mateokadiu/shadowkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

`shadowkit` is what you reach for when you have to ship a widget that lives on
someone else's page — a checkout helper, a review widget, a price calculator,
an inline app. It solves the three things every team hits when they try to
embed a Web Component and four nobody ever budgets for:

1. **Tailwind v4 doesn't cross the Shadow DOM cascade boundary.** Its `@theme`
   vars sit on `:root`, your shadow root can't see them, every utility resolves
   to `unset`. `@shadowkit/tailwind` ships the runtime injector;
   `@shadowkit/tailwind-postcss` rewrites compiled output to `:host`
   automatically at build time.
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
with the lifecycle wired up properly; `@shadowkit/ssr` renders declarative
Shadow DOM markup server-side so the first byte paints; `@shadowkit/cdn`
chunks each package into a separately fetchable URL; `@shadowkit/devtools`
exposes a Chrome DevTools panel for bridge messages, store snapshots, and
lifecycle events.

## Status

**v1.0** — the eight packages below, a Cloudflare-Worker CDN starter, a
Chrome DevTools extension scaffold, jsdom-backed unit tests, and a Playwright
suite that exercises real `customElements`, real Shadow DOM, real
`adoptedStyleSheets`.

## Quick start

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @shadowkit-examples/embed-counter dev
# → http://localhost:5173

# real-browser tests (opt-in — installs chromium under e2e/)
pnpm --filter @shadowkit-e2e/playwright test:e2e:install
pnpm test:e2e
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

| Package                                                                    | What it does                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`@shadowkit/core`](./packages/core)                                       | `ShadowComponent` base class, `defineElement`, `createStore`/`watchStore` reactive store, lifecycle-aware cleanup           |
| [`@shadowkit/theme`](./packages/theme)                                     | `defineTheme({ tokens })` -> `:host` CSS variables + generated TypeScript types. Zod-validated at build time                |
| [`@shadowkit/bridge`](./packages/bridge)                                   | `defineBridge<Schema>()` typed postMessage RPC + event channels, Zod-validated payloads, timeouts, origin allow-listing     |
| [`@shadowkit/tailwind`](./packages/tailwind)                               | `injectTailwind(shadowRoot, compiledCss)` — Tailwind v4 inside Shadow DOM via shared `adoptedStyleSheets`. Headline fix     |
| [`@shadowkit/tailwind-postcss`](./packages/tailwind-postcss)               | PostCSS plugin that rewrites `:root` -> `:host`, expands `theme(:host)`, and emits a CSS module for `injectTailwind`        |
| [`@shadowkit/ssr`](./packages/ssr)                                         | `renderToDeclarativeShadowDOM(tag, props)` server-side, `hydrate(host)` client-side. First-byte painting, store-seeded     |
| [`@shadowkit/cdn`](./packages/cdn)                                         | URL scheme, per-package chunk manifest, prefetch tag builder. Cloudflare Worker starter at `templates/cloudflare-worker`    |
| [`@shadowkit/devtools`](./packages/devtools)                               | `tap()` runtime + a Chrome DevTools extension scaffold at `templates/devtools-extension` that surfaces bridge traffic       |

## SSR with `@shadowkit/ssr`

```ts
import {
  registerShadowRenderer,
  renderToDeclarativeShadowDOM,
} from "@shadowkit/ssr";

registerShadowRenderer<{ count: number }>("sk-counter", ({ props }) => ({
  shadowHtml: `<span>count: ${props.count}</span>`,
  state: { count: props.count },
}));

const html = await renderToDeclarativeShadowDOM("sk-counter", { count: 7 });
// → <sk-counter data-sk-state-id="sk-state-sk-counter-1">
//     <template shadowrootmode="open"><span>count: 7</span></template>
//     <script type="application/json" data-sk-state id="sk-state-…">{"count":7}</script>
//   </sk-counter>
```

Client-side:

```ts
import { registerHydrator, hydrateAll } from "@shadowkit/ssr";

registerHydrator<{ count: number }>("sk-counter", (host, state) => {
  // Re-seed the store with the server snapshot. `customElements.upgrade`
  // happens automatically once your component is defined.
  myStore.set({ count: state?.count ?? 0 });
});

await hydrateAll();
```

## CDN with `@shadowkit/cdn`

```ts
import { buildAssetURL, buildPrefetchTags } from "@shadowkit/cdn";

const url = buildAssetURL({
  origin: "https://shadowkit.example.com",
  pkg: "core",
  version: "1.0.0",
});
// → "https://shadowkit.example.com/v1/core@1.0.0/index.js"
```

The Cloudflare Worker that serves this scheme lives at
`templates/cloudflare-worker/`. Tree-shaken at the URL layer: a consumer that
only needs `@shadowkit/core` downloads core bytes only.

## DevTools panel

```ts
import { tap } from "@shadowkit/devtools";

const t = tap();
t.emit("bridge.request", { method: "order.fetch", id: "abc" }, "sk-order");
```

Load `templates/devtools-extension/dist/` as an unpacked extension at
`chrome://extensions`. A `shadowkit` tab shows up next to Console and shows
every event the runtime emits.

## Playwright

Real-browser tests live under `e2e/`. They cover:

- `customElements.define` + shadow root attachment
- `adoptedStyleSheets` reference sharing across instances
- Live updates to a shared `CSSStyleSheet` propagating to every adopter
- Cascade-boundary isolation between host page styles and the shadow tree

```bash
pnpm --filter @shadowkit-e2e/playwright test:e2e:install   # one-time
pnpm test:e2e
```

## Why not just use Lit / FAST / Stencil?

Each is great at the thing it's designed for. None of them ship the
Shadow-DOM-Tailwind fix, the typed postMessage bridge, the design-token
contract, the declarative-shadow-DOM SSR helper, or the URL-layer tree-shaken
CDN — those are the embed-shaped problems shadowkit exists for.

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

## License

MIT. See [LICENSE](./LICENSE).
