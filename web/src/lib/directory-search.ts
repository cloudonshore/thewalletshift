// The core agent-facing search over the services directory. This is the single
// function the public API (/api/services/*) and any future fronts (an MCP server,
// an A2A agent card) all call — one search core, many fronts. It mirrors the
// in-browser filter logic in components/services-directory.tsx exactly (same
// haystack, same proto/category/x402 filters) so API and UI results agree.
import { services, providerHealth, type Provider, type EndpointHealth, type HealthStatus } from "@/lib/services";
import { haystack } from "@/lib/haystack";

export interface SearchParams {
  q?: string;
  category?: string;
  proto?: string; // a2a | mcp | web
  x402?: boolean;
  status?: HealthStatus; // live | paywalled | dead — by health probe
  limit?: number;
  offset?: number;
}

export interface ResultEndpoint {
  proto: string | null;
  name: string;
  url: string;
  health?: EndpointHealth;
}

// The compact, agent-facing shape returned by search — enough to decide which
// service to call and how to reach it, without the full skill descriptions
// (fetch /api/services/{id} for those).
export interface SearchResultItem {
  id: number;
  name: string | null;
  category: string;
  label: string;
  summary: string | null;
  ens: string | null;
  x402: boolean;
  protos: string[];
  skills_count: number;
  endpoints: ResultEndpoint[];
}

export interface SearchResult {
  total: number;
  count: number;
  limit: number;
  offset: number;
  results: SearchResultItem[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const VALID_PROTOS = new Set(["a2a", "mcp", "web"]);
const VALID_STATUS = new Set<HealthStatus>(["live", "paywalled", "dead"]);

// Precompute the (provider, haystack) index once at module load — the directory
// is a static bundled artifact, so this is built a single time per server boot.
const INDEX: { p: Provider; hay: string }[] = services.providers.map((p) => ({
  p,
  hay: haystack(p),
}));

export function toResultItem(p: Provider): SearchResultItem {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    label: p.label,
    summary: p.summary,
    ens: p.ens,
    x402: p.x402,
    protos: p.protos,
    skills_count: p.skills.length,
    endpoints: p.endpoints.map((e) => ({ proto: e.proto, name: e.name, url: e.url, health: e.health })),
  };
}

export function searchProviders(params: SearchParams): SearchResult {
  const tokens = (params.q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const category = params.category?.trim() || null;
  const proto = params.proto && VALID_PROTOS.has(params.proto) ? params.proto : null;
  const x402 = !!params.x402;
  const status = params.status && VALID_STATUS.has(params.status) ? params.status : null;

  const matched = INDEX.filter(({ p, hay }) => {
    if (category && p.category !== category) return false;
    if (proto && !p.protos.includes(proto)) return false;
    if (x402 && !p.x402) return false;
    if (status && providerHealth(p) !== status) return false;
    return tokens.every((t) => hay.includes(t));
  }).map(({ p }) => p);

  const limit = Math.min(Math.max(1, params.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(0, params.offset ?? 0);
  const page = matched.slice(offset, offset + limit);

  return {
    total: matched.length,
    count: page.length,
    limit,
    offset,
    results: page.map(toResultItem),
  };
}

export function getProvider(id: number): Provider | null {
  return services.providers.find((p) => p.id === id) ?? null;
}

export const categoryFacets = services.categories.map((c) => ({
  key: c.key,
  label: c.label,
  count: c.count,
}));
