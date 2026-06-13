# BigQuery Exploration — ERC-8004 on Ethereum Mainnet (findings)

> Hands-on exploration 2026-06-12 via `bq` CLI, project `thewalletshift`, dataset `bigquery-public-data.goog_blockchain_ethereum_mainnet_us` (US multi-region). All numbers are real query results.

## Verdict
**The GCP data dependency is real and viable.** ERC-8004 Identity + Reputation registries are live and active on Ethereum mainnet through today, queryable in BigQuery's free tier with date-scoped queries. Population data is trivial; metadata + reputation require decoding raw logs ourselves.

## Dataset shape
`decoded_events`: 5.17B rows, **3.23 TB**, partitioned by **MONTH on `block_timestamp`**, clustered only on `block_timestamp` (NOT on `address`). Schema includes: `address`, `event_signature`, `event_hash`, `topics ARRAY<STRING>`, `args JSON`, `block_timestamp`, `transaction_hash`, `log_index`.
Other big tables: `logs` 3.70 TB, `token_transfers` 1.60 TB, `transactions` 4.08 TB, `traces` 13 TB, `accounts_state` 27.7 TB.

## Cost model (learned empirically)
- **Only pruning lever = the monthly date partition.** No address clustering, so filtering by contract address does NOT reduce bytes; a `block_timestamp >= '2026-01-01'` filter does.
- Same ERC-8004 query: **61.5 GB** scoped to 2026 vs **412 GB** full-history.
- **Referencing `topics` / `args` / `data` is expensive** — adding `topics` pushed a 61 GB query to 201 GB; the `logs` table with `topics` was 227 GB.
- Minimal-column, date-scoped queries run **~49–61 GB** each. Free tier = 1 TB/month (~16 such queries).
- **Always `--dry_run` first** (free) to read the byte estimate before running.
- **Production pattern:** one-time ~60 GB extract of ERC-8004 events → small private `thewalletshift.*` table → dashboard queries that cheaply. Never re-hit the 3 TB raw table per page load.

## Key findings (real results)

### Identity Registry `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`
- `decoded_events` (2026): `Transfer` 49,193 · `ApprovalForAll` 302 · `Approval` 3. First 2026-01-29 10:31, last **2026-06-12 17:41** (live today).
- Only **standard ERC-721** events are decoded. Mints (Transfer from `0x0`) = agent registrations.
- Raw `logs` (2026): **155,604** events → ~106K are custom ERC-8004 events (`Registered`, `MetadataSet`, …) NOT in `decoded_events`.

