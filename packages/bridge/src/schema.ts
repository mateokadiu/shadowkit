import { z } from "zod";

/**
 * `defineBridge` consumes a schema literal with this shape:
 *
 * ```ts
 * const schema = {
 *   requests: {
 *     'order.fetch': { input: z.object({ id: z.string() }),
 *                      output: z.object({ id: z.string(), total: z.number() }) },
 *   },
 *   events: {
 *     'order.updated': z.object({ id: z.string() }),
 *   },
 * } as const;
 * ```
 *
 * The shape is intentionally narrow:
 *  - `requests` are RPC: typed input, typed output, response expected.
 *  - `events` are fire-and-forget broadcasts on named channels.
 *
 * We carry the schema at runtime (for validation on both sides) and use
 * `z.input`/`z.infer` to lift the static types.
 */

export type RequestSchemaShape = Readonly<
  Record<string, { input: z.ZodTypeAny; output: z.ZodTypeAny }>
>;

export type EventSchemaShape = Readonly<Record<string, z.ZodTypeAny>>;

export interface BridgeSchema {
  requests?: RequestSchemaShape;
  events?: EventSchemaShape;
}

export type RequestInput<
  S extends BridgeSchema,
  M extends keyof NonNullable<S["requests"]>
> = NonNullable<S["requests"]>[M] extends { input: infer I }
  ? I extends z.ZodTypeAny
    ? z.input<I>
    : never
  : never;

export type RequestOutput<
  S extends BridgeSchema,
  M extends keyof NonNullable<S["requests"]>
> = NonNullable<S["requests"]>[M] extends { output: infer O }
  ? O extends z.ZodTypeAny
    ? z.infer<O>
    : never
  : never;

export type EventPayload<
  S extends BridgeSchema,
  E extends keyof NonNullable<S["events"]>
> = NonNullable<S["events"]>[E] extends z.ZodTypeAny
  ? z.input<NonNullable<S["events"]>[E]>
  : never;

/* --- Wire-level envelope shapes (validated on receive) --- */

export const wireRequest = z.object({
  v: z.literal(1),
  kind: z.literal("req"),
  id: z.string(),
  method: z.string(),
  payload: z.unknown(),
});
export type WireRequest = z.infer<typeof wireRequest>;

export const wireResponseOk = z.object({
  v: z.literal(1),
  kind: z.literal("res"),
  id: z.string(),
  ok: z.literal(true),
  payload: z.unknown(),
});

export const wireResponseErr = z.object({
  v: z.literal(1),
  kind: z.literal("res"),
  id: z.string(),
  ok: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});

export const wireResponse = z.union([wireResponseOk, wireResponseErr]);
export type WireResponse = z.infer<typeof wireResponse>;

export const wireEvent = z.object({
  v: z.literal(1),
  kind: z.literal("evt"),
  channel: z.string(),
  payload: z.unknown(),
});
export type WireEvent = z.infer<typeof wireEvent>;

export const wireMessage = z.union([wireRequest, wireResponse, wireEvent]);
export type WireMessage = z.infer<typeof wireMessage>;
