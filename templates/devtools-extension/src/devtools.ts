/**
 * DevTools entry — registers the shadowkit panel.
 *
 * Chrome runs `devtools.html` in a sandboxed page tied to the inspected
 * window. Calling `chrome.devtools.panels.create` from here puts our HTML
 * page in the tab strip alongside Elements / Console / Network.
 */

chrome.devtools.panels.create(
  "shadowkit",
  "icon-48.png",
  "panel.html",
  (panel) => {
    // No-op: the panel script wires itself up on load. Keeping a handle
    // here means we could later attach `panel.onShown` listeners if we
    // need to trigger live snapshots on focus.
    void panel;
  }
);
