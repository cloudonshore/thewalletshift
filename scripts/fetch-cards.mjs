#!/usr/bin/env node
// Fetch + parse the OFF-CHAIN Agent Cards (the https/http/ipfs links that can't be
// decoded in BigQuery). Reads the worklist from export-offchain-uris.sh, fetches
// each card, extracts the same fields we decode for on-chain cards, and writes
// web/src/data/offchain-cards.json (gitignored intermediate, like agents.json).
//
//   node scripts/fetch-cards.mjs                 # full run (~4,662 URLs)
//   node scripts/fetch-cards.mjs --limit 60      # sample first
//   node scripts/fetch-cards.mjs --concurrency 8 # tune politeness
//
// Politeness/safety: global concurrency cap; worklist is round-robin interleaved by
// host so no single host (e.g. ag0.xyz, ~2k cards) gets a consecutive burst; 8s
// timeout; one retry on network/5xx/429; 1 MB response cap. Private/loopback hosts
// are skipped (SSRF hygiene) — never fetch localhost / RFC1918 / link-local.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const LIMIT = parseInt(flag("--limit", "0"), 10);
const CONCURRENCY = parseInt(flag("--concurrency", "12"), 10);
const IN = flag("--in", "web/src/data/offchain-uris.json");
const OUT = flag("--out", "web/src/data/offchain-cards.json");
const GATEWAY = "https://ipfs.io/ipfs/";
const UA = "TheWalletShift-CardIndexer/1.0 (+https://thewalletshift.com)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_000_000;

