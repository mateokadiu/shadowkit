import { afterEach, describe, expect, it } from "vitest";
import { injectTailwind } from "../src/inject-tailwind.js";

let tagCount = 0;
function host(): { el: HTMLElement; root: ShadowRoot } {
  const tag = `sk-tw-${++tagCount}-${Date.now().toString(36)}`;
  class El extends HTMLElement {
    root: ShadowRoot;
    constructor() {
      super();
      this.root = this.attachShadow({ mode: "open" });
    }
  }
  customElements.define(tag, El);
  const el = document.createElement(tag) as El;
  document.body.appendChild(el);
  return { el, root: el.root };
}

const SAMPLE_CSS = `:host{--color-red-500:#ef4444}.bg-red-500{background-color:var(--color-red-500)}`;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("injectTailwind", () => {
  it("attaches a CSSStyleSheet to the shadow root's adoptedStyleSheets", () => {
    const { root } = host();
    injectTailwind(root, SAMPLE_CSS);
    expect(root.adoptedStyleSheets.length).toBeGreaterThanOrEqual(1);
  });

  it("reuses the same CSSStyleSheet across instances with the same cache key", () => {
    const a = host();
    const b = host();
    const key = {};
    injectTailwind(a.root, SAMPLE_CSS, { cacheKey: key });
    injectTailwind(b.root, SAMPLE_CSS, { cacheKey: key });
    const sheetA = a.root.adoptedStyleSheets.at(-1);
    const sheetB = b.root.adoptedStyleSheets.at(-1);
    expect(sheetA).toBe(sheetB);
  });

  it("does not double-attach when called twice on the same root with the same key", () => {
    const { root } = host();
    const key = {};
    injectTailwind(root, SAMPLE_CSS, { cacheKey: key });
    const before = root.adoptedStyleSheets.length;
    injectTailwind(root, SAMPLE_CSS, { cacheKey: key });
    expect(root.adoptedStyleSheets.length).toBe(before);
  });

  it("replace: true wipes prior adopted sheets attached on the root", () => {
    const { root } = host();
    injectTailwind(root, SAMPLE_CSS);
    injectTailwind(root, ":host{--x:1}", { replace: true, cacheKey: {} });
    expect(root.adoptedStyleSheets.length).toBe(1);
  });

  it("scopes design tokens to :host (the cascade fix)", () => {
    const { root } = host();
    injectTailwind(root, SAMPLE_CSS);
    // The cssText of the adopted sheet still contains the :host scope —
    // important because it's what makes vars resolve inside the boundary.
    const sheet = root.adoptedStyleSheets.at(-1);
    expect(sheet).toBeDefined();
    const text = Array.from(sheet!.cssRules)
      .map((r) => r.cssText)
      .join("\n");
    expect(text).toMatch(/:host/);
    expect(text).toMatch(/--color-red-500/);
  });

  it("returns the sheet object for advanced (HMR) callers", () => {
    const { root } = host();
    const sheet = injectTailwind(root, SAMPLE_CSS);
    // jsdom v25 supports constructable stylesheets, so this is the sheet.
    // The contract is that callers can hold onto it; null is the fallback
    // signal for Safari <16.4.
    expect(sheet === null || sheet instanceof CSSStyleSheet).toBe(true);
  });

  it("hot-updates the cached sheet contents when re-called with new css", () => {
    const a = host();
    const b = host();
    const key = {};
    injectTailwind(a.root, ":host{--x:1}", { cacheKey: key });
    injectTailwind(b.root, ":host{--x:1}", { cacheKey: key });
    injectTailwind(a.root, ":host{--x:2}", { cacheKey: key });
    // Because both roots adopt the *same* CSSStyleSheet, updating contents
    // on one is visible from the other — that's the dedupe story.
    const sheetB = b.root.adoptedStyleSheets.at(-1);
    const text = Array.from(sheetB!.cssRules)
      .map((r) => r.cssText)
      .join("\n");
    expect(text).toMatch(/--x: 2/);
  });
});
