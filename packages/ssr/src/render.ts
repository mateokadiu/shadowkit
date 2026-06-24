/**
 * Declarative Shadow DOM SSR.
 *
 * The browser's HTML parser turns `<template shadowrootmode="open">…</template>`
 * inside a custom element into a real shadow root *before* JS runs. That
 * means the embed paints correctly on first byte, no FOUC, no waiting for
 * `customElements.define` to attach the shadow root post-hoc.
 *
 * shadowkit's contribution here is small but load-bearing: a renderer
 * registry that knows, per tag, how to (a) produce the shadow tree HTML and
 * (b) serialize the initial store snapshot. Hydration on the client reads
 * the same snapshot back, so the first render reflects identical state.
 */

import type { ShadowRendererMap, SerializedState } from "./types.js";

const renderers: ShadowRendererMap = new Map();

/**
 * Register an SSR renderer for a custom element tag.
 *
 * The renderer receives the props passed to `renderToDeclarativeShadowDOM`,
 * returns the shadow-tree HTML to inline, and (optionally) a
 * `state` snapshot that `hydrate()` will hand back to the component.
 */
export interface ShadowRendererContext<P> {
  tag: string;
  props: P;
}

export interface ShadowRendererResult {
  /** HTML to place inside `<template shadowrootmode="open">…</template>`. */
  shadowHtml: string;
  /** Snapshot serialized into the `<script data-sk-state>` blob. */
  state?: SerializedState;
  /** Optional light-DOM HTML between the open/close tags, outside the template. */
  lightHtml?: string;
  /** Extra HTML attributes for the host element (e.g. `id="x" class="y"`). */
  hostAttributes?: Record<string, string>;
}

export type ShadowRenderer<P = unknown> = (
  ctx: ShadowRendererContext<P>
) => ShadowRendererResult | Promise<ShadowRendererResult>;

export function registerShadowRenderer<P>(
  tag: string,
  renderer: ShadowRenderer<P>
): void {
  renderers.set(tag, renderer as ShadowRenderer<unknown>);
}

export function unregisterShadowRenderer(tag: string): void {
  renderers.delete(tag);
}

/** Tests: clear registry between cases. Not part of the public API. */
export function _clearShadowRenderers(): void {
  renderers.clear();
}

export interface RenderOptions {
  /**
   * Shadow root mode emitted on the `<template>`. Default `"open"`.
   *
   * `"closed"` SSR is supported by the spec but kills external scripting;
   * shadowkit's hydrate runtime requires `"open"` to find the root, so
   * stick with the default unless you have a hard requirement otherwise.
   */
  shadowRootMode?: "open" | "closed";
  /**
   * State-blob id prefix. Each rendered element gets a unique id —
   * `sk-state-<tag>-<n>` — so `hydrate()` can scope its lookup.
   */
  stateIdPrefix?: string;
}

let stateCounter = 0;

/**
 * Render a shadowkit component to declarative Shadow DOM markup.
 *
 * Returns a *string*. Stream it into your SSR response body alongside the
 * surrounding page HTML.
 *
 * Tags returned without a registered renderer fall back to an empty shadow
 * tree — better to render the custom-element host than to throw, because
 * client-side `customElements.define` can still upgrade it later.
 */
export async function renderToDeclarativeShadowDOM<P = Record<string, unknown>>(
  tag: string,
  props: P = {} as P,
  options: RenderOptions = {}
): Promise<string> {
  const renderer = renderers.get(tag) as ShadowRenderer<P> | undefined;

  const result: ShadowRendererResult = renderer
    ? await renderer({ tag, props })
    : { shadowHtml: "" };

  const mode = options.shadowRootMode ?? "open";
  const stateId = `${options.stateIdPrefix ?? "sk-state"}-${tag}-${++stateCounter}`;

  const attrParts: string[] = [];
  if (result.hostAttributes) {
    for (const [k, v] of Object.entries(result.hostAttributes)) {
      attrParts.push(`${k}="${escapeAttr(v)}"`);
    }
  }
  attrParts.push(`data-sk-state-id="${stateId}"`);
  const hostAttrs = attrParts.length > 0 ? ` ${attrParts.join(" ")}` : "";

  const stateBlob =
    result.state !== undefined
      ? `<script type="application/json" data-sk-state id="${stateId}">${serializeState(
          result.state
        )}</script>`
      : "";

  const lightHtml = result.lightHtml ?? "";

  return (
    `<${tag}${hostAttrs}>` +
    `<template shadowrootmode="${mode}">${result.shadowHtml}</template>` +
    stateBlob +
    lightHtml +
    `</${tag}>`
  );
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Serialize a state snapshot for the embedded `<script>` blob. We escape
 * `<` to avoid `</script>` early-termination, and surrogate-escape U+2028 /
 * U+2029 which break JSON-in-script parsing in some older engines.
 */
function serializeState(state: SerializedState): string {
  return JSON.stringify(state)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
