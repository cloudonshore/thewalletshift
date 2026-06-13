# The Agent-Economy Protocol Stack — Data Reference for TheWalletShift

> Researched 2026-06-12 from primary sources (EIP pages, GitHub repos, block explorers, official docs). Every contract address below was reported as **verified on a block explorer by the researcher**, but addresses and adoption numbers move — **re-verify before indexing.** Adoption figures are point-in-time snapshots.

## TL;DR — what ships this weekend vs. what's roadmap

| Protocol | Layer | Deployed? | On Ethereum mainnet (BigQuery-able)? | Weekend role |
|---|---|---|---|---|
| **ERC-8004** Trustless Agents | Identity / Reputation / Validation | ✅ live since Jan 29 2026, ~20 chains | ✅ yes | **Core spine** — the canonical agent set |
| **ENS** | Naming / discoverability | ✅ | ✅ (resolution) | **Core** — human-readable identity layer |
| **ERC-8257** Agent Tool Registry | Tool discovery / access-control | ✅ live (early, "pre-beta") | ✅ yes (low volume) | **Nice-to-have panel** — "agent tools" |
| **x402** | Payments | ✅ (no dedicated contract) | ⚠️ capability-flag yes; settlement-volume no (Base, hard attribution) | **Capability flag** core; volume = roadmap |
| **ERC-8183** Agentic Commerce | Job escrow / settlement | ❌ draft, no contracts | ❌ | **Content / watchlist only** |

**The architectural decision this research forces:** Google BigQuery **does not host Base** (verified against docs dated 2026-06-11). It *does* host **Ethereum mainnet with decoded events**. ERC-8004 and ERC-8257 are both on Ethereum mainnet → both BigQuery-indexable. x402 settlement lives on Base → **not** BigQuery-indexable. Therefore the clean, GCP-prize-compliant weekend pipeline is:

> **BigQuery (`goog_blockchain_ethereum_mainnet_us.decoded_events`) for ERC-8004 + ERC-8257 events → ENS resolution of agent addresses → parse each agent's off-chain metadata for x402 capability flags → lightweight frontend (thewalletshift.com).**
>
> No Base dependency. Live x402 *volume* ("Agent GDP") becomes a roadmap panel sourced separately (Dune/RPC).

---

## 1. ERC-8004 — "Trustless Agents" (THE SPINE)

**What it is.** Standards-Track ERC, **status: Draft** (created 2025-08-13). Authors: **Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), Erik Reppel (Coinbase)**. Extends Google's A2A protocol with an on-chain trust layer. Three per-chain registries:
- **Identity** — ERC-721 + URIStorage; mints an `agentId` NFT resolving to an off-chain JSON registration ("Agent Card").
- **Reputation** — signed client feedback/ratings, on-chain indexed.
- **Validation** — independent validator checks (stake / zkML / TEE), scored 0–100. *Still under active revision in the repo.*

**Deployment.** Live; mainnet launch **Jan 29 2026** (Ethereum). Deterministic same-address deployment across ~20 mainnet chains (Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche, Celo, Gnosis, Linea, Scroll, Monad, …).

**Verified addresses (Etherscan; ERC-1967/UUPS proxies created Jan 29 2026 — re-verify per chain):**
- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- (Testnet variants differ; Validation Registry address still in flux — verify before indexing.)

**Key events to index:** `Registered(agentId, agentURI, owner)`, `URIUpdated`, `MetadataSet` (Identity); `NewFeedback(agentId, client, value, decimals, tags…)`, `FeedbackRevoked`, `ResponseAppended` (Reputation); `ValidationRequest`, `ValidationResponse(0–100)` (Validation). Global ID = `eip155:<chainId>:<contract>:<agentId>`.

**Indexable metrics:** agent counts (total / per-chain / over time), owners + NFT transfers, `agentURI` metadata, feedback counts + aggregate reputation + per-tag breakdowns + revocations, **client diversity (a Sybil signal)**, validation request/response counts & average scores, validated-vs-unvalidated split.

**Adoption (8004scan.io, AltLayer — observed 2026-06-12):** ~**244,500+ agents**, ~**302,000+ feedback records**, ~**234,000+ active users**. Chains shown: Ethereum, Base, BSC, Celo, Monad. ⚠️ Single-explorer source; cheap-L2 counts (Monad/BSC) likely include Sybil/spam — **treat raw totals critically and surface that skepticism as a feature.**

