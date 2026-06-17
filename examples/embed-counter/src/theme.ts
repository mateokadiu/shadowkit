import { defineTheme } from "@shadowkit/theme";

/**
 * Demo theme — the values mirror Tailwind colors, but the point is that
 * the *contract* lives in TS. Rename a token here and TS errors at the
 * consumer site.
 */
export const counterTheme = defineTheme({
  name: "counter",
  tokens: {
    color: {
      surface: { value: "#11163a", description: "card background" },
      surfaceHi: "#1a2154",
      accent: "#7c9cff",
      fg: "#e6e8f2",
      fgMuted: "#9aa1c4",
    },
    radius: "0.75rem",
    pad: "1rem",
    fontMono:
      'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
});
