/**
 * Client-side hydration runtime.
 *
 * Pairs with `renderToDeclarativeShadowDOM`. The browser parses the
 * `<template shadowrootmode="open">` markup directly into a shadow root, so
 * we don't need to *render* anything on hydrate — we just need to thread the
 * server-side store snapshot into the component before its `connectedCallback`
 * runs (or, if it's already run, push it through `hydrator` on the next tick).
 *
 * Two registration shapes are supported:
 *  - per-tag hydrator: `registerHydrator(tag, (host, state) => …)`
 *  - per-element imperative: pass a hydrator into `hydrate(host, hydrator)`.
 *
 * The runtime is intentionally tiny — the heavy lifting (DSD parsing,
 * shadow-root attachment) is the browser's job. shadowkit just bridges the
 * state blob.
 */

import type { SerializedState } from "./types.js";

export type Hydrator<S extends SerializedState = SerializedState> = (
  host: Element,
  state: S | null
) => void | Promise<void>;

const hydrators = new Map<string, Hydrator<SerializedState>>();

export function registerHydrator<S extends SerializedState = SerializedState>(
  tag: string,
  hydrator: Hydrator<S>
): void {
  hydrators.set(tag, hydrator as Hydrator<SerializedState>);
}

export function unregisterHydrator(tag: string): void {
  hydrators.delete(tag);
}

/** Tests: clear registry between cases. Not part of the public API. */
export function _clearHydrators(): void {
  hydrators.clear();
}

export interface HydrateOptions {
  /**
   * Explicit hydrator override — wins over the tag registry. Useful when you
   * want to hydrate one element with a different snapshot path (e.g.
   * server-side personalization).
   */
  hydrator?: Hydrator;
  /**
   * Document to scope state-blob lookups against. Defaults to the host's
   * owner document, falling back to `globalThis.document`.
   */
  document?: Document;
}

/**
 * Hydrate a single element rendered with `renderToDeclarativeShadowDOM`.
 *
 * Returns `true` if a hydrator ran, `false` otherwise. Either is fine — a
 * component without a hydrator just keeps the DSD markup the browser parsed.
 */
export async function hydrate(
  host: Element,
  options: HydrateOptions = {}
): Promise<boolean> {
  const tag = host.tagName.toLowerCase();
  const hydrator =
    options.hydrator ?? hydrators.get(tag) ?? null;
  if (!hydrator) return false;

  const state = readState(host, options.document);
  await hydrator(host, state);
  return true;
}

/**
 * Hydrate every shadowkit-rendered element under `root`. Walks
 * `[data-sk-state-id]` so it only touches elements we shipped — third-party
 * custom elements on the page are left alone.
 */
export async function hydrateAll(
  root: ParentNode = document,
  options: HydrateOptions = {}
): Promise<number> {
  const hosts = root.querySelectorAll<HTMLElement>("[data-sk-state-id]");
  let hydrated = 0;
  for (const host of hosts) {
    const ran = await hydrate(host, options);
    if (ran) hydrated++;
  }
  return hydrated;
}

function readState(host: Element, doc?: Document): SerializedState | null {
  const id = host.getAttribute("data-sk-state-id");
  if (!id) return null;
  const ownerDoc = doc ?? host.ownerDocument ?? globalThis.document;
  if (!ownerDoc) return null;
  const blob = ownerDoc.getElementById(id);
  if (!blob || blob.tagName.toLowerCase() !== "script") return null;
  const text = blob.textContent;
  if (!text) return null;
  try {
    return JSON.parse(text) as SerializedState;
  } catch {
    return null;
  }
}
