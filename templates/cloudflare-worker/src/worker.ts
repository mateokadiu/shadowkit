/**
 * shadowkit CDN — Cloudflare Worker.
 *
 * URL scheme:
 *
 *   /v1/<package>@<version>/<file>
 *
 * where:
 *   - <package> is one of: core, theme, bridge, tailwind, ssr
 *   - <version> is the published npm version (e.g. `1.0.0`)
 *   - <file>    is `index.js`, `index.d.ts`, or a sub-export path.
 *
 * Examples:
 *   /v1/core@1.0.0/index.js
 *   /v1/bridge@1.0.0/index.js
 *
 * The worker:
 *  - splits each shadowkit package into a separately fetchable chunk so
 *    consumers only download what they use (tree-shake at the URL layer).
 *  - serves immutable assets with long cache headers and a strong ETag.
 *  - applies a CORS allow-list from `env.ALLOWED_ORIGINS` (comma-separated).
 *
 * Bundles are stored in R2 / KV / static assets — pick one binding and wire
 * `fetchAsset` to it. The default implementation reads from the
 * `__STATIC_CONTENT` binding (Workers Sites style) so the template runs out
 * of the box; swap to R2 / Pages / KV per your deployment.
 */

export interface Env {
  SHADOWKIT_VERSION: string;
  ALLOWED_ORIGINS?: string;
  // Bind your asset store here. Wrangler v3+ defaults to Workers Assets.
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}

const PACKAGES = new Set(["core", "theme", "bridge", "tailwind", "ssr"]);
const URL_RE = /^\/v1\/([a-z][a-z-]*)@([\w.-]+)\/(.+)$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const match = url.pathname.match(URL_RE);
    if (!match) {
      return json({ error: "not_found" }, 404, corsHeaders);
    }
    const [, pkg, version, file] = match as unknown as [
      string,
      string,
      string,
      string
    ];

    if (!PACKAGES.has(pkg)) {
      return json({ error: "unknown_package", pkg }, 404, corsHeaders);
    }
    if (version !== env.SHADOWKIT_VERSION) {
      return json(
        {
          error: "version_not_pinned",
          requested: version,
          available: env.SHADOWKIT_VERSION,
        },
        404,
        corsHeaders
      );
    }

    const assetPath = `/bundles/${pkg}/${file}`;
    const asset = await fetchAsset(env, assetPath);
    if (!asset.ok) {
      return json({ error: "asset_missing", file: assetPath }, 404, corsHeaders);
    }

    const headers = new Headers(asset.headers);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("content-type", contentTypeFor(file));

    return new Response(asset.body, { status: 200, headers });
  },
};

function buildCorsHeaders(
  request: Request,
  env: Env
): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

function contentTypeFor(file: string): string {
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".map")) return "application/json; charset=utf-8";
  if (file.endsWith(".d.ts")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

async function fetchAsset(env: Env, path: string): Promise<Response> {
  if (!env.ASSETS) {
    return new Response(null, { status: 404 });
  }
  const probe = new Request(`https://shadowkit-cdn.invalid${path}`);
  return env.ASSETS.fetch(probe);
}

function json(
  body: unknown,
  status: number,
  extra: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}
