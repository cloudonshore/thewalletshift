// GET /api/ens?name=<ens-name>&address=<agent-owner> — live, on-chain ENS
// verification for an ERC-8004 agent. Resolves the claimed name on Ethereum
// mainnet at request time (no hard-coded values) and grades it against the
// agent's owner address. Agent-facing, CORS-enabled, documented at /SKILL.md.
//
//   name     required — the ENS name the agent claims (e.g. keeperhub.eth)
//   address  optional — the agent's on-chain owner; enables owner_match grading
import { resolveEns } from "@/lib/ens";
import { apiJson, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const name = sp.get("name")?.trim();
  const address = sp.get("address")?.trim() || null;

  if (!name) {
    return apiJson({ error: "missing required ?name=<ens-name>" }, { status: 400 });
  }

  const result = await resolveEns(name, address);
  // resolutions are stable for a while — cache harder than the static directory
  return apiJson(result, { headers: { "cache-control": "public, max-age=600, s-maxage=3600" } });
}
