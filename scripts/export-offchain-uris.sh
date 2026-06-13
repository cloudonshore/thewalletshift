#!/usr/bin/env bash
# Export the fetchable OFF-CHAIN card worklist -> web/src/data/offchain-uris.json
#
# These are the ~4,662 agents whose agentURI is an https/http/ipfs LINK (the card
# content lives off-chain, so it can't be decoded in BigQuery). This list is the
# input to scripts/fetch-cards.mjs, which fetches + parses each card. Gitignored —
# it's a regenerable intermediate, like agents.json. Free against logs_2026.
set -euo pipefail

PROJECT=thewalletshift
ID="0x8004a169fb4a3325136eb29fa0ceb6d2e539a432"
REG="0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a"
TBL="thewalletshift.erc8004.logs_2026"
OUT="web/src/data/offchain-uris.json"
TMP="$(mktemp -d)"
TOKEN="$(gcloud auth print-access-token)"
URL="https://bigquery.googleapis.com/bigquery/v2/projects/$PROJECT/queries"

SQL="
WITH reg AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS id,
         SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
  FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG')
SELECT TO_JSON_STRING(ARRAY_AGG(STRUCT(id, uri) ORDER BY id)) AS payload
FROM reg
WHERE STARTS_WITH(uri,'https:') OR STARTS_WITH(uri,'http:') OR STARTS_WITH(uri,'ipfs:')"

echo "querying off-chain worklist..."
python3 -c 'import json,sys; print(json.dumps({"query":sys.argv[1],"useLegacySql":False,"location":"US","timeoutMs":120000,"maxResults":1}))' "$SQL" > "$TMP/body.json"
curl -4 -sS -m 120 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data @"$TMP/body.json" "$URL" > "$TMP/resp.json"

python3 - "$TMP/resp.json" "$OUT" <<'PY'
import json, sys
resp, out = sys.argv[1], sys.argv[2]
d = json.load(open(resp))
if "error" in d:
    sys.stderr.write("BQ error: "+json.dumps(d["error"])+"\n"); sys.exit(1)
payload = d["rows"][0]["f"][0]["v"]
items = json.loads(payload) if payload else []
json.dump({"count": len(items), "items": items}, open(out,"w"), separators=(",",":"))
print(f"worklist: {len(items)} off-chain URIs -> {out}")
PY
