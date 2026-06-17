import { makeCounterBridge } from "./bridge.js";
import { registerSkCounter } from "./sk-counter.js";

/**
 * Wire up the demo.
 *
 *  - One bridge attached to `window` (same-origin pub/sub).
 *  - One `<sk-counter>` definition, three instances in the DOM.
 *  - A tiny log so you can see broadcasts in real time.
 */

const bridge = makeCounterBridge();
registerSkCounter(bridge);

const log = document.getElementById("log") as HTMLPreElement | null;
function line(s: string): void {
  if (!log) return;
  const t = new Date().toLocaleTimeString(undefined, { hour12: false });
  log.textContent = `${log.textContent}\n[${t}] ${s}`.slice(-2000);
  log.scrollTop = log.scrollHeight;
}

bridge.on("count.changed", ({ value, by }) => {
  line(`count.changed value=${value} from=${by}`);
});

// Optional handler — illustrates the request/response side of the bridge.
// Any counter could ask the host "what's the current canonical count?"
// without knowing which other counter triggered the last change.
const counterEls = () =>
  Array.from(document.querySelectorAll("sk-counter")) as Array<
    HTMLElement & { value?: number }
  >;
bridge.handle("count.get", () => ({
  value: counterEls()[0]?.value ?? 0,
}));

line("ready · bridge attached on " + window.location.origin);
