#!/usr/bin/env bash
# Export ON-CHAIN agent cards that expose a callable service[] (endpoint URLs +
# full description), decoded for FREE from logs_2026. These are the on-chain half
# of the "callable" set; the off-chain half comes from fetch-cards.mjs. Together
# they feed build-enrich-input.mjs -> the LLM classification pipeline.
#
# Output: web/src/data/onchain-callable.json  {count, agents:[{id,name,descr,services:[{name,endpoint,type}]}]}
# Same curl-4 / REST auth as export-agents.sh (bq CLI hangs on broken IPv6).
set -euo pipefail

PROJECT=thewalletshift
ID="0x8004a169fb4a3325136eb29fa0ceb6d2e539a432"
REG="0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a"
TBL="thewalletshift.erc8004.logs_2026"
OUT="web/src/data/onchain-callable.json"
TMP="$(mktemp -d)"
TOKEN="$(gcloud auth print-access-token)"
URL="https://bigquery.googleapis.com/bigquery/v2/projects/$PROJECT/queries"

SQL="
WITH reg AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS id,
         SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
  FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG'),
card AS (
  SELECT id,
    SAFE_CONVERT_BYTES_TO_STRING(SAFE.FROM_BASE64(SUBSTR(uri,LENGTH('data:application/json;base64,')+1))) AS j
  FROM reg WHERE STARTS_WITH(uri,'data:application/json;base64,')),
svc AS (
  SELECT id, j, COALESCE(JSON_QUERY_ARRAY(j,'\$.services'), JSON_QUERY_ARRAY(j,'\$.endpoints')) AS s
  FROM card)
SELECT TO_JSON_STRING(ARRAY_AGG(STRUCT(
  id,
  SUBSTR(JSON_VALUE(j,'\$.name'),0,80) AS name,
  SUBSTR(JSON_VALUE(j,'\$.description'),0,1200) AS descr,
  ARRAY(
    SELECT AS STRUCT
      SUBSTR(JSON_VALUE(e,'\$.name'),0,40) AS name,
      SUBSTR(JSON_VALUE(e,'\$.endpoint'),0,400) AS endpoint,
      SUBSTR(JSON_VALUE(e,'\$.type'),0,60) AS type
    FROM UNNEST(s) e
    WHERE JSON_VALUE(e,'\$.endpoint') IS NOT NULL
  ) AS services
) ORDER BY id)) AS payload
FROM svc
WHERE s IS NOT NULL AND ARRAY_LENGTH(s) > 0"

echo "querying on-chain callable cards..."
python3 -c 'import json,sys; print(json.dumps({"query":sys.argv[1],"useLegacySql":False,"location":"US","timeoutMs":180000,"maxResults":1}))' "$SQL" > "$TMP/body.json"
curl -4 -sS -m 180 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data @"$TMP/body.json" "$URL" > "$TMP/resp.json"

python3 - "$TMP/resp.json" "$OUT" <<'PY'
import json, sys, os
resp, out = sys.argv[1], sys.argv[2]
d = json.load(open(resp))
if "error" in d:
    sys.stderr.write("BQ error: "+json.dumps(d["error"])+"\n"); sys.exit(1)
payload = d["rows"][0]["f"][0]["v"]
agents = json.loads(payload) if payload else []
# keep only agents that actually have >=1 service entry with an endpoint
agents = [a for a in agents if a.get("services")]
data = {"count": len(agents), "agents": agents}
json.dump(data, open(out,"w"), separators=(",",":"))
print(f"on-chain callable: {len(agents)} -> {out} ({os.path.getsize(out)} bytes)")
PY
echo "done."
