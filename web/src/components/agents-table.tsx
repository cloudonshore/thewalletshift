"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface Agent {
  id: number;
  owner: string | null;
  reg: string;
  kind: string;
  uri: string | null;
  name: string | null;
  ens: string | null;
  x402: string | null;
  active: string | null;
  trust: string | null;
  descr: string | null;
}

const short = (a: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? "");
const fmt = (n: number) => n.toLocaleString("en-US");

const KIND_STYLE: Record<string, string> = {
  onchain: "bg-accent/15 text-accent",
  https: "bg-sky-400/15 text-sky-300",
  ipfs: "bg-violet-400/15 text-violet-300",
  other: "bg-amber-400/15 text-amber-300",
  empty: "bg-border/60 text-muted",
};

const col = createColumnHelper<Agent>();
const columns = [
  col.accessor("id", { header: "ID", cell: (c) => <span className="font-mono text-muted">#{c.getValue()}</span> }),
  col.accessor("name", {
    header: "Name",
    cell: (c) => <span className="font-medium text-foreground">{c.getValue() ?? <span className="text-muted/40">—</span>}</span>,
  }),
  col.accessor("owner", {
    header: "Current owner",
    cell: (c) => <span className="font-mono text-xs text-muted">{short(c.getValue())}</span>,
    enableGlobalFilter: true,
  }),
  col.accessor("kind", {
    header: "Card",
    filterFn: "equalsString",
    cell: (c) => (
      <span className={`rounded px-1.5 py-0.5 text-[11px] ${KIND_STYLE[c.getValue()] ?? "bg-border/60 text-muted"}`}>
        {c.getValue()}
      </span>
    ),
  }),
  col.accessor("x402", {
    header: "x402",
    filterFn: "equalsString",
    cell: (c) =>
      c.getValue() === "true" ? (
        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">pay</span>
      ) : c.getValue() === "false" ? (
        <span className="text-[11px] text-muted">no</span>
      ) : (
        <span className="text-[11px] text-muted/40">—</span>
      ),
  }),
  col.accessor("active", {
    header: "Status",
    filterFn: "equalsString",
    cell: (c) =>
      c.getValue() === "true" ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-accent">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />live
        </span>
      ) : c.getValue() === "false" ? (
        <span className="text-[11px] text-amber-400">dormant</span>
      ) : (
        <span className="text-[11px] text-muted/40">—</span>
      ),
  }),
  col.accessor("trust", {
    header: "Trust",
    cell: (c) => {
      const v = c.getValue();
      if (!v) return <span className="text-[11px] text-muted/40">—</span>;
      return (
        <span title={v} className="text-[11px] text-violet-300">
          {v.split(",")[0]}
          {v.includes(",") && <span className="text-muted/50"> +{v.split(",").length - 1}</span>}
        </span>
      );
    },
  }),
  col.accessor("ens", {
    header: "ENS",
    cell: (c) => <span className="font-mono text-xs text-accent">{c.getValue() ?? ""}</span>,
  }),
  col.accessor("reg", { header: "Registered", cell: (c) => <span className="tabular text-xs text-muted">{c.getValue()}</span> }),
  col.accessor("uri", {
    header: "Profile",
    enableSorting: false,
    cell: (c) => {
      const u = c.getValue();
      if (!u) return <span className="text-[11px] text-muted/40">—</span>;
      const href = u.startsWith("http") ? u : u.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${u.slice(7)}` : null;
      return href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" title={u} className="text-xs text-sky-300 hover:underline">
          {u}
        </a>
      ) : (
        <span title={u} className="text-xs text-muted">{u}</span>
      );
    },
  }),
  col.accessor("descr", {
    header: "Description",
    cell: (c) => <span className="text-xs text-muted">{c.getValue() ?? ""}</span>,
  }),
];

// grid template shared by header + rows so columns line up under virtualization
const GRID =
  "4.5rem minmax(6.5rem,1.1fr) 8.5rem 4.5rem 3.25rem 4rem 5rem 5rem 6rem minmax(8rem,1.3fr) minmax(8rem,1.4fr)";

const KINDS = ["onchain", "https", "ipfs", "other", "empty"];

export function AgentsTable() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "id", desc: false }]);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAgents(d.agents as Agent[]))
      .catch(() => setError(true));
  }, []);

  const table = useReactTable({
    data: agents ?? [],
    columns,
    state: { globalFilter, columnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
    // search ALL text columns — TanStack otherwise sniffs the first row (agent #0
    // is an empty shell with null name/uri/ens/descr) and drops those columns.
    getColumnCanGlobalFilter: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 14,
  });

  const kindFilter = (columnFilters.find((f) => f.id === "kind")?.value as string) ?? "";
  const x402Filter = (columnFilters.find((f) => f.id === "x402")?.value as string) ?? "";
  const activeFilter = (columnFilters.find((f) => f.id === "active")?.value as string) ?? "";
  const setColFilter = (id: string, value: string) =>
    setColumnFilters((prev) => prev.filter((f) => f.id !== id).concat(value ? [{ id, value }] : []));

  if (error) return <p className="text-sm text-muted">Couldn’t load the agent dataset. Try refreshing.</p>;
  if (!agents) return <p className="text-sm text-muted">Loading 34,556 agents…</p>;

  return (
    <div>
      {/* controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search id, name, owner, ENS, description…"
          className="min-w-[16rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent/50"
        />
        <select
          value={kindFilter}
          onChange={(e) => setColFilter("kind", e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-accent/50"
        >
          <option value="">all cards</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-border text-xs">
          {[
            ["", "x402: any"],
            ["true", "payable"],
            ["false", "no"],
          ].map(([v, label]) => (
            <button
              key={label}
              onClick={() => setColFilter("x402", v)}
              className={`px-2.5 py-2 transition-colors ${x402Filter === v ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-border text-xs">
          {[
            ["", "status: any"],
            ["true", "live"],
            ["false", "dormant"],
          ].map(([v, label]) => (
            <button
              key={label}
              onClick={() => setColFilter("active", v)}
              className={`px-2.5 py-2 transition-colors ${activeFilter === v ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="shrink-0 text-xs text-muted">{fmt(rows.length)} / {fmt(agents.length)}</span>
      </div>

      {/* table */}
      <div className="rounded-lg border border-border">
        {/* header */}
        <div
          className="grid items-center border-b border-border bg-card px-3 py-2 text-xs uppercase tracking-wide text-muted"
          style={{ gridTemplateColumns: GRID }}
        >
          {table.getHeaderGroups()[0].headers.map((h) => (
            <button
              key={h.id}
              onClick={h.column.getToggleSortingHandler()}
              className={`flex items-center gap-1 text-left font-medium ${h.column.getCanSort() ? "cursor-pointer hover:text-foreground" : ""}`}
            >
              {flexRender(h.column.columnDef.header, h.getContext())}
              <span className="text-accent">{{ asc: "↑", desc: "↓" }[h.column.getIsSorted() as string] ?? ""}</span>
            </button>
          ))}
        </div>

        {/* virtualized body */}
        <div ref={parentRef} className="max-h-[60vh] overflow-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              return (
                <div
                  key={row.id}
                  className="absolute grid w-full items-center border-b border-border/50 px-3 text-sm hover:bg-foreground/[0.02]"
                  style={{
                    gridTemplateColumns: GRID,
                    height: vi.size,
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} className="truncate pr-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
