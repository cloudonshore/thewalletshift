// Data accessor for the /explore page — a human-readable snapshot of the raw
// logbook: the decoded event types and a sample of real agents.
// Produced by scripts/export-explorer.sh. Bundled for now (it's a static sample);
// can move to GCS like metrics.json later if we want it live.
import data from "@/data/explorer.json";

export interface EventType {
  name: string;
  plain: string;
  count: number;
}
export interface SampleAgent {
  agent_id: number;
  owner: string;
  registered: string;
  name: string;
  description: string;
  ens: string | null;
  x402: string | null;
}
export interface Explorer {
  generated_at: string;
  network: string;
  total_logs: number;
  event_types: EventType[];
  sample_agents: SampleAgent[];
}

export const explorer = data as Explorer;
