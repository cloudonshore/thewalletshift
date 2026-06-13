# The Wallet Shift — working notes for Claude

> Critical context for working in this repo. Keep this lean and current; put long-form detail in `/docs` and link to it.

## What this is
A live analytics dashboard for the on-chain AI **agent economy** ("DeFiLlama for agents"), built on **ERC-8004** registries on Ethereum mainnet. Hosted at **thewalletshift.com**. Built for ETHGlobal NY 2026 (target prizes: Google Cloud + ENS). Companion content on **blog.thewalletshift.com** (Substack).

## Repo layout
- `web/` — Next.js 15 app. App Router, TS, Tailwind, Recharts, TanStack Table+Virtual. Pages: `/` (dashboard), `/agents` (virtualized browser of all 34.5k), `/explore` (event-types + sample). Routes: `/api/agents` (serves full set from GCS via `web/src/lib/gcs.ts`).
- `sql/` — validated BigQuery query library (`erc8004_queries.sql`).
- `scripts/` — BQ→JSON exports: `export-metrics.sh` (dashboard), `export-explorer.sh` (`/explore`), `export-agents.sh` (full table → GCS); plus `explore.sh '<SQL>'` ad-hoc runner.
- `abis/` — authoritative compiled contract ABIs (decode source-of-truth; see `abis/README.md`).
- `docs/` — detailed reference (architecture, **agent data model**, agent-economy stack, BigQuery findings).
- internal strategy docs (PRIZES.md, SUBMISSION.md, strategy.md, compass_*) are **gitignored** — local only.

