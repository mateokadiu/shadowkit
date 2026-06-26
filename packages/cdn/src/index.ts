/**
 * @shadowkit/cdn
 *
 * Typed contract for the shadowkit CDN. URL scheme, package list, manifest
 * shape. The buildable Cloudflare Worker that serves this contract lives at
 * `templates/cloudflare-worker`.
 */

export const CDN_VERSION = "1.0.0";

/** Packages shadowkit publishes as fetchable CDN chunks. */
export const CDN_PACKAGES = [
  "core",
  "theme",
  "bridge",
  "tailwind",
  "ssr",
] as const;

export type CDNPackage = (typeof CDN_PACKAGES)[number];

export {
  CDN_URL_RE,
  buildAssetURL,
  buildPrefetchTags,
  parseAssetURL,
} from "./url-scheme.js";
export type { CDNAssetURL, ParsedCDNURL } from "./url-scheme.js";

export { buildManifest, groupChunks } from "./manifest.js";
export type { BundleManifest, ChunkEntry } from "./manifest.js";
