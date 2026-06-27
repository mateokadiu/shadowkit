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
    panel.ts        # panel logic
```

## Build + load

```bash
pnpm install
pnpm build
# load `dist/` as an unpacked extension at chrome://extensions
```

## Behavior (v0.1 scaffold)

The panel renders an empty-state shell and a "clear" button. The next commit
wires it to capture shadowkit bridge messages via `chrome.devtools.network`.
