# @shadowkit/ssr

> Declarative Shadow DOM SSR for shadowkit components.

Renders `<template shadowrootmode="open">` markup on the server and hydrates
the same element client-side with a pre-seeded store snapshot. No flash of
empty Shadow DOM, no double-render after `defineElement` runs.

## What it does

- `renderToDeclarativeShadowDOM(tag, props)` — string-level SSR. Returns
  `<tag><template shadowrootmode="open">…</template></tag>` plus a
  `<script type="application/json" data-sk-state>` blob carrying the store
  snapshot for hydration.
- `hydrate(rootEl)` — client runtime. Finds the state blob inside the host
  element, calls the component's registered hydrator to inflate the store,
  and lets the browser's built-in DSD parser attach the shadow root.

See the root README for the v1.0 release section.
