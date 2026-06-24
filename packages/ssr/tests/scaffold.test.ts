import { describe, expect, it } from "vitest";
import { SSR_VERSION } from "../src/index.js";

describe("@shadowkit/ssr scaffold", () => {
  it("exports a version sentinel", () => {
    expect(typeof SSR_VERSION).toBe("string");
    expect(SSR_VERSION.length).toBeGreaterThan(0);
  });
});
