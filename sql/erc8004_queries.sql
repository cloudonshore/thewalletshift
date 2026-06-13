-- =============================================================================
-- ERC-8004 on Ethereum Mainnet — validated query library (The Wallet Shift)
-- All queries verified working 2026-06-13 against BigQuery, project `thewalletshift`.
-- Source: bigquery-public-data.goog_blockchain_ethereum_mainnet_us.logs (3.7 TB)
-- Working table: thewalletshift.erc8004.logs_2026 (95 MB, 159,484 logs) <- query THIS
-- Decoding recipes adapted from the GCP ERC-8004 workshop cheat sheet.
-- =============================================================================

-- Registries (CREATE2 singletons, lowercase for BigQuery):
--   Identity   0x8004a169fb4a3325136eb29fa0ceb6d2e539a432
--   Reputation 0x8004baa17c55a88189ae136b182e5fda19de9b63

-- Event signatures (topics[0]), discovered + identified:
--   Registered (Identity)       0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a  (34,556)
--   Transfer ERC-721 (Identity) 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef  (49,305: 34,556 mints + 14,749 secondary)
--   NewFeedback (Reputation)    0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc  (3,173)
--   ApprovalForAll              0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31  (303)
--   Approval                    0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200 ac8c7c3b925  (3)
--   OwnershipTransferred        0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0  (deploy)
-- STILL UNIDENTIFIED (open questions, both on Identity registry):
--   0x2c149ed548c6d2993cd73efe187df6eccabe4538091b33adbd25fafdb8a1468b  (52,789 — MOST frequent! likely MetadataSet / per-field)
--   0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7  (17,943)
--   0x3a2c7fffc2cba7582c690e3b82c453ea02a308326a98a3ad7576c606336409fb  (1,365)
--   0xb1c6be0b5b8aef6539e2fac0fd131a2faa7b49edf8e505b5eb0ad487d56051d4  (Reputation, 37 — likely FeedbackRevoked/ResponseAppended)

-- =============================================================================
-- 0. ONE-TIME EXTRACT (run against the PUBLIC table; ~437 GB scan, once)
--    Materializes every ERC-8004 log into a tiny native table so all queries
--    below are effectively free. Re-run to refresh.
-- =============================================================================
CREATE OR REPLACE TABLE `thewalletshift.erc8004.logs_2026` AS
SELECT block_timestamp, block_number, transaction_hash, log_index, address, topics, data
FROM `bigquery-public-data.goog_blockchain_ethereum_mainnet_us.logs`
WHERE address IN ('0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
                  '0x8004baa17c55a88189ae136b182e5fda19de9b63')
  AND block_timestamp >= '2026-01-01';

-- =============================================================================
-- 1. POPULATION — agents = distinct Registered (== distinct mints). Result: 34,556
-- =============================================================================
SELECT COUNT(DISTINCT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64)) AS agents
FROM `thewalletshift.erc8004.logs_2026`
WHERE address='0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
  AND topics[SAFE_OFFSET(0)]='0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a';

-- Growth (registrations per day) — for the adoption curve
SELECT DATE(block_timestamp) AS day, COUNT(*) AS new_agents
FROM `thewalletshift.erc8004.logs_2026`
WHERE address='0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
  AND topics[SAFE_OFFSET(0)]='0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a'
GROUP BY day ORDER BY day;

-- =============================================================================
-- 2. DECODE Registered -> agent_id, owner, agent_uri
-- =============================================================================
SELECT
  SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64)        AS agent_id,
  CONCAT('0x', SUBSTR(topics[SAFE_OFFSET(2)], 27))  AS owner,
  SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(
    data, 131, 2 * SAFE_CAST(CONCAT('0x', SUBSTR(data, 67, 64)) AS INT64)
  )))                                               AS agent_uri
FROM `thewalletshift.erc8004.logs_2026`
WHERE address='0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
  AND topics[SAFE_OFFSET(0)]='0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a'
ORDER BY block_timestamp DESC LIMIT 50;

-- =============================================================================
-- 3. OWNER CONCENTRATION (Sybil signal). Result: 8,143 owners; top1 28.8%; top10 46%
-- =============================================================================
SELECT CONCAT('0x', SUBSTR(topics[SAFE_OFFSET(2)], 27)) AS owner,
       COUNT(DISTINCT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64)) AS agents
FROM `thewalletshift.erc8004.logs_2026`
WHERE address='0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
  AND topics[SAFE_OFFSET(0)]='0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a'
GROUP BY owner ORDER BY agents DESC LIMIT 20;

-- =============================================================================
-- 4. URI SCHEME mix. Result: empty 18,049 (52%) | base64 9,520 | https 4,014 | other 2,325 | ipfs 643
-- =============================================================================
SELECT CASE
         WHEN STARTS_WITH(uri,'data:application/json;base64,') THEN 'data:base64'
         WHEN STARTS_WITH(uri,'https:') THEN 'https'
         WHEN STARTS_WITH(uri,'ipfs:') THEN 'ipfs'
         WHEN uri IS NULL OR uri='' THEN '(empty)'
         ELSE 'other' END AS uri_type,
       COUNT(*) AS agents
