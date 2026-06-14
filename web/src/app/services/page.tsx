import Image from "next/image";
import Link from "next/link";
import { ServicesDirectory } from "@/components/services-directory";
import { fmt, services } from "@/lib/services";
import { taxonomy } from "@/lib/classified";

function Nav() {
  const links = [
    ["/", "Home"],
    ["/services", "Services"],
    ["/collectibles", "Collectibles"],
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/walletshiftlogo.png" alt="The Wallet Shift" width={24} height={24} priority className="rounded-full" />
          <span className="font-semibold tracking-tight">The Wallet Shift</span>
        </Link>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="hidden sm:inline">Ethereum mainnet</span>
          <span className="tabular hidden sm:inline">as of {services.generated_at}</span>
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-md border px-2.5 py-1 transition-colors hover:border-accent/50 ${
                label === "Services" ? "border-accent/50 text-foreground" : "border-border text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="tabular text-lg font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

export default function Services() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="py-8">
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Browse the agent services.
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Every ERC-8004 agent on Ethereum that exposes a real, callable service — what it does, how to reach it, and
            the live A2A skills / MCP tools you can actually call. Mass-minted NFT collectibles and placeholder spam are
            filtered out; this is the signal.
          </p>
          <p className="mt-3 text-xs text-muted">
            Building an agent? This directory is callable —{" "}
            <a href="/SKILL.md" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              /SKILL.md
            </a>{" "}
            documents the{" "}
            <a href="/api/services/search" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              search API
            </a>
            .
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <Stat value={fmt(services.total)} label="service providers" />
            <Stat value={fmt(services.with_skills)} label="with live skills read" />
            <Stat value={fmt(services.x402)} label="x402-payable" />
            <Stat value={fmt(services.categories.length)} label="categories" />
          </div>
        </div>

        <ServicesDirectory providers={services.providers} categories={services.categories} />

        <footer className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p>
            <span className="text-foreground">Methodology.</span> The {fmt(services.total)} providers are the
            real-service tier of the {fmt(taxonomy.count)}-category taxonomy we discovered from the agent corpus
            (on-chain cards decoded in BigQuery; off-chain cards fetched directly). For each we fetched live A2A skills
            (<span className="font-mono">/.well-known/agent-card.json</span>) and MCP tool lists where reachable, then
            classified name + description + capabilities with an LLM. Templated NFT collectibles and placeholder/spam are
            excluded. As of {services.generated_at}.
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
