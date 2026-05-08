/**
 * Safe registry helper.
 *
 * `customElements.define()` throws on duplicate names. That's correct in a
 * vacuum, but in the embed world you can ship the same widget twice on the
 * same page (think: shopping cart drawer + checkout summary, both bundling
 * the same review widget). The crash kills the whole page.
 *
 * `defineElement` no-ops on duplicate, optionally warns, and returns whether
 * the registration happened so callers can detect drift if they care.
 */
export interface DefineElementOptions {
  /** When `true` (default), logs `console.warn` on duplicate. */
  warnOnDuplicate?: boolean;
  /** Defaults to `customElements`; override for testing. */
  registry?: CustomElementRegistry;
}

export type DefineElementResult =
  | { defined: true }
  | { defined: false; reason: "duplicate"; existing: CustomElementConstructor };

export function defineElement(
  name: string,
  ctor: CustomElementConstructor,
  options: DefineElementOptions = {}
): DefineElementResult {
  const registry = options.registry ?? customElements;
  const existing = registry.get(name);
  if (existing) {
    if (options.warnOnDuplicate !== false) {
      // eslint-disable-next-line no-console
      console.warn(
        `[shadowkit] custom element '${name}' is already registered; skipping duplicate define()`
      );
    }
    return { defined: false, reason: "duplicate", existing };
  }
  registry.define(name, ctor);
  return { defined: true };
}
