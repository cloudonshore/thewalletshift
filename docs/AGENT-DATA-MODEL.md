# Agent data model — what's in the registry and how we read it

Everything we know about an agent comes from decoding the ERC-8004 registry logs
(`thewalletshift.erc8004.logs_2026`, free). This is the reference for *what* the
data is, *where* each field lives, and the caveats. Companion: `CLAUDE.md`
(BigQuery facts, event-signature map) and `docs/ARCHITECTURE.md` (serving).

## Two stores per agent — do NOT conflate them

An agent's information lives in **two completely separate places**:

### Store A — the `agentURI` (the "Agent Card")
- **One string per agent.** Set at `register(agentURI)`; changed later via
  `URIUpdated` (only 1,365 agents did). ERC-4906 `MetadataUpdate` fires whenever
  it's set to a non-empty value.
- The string is one of: **inline** (`data:application/json;base64,<card>`), an
  **off-chain link** (`https:` / `ipfs:`), or **empty**.
  - Distribution: **52% empty**, ~27.5% on-chain (`data:base64`, ~9,520), 11.6%
    `https`, ~643 `ipfs`.
- **`kind` is DERIVED by us** from the URI prefix (onchain/https/ipfs/http/empty/
  other). It is not an on-chain field.
- **Card JSON schema** (when the card is present/fetchable):
  `{ type, name, description, image, services:[{name, endpoint, type?}], active, x402Support, supportedTrust:[…], … }`
  - ⚠️ **The callable-interface key is `services`, NOT `endpoints`.** (An older
    handful of cards use `endpoints`; accept either, prefer `services`.) Each entry
    is `{name, endpoint, type?}` — e.g. `name:"A2A"`, `name:"web"`, `name:"MCP"`.
    This is the **"how do I actually call this agent"** data. On-chain only 224
    cards have a non-empty `services`; the rest of the interactable agents host
    their card off-chain (see the fetch pipeline below).
  - **ENS** = a `services`/`endpoints` entry named `ens`, **or** an ENS `binding`
    (`binding:{type:"ens", name:"…"}`, used by ens8004.xyz). **Self-declared, NOT
    verified** against the ENS registry. An agent can claim any name.
  - **x402 capability** = the `x402Support` boolean.
  - `type` is the card's **schema URI** (e.g. `…/eip-8004#registration-v1`), a
    compliance/version signal — different from our derived `kind`.

### Store B — the on-chain metadata map (`MetadataSet` event)
- `mapping(agentId => key => bytes)` in contract storage. Written via
  `setMetadata(agentId, key, value)` and the `register(uri, metadata[])` overload.
  Every write emits a `MetadataSet`.
- **`agentWallet` is a reserved key, auto-set on every registration** to
  `msg.sender`. 50,886 sets across 34,556 agents → ~16k agents later changed their
  operating wallet (via a signed `AgentWalletSet`).
- Observed keys (count): `agentWallet` 50,886 · `agent-binding` 1,470 ·
  `serviceRegistry`/`ecosystem`/`serviceId` 58 each · `version` 40 · `platform` 36
  · `category` 29 · `tags` 28 · `ensName` 9 · `mandate` 9 · `meshAgentId` 8 ·
  `description` 8 · `name` 5 · `capabilities` 5 · `twitter`/`x402`/`website` ~3–4.
- This store is **machine-readable / contract-queryable** (that's why `agentWallet`
  lives here); the card (Store A) is the human-facing, off-chain-capable profile.

## The three "who controls this agent?" addresses — they differ

1. **Registration owner** — `Registered.owner` (msg.sender at mint). What the
   dashboard's "operator concentration" stat currently uses.
2. **Current NFT owner** — latest `Transfer.to` for the token. What `/agents` uses.
3. **agentWallet** — the on-chain operating wallet (Store B).

At mint all three are equal. They diverge: **37% of agents have current owner ≠
agentWallet** — almost all because the NFT was transferred (transfer doesn't touch
`agentWallet`); ~1,545 because the wallet was updated independently.

