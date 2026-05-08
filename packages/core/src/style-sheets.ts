/**
 * Stylesheet attachment for Shadow DOM.
 *
 * The "right" way is `adoptedStyleSheets` with a single shared `CSSStyleSheet`
 * across all instances — no FOUC, no per-instance string parse cost, GC-friendly.
 *
 * The fallback path matters: Safari shipped constructable stylesheets in 16.4,
 * but plenty of in-the-wild WebViews and older mobile Safaris still don't have
 * it. We detect once and degrade to a single `<style>` tag per shadow root.
 */

const supportsAdoptedStyleSheets = (() => {
  try {
    // Both pieces must exist: the constructor AND the prototype setter.
    return (
      typeof CSSStyleSheet !== "undefined" &&
      "replaceSync" in CSSStyleSheet.prototype &&
      "adoptedStyleSheets" in Document.prototype
    );
  } catch {
    return false;
  }
})();

const sheetCache = new WeakMap<object, CSSStyleSheet>();

/**
 * Build a constructable stylesheet from a CSS string. Memoized by a caller-
 * supplied key so multiple instances of the same component reuse one sheet.
 */
export function constructSheet(css: string, key: object): CSSStyleSheet | null {
  if (!supportsAdoptedStyleSheets) return null;
  const cached = sheetCache.get(key);
  if (cached) return cached;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  sheetCache.set(key, sheet);
  return sheet;
}

/**
 * Attach CSS to a shadow root using `adoptedStyleSheets` when available, or a
 * `<style>` element fallback otherwise. The cache key lets repeat instances
 * share the same `CSSStyleSheet` object (deduped, GC-friendly).
 */
export function attachStyles(
  root: ShadowRoot,
  css: string,
  cacheKey: object
): void {
  if (supportsAdoptedStyleSheets) {
    const sheet = constructSheet(css, cacheKey);
    if (sheet) {
      // Push, don't replace — other shadowkit packages may have added theirs.
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return;
    }
  }
  const style = document.createElement("style");
  style.textContent = css;
  root.appendChild(style);
}

export const supportsConstructableStyleSheets = supportsAdoptedStyleSheets;
