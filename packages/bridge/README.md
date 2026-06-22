# @shadowkit/bridge

> Typed postMessage RPC + event channels for embedded Web Components.
> Zod schemas as the wire contract. Same factory both sides.

## What it does

The runtime shape of every untyped embed:

```ts
window.addEventListener("message", (e) => {
  if (e.origin !== KNOWN) return;
  if (e.data?.type === "user.loaded") {
    setUser(e.data.user as User); // cast and pray
  }
});
```

The runtime shape with `@shadowkit/bridge`:

```ts
import { defineBridge } from "@shadowkit/bridge";
import { z } from "zod";

const schema = {
  requests: {
    "order.fetch": {
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), total: z.number() }),
    },
  },
  events: {
    "order.updated": z.object({ id: z.string() }),
  },
} as const;

// Same call on host and embed; symmetric.
const bridge = defineBridge(schema, {
  endpoint: window,
  allowedOrigins: ["https://host.example"],
  timeoutMs: 5_000,
});

// host side
const order = await bridge.request("order.fetch", { id: "abc" });
//    ^? { id: string; total: number }

// embed side
bridge.handle("order.fetch", async ({ id }) => ({ id, total: 42 }));

// either side
bridge.on("order.updated", ({ id }) => console.log(id));
bridge.emit("order.updated", { id: "abc" });
```

Same `schema` literal lives on both ends — typically exported from a shared
`@your-org/embed-contract` package so host and embed can't drift.

## Install

```bash
pnpm add @shadowkit/bridge zod
```

## Features

- **Symmetric:** anyone can `request`, anyone can `handle`. No host/embed
  distinction in the factory.
- **Typed:** request input, request output, and event payloads all flow from
  the schema literal — full compile-time check at every call site.
- **Validated on the wire:** Zod parses inputs *and* outputs on both sides;
  bad payloads come back as `BridgeError { code: 'BRIDGE_VALIDATION' }`.
- **Origin allow-list** is first-class. Pass `allowedOrigins: ['https://x']`
  and inbound messages from any other origin are dropped silently.
- **Correlation IDs + timeouts:** every `request()` carries a uuid and a
  per-request timer. Timeouts reject with `BRIDGE_TIMEOUT`.
- **Structured errors:** `BridgeError` with `code` ∈ `BRIDGE_TIMEOUT |
  BRIDGE_VALIDATION | BRIDGE_NO_HANDLER | BRIDGE_HANDLER_THREW |
  BRIDGE_DISPOSED | BRIDGE_ORIGIN`. Codes are part of the wire contract;
  switch on them.
- **Endpoint-agnostic:** `MessageEndpoint` is a narrow interface. Works
  against `window` (same-origin), iframe `contentWindow` (cross-origin),
  `MessagePort`, `BroadcastChannel`, `Worker`, or a test double.
- **Clean teardown:** `bridge.dispose()` removes the listener and rejects
  every pending request with `BRIDGE_DISPOSED`.

## API

### `defineBridge(schema, options?): Bridge<Schema>`

| Option             | Type                              | Default       | Notes                                          |
| ------------------ | --------------------------------- | ------------- | ---------------------------------------------- |
| `endpoint`         | `MessageEndpoint`                 | `globalThis`  | Where inbound messages are received            |
| `target`           | `MessageEndpoint`                 | `endpoint`    | Where outbound messages are sent               |
| `allowedOrigins`   | `readonly string[] \| "*"`        | `"*"`         | Pin this in production                         |
| `postTargetOrigin` | `string`                          | `"*"`         | Forwarded as second arg to `postMessage`       |
| `timeoutMs`        | `number`                          | `10_000`      | Per-request timeout                            |
| `generateId`       | `() => string`                    | uuid/random   | Override in tests for deterministic ids        |

Returned bridge:

```ts
bridge.request(method, payload): Promise<Output>
bridge.handle(method, handler): () => void  // unsubscribe
bridge.emit(channel, payload): void
bridge.on(channel, listener): () => void
bridge.dispose(): void
```

### `BridgeError`

```ts
class BridgeError extends Error {
  readonly code: BridgeErrorCode
}
```

Codes are stable strings; the test suite locks them. Use `instanceof BridgeError`
or check `.code` directly.

## Wire envelope

For interoperability and debugging, here's the on-the-wire shape:

```ts
// request
{ v: 1, kind: "req", id: string, method: string, payload: unknown }

// response (ok)
{ v: 1, kind: "res", id: string, ok: true, payload: unknown }

// response (err)
{ v: 1, kind: "res", id: string, ok: false, error: { code, message } }

// event
{ v: 1, kind: "evt", channel: string, payload: unknown }
```

The `v: 1` field is a version tag — when v2 ships it'll add `v: 2` and the
runtime will negotiate.

## License

MIT.
