"use client";

import { useEffect, useMemo, useState } from "react";
import type { Collection, Member } from "@/lib/collectibles";
import { fmt } from "@/lib/collectibles";

// A small horizontal share bar — used for faction / sub-collection breakdowns.
function TraitBar({ name, count, max }: { name: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-muted" title={name}>
        {name}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-border/50">
        <span className="block h-full rounded-full bg-accent/60" style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular w-8 shrink-0 text-right text-muted">{count}</span>
    </li>
  );
}

function Stat({ value, label, tone = "default" }: { value: string; label: string; tone?: "default" | "accent" }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`tabular text-sm font-semibold ${tone === "accent" ? "text-accent" : "text-foreground"}`}>
        {value}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

function CollectionCard({ c, onOpen }: { c: Collection; onOpen: () => void }) {
  const max = c.traits[0]?.count ?? 0;
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{c.name}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
            {c.host &&
              (c.site ? (
                <a
                  href={c.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-muted transition-colors hover:text-accent hover:underline"
                >
                  {c.host} ↗
                </a>
              ) : (
                <span className="font-mono">{c.host}</span>
              ))}
            {c.kind && <span className="rounded bg-border/60 px-1.5 py-0.5">{c.kind} card</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-2xl font-semibold text-foreground">{fmt(c.indexed)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">
            {c.declared_size ? `of ${fmt(c.declared_size)}` : "indexed"}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted">{c.blurb}</p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        <Stat value={fmt(c.reachable)} label="reachable" tone="accent" />
        <Stat value={fmt(c.trait_count)} label={`${c.trait_label.toLowerCase()}${c.trait_count === 1 ? "" : "s"}`} />
        {c.x402 > 0 && <Stat value={fmt(c.x402)} label="x402" tone="accent" />}
      </div>

      {c.shared_skills.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
            Shared toolkit · {c.shared_skills.length} {c.shared_skills.length === 1 ? "skill" : "skills"}
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {c.shared_skills.map((s) => (
              <li
                key={s.name}
                title={s.desc}
                className="rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-foreground/80"
              >
                {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* breakdown preview — only when the trait set is small enough to be meaningful */}
      {c.trait_count <= 30 && c.traits.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
            By {c.trait_label.toLowerCase()}
          </div>
          <ul className="space-y-1">
            {c.traits.slice(0, 5).map((t) => (
              <TraitBar key={t.name} name={t.name} count={t.count} max={max} />
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="mt-5 w-full rounded-lg border border-border py-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-foreground"
      >
        Browse {fmt(c.indexed)} {c.indexed === 1 ? "agent" : "agents"} →
      </button>
    </section>
  );
}

function MemberRow({ m, label }: { m: Member; label: string }) {
  return (
    <li className="flex items-center gap-2 border-t border-border/50 px-3 py-2 text-xs first:border-t-0">
      <span className="min-w-0 flex-1 truncate text-foreground/90">{m.name || `Agent #${m.id}`}</span>
      {m.trait && (
        <span className="shrink-0 rounded bg-border/50 px-1.5 py-0.5 text-[10px] text-muted" title={label}>
          {m.trait}
        </span>
      )}
      <span className="tabular shrink-0 font-mono text-[10px] text-muted/70">#{m.id}</span>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.reachable ? "bg-accent" : "bg-border"}`}
        title={m.reachable ? "live skills read" : "not reachable"}
      />
    </li>
  );
}

function CollectionModal({ c, onClose }: { c: Collection; onClose: () => void }) {
  const [q, setQ] = useState("");

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

  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const members = useMemo(() => {
    if (!tokens.length) return c.members;
    return c.members.filter((m) => {
      const hay = `${m.name ?? ""} ${m.trait ?? ""} ${m.id}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.members, q]);

  const max = c.traits[0]?.count ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={c.name}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-auto w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 rounded-t-2xl border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-lg font-semibold text-foreground">{c.name}</h2>
              {c.host &&
                (c.site ? (
                  <a
                    href={c.site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-muted transition-colors hover:text-accent hover:underline"
                  >
                    {c.host} ↗
                  </a>
                ) : (
                  <span className="font-mono text-xs text-muted">{c.host}</span>
                ))}
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {fmt(c.indexed)} indexed{c.declared_size ? ` of a ${fmt(c.declared_size)} collection` : ""} ·{" "}
              {fmt(c.reachable)} reachable · {c.mechanic}
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

        <div className="px-5 py-4">
          <p className="mb-4 text-sm leading-relaxed text-foreground/80">{c.blurb}</p>

          {c.shared_skills.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
                Shared capabilities · every member exposes these
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {c.shared_skills.map((s) => (
                  <li key={s.name} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                    <div className="text-xs font-medium text-foreground">{s.name}</div>
                    {s.desc && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{s.desc}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* experimental: list the distinct sub-collections */}
          {c.subcollections && c.subcollections.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
                {c.subcollections.length} collections
              </div>
              <ul className="space-y-1">
                {c.subcollections.map((s) => (
                  <li key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-32 shrink-0 truncate font-medium text-foreground/90">{s.name}</span>
                    {s.host && <span className="hidden font-mono text-muted/70 sm:inline">{s.host}</span>}
                    <span className="tabular ml-auto shrink-0 text-muted">
                      {s.indexed} · {s.reachable} reachable
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* trait breakdown bars when small enough to read */}
          {c.trait_count <= 30 && c.traits.length > 0 && !c.subcollections && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
                {fmt(c.trait_count)} {c.trait_label.toLowerCase()}s
              </div>
              <ul className="space-y-1">
                {c.traits.map((t) => (
                  <TraitBar key={t.name} name={t.name} count={t.count} max={max} />
                ))}
              </ul>
            </div>
          )}

          {/* member browser */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted">Members</span>
              <span className="text-[11px] text-muted">
                <span className="tabular text-foreground">{fmt(members.length)}</span>
                {tokens.length > 0 ? " match" : ` of ${fmt(c.members.length)}`}
              </span>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${c.name} by name${c.trait_count > 1 ? `, ${c.trait_label.toLowerCase()}` : ""}, #id…`}
              className="mb-2 w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent/50"
            />
            <ul className="max-h-80 overflow-y-auto rounded-xl border border-border bg-background/30">
              {members.length === 0 ? (
                <li className="px-3 py-8 text-center text-xs text-muted">No members match.</li>
              ) : (
                members.slice(0, 400).map((m) => <MemberRow key={m.id} m={m} label={c.trait_label} />)
              )}
            </ul>
            {members.length > 400 && (
              <p className="mt-1.5 text-center text-[11px] text-muted">
                Showing first 400 · refine search to narrow.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CollectiblesGallery({ collections }: { collections: Collection[] }) {
  const [selected, setSelected] = useState<Collection | null>(null);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <CollectionCard key={c.key} c={c} onOpen={() => setSelected(c)} />
        ))}
      </div>
      {selected && <CollectionModal c={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
