/**
 * URL scheme helpers — shared between the worker and consumers.
 *
 * Keeping the regex and the builder in one place means worker, prefetch tags,
 * import-map generators, and SRI manifests all stay in sync without anyone
 * re-implementing the path shape and getting the version pin wrong.
 */

import type { CDNPackage } from "./index.js";
import { CDN_PACKAGES } from "./index.js";

/** Matches `/v1/<package>@<version>/<file>`. */
export const CDN_URL_RE = /^\/v1\/([a-z][a-z-]*)@([\w.-]+)\/(.+)$/;

export interface CDNAssetURL {
  /** Origin to prefix, e.g. `https://shadowkit.example.com`. */
  origin: string;
  /** Package name (without the `@shadowkit/` scope). */
  pkg: CDNPackage;
  /** Version pin — must be an exact semver. */
  version: string;
  /** File within the package, e.g. `index.js`. */
  file?: string;
}

/** Build a fully-qualified asset URL. */
export function buildAssetURL({
  origin,
  pkg,
  version,
  file = "index.js",
}: CDNAssetURL): string {
  const trimmed = origin.replace(/\/+$/, "");
  return `${trimmed}/v1/${pkg}@${version}/${file}`;
}

export interface ParsedCDNURL {
  pkg: CDNPackage;
  version: string;
  file: string;
}

/**
 * Parse an asset path or URL. Throws if it doesn't match the scheme or names
 * an unknown package — the goal is to fail loud at config time, not silently
 * 404 in production.
 */
export function parseAssetURL(input: string): ParsedCDNURL {
  const path = input.startsWith("http") ? new URL(input).pathname : input;
  const m = path.match(CDN_URL_RE);
  if (!m) {
    throw new Error(`[shadowkit/cdn] malformed asset URL: ${input}`);
  }
  const [, pkg, version, file] = m as unknown as [string, string, string, string];
  if (!(CDN_PACKAGES as readonly string[]).includes(pkg)) {
    throw new Error(`[shadowkit/cdn] unknown package: ${pkg}`);
  }
  return { pkg: pkg as CDNPackage, version, file };
}

/**
 * Build the prefetch HTML for a set of packages — drop in your `<head>` to
 * warm the edge cache before the first script runs.
 */
export function buildPrefetchTags(
  origin: string,
  version: string,
  pkgs: readonly CDNPackage[] = CDN_PACKAGES
): string {
  return pkgs
    .map((pkg) => {
      const href = buildAssetURL({ origin, pkg, version });
      return `<link rel="modulepreload" href="${href}" />`;
    })
    .join("");
}
