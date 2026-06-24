import type { ShadowRenderer } from "./render.js";

/** JSON-serializable snapshot of a component's initial store state. */
export type SerializedState =
  | null
  | boolean
  | number
  | string
  | SerializedState[]
  | { [key: string]: SerializedState };

export type ShadowRendererMap = Map<string, ShadowRenderer<unknown>>;
