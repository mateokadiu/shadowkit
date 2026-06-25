import postcss from "postcss";
import { describe, expect, it } from "vitest";
import shadowkitTailwind from "../src/index.js";

async function run(
  input: string,
  options?: Parameters<typeof shadowkitTailwind>[0]
): Promise<{ css: string; messages: postcss.Message[] }> {
  const result = await postcss([shadowkitTailwind(options)]).process(input, {
    from: undefined,
  });
  return { css: result.css, messages: result.messages };
}

describe("shadowkitTailwind plugin", () => {
  it("rewrites :root to :host by default", async () => {
    const { css } = await run(`:root { --color-primary: red; }`);
    expect(css).toContain(":host");
    expect(css).not.toContain(":root");
  });

  it("respects a custom host selector", async () => {
    const { css } = await run(`:root { --x: 1; }`, {
      hostSelector: ":host, :host *",
    });
    expect(css).toContain(":host, :host *");
  });

  it("does not touch :root-like substrings inside other selectors", async () => {
    const { css } = await run(`.not-root, .has-root { color: blue; }`);
    expect(css).toContain(".not-root, .has-root");
  });

  it("rewrites theme(:host) macros in declarations", async () => {
    const { css } = await run(
      `.btn { background: var(--color); container: theme(:host); }`,
      { hostSelector: ":host" }
    );
    expect(css).toContain("container: :host");
    expect(css).not.toContain("theme(:host)");
  });

  it("emits a module message when emitAsModule is on", async () => {
    const { messages } = await run(`:root { --x: 1; }`, {
      emitAsModule: true,
      moduleOutputPath: "out.css.js",
    });
    const msg = messages.find(
      (m) => m.type === "shadowkit-tailwind-module"
    );
    expect(msg).toBeDefined();
    const m = msg as unknown as { path: string; source: string };
    expect(m.path).toBe("out.css.js");
    expect(m.source).toContain("export default css");
    expect(m.source).toContain(":host");
  });

  it("does not emit a module message when emitAsModule is off", async () => {
    const { messages } = await run(`:root { --x: 1; }`);
    const msg = messages.find(
      (m) => m.type === "shadowkit-tailwind-module"
    );
    expect(msg).toBeUndefined();
  });

  it("handles multiple :root rules in one file", async () => {
    const { css } = await run(
      `:root { --a: 1; }\n@media (min-width: 100px) { :root { --b: 2; } }`
    );
    const occurrences = css.match(/:host/g)?.length ?? 0;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    expect(css).not.toContain(":root");
  });

  it("handles comma-separated selectors with :root", async () => {
    const { css } = await run(`:root, .alt { --x: 1; }`);
    expect(css).toContain(":host, .alt");
  });
});