**Data access paths:**
- **The Graph "Agent0" subgraphs** (published 2026-04-14) — live on Ethereum, Base, BNB, Polygon, Monad; entities Identity/Capabilities/Reputation/Validation; open-source `github.com/agent0lab/subgraph`. *Fastest off-the-shelf path (cross-chain).*
- **BigQuery** `goog_blockchain_ethereum_mainnet_us.decoded_events` — decode registry event signatures by contract address. *This is what the Google Cloud prize wants; no prebuilt ERC-8004 table exists.*
- **8004scan API**; direct `eth_getLogs` on the addresses above.

**Note on the Ethereum-mainnet subset:** the ~244K headline is **cross-chain**. The BigQuery-queryable **Ethereum-mainnet** population is much smaller (low tens of thousands). Honest dashboard framing: *"N agents live-queryable on Ethereum mainnet via BigQuery; M across all chains (8004scan/subgraphs)."*

**Sources:** eips.ethereum.org/EIPS/eip-8004 · github.com/erc-8004/erc-8004-contracts · etherscan.io · 8004scan.io · thegraph.com/blog (Agent0) · github.com/agent0lab/subgraph

---

## 2. ENS — the name layer

**Role for us.** Makes agents legible and shareable: `yield-agent.eth` >> `0x7a3f…`. Resolve agent owner/operator addresses to ENS names; read **text records** (ENSIP-25 agent registry verification, ENSIP-26 agent text records) for endpoint/category/metadata. This is also the **ENS prize** target ("Best ENS Integration for AI Agents" — $5,000): the integration must *obviously* improve identity/discoverability, be functional (no hard-coded values), and is demoed at the ENS booth Sunday AM.

**Composition with ERC-8004:** an agent's ERC-8004 `agentURI`/Agent Card and its ENS name/text-records are complementary identity surfaces — join them on the owner/agent address.

**Sources:** docs.ens.domains/ensip/25, /ensip/26, /building-with-ai (see `PRIZES.md` ENS section).

---

## 3. ERC-8257 — Agent Tool Registry (nice-to-have panel)

**What it is.** Standards-Track ERC, **Draft**; authors **Cody Sears, Ryan Ghods (OpenSea)**. Announced May 27 2026; contracts deployed **May 18 2026**. A permissionless on-chain registry for AI-agent *tools* with predicate-based access control. Each entry: immutable creator address, metadata URI (off-chain manifest: name/endpoint/inputs/outputs/pricing), `keccak256` manifest-hash commitment, optional access-predicate contract. **Tool logic stays off-chain; the registry is discovery + access-gating.**

**Deployment (verified on Basescan; same CREATE2 address on Base, Ethereum mainnet, Shape, Abstract — "pre-beta", re-verify):**
- ToolRegistry: `0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1`
- Predicates: ERC721Owner `0xc8721c9A…`, ERC1155Owner `0x77373Dc3…`, Subscription `0xCBe0cd9B…`, TraitGated `0x10abF07C…`, ERC20Balance `0x1a834FC4…`

**Events:** `ToolRegistered`, `ToolMetadataUpdated`, `AccessPredicateUpdated`, `ToolDeregistered`. Indexable: tool ID → creator, metadata URI, manifest hash, predicate, paid-vs-free tier. **Not on-chain:** tool call volume / revenue (off-chain via manifests + x402).

**Adoption (agenttoolindex.xyz, Base — June 2026 snapshot, volatile):** ~**76 tools** (NFT/Collections 25, Data/Tooling 19, Security 14, DeFi 13, Identity 5); ~16 free / ~60 paid-via-x402; ~10 deregistered; ~48 with manifest issues. ~300 registry txns total. **Hype > realized volume** right now.

**Weekend role:** because it's on Ethereum mainnet, it indexes in the *same BigQuery pipeline* as ERC-8004. Small numbers, but it completes the stack story (identity → **tools** → payment) and the "manifest-issues / deregistered" counts are honest data-quality content.

**Sources:** eips.ethereum.org/EIPS/eip-8257 · github.com/ProjectOpenSea/tool-registry · basescan.org/address/0x265BB2… · agenttoolindex.xyz

---

## 4. x402 — payments (capability-flag now, volume later)

