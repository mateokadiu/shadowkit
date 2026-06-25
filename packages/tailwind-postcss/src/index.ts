/**
 * @shadowkit/tailwind-postcss
 *
 * PostCSS plugin that rewrites Tailwind v4 `:root` output to `:host` (the
 * cascade-boundary fix), expands `theme(:host)` macros, and optionally emits
 * the result as a JS module ready for `injectTailwind`.
 */

import plugin from "./plugin.js";

export interface ShadowkitTailwindOptions {
  /**
   * Replacement selector for `:root` inside compiled Tailwind output.
   * Default `:host`. Use `":host, :host *"` if you want utilities to win
   * against deeper in-shadow selectors without `!important`.
   */
  hostSelector?: string;
  /**
   * Emit a parallel JS module string holding the compiled CSS as a default
   * export. Build tools (Vite/esbuild/Rollup) pick it up via the PostCSS
   * `result.messages` channel.
   */
  emitAsModule?: boolean;
  /** Module file name when `emitAsModule` is on. */
  moduleOutputPath?: string;
}

export const PLUGIN_NAME = "@shadowkit/tailwind-postcss";
export const TAILWIND_POSTCSS_VERSION = "1.0.0";

export default plugin;
export { plugin as shadowkitTailwind };
