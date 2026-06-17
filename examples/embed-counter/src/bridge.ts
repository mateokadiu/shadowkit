import { z } from "zod";
import { defineBridge } from "@shadowkit/bridge";
import type { Bridge } from "@shadowkit/bridge";

/**
 * The same schema literal lives on both sides of every shadowkit bridge.
 * In a real embed you'd ship this from a shared `@my/embed-contract`
 * package so the host page and the widget can't drift.
 */
export const counterSchema = {
  requests: {
    /** Ask the host for the current shared count. */
    "count.get": {
      input: z.object({}),
      output: z.object({ value: z.number().int() }),
    },
  },
  events: {
    /** Broadcast: someone changed the count. */
    "count.changed": z.object({
      value: z.number().int(),
      by: z.string(), // which counter element id did the change
    }),
  },
} as const;

export type CounterBridge = Bridge<typeof counterSchema>;

/**
 * One process here, so host and embed both attach to `window`. In a real
 * iframe embed this would be `window.parent` from the embed side and
 * `iframe.contentWindow` on the host side.
 */
export function makeCounterBridge(): CounterBridge {
  return defineBridge(counterSchema, {
    endpoint: window,
    allowedOrigins: [window.location.origin],
    postTargetOrigin: window.location.origin,
    timeoutMs: 2000,
  });
}
