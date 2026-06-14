#!/usr/bin/env node
// Merge the fetched OFF-CHAIN cards into agents.json: fill name/ens/x402/active/
// trust/descr/proto for off-chain agents we successfully fetched (on-chain agents
// already have these from SQL). agents.json must then be re-uploaded to GCS, where
// the classification pipeline reads it as a source.
// Inputs: web/src/data/{agents,offchain-cards}.json. Run AFTER export-agents.sh and
// the fetch (fetch-cards.mjs).
import { readFileSync, writeFileSync } from "node:fs";

const D = "web/src/data";
const agentsDoc = JSON.parse(readFileSync(`${D}/agents.json`, "utf8"));
const off = JSON.parse(readFileSync(`${D}/offchain-cards.json`, "utf8"));

// enrich agents.json with the fetched off-chain fields
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

console.log(`enriched ${enriched} off-chain agents in agents.json`);
