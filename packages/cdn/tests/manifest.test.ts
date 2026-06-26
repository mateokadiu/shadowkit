import { describe, expect, it } from "vitest";
import { buildManifest, groupChunks } from "../src/manifest.js";

describe("manifest", () => {
  it("builds a manifest with a timestamp", () => {
    const m = buildManifest("1.0.0", [
      { pkg: "core", file: "index.js", sizeBytes: 1024 },
    ]);
    expect(m.version).toBe("1.0.0");
    expect(typeof m.generatedAt).toBe("string");
    expect(m.chunks).toHaveLength(1);
  });

  it("groups chunks by package", () => {
    const m = buildManifest("1.0.0", [
      { pkg: "core", file: "index.js" },
      { pkg: "core", file: "store.js" },
      { pkg: "bridge", file: "index.js" },
    ]);
    const grouped = groupChunks(m);
    expect(grouped.core).toHaveLength(2);
    expect(grouped.bridge).toHaveLength(1);
  });
});
