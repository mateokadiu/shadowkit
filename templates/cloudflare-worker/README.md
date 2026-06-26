# shadowkit-cdn-worker

> Cloudflare Worker starter that serves shadowkit bundles, one chunk per
> package, with a long-cache + CORS-allow-list response shape.

## Layout

```
templates/cloudflare-worker/
  package.json
  wrangler.toml
  tsconfig.json
  src/
    worker.ts
```

Bundles live under `/bundles/<package>/index.js` in your asset store. Wrangler
v3+ ships the `assets` binding; point it at a directory of pre-built shadowkit
packages and the worker takes care of routing.

## URL scheme

```
GET /v1/<package>@<version>/<file>
```

Where:

- `<package>` is one of `core`, `theme`, `bridge`, `tailwind`, `ssr`
- `<version>` matches `env.SHADOWKIT_VERSION` (the worker rejects mismatches —
  pinning is forced so caching is sound)
- `<file>` is `index.js`, `index.d.ts`, or any nested export path

Example:

```html
<script type="module">
  import { ShadowComponent } from "https://shadowkit.example.com/v1/core@1.0.0/index.js";
</script>
```

## Caching

Successful responses ship with `cache-control: public, max-age=31536000, immutable`.
Wrong-version responses ship with `cache-control: no-store` so a botched
deploy doesn't poison the edge.

## Local dev

```bash
pnpm install
pnpm wrangler dev
# → http://127.0.0.1:8787
```

## Deploy

Set the route in `wrangler.toml`, then:

```bash
pnpm wrangler deploy
```
