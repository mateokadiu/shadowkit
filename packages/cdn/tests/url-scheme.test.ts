import { describe, expect, it } from "vitest";
import {
  buildAssetURL,
  buildPrefetchTags,
  parseAssetURL,
} from "../src/url-scheme.js";

describe("url-scheme", () => {
  it("builds a canonical asset URL with the default file", () => {
    const url = buildAssetURL({
      origin: "https://cdn.example.com",
      pkg: "core",
      version: "1.0.0",
    });
    expect(url).toBe("https://cdn.example.com/v1/core@1.0.0/index.js");
  });

  it("trims trailing slashes on origin", () => {
    const url = buildAssetURL({
      origin: "https://cdn.example.com/",
      pkg: "bridge",
      version: "1.0.0",
    });
    expect(url).toBe("https://cdn.example.com/v1/bridge@1.0.0/index.js");
  });

  it("supports a custom file path within the package", () => {
    const url = buildAssetURL({
      origin: "https://cdn.example.com",
      pkg: "bridge",
      version: "1.0.0",
      file: "subpath/x.js",
    });
    expect(url).toBe(
      "https://cdn.example.com/v1/bridge@1.0.0/subpath/x.js"
    );
  });

  it("parses a path-only URL", () => {
    const parsed = parseAssetURL("/v1/theme@1.0.0/index.js");
    expect(parsed).toEqual({
      pkg: "theme",
      version: "1.0.0",
      file: "index.js",
    });
  });

  it("parses a full URL", () => {
    const parsed = parseAssetURL(
      "https://cdn.example.com/v1/tailwind@1.0.0/index.js"
    );
    expect(parsed.pkg).toBe("tailwind");
  });

  it("throws on malformed paths", () => {
    expect(() => parseAssetURL("/nope")).toThrow(/malformed/);
  });

  it("throws on unknown packages", () => {
    expect(() => parseAssetURL("/v1/bogus@1.0.0/index.js")).toThrow(
      /unknown package/
    );
  });

  it("buildPrefetchTags emits one modulepreload per package", () => {
    const html = buildPrefetchTags(
      "https://cdn.example.com",
      "1.0.0",
      ["core", "bridge"]
    );
    const count = (html.match(/modulepreload/g) ?? []).length;
    expect(count).toBe(2);
    expect(html).toContain("/v1/core@1.0.0/index.js");
    expect(html).toContain("/v1/bridge@1.0.0/index.js");
  });
});
