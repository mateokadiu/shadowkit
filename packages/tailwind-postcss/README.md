# @shadowkit/tailwind-postcss

> PostCSS plugin that rewrites Tailwind v4 `:root` / `@theme` output to `:host`
> so it cascades into Shadow DOM, and emits a CSS module ready for
> `injectTailwind`.

## What it does

Tailwind v4 declares its design tokens on `:root`. Shadow DOM doesn't see
`:root`. shadowkit's v0.1 README documented the manual rewrite; this plugin
automates it as a single line in your PostCSS pipeline.

```js
// postcss.config.js
import shadowkitTailwind from "@shadowkit/tailwind-postcss";

export default {
  plugins: [
    shadowkitTailwind({
      hostSelector: ":host, :host *",
      emitAsModule: true,
      moduleOutputPath: "dist/tailwind.shadow.css",
    }),
  ],
};
```

The plugin is configurable via the same options block — see the JSDoc on
`ShadowkitTailwindOptions`.