### Reputation Registry `0x8004baa17c55a88189ae136b182e5fda19de9b63`
- `decoded_events`: **0** rows (custom events aren't decoded).
- Raw `logs` (2026): **3,215** events, live through **2026-06-12 14:39**. Reputation IS active on mainnet — just undecoded.

### Registration growth (monthly `Transfer` count, Identity registry)
| Month | Transfers (≈registrations) |
|---|---|
| 2026-01 | 28,896 (launch land-rush, Jan 29–31) |
| 2026-02 | 7,768 |
| 2026-03 | 7,342 |
| 2026-04 | 313 |
| 2026-05 | 4,426 |
| 2026-06 | 448 (partial) |

Pattern = big launch spike then cooled/spiky. (Counts all Transfers incl. secondary; mints ≈ this early on.)

## Architecture implications for the build
| Pillar | Source | Effort |
|---|---|---|
| **Population / growth** | `decoded_events` ERC-721 `Transfer` (mint = from `0x0`) | ✅ trivial |
| **Identity / metadata** (agentId, owner, agentURI) | decode `Registered` from raw `logs` (ABI-decode topics+data) | ⚠️ standard work |
| **Trust / reputation** (feedback scores, tags) | decode `NewFeedback` from raw `logs` | ⚠️ standard work |
| **ENS names** | resolve owner addresses (off BigQuery) | separate |
| **x402 capability flag** | fetch each agent's off-chain Agent Card (agentURI JSON) | separate |

**To decode raw logs:** compute `keccak256` of the ERC-8004 event signatures (`Registered(...)`, `NewFeedback(...)`), match `topics[0]`, then ABI-decode `data`. Doable in BigQuery SQL/UDF or a small extract script. This is a *stronger* GCP-prize narrative than counting mints (shows real BigQuery + decoding mastery).

**Mainnet vs L2 framing (content angle):** most ERC-8004 volume is on cheap L2s (Base/BSC/Monad, ~244K total via 8004scan); the Ethereum-mainnet subset (~49K) costs real gas to register → higher-signal, less Sybil. "Mainnet agents are the ones who paid to be here."

## Reusable query snippets
```sql
-- Free: table sizes
SELECT table_id, row_count, ROUND(size_bytes/1e9,1) gb
FROM `bigquery-public-data.goog_blockchain_ethereum_mainnet_us.__TABLES__` ORDER BY size_bytes DESC;

-- ~61 GB: ERC-8004 events by signature (scope by date!)
SELECT address, event_signature, COUNT(*) events, MIN(block_timestamp) first_seen, MAX(block_timestamp) last_seen
FROM `bigquery-public-data.goog_blockchain_ethereum_mainnet_us.decoded_events`
WHERE address IN ("0x8004a169fb4a3325136eb29fa0ceb6d2e539a432","0x8004baa17c55a88189ae136b182e5fda19de9b63")
  AND block_timestamp >= "2026-01-01"
GROUP BY address, event_signature ORDER BY events DESC;
```
Setup: `brew install --cask google-cloud-sdk` → `gcloud auth login` → `gcloud config set project thewalletshift`. Always `--dry_run` before a real query.

---

## Validated findings (2026-06-13) — full pipeline decoded in SQL
Materialized `thewalletshift.erc8004.logs_2026` (95 MB, 159,484 logs) via one 437 GB extract; all queries below are free against it. Decoders from the GCP workshop cheat sheet (`sql/erc8004_queries.sql`). **$1,000 in hackathon GCP credits available** (~160 TB) so cost is no longer a constraint; extract-once still used as the production pattern.

**Population (canonical):** **34,556 agents** on Ethereum mainnet (distinct `Registered` == distinct mints, exact match). 49,305 `Transfer`s = 34,556 mints + 14,749 secondary transfers.

**Concentration / Sybil signal (the differentiation):**
- 8,143 unique owners; avg 4.2 agents/owner.
- **Top wallet `0xd5d6d96f…` owns 9,967 = 28.8% of ALL agents.** Top 10 owners = 46%.
- **52% (18,049) registered with an EMPTY metadata URI** (blank shells). 27.5% (9,520) fully on-chain `data:base64` cards; 11.6% `https`; 643 `ipfs`.

**Identity / x402 (from on-chain base64 cards, extracted in SQL):** card schema = `{type, name, description, image, endpoints[{name:"ens", endpoint:"x.eth"}], active, x402Support}`. Of 9,520 cards: **x402Support true = 4,389**, false = 2,540, no field = 2,591. ENS names live in `endpoints` → extractable without off-chain calls.

**Reputation (`NewFeedback`, Sybil-guarded ≥3 unique clients):** works; top agent `#10307` = 44 unique reviewers / 51 feedback. ⚠️ avg scores can exceed 100 — rating scale not yet confirmed (verify decimals semantics).

**Open questions:** unidentified Identity events `0x2c149ed5…` (52,789 — most frequent, likely MetadataSet) and `0xf8e1a15a…` (17,943); reputation `0xb1c6be0b…` (37). Worth decoding to capture metadata updates + feedback revocations.

**Bottom line:** the full spine — population, identity, ENS, x402 capability, reputation, and the honest Sybil caveats — is decoded and working on real mainnet data in free SQL. The hard part is done.
