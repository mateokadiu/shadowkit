/**
 * The cascade-boundary problem (and why this file exists).
 *
 * Tailwind v4 emits its `@theme` design tokens as CSS variables declared on
 * `:root`. Tailwind utilities reference those variables (e.g. `bg-red-500`
 * compiles to `background-color: var(--color-red-500);`). On a normal page,
 * the variables defined on `:root` cascade into every descendant via inherit-
 * ance, so utilities work.
 *
 * Shadow DOM is a cascade boundary. Variables declared on `:root` in the host
 * document **do not** cross into a shadow tree. So if your widget compiles a
 * Tailwind stylesheet against the host page's `:root` and tries to use it
 * inside the shadow root, every utility resolves with `unset` for the var,
 * and `bg-red-500` becomes invisible.
 *
 * Workarounds I've seen, none good:
 *  - Hand-write a `<style>` tag per instance with hard-coded values. Loses
 *    Tailwind tokens, hostile to designers.
 *  - Move every utility behind `@apply` in the component CSS. Defeats the
 *    point of Tailwind, blows up bundle size.
 *  - Use `!important` everywhere on host-page styles. Leaks back out and
 *    breaks isolation.
 *
 * The fix that actually works:
 *  1. Compile Tailwind to a CSS string that scopes its `@theme` to `:host`
 *     (or any selector inside the shadow root) instead of `:root`.
 *  2. Wrap that string in a single shared `CSSStyleSheet`.
 *  3. `adoptedStyleSheets.push(sheet)` on every shadow root that needs it.
 *
 * Result: one parse per origin, no FOUC, no per-instance memory cost,
 * GC-friendly. Vars resolve against the shadow root's own `:host` rule, so
 * utilities work inside the boundary.
 *
 * This file does (2) and (3). Step (1) is a build-time concern; see
 * `examples/tailwind-shadow.config.ts` in this package and the README.
 */

const sheetCache = new WeakMap<object, CSSStyleSheet>();

export interface InjectTailwindOptions {
  /**
   * Cache key — `CSSStyleSheet`s are deduped per key. Pass the constructor of
   * your component (or any stable object) so every instance of the same
   * widget reuses one sheet. Default: an internal singleton, which is right
   * for the common "one Tailwind build per page" case.
   */
  cacheKey?: object;
  /**
   * Replace any existing adoptedStyleSheets that were attached by this helper
   * (so re-injecting with new CSS is safe). Default: `false` — appends.
   */
  replace?: boolean;
}

const defaultKey = {};

function constructableStyleSheetsAvailable(): boolean {
  try {
    return (
      typeof CSSStyleSheet !== "undefined" &&
      "replaceSync" in CSSStyleSheet.prototype &&
      typeof Document !== "undefined" &&
      "adoptedStyleSheets" in Document.prototype
    );
  } catch {
    return false;
  }
}

const ADOPTED = constructableStyleSheetsAvailable();

/**
 * Attach a compiled Tailwind stylesheet to a shadow root.
 *
 * `compiledCss` is the *string* output of your Tailwind v4 build — see the
 * `tailwind-shadow.config.ts` example for how to produce it scoped to
 * `:host` instead of `:root`.
 *
 * Returns the sheet (or null if attached via a `<style>` fallback) for
 * advanced use cases like hot-replacing during development.
 */
export function injectTailwind(
  shadowRoot: ShadowRoot,
  compiledCss: string,
  options: InjectTailwindOptions = {}
): CSSStyleSheet | null {
  const key = options.cacheKey ?? defaultKey;

  if (ADOPTED) {
    let sheet = sheetCache.get(key);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(compiledCss);
      sheetCache.set(key, sheet);
    } else {
      // Same key, possibly new CSS (HMR). Replace contents in place so every
      // shadow root already adopting this sheet sees the update.
      sheet.replaceSync(compiledCss);
    }

    if (options.replace) {
      shadowRoot.adoptedStyleSheets = [sheet];
    } else {
      // De-dup: don't push the same sheet twice if injectTailwind is called
      // more than once for the same root.
      const already = shadowRoot.adoptedStyleSheets.includes(sheet);
      if (!already) {
        shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
      }
    }
    return sheet;
  }

  // Fallback: Safari <16.4, old WebViews. One <style> per root — sub-optimal
  // (FOUC + extra parse), but functionally correct. The cascade fix is the
  // same: the CSS still scopes vars to :host, not :root.
  const existing = shadowRoot.querySelector(
    "style[data-shadowkit-tailwind]"
  ) as HTMLStyleElement | null;
  if (existing) {
    if (options.replace || existing.textContent !== compiledCss) {
      existing.textContent = compiledCss;
    }
    return null;
  }
  const style = document.createElement("style");
  style.setAttribute("data-shadowkit-tailwind", "");
  style.textContent = compiledCss;
  shadowRoot.appendChild(style);
  return null;
}

/** True iff the runtime supports `adoptedStyleSheets` + constructable sheets. */
export const supportsAdoptedTailwind = ADOPTED;
