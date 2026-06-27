import { describe, expect, it } from "vitest";
import { DEVTOOLS_MESSAGE_TAG, DEVTOOLS_VERSION } from "../src/index.js";

describe("@shadowkit/devtools scaffold", () => {
  it("ships a version sentinel", () => {
    expect(typeof DEVTOOLS_VERSION).toBe("string");
  });
  it("exposes the canonical postMessage tag", () => {
    expect(DEVTOOLS_MESSAGE_TAG).toBe("shadowkit/devtools");
  });
});
