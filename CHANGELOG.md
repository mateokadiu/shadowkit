# changelog

all notable shadowkit releases. dates in CEST.

## 1.0.0 — 2026-06-28

first stable release. v0.1 shipped four packages; v1.0 ships eight, a
Cloudflare-Workers CDN starter, a Chrome DevTools extension scaffold, and a
real-browser Playwright suite.

### added

- `@shadowkit/ssr` — declarative-shadow-DOM SSR.
  `renderToDeclarativeShadowDOM(tag, props)` returns the
  `<tag><template shadowrootmode>…</template></tag>` markup plus a
  `<script data-sk-state>` blob carrying the initial store snapshot.
  `hydrate(host)` / `hydrateAll(root)` wires the snapshot back into the
  component client-side without re-rendering.
- `@shadowkit/cdn` — typed contract for the Cloudflare-Workers CDN: URL
  scheme (`/v1/<pkg>@<ver>/<file>`), per-package chunk manifest,
  `buildPrefetchTags` helper. Buildable worker at
  `templates/cloudflare-worker/`.
- `@shadowkit/tailwind-postcss` — real PostCSS plugin that rewrites Tailwind
  v4's `:root` output to `:host` automatically (the v0.1 README documented
  it as a pattern; v1.0 ships the automation). Resolves `theme(:host)`
  macros and can emit a parallel CSS module ready for `injectTailwind`.
- `@shadowkit/devtools` — runtime tap (`tap().emit(kind, data, tagName)`)
  paired with a Chrome DevTools extension scaffold at
  `templates/devtools-extension/`. The panel listens via
  `chrome.devtools.network.onRequestFinished` for CDN sightings and via an
  injected postMessage listener for live bridge traffic.
- Playwright e2e suite under `e2e/` — real `customElements`, real Shadow
  DOM, real `adoptedStyleSheets` reference sharing, real cascade-boundary
  isolation. Opt-in via `pnpm test:e2e`.

### changed

- All package versions bumped from `0.1.0` to `1.0.0`.
- Workspace adds `e2e` so Playwright lives next to the unit tests but stays
  excluded from the default `pnpm test` (turbo filter
  `!@shadowkit-e2e/*`).
- Root README expanded with SSR, CDN, DevTools, and Playwright sections.

### unchanged

- ES2020 floor; Chrome 88+, Firefox 78+, Safari 14+.
- Constructable stylesheets fall back to a `<style>` tag per root on
  pre-16.4 Safari.

## 0.1.0 — 2026-06-23

initial release.

- `@shadowkit/core` — `ShadowComponent`, `defineElement`, `createStore`,
  `watchStore`.
- `@shadowkit/theme` — `defineTheme` + `:host` CSS var emission.
- `@shadowkit/bridge` — typed postMessage RPC + event channels with Zod
  schemas, timeouts, origin allow-listing.
- `@shadowkit/tailwind` — `injectTailwind` runtime helper.
- Demo at `examples/embed-counter/` and CI on GitHub Actions.
