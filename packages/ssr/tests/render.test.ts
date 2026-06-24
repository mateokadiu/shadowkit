import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _clearShadowRenderers,
  registerShadowRenderer,
  renderToDeclarativeShadowDOM,
} from "../src/render.js";

beforeEach(() => {
  _clearShadowRenderers();
});

afterEach(() => {
  _clearShadowRenderers();
});

describe("renderToDeclarativeShadowDOM", () => {
  it("wraps the shadow markup in a declarative template", async () => {
    registerShadowRenderer<{ label: string }>("sk-x-render", ({ props }) => ({
      shadowHtml: `<button>${props.label}</button>`,
    }));

    const html = await renderToDeclarativeShadowDOM("sk-x-render", {
      label: "go",
    });

    expect(html).toContain("<sk-x-render");
    expect(html).toContain('<template shadowrootmode="open">');
    expect(html).toContain("<button>go</button>");
    expect(html).toContain("</template>");
    expect(html).toContain("</sk-x-render>");
  });

  it("respects closed shadow mode", async () => {
    registerShadowRenderer("sk-x-closed", () => ({ shadowHtml: "<i></i>" }));
    const html = await renderToDeclarativeShadowDOM("sk-x-closed", {}, {
      shadowRootMode: "closed",
    });
    expect(html).toContain('<template shadowrootmode="closed">');
  });

  it("emits a state blob next to the template when state is returned", async () => {
    registerShadowRenderer("sk-x-state", () => ({
      shadowHtml: "<i></i>",
      state: { count: 7, label: "lemons" },
    }));

    const html = await renderToDeclarativeShadowDOM("sk-x-state");
    expect(html).toContain('<script type="application/json" data-sk-state');
    expect(html).toContain('"count":7');
    expect(html).toContain('"label":"lemons"');
  });

  it("escapes </script> sequences inside the state blob", async () => {
    registerShadowRenderer("sk-x-escape", () => ({
      shadowHtml: "",
      state: { html: "</script><img>" },
    }));

    const html = await renderToDeclarativeShadowDOM("sk-x-escape");
    // raw </script> must not appear inside the JSON payload
    expect(html.indexOf("</script>")).toBeGreaterThan(-1);
    // but the inner one (inside the JSON string) must have been unicode-escaped
    const blobMatch = html.match(
      /<script type="application\/json" data-sk-state[^>]*>([^<]*)<\/script>/
    );
    expect(blobMatch).not.toBeNull();
    expect(blobMatch?.[1]).not.toContain("</script>");
    expect(blobMatch?.[1]).toContain("\\u003c");
  });

  it("falls back to an empty shadow tree when no renderer is registered", async () => {
    const html = await renderToDeclarativeShadowDOM("sk-x-missing");
    expect(html).toBe(
      `<sk-x-missing data-sk-state-id="sk-state-sk-x-missing-${extractCounter(html)}"><template shadowrootmode="open"></template></sk-x-missing>`
    );
  });

  it("forwards hostAttributes onto the host element", async () => {
    registerShadowRenderer("sk-x-attrs", () => ({
      shadowHtml: "<i></i>",
      hostAttributes: { id: "first", class: "promo" },
    }));
    const html = await renderToDeclarativeShadowDOM("sk-x-attrs");
    expect(html).toContain('id="first"');
    expect(html).toContain('class="promo"');
  });

  it("supports async renderers", async () => {
    registerShadowRenderer("sk-x-async", async () => {
      await new Promise((r) => setTimeout(r, 1));
      return { shadowHtml: "<i>async</i>" };
    });
    const html = await renderToDeclarativeShadowDOM("sk-x-async");
    expect(html).toContain("<i>async</i>");
  });
});

function extractCounter(html: string): string {
  const m = html.match(/data-sk-state-id="sk-state-sk-x-missing-(\d+)"/);
  return m?.[1] ?? "?";
}
