# examples/embed-counter

Minimal runnable demo of `<sk-counter>` exercising every shadowkit v0.1
package together.

```bash
pnpm install
pnpm --filter @shadowkit-examples/embed-counter dev
```

Open <http://localhost:5173>.

Three instances on the page share state through a typed `@shadowkit/bridge`
attached to `window`. Each instance:

- extends `ShadowComponent` from `@shadowkit/core`
- declares a reactive `createStore<{ value: number }>` and subscribes via
  `watchStore` — the subscription auto-disconnects on element removal
- pulls design tokens through `@shadowkit/theme`, emitted as `:host` CSS vars
- attaches its stylesheet through `@shadowkit/tailwind`'s `injectTailwind`,
  which is the same call you'd make with a real compiled Tailwind v4 string

Click `+` or `−` on any card — the others move in lockstep, with the broadcast
visible in the log strip at the bottom.
