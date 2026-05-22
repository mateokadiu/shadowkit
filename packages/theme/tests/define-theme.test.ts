import { describe, expect, it } from "vitest";
import { defineTheme } from "../src/define-theme.js";

describe("defineTheme", () => {
  it("emits :host { --x: y; } CSS from a flat token tree", () => {
    const t = defineTheme({
      name: "default",
      tokens: {
        primary: "#3b82f6",
        radius: "0.5rem",
      },
    });
    expect(t.css).toContain(":host {");
    expect(t.css).toContain("--primary: #3b82f6;");
    expect(t.css).toContain("--radius: 0.5rem;");
  });

  it("flattens nested tokens to kebab-case variable names", () => {
    const t = defineTheme({
      name: "default",
      tokens: {
        color: {
          surface: { fg: "#fff", bg: "#000" },
        },
      },
    });
    expect(t.variables).toEqual({
      "--color-surface-fg": "#fff",
      "--color-surface-bg": "#000",
    });
    expect(t.css).toContain("--color-surface-fg: #fff;");
    expect(t.css).toContain("--color-surface-bg: #000;");
  });

  it("accepts the { value, description } envelope and writes a comment", () => {
    const t = defineTheme({
      name: "default",
      tokens: {
        primary: { value: "#3b82f6", description: "brand blue" },
      },
    });
    expect(t.css).toContain("--primary: #3b82f6;");
    expect(t.css).toContain("/* brand blue */");
  });

  it("emits numeric tokens without quoting", () => {
    const t = defineTheme({
      name: "default",
      tokens: { zIndexBase: 100 },
    });
    expect(t.css).toContain("--zIndexBase: 100;");
    expect(t.variables["--zIndexBase"]).toBe(100);
  });

  it("emits a TS type with primitives matching token value type", () => {
    const t = defineTheme({
      name: "review-widget",
      tokens: {
        color: { primary: "#3b82f6" },
        radiusPx: 8,
      },
    });
    expect(t.types).toContain("ReviewWidgetTokens");
    expect(t.types).toContain('"color"');
    expect(t.types).toContain('"primary": string');
    expect(t.types).toContain('"radiusPx": number');
  });

  it("rejects an empty theme name", () => {
    expect(() =>
      defineTheme({ name: "", tokens: { x: "y" } })
    ).toThrow(/Too small|String must contain at least 1/);
  });

  it("rejects a non-kebab-case theme name", () => {
    expect(() =>
      defineTheme({ name: "MyTheme", tokens: { x: "y" } })
    ).toThrow(/lowercase kebab-case/);
  });

  it("rejects invalid token key shapes", () => {
    expect(() =>
      defineTheme({ name: "default", tokens: { "bad key": "y" } })
    ).toThrow(/ascii/);
  });

  it("rejects non-finite numeric leaves", () => {
    expect(() =>
      defineTheme({ name: "default", tokens: { x: Number.NaN } })
    ).toThrow();
  });

  it("preserves token order in the emitted CSS", () => {
    const t = defineTheme({
      name: "default",
      tokens: { a: "1", b: "2", c: "3" },
    });
    const idxA = t.css.indexOf("--a:");
    const idxB = t.css.indexOf("--b:");
    const idxC = t.css.indexOf("--c:");
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
  });
});
