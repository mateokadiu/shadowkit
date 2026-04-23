# `shadowkit` — Implementation Plan

> A production-grade toolkit for shipping framework-agnostic embeddable Web Components. Solves the hard parts nobody has packaged together as OSS: **Tailwind v4 inside Shadow DOM**, **typed postMessage bridge**, **theme contract with build-time validation**, **lifecycle-safe reactive store**, **Declarative Shadow DOM SSR**, and a **lazy CDN delivery template**. Public OSS, MIT.

**Status:** Draft — pending decisions in §11 before Phase 0 starts.

---

## 1. Goals & non-goals

### Goals
- A drop-in **`@shadowkit/core` base class** that wires Shadow DOM, reactive state, scoped Tailwind, theme tokens, and a typed message bridge with a single decorator (`@shadowkit`).
- **Tailwind v4 that actually works inside Shadow DOM** — productized fix using `adoptedStyleSheets`, scoped runtime, theme-aware compiled output. No `@apply` workarounds, no hand-injected `<style>` tags.
- **Type-safe postMessage** between embed and host page (or own iframe). Zod-typed request/response + event channels, bidirectional, compile-time-checked on both ends. Heavier than `easypost`, lighter than `comlink`, and Web-Component-shaped.
- **Theme tokens as code** — TS source of truth that emits `:host { --x: y }` CSS vars + a typed host-side override API. Drift is a build error.
- **Reactive store with auto-cleanup** — survives Custom Element disconnect / reconnect / move-across-DOM without leaking subscriptions. Pluggable; not coupled to Lit.
- **Declarative Shadow DOM SSR** — render store snapshot to `<template shadowrootmode="open">` server-side; hydrate on client. Real SSR for embed widgets, not just "render a div and pop the shadow on mount."
- **CDN delivery template** — `degit`-able starter shaped for Cloudflare Workers (or any edge runtime) with chunked feature loading and `<script type=module>` boot.
- **BYO framework on the host page** — works in React, Vue, Svelte, plain HTML, server-rendered Rails, you name it. The whole point is the embed not caring.
- **Public, OSS, MIT.** Lives on GitHub from day one. npm under `@shadowkit/*`.

### Non-goals (for v1)
- **No framework adapters.** No `@shadowkit/react`, no `@shadowkit/vue`. Web Components are the adapter. Maybe later.
- **No design system / component library.** This is a toolkit, not Material/Radix/shadcn. The `examples/` folder shows shapes; consumers ship their own UI.
- **No Custom Element registry collision detection.** v1 assumes you own your tag names. v2 problem.
- **No CSS-in-JS runtime.** Tailwind v4 is the styling story; if you want emotion/stitches go elsewhere.
- **No support for non-Shadow-DOM mode.** Light-DOM embeds defeat the purpose; build different.
- **No IE11 / legacy Edge support.** ES2020 floor, modern browsers only.
- **No `<slot>` fallback machinery beyond what the platform gives you.** Slots work; we don't paper over them.
- **No virtual-DOM diffing.** Templating is `lit-html` (or a swappable renderer) — small, real-DOM, fast enough.

---

## 2. The problem

Three things go wrong every single time a team tries to ship an embeddable Web Component, and none of them have a good OSS fix today.

### 2.1 Tailwind v4 doesn't cross the Shadow DOM boundary

Tailwind generates utilities scoped to `:root` (and uses `@theme` vars that live on `:root`). Shadow roots **do not inherit** stylesheets or CSS variables declared on `:root` by default — they're a cascade boundary. So this happens:

```html
<my-widget>
  #shadow-root (open)
    <link rel="stylesheet" href="/tailwind.css">  <!-- works but: 50KB/instance, late paint -->
    <div class="bg-red-500 p-4">…</div>
</my-widget>
```

Workarounds people resort to, none good:
- **Inline `<style>` tag per instance**: flash of unstyled content, no de-dup across instances.
- **`@apply` everything**: defeats the point of Tailwind, hostile to designers.
- **CSS-in-JS bridge**: now you have two styling systems and a runtime cost.
- **`!important` everywhere on host-page utilities**: leaks back out, breaks isolation.

The right fix is one `CSSStyleSheet` constructed from Tailwind's compiled output, **shared across all instances via `adoptedStyleSheets`**. There's nothing OSS that does this end-to-end with a Tailwind v4 build plugin + a runtime base class. We ship it.

### 2.2 postMessage is the soft underbelly of every embed

Embeds talk to their host page (or their parent iframe) via `postMessage`. The actual code looks like this in every codebase that ships one:

```ts
window.addEventListener('message', (e) => {
  if (e.origin !== KNOWN_ORIGIN) return;
  if (e.data?.type === 'user-loaded') {
    // is e.data.user shaped right? who knows. cast and pray.
    setUser(e.data.user as User);
  }
});
```

