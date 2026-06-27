/**
 * Panel UI.
 *
 * v0.1 scaffold: renders a fixed empty state, wires the clear button. The
 * real bridge-message capture lands in the next commit on top of
 * `chrome.devtools.network`.
 */

const log = document.getElementById("log") as HTMLElement;
const clear = document.getElementById("clear") as HTMLButtonElement;
const meta = document.getElementById("meta") as HTMLElement;

function setEmpty(): void {
  log.innerHTML =
    '<div class="empty">no messages yet — emit one with the bridge.</div>';
  meta.textContent = "waiting for messages…";
}

clear.addEventListener("click", setEmpty);
setEmpty();
