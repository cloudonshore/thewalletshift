import Image from "next/image";
import { CategoryGrowth, ServiceGrowth, TierBar } from "@/components/insight-charts";
import {
  callableTotal,
  classified,
  collectibleTotal,
  pct1,
  serviceTotal,
  spamTotal,
  x402Service,
} from "@/lib/classified";
import { fmt, getMetrics } from "@/lib/metrics";

// Statically generated, refreshed by ISR every 6h (must be a literal — Next reads
// this at build time). Visitors hit the edge-cached page; the GCS read happens once
// per regeneration. Keep in sync with REVALIDATE_SECONDS in lib/metrics.ts. See
// docs/ARCHITECTURE.md.
export const revalidate = 21600;

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

export default async function Home() {
  const m = await getMetrics();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Image src="/walletshiftlogo.png" alt="The Wallet Shift" width={24} height={24} priority className="rounded-full" />
            <span className="font-semibold tracking-tight">The Wallet Shift</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="hidden sm:inline">Ethereum mainnet</span>
            <span className="tabular hidden sm:inline">as of {m.generated_at}</span>
            <a
              href="/agents"
              className="rounded-md border border-border px-2.5 py-1 text-foreground transition-colors hover:border-accent/50"
            >
              Agents
            </a>
            <a
              href="/services"
              className="rounded-md border border-border px-2.5 py-1 text-foreground transition-colors hover:border-accent/50"
            >
              Services
            </a>
            <a
              href="/cards"
              className="rounded-md border border-border px-2.5 py-1 text-foreground transition-colors hover:border-accent/50"
            >
              Cards
            </a>
            <a
              href="/explore"
              className="rounded-md border border-border px-2.5 py-1 text-foreground transition-colors hover:border-accent/50"
            >
              Explore
            </a>
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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Agents registered" value={fmt(classified.total_agents)} sub="ERC-8004 identities" />
          <Stat label="Callable agents" value={fmt(callableTotal)} sub="expose a service endpoint" />
          <Stat label="Real services" value={fmt(serviceTotal)} sub="after stripping collectibles" tone="accent" />
          <Stat label="x402-payable" value={fmt(x402Service)} sub={`${pct1(x402Service, serviceTotal)} of real services`} tone="accent" />
        </div>

        <div className="mt-3">
          <Card
            title="The shift, over time"
            hint="cumulative registrations — service vs. the long tail"
          >
            <ServiceGrowth data={classified.growth} />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              The headline count keeps climbing, but the{" "}
              <span className="text-accent">{fmt(serviceTotal)} agents that actually provide a service</span> are a
              thin sliver. Most growth is empty registrations and mass-minted NFT collectibles.
            </p>
          </Card>
        </div>

        <div className="mt-3">
          <Card title="Most “callable” agents aren’t services" hint={`${fmt(callableTotal)} callable, by tier`}>
            <TierBar service={serviceTotal} collectible={collectibleTotal} spam={spamTotal} />
            <div className="mt-4 text-right">
              <a href="/services" className="text-xs text-accent hover:underline">
                Explore what they do →
              </a>
            </div>
          </Card>
        </div>

        <div className="mt-3">
          <Card title="How the service mix grew" hint="real services by category · cumulative">
            <CategoryGrowth
              data={classified.category_growth.series}
              categories={classified.category_growth.categories}
            />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              DeFi yield/rebalancing dominates by volume — ~90% (408) is a single platform,{" "}
              <span className="text-foreground">Zyfai</span>, deploying one ZK rebalancer agent per
              user wallet. Toggle it off in the legend to see how the smaller categories are growing.
            </p>
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
          <p className="mt-2">
            The Wallet Shift · built at ETHGlobal New York 2026 · built by{" "}
            <a
              href="https://x.com/cloudonshoree"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-accent hover:underline"
            >
              Sam Walker
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
