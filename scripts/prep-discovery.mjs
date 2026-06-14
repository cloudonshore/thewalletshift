#!/usr/bin/env node
// Prepare a stratified discovery sample for taxonomy clustering. Splits a
// representative slice of the corpus into chunk files that the workflow's
// clustering subagents read by path. Prioritizes skill-enriched agents (richest
// signal) while keeping a spread of description-only ones.
//
//   node scripts/prep-discovery.mjs            # 8 chunks x ~70
//
// Writes: web/src/data/_disc/chunk-0.json ... chunk-N.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const CHUNKS = 8;
const PER = 70; // ~560 sample total
const corpus = JSON.parse(readFileSync("web/src/data/corpus.json", "utf8")).agents;

// deterministic shuffle (no Math.random — keep runs reproducible)
function seeded(n) {
  let s = 0x9e3779b9 ^ n;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function shuffle(arr) {
  const r = seeded(arr.length);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const withCap = shuffle(corpus.filter((a) => a.cap));
const noCap = shuffle(corpus.filter((a) => !a.cap));
const target = CHUNKS * PER;
const nCap = Math.min(withCap.length, Math.round(target * 0.6));
const nNo = Math.min(noCap.length, target - nCap);
const sample = shuffle([...withCap.slice(0, nCap), ...noCap.slice(0, nNo)]);

const compact = (a) => ({
  id: a.id,
  name: a.name,
  protos: a.protos,
  descr: a.descr ? a.descr.slice(0, 420) : null,
  cap: a.cap ? a.cap.slice(0, 520) : null,
});

mkdirSync("web/src/data/_disc", { recursive: true });
const size = Math.ceil(sample.length / CHUNKS);
let written = 0;
for (let c = 0; c < CHUNKS; c++) {
  const slice = sample.slice(c * size, (c + 1) * size).map(compact);
  if (!slice.length) break;
  writeFileSync(`web/src/data/_disc/chunk-${c}.json`, JSON.stringify(slice, null, 0));
  written++;
}
console.log(`discovery sample: ${sample.length} agents (${nCap} with skills) -> ${written} chunk files in web/src/data/_disc/`);
