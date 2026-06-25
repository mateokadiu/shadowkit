/**
 * @shadowkit/tailwind-postcss — scaffold.
 *
 * The full PostCSS plugin lands in the next commit. This entry just declares
 * the public surface so consumers can already import the (still-stubbed)
 * factory and configure it.
 */

export interface ShadowkitTailwindOptions {
  /**
   * CSS selector that replaces `:root` / `:where(:root)` in compiled Tailwind
   * output. Defaults to `:host` because that's the only selector the host
   * page can't write but the shadow root can read. `:host, :host *` works too
   * if you want utilities to win against more specific in-shadow selectors.
   */
  hostSelector?: string;
  /**
   * Emit a parallel JS module string that re-exports the compiled CSS as a
   * default export, so callers can `import css from './tailwind.css?module'`
   * and pass it to `injectTailwind`. Default: `false`.
   */
  emitAsModule?: boolean;
  /** When `emitAsModule` is on, the generated module path. */
  moduleOutputPath?: string;
}

export const PLUGIN_NAME = "@shadowkit/tailwind-postcss";
export const TAILWIND_POSTCSS_VERSION = "0.1.0";
