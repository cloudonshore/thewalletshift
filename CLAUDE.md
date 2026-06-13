# The Wallet Shift — working notes for Claude

> Critical context for working in this repo. Keep this lean and current; put long-form detail in `/docs` and link to it.

## What this is
A live analytics dashboard for the on-chain AI **agent economy** ("DeFiLlama for agents"), built on **ERC-8004** registries on Ethereum mainnet. Hosted at **thewalletshift.com**. Built for ETHGlobal NY 2026 (target prizes: Google Cloud + ENS). Companion content on **blog.thewalletshift.com** (Substack).

## Repo layout
- `web/` — Next.js 15 app (the dashboard). App Router, TypeScript, Tailwind, Recharts.
- `sql/` — validated BigQuery query library (`erc8004_queries.sql`).
- `scripts/` — `export-metrics.sh` (BigQuery → `web/src/data/metrics.json`).
- `docs/` — detailed reference (agent-economy stack, BigQuery exploration findings).
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

## Data pipeline
- **Now (Stage 1):** `bash scripts/export-metrics.sh <YYYY-MM-DD>` → queries BigQuery → writes `web/src/data/metrics.json`, which the dashboard imports. Real data, no Firebase dependency.
- **Later (Stage 2):** same SQL as scheduled BigQuery rollups → Firestore (BQ→Firestore extension) → frontend reads Firestore live; + Cloud Run `/api/live-query` for the on-stage demo. Keep the JSON shape stable so the frontend swap is one file (`web/src/lib/metrics.ts`).

## BigQuery facts
- Project `thewalletshift`, dataset `erc8004`, **query the materialized table `thewalletshift.erc8004.logs_2026`** (95 MB, free) — NOT the 3 TB public table.
- Public source: `bigquery-public-data.goog_blockchain_ethereum_mainnet_us.logs` (US, partitioned by month; Base NOT available).
- Registries: Identity `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432` · Reputation `0x8004baa17c55a88189ae136b182e5fda19de9b63`.
- Event sigs (topics[0]): Registered `0xca52e62c…` · NewFeedback `0x6a4a6174…` · Transfer `0xddf252ad…`.
- Headline metrics (2026-06-13): 34,556 agents · 8,143 owners (top=28.8%) · 52% empty · 4,389 x402-payable. See `docs/GCP-EXPLORATION.md`.

## Local gotchas
- **npm installs:** the user's `~/.npmrc` has stale auth that 401s. For installs use a clean config:
  `NPM_CONFIG_USERCONFIG=/tmp/ws-empty-npmrc NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ npm install …` (Cloud Build is unaffected.)
- **`bq` CLI hangs (~60s timeout) when IPv6 is broken** (e.g. behind some VPNs): `bigquery.googleapis.com` resolves to IPv6, and bq's Python httplib2 has no happy-eyeballs fallback. Auth/network are fine — `curl -4` to the BigQuery REST API works instantly. The export script therefore uses **BigQuery REST over `curl -4`**, not `bq`. If you need `bq` itself, restore IPv6 (toggle VPN) or disable IPv6 on the interface.
- bq/gcloud authed (samuel.walker9@gmail.com); firebase CLI authed; gh authed as cloudonshore.

## Pointers
- `docs/AGENT-ECONOMY-STACK.md` — ERC-8004 / x402 / ERC-8257 / ERC-8183 reference + x402 dashboard methodology.
- `docs/GCP-EXPLORATION.md` — BigQuery data exploration, cost model, validated findings.
- `sql/erc8004_queries.sql` — the decoder/metric queries.