## Git workflow (IMPORTANT)
- Work on **`dev`**; commit **small + frequently** (ETHGlobal rule; no single giant commits).
- **Never put AI/Claude attribution in commits** (user rule).
- **Claude cannot push to `main`** — blocked by an enterprise-managed Claude Code hook (`/Library/Application Support/ClaudeCode/managed-settings.json`). Push `dev`; **the user merges `dev`→`main`** (or via PR). Do NOT try to route around this (gh api, etc. — it's a corp policy).
- Other managed guardrails: no `rm -rf` (use `trash`), no `sudo`, can't read `~/.npmrc`/`~/.ssh`/wallets.

## Deploy (Firebase App Hosting)
- Project: **`thewalletshift`** · backend: **`thewalletshift`** · region **`us-east4`** · Blaze billing (acct `0125E6-98029E-0EC6CA`, $1000 hackathon credits).
- Live URL: `https://thewalletshift--thewalletshift.us-east4.hosted.app`
- **Auto-deploys on push to `main`** (root dir `web`). Manual: `firebase apphosting:rollouts:create thewalletshift -b main`.
- Status: `firebase --project thewalletshift apphosting:backends:list`

## Custom domain
`thewalletshift.com` → App Hosting. GoDaddy DNS (entered, verified live):
- `A @ → 35.219.200.204` · `TXT @ → fah-claim=023-02-0ca31f82-7207-4b99-aa5e-aa3fd6891547`
- `CNAME _acme-challenge_pd4gcad5464drgog → 6ec61726-7e43-4eda-99bc-5a1d4ff2c683.7.authorize.certificatemanager.goog.`
- Untouched: `CNAME blog → substack`, `CNAME www → thewalletshift.com`, NS records.
- Verify DNS: `dig @ns47.domaincontrol.com +short thewalletshift.com A`

## Data pipeline — see `docs/ARCHITECTURE.md` for the full design + rollout phases
Pattern: **BigQuery is the factory, a CDN-served JSON is the storefront.** Never query BQ from the app.
- **Refresh data:** `bash scripts/export-metrics.sh <YYYY-MM-DD>` → writes `web/src/data/metrics.json`, then upload it: `gcloud storage cp web/src/data/metrics.json gs://thewalletshift-data/metrics.json --project=thewalletshift --cache-control="public, max-age=300"`.
- **Serving (Phase 1, live):** the app reads `gs://thewalletshift-data/metrics.json` at runtime via `getMetrics()` in `web/src/lib/metrics.ts` — authenticated with the App Hosting SA `firebase-app-hosting-compute@thewalletshift.iam.gserviceaccount.com` (has `objectViewer` on that bucket) via the GCE metadata server. Rendered through ISR. The bundled JSON in the repo is the offline/build fallback. Bucket is **private** (no public access).
- **Freshness:** a GCS write self-surfaces within ~6h (Next data-cache `revalidate`). For instant refresh, build the Phase 1.5 `POST /api/revalidate` webhook; a redeploy also clears the cache. **Do NOT make the bucket public** to "fix" staleness — that's not the cause.
- **Data objects in `gs://thewalletshift-data` (private):** `metrics.json` (dashboard — server-side ISR fetch in `lib/metrics.ts`) · `agents.json` (full 34.5k table, ~6.8 MB — client-fetched via the `/api/agents` route, which reads GCS through `lib/gcs.ts` in prod and a gitignored local copy in dev; regen via `export-agents.sh`). `explorer.json` is small and bundled in-repo.
- **Next (Phase 2):** the 6 queries as BQ Scheduled Queries → `metrics_*` tables → `EXPORT DATA` to the bucket → cron. Firestore is deferred to per-agent profile pages only, not the dashboard.

## BigQuery facts
- Project `thewalletshift`, dataset `erc8004`, **query the materialized table `thewalletshift.erc8004.logs_2026`** (95 MB, free) — NOT the 3 TB public table.
- Public source: `bigquery-public-data.goog_blockchain_ethereum_mainnet_us.logs` (US, partitioned by month; Base/L2s NOT available).
- Registries: Identity `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432` · Reputation `0x8004baa17c55a88189ae136b182e5fda19de9b63`.
- **Coverage confirmed (2026-06-13):** table holds BOTH registries, mainnet, full history — Identity 156,269 rows (Jan 29→Jun 13), Reputation 3,215 rows (Jan 29→Jun 12). No stray addresses. Reconciles to 159,484.
- **SCOPE = Ethereum mainnet only (locked).** Same 2 addresses are deterministically deployed on Base/Arbitrum/Avalanche/BSC/Abstract too, and most agent *volume* is on the cheap L2s — but those chains aren't in BigQuery public data, so multi-chain would need a separate indexer. Mainnet-only is a deliberate *feature*: "these agents paid real gas → higher-signal, less Sybil."
- **ValidationRegistry** (3rd pillar of the standard) exists in the contracts repo but is **deployed nowhere** (no address on any chain). Watch item: add it when it goes live on mainnet.
- **Authoritative ABIs:** committed at `abis/{Identity,Reputation,Validation}Registry.json` (copied from the official repo's compiled `abis/`). ALWAYS decode against these, not hand-read `.sol` `event` lines — the compiled ABI includes inherited events (ERC-4906, OZ) the source files don't declare. These are UUPS proxies → impls Identity `0x7274e874…` / Reputation `0x16e0fa7f…` (upgraded only at launch, stable since).
- **Event signatures (topics[0], full map verified via keccak vs the compiled ABI — every signature in the table is accounted for, zero leftovers):**
  - Identity: `Registered` 0xca52e62c (34,556) · `MetadataSet` 0x2c149ed5 (52,789, *liveness signal — edits > registrations*) · `Transfer` 0xddf252ad (49,305) · `MetadataUpdate` 0xf8e1a15a (17,943 — **inherited ERC-4906** ping, fires when a URI is set/changed) · `URIUpdated` 0x3a2c7fff (1,365) · `ApprovalForAll` 0x17307eab (303) · `Approval`/`Initialized`/`Upgraded`/`OwnershipTransferred` (1–3 each, plumbing)
  - Reputation: `NewFeedback` 0x6a4a6174 (3,173) · `ResponseAppended` 0xb1c6be0b (37) · `FeedbackRevoked` 0x25156fd3 (**0 — nobody revokes reviews**)
  - In ABI but never fired: `BatchMetadataUpdate`, `EIP712DomainChanged`, `FeedbackRevoked`.
- Headline metrics (2026-06-13): 34,556 agents · 8,143 owners (top=28.8%) · 52% empty · 4,389 x402-payable. See `docs/GCP-EXPLORATION.md`.
- **Exploration tools:** `scripts/explore.sh '<SQL>'` (ad-hoc, `\`T\`` = the table, prints bytes/cache; `-n` = dry-run cost) · `export-explorer.sh` → `explorer.json` · `export-agents.sh` → `agents.json` (full table, current owner) → GCS.

## Agent data model (CRITICAL — full detail in `docs/AGENT-DATA-MODEL.md`)
- **Two separate stores per agent, don't conflate:** (A) the **`agentURI` / Agent Card** — one string, inline `data:base64` card OR `https`/`ipfs` link OR empty; holds `{name, description, image, endpoints, active, x402Support}`. (B) the **on-chain metadata map** (`MetadataSet` event, `key→bytes`) — dominated by the reserved `agentWallet` key (auto-set every registration).
- **Three different "owner" addresses** that diverge: registration owner (`Registered.owner`) vs **current NFT owner** (latest `Transfer.to`) vs **agentWallet** (operating wallet, store B). 37% have current owner ≠ agentWallet.
- ⚠️ **"Top owner 28.8%" is a MINT-FACTORY contract** `0xd5d6d96f…a291` (minted 9,967 to itself, distributed all, holds ~0). **Concentration should use CURRENT owner**; the dashboard's `metrics.json` still uses registration owner (known fix).
- **ENS is self-declared in the card, NOT verified** against the ENS registry (real ENS resolution = a prize-worthy upgrade). `kind` (onchain/https/ipfs/empty) is **derived by us** from the URI prefix, not an on-chain field.
- **Indexing all cards (next task):** on-chain cards (~9,520) decode in SQL for **free**; off-chain `https`/`ipfs` (~4,600) need an **off-chain fetch pipeline** (content isn't on-chain). 52% have no card.
- **Real marketplace activity exists but is minor:** 361 Seaport/OpenSea sale txns; most secondary movement is the factory batch-distributing. TODO: pull Seaport sale prices to size the real market.

## Local gotchas
- **npm installs:** the user's `~/.npmrc` has stale auth that 401s. For installs use a clean config:
  `NPM_CONFIG_USERCONFIG=/tmp/ws-empty-npmrc NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ npm install …` (Cloud Build is unaffected.)
- **`bq` CLI hangs (~60s timeout) when IPv6 is broken** (e.g. behind some VPNs): `bigquery.googleapis.com` resolves to IPv6, and bq's Python httplib2 has no happy-eyeballs fallback. Auth/network are fine — `curl -4` to the BigQuery REST API works instantly. The export script therefore uses **BigQuery REST over `curl -4`**, not `bq`. If you need `bq` itself, restore IPv6 (toggle VPN) or disable IPv6 on the interface.
- bq/gcloud authed (samuel.walker9@gmail.com); firebase CLI authed; gh authed as cloudonshore.
- **Restart the dev server after `next build`** — running `npm run build` while `next dev` is live clobbers the shared `.next` and the dev server then 500s. (Recurring "Internal Server Error" on localhost = this, not a code bug.)
- **Browser tool (Chrome MCP) is blocked from `etherscan.io`** ("safety restrictions"). Give the user the link, or characterize contracts from BigQuery / the committed ABIs instead.

## Pointers
- `docs/AGENT-DATA-MODEL.md` — **what the agent data IS** (two stores, card schema, the 3 owner identities + factory, marketplace findings, field provenance, card-indexing plan). Read before card/aggregate work.
- `docs/ARCHITECTURE.md` — **data pipeline & serving design** (factory→storefront, the 4 steps, cost guardrail, rollout phases). Read before touching the pipeline.
- `docs/AGENT-ECONOMY-STACK.md` — ERC-8004 / x402 / ERC-8257 / ERC-8183 reference + x402 dashboard methodology.
- `docs/GCP-EXPLORATION.md` — BigQuery data exploration, cost model, validated findings.
- `sql/erc8004_queries.sql` — the decoder/metric queries.
