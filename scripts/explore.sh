#!/usr/bin/env bash
# Ad-hoc BigQuery exploration against the materialized ERC-8004 table.
#
#   scripts/explore.sh 'SELECT ...'        # SQL as arg
#   scripts/explore.sh < query.sql         # or piped on stdin
#   scripts/explore.sh -n 'SELECT ...'     # dry-run: print byte estimate only, run nothing
#
# Prints results as an aligned table plus bytes-processed / cache-hit so we keep
# an eye on cost. Uses the BigQuery REST API over curl -4 (the `bq` CLI stalls on
# broken IPv6; see CLAUDE.md). Default table is the free 95 MB logs_2026 snapshot;
# reference it as `T` via the WITH alias printed below, or fully-qualified.
set -euo pipefail

PROJECT=thewalletshift
TBL="thewalletshift.erc8004.logs_2026"   # 95 MB, free
DRY=0
[ "${1:-}" = "-n" ] && { DRY=1; shift; }

SQL="${1:-$(cat)}"
[ -z "${SQL//[[:space:]]/}" ] && { echo "usage: explore.sh [-n] 'SELECT ...'  (or pipe SQL on stdin)" >&2; exit 1; }

# Convenience: let queries say `\`T\`` instead of the full table name.
SQL="${SQL//\`T\`/\`$TBL\`}"

TOKEN="$(gcloud auth print-access-token)"
URL="https://bigquery.googleapis.com/bigquery/v2/projects/$PROJECT/queries"

python3 -c 'import json,sys
print(json.dumps({"query":sys.argv[1],"useLegacySql":False,"location":"US",
  "timeoutMs":120000,"maxResults":1000,"dryRun":bool(int(sys.argv[2]))}))' "$SQL" "$DRY" \
| curl -4 -sS -m 120 -X POST \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    --data @- "$URL" \
| python3 -c '
import json, sys
d = json.load(sys.stdin)
if "error" in d:
    sys.stderr.write("BQ error: " + json.dumps(d["error"], indent=2) + "\n"); sys.exit(1)
gb = int(d.get("totalBytesProcessed", 0)) / 1e9
if d.get("jobReference", {}).get("jobId") and d.get("statistics"):
    pass
dry = d.get("statistics", {}).get("query", {}).get("totalBytesProcessed")
# jobs.query returns totalBytesProcessed at top level for completed; dryRun in statistics
tb = d.get("totalBytesProcessed")
if tb is None:
    tb = d.get("statistics", {}).get("totalBytesProcessed", 0)
gb = int(tb or 0) / 1e9
cache = d.get("cacheHit", False)
if not d.get("jobComplete", True) is False and d.get("schema") is None:
    # dry run: no schema/rows, just the estimate
    sys.stderr.write(f"[dry-run] would process ~{gb:.3f} GB\n"); sys.exit(0)
fields = [f["name"] for f in d.get("schema", {}).get("fields", [])]
rows = [[ (c.get("v") if c.get("v") is not None else "∅") for c in r.get("f", []) ] for r in d.get("rows", [])]
# render aligned table
def s(x): return "" if x is None else str(x)
widths = [len(f) for f in fields]
for row in rows:
    for i, c in enumerate(row): widths[i] = min(80, max(widths[i], len(s(c))))
def fmt(cells): return "  ".join(s(c)[:80].ljust(widths[i]) for i, c in enumerate(cells))
print(fmt(fields))
print("  ".join("-"*w for w in widths))
for row in rows: print(fmt(row))
n = int(d.get("totalRows", len(rows)))
shown = len(rows)
tag = " (cache hit, $0)" if cache else ""
sys.stderr.write(f"\n{shown} of {n} rows · ~{gb:.3f} GB processed{tag}\n")
'
