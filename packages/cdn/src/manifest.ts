/**
 * Bundle manifest emitter.
 *
 * Each shadowkit package becomes a separately fetchable chunk on the CDN.
 * The manifest is the contract: { pkg, file, integrity, sizeBytes } per
 * chunk. Consumers use it for SRI tags, prefetch hints, or to verify what
 * they're loading matches what was signed off in CI.
 */

import type { CDNPackage } from "./index.js";

export interface ChunkEntry {
  pkg: CDNPackage;
  file: string;
  /** sha384 base64 — same shape as `<script integrity>`. */
  integrity?: string;
  /** Size of the chunk in bytes. */
  sizeBytes?: number;
}

export interface BundleManifest {
  version: string;
  generatedAt: string;
  chunks: ChunkEntry[];
}

export function buildManifest(
  version: string,
  chunks: ChunkEntry[]
): BundleManifest {
  return {
    version,
    generatedAt: new Date().toISOString(),
    chunks,
  };
}

/**
 * Group chunks by package — handy for rendering manifests in docs or for
 * generating `<link rel="modulepreload">` blocks scoped to one package.
 */
export function groupChunks(
  manifest: BundleManifest
): Record<CDNPackage, ChunkEntry[]> {
  const out: Partial<Record<CDNPackage, ChunkEntry[]>> = {};
  for (const c of manifest.chunks) {
    const slot = out[c.pkg] ?? [];
    slot.push(c);
    out[c.pkg] = slot;
  }
  return out as Record<CDNPackage, ChunkEntry[]>;
}
