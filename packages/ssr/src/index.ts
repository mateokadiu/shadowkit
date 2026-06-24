export {
  renderToDeclarativeShadowDOM,
  registerShadowRenderer,
  unregisterShadowRenderer,
  _clearShadowRenderers,
} from "./render.js";
export type {
  RenderOptions,
  ShadowRenderer,
  ShadowRendererContext,
  ShadowRendererResult,
} from "./render.js";

export type { SerializedState } from "./types.js";

export {
  hydrate,
  hydrateAll,
  registerHydrator,
  unregisterHydrator,
  _clearHydrators,
} from "./hydrate.js";
export type { HydrateOptions, Hydrator } from "./hydrate.js";

export const SSR_VERSION = "1.0.0";
