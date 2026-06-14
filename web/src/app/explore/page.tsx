import Image from "next/image";
import Link from "next/link";
import { AgentBrowser, EventBars } from "@/components/explorer";
import { explorer } from "@/lib/explorer";

export const metadata = {
  title: "Explore the data — The Wallet Shift",
  description:
    "What the ERC-8004 dataset actually is: one logbook of on-chain events, decoded into something you can read and browse.",
};

const e = explorer;
const fmt = (n: number) => n.toLocaleString("en-US");

export default function Explore() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/walletshiftlogo.png" alt="The Wallet Shift" width={24} height={24} priority className="rounded-full" />
            <span className="font-semibold tracking-tight">The Wallet Shift</span>
          </Link>
          <Link href="/" className="text-xs text-muted transition-colors hover:text-foreground">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        <div className="py-10">
          <h1 className="text-3xl font-semibold tracking-tight">What the data actually is</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Every number on this site comes from <span className="text-foreground">one table</span>.
            The two ERC-8004 smart contracts on Ethereum are public logbooks: each time something
            happens, the contract writes one line. We copied every line —{" "}
            <span className="tabular text-foreground">{fmt(e.total_logs)}</span> of them — into a
            table called <span className="font-mono text-foreground">logs_2026</span>. Each row is one
            thing that happened. That&apos;s the whole dataset.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-foreground">
              The whole dataset is just 7 kinds of events
            </h2>
            <p className="mt-1 text-xs text-muted">
              Decoded from the contract ABI. Every chart on the dashboard is counting and grouping
              these rows.
            </p>
          </div>
          <EventBars types={e.event_types} />
          <p className="mt-4 text-xs leading-relaxed text-muted">
            So <span className="text-foreground">&ldquo;34,556 agents&rdquo;</span> is just the count of{" "}
            <span className="font-mono">Registered</span> rows.{" "}
            <span className="text-foreground">MetadataSet</span> outnumbers registrations — agents
            keep editing their profiles after creation, which is how we can tell a{" "}
            <span className="text-foreground">live, maintained</span> agent from an abandoned shell.
          </p>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-foreground">Browse real agents</h2>
            <p className="mt-1 text-xs text-muted">
              A sample of {fmt(e.sample_agents.length)} agents that registered an on-chain profile,
              decoded into plain fields. Search by name, description, or ENS.
            </p>
          </div>
          <AgentBrowser agents={e.sample_agents} />
        </section>

        <footer className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          Snapshot {e.generated_at} · decoded directly from ERC-8004 logs on Ethereum mainnet via
          BigQuery. This page exists to make the raw data legible — it&apos;s the same data behind the{" "}
          <Link href="/" className="text-accent hover:underline">
            dashboard
          </Link>
          .
        </footer>
      </main>
    </div>
  );
}