Untyped, no request/response correlation, no schema validation, no versioning. When the host page version drifts from the embed version, things break in the wild and nobody notices for a week. We productize a typed bridge with:
- request/response RPC over `postMessage`
- broadcast events on named channels
- zod schemas as the wire contract
- compile-time types on both sides via shared `defineBridge<Contract>()`
- origin allow-listing as a first-class config
- correlation IDs, timeouts, structured errors

### 2.3 Theme contract drift

Embeds need to look at home on the host page. The host needs to override colors, radii, fonts. So we expose CSS vars. So we document them. So they drift — the embed adds a new token, the docs lag, the host hard-codes the old name, you ship a redesign, the host site looks broken until someone notices.

The fix: **tokens as code, source of truth in TS**. Generate the `:host` CSS vars at build time, generate a typed `applyTheme(host, overrides)` for the host page (so TS errors when a token name is wrong or a value doesn't match the token type), generate docs from the same source. Drift becomes a TypeScript error.

---

## 3. Architecture

### 3.1 Package graph

```
                                  consumer Web Component
                                              │
                                              ▼
                                  ┌───────────────────────┐
                                  │   @shadowkit/core     │
                                  │   ─ Element base class│
                                  │   ─ @shadowkit dec.   │
                                  │   ─ store / scheduler │
                                  │   ─ lifecycle bus     │
                                  └────┬──┬──┬──┬─────────┘
                                       │  │  │  │
                                       │  │  │  └────────────────────┐
                                       │  │  │                       │
                  ┌────────────────────┘  │  └─────────┐             │
                  ▼                       ▼            ▼             ▼
   ┌──────────────────────┐   ┌──────────────────┐  ┌──────────────────────┐
   │  @shadowkit/tailwind │   │ @shadowkit/theme │  │  @shadowkit/bridge   │
   │                      │   │                  │  │                      │
   │  build plugin:       │   │  token DSL →     │  │  defineBridge()      │
   │   Tailwind v4 +      │   │   :host CSS vars │  │  client + server     │
   │   Shadow-DOM safe    │   │   + TS types     │  │  zod schemas         │
   │   compile output     │   │   + applyTheme() │  │  origin allow-list   │
   │                      │   │                  │  │                      │
   │  runtime:            │   │  build-time      │  │  request / response  │
   │   sharedSheet()      │   │  validation      │  │  broadcast channels  │
   │   adoptedStyleSheets │   │  (drift = error) │  │  correlation IDs     │
   └──────────────────────┘   └──────────────────┘  └──────────────────────┘
                  │                       │
                  └──────────┬────────────┘
                             ▼
                  ┌────────────────────────┐
                  │     @shadowkit/ssr     │
                  │  renderToDeclShadow()  │
                  │  store snapshot →      │
                  │  <template shadowroot> │
                  │  hydrate() on client   │
                  └────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────────┐
                  │     @shadowkit/cdn       │
                  │  CF Worker template      │
                  │  chunked feature loader  │
                  │  long-cache + versioning │
                  └──────────────────────────┘
```

`core` is the single required dep. Everything else is opt-in and tree-shakeable. A consumer who only needs the postMessage bridge can install `@shadowkit/bridge` alone.

### 3.2 Runtime — single instance, host page, embed iframe

```
┌──────────────────────── host page (any framework) ─────────────────────────┐
│                                                                            │
│   <my-review-widget product-id="123">                                      │
│     #shadow-root (open)  ← created by @shadowkit/core base class           │
│       adoptedStyleSheets: [tailwindSheet, themeSheet]                      │
│       <div class="p-4 bg-[--sk-surface]">                                  │
│         <button @click=…>Submit</button>                                   │
│       </div>                                                               │
│                                                                            │
│   const bridge = defineBridge<HostContract>({ origin: 'host' });           │
│   bridge.call('order.fetch', { id }) ─────────────────────────────┐        │
│                                                                   │        │
└───────────────────────────────────────────────────────────────────┼────────┘
                                                                    │
                              postMessage (typed, zod-validated)    │
                                                                    │
┌───────────────────────────────────────────────────────────────────┼────────┐
│ embed iframe (optional — bridge also works window→window)         ▼        │
│                                                                            │
│   const bridge = defineBridge<HostContract>({ origin: 'embed' });          │
│   bridge.handle('order.fetch', async ({ id }) => fetchOrder(id));          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

The bridge is symmetric — same `defineBridge<Contract>()` on both ends. The shared `Contract` type lives in a `@my/embed-contract` package the consumer publishes (or just colocates) so host and embed can't drift.

### 3.3 Lifecycle (the load-bearing part)

```
constructor()
  → attachShadow({ mode: 'open' })
  → adoptedStyleSheets = [tailwindSheet(), themeSheet(opts)]
  → store = createStore(initialState)         ← subscriptions are weak-keyed
  → bridge = setupBridge(opts)                ← detached at disconnect
  → renderer = lit-html (default) or BYO
connectedCallback()
  → schedule first render
  → store.attach(this)                        ← rebind subscriptions
  → bridge.attach()
attributeChangedCallback(name, old, new)
  → store.set(attrToStateKey(name), parse(new))
  → schedule render
disconnectedCallback()
  → store.detach(this)                        ← cleanup unique to this instance
  → bridge.detach()                           ← BUT: keep state alive in store
                                                so reconnect doesn't lose it
adoptedCallback()
  → re-bind to new document's adoptedStyleSheets registry
```

The interesting invariant: **state survives disconnect**, but **subscriptions, timers, and message listeners do not**. Most "my Web Component leaks memory" complaints come from violating this. The base class enforces it.

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 5.7+, ESM-only | Modern decorators (stage-3) for `@shadowkit`; pure ESM for browsers |
| Target | ES2020 (Chrome 88+ / FF 78+ / Safari 14+) | `adoptedStyleSheets`, constructable stylesheets, modern decorators, `?.`, `??` |
| Templating | `lit-html` 3 (default, swappable) | Real-DOM, tagged-template, small, no VDOM tax |
| Reactivity | hand-rolled signals (~80 LOC) | Lit's reactive controllers are too coupled; Zustand isn't WC-aware. Tiny and focused. |
| Styling | Tailwind v4 (peer dep) | The whole point. v4's lightningcss output goes into a `CSSStyleSheet` cleanly. |
| Theme DSL | TS object literal → `:host` CSS vars at build time | No runtime cost; types are generated alongside CSS |
| Bridge schemas | Zod 3 | Same shape as the user's other projects; works for build-time + runtime |
| SSR | DSD (`<template shadowrootmode="open">`) + tiny serializer | Native platform feature, no JSDOM at runtime |
| Test (unit) | Vitest 2 + jsdom | Stores, themes, bridge unit tests run headless |
| Test (browser) | Playwright | Real shadow DOM + `adoptedStyleSheets` only behave right in real browsers |
| Test fixtures | `@web/test-runner`? **No** — Playwright covers it | Avoid a second test runner |
| Build (libs) | tsup (ESM + CJS dual) for utilities; pure ESM for browser-only packages | Match user's other projects; minimize moving parts |
| Build (Tailwind plugin) | Vite plugin shape, also exposed as a `postcss-load-config` entry | Hits the two biggest build tool families |
| Monorepo | pnpm 9 workspaces + Turborepo | Same as `@temporal-stripe` and `webhook-gateway` |
| Lint / format | Biome 1.9+ | One tool, fast, matches the user's stack |
| Versioning | semantic-release + conventional commits | Per-package npm releases |
| CI | GitHub Actions | Matrix Node 20/22, headless Playwright |
| Docs | Markdown in repo; future Mintlify | Start simple; migrate when traction warrants |
| Examples deploy | Cloudflare Pages (free) | Live embeds at `embed.shadowkit.dev/*` if domain acquired |

### 4.1 How it differs from existing toolkits

| Toolkit | License | Shape | Where it falls short for embeds |
|---|---|---|---|
| [Lit](https://lit.dev) | BSD-3 | Templating + reactive controllers | No bridge, no Tailwind story, no theme DSL, controllers couple to LitElement |
| [FAST](https://fast.design) | MIT | Design system + WC framework | Heavy, opinionated DI, design-system-shaped, not embed-shaped |
| [@open-wc](https://open-wc.org) | MIT | Recipes + testing helpers | Recipes, not a runtime. No store, no bridge. |
| [Stencil](https://stenciljs.com) | MIT | Compiler that emits WCs | Compile-time-heavy, JSX, opinionated build; not a runtime |
| [`shadowkit`](.) | MIT | Runtime toolkit + build plugins | The bridge, the Tailwind fix, the theme contract, the SSR are the product |

The shape: shadowkit is **what you reach for when Lit alone isn't enough and Stencil is too much**. It composes — you can use it with Lit (swap renderer), without Lit, alongside FAST components, alongside React on the host page.

---

## 5. Public API

### 5.1 `@shadowkit/core` — base class + decorator

```ts
// my-review-widget.ts
import { ShadowKitElement, shadowkit, prop, state } from '@shadowkit/core';
import { html } from 'lit-html';
import { reviewWidgetTheme } from './theme.js';
import { tailwind } from '@shadowkit/tailwind/runtime';

@shadowkit({
  tag: 'my-review-widget',
  theme: reviewWidgetTheme,
  styles: [tailwind()],                 // adoptedStyleSheets entries
})
export class MyReviewWidget extends ShadowKitElement {
  @prop({ type: String }) productId = '';
  @state() reviews: Review[] = [];
  @state() loading = false;

  async connectedCallback() {
    super.connectedCallback();
    this.loading = true;
    this.reviews = await this.bridge.call('reviews.list', { productId: this.productId });
    this.loading = false;
  }

  render() {
    return html`
      <div class="p-4 bg-[--sk-surface] text-[--sk-text]">
        ${this.loading
          ? html`<p>Loading…</p>`
          : this.reviews.map((r) => html`<p class="py-1">${r.body}</p>`)}
      </div>
    `;
  }
}
```

- `@shadowkit({ tag, theme, styles })` — registers the element, attaches the shadow root, wires theme tokens and adopted stylesheets.
- `@prop({ type, reflect? })` — typed attribute ↔ property binding with reflection.
- `@state()` — reactive instance state. Triggers re-render on assignment. Survives disconnect.
- `this.bridge` — typed `Bridge<Contract>` instance (if a contract was provided to `@shadowkit`).
- `this.store` — reactive store handle for cross-instance state if you opt in.
- `render()` returns a `lit-html` `TemplateResult`. Swap renderer via `@shadowkit({ renderer })`.

### 5.2 `@shadowkit/theme` — tokens as TS

```ts
// theme.ts
import { defineTheme } from '@shadowkit/theme';

export const reviewWidgetTheme = defineTheme({
  prefix: 'sk',                                              // → CSS vars named --sk-*
  tokens: {
    surface:        { type: 'color',  default: '#ffffff' },
    text:           { type: 'color',  default: '#0a0a0a' },
    accent:         { type: 'color',  default: '#5b21b6' },
    radius:         { type: 'length', default: '6px' },
    fontFamily:     { type: 'string', default: 'system-ui, sans-serif' },
    spacingUnit:    { type: 'length', default: '4px' },
  },
});

export type ReviewWidgetTheme = typeof reviewWidgetTheme;
```

At build time the theme generates:
- a `:host { --sk-surface: #ffffff; … }` `CSSStyleSheet` consumed by the base class
- a `.d.ts` for `applyTheme()` so consumers get autocomplete + type-checked overrides

```ts
// host page (any framework)
import { applyTheme } from '@shadowkit/theme/host';
import type { ReviewWidgetTheme } from '@my/embed-theme';

const widget = document.querySelector('my-review-widget')!;
applyTheme<ReviewWidgetTheme>(widget, {
  accent: '#0ea5e9',
  radius: '12px',
});                                                          // ✓ typed
applyTheme<ReviewWidgetTheme>(widget, { surfac: '#fff' });   // ✗ TS error
```

### 5.3 `@shadowkit/bridge` — typed postMessage

```ts
// contract.ts (shared between host and embed)
import { z } from 'zod';
import { defineContract } from '@shadowkit/bridge';

export const reviewBridge = defineContract({
  // RPC: caller awaits a response
  calls: {
    'reviews.list':    { input: z.object({ productId: z.string() }),
                         output: z.array(z.object({ id: z.string(), body: z.string() })) },
    'reviews.submit':  { input: z.object({ productId: z.string(), body: z.string() }),
                         output: z.object({ id: z.string() }) },
  },
  // Broadcasts: fire-and-forget, multiple subscribers
  events: {
    'auth.changed':    z.object({ userId: z.string().nullable() }),
    'theme.changed':   z.object({ name: z.string() }),
  },
});
```

```ts
// host page
import { defineBridge } from '@shadowkit/bridge';
import { reviewBridge } from './contract.js';

const bridge = defineBridge(reviewBridge, {
  side: 'host',
  allowedOrigins: ['https://embed.example.com'],
  target: () => document.querySelector('iframe.embed')!.contentWindow!,
});

bridge.handle('reviews.list', async ({ productId }) => fetchReviews(productId));
bridge.handle('reviews.submit', async (input) => insertReview(input));
bridge.emit('auth.changed', { userId: currentUser?.id ?? null });
```

```ts
// embed
import { defineBridge } from '@shadowkit/bridge';
import { reviewBridge } from './contract.js';

const bridge = defineBridge(reviewBridge, {
  side: 'embed',
  allowedOrigins: ['https://host.example.com'],
  target: window.parent,
});

const reviews = await bridge.call('reviews.list', { productId });
bridge.on('auth.changed', ({ userId }) => store.set('userId', userId));
```

- Calls have correlation IDs, default 10s timeout (configurable).
- Inputs validated with zod on receive (rejected with structured error if mismatch — and surfaced as `BridgeError` at the call site).
- Origin check runs before zod parse; mismatches are dropped silently (no oracle).
- Window-to-window (sibling iframes) supported by passing both `target` and `source` filters.

### 5.4 `@shadowkit/tailwind` — Tailwind v4 inside Shadow DOM

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { shadowkitTailwind } from '@shadowkit/tailwind/plugin';

export default defineConfig({
  plugins: [
    shadowkitTailwind({
      entry: './src/styles/tailwind.css',           // your @import "tailwindcss"; entry
      // rewrites :root selectors to :host so vars resolve inside shadow roots
      shadowHost: ':host',
    }),
  ],
});
```

```ts
// my-widget.ts
import { tailwind } from '@shadowkit/tailwind/runtime';
import { shadowkit, ShadowKitElement } from '@shadowkit/core';

@shadowkit({
  tag: 'my-widget',
  styles: [tailwind()],   // returns a singleton CSSStyleSheet; one per page, shared across instances
})
export class MyWidget extends ShadowKitElement { /* … */ }
```

The plugin rewrites `:root` → `:host` (configurable) so `--tw-*` vars land inside the shadow root, drops Tailwind's `@layer base` reset onto `:host`, and emits a single string the runtime turns into a `CSSStyleSheet`. **One sheet, N instances, zero per-instance allocation.**

### 5.5 `@shadowkit/ssr` — Declarative Shadow DOM rendering

```ts
// server.ts — any Node / edge runtime
import { renderToDeclShadow } from '@shadowkit/ssr';
import { MyReviewWidget } from './my-review-widget.js';

