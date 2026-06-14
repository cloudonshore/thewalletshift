import Image from "next/image";
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
            <Image src="/walletshiftlogo.png" alt="The Wallet Shift" width={24} height={24} priority className="rounded-full" />
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
            their content isn&apos;t indexed yet — that&apos;s the next pass. A further{" "}
            {fmt(cov.other_cards)} carry malformed or non-standard data.
          </p>
        </div>

        {/* headline */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Cards indexed" value={fmt(cov.indexed)} sub="stored fully on-chain" tone="accent" />
          <Stat label="Named & described" value={pct1(comp.description, comp.denominator)} sub={`${fmt(comp.description)} carry a description`} />
          <Stat label="x402-payable" value={fmt(c.x402.payable)} sub={`${pct1(c.x402.payable, cov.indexed)} of indexed cards`} tone="accent" />
          {c.interactivity ? (
            <Stat
              label="Callable agents"
              value={fmt(c.interactivity.with_services)}
              sub="expose a service endpoint"
              tone="accent"
            />
          ) : (
            <Stat label="Real image" value={pct1(comp.image, comp.denominator)} sub={`only ${fmt(comp.image)} carry one`} tone="warn" />
          )}
          <Stat label="Declare a trust model" value={fmt(comp.trust)} sub={`${pct1(comp.trust, comp.denominator)} of cards`} tone="warn" />
        </div>

        {/* coverage + completeness */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card title="Coverage" hint="of all 34,556 agents">
            <SegmentBar
              segments={[
                { label: "On-chain card (indexed)", value: cov.onchain_cards, color: "#f0531f" },
                { label: "Off-chain link (not yet indexed)", value: cov.offchain_cards, color: "#38bdf8" },
                { label: "Malformed / non-standard", value: cov.other_cards, color: "#f59e0b" },
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
                label="Callable services"
                value={comp.services}
                denominator={comp.denominator}
                hint="A2A / MCP / web endpoints — the richer ones live off-chain"
              />
            </div>
          </Card>
        </div>

        {/* economics + activity */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card title="Who can actually be paid" hint="x402 support declared in the card">
            <SegmentBar
              segments={[
                { label: "Payable (x402)", value: c.x402.payable, color: "#f0531f" },
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
                { label: "Active", value: c.active.active, color: "#f0531f" },
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
                color: s.bucket === "v1" ? "#f0531f" : s.bucket === "unversioned" ? "#f59e0b" : "#fb7185",
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

        {/* interactability — can you actually call these agents? */}
        {c.interactivity && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card title="Can you actually call them?" hint="cards exposing a callable interface">
              <div className="mb-4 flex items-baseline gap-2">
                <span className="tabular text-3xl font-semibold text-accent">
                  {fmt(c.interactivity.with_services)}
                </span>
                <span className="text-sm text-muted">
                  agents expose at least one service endpoint
                </span>
              </div>
              <RankBars
                rows={[
                  { label: "A2A (agent-to-agent)", value: c.interactivity.a2a, color: "#a78bfa" },
                  { label: "web (HTTP service)", value: c.interactivity.web, color: "#38bdf8" },
                  { label: "MCP (tool server)", value: c.interactivity.mcp, color: "#f59e0b" },
                ]}
              />
              <p className="mt-3 text-xs text-muted">
                These are the standards you&apos;d use to actually invoke an agent —{" "}
                <span className="text-foreground">A2A</span> publishes its skills,{" "}
                <span className="text-foreground">MCP</span> exposes a tool list, and{" "}
                <span className="text-foreground">web</span> is a plain HTTP endpoint. The
                interactable agents host their cards off-chain, where the services list fits.
              </p>
            </Card>
            {c.reachability && (
              <Card title="Off-chain link health" hint={`${fmt(c.reachability.fetched)} links fetched`}>
                <SegmentBar
                  segments={[
                    { label: "Live card returned", value: c.reachability.buckets.ok ?? 0, color: "#f0531f" },
                    { label: "404 / not found", value: c.reachability.buckets.not_found ?? 0, color: "#fb7185" },
                    { label: "Homepage / not a card", value: c.reachability.buckets.not_a_card ?? 0, color: "#f59e0b" },
                    { label: "Dead DNS", value: c.reachability.buckets.dns_dead ?? 0, color: "#3f4654" },
                    { label: "Timeout", value: c.reachability.buckets.timeout ?? 0, color: "#64748b" },
                    { label: "Server error", value: c.reachability.buckets.server_error ?? 0, color: "#475569" },
                    { label: "Blocked", value: c.reachability.buckets.blocked ?? 0, color: "#1f2733" },
                  ].filter((s) => s.value > 0)}
                />
                <p className="mt-3 text-xs text-muted">
                  Of the {fmt(c.reachability.fetched)} off-chain links,{" "}
                  <span className="text-foreground">{fmt(c.reachability.ok)}</span> returned a live
                  card. The rest are dead, behind bot-protection, or point at a homepage — a real
                  measure of how much of the registry is still reachable.
                </p>
              </Card>
            )}
          </div>
        )}

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
