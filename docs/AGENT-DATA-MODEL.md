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
  `{ type, name, description, image, endpoints:[{name, endpoint}], active, x402Support, … }`
  - **ENS** = an entry in `endpoints` where `name="ens"`. **Self-declared, NOT
    verified** against the ENS registry. An agent can claim any name.
  - **x402 capability** = the `x402Support` boolean.
  - `type` here is the card's self-description (e.g. "AgentCard") — different from
    our derived `kind`.

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

## Indexing ALL cards (the next task) — the key split
Aggregate card analytics splits by where the card lives:
- **On-chain cards** (`data:base64`, ~9,520): the full card is in the log → fully
  **decodable in SQL on `logs_2026` for FREE**. Aggregate any field (categories,
  skills, x402, ENS presence, `image`/`active` presence, name patterns…) directly.
- **Off-chain cards** (`https`/`ipfs`, ~4,600+): the URI is just a **link**; the
  content is NOT on-chain → must **fetch each URL** (a Cloud Run / Functions job),
  parse, then index. Not free, not in BigQuery, and some links will be dead.
- **Empty** (~52%): no card to index.
→ So phase 1 of card indexing = the on-chain subset (free, now); off-chain needs a
  separate fetch pipeline (decide if worth it).

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
