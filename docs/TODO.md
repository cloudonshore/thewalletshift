# TODO — parked work

Things intentionally deferred. Newest at top. Link to detail where it exists.

## Service classification & search — the pivot (2026-06-13)
Project shifted from analytics-only to **analytics + searchable service API**. Focus
on the agents that actually provide services; ignore the long-tail junk.
- **BUILT:** classification pipeline (second-hop A2A skills/MCP tools fetch → emergent
  taxonomy → 41-subagent LLM classification → `classified.json`) + the `/services`
  analytics page. 2,037 callable → **711 real services** (rest are NFT collectibles/spam).
  See the "Service classification" bullet in `docs/AGENT-DATA-MODEL.md` / `CLAUDE.md`.
- **NEXT — search API:** `GET /api/search?q=…` over the classified corpus
  (`enrichment.json` summary+tags) so you can find an agent to do a task. Start with
  keyword/tag match; upgrade to embeddings + vector search (RAG) for natural-language.
- **NEXT — installable agent skill:** a skill other agents install to search all agent
  services in natural language (hits the search API / RAG DB). The classification
  `{summary, tags}` is the corpus; embeddings are the missing piece.
- **Refinements:** MCP tools coverage is low (31 reachable — session/SSE/auth is hard);
  the `web` proto is a weak signal (often just a website); 369 off-chain cards still
  persistently 429. `validator.eth`-style ens-only "services" are correctly excluded
  from callable. Consider a "distinct operators per category" metric — the service tier
  is itself concentrated (Olas + one ZK-yield minter dominate `defi-yield-rebalancing`).

## Card spec-compliance / validator view (deferred 2026-06-13)
Source of truth: **8004scan best-practices / validator spec** —
https://best-practices.8004scan.io/docs/01-agent-metadata-standard.html
(this is the authoritative ERC-8004 Agent Metadata standard; our card decoding
should validate against it). Our session-built card pipeline already aligns on the
big things (uses `services` not legacy `endpoints`; `type` schema URI; trust models;
URI immutability priority). Remaining, in rough priority:

1. **Compliance view** (the differentiator — Google-prize-relevant). The site is a
   *validator*: Error/Warning/Info tiers (MUST/SHOULD/MAY) with codes. Implement a
   subset and ship "% of cards spec-compliant" + warning breakdown. Concrete rules:
   - **WA031** — card uses legacy `endpoints` instead of `services` (we can count this).
   - name length 3–200; description length 50–500 (flag out-of-spec).
   - missing recommended fields (`type`, `name`, `description`, `image`, `services`).
2. **Extend detection to the full standard set** (cheap; pipeline already exists):
   - trust: add **`social-graph`** (4th standard value; we only bucket the 3 seen).
   - services/proto: add **OASF** (3rd interop framework), **ENS**, **DID**, **email**;
     in `export-agents.sh` (on-chain) + `fetch-cards.mjs` (off-chain proto detection).
3. **`registrations[]` as a verification metric.** Card → `registrations` → back to the
   NFT = bidirectional cryptographic self-verification. We currently only count it
   (645). Elevate to a trust/authenticity signal ("self-verifying cards").
4. **Deeper capability fetch — "what does each agent DO".** ✅ **DONE for A2A + MCP**
   (`fetch-skills.mjs` pulls A2A `/.well-known/agent-card.json` skills + MCP `tools/list`).
   Still TODO: **OASF** `skills`/`domains` (3rd framework) as a further hop.

## Off-chain fetch — refinements (deferred 2026-06-13)
- ~404 hosts still persistently HTTP-429; a slower scheduled run would recover more.
- `exquisites.es` (200 cards) sits behind Vercel bot-protection — needs a real
  browser to fetch.
- **Promote `fetch-cards.mjs` to a Cloud Run Job** on a cron (Cloud Run can egress;
  BigQuery cannot). Currently runs locally/manually. See `docs/AGENT-DATA-MODEL.md`.

## Pre-existing known fixes (still open)
- Dashboard concentration metric uses registration owner; should use **current owner**
  (the "top owner 28.8%" is the mint-factory). See `docs/AGENT-DATA-MODEL.md`.
- **Real ENS verification** vs self-declared (ENS-prize-relevant).
- Pull **Seaport sale prices** to size the real secondary market.
- Phase 1.5 `POST /api/revalidate` webhook + Phase 2 scheduled BQ pipeline. See
  `docs/ARCHITECTURE.md`.
