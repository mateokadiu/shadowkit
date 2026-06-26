# @shadowkit/cdn

> Cloudflare Workers CDN helpers + a buildable starter under
> `templates/cloudflare-worker`.

This package is the typed contract: it declares the canonical list of
shadowkit packages that the CDN serves and the URL scheme they live under.
The worker template uses it; consumers can use it for prefetch hints, SRI
manifests, or import-map generation.

## URL scheme

```
/v1/<package>@<version>/<file>
```

Spelled out in `templates/cloudflare-worker/README.md`.

## Tree shaking at the URL layer

Each shadowkit package is a separately fetchable chunk. A consumer that only
needs `@shadowkit/core` pays for the core bytes — none of the bridge, none of
the theme. That's what URL-level splitting buys you on top of bundler
tree-shaking: it works even when the consumer can't run a bundler at all,
which is the common embed case.
