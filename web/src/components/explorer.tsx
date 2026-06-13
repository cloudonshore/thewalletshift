"use client";

import { useMemo, useState } from "react";
import type { EventType, SampleAgent } from "@/lib/explorer";

const fmt = (n: number) => n.toLocaleString("en-US");

// Horizontal bars: every kind of row in the raw logbook, sized by how common it is.
export function EventBars({ types }: { types: EventType[] }) {
  const max = Math.max(...types.map((t) => t.count));
  return (
    <ul className="space-y-2.5">
      {types.map((t) => (
        <li key={t.name} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-3">
          <span className="font-mono text-xs text-foreground">{t.name}</span>
          <span className="relative h-5 overflow-hidden rounded bg-border/40">
            <span
              className="absolute inset-y-0 left-0 rounded bg-accent/30"
              style={{ width: `${(t.count / max) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center px-2 text-[11px] text-muted">
              {t.plain}
            </span>
          </span>
          <span className="tabular text-right text-xs text-foreground">{fmt(t.count)}</span>
        </li>
      ))}
    </ul>
  );
}

function X402Badge({ x402 }: { x402: string | null }) {
  if (x402 === "true")
    return <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">payable</span>;
  if (x402 === "false")
    return <span className="rounded bg-border/60 px-1.5 py-0.5 text-[11px] text-muted">no</span>;
  return <span className="text-[11px] text-muted/50">—</span>;
}

// Searchable table of real, decoded agents — the "browse it yourself" surface.
export function AgentBrowser({ agents }: { agents: SampleAgent[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return agents;
    return agents.filter((a) =>
      [a.name, a.description, a.ens ?? "", String(a.agent_id)].join(" ").toLowerCase().includes(s),
    );
  }, [q, agents]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search names, descriptions, ENS…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent/50"
        />
        <span className="shrink-0 text-xs text-muted">
          {fmt(filtered.length)} / {fmt(agents.length)}
        </span>
      </div>
      <div className="max-h-[34rem] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">ENS</th>
              <th className="px-3 py-2 font-medium">x402</th>
              <th className="px-3 py-2 font-medium">Registered</th>
              <th className="px-3 py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.agent_id} className="border-t border-border/60 align-top">
                <td className="px-3 py-2 font-mono text-muted">#{a.agent_id}</td>
                <td className="px-3 py-2 font-medium text-foreground">{a.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-accent">{a.ens ?? ""}</td>
                <td className="px-3 py-2"><X402Badge x402={a.x402} /></td>
                <td className="tabular px-3 py-2 text-xs text-muted">{a.registered}</td>
                <td className="max-w-md px-3 py-2 text-xs text-muted">{a.description}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">
                  No agents match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
