"use client";

import { fmt } from "@/lib/metrics";

// Lightweight, Recharts-free primitives for the small categorical breakdowns on
// /cards. These are 2–6 category splits — a segmented bar + a ranked-bar list read
// better (and ship less JS) than a full charting component.

type Seg = { label: string; value: number; color: string; hint?: string };

// A single horizontal stacked bar with a legend below. Generalizes the dashboard's
// X402Bar to any set of segments.
export function SegmentBar({ segments }: { segments: Seg[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${fmt(s.value)}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            {s.hint && <span className="text-xs text-muted/60">{s.hint}</span>}
            <span className="tabular ml-auto text-foreground">{fmt(s.value)}</span>
            <span className="tabular w-12 text-right text-xs text-muted">
              {((s.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Row = { label: string; value: number; color?: string };

// Ranked horizontal bars, sized against the largest value. For trust models,
// schema buckets, image hosting — anything where the relative magnitudes matter.
export function RankBars({ rows, accent = "#34d399" }: { rows: Row[]; accent?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-muted">{r.label}</span>
            <span className="tabular text-foreground">{fmt(r.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? accent }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// A labeled completeness bar: "how many of N cards carry this field".
export function FillBar({
  label,
  value,
  denominator,
  hint,
}: {
  label: string;
  value: number;
  denominator: number;
  hint?: string;
}) {
  const p = denominator ? (value / denominator) * 100 : 0;
  return (
    <div className="text-sm">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-foreground">{label}</span>
        <span className="tabular text-muted">
          {fmt(value)} · <span className="text-foreground">{p.toFixed(0)}%</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${p}%`, opacity: p > 50 ? 1 : 0.7 }}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-muted/70">{hint}</p>}
    </div>
  );
}
