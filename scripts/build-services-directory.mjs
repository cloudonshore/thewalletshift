#!/usr/bin/env node
// Build the committed, browsable services directory the /services page reads.
// Folds the classification + fetched-capability intermediates into ONE static
// JSON of the real-SERVICE-tier providers (collectibles + spam excluded) — each
// with its callable endpoints and live A2A skills / MCP tools, so the directory
// can show "what you can actually call", not just charts.
//
//   node scripts/build-services-directory.mjs   # writes web/src/data/services.json
//
// Reads:  enrichment.json (category/tags/summary), enrich-input.json (name/descr/
//         services[]/protos), skills.json (live A2A skills + MCP tools),
//         agents.json (x402 flag, ens, reg date), taxonomy.json (tier per category),
//         health.json (optional — per-endpoint liveness probe, scripts/probe-health.mjs)
// Writes: web/src/data/services.json  (committed, bundled by the app)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const D = "web/src/data";
const J = (f) => JSON.parse(readFileSync(`${D}/${f}`, "utf8"));
const enrich = J("enrichment.json");
const input = J("enrich-input.json");
const skills = J("skills.json");
const agentsDoc = J("agents.json");
const tax = J("taxonomy.json");
// health.json is an optional, gitignored intermediate; fold it in if a probe has run
const health = existsSync(`${D}/health.json`) ? J("health.json") : null;
const healthBy = new Map(
  (health?.records || []).map((r) => [
    `${r.id}|${(r.url || "").trim()}`,
    { status: r.status, http: r.http ?? null, last_probed: r.last_probed, probe: r.probe },
  ])
);

const catMeta = new Map(tax.categories.map((c) => [c.key, c]));
const serviceKeys = new Set(tax.categories.filter((c) => c.tier === "service").map((c) => c.key));
const inputById = new Map((input.agents || input).map((a) => [a.id, a]));
const skillsById = new Map((skills.agents || skills).map((s) => [s.id, s]));
const x402By = new Map(agentsDoc.agents.map((a) => [a.id, String(a.x402).toLowerCase() === "true"]));
const ensBy = new Map(agentsDoc.agents.map((a) => [a.id, a.ens || null]));
const regBy = new Map(agentsDoc.agents.map((a) => [a.id, a.reg || null]));

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return (url || "").replace(/^https?:\/\//, "").split("/")[0] || null;
  }
};
// health only applies to HTTP(S) endpoints — ENS names / CAIP-10 on-chain refs
// are identifiers, not callable endpoints, so they carry no health verdict.
const isHttp = (url) => {
  try {
    const p = new URL(url).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
};

// dedupe endpoints by proto+url, keep a short host for display
function endpointsOf(inp) {
  const seen = new Set();
  const out = [];
  for (const s of inp?.services || []) {
    const url = (s.endpoint || "").trim();
    const key = `${s.proto}|${url}`;
    if (!url || seen.has(key)) continue;
    seen.add(key);
    const ep = { proto: s.proto, name: s.name || s.proto, url, host: hostOf(url) };
    const h = isHttp(url) ? healthBy.get(`${inp.id}|${url}`) : null;
    if (h) ep.health = h;
    out.push(ep);
  }
  return out;
}

// live, fetched capabilities — A2A skills (rich: name/desc/tags) or MCP tools
function skillsOf(id) {
  const s = skillsById.get(id);
  if (!s) return [];
  if ((s.a2a_skills || []).length)
    return s.a2a_skills.slice(0, 24).map((k) => ({
      name: k.name || "",
      desc: (k.desc || "").slice(0, 280),
      tags: (k.tags || []).slice(0, 6),
    }));
  if ((s.mcp_tools || []).length)
    return s.mcp_tools.slice(0, 24).map((t) => ({ name: t.name || "", desc: (t.desc || "").slice(0, 280), tags: [] }));
  return [];
}

const providers = [];
for (const c of enrich.agents) {
  const key = catMeta.has(c.category) ? c.category : "placeholder-spam";
  if (!serviceKeys.has(key)) continue; // real-service tier only
  const inp = inputById.get(c.id) || {};
  const eps = endpointsOf(inp);
  const sk = skillsOf(c.id);
  providers.push({
    id: c.id,
    name: inp.name || null,
    kind: inp.kind || null, // onchain | offchain (where the card lives)
    category: key,
    label: catMeta.get(key)?.label || key,
    summary: c.summary || null,
    descr: (inp.descr || "").slice(0, 600) || null,
    tags: (c.tags || []).slice(0, 8),
    protos: inp.protos || [],
    x402: !!x402By.get(c.id),
    ens: ensBy.get(c.id),
    reg: regBy.get(c.id),
    endpoints: eps,
    skills: sk,
  });
}

// stable, useful default order: providers with live skills first, then x402, then name
providers.sort(
  (a, b) =>
    b.skills.length - a.skills.length ||
    Number(b.x402) - Number(a.x402) ||
    (a.name || "").localeCompare(b.name || "")
);

// category facets (service tier), with counts derived from the providers we kept
const counts = new Map();
for (const p of providers) counts.set(p.category, (counts.get(p.category) || 0) + 1);
const categories = tax.categories
  .filter((c) => c.tier === "service")
  .map((c) => ({ key: c.key, label: c.label, definition: c.definition, count: counts.get(c.key) || 0 }))
  .sort((a, b) => b.count - a.count);

// per-endpoint health rollup (only meaningful once a probe has run)
const byStatus = { live: 0, paywalled: 0, dead: 0 };
for (const p of providers)
  for (const e of p.endpoints) if (e.health) byStatus[e.health.status] = (byStatus[e.health.status] || 0) + 1;
const probedEndpoints = byStatus.live + byStatus.paywalled + byStatus.dead;

const out = {
  generated_at: enrich.generated_at,
  network: "ethereum-mainnet",
  total: providers.length,
  with_skills: providers.filter((p) => p.skills.length).length,
  x402: providers.filter((p) => p.x402).length,
  last_probed: health?.generated_at || null,
  health: probedEndpoints ? byStatus : null,
  protos: {
    a2a: providers.filter((p) => p.protos.includes("a2a")).length,
    mcp: providers.filter((p) => p.protos.includes("mcp")).length,
    web: providers.filter((p) => p.protos.includes("web")).length,
  },
  categories,
  providers,
};
writeFileSync(`${D}/services.json`, JSON.stringify(out));
console.log(
  `services.json: ${providers.length} service providers · ${out.with_skills} with live skills · ${out.x402} x402 · ${categories.length} categories` +
    (probedEndpoints
      ? ` · health ${byStatus.live} live / ${byStatus.paywalled} paywalled / ${byStatus.dead} dead`
      : " · no health probe folded in")
);
