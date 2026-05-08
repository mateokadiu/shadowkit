import { describe, expect, it, vi } from "vitest";
import { defineElement } from "../src/define-element.js";

class MakeRegistry {
  private map = new Map<string, CustomElementConstructor>();
  get(name: string): CustomElementConstructor | undefined {
    return this.map.get(name);
  }
  define(name: string, ctor: CustomElementConstructor): void {
    this.map.set(name, ctor);
  }
  whenDefined(): Promise<CustomElementConstructor> {
    return Promise.reject(new Error("not implemented"));
  }
  upgrade(): void {}
  getName(): string | null {
    return null;
  }
}

describe("defineElement", () => {
  it("registers a new element and returns { defined: true }", () => {
    class El extends HTMLElement {}
    const registry = new MakeRegistry() as unknown as CustomElementRegistry;
    const result = defineElement("sk-fresh-1", El, { registry });
    expect(result).toEqual({ defined: true });
    expect(registry.get("sk-fresh-1")).toBe(El);
  });

  it("no-ops on duplicate registration and returns the existing ctor", () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    const registry = new MakeRegistry() as unknown as CustomElementRegistry;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    defineElement("sk-dup", A, { registry });
    const second = defineElement("sk-dup", B, { registry });

    expect(second).toEqual({
      defined: false,
      reason: "duplicate",
      existing: A,
    });
    expect(registry.get("sk-dup")).toBe(A); // first registration wins
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("respects warnOnDuplicate: false", () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    const registry = new MakeRegistry() as unknown as CustomElementRegistry;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineElement("sk-quiet", A, { registry });
    defineElement("sk-quiet", B, { registry, warnOnDuplicate: false });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("uses globalThis.customElements by default", () => {
    class El extends HTMLElement {}
    const tag = `sk-global-${Date.now().toString(36)}`;
    const result = defineElement(tag, El);
    expect(result.defined).toBe(true);
    expect(customElements.get(tag)).toBe(El);
  });
});
