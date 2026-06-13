// Single data-access point for the dashboard.
// Stage 1: import the static JSON snapshot produced by scripts/export-metrics.sh.
// Stage 2 (later): swap this module to read Firestore — the shape stays identical,
// so nothing downstream changes.
import data from "@/data/metrics.json";

export interface Summary {
  agents: number;
  unique_owners: number;
  empty_metadata: number;
  onchain_cards: number;
  x402_payable: number;
  top1_owner_pct: number;
  top10_owner_pct: number;
}
export interface GrowthPoint {
  day: string;
  new_agents: number;
}
export interface OwnerRow {
  owner: string;
  agents: number;
  pct: number;
}
export interface UriType {
  type: string;
  agents: number;
}
export interface X402 {
  supported: number;
  unsupported: number;
  unknown: number;
}
export interface RepRow {
  agent_id: number;
  feedback_count: number;
  unique_clients: number;
  avg_score: number;
}
export interface Metrics {
  generated_at: string;
  network: string;
  source: string;
  summary: Summary;
  growth_daily: GrowthPoint[];
  top_owners: OwnerRow[];
  uri_types: UriType[];
  x402: X402;
  reputation_top: RepRow[];
}

export const metrics = data as Metrics;

// Derived helpers
export function cumulativeGrowth(points: GrowthPoint[]) {
  let total = 0;
  return points.map((p) => {
    total += p.new_agents;
    return { day: p.day, total, new_agents: p.new_agents };
  });
}

export function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export function pct(n: number) {
  return `${n.toFixed(1)}%`;
}
