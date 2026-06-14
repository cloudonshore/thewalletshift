// The browsable services directory: the real-SERVICE-tier ERC-8004 agents (711)
// with their callable endpoints and live A2A skills / MCP tools. Built statically
// by scripts/build-services-directory.mjs -> services.json (committed, bundled).
// Collectibles + spam are excluded by design — this is the "what can I actually
// call and pay" surface, not the templated long tail.
import servicesJson from "@/data/services.json";

export type Proto = "a2a" | "mcp" | "web";

export type HealthStatus = "live" | "paywalled" | "dead";
export interface EndpointHealth {
  status: HealthStatus;
  http: number | null;
  last_probed: string;
  probe: "liveness" | "challenge";
}
export interface Endpoint {
  proto: string | null;
  name: string;
  url: string;
  host: string | null;
  health?: EndpointHealth;
}
export interface Skill {
  name: string;
  desc: string;
  tags: string[];
}
export interface Provider {
  id: number;
  name: string | null;
  kind: string | null; // onchain | offchain (where the card is hosted)
  category: string;
  label: string;
  summary: string | null;
  descr: string | null;
  tags: string[];
  protos: string[];
  x402: boolean;
  ens: string | null;
  reg: string | null;
  endpoints: Endpoint[];
  skills: Skill[];
}
export interface ServiceCategory {
  key: string;
  label: string;
  definition: string;
  count: number;
}
export interface ServicesDoc {
  generated_at: string;
  network: string;
  total: number;
  with_skills: number;
  x402: number;
  last_probed: string | null;
  health: { live: number; paywalled: number; dead: number } | null;
  protos: { a2a: number; mcp: number; web: number };
  categories: ServiceCategory[];
  providers: Provider[];
}

export const services = servicesJson as ServicesDoc;
export const fmt = (n: number) => n.toLocaleString("en-US");
