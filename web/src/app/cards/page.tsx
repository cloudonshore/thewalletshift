import Link from "next/link";
import { cards, pct1 } from "@/lib/cards";
import { fmt } from "@/lib/metrics";
import { FillBar, RankBars, SegmentBar } from "@/components/card-charts";

export const metadata = {
  title: "Agent Cards — The Wallet Shift",
  description:
    "What's inside the ERC-8004 Agent Cards: completeness, x402 economics, trust models, and schema compliance, decoded from on-chain cards.",
};

function Card({ title, hint, children }: { title?: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
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

function Stat({ label, value, sub, tone = "default" }: { label: string; value: string; sub: string; tone?: "default" | "accent" | "warn" }) {
  const color = tone === "accent" ? "text-accent" : tone === "warn" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`tabular mt-2 text-3xl font-semibold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}

export default function CardsPage() {
  const c = cards;
  const cov = c.coverage;
  const comp = c.completeness;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(52,211,153,0.6)]" />
            <span className="font-semibold tracking-tight">The Wallet Shift</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link href="/agents" className="transition-colors hover:text-foreground">
              Agents
            </Link>
            <Link href="/" className="transition-colors hover:text-foreground">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="py-8">
          <h1 className="text-3xl font-semibold tracking-tight">What&apos;s inside the cards</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Every agent can carry an <span className="text-foreground">Agent Card</span> — a JSON
            profile with its name, description, payment support, and trust model. We decode the{" "}
            <span className="text-foreground">{fmt(cov.onchain_cards)}</span> cards stored fully
            on-chain and read what the agent economy actually declares about itself.
          </p>
          <p className="mt-2 max-w-2xl text-xs text-muted/70">
            On-chain (inline) cards decode losslessly from the registry. The{" "}
            {fmt(cov.offchain_cards)} cards hosted off-chain (HTTPS/IPFS) are counted below but
            their content isn&apos;t indexed yet — that&apos;s the next pass.
          </p>
        </div>

        {/* headline */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Cards indexed" value={fmt(cov.indexed)} sub="stored fully on-chain" tone="accent" />
          <Stat label="Named & described" value={pct1(comp.description, comp.denominator)} sub={`${fmt(comp.description)} carry a description`} />
          <Stat label="x402-payable" value={fmt(c.x402.payable)} sub={`${pct1(c.x402.payable, cov.indexed)} of indexed cards`} tone="accent" />
          <Stat label="Real image" value={pct1(comp.image, comp.denominator)} sub={`only ${fmt(comp.image)} carry one`} tone="warn" />
          <Stat label="Declare a trust model" value={fmt(comp.trust)} sub={`${pct1(comp.trust, comp.denominator)} of cards`} tone="warn" />
        </div>

        {/* coverage + completeness */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card title="Coverage" hint="of all 34,556 agents">
            <SegmentBar
              segments={[
                { label: "On-chain card (indexed)", value: cov.onchain_cards, color: "#34d399" },
                { label: "Off-chain card (not yet indexed)", value: cov.offchain_cards, color: "#38bdf8" },
                { label: "No card", value: cov.empty, color: "#3f4654" },
              ]}
            />
            <p className="mt-3 text-xs text-muted">
              Just over half of all agents register with{" "}
              <span className="text-foreground">no card at all</span>. Of those that do, the
              majority put it on-chain — where it&apos;s permanent and free to read.
            </p>
          </Card>
          <Card title="What the cards contain" hint={`share of ${fmt(comp.denominator)} on-chain cards`}>
            <div className="space-y-3">
              <FillBar label="Name" value={comp.name} denominator={comp.denominator} />
              <FillBar label="Description" value={comp.description} denominator={comp.denominator} />
              <FillBar
                label="Image"
                value={comp.image}
                denominator={comp.denominator}
                hint="most cards declare an empty image string"
              />
              <FillBar
                label="Trust model"
                value={comp.trust}
                denominator={comp.denominator}
                hint="supportedTrust — how the agent expects to be verified"
              />
              <FillBar
                label="Service endpoints"
                value={comp.endpoints}
                denominator={comp.denominator}
                hint="A2A / MCP / wallet links — almost never on-chain"
              />
            </div>
          </Card>
        </div>

        {/* economics + activity */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card title="Who can actually be paid" hint="x402 support declared in the card">
            <SegmentBar
              segments={[
                { label: "Payable (x402)", value: c.x402.payable, color: "#34d399" },
                { label: "Explicitly not payable", value: c.x402.not_payable, color: "#3f4654" },
                { label: "Doesn't declare", value: c.x402.undeclared, color: "#1f2733" },
              ]}
            />
            <p className="mt-3 text-xs text-muted">
              <span className="text-foreground">{fmt(c.x402.payable)}</span> agents advertise an
              x402 payment endpoint — the machine-payable core of the agent economy.
            </p>
          </Card>
          <Card title="Live or dormant" hint="the card's self-declared active flag">
            <SegmentBar
              segments={[
                { label: "Active", value: c.active.active, color: "#34d399" },
                { label: "Inactive", value: c.active.inactive, color: "#f59e0b" },
                { label: "Unspecified", value: c.active.undeclared, color: "#1f2733" },
              ]}
            />
            <p className="mt-3 text-xs text-muted">
              Self-reported, not verified by liveness checks — but{" "}
              <span className="text-foreground">{pct1(c.active.active, cov.indexed)}</span> of
              indexed agents claim to be active.
            </p>
          </Card>
        </div>

        {/* trust models + schema */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card title="Trust models" hint="how agents expect to be verified">
            <RankBars
              rows={c.trust.map((t) => ({ label: t.model ?? "—", value: t.n }))}
              accent="#a78bfa"
            />
            <p className="mt-3 text-xs text-muted">
              ERC-8004&apos;s three trust pillars all appear —{" "}
              <span className="text-foreground">reputation</span>,{" "}
              <span className="text-foreground">crypto-economic</span> staking, and{" "}
              <span className="text-foreground">TEE attestation</span> — though only{" "}
              {pct1(comp.trust, comp.denominator)} of cards commit to one.
            </p>
          </Card>
          <Card title="Schema compliance" hint="the card's declared type URI">
            <RankBars
              rows={c.schema.map((s) => ({
                label:
                  s.bucket === "v1"
                    ? "registration-v1 (current)"
                    : s.bucket === "unversioned"
                      ? "registration (unversioned)"
                      : s.bucket === "missing"
                        ? "no type"
                        : (s.bucket ?? "—"),
                value: s.n,
                color: s.bucket === "v1" ? "#34d399" : s.bucket === "unversioned" ? "#f59e0b" : "#fb7185",
              }))}
            />
            <p className="mt-3 text-xs text-muted">
              Most cards target the current{" "}
              <span className="font-mono text-foreground">registration-v1</span> schema; a long
              tail still uses the older unversioned type or hand-rolled variants — a read on how
              fragmented the tooling still is.
            </p>
          </Card>
        </div>

        <footer className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p>
            <span className="text-foreground">Methodology.</span> Decoded from the{" "}
            {fmt(cov.indexed)} ERC-8004 Agent Cards stored inline on Ethereum mainnet (
            <span className="font-mono">data:application/json;base64</span> in the Identity
            registry), parsed directly in BigQuery — {fmt(cov.parseable)} parse cleanly as JSON.
            Off-chain cards await a fetch pass. Source: {c.source}.
          </p>
          <p className="mt-2">As of {c.generated_at} · The Wallet Shift.</p>
        </footer>
      </main>
    </div>
  );
}
