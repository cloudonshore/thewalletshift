import Image from "next/image";
import Link from "next/link";
import { AgentsTable } from "@/components/agents-table";

export const metadata = {
  title: "All agents — The Wallet Shift",
  description: "Browse and filter all 34,556 ERC-8004 agents on Ethereum mainnet, decoded.",
};

export default function AgentsPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/walletshiftlogo.png" alt="The Wallet Shift" width={24} height={24} priority className="rounded-full" />
            <span className="font-semibold tracking-tight">The Wallet Shift</span>
          </Link>
          <Link href="/" className="text-xs text-muted transition-colors hover:text-foreground">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-24">
        <div className="py-8">
          <h1 className="text-3xl font-semibold tracking-tight">Every agent</h1>
          <p className="mt-3 max-w-2xl text-muted">
            All 34,556 ERC-8004 agents on Ethereum mainnet, decoded from the registry. Owner is the{" "}
            <span className="text-foreground">current</span> NFT holder. Search and filter live —
            it&apos;s the whole set, rendered one screen at a time.
          </p>
        </div>
        <AgentsTable />
      </main>
    </div>
  );
}
