import { z } from "zod";

/**
 * Token schema.
 *
 * Tokens are leaves in a (possibly nested) object literal. A leaf is a string,
 * a number, or a `{ value, description? }` envelope. The envelope lets you
 * annotate a token for tooling without breaking the type when consumers index
 * the token directly.
 *
 * Nesting flattens to kebab-case CSS variable names: `color.surface.fg` becomes
 * `--color-surface-fg`. Keys are validated against a strict identifier shape so
 * we don't end up emitting `--my var` or similar.
 */

const TOKEN_KEY_RE = /^[a-zA-Z][a-zA-Z0-9]*(?:[-_][a-zA-Z0-9]+)*$/;

export const tokenKey = z
  .string()
  .min(1)
  .refine((s) => TOKEN_KEY_RE.test(s), {
    message:
      "token key must be ascii [a-zA-Z][a-zA-Z0-9]* with optional - or _ separators",
  });

export const tokenLeaf: z.ZodType<TokenLeaf> = z.lazy(() =>
  z.union([
    z.string().min(1),
    z.number().finite(),
    z.object({
      value: z.union([z.string().min(1), z.number().finite()]),
      description: z.string().optional(),
    }),
  ])
);

export type TokenLeaf =
  | string
  | number
  | { value: string | number; description?: string };

export interface TokenTree {
  [key: string]: TokenLeaf | TokenTree;
}

export const tokenTree: z.ZodType<TokenTree> = z.lazy(() =>
  z.record(tokenKey, z.union([tokenLeaf, tokenTree]))
);

/**
 * Top-level theme schema. `name` shows up in the emitted CSS as a comment so
 * humans can read the output, but is otherwise opaque.
 */
export const themeSchema = z.object({
  name: z
    .string()
    .min(1)
    .refine((s) => /^[a-z][a-z0-9-]*$/.test(s), {
      message: "theme name must be lowercase kebab-case",
    }),
  tokens: tokenTree,
});

export type ThemeInput = z.input<typeof themeSchema>;
export type Theme = z.infer<typeof themeSchema>;
