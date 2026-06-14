#!/usr/bin/env node
// Assemble the LLM-classification input: the union of CALLABLE agents (on-chain +
// off-chain) with their full description and their callable service endpoints.
// "Callable" = exposes at least one a2a / mcp / web service (ens/did/email bindings
// alone don't count — they're identity, not an interface you can invoke).
//
//   node scripts/build-enrich-input.mjs
//
// Reads:  web/src/data/onchain-callable.json   (export-onchain-callable.sh)
//         web/src/data/offchain-cards.json     (fetch-cards.mjs, with services+descr_full)
// Writes: web/src/data/enrich-input.json       {count, generated_at, agents:[...]}
import { readFileSync, writeFileSync } from "node:fs";

const today = new Date().toISOString().slice(0, 10);

// proto classification for a single service entry (shared rule, on/off-chain)
function entryProto(name = "", type = "", url = "") {
  const hay = `${name} ${type} ${url}`.toLowerCase();
  if (hay.includes("a2a") || hay.includes("agent-card") || hay.includes("/.well-known/agent")) return "a2a";
  if (hay.includes("mcp")) return "mcp";
  if (hay.includes("x402")) return "x402";
  if (/(^| )web($| )|web-v|"web"/.test(hay) || String(name).toLowerCase() === "web") return "web";
  if (String(name).toLowerCase() === "ens" || String(type).toLowerCase() === "ens") return "ens";
  return null;
}
const CALLABLE = new Set(["a2a", "mcp", "web"]);

function normServices(rawSvcs) {
  const out = [];
  for (const s of rawSvcs || []) {
    const name = s?.name ? String(s.name) : "";
    const endpoint = s?.endpoint ? String(s.endpoint) : "";
    const type = s?.type ? String(s.type) : "";
    if (!endpoint) continue;
    const proto = entryProto(name, type, endpoint);
    out.push({ proto, name: name.slice(0, 40), endpoint: endpoint.slice(0, 400), type: type.slice(0, 60) });
  }
  return out;
}

function record(id, kind, name, descr, rawSvcs) {
  const services = normServices(rawSvcs);
  if (!services.some((s) => CALLABLE.has(s.proto))) return null; // not actually callable
  const protos = [...new Set(services.map((s) => s.proto).filter(Boolean))];
  return {
    id,
    kind,
    name: name ? String(name).slice(0, 80) : null,
    descr: descr ? String(descr).slice(0, 1200) : null,
    protos,
    services,
  };
}

const byId = new Map();

// on-chain
const onc = JSON.parse(readFileSync("web/src/data/onchain-callable.json", "utf8"));
for (const a of onc.agents || []) {
  const r = record(a.id, "onchain", a.name, a.descr, a.services);
  if (r) byId.set(r.id, r);
}
const onCount = byId.size;

// off-chain (new fetch output carries services[] + descr_full)
const off = JSON.parse(readFileSync("web/src/data/offchain-cards.json", "utf8"));
let offHasServices = 0;
for (const c of off.cards || []) {
  if (Array.isArray(c.services) && c.services.length) offHasServices++;
  const r = record(c.id, c.kind || "offchain", c.name, c.descr_full || c.descr, c.services);
  if (r && !byId.has(r.id)) byId.set(r.id, r); // on-chain wins on id collision (shouldn't happen)
}

const agents = [...byId.values()].sort((a, b) => a.id - b.id);
const protoCount = {};
for (const a of agents) for (const p of a.protos) protoCount[p] = (protoCount[p] || 0) + 1;

writeFileSync(
  "web/src/data/enrich-input.json",
  JSON.stringify({ generated_at: today, count: agents.length, by_proto: protoCount, agents }, null, 0)
);

console.log(`enrich-input: ${agents.length} callable agents`);
console.log(`  on-chain: ${onCount} · off-chain added: ${agents.length - onCount}`);
console.log(`  off-chain cards carrying services[]: ${offHasServices} (0 => re-run fetch-cards.mjs first)`);
console.log(`  by proto:`, JSON.stringify(protoCount));
