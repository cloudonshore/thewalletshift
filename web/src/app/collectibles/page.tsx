import Image from "next/image";
import Link from "next/link";
import { CollectiblesGallery } from "@/components/collectibles-gallery";
import { collectibles, fmt } from "@/lib/collectibles";

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
          <span className="tabular hidden sm:inline">as of {collectibles.generated_at}</span>
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-md border px-2.5 py-1 transition-colors hover:border-accent/50 ${
                label === "Collectibles" ? "border-accent/50 text-foreground" : "border-border text-foreground"
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

export default function Collectibles() {
  const c = collectibles;
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="py-8">
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            When the PFP is also the agent.
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            A growing slice of ERC-8004 registrations isn&apos;t individual services — it&apos;s mass-minted NFT
            collections where <span className="text-foreground">every token is also a live agent</span>. They share one
            templated skill set and differ only by trait. We strip these from{" "}
            <Link href="/services" className="text-accent hover:underline">
              Services
            </Link>{" "}
            so the signal stays clean; here&apos;s the long tail itself.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <Stat value={fmt(c.total)} label="collectible agents" />
            <Stat value={fmt(c.collections.length)} label="collections" />
            <Stat value={fmt(c.reachable)} label="with live skills read" />
          </div>
        </div>

        <CollectiblesGallery collections={c.collections} />

        <footer className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p>
            <span className="text-foreground">Methodology.</span> These are the collectible tier of the taxonomy we
            discovered from the agent corpus — agents grouped into the NFT collection they belong to by their shared
            serving host. FREAK and Normie each declare a 10,000-token collection; we index the registered-and-fetched
            subset and read live A2A skills where reachable. They are deliberately excluded from the Services directory.
            As of {c.generated_at}.
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
