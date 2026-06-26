import { describe, expect, it } from "vitest";
import { CDN_PACKAGES, CDN_VERSION } from "../src/index.js";

describe("@shadowkit/cdn scaffold", () => {
  it("ships a version sentinel", () => {
    expect(typeof CDN_VERSION).toBe("string");
  });
  it("declares the canonical package set", () => {
    expect(CDN_PACKAGES).toContain("core");
    expect(CDN_PACKAGES).toContain("bridge");
  });
});