const html = await renderToDeclShadow(MyReviewWidget, {
  attributes: { 'product-id': '123' },
  initialState: { reviews: await fetchReviews('123') },
});

// → <my-review-widget product-id="123">
//      <template shadowrootmode="open">
//        <style>/* tailwind + theme */</style>
//        <div class="p-4 …">… reviews here …</div>
//      </template>
//    </my-review-widget>

response.html(`<!doctype html><html>…${html}…`);
```

```ts
// client boot
import { hydrateAll } from '@shadowkit/ssr/client';
import './my-review-widget.js';                   // registers the element

hydrateAll();   // finds DSD'd elements, hydrates store from data-sk-state, attaches bridge
```

Hydration uses a `<script type="application/json" id="sk-state-…">` blob per instance for the initial state — same shape as Remix / Next.js hydration islands, just keyed to a Custom Element instead of a React tree.

### 5.6 `@shadowkit/cdn` — Cloudflare Worker template

`pnpm create shadowkit my-embed --template cdn` (or `degit shadowkit/template-cdn`) scaffolds:

```
my-embed/
├── src/
│   ├── widgets/
│   │   ├── reviews.ts            ← chunk: dynamic-imported on demand
│   │   └── checkout.ts           ← chunk: dynamic-imported on demand
│   ├── boot.ts                   ← the single <script> the host page loads
│   └── index.ts
├── wrangler.toml
└── package.json
```

The Worker:
- serves `/v1/embed.js` (small loader, ~3KB, immutable cache)
- serves `/v1/chunks/*` (the actual widgets, immutable cache, long TTL)
- handles versioning via path (`/v1/…`, `/v2/…`) so cutovers are atomic
- emits CORS headers + `Cross-Origin-Resource-Policy: cross-origin`

Host page:
```html
<script src="https://embed.example.com/v1/embed.js" async></script>
<my-review-widget product-id="123"></my-review-widget>
```

The loader sees the unknown element via `customElements.whenDefined` or a `MutationObserver`, fetches the right chunk, registers the element. Other chunks stay un-fetched.

---

## 6. Project structure

```
shadowkit/
├── PLAN.md
├── README.md
├── LICENSE                                MIT
├── package.json                           workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── biome.json
├── .changeset/                            (alt: release.config.js if semantic-release wins)
├── .github/
│   └── workflows/
│       ├── ci.yml                         lint + typecheck + vitest + playwright
│       └── release.yml                    semantic-release per package
├── packages/
│   ├── core/                              @shadowkit/core
│   │   ├── src/
│   │   │   ├── element.ts                 ShadowKitElement base class
│   │   │   ├── decorator.ts               @shadowkit, @prop, @state
│   │   │   ├── store.ts                   reactive signals + auto-cleanup
│   │   │   ├── scheduler.ts               microtask render batching
│   │   │   ├── lifecycle.ts               connect/disconnect/adopt bus
│   │   │   ├── renderer.ts                lit-html default + interface
│   │   │   └── index.ts
│   │   ├── test/
│   │   │   ├── store.test.ts              vitest + jsdom
│   │   │   ├── element.test.ts            vitest + jsdom (shallow)
│   │   │   └── browser/element.spec.ts    playwright (real shadow DOM)
│   │   ├── tsup.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── bridge/                            @shadowkit/bridge
│   │   ├── src/
│   │   │   ├── contract.ts                defineContract()
│   │   │   ├── bridge.ts                  defineBridge() — host + embed sides
│   │   │   ├── transport-window.ts        postMessage transport
│   │   │   ├── transport-worker.ts        (later) Worker / SharedWorker transport
│   │   │   ├── errors.ts                  BridgeError, BridgeTimeoutError
│   │   │   └── index.ts
│   │   └── test/
│   ├── theme/                             @shadowkit/theme
│   │   ├── src/
│   │   │   ├── define.ts                  defineTheme()
│   │   │   ├── emit-css.ts                tokens → :host { --x: y } string
│   │   │   ├── emit-types.ts              tokens → .d.ts string
│   │   │   ├── apply.ts                   applyTheme() host-side API
│   │   │   ├── plugin-vite.ts             optional Vite plugin
│   │   │   └── index.ts
│   │   └── test/
│   ├── tailwind/                          @shadowkit/tailwind
│   │   ├── src/
│   │   │   ├── plugin.ts                  Vite / Rollup plugin
│   │   │   ├── postcss.ts                 PostCSS pass: :root → :host rewrite
│   │   │   ├── runtime.ts                 tailwind() singleton CSSStyleSheet
│   │   │   └── index.ts
│   │   └── test/
│   ├── ssr/                               @shadowkit/ssr
│   │   ├── src/
│   │   │   ├── render.ts                  renderToDeclShadow()
│   │   │   ├── serializer.ts              lit-html → string
│   │   │   ├── hydrate.ts                 client-side hydrateAll()
│   │   │   └── index.ts
│   │   └── test/
│   └── cdn/                               @shadowkit/cdn
│       ├── template/                      degit-able starter
│       │   ├── src/{boot.ts, widgets/}
│       │   ├── wrangler.toml
│       │   └── package.json
│       └── README.md
├── examples/
│   ├── embed-counter/                     50-line minimal — single counter, no bridge
│   ├── embed-review/                      full — bridge + theme + Tailwind + SSR
│   └── embed-checkout/                    multi-package — store + bridge + lazy chunks
└── docs/
    ├── tailwind-shadow-dom.md
    ├── bridge-cookbook.md
    ├── theme-tokens.md
    └── ssr.md
```

---

## 7. Key flows

### 7.1 Tailwind-in-Shadow-DOM lifecycle

```
Build time
──────────
1. `@import "tailwindcss";` entry → Tailwind v4 lightningcss compile.
2. @shadowkit/tailwind/plugin runs a PostCSS pass:
   - `:root { --tw-… }` → `:host, :root { --tw-… }`     (works for both)
   - `html { … }` reset → `:host { … }`
   - Strip the `*, ::before, ::after` reset that doesn't apply inside shadow
3. Final string emitted as `tailwind.css` AND as `tailwind.css.js` exporting
   `export default css\`…\``  for direct runtime import.

Runtime (browser)
──────────────────
4. First `tailwind()` call:
     - `new CSSStyleSheet()`
     - `sheet.replaceSync(compiledTailwindString)`
     - cache on `globalThis.__shadowkit_tailwind__`
5. Every `<my-widget>` constructor:
     - `this.shadowRoot.adoptedStyleSheets = [tailwindSheet, themeSheet, …]`
6. Result: one parsed sheet, N instances, zero per-instance allocation.
7. Theme overrides via `applyTheme(el, { accent: '#…' })`:
     - sets inline `el.style.setProperty('--sk-accent', value)` on the host element
     - Tailwind utilities resolve `bg-[--sk-accent]` against the new value
```

### 7.2 Bridge handshake

```
T+0   Host page boots.
T+1   defineBridge({ side: 'host', allowedOrigins }) installs `message` listener.
T+2   Embed iframe loads. defineBridge({ side: 'embed', allowedOrigins }) does the same.
T+3   Embed sends { type: 'sk.hello', v: 1, capabilities: [...] } to parent.
T+4   Host responds { type: 'sk.hello.ack', v: 1 } iff:
        - event.origin in allowedOrigins
        - v matches
T+5   Both sides mark bridge `ready`. Queued calls flush.

Calls (post-handshake)
T+n   bridge.call('reviews.list', { productId }):
        - assign correlation id `c_abc123`
        - postMessage({ type: 'sk.call', id, name, input, v })
        - resolve when matching { type: 'sk.return', id, output | error } arrives
        - reject after timeout (default 10s)
T+n   Receiver:
        - origin check
        - lookup handler for `name`
        - zod parse `input` — on failure, reply with { error: { code: 'BAD_INPUT', issues } }
        - run handler; serialize result; reply
```

### 7.3 Theme tokens → CSS vars

```
Build (tsx ./generate-theme.ts)
1. Import the TS `defineTheme({...})` object.
2. For each token:
     - emit `--<prefix>-<kebab(name)>: <default>;` to a CSS string
     - emit `<camelName>: TokenValue<'<type>'>` to a .d.ts string
3. Write `theme.css` + `theme.d.ts` into `dist/`.

Runtime
4. `themeSheet()` returns `new CSSStyleSheet().replaceSync(themeCss)` (singleton).
5. Base class adopts it on the shadow root.
6. `applyTheme(host, overrides)`:
     - for each key in overrides, validate against the token type (color / length / etc.)
     - host.style.setProperty('--<prefix>-<kebab(key)>', value)
     - shadow descendants resolve var() against host's inline style → updates instantly.
```

### 7.4 SSR + hydration

```
Server
1. renderToDeclShadow(ElementClass, { attributes, initialState }):
     a. Construct a minimal element instance (no DOM, no shadow root).
     b. Apply attributes → @prop setters.
     c. Seed @state from initialState.
     d. Invoke render() → lit-html TemplateResult.
     e. Serialize TemplateResult to HTML string.
     f. Wrap in:
         <my-tag {…attrs}>
           <template shadowrootmode="open">
             <style>{tailwind + theme strings}</style>
             {rendered html}
           </template>
           <script type="application/json" data-sk-state>{state json}</script>
         </my-tag>
2. Return string.

Client
3. Browser parses DSD natively — shadow root is attached at parse time.
4. The element script registers `my-tag` with customElements.
5. Upgrade triggers connectedCallback:
     - read sibling <script[data-sk-state]> JSON
     - seed store WITHOUT re-rendering
     - attach event listeners
     - mark hydrated; subsequent state changes re-render diff-only.
6. No flash, no double-render, no JSDOM at runtime.
```

---

## 8. Examples

### 8.1 `examples/embed-counter` — the 50-line minimum

```ts
// counter.ts
import { ShadowKitElement, shadowkit, state } from '@shadowkit/core';
import { html } from 'lit-html';
import { tailwind } from '@shadowkit/tailwind/runtime';

@shadowkit({ tag: 'sk-counter', styles: [tailwind()] })
export class Counter extends ShadowKitElement {
  @state() count = 0;
  render() {
    return html`
      <div class="p-4 flex gap-2 items-center bg-white rounded-md">
        <button class="px-3 py-1 bg-violet-600 text-white rounded"
                @click=${() => this.count--}>−</button>
        <span class="text-xl tabular-nums">${this.count}</span>
        <button class="px-3 py-1 bg-violet-600 text-white rounded"
                @click=${() => this.count++}>+</button>
      </div>
    `;
  }
}
```

```html
<script type="module" src="./counter.js"></script>
<sk-counter></sk-counter>
```

### 8.2 `examples/embed-review` — bridge + theme + SSR

`apps/host/` is a tiny Express + EJS app that:
- defines the bridge contract and serves the embed script
- renders the page server-side, calls `renderToDeclShadow` for the embed
- exposes `reviews.list` and `reviews.submit` handlers

`apps/embed/` is the actual `<my-review-widget>` element + theme + Tailwind config.

The directory doubles as the README's "real-world" walkthrough.

### 8.3 `examples/embed-checkout` — multi-package, lazy chunks

Demonstrates the CDN template: one `embed.js` loader, two widgets (`<sk-cart>`, `<sk-checkout>`) shipped as separate chunks, dynamic-imported when the elements appear in the DOM. Includes a Cloudflare Worker `wrangler dev` setup so it runs locally.

---

## 9. Test strategy

### 9.1 Unit (Vitest + jsdom)
- **Store**: subscriptions, batched updates, disconnect/reconnect retention, weakref cleanup.
- **Theme**: emit-css snapshot tests, type emission, applyTheme value coercion + rejection.
- **Bridge**: schema validation, correlation ID matching, timeout, origin rejection, error serialization. Two `MessageChannel`-backed transports talk to each other in-process — no jsdom dance.
- **Tailwind plugin**: PostCSS transformations table-driven (input CSS → expected output CSS).
- **SSR**: render → string snapshot; hydrate → state seed assertions.

### 9.2 Browser (Playwright)
- Real `adoptedStyleSheets` + DSD parsing — jsdom doesn't implement either correctly.
- **Tailwind in Shadow DOM**: render `<sk-counter>` with `bg-violet-600`, screenshot, assert pixel color at known coord.
- **Theme cascade**: apply `accent`, assert child element computed style.
- **Bridge across iframes**: page with a host frame + embed frame, drive end-to-end RPC.
- **SSR**: serve a server-rendered page, assert no flash on hydrate (compare frame 1 vs frame N).
- **Lifecycle**: append → detach → re-append; assert state preserved + subscriptions reattached.

### 9.3 CI
- Lint (Biome) + typecheck (tsc) + unit (Vitest) + browser (Playwright headless, Chromium + Firefox + WebKit).
- Matrix Node 20 / 22.
- Each package's tests gated independently; Turborepo caches results by hash of inputs.

---

## 10. Build phases

| Phase | Scope | Effort |
|---|---|---|
| **0** | Workspace scaffold: pnpm + Turborepo, tsconfig base, Biome, Vitest + jsdom, Playwright config, GH Actions CI, MIT, README skeleton | 1 evening |
| **1** | `@shadowkit/core`: ShadowKitElement, `@shadowkit` decorator, `@prop` / `@state`, signal-based store, scheduler, lifecycle bus, lit-html default renderer. Unit + browser tests for lifecycle + state retention. | 3 evenings |
| **2** | `@shadowkit/theme`: defineTheme(), CSS emission, .d.ts emission, applyTheme() host helper, optional Vite plugin, drift-detection test (assert generated CSS matches TS source) | 2 evenings |
| **3** | `@shadowkit/tailwind`: PostCSS pass for `:root → :host`, Vite plugin, runtime `tailwind()` singleton, browser test rendering a real utility inside shadow + asserting computed style | 2 evenings |
| **4** | `@shadowkit/bridge`: defineContract, defineBridge (host + embed sides), postMessage transport, zod validation, origin allow-list, timeout, BridgeError. Cross-frame Playwright test. | 2 evenings |
| **5** | `@shadowkit/ssr`: renderToDeclShadow, lit-html serializer, hydrateAll() client. SSR snapshot tests + no-flash Playwright test. | 2 evenings |
| **6** | `examples/embed-counter`, `examples/embed-review`, README screenshots, docs/*.md. | 2 evenings |
| **7** | `@shadowkit/cdn` template: Wrangler scaffold, chunked widget loader, `pnpm create shadowkit`. `examples/embed-checkout` showing it end-to-end. | 2 evenings |
| **8** | semantic-release + first npm publish across packages, GH release page, optional Mintlify migration | 1 evening |

**Total v1:** ~17 evenings. Realistically 5-6 weeks at sustainable cadence.

---

## 11. Decisions to confirm before Phase 0

| # | Decision | Default (recommended) | Alternative |
|---|---|---|---|
| 1 | npm scope | **`@shadowkit/*`** — org-scoped, matches `@temporal-stripe/*` shape; reserve the org on npm day 1 | `@kadiu/shadowkit-*`, unscoped `shadowkit-*` |
| 2 | GitHub repo name | **`shadowkit`** | `shadow-kit`, `shadowkit-toolkit` |
| 3 | Repo location | **`~/Desktop/development/personal/shadowkit/`** (exists, empty) | other |
| 4 | Monorepo vs single package | **Monorepo** — five distinct packages with non-overlapping deps; consumers will install subsets | Single `shadowkit` with subpath imports |
| 5 | Default renderer | **`lit-html` 3** (peer dep, swappable via `@shadowkit({ renderer })`) | preact/htm, hand-rolled DOM diff, no renderer (BYO) |
| 6 | Tailwind v4 version range | **`tailwindcss@^4.0`** as a peer dep | bundle a specific version (rejected — peer keeps it flexible) |
| 7 | Browser support floor | **ES2020 / Chrome 88+ / Firefox 78+ / Safari 14+** (covers `adoptedStyleSheets` + DSD) | Tighter (Chrome 124+ for native CSS nesting), looser (drop DSD, fall back to JS DSD polyfill) |
| 8 | SSR strategy | **Native Declarative Shadow DOM** (`<template shadowrootmode="open">`) with a tiny serializer | JSDOM-backed SSR (rejected — too heavy for edge runtimes) |
| 9 | Decorator flavor | **TC39 stage-3 decorators** (TS 5.x native, no `experimentalDecorators`) | Legacy decorators (compat with older TS configs) |
| 10 | Versioning | **semantic-release + conventional commits**, per-package | Changesets (more control, more ceremony) |
| 11 | Bridge transport in v0.1 | **`postMessage` only** (window↔window, window↔iframe) | Also Worker / SharedWorker / BroadcastChannel at v0.1 (deferred to v0.2) |
| 12 | First example to ship | **`embed-counter`** (50 LOC, no deps beyond core + tailwind) — then `embed-review` | Lead with `embed-review` (more impressive but slower to read) |

---

## 12. Out of scope (explicit)

- **No framework adapters** (`@shadowkit/react`, `@shadowkit/vue`). The whole point is Web Components are the adapter.
- **No design system / component library.** Toolkit, not Material/Radix/shadcn.
- **No Custom Element registry collision detection** at v1. Consumers own their tag names.
- **No CSS-in-JS runtime.** Tailwind or `<style>` blocks; that's the story.
- **No light-DOM mode.** If you don't want isolation, you don't need shadowkit.
- **No IE11 / legacy Edge.** ES2020 floor.
- **No SSR for non-Node runtimes at v1** beyond what fits in an edge-worker (string concat, no DOM). Bun / Deno will likely just work but aren't tested matrix items.
- **No managed CDN / SaaS.** `@shadowkit/cdn` is a template, not a hosted service.
- **No accessibility primitives.** Shadow DOM doesn't break a11y; consumer is responsible for their own ARIA. We won't paper over it.

---

## 13. References

- Lit — element + lit-html: https://lit.dev
- FAST — design system framework: https://fast.design
- @open-wc — testing & recipes: https://open-wc.org
- Stencil — compiler-driven WCs: https://stenciljs.com
- web.dev — Declarative Shadow DOM: https://web.dev/articles/declarative-shadow-dom
- WICG — Declarative Shadow DOM proposal: https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Declarative-Shadow-DOM.md
- MDN — `adoptedStyleSheets`: https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets
- MDN — Constructable Stylesheets: https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet
- Tailwind v4 — engine docs: https://tailwindcss.com/docs/v4-beta
- Tailwind GH — Shadow DOM cascade boundary discussion: https://github.com/tailwindlabs/tailwindcss/discussions
- Comlink — RPC over postMessage (heavier prior art): https://github.com/GoogleChromeLabs/comlink
- Cloudflare Workers — static assets + module workers: https://developers.cloudflare.com/workers/static-assets/
- TC39 — stage-3 decorators: https://github.com/tc39/proposal-decorators
