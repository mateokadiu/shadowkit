/**
 * @shadowkit/cdn — URL scheme + tree-shaken chunking conventions.
 *
 * The starter Worker that ships these bundles lives at
 * `templates/cloudflare-worker`. This package is the typed contract that
 * worker uses (and that consumers can use too, for prefetch hints or
 * subresource integrity).
 */

export const CDN_VERSION = "0.1.0";

/** Packages shadowkit publishes as fetchable CDN chunks. */
export const CDN_PACKAGES = [
  "core",
  "theme",
  "bridge",
  "tailwind",
  "ssr",
] as const;

export type CDNPackage = (typeof CDN_PACKAGES)[number];
