# @shadowkit/theme

> Design tokens as TypeScript. Emits `:host { --x: y; }` CSS + matching TS types.
> Drift becomes a compile error.

## The problem

Your embed exposes CSS variables so host pages can rebrand it. So you document
them. So they drift — you rename `--brand-primary` to `--color-primary`, the
host page hard-codes the old name, your widget looks broken at the customer
site until someone notices.

The fix: token source-of-truth in TypeScript. Build emits the CSS *and* the
TypeScript types from the same object. A rename is a TS error at every
consumer site.

## Install

```bash
pnpm add @shadowkit/theme
```

## Usage

```ts
import { defineTheme } from "@shadowkit/theme";

const theme = defineTheme({
  name: "review-widget",
  tokens: {
    color: {
      primary: "#3b82f6",
      surface: { value: "#f8fafc", description: "card background" },
      fg: "#0f172a",
    },
    radius: "0.5rem",
    spacingPx: 16,
  },
});

// theme.css       → ":host { --color-primary: #3b82f6; ... }"
// theme.variables → { "--color-primary": "#3b82f6", ... }
// theme.types     → "export interface ReviewWidgetTokens { ... }"
```

Attach `theme.css` inside your Shadow DOM (e.g. via `@shadowkit/tailwind`'s
`injectTailwind` or `@shadowkit/core`'s `attachStyles`). Because the variables
live on `:host`, they cross the Shadow DOM cascade boundary — unlike Tailwind's
default `:root` vars.

## API

### `defineTheme(input): DefinedTheme`

`input` shape:

```ts
{
  name: string,                    // lowercase kebab-case (regex: ^[a-z][a-z0-9-]*$)
  tokens: TokenTree,               // nested object literal of strings | numbers | { value, description? }
}
```

Token keys must match `^[a-zA-Z][a-zA-Z0-9]*(?:[-_][a-zA-Z0-9]+)*$`. Nested
keys flatten to kebab-case: `color.surface.fg` → `--color-surface-fg`. Leaves
are strings (used verbatim, you own quoting and units) or numbers (emitted
unquoted).

Returns:

```ts
{
  css: string,                     // ":host { --x: y; ... }"
  variables: Record<string, string | number>,
  types: string,                   // "export interface FooTokens { ... }"
  theme: { name, tokens },         // the validated input
}
```

Validation failures throw a `ZodError`.

### Schema exports (advanced)

`themeSchema`, `tokenLeaf`, `tokenTree`, `tokenKey` are exported for callers
who want to compose theme shapes or reuse the validators in higher-level
build tools.

## Why `:host` and not `:root`

CSS variables declared on `:root` do **not** cross the Shadow DOM boundary.
Variables on `:host` apply to the shadow tree the host element owns. For
embeds, `:host` is the right scope and `:root` is a footgun.

`@shadowkit/tailwind` documents the same problem (Tailwind v4's `@theme`
defaults to `:root`) and ships the fix.

## License

MIT.