**What it is.** Open protocol activating HTTP `402 Payment Required` as a native payment rail. Client hits paywalled endpoint → server returns `402` + price/scheme/network → client signs a stablecoin authorization → a **facilitator** (`/verify` + `/settle`, non-custodial) broadcasts settlement on-chain. By **Coinbase** (launched May 2025; V2 multi-chain Dec 2025); moved to the **x402 Foundation** (Linux Foundation, Apache-2.0, zero protocol fees) **April 2 2026**, backed by Coinbase, Cloudflare, Stripe, Google, AWS, Visa, Mastercard, Circle, Base, Solana Fdn, Polygon, Shopify, thirdweb.

**On-chain footprint — the catch.** **There is NO dedicated x402 contract.** The default EVM scheme settles via **EIP-3009 `transferWithAuthorization` on the stablecoin token contract** using the payer's EIP-712 signature. On-chain that's an ordinary **ERC-20 `Transfer`** + an **EIP-3009 `AuthorizationUsed(authorizer, nonce)`** event — nothing x402-specific in calldata.
- USDC on Base (native): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verified). **No canonical facilitator address** (facilitators are HTTP services broadcasting from their own EOAs — unverified, do not hardcode).

**Attribution is genuinely hard.** Best signal = `AuthorizationUsed` (distinguishes gasless EIP-3009 from normal transfers), but EIP-3009 is used by non-x402 apps too, and there's no protocol tag. Robust attribution = **clustering by curated facilitator broadcaster addresses** (what Dune does) — heuristic and incomplete. Separating *genuine agentic* flows from speculative/wash is unsolved: at the Nov 2025 peak, Artemis estimated **>78% of txns and >98% of volume were non-organic** (e.g. the PING pay-to-mint meme).

**Adoption (cross-checked; use live Dune, not a fixed number):** >100M cumulative txns on Base through Q1 2026 (Chainalysis); Dune reads >120M all-chain (Base >70M, Solana >45M). Cumulative volume ~$41–50M; ~$600M annualized run-rate; >50% via Coinbase facilitator. **Chain share is volatile** — Base leads cumulative, but Solana then Polygon overtook weekly tx share at points (so "90% on Base" from the old docs is outdated). **Daily volume collapsed ~92%** (731k/day Dec 2025 → ~57k/day Feb 2026). Payment mix shifted to $1+ (49%→95% of volume). "$30T by 2030" = Gartner projection, **not** realized.

**Weekend role:**
- ✅ **Capability flag (core, easy):** read each agent's ERC-8004 Agent Card / metadata for an advertised x402 endpoint → "this agent accepts x402." Satisfies the **GCP prize's "flag which agents support x402"** with no Base indexing.
- 🔭 **Settlement volume ("Agent GDP", roadmap):** needs a Base pipeline (Dune / RPC / Goldsky) + a maintained facilitator-address list. Great Substack content precisely *because* the attribution & wash-trading problem is unsolved — you'd be the one drawing the honest line.

**How existing dashboards actually compute "usage" (verified by reading their code):** there is ONE universal heuristic — match the settlement tx's broadcasting address (`tx.from`) against a **hand-maintained whitelist of facilitator settler EOAs**, over USDC `Transfer` events. The whitelist *is* the methodology; nobody reliably filters on `AuthorizationUsed`. Numbers differ only by whitelist completeness:
- **x402scan** (Merit Systems, **open-source MIT**, `github.com/Merit-Systems/x402scan`) — **31 facilitators** with per-chain addresses + `dateOfFirstTransaction` in `packages/external/facilitators/`. Broadest + authoritative. Own indexer → Postgres `TransferEvent`; dedupes on `(tx_hash, log_index, chain)`; hides facilitators with <100 txns; no wash filter. Verified Coinbase Base settlers incl. `0xdbdf3d8ed80f84c35d01c6c9f9271761bad90ba6`, `0x9aae2b0d1b9dc55ac9bab9556f9a26cb64995fb9`, `0x3a70788150c7645a21b95b7062ab1784d3cc2104`.
- **Dune** (hashed_official `x402-analytics`, query `6240463`) — same `CASE WHEN tx.from IN (...)` facilitator map (SQL behind login, inferred), smaller list, manually updated → lags new facilitators.
- **PayAI** (`dune.com/payai/facilitator`) — only their own settler EOAs (narrowest).
- **Artemis** (`classic.artemis.ai/asset/x402`) — adds bot/wash-stripping via Allium's labeled-address set ("organic vs non-organic"); x402-specific thresholds undocumented.

