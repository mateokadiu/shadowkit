/**
 * Hand-written stand-in for compiled Tailwind v4 output.
 *
 * In a real widget you'd produce this string from a Tailwind build pinned to
 * `theme(:host)` — see `@shadowkit/tailwind`'s
 * `examples/tailwind-shadow.config.ts`. The shape that matters for the demo
 * is that EVERY variable and utility lives inside the shadow root's
 * cascade, which is exactly what `:host`-scoped CSS gives you.
 *
 * The classes here mirror what Tailwind would emit so the component template
 * reads naturally (`class="rounded-md p-3 bg-surface"`).
 */
export const counterStyles = `
:host {
  display: inline-block;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--color-fg);
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-surfaceHi);
  border-radius: var(--radius);
  padding: var(--pad);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
  min-width: 11rem;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
}

.label {
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-fgMuted);
}

.value {
  font: 600 2.25rem / 1 var(--fontMono);
  text-align: center;
  color: var(--color-accent);
  padding: 0.25rem 0;
  user-select: none;
  font-variant-numeric: tabular-nums;
}

.row {
  display: flex;
  gap: 0.5rem;
}

button {
  flex: 1;
  appearance: none;
  border: 1px solid var(--color-surfaceHi);
  background: var(--color-surfaceHi);
  color: var(--color-fg);
  font: 600 0.875rem / 1 inherit;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: transform 80ms ease, background 120ms ease;
}
button:hover { background: #232c66; }
button:active { transform: translateY(1px); }
button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
`;
