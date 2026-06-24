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

export const SSR_VERSION = "1.0.0";