⚠️ **The "top owner owns 28.8%" headline is misleading.** That address —
`0xd5d6d96fa23455ec5e3c00633f85f364d3f5a291` — is a **mint-factory contract**: it
minted **9,967 agents (28.8%) to itself and distributed every one**; it holds ~0
now. **Concentration should be computed from CURRENT owner, not registration
owner.** (Dashboard `metrics.json` still uses registration owner — known fix.)

## Transfers & marketplace — is this speculatively traded?
- 49,305 `Transfer`s = 34,556 mints + **14,749 secondary**. Secondary movement is
  concentrated: 268 senders, 1,158 from→to pairs → mostly **batch distribution**.
- By tx router (≈1,618 secondary txns): factory `0xd5d6d96f` **709 (44%)** ·
  **Seaport 1.6 / OpenSea `0x000…1123eb395` 361 (22%) = real marketplace sales** ·
  registry direct `transferFrom` 188 (12%) · unknown `0x671cf6…` 267.
- **236 owners** approved the OpenSea Seaport conduit
  `0x1e0049783f008a0085193e00003d00cd54003c71` (`ApprovalForAll`) — listing
  capability. Senders ∩ approvers overlap heavily → a tight **~335-wallet cohort**
  both moves and lists; the factory sits outside it.
- **TODO to size the real market:** pull Seaport sale prices (payment legs in those
  361 txns) — answers "dust vs real money" and at what valuations.

## Field provenance in `/agents` (raw vs decoded vs derived)
- **Raw from events:** `id`, `registered` (`Registered`); `owner` = current
  (latest `Transfer`).
- **Raw card field:** `uri` (the `agentURI` from `Registered`).
- **Decoded from the card JSON:** `name`, `description`, `x402`, `ens`.
- **Derived by us:** `kind` (URI prefix).
- **Caveats:** card fields are **registration-time** (URI changes by the 1,365
  `URIUpdated` agents are not reflected); **ENS is self-declared, not verified**.

## Card indexing — BUILT (on-chain in SQL + off-chain fetch pipeline)
Coverage of all 34,556 agents: **onchain 9,520 · offchain 4,662 (fetchable
https/ipfs links) · other 2,325 (gzip-data / bare-text / malformed junk) · empty
18,049**. Two indexing paths, both implemented:
- **On-chain cards** (`data:base64`, 9,520): full card is in the log →
  **decoded in SQL on `logs_2026` for FREE**. `scripts/export-cards.sh` →
  `web/src/data/cards.json` (bundled aggregates); per-agent fields also baked into
  `agents.json` by `export-agents.sh`.
