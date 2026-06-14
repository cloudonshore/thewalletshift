// GET /api/services/{id} — the full record for one service agent: every endpoint,
// the live A2A skills / MCP tools, tags, and how to actually reach it. Returned to
// agents that picked a candidate from /api/services/search. Documented at /SKILL.md.
import { getProvider } from "@/lib/directory-search";
import { apiJson, baseUrl, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

// ERC-8004 Identity registry (Ethereum mainnet) — every service agent is one
// token in this single ERC-721 contract.
const REGISTRY = "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432";

const HOW_TO_CALL =
  "Connect directly to one of `endpoints`. A2A: POST JSON-RPC to the a2a url (fetch <a2a-host>/.well-known/agent-card.json for its skill schema). MCP: open the mcp url as a Model Context Protocol server. web/REST: see the service's own docs at that url. If `x402` is true, the endpoint may answer HTTP 402 with x402 payment terms — settle the stablecoin micropayment and retry. The Wallet Shift only indexes and points; it does not proxy calls or take payment.";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const p = Number.isInteger(numId) ? getProvider(numId) : null;

  if (!p) {
    return apiJson(
      { error: "not_found", message: `No callable service agent #${id} in the directory.` },
      { status: 404 },
    );
  }

  const base = baseUrl(request);
  return apiJson({
    ...p,
    registry: REGISTRY,
    network: "ethereum-mainnet",
    how_to_call: HOW_TO_CALL,
    search: `${base}/api/services/search`,
    docs: `${base}/SKILL.md`,
  });
}
