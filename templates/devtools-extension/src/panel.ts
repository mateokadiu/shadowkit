/**
 * Panel UI — bridge-message capture.
 *
 * We tap into the inspected window two ways:
 *
 *  1. `chrome.devtools.network.onRequestFinished` — fires for any network
 *     activity, including the synthetic resources the worker emits on cache
 *     hits. We filter for the shadowkit CDN URL scheme (`/v1/<pkg>@<ver>/`)
 *     and surface those as "bundle loaded" markers in the panel.
 *
 *  2. `chrome.devtools.inspectedWindow.eval` — installs a tiny postMessage
 *     listener inside the page that re-broadcasts shadowkit-tagged events
 *     back here via `chrome.runtime`. Lighter than a full content script,
 *     and the panel can refuse them when the user clicks "stop".
 *
 * The shape comes from `@shadowkit/devtools`'s `DevtoolsEvent` — same
 * vocabulary on both ends.
 */

const log = document.getElementById("log") as HTMLElement;
const clear = document.getElementById("clear") as HTMLButtonElement;
const meta = document.getElementById("meta") as HTMLElement;

interface PanelEvent {
  tag: string;
  kind: string;
  tag_name?: string;
  ts: number;
  data: unknown;
}

let counter = 0;
let installed = false;
const events: PanelEvent[] = [];

function render(): void {
  if (events.length === 0) {
    log.innerHTML =
      '<div class="empty">no messages yet — emit one with the bridge.</div>';
    meta.textContent = "waiting for messages…";
    return;
  }
  meta.textContent = `${events.length} message${events.length === 1 ? "" : "s"}`;
  log.innerHTML = events
    .map((e) => {
      const when = new Date(e.ts).toISOString().slice(11, 23);
      const dataJson = escape(safeJSON(e.data));
      const tagName = e.tag_name ? ` <i>${escape(e.tag_name)}</i>` : "";
      return (
        `<div class="row">` +
        `<span class="kind">${escape(e.kind)}</span>` +
        `<span>${when}${tagName}</span>` +
        `<pre>${dataJson}</pre>` +
        `</div>`
      );
    })
    .join("");
}

function safeJSON(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "undefined";
  } catch {
    return "[unserializable]";
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function push(event: PanelEvent): void {
  events.push(event);
  if (events.length > 500) events.shift(); // ring buffer cap
  render();
}

function installPageBridge(): void {
  if (installed) return;
  installed = true;

  // Re-broadcast shadowkit events from the inspected page out via console
  // so this panel can pick them up over chrome.devtools.network.
  const expr = `
    (function () {
      if (window.__shadowkitDevtoolsAttached) return;
      window.__shadowkitDevtoolsAttached = true;
      window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (!d || d.tag !== 'shadowkit/devtools') return;
        // Tag with a magic prefix so the panel can grep console output.
        try {
          console.debug('__shadowkit_devtools__', JSON.stringify(d));
        } catch (_) {}
      });
    })();
  `;
  try {
    chrome.devtools.inspectedWindow.eval(expr);
  } catch {
    // The eval is best-effort; the panel still works for CDN sightings.
  }
}

function attachNetworkListener(): void {
  if (
    typeof chrome === "undefined" ||
    !chrome.devtools ||
    !chrome.devtools.network
  ) {
    return;
  }
  chrome.devtools.network.onRequestFinished.addListener((req) => {
    const url = req.request?.url ?? "";
    const match = url.match(/\/v1\/(core|theme|bridge|tailwind|ssr)@([\w.-]+)\//);
    if (!match) return;
    push({
      tag: "shadowkit/devtools",
      kind: "bridge.event",
      tag_name: `cdn:${match[1]}@${match[2]}`,
      ts: Date.now(),
      data: { url, status: req.response?.status, id: ++counter },
    });
  });
}

function attachConsoleListener(): void {
  if (
    typeof chrome === "undefined" ||
    !chrome.devtools ||
    !chrome.devtools.inspectedWindow
  ) {
    return;
  }
  // We poll the inspected window via eval to drain a debug log. This avoids
  // needing a content_scripts permission and keeps the extension thin.
  const drainExpr = `(function () {
    if (!window.__shadowkitDevtoolsLog) window.__shadowkitDevtoolsLog = [];
    var copy = window.__shadowkitDevtoolsLog.slice();
    window.__shadowkitDevtoolsLog.length = 0;
    return copy;
  })()`;
  setInterval(() => {
    try {
      chrome.devtools.inspectedWindow.eval(
        drainExpr,
        (result: unknown, exceptionInfo?: unknown) => {
          if (exceptionInfo) return;
          if (!Array.isArray(result)) return;
          for (const ev of result) {
            if (ev && typeof ev === "object" && (ev as { tag?: string }).tag === "shadowkit/devtools") {
              push(ev as PanelEvent);
            }
          }
        }
      );
    } catch {
      /* swallow */
    }
  }, 250);

  // Replace the console.debug interceptor with a direct buffer
  const installBuffer = `
    (function () {
      if (window.__shadowkitDevtoolsBuffered) return;
      window.__shadowkitDevtoolsBuffered = true;
      window.__shadowkitDevtoolsLog = window.__shadowkitDevtoolsLog || [];
      window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (!d || d.tag !== 'shadowkit/devtools') return;
        window.__shadowkitDevtoolsLog.push(d);
        if (window.__shadowkitDevtoolsLog.length > 1000) {
          window.__shadowkitDevtoolsLog.shift();
        }
      });
    })();
  `;
  try {
    chrome.devtools.inspectedWindow.eval(installBuffer);
  } catch {
    /* swallow */
  }
}

clear.addEventListener("click", () => {
  events.length = 0;
  render();
});

installPageBridge();
attachNetworkListener();
attachConsoleListener();
render();
