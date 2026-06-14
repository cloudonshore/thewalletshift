"use client";

import { useMemo, useState } from "react";
import type { Provider, ServiceCategory } from "@/lib/services";
import { fmt } from "@/lib/services";

const PROTO_STYLE: Record<string, string> = {
  a2a: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  web: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  mcp: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  x402: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};
const FILTERS = ["a2a", "mcp", "web", "x402"] as const;
const FILTER_LABEL: Record<string, string> = { a2a: "A2A", mcp: "MCP", web: "web", x402: "x402" };

function ProtoChip({ p }: { p: string }) {
  const style = PROTO_STYLE[p];
  if (!style) return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${style}`}>
      {FILTER_LABEL[p] ?? p}
    </span>
  );
}

// Build the lowercased search haystack once per provider.
function haystack(p: Provider): string {
  return [
    p.name,
    p.summary,
    p.descr,
    p.label,
    p.ens,
    ...p.tags,
    ...p.endpoints.map((e) => e.host),
    ...p.skills.flatMap((s) => [s.name, ...s.tags]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function ProviderRow({ p }: { p: Provider }) {
  const [open, setOpen] = useState(false);
  const protos = [...new Set([...p.protos, ...(p.x402 ? ["x402"] : [])])];
  const hosts = [...new Set(p.endpoints.map((e) => e.host).filter(Boolean))];
  return (
    <li className="border-t border-border/60 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.015]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground">{p.name || `Agent #${p.id}`}</span>
            {p.ens && <span className="font-mono text-[11px] text-accent/80">{p.ens}</span>}
            <span className="tabular font-mono text-[11px] text-muted">#{p.id}</span>
            <span className="rounded bg-border/60 px-1.5 py-0.5 text-[10px] text-muted">{p.label}</span>
          </div>
          {p.summary && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{p.summary}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            {hosts.slice(0, 2).map((h) => (
              <span key={h} className="font-mono text-muted/80">
                {h}
              </span>
            ))}
            {p.skills.length > 0 && (
              <span className="text-accent/80">
                {p.skills.length} {p.protos.includes("mcp") && !p.protos.includes("a2a") ? "tools" : "skills"}
              </span>
            )}
            {p.kind === "onchain" && <span className="text-muted/70">on-chain card</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="flex flex-wrap justify-end gap-1">
            {protos.map((pr) => (
              <ProtoChip key={pr} p={pr} />
            ))}
          </span>
          <span className="text-[11px] text-muted/60">{open ? "−" : "+"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border/40 bg-background/40 px-4 py-3.5">
          {p.descr && p.descr !== p.summary && (
            <p className="mb-3 max-w-3xl text-sm leading-relaxed text-foreground/80">{p.descr}</p>
          )}

          {p.endpoints.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Endpoints</div>
              <ul className="space-y-1">
                {p.endpoints.map((e) => (
                  <li key={`${e.proto}-${e.url}`} className="flex items-center gap-2 text-xs">
                    <ProtoChip p={e.proto ?? "web"} />
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-mono text-muted hover:text-accent hover:underline"
                    >
                      {e.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.skills.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
                Live capabilities · {p.skills.length}
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.skills.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="rounded-lg border border-border/60 bg-card p-2.5">
                    <div className="text-xs font-medium text-foreground">{s.name}</div>
                    {s.desc && <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-muted">{s.desc}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span key={t} className="rounded bg-border/40 px-1.5 py-0.5 text-[10px] text-muted">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function ServicesDirectory({
  providers,
  categories,
}: {
  providers: Provider[];
  categories: ServiceCategory[];
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [protos, setProtos] = useState<Set<string>>(new Set());

  // precompute haystacks once
  const indexed = useMemo(() => providers.map((p) => ({ p, hay: haystack(p) })), [providers]);

  const toggleProto = (f: string) =>
    setProtos((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    return indexed
      .filter(({ p, hay }) => {
        if (cat && p.category !== cat) return false;
        for (const f of protos) {
          if (f === "x402" ? !p.x402 : !p.protos.includes(f)) return false;
        }
        return tokens.every((t) => hay.includes(t));
      })
      .map(({ p }) => p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexed, cat, protos, q]);

  const active = cat || protos.size > 0 || tokens.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
      {/* category facets */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-muted">Categories</div>
        <ul className="space-y-0.5 text-sm">
          <li>
            <button
              type="button"
              onClick={() => setCat(null)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03] ${
                cat === null ? "bg-white/[0.04] text-foreground" : "text-muted"
              }`}
            >
              <span>All services</span>
              <span className="tabular text-xs text-muted">{providers.length}</span>
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setCat((prev) => (prev === c.key ? null : c.key))}
                title={c.definition}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03] ${
                  cat === c.key ? "bg-white/[0.04] text-foreground" : "text-muted"
                }`}
              >
                <span className="truncate">{c.label.replace(/ \(.*\)$/, "").replace(/^DeFi: /, "")}</span>
                <span className="tabular shrink-0 text-xs text-muted">{c.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* search + filters + list */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search services, skills, tags, domains…"
              className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent/50"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => {
              const on = protos.has(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleProto(f)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium uppercase transition-colors ${
                    on ? PROTO_STYLE[f] : "border-border text-muted hover:border-accent/40"
                  }`}
                >
                  {FILTER_LABEL[f]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-1 mt-3 flex items-center justify-between text-xs text-muted">
          <span>
            <span className="tabular text-foreground">{fmt(results.length)}</span> service
            {results.length === 1 ? "" : "s"}
            {active && <span> · filtered</span>}
          </span>
          {active && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setCat(null);
                setProtos(new Set());
              }}
              className="text-muted transition-colors hover:text-accent"
            >
              Clear filters
            </button>
          )}
        </div>

        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {results.length === 0 ? (
            <li className="px-4 py-12 text-center text-sm text-muted">No services match those filters.</li>
          ) : (
            results.map((p) => <ProviderRow key={p.id} p={p} />)
          )}
        </ul>
      </div>
    </div>
  );
}
