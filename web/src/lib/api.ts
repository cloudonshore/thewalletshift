// Shared helpers for the public agent-facing API routes (/api/services/*,
// /SKILL.md). These endpoints are meant to be called by arbitrary AI agents from
// anywhere, so they send permissive CORS and a short CDN cache (the underlying
// directory is a static, ~daily artifact).

const CANONICAL = "https://thewalletshift.com";

// Reconstruct the absolute origin from the request so docs/detail links resolve
// in dev (localhost) and prod (App Hosting / custom domain) alike.
export function baseUrl(request: Request): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return CANONICAL;
  const local = host.includes("localhost") || host.startsWith("127.");
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

export const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type",
};

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function apiJson(
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
      ...CORS,
      ...(init.headers ?? {}),
    },
  });
}
