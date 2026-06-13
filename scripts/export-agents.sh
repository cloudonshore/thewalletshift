#!/usr/bin/env bash
# Export the FULL agent table (all ~34.5k) -> web/src/data/agents.json + GCS.
# Powers the virtualized /agents browser. "owner" is the CURRENT NFT owner
# (latest Transfer), not the registration-time owner. Free against logs_2026.
#
# Returns the whole set as one aggregated JSON array (ARRAY_AGG) so there's a
# single result row — no REST pagination. Same curl-4 auth as the other exports.
set -euo pipefail

PROJECT=thewalletshift
ID="0x8004a169fb4a3325136eb29fa0ceb6d2e539a432"
REG="0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a"
XFER="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
TBL="thewalletshift.erc8004.logs_2026"
BUCKET="gs://thewalletshift-data/agents.json"
OUT="web/src/data/agents.json"
DAY="${1:-$(date +%Y-%m-%d)}"
TMP="$(mktemp -d)"
TOKEN="$(gcloud auth print-access-token)"
URL="https://bigquery.googleapis.com/bigquery/v2/projects/$PROJECT/queries"

SQL="
WITH reg AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS id,
         DATE(block_timestamp) AS reg,
         SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
  FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG'),
cur AS (
  SELECT token_id, to_addr FROM (
    SELECT SAFE_CAST(topics[SAFE_OFFSET(3)] AS INT64) AS token_id,
           LOWER(CONCAT('0x',SUBSTR(topics[SAFE_OFFSET(2)],27))) AS to_addr,
           ROW_NUMBER() OVER (PARTITION BY topics[SAFE_OFFSET(3)] ORDER BY block_timestamp DESC, log_index DESC) rn
    FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$XFER') WHERE rn=1),
card AS (
  SELECT id, reg, uri, c.to_addr AS owner,
    CASE WHEN STARTS_WITH(uri,'data:application/json;base64,') THEN 'onchain'
         WHEN STARTS_WITH(uri,'https:') THEN 'https'
         WHEN STARTS_WITH(uri,'ipfs:') THEN 'ipfs'
         WHEN uri IS NULL OR uri='' THEN 'empty' ELSE 'other' END AS kind,
    SAFE_CONVERT_BYTES_TO_STRING(SAFE.FROM_BASE64(SUBSTR(uri,LENGTH('data:application/json;base64,')+1))) AS j
  FROM reg r LEFT JOIN cur c ON r.id=c.token_id)
SELECT TO_JSON_STRING(ARRAY_AGG(STRUCT(
  id,
  owner,
  CAST(reg AS STRING) AS reg,
  kind,
  SUBSTR(JSON_VALUE(j,'\$.name'),0,40) AS name,
  (SELECT JSON_VALUE(e,'\$.endpoint') FROM UNNEST(JSON_QUERY_ARRAY(j,'\$.endpoints')) e WHERE JSON_VALUE(e,'\$.name')='ens' LIMIT 1) AS ens,
  JSON_VALUE(j,'\$.x402Support') AS x402,
  SUBSTR(JSON_VALUE(j,'\$.description'),0,90) AS descr
) ORDER BY id)) AS payload
FROM card"

echo "querying all agents (current owner)..."
python3 -c 'import json,sys; print(json.dumps({"query":sys.argv[1],"useLegacySql":False,"location":"US","timeoutMs":180000,"maxResults":1}))' "$SQL" > "$TMP/body.json"
curl -4 -sS -m 180 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data @"$TMP/body.json" "$URL" > "$TMP/resp.json"

echo "assembling $OUT ..."
python3 - "$TMP/resp.json" "$OUT" "$DAY" <<'PY'
import json, sys
resp, out, day = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(resp))
if "error" in d:
    sys.stderr.write("BQ error: "+json.dumps(d["error"])+"\n"); sys.exit(1)
payload = d["rows"][0]["f"][0]["v"]
agents = json.loads(payload) if payload else []
# normalize empty strings -> None for cleaner client code
for a in agents:
    for k in ("name","ens","x402","descr"):
        if a.get(k) == "": a[k] = None
data = {"generated_at": day, "network": "ethereum-mainnet", "count": len(agents), "agents": agents}
json.dump(data, open(out,"w"), separators=(",",":"))
import os
print(f"agents: {len(agents)} | file: {os.path.getsize(out)/1e6:.2f} MB")
PY

echo "uploading to $BUCKET ..."
gcloud storage cp "$OUT" "$BUCKET" --project="$PROJECT" --cache-control="public, max-age=300" 2>&1 | tail -1
echo "done."
