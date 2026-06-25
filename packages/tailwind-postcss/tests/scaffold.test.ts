import { describe, expect, it } from "vitest";
import {
  PLUGIN_NAME,
  TAILWIND_POSTCSS_VERSION,
} from "../src/index.js";

describe("@shadowkit/tailwind-postcss scaffold", () => {
  it("exposes the canonical plugin name", () => {
    expect(PLUGIN_NAME).toBe("@shadowkit/tailwind-postcss");
  });
  it("ships a version string", () => {
    expect(typeof TAILWIND_POSTCSS_VERSION).toBe("string");
  });
});
