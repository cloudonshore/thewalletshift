#!/usr/bin/env node
// Fold the second-hop skills/tools into the callable set to produce the single
// CLASSIFICATION CORPUS — one compact record per agent with everything an LLM
// needs to say what it does: name, description, protos, and a `cap` string built
// from the A2A skills / MCP tools we fetched.
//
//   node scripts/build-corpus.mjs
//
// Reads:  enrich-input.json (build-enrich-input.mjs), skills.json (fetch-skills.mjs)
// Writes: web/src/data/corpus.json  {generated_at, count, with_skills, agents:[{id,kind,name,descr,protos,cap}]}
import { readFileSync, writeFileSync } from "node:fs";

const today = new Date().toISOString().slice(0, 10);
const enrich = JSON.parse(readFileSync("web/src/data/enrich-input.json", "utf8"));
const skills = JSON.parse(readFileSync("web/src/data/skills.json", "utf8"));
const skById = new Map(skills.agents.map((s) => [s.id, s]));

function capString(sk) {
  if (!sk) return null;
  const parts = [];
  if (sk.a2a_skills?.length) {
    parts.push(
      "Skills: " +
        sk.a2a_skills
          .map((s) => (s.desc ? `${s.name} (${s.desc})` : s.name))
          .filter(Boolean)
          .join("; ")
    );
  }
  if (sk.mcp_tools?.length) {
    parts.push(
      "Tools: " +
        sk.mcp_tools
          .map((t) => (t.desc ? `${t.name} (${t.desc})` : t.name))
          .filter(Boolean)
          .join("; ")
    );
  }
  if (!parts.length && sk.a2a_desc) parts.push(sk.a2a_desc);
  const s = parts.join(" | ");
  return s ? s.slice(0, 1400) : null;
}

let withSkills = 0;
const agents = enrich.agents.map((a) => {
  const cap = capString(skById.get(a.id));
  if (cap) withSkills++;
  return { id: a.id, kind: a.kind, name: a.name, descr: a.descr, protos: a.protos, cap };
});

writeFileSync(
  "web/src/data/corpus.json",
  JSON.stringify({ generated_at: today, count: agents.length, with_skills: withSkills, agents }, null, 0)
);
console.log(`corpus: ${agents.length} agents · ${withSkills} with fetched skills/tools -> web/src/data/corpus.json`);
