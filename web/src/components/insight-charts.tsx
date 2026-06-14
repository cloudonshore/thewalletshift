"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryStat, GrowthPoint } from "@/lib/classified";

const ACCENT = "#34d399"; // real service
const VIOLET = "#a78bfa"; // collectibles / templated
const GREY = "#3f4654"; // non-callable long tail
const GRID = "#1a1e26";
const AXIS = "#868e9e";
const fmt = (n: number) => n.toLocaleString("en-US");

const tooltipStyle = {
  background: "#0d0f14",
  border: "1px solid #1a1e26",
  borderRadius: 8,
  fontSize: 12,
  color: "#e7e9ee",
};

// ---- the one home-page chart: total registrations split into service / other --
// Stacked area summing to total: real-service (bottom, bright), other-callable
// (collectibles+spam), and the non-callable long tail (top, grey). Click a legend
// item to drop that series from the stack — the chart rescales, so hiding the big
// "no callable service" band reveals the service-vs-collectibles detail.
const GROWTH_SERIES = [
  { key: "service", label: "Real-service agents", color: ACCENT, fillOpacity: 0.85, strokeWidth: 1.5 },
  { key: "other_callable", label: "NFT collectibles / spam (callable but templated)", color: VIOLET, fillOpacity: 0.35, strokeWidth: 1 },
  { key: "non_callable", label: "No callable service", color: GREY, fillOpacity: 0.4, strokeWidth: 1 },
] as const;
const GROWTH_LABELS: Record<string, string> = {
  service: "Real-service agents",
  other_callable: "NFT collectibles / spam",
  non_callable: "No callable service",
};

export function ServiceGrowth({ data }: { data: GrowthPoint[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < GROWTH_SERIES.length - 1) next.add(key); // keep at least one series
      return next;
    });

  const series = data.map((d) => ({
    date: d.date,
    service: d.service,
    other_callable: Math.max(0, d.callable - d.service),
    non_callable: Math.max(0, d.total - d.callable),
    total: d.total,
  }));
  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="date"
            stroke={AXIS}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={48}
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
          />
          <YAxis
            stroke={AXIS}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" })}
            formatter={(v, n) => [fmt(Number(v)), GROWTH_LABELS[String(n)] ?? String(n)]}
          />
          {GROWTH_SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stackId="1"
              stroke={s.color}
              strokeWidth={s.strokeWidth}
              fill={s.color}
              fillOpacity={s.fillOpacity}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {GROWTH_SERIES.map((s) => {
          const off = hidden.has(s.key);
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={!off}
                title="Click to toggle on the chart"
                className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-70"
              >
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color, opacity: off ? 0.25 : 1 }} />
                <span className={off ? "text-muted line-through" : "text-foreground"}>{s.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- horizontal category bars (real-service categories) ---------------------
export function CategoryBars({ data }: { data: CategoryStat[] }) {
  const rows = data.map((c) => ({ ...c, short: c.label.replace(/ \(.*\)$/, "").replace(/^DeFi: /, "") }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 30)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
        <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} hide />
        <YAxis
          type="category"
          dataKey="short"
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={200}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          formatter={(v) => [fmt(Number(v)), "agents"]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: "right", fill: AXIS, fontSize: 11 }}>
          {rows.map((_, i) => (
            <Cell key={i} fill={ACCENT} fillOpacity={0.4 + 0.5 * (1 - i / Math.max(1, rows.length))} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- segmented composition bar (callable set: service / collectible / spam) --
export function TierBar({ service, collectible, spam }: { service: number; collectible: number; spam: number }) {
  const total = service + collectible + spam;
  const segs = [
    { key: "Real services", value: service, color: ACCENT },
    { key: "NFT collectibles", value: collectible, color: VIOLET },
    { key: "Placeholder / spam", value: spam, color: GREY },
  ];
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {segs.map((s) => (
          <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.key}: ${fmt(s.value)}`} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {segs.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted">{s.key}</span>
            <span className="tabular ml-auto text-foreground">
              {fmt(s.value)} <span className="text-muted">· {((s.value / total) * 100).toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- top capability tags ----------------------------------------------------
export function TagBars({ data }: { data: { tag: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
        <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} hide />
        <YAxis type="category" dataKey="tag" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={140} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} formatter={(v) => [fmt(Number(v)), "agents"]} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={ACCENT} fillOpacity={0.6} label={{ position: "right", fill: AXIS, fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
