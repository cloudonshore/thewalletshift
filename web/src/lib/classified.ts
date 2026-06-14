// LLM-classified analytics for the CALLABLE agent set (agents that expose a real
// a2a / mcp / web service). Built by the classification pipeline:
//   export-onchain-callable.sh + fetch-cards.mjs -> build-enrich-input.mjs ->
//   fetch-skills.mjs (A2A skills / MCP tools) -> build-corpus.mjs ->
//   taxonomy-discovery workflow -> classify-agents workflow ->
//   build-classified.mjs -> classified.json (committed, bundled here).
//
// `tier` separates the real-service agents from the mass-minted NFT collectibles
// (two collections dominate the callable set) and placeholder/spam — so the
// headline charts can feature services and de-emphasize the templated long tail.
import classifiedJson from "@/data/classified.json";
import taxonomyJson from "@/data/taxonomy.json";

export type Tier = "service" | "collectible" | "spam";

export interface AgentExample {
  id: number;
  name: string | null;
  summary: string | null;
  protos: string[];
}
export interface CategoryStat {
  key: string;
  label: string;
  tier: Tier;
  count: number;
  with_skills: number;
  a2a: number;
  mcp: number;
  web: number;
  x402: number;
  examples: AgentExample[];
}
export interface GrowthPoint {
  date: string;
  total: number; // all registered agents (cumulative)
  callable: number; // expose a callable service
  service: number; // real-service tier (excludes collectibles + spam)
}
export interface CategoryGrowth {
  categories: { key: string; label: string }[];
  series: Record<string, number | string>[]; // each row: { date, [categoryKey]: cumulativeCount }
}
export interface Classified {
  generated_at: string;
  network: string;
  total_agents: number;
  classified: number;
  tiers: Record<Tier, number>;
  x402: { service: number; callable: number };
  categories: CategoryStat[];
  top_tags: { tag: string; count: number }[];
  growth: GrowthPoint[];
  category_growth: CategoryGrowth;
}
export interface TaxonomyCategory {
  key: string;
  label: string;
  definition: string;
  tier: Tier;
}
export interface Taxonomy {
  version: number;
  generated_at: string;
  count: number;
  tiers: Record<Tier, number>;
  categories: TaxonomyCategory[];
  notes: string;
}

export const classified = classifiedJson as Classified;
export const taxonomy = taxonomyJson as Taxonomy;

export const defById = new Map(taxonomy.categories.map((c) => [c.key, c]));
export const serviceCategories = classified.categories
  .filter((c) => c.tier === "service")
  .sort((a, b) => b.count - a.count);

// counts
export const callableTotal = classified.classified;
export const serviceTotal = classified.tiers.service;
export const collectibleTotal = classified.tiers.collectible;
export const spamTotal = classified.tiers.spam;
export const x402Service = classified.x402.service;

export const pct1 = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");
export const fmt = (n: number) => n.toLocaleString("en-US");
