"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GrowthPoint, OwnerRow, UriType, X402 } from "@/lib/metrics";
import { cumulativeGrowth, fmt, shortAddr } from "@/lib/metrics";

const ACCENT = "#34d399";
const GRID = "#1a1e26";
const AXIS = "#868e9e";

const tooltipStyle = {
  background: "#0d0f14",
  border: "1px solid #1a1e26",
  borderRadius: 8,
  fontSize: 12,
  color: "#e7e9ee",
};

export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const series = cumulativeGrowth(data);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
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
          formatter={(v) => [fmt(Number(v)), "Cumulative agents"]}
          labelStyle={{ color: AXIS }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#g)"
          dot={{ r: 2, fill: ACCENT }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OwnerBars({ data }: { data: OwnerRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
      >
        <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} hide />
        <YAxis
          type="category"
          dataKey="owner"
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={104}
          tickFormatter={shortAddr}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          formatter={(v) => [fmt(Number(v)), "agents"]}
          labelFormatter={(l) => shortAddr(String(l))}
        />
        <Bar dataKey="agents" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={i === 0 ? "#f59e0b" : ACCENT} fillOpacity={i === 0 ? 1 : 0.55} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const URI_COLORS: Record<string, string> = {
  empty: "#3f4654",
  onchain: "#34d399",
  https: "#38bdf8",
  ipfs: "#a78bfa",
  other: "#f59e0b",
  http: "#fb7185",
};
const URI_LABELS: Record<string, string> = {
  empty: "No metadata",
  onchain: "On-chain card",
  https: "HTTPS",
  ipfs: "IPFS",
  other: "Other",
  http: "HTTP",
};

export function MetadataDonut({ data }: { data: UriType[] }) {
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="agents"
            nameKey="type"
            innerRadius={52}
            outerRadius={84}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={URI_COLORS[d.type] ?? "#3f4654"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, n) => [fmt(Number(v)), URI_LABELS[String(n)] ?? String(n)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.type} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: URI_COLORS[d.type] ?? "#3f4654" }}
            />
            <span className="text-muted">{URI_LABELS[d.type] ?? d.type}</span>
            <span className="tabular ml-auto text-foreground">{fmt(d.agents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function X402Bar({ data }: { data: X402 }) {
  const total = data.supported + data.unsupported + data.unknown;
  const segs = [
    { key: "Payable (x402)", value: data.supported, color: "#34d399" },
    { key: "Not payable", value: data.unsupported, color: "#3f4654" },
    { key: "Unspecified", value: data.unknown, color: "#1f2733" },
  ];
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {segs.map((s) => (
          <div
            key={s.key}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.key}: ${fmt(s.value)}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {segs.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted">{s.key}</span>
            <span className="tabular ml-auto text-foreground">{fmt(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
