#!/usr/bin/env bash
# Export ERC-8004 dashboard metrics from BigQuery -> web/src/data/metrics.json
# Queries the materialized table thewalletshift.erc8004.logs_2026 (free).
# This script is the basis for the scheduled production rollup.
set -euo pipefail

PROJECT=thewalletshift
ID="0x8004a169fb4a3325136eb29fa0ceb6d2e539a432"          # Identity registry
REG="0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a"  # Registered
REP="0x8004baa17c55a88189ae136b182e5fda19de9b63"          # Reputation registry
FB="0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc"   # NewFeedback
TBL="thewalletshift.erc8004.logs_2026"
OUT="web/src/data/metrics.json"
TMP="$(mktemp -d)"

bqj() { bq --project_id="$PROJECT" --location=US query --use_legacy_sql=false --format=json "$1"; }

echo "1/6 summary..."
bqj "WITH reg AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS agent_id,
         CONCAT('0x',SUBSTR(topics[SAFE_OFFSET(2)],27)) AS owner,
         SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
  FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG')
SELECT COUNT(DISTINCT agent_id) AS agents,
       COUNT(DISTINCT owner) AS unique_owners,
       COUNTIF(uri IS NULL OR uri='') AS empty_metadata,
       COUNTIF(STARTS_WITH(uri,'data:application/json;base64,')) AS onchain_cards
FROM reg" > "$TMP/summary.json"

echo "2/6 growth (daily)..."
bqj "SELECT FORMAT_DATE('%Y-%m-%d', DATE(block_timestamp)) AS day, COUNT(*) AS new_agents
FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG'
GROUP BY day ORDER BY day" > "$TMP/growth.json"

echo "3/6 top owners..."
bqj "SELECT CONCAT('0x',SUBSTR(topics[SAFE_OFFSET(2)],27)) AS owner,
       COUNT(DISTINCT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64)) AS agents
FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG'
GROUP BY owner ORDER BY agents DESC LIMIT 12" > "$TMP/owners.json"

echo "4/6 uri types..."
bqj "SELECT CASE
   WHEN STARTS_WITH(uri,'data:application/json;base64,') THEN 'onchain'
   WHEN STARTS_WITH(uri,'https:') THEN 'https'
   WHEN STARTS_WITH(uri,'ipfs:') THEN 'ipfs'
   WHEN uri IS NULL OR uri='' THEN 'empty'
   ELSE 'other' END AS type, COUNT(*) AS agents
FROM (SELECT SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
      FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG')
GROUP BY type ORDER BY agents DESC" > "$TMP/uri.json"

echo "5/6 x402..."
bqj "WITH cards AS (
  SELECT SAFE_CONVERT_BYTES_TO_STRING(SAFE.FROM_BASE64(SUBSTR(
    SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))),
    LENGTH('data:application/json;base64,')+1))) AS j
  FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG'
    AND STARTS_WITH(SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))),'data:application/json;base64,'))
SELECT COUNTIF(JSON_VALUE(j,'\$.x402Support')='true') AS supported,
       COUNTIF(JSON_VALUE(j,'\$.x402Support')='false') AS unsupported,
       COUNTIF(JSON_VALUE(j,'\$.x402Support') IS NULL) AS unknown
FROM cards" > "$TMP/x402.json"

echo "6/6 reputation leaderboard..."
bqj "WITH feedback AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS agent_id,
         CONCAT('0x',SUBSTR(topics[SAFE_OFFSET(2)],27)) AS client,
         SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64) AS raw_value,
         SAFE_CAST(CONCAT('0x',SUBSTR(data,131,64)) AS INT64) AS value_decimals
  FROM \`$TBL\` WHERE address='$REP' AND topics[SAFE_OFFSET(0)]='$FB' AND SUBSTR(data,67,1)!='f')
SELECT agent_id, COUNT(*) AS feedback_count, COUNT(DISTINCT client) AS unique_clients,
       ROUND(AVG(raw_value/POW(10,value_decimals)),2) AS avg_score
FROM feedback GROUP BY agent_id HAVING unique_clients>=3
ORDER BY avg_score DESC, unique_clients DESC LIMIT 15" > "$TMP/rep.json"

echo "assembling $OUT ..."
mkdir -p "$(dirname "$OUT")"
DAY="$1"
python3 - "$TMP" "$OUT" "$DAY" <<'PY'
import json, sys
tmp, out, day = sys.argv[1], sys.argv[2], sys.argv[3]
def load(n): return json.load(open(f"{tmp}/{n}.json"))
def i(x): return int(x) if x not in (None,"") else 0
def f(x): return float(x) if x not in (None,"") else 0.0
s = load("summary")[0]
agents = i(s["agents"])
owners = [{"owner":o["owner"],"agents":i(o["agents"]),
           "pct":round(i(o["agents"])/agents*100,1)} for o in load("owners")]
top10 = round(sum(o["agents"] for o in owners[:10])/agents*100,1)
x = load("x402")[0]
data = {
  "generated_at": day,
  "network": "ethereum-mainnet",
  "source": "ERC-8004 Identity + Reputation registries via BigQuery",
  "summary": {
    "agents": agents,
    "unique_owners": i(s["unique_owners"]),
    "empty_metadata": i(s["empty_metadata"]),
    "onchain_cards": i(s["onchain_cards"]),
    "x402_payable": i(x["supported"]),
    "top1_owner_pct": owners[0]["pct"] if owners else 0,
    "top10_owner_pct": top10,
  },
  "growth_daily": [{"day":g["day"],"new_agents":i(g["new_agents"])} for g in load("growth")],
  "top_owners": owners,
  "uri_types": [{"type":u["type"],"agents":i(u["agents"])} for u in load("uri")],
  "x402": {"supported":i(x["supported"]),"unsupported":i(x["unsupported"]),"unknown":i(x["unknown"])},
  "reputation_top": [{"agent_id":i(r["agent_id"]),"feedback_count":i(r["feedback_count"]),
                      "unique_clients":i(r["unique_clients"]),"avg_score":f(r["avg_score"])} for r in load("rep")],
}
json.dump(data, open(out,"w"), indent=2)
print("agents:",agents,"| owners:",data["summary"]["unique_owners"],"| x402:",data["summary"]["x402_payable"],"| growth pts:",len(data["growth_daily"]))
PY
echo "done -> $OUT"
