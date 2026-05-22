import { themeSchema, type ThemeInput, type TokenLeaf, type TokenTree } from "./schema.js";

export interface DefinedTheme {
  /** CSS string with `:host { --x: y; }` declarations. */
  css: string;
  /**
   * Flat record of variable names to values. `color.surface.fg` becomes
   * `--color-surface-fg`. Useful for tooling and the `applyTheme` host-side
   * override API (out-of-scope for v0.1, scaffolded here).
   */
  variables: Record<string, string | number>;
  /**
   * Generated TS source — a `.d.ts` snippet declaring the token namespace.
   * Consumers can write it to disk in a build step; v0.1 just returns it as
   * a string so theme libraries can compose it.
   */
  types: string;
  /** The validated theme value. */
  theme: { name: string; tokens: TokenTree };
}

function isLeafEnvelope(
  value: unknown
): value is { value: string | number; description?: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = (value as { value?: unknown }).value;
  return typeof v === "string" || typeof v === "number";
}

function isLeaf(value: unknown): value is TokenLeaf {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    isLeafEnvelope(value)
  );
}

function leafValue(leaf: TokenLeaf): string | number {
  if (typeof leaf === "string" || typeof leaf === "number") return leaf;
  return leaf.value;
}

/**
 * Walk the nested token object, yielding `["color-surface-fg", "#fff"]`-shaped
 * flat entries plus the original leaf node (so we can pick up descriptions for
 * the emitted .d.ts).
 */
function* walk(
  tokens: TokenTree,
  prefix: string[] = []
): Generator<{ path: string[]; varName: string; leaf: TokenLeaf }> {
  for (const [key, value] of Object.entries(tokens)) {
    const path = [...prefix, key];
    if (isLeaf(value)) {
      yield { path, varName: `--${path.join("-")}`, leaf: value };
    } else {
      yield* walk(value as TokenTree, path);
    }
  }
}

function formatValue(v: string | number): string {
  if (typeof v === "number") return String(v);
  // Keep strings verbatim — callers own quoting / units.
  return v;
}

/**
 * Build a TS namespace literal that mirrors the token tree shape. The emitted
 * types reflect *value type* (string vs number), which gives callers honest
 * types when they index a token at runtime.
 */
function emitTypes(name: string, tokens: TokenTree): string {
  function emitNode(node: TokenLeaf | TokenTree, depth: number): string {
    if (isLeaf(node)) {
      const v = leafValue(node);
      return typeof v === "number" ? "number" : "string";
    }
    const indent = "  ".repeat(depth);
    const inner = Object.entries(node)
      .map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${emitNode(v as TokenLeaf | TokenTree, depth + 1)};`)
      .join("\n");
    return `{\n${inner}\n${indent}}`;
  }
  const typeName = name
    .split(/[-_]/)
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join("");
  return `export interface ${typeName}Tokens ${emitNode(tokens, 0)}\n`;
}

/**
 * Define a theme. Validates the shape with Zod (build-time fails loud) and
 * emits the `:host { --x: y; }` CSS plus TS declarations from the same source.
 *
 * Place the emitted CSS into a constructable stylesheet alongside your
 * component styles via `@shadowkit/core`'s `attachStyles`. Because the vars
 * are declared on `:host`, they cascade *into* the shadow root — exactly the
 * opposite of `:root` vars, which do not. That's the whole point.
 */
export function defineTheme(input: ThemeInput): DefinedTheme {
  const theme = themeSchema.parse(input);
  const variables: Record<string, string | number> = {};
  const declarations: string[] = [];

  for (const { varName, leaf } of walk(theme.tokens)) {
    const value = leafValue(leaf);
    variables[varName] = value;
    const description =
      typeof leaf === "object" && "description" in leaf && leaf.description
        ? ` /* ${leaf.description.replace(/\*\//g, "*\\/")} */`
        : "";
    declarations.push(`  ${varName}: ${formatValue(value)};${description}`);
  }

  const css = `/* shadowkit theme: ${theme.name} */\n:host {\n${declarations.join(
    "\n"
  )}\n}\n`;

  return {
    css,
    variables,
    types: emitTypes(theme.name, theme.tokens),
    theme,
  };
}
