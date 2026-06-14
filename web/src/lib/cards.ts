// Agent Card analytics. Phase 1 indexes the on-chain (inline base64) cards, which
// decode for free in BigQuery (scripts/export-cards.sh). Off-chain https/ipfs cards
// are counted in `coverage` but their content isn't indexed yet — that needs the
// fetch pipeline (scripts/fetch-cards.mjs). cards.json is small and bundled in the
// repo (like explorer.json); both the dashboard and /cards import it directly.
import bundled from "@/data/cards.json";

export interface Coverage {
  agents: number;
  onchain_cards: number;
  offchain_cards: number;
  other_cards: number;
  empty: number;
  indexed: number;
  parseable: number;
}
export interface Completeness {
  name: number;
  description: number;
  image: number;
  services: number;
  trust: number;
  denominator: number;
}
export interface Interactivity {
  with_services: number;
  a2a: number;
  web: number;
  mcp: number;
  onchain?: { with_services: number; a2a: number; web: number; mcp: number; denominator: number };
  offchain?: {
    reachable: number;
    with_services: number;
    a2a: number;
    web: number;
    mcp: number;
    x402: number;
    active: number;
  };
}
export interface Reachability {
  fetched: number;
  ok: number;
  buckets: Record<string, number>;
}
export interface Tri {
  // x402 / active share the same present-true / present-false / undeclared shape
  [k: string]: number;
}
export interface Bucket {
  model?: string;
  bucket?: string;
  host?: string;
  n: number;
}
export interface Cards {
  generated_at: string;
  network: string;
  source: string;
  note: string;
  coverage: Coverage;
  completeness: Completeness;
  x402: { payable: number; not_payable: number; undeclared: number };
  active: { active: number; inactive: number; undeclared: number };
  trust: Bucket[];
  schema: Bucket[];
  image_hosting: Bucket[];
  interactivity?: Interactivity;
  reachability?: Reachability;
}

export const cards = bundled as Cards;

export const pct1 = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");
