#!/usr/bin/env node
// Build the committed collectibles gallery the /collectibles page reads.
// The collectible TIER of the taxonomy is fundamentally different from the
// service tier: it isn't a list of distinct services, it's a handful of
// mass-minted NFT *collections* where every token is ALSO a live ERC-8004
// agent. Showing 1,268 near-identical rows (FREAK #1, FREAK #2, …) is noise;
// the signal is the *collection* — its mechanic, its one shared skill set, and
// its trait breakdown (FREAK factions / Normie personas). So this groups the
// collectible-tier agents into collections and emits one rich card each.
//
//   node scripts/build-collectibles.mjs   # writes web/src/data/collectibles.json
//
// Reads:  enrichment.json (tier via category), enrich-input.json (name/descr/
//         services[]/kind), skills.json (live A2A skills + reachability),
//         agents.json (x402, reg date), taxonomy.json (tier per category)
// Writes: web/src/data/collectibles.json  (committed, bundled by the app)
import { readFileSync, writeFileSync } from "node:fs";

const D = "web/src/data";
const J = (f) => JSON.parse(readFileSync(`${D}/${f}`, "utf8"));
const enrich = J("enrichment.json");
const input = J("enrich-input.json");
const skills = J("skills.json");
const agentsDoc = J("agents.json");
const tax = J("taxonomy.json");

const collKeys = new Set(tax.categories.filter((c) => c.tier === "collectible").map((c) => c.key));
const inputById = new Map((input.agents || input).map((a) => [a.id, a]));
const skillsById = new Map((skills.agents || skills).map((s) => [s.id, s]));
const ax = new Map(agentsDoc.agents.map((a) => [a.id, a]));

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return (url || "").replace(/^https?:\/\//, "").split("/")[0] || null;
  }
};
const isTrue = (v) => String(v).toLowerCase() === "true";

// Which collection an agent belongs to. Primary signal is the serving host
// (every member of a collection shares one), name is the fallback.
function collectionOf(inp) {
  const host = hostOf((inp.services || [])[0]?.endpoint || "");
  const name = inp.name || "";
  if (host === "freaks.one" || host === "api.freaks.one" || /^freak/i.test(name)) return "freak";
  if (host === "api.normies.art" || host === "normies.art" || /^normie/i.test(name)) return "normie";
  return null; // experimental long tail
}

// Per-collection editorial: the stuff that's true of the whole collection, not
// derivable cheaply per-agent. Kept here so the card can lead with the mechanic.
const MECHANIC = {
  freak: {
    name: "FREAK",
    declared_size: 10000,
    site: "https://freaks.one",
    blurb:
      "A 10,000-agent NFT collection where every FREAK is an autonomous on-chain entity with its own smart wallet — an ERC-6551 token-bound account — and a verifiable ERC-8004 identity. Each is the same market-reading toolkit; they differ by faction and by what their TBA holds.",
    mechanic: "ERC-6551 token-bound account · shared 4-skill toolkit · faction traits",
    trait_label: "Faction",
  },
  normie: {
    name: "Normie",
    declared_size: 10000,
    site: "https://normies.art",
    blurb:
      "A 10,000-strong PFP collection — “small humans pinned to immutable state.” Each Normie is a collectible agent whose only capability is staying in character: in-persona roleplay conversation. No market reads, no execution — pure persona.",
    mechanic: "1 skill each · in-character persona chat · one persona per token",
    trait_label: "Persona",
    // Each Normie's lone skill is "Converse with <its persona>" — naming any one
    // member's persona as "shared" would be wrong, so describe the template.
    shared_skills: [
      {
        name: "In-character persona chat",
        desc: "Roleplay conversation as the token's own named persona — the only capability each Normie exposes.",
      },
    ],
  },
};

// Bucket collectible-tier agents into collections.
const buckets = new Map(); // key -> array of agent records
for (const c of enrich.agents) {
  if (!collKeys.has(c.category)) continue;
  const inp = inputById.get(c.id) || {};
  const key = collectionOf(inp);
  const sk = skillsById.get(c.id) || {};
  const rec = {
    id: c.id,
    name: inp.name || null,
    kind: inp.kind || null,
    host: hostOf((inp.services || [])[0]?.endpoint || ""),
    descr: inp.descr || "",
    summary: c.summary || null,
    reachable: !!sk.reachable,
    a2a_skills: sk.a2a_skills || [],
    x402: isTrue((ax.get(c.id) || {}).x402),
    reg: (ax.get(c.id) || {}).reg || null,
    bucket: key,
  };
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(rec);
}

// Extract a member's trait: FREAK faction from "A HELLFIRE-faction FREAK…",
// Normie persona from "Normie #93 - Mina" -> "Mina".
function traitOf(key, rec) {
  if (key === "freak") {
    const m = rec.descr.match(/A ([A-Z]+)-faction/);
    return m ? m[1] : null;
  }
  if (key === "normie") {
    const m = (rec.name || "").match(/-\s*([A-Za-z]+)\s*$/);
    return m ? m[1] : null;
  }
  return null;
}

// The 4 skills a FREAK shares / the 1 a Normie shares — pull from the richest
// member so the card can show the actual capability surface, not just a count.
function sharedSkills(recs) {
  const best = recs
    .filter((r) => r.a2a_skills.length)
    .sort((a, b) => b.a2a_skills.length - a.a2a_skills.length)[0];
  if (!best) return [];
  return best.a2a_skills.slice(0, 6).map((s) => ({
    name: s.name || "",
    desc: (s.desc || "").slice(0, 220),
  }));
}

