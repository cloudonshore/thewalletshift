// GET /api/services/search — the agent-facing query endpoint over the directory
// of real, callable ERC-8004 services. Documented for agents at /SKILL.md.
//
// Query params (all optional):
//   q        free-text over name/summary/description/tags/skills/hosts
//   category one of services.categories[].key
//   proto    a2a | mcp | web   (only services exposing that protocol)
//   x402     true|1            (only x402-payable services)
//   limit    1..100 (default 20)
//   offset   pagination offset (default 0)
import { searchProviders } from "@/lib/directory-search";
import { services } from "@/lib/services";
import { apiJson, baseUrl, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = sp.get("q") ?? undefined;
  const category = sp.get("category") ?? undefined;
  const proto = sp.get("proto") ?? undefined;
  const x402raw = sp.get("x402");
  const x402 = x402raw === "true" || x402raw === "1";
  const limitRaw = sp.get("limit");
  const offsetRaw = sp.get("offset");

  const result = searchProviders({
    q,
    category,
    proto,
    x402,
    limit: limitRaw ? parseInt(limitRaw, 10) || undefined : undefined,
    offset: offsetRaw ? parseInt(offsetRaw, 10) || undefined : undefined,
  });

  const base = baseUrl(request);
  return apiJson({
    query: { q: q ?? null, category: category ?? null, proto: proto ?? null, x402 },
    total: result.total,
    count: result.count,
    limit: result.limit,
    offset: result.offset,
    results: result.results.map((r) => ({ ...r, detail: `${base}/api/services/${r.id}` })),
    categories: services.categories.map((c) => ({ key: c.key, label: c.label, count: c.count })),
    network: services.network,
    generated_at: services.generated_at,
    docs: `${base}/SKILL.md`,
  });
}