// ---- URL handling -----------------------------------------------------------
function toFetchUrl(uri) {
  if (uri.startsWith("ipfs://")) {
    return GATEWAY + uri.slice(7).replace(/^ipfs\//, "");
  }
  return uri;
}
const PRIVATE =
  /^(localhost$|.*\.local$|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0$|::1$|172\.(1[6-9]|2\d|3[01])\.)/i;
function hostOf(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}
function isFetchable(u) {
  const h = hostOf(u);
  if (!h) return false;
  return !PRIVATE.test(h);
}

// ---- card field extraction (mirrors the on-chain SQL decode) ----------------
// The ERC-8004 registration card lists callable interfaces under `services`
// (older/variant cards use `endpoints`). Each entry is {name, endpoint, type?}.
function serviceList(card) {
  if (Array.isArray(card?.services)) return card.services;
  if (Array.isArray(card?.endpoints)) return card.endpoints;
  return [];
}
function cardEns(card) {
  // self-declared ENS: a service/endpoint named "ens", or an ENS binding
  const svc = serviceList(card).find((x) => String(x?.name).toLowerCase() === "ens");
  if (svc?.endpoint) return String(svc.endpoint);
  if (card?.binding && String(card.binding.type).toLowerCase() === "ens") return card.binding.name || null;
  return null;
}
// Classify a single service entry to its interaction proto (a2a / mcp / web /
// x402) by name, type, or URL. Returns null if it matches none.
function entryProto(name, type, url) {
  const hay = `${name} ${type} ${url}`.toLowerCase();
  if (hay.includes("a2a") || hay.includes("agent-card") || hay.includes("/.well-known/agent")) return "a2a";
  if (hay.includes("mcp")) return "mcp";
  if (hay.includes("x402")) return "x402";
  if (/(^| )web($| )|web-v|"web"/.test(hay) || name.toLowerCase() === "web") return "web";
  return null;
}
// Summarize the services array — this is the "how do I actually call it" data.
// Returns { count, names, protos, entries } where entries keeps the actual
// endpoint URLs (needed for the second-hop A2A skills / MCP tools fetch).
function serviceSummary(card) {
  const svc = serviceList(card);
  const names = [];
  const protos = new Set();
  const entries = [];
  for (const e of svc) {
    const name = e?.name ? String(e.name) : "";
    const url = e?.endpoint ? String(e.endpoint) : "";
    const type = e?.type ? String(e.type) : "";
    if (name) names.push(name.slice(0, 24));
    const p = entryProto(name, type, url);
    if (p) protos.add(p);
    if (url) entries.push({ name: name.slice(0, 40), endpoint: url.slice(0, 400), type: type.slice(0, 60), proto: p });
  }
  return { count: svc.length, names: names.slice(0, 8), protos: [...protos], entries: entries.slice(0, 12) };
}
function extract(card) {
  if (!card || typeof card !== "object") return null;
  const trust = Array.isArray(card.supportedTrust) ? card.supportedTrust.filter(Boolean).join(",") : null;
  const img = typeof card.image === "string" && card.image.trim() !== "";
  const ep = serviceSummary(card);
  return {
    name: card.name ? String(card.name).slice(0, 40) : null,
    ens: cardEns(card),
    x402: card.x402Support === undefined ? null : String(card.x402Support),
    active: card.active === undefined ? null : String(card.active),
    trust: trust || null,
    img,
    ep_count: ep.count,
    ep_names: ep.names,
    protos: ep.protos,
    // actual endpoint URLs per service — input to the second-hop skills fetch
    services: ep.entries,
    descr: card.description ? String(card.description).slice(0, 90) : null,
    // full (untruncated) description for LLM classification; capped for sanity
    descr_full: card.description ? String(card.description).slice(0, 1200) : null,
  };
}

// ---- fetch one --------------------------------------------------------------
async function fetchCard(item) {
  const target = toFetchUrl(item.uri);
  const host = hostOf(target);
  if (!isFetchable(target)) {
    return { id: item.id, host, status: "skipped-private", ok: false };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(target, {
        headers: { "User-Agent": UA, Accept: "application/json, */*" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        if ((res.status >= 500 || res.status === 429) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        return { id: item.id, host, status: `http-${res.status}`, ok: false };
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) return { id: item.id, host, status: "too-large", ok: false };
      let card;
      try {
        card = JSON.parse(new TextDecoder().decode(buf));
      } catch {
        return { id: item.id, host, status: "bad-json", ok: false };
      }
      const fields = extract(card);
      if (!fields) return { id: item.id, host, status: "not-a-card", ok: false };
      return { id: item.id, host, status: "ok", ok: true, ...fields };
    } catch (e) {
      const code = e?.name === "TimeoutError" ? "timeout" : (e?.cause?.code || e?.code || "neterr");
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      return { id: item.id, host, status: String(code).toLowerCase(), ok: false };
    }
  }
  return { id: item.id, host, status: "neterr", ok: false };
}

// ---- round-robin interleave by host so no host gets a consecutive burst -----
function interleaveByHost(items) {
  const buckets = new Map();
  for (const it of items) {
    const h = hostOf(toFetchUrl(it.uri)) || "?";
    if (!buckets.has(h)) buckets.set(h, []);
    buckets.get(h).push(it);
  }
  const lists = [...buckets.values()];
  const out = [];
  let added = true;
  for (let i = 0; added; i++) {
    added = false;
    for (const l of lists) {
      if (i < l.length) {
        out.push(l[i]);
        added = true;
      }
    }
  }
  return out;
}

// statuses worth re-hitting (transient) vs genuinely dead (404/dns/bad-json)
const RETRYABLE = (s) =>
  s === "http-429" || s === "timeout" || /^http-5/.test(s) || s === "neterr" || s === "econnreset";

// ---- concurrency pool -------------------------------------------------------
async function run() {
  const RETRY = args.includes("--retry-failed");
  const wl = JSON.parse(readFileSync(IN, "utf8"));
  let items = wl.items || [];

  // Retry mode: re-fetch ONLY the transiently-failed ids from a previous run,
  // then merge recoveries into the existing output. Run with a low --concurrency.
  let prior = null;
  if (RETRY) {
    prior = JSON.parse(readFileSync(OUT, "utf8"));
    const uriById = new Map(items.map((it) => [it.id, it.uri]));
    const ids = prior.status.filter((r) => RETRYABLE(r.status)).map((r) => r.id);
    items = ids.map((id) => ({ id, uri: uriById.get(id) })).filter((x) => x.uri);
    console.log(`retry mode: ${items.length} transiently-failed ids`);
  }

  // Interleave by host FIRST (so a --limit sample is a representative cross-section,
  // not one host's contiguous id-block), then apply the limit.
  items = interleaveByHost(items);
  if (LIMIT > 0) items = items.slice(0, LIMIT);
  const total = items.length;
  console.log(`fetching ${total} off-chain cards · concurrency ${CONCURRENCY}`);

  const results = new Array(total);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < total) {
      const i = next++;
      results[i] = await fetchCard(items[i]);
      done++;
      if (done % 250 === 0 || done === total) {
        const ok = results.filter((r) => r?.ok).length;
        process.stdout.write(`\r  ${done}/${total}  ok:${ok}   `);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  process.stdout.write("\n");

  const today = new Date().toISOString().slice(0, 10);
  const toCard = (r) => ({
    id: r.id,
    name: r.name,
    ens: r.ens,
    x402: r.x402,
    active: r.active,
    trust: r.trust,
    img: r.img,
    ep_count: r.ep_count,
    ep_names: r.ep_names,
    protos: r.protos,
    services: r.services,
    descr: r.descr,
    descr_full: r.descr_full,
  });
  const toStatus = (r) => ({ id: r.id, host: r.host, status: r.status });

  let out;
  if (RETRY) {
    // merge recoveries into the prior run: overwrite status for every retried id,
    // and add a card for any that now succeeds
    const cardsById = new Map(prior.cards.map((c) => [c.id, c]));
    const statusById = new Map(prior.status.map((s) => [s.id, s]));
    for (const r of results) {
      statusById.set(r.id, toStatus(r));
      if (r.ok) cardsById.set(r.id, toCard(r));
    }
    const cards = [...cardsById.values()];
    const status = [...statusById.values()];
    const byStatus = {};
    for (const s of status) byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    out = { generated_at: today, fetched: status.length, ok: cards.length, failed: status.length - cards.length, by_status: byStatus, cards, status };
    const recovered = results.filter((r) => r.ok).length;
    console.log(`recovered ${recovered}/${total} retried · total ok now ${cards.length}/${status.length}`);
    console.log("status breakdown:", JSON.stringify(byStatus));
  } else {
    const ok = results.filter((r) => r.ok);
    const byStatus = {};
    for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    out = {
      generated_at: today,
      fetched: total,
      ok: ok.length,
      failed: total - ok.length,
      by_status: byStatus,
      cards: ok.map(toCard),
      status: results.map(toStatus),
    };
    console.log(`ok ${ok.length}/${total} (${((ok.length / total) * 100).toFixed(1)}%) -> ${OUT}`);
    console.log("status breakdown:", JSON.stringify(byStatus));
  }
  writeFileSync(OUT, JSON.stringify(out));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
