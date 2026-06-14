// Single data-access point for the dashboard. See docs/ARCHITECTURE.md.
//
// At runtime on Firebase App Hosting (Cloud Run) we read the latest snapshot from
// gs://thewalletshift-data/metrics.json — authenticated with the backend's service
// account via the GCE metadata server, no public bucket. The page is statically
// generated and refreshed by ISR (`export const revalidate` in page.tsx), so the
// expensive read happens once per refresh, not per visitor.
//
// The JSON bundled in the repo is the offline/build fallback: local `next dev`,
// and any runtime where the live read fails, transparently use it. Same shape, so
// nothing downstream changes — and the pipeline only ever rewrites the GCS object.
import bundled from "@/data/metrics.json";

const BUCKET = "thewalletshift-data";
const OBJECT = "metrics.json";
export const REVALIDATE_SECONDS = 21600; // 6h — matches the daily-ish pipeline

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

// Build-time / offline fallback. Always present, so the dashboard never 500s.
export const metrics = bundled as Metrics;

// Read the live snapshot from GCS, authenticated via the metadata server.
// Returns null on any failure (e.g. local dev, where there is no metadata server)
// so callers fall back to the bundled snapshot. Both fetches opt into Next's data
// cache via `next.revalidate` so the route stays statically generated (ISR) —
// never `no-store`, which would force dynamic rendering on every request.
async function fetchLiveMetrics(): Promise<Metrics | null> {
  try {
    const tokenRes = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(1500),
        next: { revalidate: 3000 }, // < 1h token lifetime; refreshed each regeneration
      },
    );
    if (!tokenRes.ok) return null;
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const res = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(OBJECT)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as Metrics;
  } catch {
    return null; // metadata server unreachable (local dev), timeout, or bad payload
  }
}

// The dashboard's data entry point. Live snapshot when available, bundled otherwise.
export async function getMetrics(): Promise<Metrics> {
  return (await fetchLiveMetrics()) ?? metrics;
}

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
