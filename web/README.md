# The Wallet Shift — frontend

The Next.js 15 app for [The Wallet Shift](../README.md), the live dashboard for the
on-chain ERC-8004 AI agent economy. App Router · TypeScript · Tailwind · Recharts.

## Pages

- **`/`** — the dashboard: agent population, growth, reputation and x402 signals.
- **`/services`** — searchable directory of the 711 real callable services, each row
  opening a detail modal with endpoints + live A2A skills / MCP tools and health chips.
- **`/collectibles`** — gallery of the 1,268 collectible-tier agents grouped into the
  NFT collections they are (FREAK / Normie / experimental tail).

Agent-facing surfaces: `/SKILL.md` (an installable skill), `/llms.txt`, and the
`/api/services/*` JSON API (search + per-service detail).

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

Type-check and lint with the local binaries (the user's global `npm`/`npx` config
401s — see the root `CLAUDE.md`):

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next lint
```

> Don't run `npm run build` while `next dev` is live — it clobbers the shared `.next`
> and the dev server then 500s.

## Data

The pages read bundled JSON in `src/data/` (`services.json`, `collectibles.json`,
`classified.json`, `taxonomy.json`), built by the pipeline scripts in `../scripts/`.
The dashboard's `metrics.json` is fetched server-side from GCS at runtime (ISR), with
the bundled copy as the build/offline fallback. See `../docs/ARCHITECTURE.md`.

## Deploy

Auto-deploys on push to `main` (Firebase App Hosting, root dir `web`). Manual rollout:

```bash
firebase apphosting:rollouts:create thewalletshift -b main
```
