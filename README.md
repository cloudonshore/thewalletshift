# The Wallet Shift

**The live scoreboard for the on-chain AI agent economy.** Wallets are shifting from humans to autonomous agents — The Wallet Shift indexes that shift and makes it legible: who the agents are, how fast they're growing, which are reputable, and which can be paid.

> DeFiLlama made DeFi legible. The Wallet Shift makes the agent economy legible.

## What it tracks

Built on the **ERC-8004 "Trustless Agents"** registries (Identity · Reputation · Validation) on **Ethereum mainnet**, enriched with ENS identity and x402 payment signals:

- **Population** — agents registered, growth over time, by owner
- **Identity** — agent cards, names, ENS, capabilities
- **Trust** — on-chain reputation feedback, Sybil-resistant scoring (unique-reviewer barrier)
- **Payments** — which agents declare `x402` payment support
- **Honesty layer** — owner concentration and empty-shell registrations, so the headline numbers aren't taken at face value

### Live mainnet snapshot (2026-06-13)

| Metric | Value |
|---|---|
| Agents registered | 34,556 |
| Unique owners | 8,143 (top wallet = 28.8%, top 10 = 46%) |
| Agents with no metadata | 18,049 (52%) |
| Fully on-chain agent cards | 9,520 |
| x402-payable agents | 4,389 |

## Architecture

```
Ethereum mainnet (ERC-8004 logs)
   └─ Google BigQuery (decode raw logs → agent registry, in pure SQL)
        └─ scheduled aggregation → served metrics
             └─ Firebase-hosted dashboard (charts, leaderboards, agent profiles)
```

Raw ERC-8004 event logs are decoded directly in BigQuery SQL (no off-chain indexer), materialized into a compact dataset, aggregated on a schedule, and rendered in a Firebase-hosted frontend at **[thewalletshift.com](https://thewalletshift.com)**.

## Repo layout

- `sql/` — the BigQuery query library (ERC-8004 decoders + dashboard metrics)
- `GCP-EXPLORATION.md` — data-source exploration notes, cost model, validated findings
- `AGENT-ECONOMY-STACK.md` — reference on the agent-economy protocol stack (ERC-8004, x402, ERC-8257, ERC-8183)
- frontend app — _in progress_

## Methodology & transparency

Every metric is derived from public on-chain data and verifiable by re-running the queries in `sql/`. Where numbers are heuristic (e.g. Sybil estimates), the method is stated. This is a first principle of the project: be the *trusted* number.

## Status

Built for ETHGlobal New York 2026. Data layer is live; frontend in active development.
