import Image from "next/image";
import { CategoryBars, TagBars, TierBar } from "@/components/insight-charts";
import {
  callableTotal,
  classified,
  collectibleTotal,
  defById,
  fmt,
  pct1,
  serviceCategories,
  serviceTotal,
  spamTotal,
  taxonomy,
} from "@/lib/classified";
import type { AgentExample } from "@/lib/classified";

const PROTO_STYLE: Record<string, string> = {
  a2a: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  web: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  mcp: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  x402: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function Nav() {
  const links = [
    ["/agents", "Agents"],
    ["/services", "Services"],
    ["/cards", "Cards"],
    ["/explore", "Explore"],
    ["https://blog.thewalletshift.com", "Blog"],
  ];
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="/" className="flex items-center gap-2.5">
          <Image src="/walletshiftlogo.png" alt="The Wallet Shift" width={24} height={24} priority className="rounded-full" />
          <span className="font-semibold tracking-tight">The Wallet Shift</span>
        </a>
        <div className="flex items-center gap-2 text-xs text-muted">
          {links.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={`rounded-md border px-2.5 py-1 transition-colors hover:border-accent/50 ${
                label === "Services" ? "border-accent/50 text-foreground" : "border-border text-foreground"
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, sub, tone = "default" }: { label: string; value: string; sub: string; tone?: "default" | "accent" | "warn" }) {
  const c = tone === "accent" ? "text-accent" : tone === "warn" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`tabular mt-2 text-3xl font-semibold ${c}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}

function Card({ title, hint, children, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
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

function ProtoChips({ protos }: { protos: string[] }) {
  const show = protos.filter((p) => PROTO_STYLE[p]);
  if (!show.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {show.map((p) => (
        <span key={p} className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${PROTO_STYLE[p]}`}>
          {p}
        </span>
      ))}
    </span>
  );
}

function ExampleRow({ ex }: { ex: AgentExample }) {
  return (
    <li className="flex items-start gap-3 border-t border-border/50 py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-foreground">{ex.name || `Agent #${ex.id}`}</span>
          <span className="tabular shrink-0 font-mono text-[11px] text-muted">#{ex.id}</span>
        </div>
        {ex.summary && <p className="mt-0.5 text-xs leading-relaxed text-muted">{ex.summary}</p>}
      </div>
      <div className="shrink-0 pt-0.5">
        <ProtoChips protos={ex.protos} />
      </div>
    </li>
  );
}

export default function Services() {
  const biggest = serviceCategories[0];
  const withSkills = classified.categories.reduce((n, c) => n + c.with_skills, 0);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="py-10">
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            What the agents actually do.
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Of {fmt(classified.total_agents)} registered agents, only{" "}
            <span className="text-foreground">{fmt(callableTotal)}</span> expose a callable service — and we read each
            one&apos;s description and live A2A/MCP capabilities, then classified it with an LLM. Most &quot;callable&quot;
            agents turn out to be mass-minted NFT collectibles; the{" "}
            <span className="text-accent">{fmt(serviceTotal)} real-service agents</span> are the signal.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Callable agents" value={fmt(callableTotal)} sub={`${pct1(callableTotal, classified.total_agents)} of all registered`} />
          <Stat label="Real services" value={fmt(serviceTotal)} sub={`${pct1(serviceTotal, callableTotal)} of callable`} tone="accent" />
          <Stat label="Biggest category" value={fmt(biggest.count)} sub={biggest.label.replace(/ \(.*\)$/, "")} />
          <Stat label="Live capabilities read" value={fmt(withSkills)} sub="A2A skills / MCP tools fetched" />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card title="The callable set, by tier" hint={`${fmt(callableTotal)} agents with a service`}>
            <TierBar service={serviceTotal} collectible={collectibleTotal} spam={spamTotal} />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Two mass-minted NFT collections account for{" "}
              <span className="text-foreground">{fmt(collectibleTotal)}</span> of the &quot;callable&quot; agents —
              templated collectibles, not services. The real economy is the{" "}
              <span className="text-accent">{fmt(serviceTotal)}</span> service agents below.
            </p>
          </Card>
          <Card title="Top capabilities" hint="most common skill tags (service tier)">
            <TagBars data={classified.top_tags.slice(0, 12)} />
          </Card>
        </div>

        <div className="mt-3">
          <Card title="Real-service agents by category" hint={`${serviceCategories.length} categories`}>
            <CategoryBars data={serviceCategories} />
          </Card>
        </div>

        <h2 className="mb-3 mt-10 text-sm font-medium text-foreground">Inside each category</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {serviceCategories.map((c) => {
            const def = defById.get(c.key);
            return (
              <Card key={c.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-medium text-foreground">{c.label.replace(/ \(.*\)$/, "")}</h3>
                  <span className="tabular shrink-0 text-sm text-accent">{fmt(c.count)}</span>
                </div>
                {def && <p className="mt-1 text-xs leading-relaxed text-muted">{def.definition}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
                  {c.a2a > 0 && <span>A2A {fmt(c.a2a)}</span>}
                  {c.web > 0 && <span>web {fmt(c.web)}</span>}
                  {c.mcp > 0 && <span>MCP {fmt(c.mcp)}</span>}
                  {c.x402 > 0 && <span className="text-accent/80">x402 {fmt(c.x402)}</span>}
                  {c.with_skills > 0 && <span className="text-foreground/70">{fmt(c.with_skills)} with live skills</span>}
                </div>
                {c.examples.length > 0 && (
                  <ul className="mt-3">
                    {c.examples.map((ex) => (
                      <ExampleRow key={ex.id} ex={ex} />
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>

        <footer className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p>
            <span className="text-foreground">Methodology.</span> The {fmt(callableTotal)} callable agents are those
            exposing an a2a / mcp / web service in their ERC-8004 card (on-chain cards decoded in BigQuery; off-chain
            cards fetched directly). For each we fetched live A2A skills (<span className="font-mono">/.well-known/agent-card.json</span>)
            and MCP tool lists where reachable, then classified name + description + capabilities into a{" "}
            {taxonomy.count}-category taxonomy discovered from the data itself. Categories tiered into real services vs.
            templated NFT collectibles vs. placeholder/spam. As of {classified.generated_at}.
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
