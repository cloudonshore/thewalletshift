#!/usr/bin/env bash
# Export a human-readable "data explorer" snapshot -> web/src/data/explorer.json
#
# Turns the raw logbook into something legible: the 6 decoded event types with
# counts, and a sample of real agents decoded into name/description/ens/x402.
# Same REST-over-curl-4 approach as export-metrics.sh (see CLAUDE.md on bq/IPv6).
set -euo pipefail

PROJECT=thewalletshift
ID="0x8004a169fb4a3325136eb29fa0ceb6d2e539a432"
REP="0x8004baa17c55a88189ae136b182e5fda19de9b63"
REG="0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a"
TBL="thewalletshift.erc8004.logs_2026"
OUT="web/src/data/explorer.json"
DAY="${1:-$(date +%Y-%m-%d)}"
TMP="$(mktemp -d)"
TOKEN="$(gcloud auth print-access-token)"
URL="https://bigquery.googleapis.com/bigquery/v2/projects/$PROJECT/queries"

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

echo "1/2 event-type census..."
run_query "SELECT address, topics[SAFE_OFFSET(0)] AS sig, COUNT(*) AS n
FROM \`$TBL\` GROUP BY address, sig ORDER BY n DESC" > "$TMP/events.json"

echo "2/2 sample agents (decoded cards)..."
run_query "WITH reg AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS agent_id,
         CONCAT('0x',SUBSTR(topics[SAFE_OFFSET(2)],27)) AS owner,
         DATE(block_timestamp) AS registered,
         SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
  FROM \`$TBL\` WHERE address='$ID' AND topics[SAFE_OFFSET(0)]='$REG'),
cards AS (
  SELECT agent_id, owner, registered, uri,
    SAFE_CONVERT_BYTES_TO_STRING(SAFE.FROM_BASE64(SUBSTR(uri,LENGTH('data:application/json;base64,')+1))) AS j
  FROM reg WHERE STARTS_WITH(uri,'data:application/json;base64,'))
SELECT agent_id, owner, CAST(registered AS STRING) AS registered,
       JSON_VALUE(j,'\$.name') AS name,
       SUBSTR(JSON_VALUE(j,'\$.description'),0,140) AS description,
       JSON_VALUE(j,'\$.x402Support') AS x402,
       (SELECT JSON_VALUE(e,'\$.endpoint') FROM UNNEST(JSON_QUERY_ARRAY(j,'\$.endpoints')) e
        WHERE JSON_VALUE(e,'\$.name')='ens' LIMIT 1) AS ens
FROM cards
WHERE JSON_VALUE(j,'\$.name') IS NOT NULL AND TRIM(JSON_VALUE(j,'\$.name'))!=''
  AND LENGTH(JSON_VALUE(j,'\$.description'))>=12
ORDER BY agent_id DESC LIMIT 120" > "$TMP/agents.json"

echo "assembling $OUT ..."
python3 - "$TMP" "$OUT" "$DAY" <<'PY'
import json, sys
tmp, out, day = sys.argv[1], sys.argv[2], sys.argv[3]
def load(n): return json.load(open(f"{tmp}/{n}.json"))
def i(x): return int(x) if x not in (None,"") else 0

# topic0 -> friendly label (verified via keccak256 against the ERC-8004 ABI)
NAMES = {
 "0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a": ("Registered","a new agent was created"),
 "0x2c149ed548c6d2993cd73efe187df6eccabe4538091b33adbd25fafdb8a1468b": ("MetadataSet","an agent set/edited a profile field"),
 "0x3a2c7fffc2cba7582c690e3b82c453ea02a308326a98a3ad7576c606336409fb": ("URIUpdated","an agent changed its profile link"),
 "0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7": ("MetadataUpdate","a profile change broadcast to indexers (ERC-4906)"),
 "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": ("Transfer","an agent (NFT) changed owner"),
 "0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc": ("NewFeedback","someone reviewed an agent"),
 "0xb1c6be0b5b8aef6539e2fac0fd131a2faa7b49edf8e505b5eb0ad487d56051d4": ("ResponseAppended","an agent replied to a review"),
 "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31": ("ApprovalForAll","operator approval (NFT plumbing)"),
 "0x25156fd3288212246d8b008d5921fde376c71ed14ac2e072a506eb06fde6d09d": ("FeedbackRevoked","a review was revoked"),
}
ev = {}
for r in load("events"):
    nm = NAMES.get(r["sig"])
    if not nm: continue
    label, plain = nm
    ev[label] = {"name": label, "plain": plain, "count": ev.get(label,{}).get("count",0)+i(r["n"])}
event_types = sorted(ev.values(), key=lambda x:-x["count"])

agents=[]
for a in load("agents"):
    agents.append({
      "agent_id": i(a["agent_id"]),
      "owner": a["owner"],
      "registered": a["registered"],
      "name": (a["name"] or "").strip()[:48],
      "description": (a["description"] or "").strip(),
      "ens": a.get("ens"),
      "x402": a.get("x402"),
    })

data = {
  "generated_at": day,
  "network": "ethereum-mainnet",
  "total_logs": sum(i(r["n"]) for r in load("events")),
  "event_types": event_types,
  "sample_agents": agents,
}
json.dump(data, open(out,"w"), indent=2)
print("event types:", len(event_types), "| sample agents:", len(agents), "| total logs:", data["total_logs"])
PY
echo "done -> $OUT"
