#!/usr/bin/env bash
# Export ON-CHAIN Agent Card analytics from BigQuery -> web/src/data/cards.json
#
# Phase 1 of card indexing: the ~9,520 inline `data:application/json;base64,` cards
# decode for FREE in SQL against logs_2026 (the content is on-chain). Off-chain
# https/ipfs cards (~4,600) are NOT here — their content lives at a URL and needs a
# separate fetch pipeline (scripts/fetch-cards.mjs). The `coverage` block reports
# the whole population so the gap is explicit; everything else is on-chain only.
#
# Same curl-4 / BigQuery REST plumbing as export-metrics.sh (the bq CLI stalls on
# broken IPv6 — see CLAUDE.md). cards.json is small and bundled in the repo (like
# explorer.json); the dashboard + /cards page import it directly.
set -euo pipefail

PROJECT=thewalletshift
ID="0x8004a169fb4a3325136eb29fa0ceb6d2e539a432"          # Identity registry
REG="0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a"  # Registered
TBL="thewalletshift.erc8004.logs_2026"
OUT="web/src/data/cards.json"
DAY="${1:?usage: export-cards.sh YYYY-MM-DD}"
TMP="$(mktemp -d)"
TOKEN="$(gcloud auth print-access-token)"
URL="https://bigquery.googleapis.com/bigquery/v2/projects/$PROJECT/queries"

# Shared decode: `uri` = the agentURI; `j` = the decoded on-chain card JSON (NULL
# unless the URI is an inline base64 card). Reused by every query via $DECODE.
DECODE="WITH reg AS (
  SELECT SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
  FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG'),
card AS (
  SELECT uri, SAFE_CONVERT_BYTES_TO_STRING(SAFE.FROM_BASE64(SUBSTR(uri,LENGTH('data:application/json;base64,')+1))) AS j
  FROM reg WHERE STARTS_WITH(uri,'data:application/json;base64,'))"

run_query() {
  python3 -c 'import json,sys; print(json.dumps({"query":sys.argv[1],"useLegacySql":False,"location":"US","timeoutMs":120000,"maxResults":100000}))' "$1" > "$TMP/body.json"
  curl -4 -sS -m 120 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    --data @"$TMP/body.json" "$URL" \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)
if "error" in d:
    sys.stderr.write("BQ error: "+json.dumps(d["error"])+"\n"); sys.exit(1)
fields=[f["name"] for f in d.get("schema",{}).get("fields",[])]
rows=[{fields[i]:c.get("v") for i,c in enumerate(r.get("f",[]))} for r in d.get("rows",[])]
print(json.dumps(rows))'
}

echo "1/5 coverage (all agents)..."
run_query "SELECT CASE
   WHEN STARTS_WITH(uri,'data:application/json;base64,') THEN 'onchain'
   WHEN STARTS_WITH(uri,'https:') OR STARTS_WITH(uri,'http:') THEN 'http'
   WHEN STARTS_WITH(uri,'ipfs:') THEN 'ipfs'
   WHEN uri IS NULL OR uri='' THEN 'empty'
   ELSE 'other' END AS bucket, COUNT(*) AS n
