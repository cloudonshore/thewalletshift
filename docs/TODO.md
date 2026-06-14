# TODO — parked work

Things intentionally deferred. Newest at top. Link to detail where it exists.

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
4. **Deeper capability fetch — "what does each agent DO".** Pull `a2aSkills` (A2A,
   via `/.well-known/agent-card.json`) and OASF `skills`/`domains`. This is the real
   answer to "how do I know what they do." Needs a second fetch hop in the pipeline.

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
