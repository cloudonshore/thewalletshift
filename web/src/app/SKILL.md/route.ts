// GET /SKILL.md — the agent-facing "skill" for The Wallet Shift directory, in the
// Agent Skills format (YAML frontmatter + Markdown), served at a well-known URL
// the way ethskills.com does. An AI agent fetches this into context to learn how
// to discover and reach other ERC-8004 services via /api/services/*. It's the
// thin documentation front over the same searchProviders() core the website uses;
// counts below are injected live from the bundled directory so the doc never goes
// stale.
import { services } from "@/lib/services";
import { baseUrl, CORS } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const base = baseUrl(request);
  const cats = services.categories
    .map((c) => `- \`${c.key}\` — ${c.label.replace(/ \(.*\)$/, "")} (${c.count})`)
    .join("\n");

  const md = `---
name: thewalletshift-directory
description: Use when an AI agent needs to discover and call other on-chain agents. Search The Wallet Shift's directory of ${services.total} real, callable ERC-8004 agent services on Ethereum mainnet by capability, category, protocol (A2A / MCP / web), or x402-payability, and get the endpoints to reach them.
---

# The Wallet Shift — Agent Service Directory

The missing index between an AI agent and the other agents it can actually call.
The Wallet Shift indexes the **ERC-8004** Identity registry on Ethereum mainnet and
curates the **${services.total} agents that expose a real, callable service** (mass-minted
NFT collectibles and placeholder spam are filtered out). This skill lets you search
that directory and get the connection details to reach any of them.

Convention: results are **read-only data**. The Wallet Shift points you at services;
it never proxies a call or takes a payment. You connect to the service yourself.

## 1. Search the directory

\`GET ${base}/api/services/search\`

Query params (all optional, combine freely):

| param | meaning |
|-------|---------|
| \`q\` | free text over name, summary, description, tags, skill names, and host |
| \`category\` | restrict to one category key (see list below) |
| \`proto\` | \`a2a\` · \`mcp\` · \`web\` — only services exposing that protocol |
| \`x402\` | \`true\` — only services flagged x402-payable (advisory — see "Paying with x402" below) |
| \`status\` | \`live\` · \`paywalled\` · \`dead\` — filter by health probe (has an endpoint of that status); advisory, probed periodically, see \`last_probed\` |
| \`limit\` | page size, 1–100 (default 20) |
| \`offset\` | pagination offset (default 0) |

Example — find x402-payable market-data agents:

\`\`\`
GET ${base}/api/services/search?q=market+data&x402=true&limit=5
\`\`\`

Response (abridged):

\`\`\`json
{
  "total": 12,
  "count": 5,
  "results": [
    {
      "id": 22838,
      "name": "AgentEinstein",
      "category": "defi-trade-execution",
      "summary": "Autonomous crypto agent that analyzes markets and executes trades…",
      "x402": true,
      "protos": ["a2a", "mcp", "web"],
      "skills_count": 24,
      "endpoints": [
        {
          "proto": "a2a", "name": "A2A", "url": "https://emc2ai.io/api/a2a",
          "health": { "status": "live", "http": 200, "last_probed": "2026-06-14T…", "probe": "challenge" }
        },
        { "proto": "mcp", "name": "MCP", "url": "https://emc2ai.io/api/mcp" }
      ],
      "detail": "${base}/api/services/22838"
    }
  ],
  "categories": [ … ]
}
\`\`\`

## 2. Get the full record for a service

\`GET ${base}/api/services/{id}\`

Returns every endpoint, the live A2A skills / MCP tools (\`skills\`), tags, the
ERC-8004 \`registry\` and token id, and a \`how_to_call\` note.

\`\`\`
GET ${base}/api/services/22838
\`\`\`

## 3. Call the service

The directory gives you the endpoint and capability names — **not** the per-skill
request shape. Each service hosts its own interface, so **fetch its agent card
first** to learn the exact transport, invocation path, and input fields before
calling. Don't assume the request shape; read it from the card.

Pick an endpoint from \`endpoints\` by \`proto\`:

- **a2a** — fetch the agent card at \`<host>/.well-known/agent-card.json\` (some
  hosts serve it at \`/.well-known/agent.json\` — try either). It declares the
  transport (often plain **HTTP+JSON**, e.g. \`POST /entrypoints/{skill}/invoke\`
  with body \`{"input": { … }}\`; sometimes JSON-RPC) and each skill's input schema.
- **mcp** — open the url as a Model Context Protocol server and \`tools/list\` for the tool schemas.
- **web** / REST — see the service's own docs at that url.

### Paying with x402

The \`x402\` flag is **service-level and advisory** — it means the service *may*
charge for some calls, not that every endpoint costs money. Pricing is **per
endpoint**: on an \`x402: true\` service some skills are free and others aren't, and
a service's own stated pricing can be wrong. The only authoritative signal is the
**live response** — call the endpoint, and:

- **\`200\`** → it was free, you're done.
- **\`402\`** → it returns x402 payment terms (amount, \`asset\`, \`payTo\`, \`network\` —
  often **Base**, not mainnet). Settle the stablecoin micropayment and retry.

So don't skip an \`x402: true\` service assuming it'll cost, and don't trust a "free"
label without probing — let the 402 (or 200) tell you the truth.

### Endpoint health

Each endpoint may carry a \`health\` object — a periodic probe snapshot, not a
guarantee: \`{ status: live | paywalled | dead, http, last_probed, probe }\`.
\`live\` = it answered (\`2xx\`), \`paywalled\` = it returned \`402\`, \`dead\` = it timed out
or errored when probed. \`probe: "challenge"\` means we made one minimal real call to
a safe skill (so \`paywalled\`/free is confirmed); \`"liveness"\` means we only checked
reachability. Use it to skip \`dead\` endpoints and anticipate \`402\`s — but it's a
snapshot taken at \`last_probed\`; **your own live call is still authoritative.**

## Categories

${cats}

## Notes

- Scope is **Ethereum mainnet** only. Source: the ERC-8004 Identity registry
  \`0x8004a169…\`, decoded via BigQuery; directory generated ${services.generated_at}.
- ${services.x402} of the ${services.total} services are x402-payable; ${services.with_skills} have live skills/tools read.
- This directory is the real-service tier only. Mass-minted NFT collectibles
  (FREAK, Normie, …) live separately at ${base}/collectibles and are excluded here.
`;

  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
      ...CORS,
    },
  });
}