FROM (SELECT SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
      FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG')
GROUP BY bucket" > "$TMP/coverage.json"

# Non-empty checks use NULLIF(...,'') because a present-but-blank key (e.g. image:'')
# decodes to '' via JSON_VALUE — most on-chain cards carry an empty image string.
echo "2/5 on-chain card aggregates..."
run_query "$DECODE
SELECT
  COUNT(*) AS onchain,
  COUNTIF(SAFE.PARSE_JSON(j) IS NOT NULL) AS parseable,
  COUNTIF(NULLIF(JSON_VALUE(j,'\$.name'),'') IS NOT NULL) AS has_name,
  COUNTIF(NULLIF(JSON_VALUE(j,'\$.description'),'') IS NOT NULL) AS has_descr,
  COUNTIF(NULLIF(JSON_VALUE(j,'\$.image'),'') IS NOT NULL) AS has_image,
  COUNTIF(JSON_VALUE(j,'\$.x402Support')='true') AS x402_true,
  COUNTIF(JSON_VALUE(j,'\$.x402Support')='false') AS x402_false,
  COUNTIF(JSON_VALUE(j,'\$.x402Support') IS NULL) AS x402_undeclared,
  COUNTIF(JSON_VALUE(j,'\$.active')='true') AS active_true,
  COUNTIF(JSON_VALUE(j,'\$.active')='false') AS active_false,
  COUNTIF(JSON_VALUE(j,'\$.active') IS NULL) AS active_undeclared,
  COUNTIF(JSON_QUERY(j,'\$.supportedTrust') IS NOT NULL) AS has_trust,
  COUNTIF(JSON_QUERY(j,'\$.endpoints') IS NOT NULL) AS has_endpoints
FROM card" > "$TMP/agg.json"

echo "3/5 trust models..."
run_query "$DECODE
SELECT JSON_VALUE(t) AS model, COUNT(*) AS n
FROM card, UNNEST(JSON_QUERY_ARRAY(j,'\$.supportedTrust')) t
WHERE NULLIF(JSON_VALUE(t),'') IS NOT NULL
GROUP BY model ORDER BY n DESC" > "$TMP/trust.json"

echo "4/5 schema compliance (type URI)..."
run_query "$DECODE
SELECT CASE
   WHEN t LIKE '%eip-8004#registration-v1' THEN 'v1'
   WHEN t LIKE '%eip-8004#registration' THEN 'unversioned'
   WHEN t IS NULL OR t='' THEN 'missing'
   WHEN LOWER(t) LIKE '%8004%' THEN 'legacy/typo'
   ELSE 'non-standard' END AS bucket, COUNT(*) AS n
FROM (SELECT JSON_VALUE(j,'\$.type') AS t FROM card)
GROUP BY bucket ORDER BY n DESC" > "$TMP/schema.json"

echo "5/5 image hosting (non-empty)..."
run_query "$DECODE
SELECT CASE
   WHEN STARTS_WITH(img,'data:') THEN 'inline'
   WHEN STARTS_WITH(img,'ipfs') THEN 'ipfs'
   WHEN STARTS_WITH(img,'http') THEN 'http'
   ELSE 'other' END AS host, COUNT(*) AS n
FROM (SELECT NULLIF(JSON_VALUE(j,'\$.image'),'') AS img FROM card) WHERE img IS NOT NULL
GROUP BY host ORDER BY n DESC" > "$TMP/imghost.json"

echo "assembling $OUT ..."
python3 - "$TMP" "$OUT" "$DAY" <<'PY'
import json, sys
tmp, out, day = sys.argv[1], sys.argv[2], sys.argv[3]
def load(n): return json.load(open(f"{tmp}/{n}.json"))
def i(x): return int(x) if x not in (None,"") else 0

cov = {r["bucket"]: i(r["n"]) for r in load("coverage")}
total = sum(cov.values())
onchain = cov.get("onchain",0)
offchain = cov.get("http",0) + cov.get("ipfs",0) + cov.get("other",0)
empty = cov.get("empty",0)

a = load("agg")[0]
parseable = i(a["parseable"])

data = {
  "generated_at": day,
  "network": "ethereum-mainnet",
  "source": "ERC-8004 Identity registry on-chain Agent Cards via BigQuery",
  "note": "On-chain (inline base64) cards only. Off-chain https/ipfs cards are counted in coverage but not yet content-indexed.",
  "coverage": {
    "agents": total,
    "onchain_cards": onchain,
    "offchain_cards": offchain,
    "empty": empty,
    "indexed": onchain,        # what THIS file actually decodes (on-chain subset)
    "parseable": parseable,    # of the indexed cards, how many parsed as JSON
  },
  # completeness among on-chain cards (non-empty values)
  "completeness": {
    "name": i(a["has_name"]),
    "description": i(a["has_descr"]),
    "image": i(a["has_image"]),
    "endpoints": i(a["has_endpoints"]),
    "trust": i(a["has_trust"]),
    "denominator": i(a["onchain"]),
  },
  "x402": {
    "payable": i(a["x402_true"]),
    "not_payable": i(a["x402_false"]),
    "undeclared": i(a["x402_undeclared"]),
  },
  "active": {
    "active": i(a["active_true"]),
    "inactive": i(a["active_false"]),
    "undeclared": i(a["active_undeclared"]),
  },
  "trust": [{"model": r["model"], "n": i(r["n"])} for r in load("trust")],
  "schema": [{"bucket": r["bucket"], "n": i(r["n"])} for r in load("schema")],
  "image_hosting": [{"host": r["host"], "n": i(r["n"])} for r in load("imghost")],
}
json.dump(data, open(out,"w"), indent=2)
c = data["coverage"]
print(f"agents:{c['agents']} onchain:{c['onchain_cards']} offchain:{c['offchain_cards']} empty:{c['empty']} | x402 payable:{data['x402']['payable']} | trust models:{len(data['trust'])}")
PY
echo "done -> $OUT"
