#!/usr/bin/env node
// Turn raw LLM classifications into the committed analytics dataset the /agents
// insights page reads, and (optionally) fold category+summary into agents.json.
//
//   node scripts/build-classified.mjs           # writes classified.json
//   node scripts/build-classified.mjs --merge    # also merges cat/summary into agents.json
//
// Reads:  enrichment.json (classify-agents workflow), corpus.json, taxonomy.json,
//         agents.json (reg dates for the growth series; full set)
// Writes: web/src/data/classified.json  (committed)  [+ agents.json if --merge]
import { readFileSync, writeFileSync } from "node:fs";

const merge = process.argv.includes("--merge");
const D = "web/src/data";
const enrich = JSON.parse(readFileSync(`${D}/enrichment.json`, "utf8"));
const corpus = JSON.parse(readFileSync(`${D}/corpus.json`, "utf8"));
const tax = JSON.parse(readFileSync(`${D}/taxonomy.json`, "utf8"));
const agentsDoc = JSON.parse(readFileSync(`${D}/agents.json`, "utf8"));

const catMeta = new Map(tax.categories.map((c) => [c.key, c]));
const corpById = new Map(corpus.agents.map((a) => [a.id, a]));
const clsById = new Map(enrich.agents.map((c) => [c.id, c]));
// x402-payable = the card's self-declared x402Support flag (from agents.json)
const x402By = new Map(agentsDoc.agents.map((a) => [a.id, String(a.x402).toLowerCase() === "true"]));

// --- per-category aggregates -------------------------------------------------
const cat = new Map(); // key -> {count, with_skills, a2a, mcp, web}
let unknown = 0;
for (const c of enrich.agents) {
  let key = c.category;
  if (!catMeta.has(key)) {
    unknown++;
    key = "placeholder-spam"; // fall back unknown/hallucinated keys to spam tier
  }
  const co = corpById.get(c.id) || {};
  const protos = co.protos || [];
  const e = cat.get(key) || { count: 0, with_skills: 0, a2a: 0, mcp: 0, web: 0, x402: 0 };
  e.count++;
  if (co.cap) e.with_skills++;
  if (protos.includes("a2a")) e.a2a++;
  if (protos.includes("mcp")) e.mcp++;
  if (protos.includes("web")) e.web++;
  if (x402By.get(c.id)) e.x402++;
  cat.set(key, e);
}

// a few real example agents per category (prefer ones with fetched skills, then
// longer summaries) so the analytics page can show concrete agents, not just bars
const exById = new Map();
for (const c of enrich.agents) {
  const key = catMeta.has(c.category) ? c.category : "placeholder-spam";
  if (!exById.has(key)) exById.set(key, []);
  const co = corpById.get(c.id) || {};
  exById.get(key).push({
    id: c.id,
    name: co.name || null,
    summary: c.summary || null,
    protos: co.protos || [],
    has_skills: !!co.cap,
  });
}
function pickExamples(key) {
  const list = exById.get(key) || [];
  return [...list]
    .sort((a, b) => (b.has_skills ? 1 : 0) - (a.has_skills ? 1 : 0) || (b.summary?.length || 0) - (a.summary?.length || 0))
    .slice(0, 4)
    .map(({ id, name, summary, protos }) => ({ id, name, summary, protos }));
}

const categories = tax.categories.map((c) => ({
  key: c.key,
  label: c.label,
  tier: c.tier,
  ...(cat.get(c.key) || { count: 0, with_skills: 0, a2a: 0, mcp: 0, web: 0, x402: 0 }),
  examples: pickExamples(c.key),
}));

const tierCount = { service: 0, collectible: 0, spam: 0 };
const x402 = { service: 0, callable: 0 };
for (const c of categories) {
  tierCount[c.tier] += c.count;
  x402.callable += c.x402;
  if (c.tier === "service") x402.service += c.x402;
}