- **Off-chain cards** (`https`/`ipfs`, 4,662): URI is just a **link** — content is
  NOT on-chain, and **BigQuery cannot fetch it (no network egress).** Pipeline:
  `export-offchain-uris.sh` (BQ extracts the URL worklist) → `fetch-cards.mjs`
  (Node HTTP GETs each, parses, host-interleaved + SSRF-safe + `--retry-failed`
  for rate-limited hosts) → `merge-cards.mjs` (folds fields into `agents.json`,
  adds combined interactability + reachability to `cards.json`). Runs **locally
  today**; promote to a Cloud Run Job for scheduled refresh (Cloud Run *can*
  egress; BQ can't).
- **Reachability (2026-06-13 run):** of 4,662 links, **~2,012 returned a live card
  (43%)** after retry; the rest are dead (404/DNS), behind bot-protection (Vercel),
  rate-limited (persistent 429), or point at a homepage.
  - ⚠️ **`ag0.xyz` = 1,985 agents (43% of off-chain) all point at the bare homepage
    `https://ag0.xyz`** (no per-agent path) → unresolvable placeholder/spam. The
    single biggest "platform" is noise. Real rich cards: `api.normies.art` (1,171),
    `api.freaks.one` (267) — both expose A2A + web services.
- **Interactability (combined on-chain + off-chain):** **~2,158 agents expose a
  callable `services` interface** — A2A ~1,378 · web ~1,887 · MCP ~518 (overlap).
  This is the honest "agents you can actually call/pay," vs 34.5k raw registrations.
- **Empty** (52%): no card to index.

## Service classification — what each callable agent DOES (powers `/services`)
The honest "callable" set is **2,037 agents** (expose an a2a/mcp/web service; ens/did
bindings alone don't count). Pipeline (all scripts in `scripts/`, order in `CLAUDE.md`):
1. **Capture endpoints + full descriptions:** `export-onchain-callable.sh` (on-chain, SQL,
   free) + `fetch-cards.mjs` (off-chain, now retains service `endpoint` URLs + untruncated
   `descr_full`) → `build-enrich-input.mjs` unions them into the callable set.
2. **Second hop — real capabilities:** `fetch-skills.mjs` fetches each agent's A2A
   `/.well-known/agent-card.json` `skills[]` and best-effort MCP `initialize`+`tools/list`.
   **605 reachable** (583 A2A skill-lists, 31 MCP tool-lists — MCP is hard: session/SSE/auth).
   `build-corpus.mjs` folds skills into one `corpus.json` (`cap` field = "what it does").
3. **Taxonomy (emergent → approved):** a Workflow clusters a sample → a **16-category**
   taxonomy (`taxonomy.json`), each with a `tier`: **service / collectible / spam**.
4. **Classify:** a 41-subagent Workflow assigns every callable agent a `primary_category`,
   `tags[]`, and a 1-line `summary` → `enrichment.json`. `build-classified.mjs` aggregates
   to `classified.json` (counts, top tags, examples, cumulative growth series).
- **Headline finding:** of 2,037 callable, **711 are real services**; **1,268 are two
  mass-minted NFT collections** (FREAK = read-only NFT toolkit, Normie = persona-chat),
  **58 spam**. Even the service tier is concentrated — one platform, **Zyfai** (a per-user
  ZK-powered yield rebalancer, one agent minted per user wallet), is ~90% of
  `defi-yield-rebalancing` (**408 of 455**, each a distinct owner); Olas is only 13. The
  `tier` field lets the UI feature services and de-emphasize the templated collectibles.
- ⚠️ The LLM `summary`/`tags`/`category` are **model-generated** (not on-chain) — they're a
  best-effort read of each card's description + fetched skills, re-runnable but non-deterministic.

## SQL decoding cheatsheet (against `logs_2026`)
- **agentURI** (from `Registered`):
  `SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64))))`
- **on-chain card JSON:** strip `data:application/json;base64,` then `SAFE.FROM_BASE64`
  → `JSON_VALUE(j,'$.name')`, etc.; `JSON_QUERY_ARRAY(j,'$.endpoints')` for ENS.
- **current owner:** latest `Transfer.to` per token —
  `ROW_NUMBER() OVER (PARTITION BY topics[OFFSET(3)] ORDER BY block_timestamp DESC, log_index DESC)`.
- **MetadataSet key:** decode the `metadataKey` string from `data` (head offset `0x40`).
- Working examples: `scripts/export-agents.sh`, `scripts/export-explorer.sh`,
  `sql/erc8004_queries.sql`. Ad-hoc: `scripts/explore.sh '<SQL>'`.

## Key addresses
- **Mint factory:** `0xd5d6d96fa23455ec5e3c00633f85f364d3f5a291` (minted 9,967 =
  28.8%, distributed all, holds ~0). Etherscan navigation is blocked for the
  browser tool — open addresses manually.
- **OpenSea Seaport conduit:** `0x1e0049783f008a0085193e00003d00cd54003c71` ·
  **Seaport 1.6:** `0x0000000000000068f116a894984e2db1123eb395`.
- **Implementation contracts** (behind the proxies): Identity
  `0x7274e874ca62410a93bd8bf61c69d8045e399c02` · Reputation
  `0x16e0fa7f7c56b9a767e34b192b51f921be31da34`.
