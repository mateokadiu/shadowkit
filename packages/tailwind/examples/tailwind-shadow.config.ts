/**
 * Build-time recipe: compile Tailwind v4 to a string scoped to `:host`
 * (so the design tokens cross the Shadow DOM cascade boundary), then hand
 * the result to `injectTailwind` at runtime.
 *
 * Why a string and not a `<link>`: a `<link>` inside each shadow root parses
 * once per instance. We want a single shared `CSSStyleSheet` via
 * `adoptedStyleSheets`, deduped across every embed on the page.
 *
 * This file is documentation. It does NOT import @tailwindcss/postcss /
 * tailwindcss directly — @shadowkit/tailwind treats them as optional peer
 * deps so you can pin whatever Tailwind v4 minor you want.
 *
 * Two integration shapes follow. Pick one.
 */

/* ─── Option A: tailwindcss/postcss programmatic compile ────────────────── */
//
// Suitable for: build scripts, custom bundlers, esbuild plugin authors.
//
// ```ts
// import postcss from 'postcss';
// import tailwind from '@tailwindcss/postcss';
//
// async function buildTailwindForShadow(input: string): Promise<string> {
//   const css = `
//     /* Crucially: scope Tailwind's @theme to :host, not :root.
//        On a normal page @theme defaults to :root; inside Shadow DOM
//        :root is outside the cascade boundary, so utilities resolve to
//        unset. :host puts the tokens where the utilities will see them. */
//     @import "tailwindcss" theme(:host);
//     @source "${input}";
//   `;
//   const result = await postcss([tailwind()]).process(css, { from: undefined });
//   return result.css;
// }
// ```
//
// In your component constructor:
// ```ts
// import { injectTailwind } from '@shadowkit/tailwind';
// import compiled from './tailwind.compiled.css?raw';
//
// class MyWidget extends ShadowComponent {
//   constructor() {
//     super();
//     injectTailwind(this.shadow, compiled, { cacheKey: MyWidget });
//   }
// }
// ```

/* ─── Option B: Vite plugin (@tailwindcss/vite) emitting a `?raw` import ── */
//
// Easiest when your widget already has a Vite build. The trick is keeping
// Tailwind's output OUT of the page <head>, so it doesn't pollute the host
// page's global styles.
//
// 1. In `vite.config.ts`, exclude Tailwind from the page's index.html and
//    instead build a standalone CSS entry:
//
// ```ts
// import { defineConfig } from 'vite';
// import tailwind from '@tailwindcss/vite';
//
// export default defineConfig({
//   plugins: [tailwind()],
//   build: {
//     rollupOptions: {
//       input: {
//         widget: 'src/widget.ts',
//         'widget-styles': 'src/widget-styles.css', // ← Tailwind entry, isolated
//       },
//     },
//   },
// });
// ```
//
// 2. `src/widget-styles.css` declares Tailwind scoped to `:host`:
//
// ```css
// @import "tailwindcss" theme(:host);
// ```
//
// 3. Inline-import the compiled string in your widget source:
//
// ```ts
// import compiled from './widget-styles.css?inline';
// import { injectTailwind } from '@shadowkit/tailwind';
//
// class MyWidget extends ShadowComponent {
//   constructor() {
//     super();
//     injectTailwind(this.shadow, compiled, { cacheKey: MyWidget });
//   }
// }
// ```
//
// `?inline` is a Vite primitive that yields the post-build CSS string at
// import time. Equivalent in other bundlers: esbuild's `loader: { '.css':
// 'text' }`, webpack's `asset/source`.

/* ─── On `theme(:host)` ─────────────────────────────────────────────────── */
//
// Tailwind v4's `@import "tailwindcss"` accepts a `theme(<selector>)` modifier
// that controls where the design tokens declare their CSS variables. The
// default is `:root`; for Shadow DOM you want `:host`.
//
// If your Tailwind version doesn't accept that modifier yet, the fallback is
// to manually rewrite the compiled CSS post-build:
//
// ```ts
// compiled = compiled.replace(/:root\b/g, ':host');
// ```
//
// That string substitution is safe in practice because Tailwind v4 only emits
// `:root` for its design-token `@theme` block.

export {};
