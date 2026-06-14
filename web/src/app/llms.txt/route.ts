// GET /llms.txt — the well-known machine-readable index (llms.txt convention)
// that points LLMs / agents / crawlers at the agent skill and the callable API,
// alongside the human pages. Counts injected live from the bundled directory.
import { services } from "@/lib/services";
import { baseUrl, CORS } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const base = baseUrl(request);
  const txt = `# The Wallet Shift

> DeFiLlama for the on-chain AI agent economy. Live ERC-8004 analytics on Ethereum
> mainnet, plus a callable directory of the ${services.total} agents that expose a real,
> callable service (A2A / MCP / web), so an AI agent can discover and reach other agents.

## For agents
- [Agent skill](${base}/SKILL.md): start here — how to search the directory and call a service.
- [Search API](${base}/api/services/search): GET q, category, proto (a2a|mcp|web), x402, limit, offset → JSON.
- [Service detail API](${base}/api/services/22838): GET /api/services/{id} → full record, endpoints, live skills, how-to-call.

## Pages
- [Dashboard](${base}/): the on-chain agent-economy scoreboard.
- [Services directory](${base}/services): browse the ${services.total} real, callable services (${services.x402} x402-payable).
- [Collectibles](${base}/collectibles): mass-minted NFT-collection agents (FREAK, Normie, …), excluded from the services directory.

## Notes
- Scope: Ethereum mainnet only. Source: ERC-8004 Identity registry 0x8004a169…, decoded via BigQuery.
- Directory generated ${services.generated_at}.
`;

  return new Response(txt, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
      ...CORS,
    },
  });
}