**Replicable recipe:** index USDC `Transfer` on Base+Solana+Polygon where `tx.from ∈ x402scan facilitator list`, dedupe `(tx_hash, log_index, chain)`, sum `amount/1e6`. **Reuse x402scan's open-source list** rather than maintaining your own — it's the only continuously-updated public one, with first-seen dates for backfill. (Not BigQuery-able: Base/Solana not hosted — needs a separate indexer/RPC or Dune.)

**Nobody has solved agent-to-agent attribution.** All sources count *settlements by facilitator + seller wallet* — none know *which agent* a wallet is. **That join is TheWalletShift's unique edge:** ERC-8004 agent → wallet → x402 volume → named, reputation-scored agent. x402scan has payments without identity; we have identity. Publish the attribution methodology transparently to become the *trusted* number (the DeFiLlama move).

**Sources:** github.com/coinbase/x402 (specs/schemes/exact) · chainalysis.com/blog/x402-agentic-payments-adoption · docs.cdp.coinbase.com/x402 · linuxfoundation.org/press · dune.com/hashed_official/x402-analytics · classic.artemis.ai/asset/x402

---

## 5. ERC-8183 — Agentic Commerce (content / watchlist only)

**What it is.** Standards-Track ERC, **Draft**, created **Feb 25 2026**. Authors: **Davide Crapis (EF dAI), Bryan Lim, Tay Weixiong, Chooi Zuhwa (Virtuals Protocol)** — standardizes Virtuals' Agent Commerce Protocol. Core abstraction: a **Job** with an escrowed budget, 4 states (**Open → Funded → Submitted → Terminal**), 3 roles (Client, Provider, Evaluator); the evaluator marks completion. `Requires: EIP-20`. Optional Hooks. Composes with ERC-8004 (job outcomes → reputation) and x402 (payment intents).

**Deployment.** **DRAFT with NO canonical on-chain footprint.** Reference impl `github.com/erc-8183/base-contracts` is source-only — **no verified deployed addresses**. Community/hackathon repos claim Base/X-Layer/SKALE deployments but publish **no verifiable addresses**. Realized on-chain activity ≈ **zero**. (Virtuals' "$39.5M revenue / 17K agents" numbers are *not* ERC-8183 settlements. Claims of "BNB Chain SDK / 5 verified Base contracts" appear to be AI-summary fabrications — do not cite.)

**Weekend role:** **not indexable.** Track the repo + Eth Magicians thread for a finalized event ABI and first mainnet deployment. Pure content/roadmap: *"the escrow layer that's coming."*

**Sources:** eips.ethereum.org/EIPS/eip-8183 · ethereum-magicians.org/t/erc-8183-agentic-commerce/27902 · github.com/erc-8183/base-contracts

---

## Dashboard data domains → source map

| Domain (dashboard tile) | Primary source | Status |
|---|---|---|
| **Population** (agents, new/day, per-chain) | ERC-8004 Identity `Registered` events | ✅ ship (BigQuery Eth-mainnet; cross-chain via Agent0 subgraphs) |
| **Identity** (named %, profiles) | ENS resolution + text records + ERC-8004 Agent Card | ✅ ship |
| **Trust** (reputation, feedback, validated, client diversity/Sybil) | ERC-8004 Reputation + Validation | ✅ ship |
| **Tools** (registered tools, categories, paid-via-x402 %) | ERC-8257 ToolRegistry events | ⚠️ ship-light (small numbers) |
| **Payment capability** (which agents accept x402) | ERC-8004 metadata flag | ✅ ship |
| **Agent GDP** (x402 settlement volume, A2A flows) | Base via Dune/RPC + facilitator list | 🔭 roadmap |
| **Jobs / commerce** (escrowed work) | ERC-8183 | 🔭 roadmap (not deployed) |

## Content / credibility angle (for blog.thewalletshift.com)
The honest, hard-to-fake stories competitors will gloss over — and your differentiation:
- **"How many agents are actually real?"** — Sybil/spam in ERC-8004 L2 registrations; client-diversity as a trust metric.
- **"Agent GDP is mostly wash."** — x402's >78% txn / >98% volume non-organic; the 92% daily-volume collapse; the attribution problem.
- **"The stack nobody's deployed yet."** — ERC-8183 as the missing escrow layer; ERC-8257 hype-vs-volume.
- Being the source that *draws these lines honestly* is how you become the cited reference (the DeFiLlama path), which is what earns 1,000 daily viewers.
