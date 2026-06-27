/**
 * @shadowkit/devtools — runtime hook contract.
 *
 * The Chrome extension lives at `templates/devtools-extension/`. This package
 * is the small library both sides agree on: the message envelope that the
 * runtime broadcasts on `window.postMessage`, and a tiny tap function the
 * extension's content script uses to mirror those into the panel.
 */

export const DEVTOOLS_VERSION = "0.1.0";

/** Marker the content script greps for on every postMessage. */
export const DEVTOOLS_MESSAGE_TAG = "shadowkit/devtools";
