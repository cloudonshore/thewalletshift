#!/usr/bin/env node
// Merge the fetched OFF-CHAIN cards into the indexes.
//   1. Enrich agents.json: fill name/ens/x402/active/trust/descr/proto for off-chain
//      agents we successfully fetched (on-chain agents already have these from SQL).
//   2. Extend cards.json with COMBINED interactability (on-chain + off-chain, by
//      protocol) and an off-chain reachability breakdown.
// Inputs: web/src/data/{agents,offchain-cards,cards}.json. Run AFTER export-agents.sh,
// the fetch, and export-cards.sh. agents.json must then be re-uploaded to GCS.
import { readFileSync, writeFileSync } from "node:fs";

const D = "web/src/data";
const agentsDoc = JSON.parse(readFileSync(`${D}/agents.json`, "utf8"));
const off = JSON.parse(readFileSync(`${D}/offchain-cards.json`, "utf8"));
const cards = JSON.parse(readFileSync(`${D}/cards.json`, "utf8"));

// ---- 1. enrich agents.json with the fetched off-chain fields ----------------
const fetched = new Map(off.cards.map((c) => [c.id, c]));
let enriched = 0;
for (const a of agentsDoc.agents) {
  const f = fetched.get(a.id);
  if (!f) continue;
  enriched++;
  a.name = a.name ?? f.name ?? null;
  a.ens = a.ens ?? f.ens ?? null;
  a.x402 = a.x402 ?? f.x402 ?? null;
  a.active = a.active ?? f.active ?? null;
  a.trust = a.trust ?? f.trust ?? null;
  a.descr = a.descr ?? f.descr ?? null;
  a.proto = (Array.isArray(f.protos) && f.protos.length ? f.protos.join(",") : null) ?? a.proto ?? null;
  a.reachable = true; // we got a parseable card back
}
agentsDoc.indexed_offchain = off.ok;
writeFileSync(`${D}/agents.json`, JSON.stringify(agentsDoc));

// ---- 2. off-chain interactability + reachability ----------------------------
const okCards = off.cards;
const has = (c, p) => Array.isArray(c.protos) && c.protos.includes(p);
const offInteract = {
  reachable: off.ok,
  with_services: okCards.filter((c) => (c.ep_count ?? 0) > 0).length,
  a2a: okCards.filter((c) => has(c, "a2a")).length,
  web: okCards.filter((c) => has(c, "web")).length,
  mcp: okCards.filter((c) => has(c, "mcp")).length,
  x402: okCards.filter((c) => c.x402 === "true").length,
  active: okCards.filter((c) => c.active === "true").length,
};

// roll up the noisy fetch statuses into a few legible buckets for the reachability bar
const bucket = (s) =>
  s === "ok"
    ? "ok"
    : s.startsWith("http-404")
      ? "not_found"
      : s === "bad-json" || s === "not-a-card"
        ? "not_a_card"
        : s === "timeout"
          ? "timeout"
          : s === "enotfound"
            ? "dns_dead"
            : s.startsWith("http-4")
              ? "blocked"
              : s.startsWith("http-5") || s === "too-large"
                ? "server_error"
                : s === "skipped-private"
                  ? "private_skipped"
                  : "other_error";
const reach = {};
for (const [status, n] of Object.entries(off.by_status)) {
  const b = bucket(status);
  reach[b] = (reach[b] || 0) + n;
}

// combined on-chain + off-chain interactability
const onc = cards.interactivity_onchain || {};
cards.interactivity = {
  with_services: (onc.with_services || 0) + offInteract.with_services,
  a2a: (onc.a2a || 0) + offInteract.a2a,
  web: (onc.web || 0) + offInteract.web,
  mcp: (onc.mcp || 0) + offInteract.mcp,
  onchain: onc,
  offchain: offInteract,
};
cards.reachability = { fetched: off.fetched, ok: off.ok, buckets: reach };
writeFileSync(`${D}/cards.json`, JSON.stringify(cards, null, 2));

console.log(`enriched ${enriched} off-chain agents in agents.json`);
console.log(`combined interactable (with services): ${cards.interactivity.with_services}`);
console.log(`  a2a:${cards.interactivity.a2a} web:${cards.interactivity.web} mcp:${cards.interactivity.mcp}`);
console.log(`off-chain reachability:`, JSON.stringify(reach));