// --- top capability tags (service tier only — that's the interesting part) ---
const serviceKeys = new Set(tax.categories.filter((c) => c.tier === "service").map((c) => c.key));
const tagN = new Map();
for (const c of enrich.agents) {
  const key = catMeta.has(c.category) ? c.category : "placeholder-spam";
  if (!serviceKeys.has(key)) continue;
  for (const t of c.tags || []) {
    const tag = String(t).toLowerCase().trim();
    if (tag) tagN.set(tag, (tagN.get(tag) || 0) + 1);
  }
}
const top_tags = [...tagN.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50)
  .map(([tag, count]) => ({ tag, count }));

// --- cumulative growth: total vs callable vs real-service, by registration date
const serviceIds = new Set(
  enrich.agents
    .filter((c) => serviceKeys.has(catMeta.has(c.category) ? c.category : "placeholder-spam"))
    .map((c) => c.id)
);
const callableIds = new Set(enrich.agents.map((c) => c.id));
const byDate = new Map(); // date -> {total, callable, service}
for (const a of agentsDoc.agents) {
  const d = a.reg;
  if (!d) continue;
  const e = byDate.get(d) || { total: 0, callable: 0, service: 0 };
  e.total++;
  if (callableIds.has(a.id)) e.callable++;
  if (serviceIds.has(a.id)) e.service++;
  byDate.set(d, e);
}
const dates = [...byDate.keys()].sort();
let tT = 0,
  tC = 0,
  tS = 0;
const growth = dates.map((d) => {
  const e = byDate.get(d);
  tT += e.total;
  tC += e.callable;
  tS += e.service;
  return { date: d, total: tT, callable: tC, service: tS };
});

// --- per-category cumulative growth (service tier only) — how the mix evolved ---
const svcCatKeys = tax.categories
  .filter((c) => c.tier === "service")
  .map((c) => ({ key: c.key, label: c.label, count: (cat.get(c.key) || { count: 0 }).count }))
  .sort((a, b) => b.count - a.count)
  .map(({ key, label }) => ({ key, label }));
const catOfId = new Map(enrich.agents.map((c) => [c.id, catMeta.has(c.category) ? c.category : "placeholder-spam"]));
const dateCat = new Map(); // date -> {catKey: count}
for (const a of agentsDoc.agents) {
  if (!serviceIds.has(a.id) || !a.reg) continue;
  const k = catOfId.get(a.id);
  const e = dateCat.get(a.reg) || {};
  e[k] = (e[k] || 0) + 1;
  dateCat.set(a.reg, e);
}
const run = {};
const catSeries = [...dateCat.keys()].sort().map((d) => {
  const e = dateCat.get(d);
  for (const k in e) run[k] = (run[k] || 0) + e[k];
  const row = { date: d };
  for (const c of svcCatKeys) row[c.key] = run[c.key] || 0;
  return row;
});

const out = {
  generated_at: enrich.generated_at,
  network: "ethereum-mainnet",
  total_agents: agentsDoc.count,
  classified: enrich.agents.length,
  tiers: tierCount,
  x402,
  categories: categories.sort((a, b) => b.count - a.count),
  top_tags,
  category_growth: { categories: svcCatKeys, series: catSeries },
  growth,
};
writeFileSync(`${D}/classified.json`, JSON.stringify(out));
console.log(
  `classified.json: ${enrich.agents.length} classified · tiers ${JSON.stringify(tierCount)} · ${unknown} unknown keys -> spam`
);
console.log(`  growth points: ${growth.length} (${dates[0]} -> ${dates[dates.length - 1]})`);
console.log(`  top tags: ${top_tags.slice(0, 8).map((t) => t.tag).join(", ")}`);

// --- optional: merge category + summary into agents.json (for the table) -----
if (merge) {
  let n = 0;
  for (const a of agentsDoc.agents) {
    const c = clsById.get(a.id);
    if (c) {
      a.cat = catMeta.has(c.category) ? c.category : "placeholder-spam";
      a.summary = c.summary || null;
      n++;
    }
  }
  writeFileSync(`${D}/agents.json`, JSON.stringify(agentsDoc, (k, v) => v, 0));
  console.log(`merged cat+summary into ${n} agents in agents.json (re-upload to GCS!)`);
}
