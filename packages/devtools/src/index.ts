/**
 * @shadowkit/devtools
 *
 * Runtime tap for the shadowkit Chrome DevTools panel. The buildable
 * extension that listens on this tap lives at
 * `templates/devtools-extension/`.
 */

export const DEVTOOLS_VERSION = "1.0.0";
export const DEVTOOLS_MESSAGE_TAG = "shadowkit/devtools";

export { tap, isDevtoolsEvent } from "./tap.js";
export type {
  DevtoolsEvent,
  DevtoolsEventKind,
  TapHandle,
  TapOptions,
} from "./tap.js";
