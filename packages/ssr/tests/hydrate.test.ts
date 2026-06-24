import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _clearHydrators,
  hydrate,
  hydrateAll,
  registerHydrator,
} from "../src/hydrate.js";

beforeEach(() => {
  _clearHydrators();
  document.body.innerHTML = "";
});

afterEach(() => {
  _clearHydrators();
  document.body.innerHTML = "";
});

function mountHost(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe("hydrate", () => {
  it("invokes the registered hydrator with the parsed state blob", async () => {
    const seen: unknown[] = [];
    registerHydrator("sk-x-h1", (_host, state) => {
      seen.push(state);
    });

    const host = mountHost(
      `<sk-x-h1 data-sk-state-id="sk-state-x-1"></sk-x-h1>` +
        `<script type="application/json" data-sk-state id="sk-state-x-1">{"count":4}</script>`
    );

    const ran = await hydrate(host);
    expect(ran).toBe(true);
    expect(seen).toEqual([{ count: 4 }]);
  });

  it("returns false when no hydrator is registered for the tag", async () => {
    const host = mountHost(`<sk-x-h2></sk-x-h2>`);
    const ran = await hydrate(host);
    expect(ran).toBe(false);
  });

  it("hands null when the host has no state-id attribute", async () => {
    const seen: unknown[] = [];
    registerHydrator("sk-x-h3", (_host, state) => {
      seen.push(state);
    });
    const host = mountHost(`<sk-x-h3></sk-x-h3>`);
    await hydrate(host);
    expect(seen).toEqual([null]);
  });

  it("hands null when the JSON payload is malformed", async () => {
    const seen: unknown[] = [];
    registerHydrator("sk-x-h4", (_host, state) => {
      seen.push(state);
    });
    const host = mountHost(
      `<sk-x-h4 data-sk-state-id="sk-state-bad"></sk-x-h4>` +
        `<script type="application/json" data-sk-state id="sk-state-bad">not json</script>`
    );
    await hydrate(host);
    expect(seen).toEqual([null]);
  });

  it("supports an inline hydrator override", async () => {
    const fn = vi.fn();
    const host = mountHost(
      `<sk-x-h5 data-sk-state-id="sk-state-h5"></sk-x-h5>` +
        `<script type="application/json" data-sk-state id="sk-state-h5">{"ok":true}</script>`
    );
    await hydrate(host, { hydrator: fn });
    expect(fn).toHaveBeenCalledWith(host, { ok: true });
  });

  it("hydrateAll walks every data-sk-state-id host under the root", async () => {
    const seen: string[] = [];
    registerHydrator("sk-x-h6", (host) => {
      seen.push(host.id);
    });
    document.body.innerHTML =
      `<div>` +
      `<sk-x-h6 id="a" data-sk-state-id="sk-state-a"></sk-x-h6>` +
      `<sk-x-h6 id="b" data-sk-state-id="sk-state-b"></sk-x-h6>` +
      `<script type="application/json" data-sk-state id="sk-state-a">{}</script>` +
      `<script type="application/json" data-sk-state id="sk-state-b">{}</script>` +
      `</div>`;

    const count = await hydrateAll();
    expect(count).toBe(2);
    expect(seen).toEqual(["a", "b"]);
  });
});
