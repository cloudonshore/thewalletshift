# Architecture — data pipeline & serving

How The Wallet Shift gets numbers from a 3 TB public dataset onto a page that
millions of people can load cheaply. Read this before touching the pipeline.

## The one rule

**BigQuery is the factory, never the storefront.** BigQuery is an analytical
warehouse: queries take seconds and are billed per *byte scanned*, not per row
returned, and it has concurrency limits. If the Next.js app queried BigQuery on
each request, 1M visitors = 1M scans of the same data = a huge bill and a slow
site. So the expensive query runs **once per refresh** into a tiny pre-computed
artifact, and every visitor reads that artifact from a CDN.

For a dashboard that refreshes 1–2×/day and is read by everyone identically,
**static JSON on a CDN is the cheapest correct serving layer.** Firestore and
BI Engine solve access patterns we don't have yet (see "Roads not taken").

## The shape

```
┌─ FACTORY (runs 1–2×/day; we pay here, in pennies) ────────────┐
│                                                               │
│  bigquery-public-data…goog_blockchain_ethereum_mainnet_us     │
│  .logs                      (3 TB, partitioned by month)      │
│        │  ① INGEST: append only the newest month's partition, │
│        │     filtered to the 2 registry addresses             │
│        ▼                                                       │
│  erc8004.logs_raw           (materialized; ~95 MB today)      │
│        │  ② TRANSFORM: decode logs → small summary tables     │
│        ▼     (the SQL in sql/erc8004_queries.sql, as models)  │
│  erc8004.metrics_*          (~10 tiny aggregate tables)       │
│        │  ③ EXPORT: one statement → JSON                      │
│        ▼                                                       │
└──────  gs://thewalletshift-data/metrics.json  ────────────────┘
                          │
┌─ STOREFRONT (serves millions; ~free) ─────────────────────────┐
│   Firebase App Hosting CDN  ◄── Next.js ISR fetches the JSON   │
│   visitors hit edge-cached HTML/JSON, never touch BigQuery     │
└───────────────────────────────────────────────────────────────┘
```

**Cost shape:** ingest+transform on the ~95 MB materialized table is effectively
free. The *only* step that can cost real money is ① touching the 3 TB public
table — controlled by partition pruning (see guardrail). Serving is CDN
bandwidth: pennies for millions of views.

## The four steps

### ① Ingest — daily incremental append (the cost-critical step)
The public `…ethereum_mainnet_us.logs` table is **partitioned by month**. A daily
job must filter `block_timestamp` to the current month **and** the two registry
contract addresses, then append/`MERGE` into `erc8004.logs_raw`. Partition
pruning means each run scans ~one month, not 3 TB.

> **GUARDRAIL:** never `SELECT` the public raw table without a `block_timestamp`
> partition filter. An unfiltered scan is 3 TB ≈ $15+ a pop and is the one way
> this project bleeds money. Always check the "bytes processed" estimate first.

Registries: Identity `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432` ·
Reputation `0x8004baa17c55a88189ae136b182e5fda19de9b63`.

### ② Transform — our SQL, as versioned models
`sql/erc8004_queries.sql` already holds the decode/metric SQL. Schedule it one of
two ways:
- **Scheduled Queries** (native, zero setup) — each query on its own timer.
  *Start here.*
- **Dataform / "BigQuery Pipelines"** (Google's built-in dbt) — git-versioned
  SQL with a real dependency graph and declarative `incremental` models. The
  2026-recommended path; maps cleanly onto our `sql/` folder. *Graduate to this*
  once the model count grows or profile-page tables arrive.

### ③ Export — JSON to GCS
Either a single BigQuery `EXPORT DATA OPTIONS(uri='gs://…', format='JSON')` at the
end of the transform, **or** keep `scripts/export-metrics.sh` and run it as a
Cloud Run Job on a Cloud Scheduler cron. Output is the same `metrics.json` shape
we already ship — just living in a bucket instead of the repo.

### ④ Serve — Next.js ISR
The app `fetch()`es the GCS URL with revalidation instead of importing the JSON
at build time. Firebase App Hosting runs the real Next.js server on Cloud Run, so
ISR works out of the box.

```ts
// lib/metrics.ts — the single swap point
export const revalidate = 21600; // 6h
const res = await fetch(`${DATA_BASE}/metrics.json`, { next: { revalidate: 21600 } });
```

Upgrade later: **on-demand revalidation** — the pipeline's last step pings a
`revalidatePath('/')` route so the site refreshes the instant new data lands, no
polling. `lib/metrics.ts` is the only file that changes.

## Roads not taken (and when to revisit)
- **Querying BigQuery from the app** — never. Latency, per-query cost, concurrency
  caps. The whole point of the serving layer is to avoid this.
- **Firestore for the dashboard** — it's a point-lookup database; paying
  per-document-read to serve ~10 aggregate blobs to millions is strictly worse
  than one CDN-cached file. Firestore earns its place only when we add **per-agent
  profile pages** (34k docs, looked up individually) — and even then, static
  per-agent JSON on GCS + ISR is competitive. Defer.
- **BI Engine** — an in-memory accelerator for live Looker/Tableau dashboards, not
  a custom high-traffic site. Not our pattern.

## Rollout status
- [x] **Phase 0** — real `metrics.json`, baked into the build (refresh = redeploy).
- [ ] **Phase 1** — bucket `gs://thewalletshift-data`; app reads JSON via ISR fetch
      (decouples data refresh from deploys).
- [ ] **Phase 2** — the 6 queries as Scheduled Queries writing `metrics_*` tables +
      an `EXPORT DATA` to the bucket (the daily pipeline).
- [ ] **Phase 3** — harden ① incremental ingest with partition filters (cost
      guardrail) + Cloud Scheduler cron.
- [ ] **Later** — Dataform for the SQL; on-demand revalidation; profile pages.

## References
- Serving-layer / cost rationale: BigQuery is billed per byte scanned, so
  pre-aggregate and never let users hit raw tables.
- Dataform vs scheduled queries: Dataform adds dependency ordering, git version
  control, and declarative incremental models over isolated scheduled queries.
- Next.js ISR on self-hosted/App Hosting: `next: { revalidate }` works out of the
  box on the Cloud Run-backed Next.js server.