function members(recs, key) {
  return recs
    .map((r) => ({ id: r.id, name: r.name, trait: traitOf(key, r), reachable: r.reachable }))
    .sort((a, b) => Number(b.reachable) - Number(a.reachable) || (a.name || "").localeCompare(b.name || ""));
}

function traitBreakdown(recs, key) {
  const counts = new Map();
  for (const r of recs) {
    const t = traitOf(key, r);
    if (!t) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

const collections = [];
for (const key of ["freak", "normie"]) {
  const recs = buckets.get(key) || [];
  if (!recs.length) continue;
  const meta = MECHANIC[key];
  const traits = traitBreakdown(recs, key);
  collections.push({
    key,
    name: meta.name,
    host: recs.find((r) => r.host)?.host || null,
    kind: recs[0]?.kind || null,
    indexed: recs.length,
    declared_size: meta.declared_size,
    reachable: recs.filter((r) => r.reachable).length,
    x402: recs.filter((r) => r.x402).length,
    blurb: meta.blurb,
    mechanic: meta.mechanic,
    site: meta.site || null, // canonical external site for the collection
    opensea: meta.opensea || null, // OpenSea collection page, if known
    trait_label: meta.trait_label,
    trait_count: traits.length,
    traits, // full breakdown (FREAK: 18 factions; Normie: per-token personas)
    shared_skills: meta.shared_skills || sharedSkills(recs),
    members: members(recs, key),
  });
}

// Experimental long tail — small one-off / multi-role collections (DePunks,
// BasedClaws, MechaClaw, …). Group as one card, list the distinct collections.
const tail = buckets.get(null) || [];
if (tail.length) {
  // Group a one-off into its collection: drop a trailing role/seat/number
  // ("DePunks PROOF", "DePunks BACKER · SEAT 01" -> "DePunks") but keep genuine
  // multi-word names ("High Sea Cowboy").
  const baseOf = (n) => {
    if (!n) return "(unnamed)";
    let s = n.replace(/\s*[·#].*$/, ""); // cut at a · or # separator
    s = s.replace(/\s+[A-Z]{2,}$/, ""); // drop a trailing ALL-CAPS role word
    return s.trim() || n.trim();
  };
  const sub = new Map();
  for (const r of tail) {
    const b = baseOf(r.name);
    if (!sub.has(b)) sub.set(b, []);
    sub.get(b).push(r);
  }
  const subs = [...sub.entries()]
    .map(([name, recs]) => ({
      name,
      indexed: recs.length,
      reachable: recs.filter((r) => r.reachable).length,
      host: recs.find((r) => r.host)?.host || null,
      summary: recs.find((r) => r.summary)?.summary || null,
    }))
    .sort((a, b) => b.indexed - a.indexed);
  collections.push({
    key: "experimental",
    name: "Experimental & one-off",
    host: null,
    kind: null,
    indexed: tail.length,
    declared_size: null,
    reachable: tail.filter((r) => r.reachable).length,
    x402: tail.filter((r) => r.x402).length,
    blurb:
      "Small, early collections testing the same idea at hobby scale — multi-role agent sets, agent-only mints, and one-offs. Not mass-minted; included so the long tail is visible.",
    mechanic: `${subs.length} distinct collections`,
    site: null,
    opensea: null,
    trait_label: "Collection",
    trait_count: subs.length,
    traits: subs.map((s) => ({ name: s.name, count: s.indexed })),
    shared_skills: [],
    subcollections: subs,
    members: members(tail, null),
  });
}

// Cumulative registrations per collection over time — feeds the home-page
// "How the collectibles mix grew" chart (same shape as the service version:
// {categories:[{key,label}], series:[{date, freak, normie, experimental}]}).
const GROWTH_CATS = [
  { key: "freak", label: "FREAK" },
  { key: "normie", label: "Normie" },
  { key: "experimental", label: "Experimental & one-off" },
];
const incr = new Map(); // date -> {freak, normie, experimental}
for (const [bkey, recs] of buckets) {
  const k = bkey === null ? "experimental" : bkey;
  for (const r of recs) {
    if (!r.reg) continue;
    const d = r.reg.slice(0, 10);
    if (!incr.has(d)) incr.set(d, { freak: 0, normie: 0, experimental: 0 });
    incr.get(d)[k]++;
  }
}
const cum = { freak: 0, normie: 0, experimental: 0 };
const growthSeries = [...incr.keys()]
  .sort()
  .map((d) => {
    const i = incr.get(d);
    cum.freak += i.freak;
    cum.normie += i.normie;
    cum.experimental += i.experimental;
    return { date: d, freak: cum.freak, normie: cum.normie, experimental: cum.experimental };
  });

const total = collections.reduce((n, c) => n + c.indexed, 0);
const out = {
  generated_at: enrich.generated_at,
  network: "ethereum-mainnet",
  // ERC-8004 Identity registry — each agent is token #id here, so the UI can
  // deep-link a member to its NFT on a block explorer.
  registry: "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432",
  total,
  reachable: collections.reduce((n, c) => n + c.reachable, 0),
  collections,
  collection_growth: { categories: GROWTH_CATS, series: growthSeries },
};
writeFileSync(`${D}/collectibles.json`, JSON.stringify(out));
console.log(
  `collectibles.json: ${total} agents across ${collections.length} collections · ${out.reachable} reachable\n` +
    collections.map((c) => `  ${c.name}: ${c.indexed} indexed, ${c.reachable} reachable, ${c.trait_count} ${c.trait_label.toLowerCase()}s`).join("\n")
);
