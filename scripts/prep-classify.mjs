#!/usr/bin/env node
// Split the full classification corpus into chunk files for the classification
// fan-out. Each workflow subagent reads one chunk + taxonomy.json and classifies
// every agent in it.
//
//   node scripts/prep-classify.mjs            # chunks of 50
//
// Writes: web/src/data/_cls/chunk-0.json ... chunk-N.json  (+ prints chunk count)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const PER = 50;
const corpus = JSON.parse(readFileSync("web/src/data/corpus.json", "utf8")).agents;

const compact = (a) => ({
  id: a.id,
  name: a.name,
  protos: a.protos,
  descr: a.descr ? a.descr.slice(0, 600) : null,
  cap: a.cap ? a.cap.slice(0, 800) : null,
});

rmSync("web/src/data/_cls", { recursive: true, force: true });
mkdirSync("web/src/data/_cls", { recursive: true });
let n = 0;
for (let i = 0; i < corpus.length; i += PER) {
  const slice = corpus.slice(i, i + PER).map(compact);
  writeFileSync(`web/src/data/_cls/chunk-${n}.json`, JSON.stringify(slice, null, 0));
  n++;
}
console.log(`classify corpus: ${corpus.length} agents -> ${n} chunks of ${PER} in web/src/data/_cls/`);
