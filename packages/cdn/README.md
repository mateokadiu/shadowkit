# @shadowkit/cdn

> Cloudflare Workers CDN helpers + a buildable starter under
> `templates/cloudflare-worker`.

This package is the typed contract: the canonical list of shadowkit
packages, the URL scheme they live under, and the manifest shape the worker
ships alongside each release.

## URL scheme

```
/v1/<package>@<version>/<file>
```

- `<package>` — one of `core`, `theme`, `bridge`, `tailwind`, `ssr`.
- `<version>` — exact semver pin (e.g. `1.0.0`). The worker rejects
  mismatches by design — cached assets must be immutable.
- `<file>` — `index.js`, `index.d.ts`, or any nested export path.

### Examples

```ts
import { buildAssetURL, buildPrefetchTags } from "@shadowkit/cdn";

buildAssetURL({
  origin: "https://shadowkit.example.com",
  pkg: "core",
  version: "1.0.0",
});
// → "https://shadowkit.example.com/v1/core@1.0.0/index.js"

buildPrefetchTags(
  "https://shadowkit.example.com",
  "1.0.0",
  ["core", "bridge"]
);
// → '<link rel="modulepreload" href=".../v1/core@1.0.0/index.js" /> …'
```

## Tree shaking at the URL layer

Each package is a separately fetchable chunk. A consumer that only needs
`@shadowkit/core` pays for the core bytes — not the bridge, not the theme.
That's the part bundler tree-shaking can't deliver to consumers who don't
run a bundler at all, which is the common embed case.

## Manifest

`buildManifest(version, chunks)` returns the `{ version, generatedAt,
chunks: [{ pkg, file, integrity?, sizeBytes? }] }` shape your release
pipeline ships next to the bundles. `groupChunks(manifest)` gives you a
per-package view for rendering docs or per-package preload blocks.

## Cloudflare Worker template

The buildable worker lives at `templates/cloudflare-worker/`. Run:

```bash
cd templates/cloudflare-worker
pnpm install
pnpm wrangler dev
```

The template's README walks through deployment.
