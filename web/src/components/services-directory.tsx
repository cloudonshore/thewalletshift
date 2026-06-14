"use client";

import { useEffect, useMemo, useState } from "react";
import type { Provider, ServiceCategory, EndpointHealth } from "@/lib/services";
import { fmt } from "@/lib/services";
import { haystack } from "@/lib/haystack";

const PROTO_STYLE: Record<string, string> = {
  a2a: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  web: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  mcp: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  x402: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  // endpoint health probe statuses (user opted into these colors for this feature)
  live: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  paywalled: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  dead: "bg-red-500/15 text-red-300 border-red-500/30",
};
const FILTERS = ["a2a", "mcp", "web", "x402", "live", "dead"] as const;
const FILTER_LABEL: Record<string, string> = {
  a2a: "A2A",
  mcp: "MCP",
  web: "web",
  x402: "x402",
  live: "live",
  paywalled: "paywalled",
  dead: "dead",
};

function ProtoChip({ p }: { p: string }) {
  const style = PROTO_STYLE[p];
  if (!style) return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${style}`}>
      {FILTER_LABEL[p] ?? p}
    </span>
  );
}

// colored status chip for one endpoint's health probe result (green/amber/red)
function HealthChip({ health }: { health?: EndpointHealth }) {
  if (!health) return null;
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${PROTO_STYLE[health.status]}`}
      title={`probed ${health.probe} · ${health.last_probed}`}
    >
      {health.status}
      {health.http != null && <span className="ml-1 font-mono opacity-70">{health.http}</span>}
    </span>
  );
}

// row-level one-glance health summary across an endpoint's statuses
function healthSummary(p: Provider): { live: number; paywalled: number; dead: number; probed: number } {
  let live = 0,
    paywalled = 0,
    dead = 0;
  for (const e of p.endpoints) {
    if (e.health?.status === "live") live++;
    else if (e.health?.status === "paywalled") paywalled++;
    else if (e.health?.status === "dead") dead++;
  }
  return { live, paywalled, dead, probed: live + paywalled + dead };
}

function skillsWord(p: Provider): string {
  return p.protos.includes("mcp") && !p.protos.includes("a2a") ? "tools" : "skills";
}

function ProviderRow({ p, onOpen }: { p: Provider; onOpen: () => void }) {
  const protos = [...new Set([...p.protos, ...(p.x402 ? ["x402"] : [])])];
  const hosts = [...new Set(p.endpoints.map((e) => e.host).filter(Boolean))];
  const hs = healthSummary(p);
  return (
    <li className="border-t border-border/60 first:border-t-0">
      <button
        type="button"
        onClick={onOpen}
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
                {p.skills.length} {skillsWord(p)}
              </span>
            )}
            {hs.probed > 0 && (
              <span className="inline-flex items-center gap-1.5">
                {hs.live > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-400/90">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {hs.live} live
                  </span>
                )}
                {hs.paywalled > 0 && <span className="text-amber-400/90">{hs.paywalled} paywalled</span>}
                {hs.dead > 0 && <span className="text-red-400/80">{hs.dead} dead</span>}
              </span>
            )}
            {p.kind === "onchain" && <span className="text-muted/70">on-chain card</span>}
          </div>
        </div>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {protos.map((pr) => (
            <ProtoChip key={pr} p={pr} />
          ))}
        </span>
      </button>
    </li>
  );
}

function ProviderModal({ p, onClose }: { p: Provider; onClose: () => void }) {
  // close on Escape; lock body scroll while open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const protos = [...new Set([...p.protos, ...(p.x402 ? ["x402"] : [])])];
  const lastProbed = p.endpoints.find((e) => e.health)?.health?.last_probed?.slice(0, 10) ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.name || `Agent #${p.id}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-auto w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* sticky header */}
        <div className="sticky top-0 z-10 flex items-start gap-3 rounded-t-2xl border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-lg font-semibold text-foreground">{p.name || `Agent #${p.id}`}</h2>
              {p.ens && <span className="font-mono text-xs text-accent/80">{p.ens}</span>}
              <span className="tabular font-mono text-xs text-muted">#{p.id}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded bg-border/60 px-1.5 py-0.5 text-[10px] text-muted">{p.label}</span>
              {protos.map((pr) => (
                <ProtoChip key={pr} p={pr} />
              ))}
              {p.kind && <span className="text-[11px] text-muted/70">{p.kind} card</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-md border border-border px-2 py-1 text-sm text-muted transition-colors hover:border-accent/50 hover:text-foreground"
          >
            Esc ✕
          </button>
        </div>

        {/* body */}
        <div className="px-5 py-4">
          {(p.descr || p.summary) && (
            <p className="mb-4 text-sm leading-relaxed text-foreground/80">{p.descr || p.summary}</p>
          )}

          {p.endpoints.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Endpoints</div>
              <ul className="space-y-1">
                {p.endpoints.map((e) => (
                  <li key={`${e.proto}-${e.url}`} className="flex items-center gap-2 text-xs">
                    <ProtoChip p={e.proto ?? "web"} />
                    <HealthChip health={e.health} />
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
              {lastProbed && (
                <p className="mt-1.5 text-[10px] text-muted/60">
                  Health probed {lastProbed} · advisory snapshot — your own live call is authoritative.
                </p>
              )}
            </div>
          )}

          {p.skills.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
                Live capabilities · {p.skills.length} {skillsWord(p)}
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.skills.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                    <div className="text-xs font-medium text-foreground">{s.name}</div>
                    {s.desc && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{s.desc}</p>}
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
      </div>
    </div>
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
  const [selected, setSelected] = useState<Provider | null>(null);

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
          if (f === "x402") {
            if (!p.x402) return false;
          } else if (f === "live" || f === "dead") {
            if (!p.endpoints.some((e) => e.health?.status === f)) return false;
          } else if (!p.protos.includes(f)) {
            return false;
          }
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
            results.map((p) => <ProviderRow key={p.id} p={p} onOpen={() => setSelected(p)} />)
          )}
        </ul>
      </div>

      {selected && <ProviderModal p={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
