import { GrowthChart, MetadataDonut, OwnerBars, X402Bar } from "@/components/charts";
import { fmt, metrics, pct } from "@/lib/metrics";

const m = metrics;
const emptyPct = (m.summary.empty_metadata / m.summary.agents) * 100;
const payablePct = (m.summary.x402_payable / m.summary.onchain_cards) * 100;

function Card({
  title,
  hint,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      {title && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          {hint && <span className="text-xs text-muted">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "accent" | "warn";
}) {
  const valueColor =
    tone === "accent" ? "text-accent" : tone === "warn" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`tabular mt-2 text-3xl font-semibold ${valueColor}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(52,211,153,0.6)]" />
            <span className="font-semibold tracking-tight">The Wallet Shift</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span>Ethereum mainnet</span>
            <span className="hidden sm:inline">·</span>
            <span className="tabular hidden sm:inline">as of {m.generated_at}</span>
            <a
              href="https://blog.thewalletshift.com"
              className="rounded-md border border-border px-2.5 py-1 text-foreground transition-colors hover:border-accent/50"
            >
              Blog
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="py-10">
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            The live scoreboard for the on-chain agent economy.
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Wallets are shifting from humans to autonomous agents. We index that shift from the
            ERC-8004 registries — who the agents are, how fast they&apos;re growing, which are
            reputable, and which can be paid.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Agents registered" value={fmt(m.summary.agents)} sub="ERC-8004 identities" tone="accent" />
          <Stat label="Unique operators" value={fmt(m.summary.unique_owners)} sub="wallets behind them" />
          <Stat label="x402-payable" value={fmt(m.summary.x402_payable)} sub={`${pct(payablePct)} of on-chain cards`} tone="accent" />
          <Stat label="Empty shells" value={pct(emptyPct)} sub={`${fmt(m.summary.empty_metadata)} with no metadata`} tone="warn" />
          <Stat label="Top-wallet share" value={pct(m.summary.top1_owner_pct)} sub="owned by one address" tone="warn" />
        </div>

        <div className="mt-3">
          <Card title="The shift, over time" hint="cumulative agent registrations">
            <GrowthChart data={m.growth_daily} />
          </Card>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card title="Operator concentration" hint="top 10 wallets by agents">
            <OwnerBars data={m.top_owners} />
            <p className="mt-3 text-xs text-muted">
              The top 10 operators control{" "}
              <span className="text-foreground">{pct(m.summary.top10_owner_pct)}</span> of all agents
              — one wallet alone holds {pct(m.summary.top1_owner_pct)}.
            </p>
          </Card>
          <Card title="Metadata quality" hint="how agents describe themselves">
            <MetadataDonut data={m.uri_types} />
            <p className="mt-3 text-xs text-muted">
              Over half of agents register with{" "}
              <span className="text-foreground">no metadata at all</span> — the real, described agent
              population is far smaller than the headline count.
            </p>
          </Card>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card title="Who can actually be paid" hint="x402 support among on-chain cards">
            <X402Bar data={m.x402} />
            <p className="mt-3 text-xs text-muted">
              <span className="text-foreground">{fmt(m.summary.x402_payable)}</span> agents declare
              x402 payment support in their on-chain card.
            </p>
          </Card>
          <Card title="Reputation leaderboard" hint="≥3 unique reviewers (Sybil-guarded)">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 text-right font-medium">Reviewers</th>
                  <th className="pb-2 text-right font-medium">Feedback</th>
                  <th className="pb-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {m.reputation_top.slice(0, 8).map((r) => (
                  <tr key={r.agent_id} className="border-t border-border/60">
                    <td className="py-1.5 font-mono text-foreground">#{r.agent_id}</td>
                    <td className="py-1.5 text-right text-foreground">{r.unique_clients}</td>
                    <td className="py-1.5 text-right text-muted">{r.feedback_count}</td>
                    <td className="py-1.5 text-right text-accent">{r.avg_score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <footer className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p>
            <span className="text-foreground">Methodology.</span> Every figure is decoded directly
            from the ERC-8004 Identity &amp; Reputation registries on Ethereum mainnet (
            <span className="font-mono">0x8004a169…</span> /{" "}
            <span className="font-mono">0x8004baa1…</span>) via Google BigQuery, and is reproducible.
            Reputation requires ≥3 distinct reviewers to count, as a Sybil guard. Source: {m.source}.
          </p>
          <p className="mt-2">The Wallet Shift · built at ETHGlobal New York 2026.</p>
        </footer>
      </main>
    </div>
  );
}