FROM (
  SELECT SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(
           data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS uri
  FROM `thewalletshift.erc8004.logs_2026`
  WHERE address='0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
    AND topics[SAFE_OFFSET(0)]='0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a')
GROUP BY uri_type ORDER BY agents DESC;

-- =============================================================================
-- 5. x402 SUPPORT from on-chain base64 cards. Result: true 4,389 | false 2,540 | no-field 2,591
--    (Extract ENS, name, active the same way via JSON_VALUE on the decoded card.)
-- =============================================================================
WITH cards AS (
  SELECT SAFE_CONVERT_BYTES_TO_STRING(SAFE.FROM_BASE64(SUBSTR(
           SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))),
           LENGTH('data:application/json;base64,')+1))) AS j
  FROM `thewalletshift.erc8004.logs_2026`
  WHERE address='0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
    AND topics[SAFE_OFFSET(0)]='0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a'
    AND STARTS_WITH(SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))),'data:application/json;base64,'))
SELECT COALESCE(JSON_VALUE(j,'$.x402Support'),'(no field)') AS x402_support,
       COUNT(*) AS agents,
       COUNT(JSON_VALUE(j,'$.name')) AS named,
       COUNTIF(JSON_VALUE(j,'$.active')='true') AS active
FROM cards GROUP BY x402_support ORDER BY agents DESC;

-- =============================================================================
-- 6. REPUTATION LEADERBOARD (NewFeedback), Sybil-guarded (>=3 unique clients)
--    Top agent #10307: 44 unique reviewers. NOTE: scores can exceed 100 — scale TBD.
-- =============================================================================
WITH feedback AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS agent_id,
         CONCAT('0x', SUBSTR(topics[SAFE_OFFSET(2)], 27)) AS client,
         SAFE_CAST(CONCAT('0x', SUBSTR(data,  67, 64)) AS INT64) AS raw_value,
         SAFE_CAST(CONCAT('0x', SUBSTR(data, 131, 64)) AS INT64) AS value_decimals
  FROM `thewalletshift.erc8004.logs_2026`
  WHERE address='0x8004baa17c55a88189ae136b182e5fda19de9b63'
    AND topics[SAFE_OFFSET(0)]='0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc'
    AND SUBSTR(data,67,1) != 'f')   -- skip negative ratings
SELECT agent_id, COUNT(*) AS feedback_count, COUNT(DISTINCT client) AS unique_clients,
       ROUND(AVG(raw_value / POW(10, value_decimals)), 2) AS avg_score
FROM feedback GROUP BY agent_id HAVING unique_clients >= 3
ORDER BY avg_score DESC, unique_clients DESC LIMIT 20;

-- =============================================================================
-- 7. THE MONEY QUERY — trustworthy AND payable (JOIN identity + reputation + x402)
-- =============================================================================
WITH agents AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS agent_id,
         CONCAT('0x', SUBSTR(topics[SAFE_OFFSET(2)], 27)) AS owner,
         SAFE_CONVERT_BYTES_TO_STRING(FROM_HEX(SUBSTR(data,131,2*SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)))) AS agent_uri
  FROM `thewalletshift.erc8004.logs_2026`
  WHERE address='0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
    AND topics[SAFE_OFFSET(0)]='0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a'),
scores AS (
  SELECT SAFE_CAST(topics[SAFE_OFFSET(1)] AS INT64) AS agent_id,
         COUNT(DISTINCT CONCAT('0x', SUBSTR(topics[SAFE_OFFSET(2)], 27))) AS unique_clients,
         ROUND(AVG(SAFE_CAST(CONCAT('0x',SUBSTR(data,67,64)) AS INT64)
                   / POW(10, SAFE_CAST(CONCAT('0x',SUBSTR(data,131,64)) AS INT64))),2) AS avg_score
  FROM `thewalletshift.erc8004.logs_2026`
  WHERE address='0x8004baa17c55a88189ae136b182e5fda19de9b63'
    AND topics[SAFE_OFFSET(0)]='0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc'
    AND SUBSTR(data,67,1) != 'f'
  GROUP BY 1)
SELECT a.agent_id, a.agent_uri, s.avg_score, s.unique_clients,
       IF(STARTS_WITH(a.agent_uri,'data:application/json;base64,'),
          JSON_VALUE(SAFE_CONVERT_BYTES_TO_STRING(SAFE.FROM_BASE64(
            SUBSTR(a.agent_uri, LENGTH('data:application/json;base64,')+1))),'$.x402Support'),
          NULL) AS x402_support
FROM agents a JOIN scores s USING (agent_id)
WHERE s.unique_clients >= 3
ORDER BY s.avg_score DESC;
