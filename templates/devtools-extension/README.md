# shadowkit-devtools-extension

> Chrome DevTools extension that surfaces shadowkit bridge messages, store
> snapshots, and lifecycle events in a dedicated panel.

## Layout

```
templates/devtools-extension/
  manifest.json
  package.json
  tsconfig.json
  public/
    devtools.html   # background page that registers the panel
    panel.html      # the panel UI shell
  src/
    devtools.ts     # panels.create() call
    panel.ts        # network + page-bridge listeners + rendering
```

## Build + load

```bash
pnpm install
pnpm build
# load `dist/` as an unpacked extension at chrome://extensions
```

## Behavior

Once installed, opening DevTools on any page that imports
`@shadowkit/devtools` and calls `tap()` (or that loads bundles from the
shadowkit CDN) shows a `shadowkit` tab next to Console.

The panel renders:

- **bridge.request / bridge.response / bridge.event** — postMessage RPC
  traffic the bridge library emitted.
- **store.snapshot** — initial-state dumps emitted by `createStore`.
- **lifecycle.connect / lifecycle.disconnect** — when a custom element with
  the tap attached connects to / detaches from the document.
- **cdn:&lt;pkg&gt;@&lt;ver&gt;** — sightings of CDN bundles fetched via the
  shadowkit URL scheme, picked up off `chrome.devtools.network`.

The "clear" button drops the in-memory buffer (capped at 500 rows by default
so long sessions don't OOM the panel).

## Implementation notes

- No `content_scripts` permission needed — the panel uses
  `chrome.devtools.inspectedWindow.eval` to install a tiny postMessage
  listener inside the inspected page and drains a buffered log via polling.
- Bridge sightings come from `chrome.devtools.network.onRequestFinished` so
  cache hits show up too.
