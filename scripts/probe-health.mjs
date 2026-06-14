#!/usr/bin/env node
// ENDPOINT HEALTH PROBE — record per-endpoint liveness for the services directory.
// The directory tells an agent how to reach a service, but not whether it's up.
// This probes each of the 711 service-tier providers' endpoints and records a
// per-endpoint health snapshot the directory folds in, so agents can skip dead or
// paywalled endpoints before calling.
//
//   liveness (read-only):
//     a2a  -> GET the agent card (/.well-known/agent-card.json | agent.json | as-is)
//     mcp  -> POST JSON-RPC `initialize`
//     web  -> HEAD (GET on 405)
//     2xx/valid -> live · 402 -> paywalled · timeout/5xx/neterr -> dead
//   active x402 challenge (only x402:true + reachable a2a):
//     make ONE minimal real call to a SAFE (allowlisted, non-destructive) skill to
//     resolve free-vs-paid. 402 -> paywalled · 2xx/4xx-validation -> live (free).
//     402 returns BEFORE any charge or work; only safe-named skills are invoked.
//
//   node scripts/probe-health.mjs                  # full run over services.json
//   node scripts/probe-health.mjs --limit 40       # sample first N (host-interleaved)
//   node scripts/probe-health.mjs --ids 22739,22845 # probe specific provider ids
//   node scripts/probe-health.mjs --concurrency 8
//
// Reads:  web/src/data/services.json   (build-services-directory.mjs — providers[].endpoints[])
// Writes: web/src/data/health.json     {generated_at, total, by_status, records:[...]}
// Safety: SSRF guard (skip private/loopback), 10s timeout + 1 retry, host-interleaved,
//         1MB cap, x402-only + safe-skill-allowlist + one-call-per-service challenge.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const LIMIT = parseInt(flag("--limit", "0"), 10);
const CONCURRENCY = parseInt(flag("--concurrency", "8"), 10);
const IDS = (flag("--ids", "") || "")
  .split(",")
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isInteger(n));
const IN = flag("--in", "web/src/data/services.json");
const OUT = flag("--out", "web/src/data/health.json");
const UA = "TheWalletShift-HealthProbe/1.0 (+https://thewalletshift.com)";
const TIMEOUT_MS = 10000;
const MAX_BYTES = 1_000_000;

const PRIVATE =
  /^(localhost$|.*\.local$|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0$|::1$|172\.(1[6-9]|2\d|3[01])\.)/i;
function hostOf(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}
const fetchable = (u) => {
  const h = hostOf(u);
  return h && !PRIVATE.test(h);
};

// ---- body reader: tolerate both plain JSON and SSE (text/event-stream) -------
async function readBody(res) {
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return null;
  const text = new TextDecoder().decode(buf);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/event-stream") || /^\s*(event|data):/m.test(text)) {
    const datas = text
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    for (let i = datas.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(datas[i]);
      } catch {}
    }
    try {
      return JSON.parse(datas.join(""));
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// fetch with a single retry on network error / timeout; returns Response or null
async function tryFetch(url, opts) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
}

// ---- A2A: resolve the agent card ---------------------------------------------
function a2aCandidates(endpoint) {
  const out = [];
  try {
    const u = new URL(endpoint);
    const p = u.pathname.toLowerCase();
    if (p.endsWith("agent-card.json") || p.endsWith("agent.json")) out.push(endpoint);
    out.push(u.origin + "/.well-known/agent-card.json");
    out.push(u.origin + "/.well-known/agent.json");
    out.push(endpoint);
  } catch {}
  return [...new Set(out)].filter(fetchable);
}

// liveness for an a2a endpoint: fetch the card. Returns {status, http, card?}
async function probeA2A(endpoint) {
  let lastHttp = null;
  for (const url of a2aCandidates(endpoint)) {
    const r = await tryFetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json, */*" },
      redirect: "follow",
    });
    if (!r) {
      lastHttp = null;
      continue;
    }
    lastHttp = r.status;
    if (r.status === 402) return { status: "paywalled", http: 402 };
    if (!r.ok) continue;
    const card = await readBody(r);
    if (card && typeof card === "object") return { status: "live", http: r.status, card, cardUrl: url };
  }
  return { status: "dead", http: lastHttp };
}

// liveness for an mcp endpoint: JSON-RPC initialize. Returns {status, http}
async function probeMCP(endpoint) {
  if (!fetchable(endpoint)) return { status: "dead", http: null };
  const base = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "User-Agent": UA,
  };
  const initReq = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "thewalletshift", version: "1.0" },
    },
  };
  const r = await tryFetch(endpoint, { method: "POST", headers: base, body: JSON.stringify(initReq), redirect: "follow" });
  if (!r) return { status: "dead", http: null };
  if (r.status === 402) return { status: "paywalled", http: 402 };
  if (!r.ok) return { status: "dead", http: r.status };
  const body = await readBody(r);
  if (body?.result || body?.jsonrpc) return { status: "live", http: r.status };
  return { status: "dead", http: r.status };
}

// liveness for a web / null-proto endpoint: HEAD, fall back to GET on 405.
async function probeWeb(endpoint) {
  if (!fetchable(endpoint)) return { status: "dead", http: null };
  let r = await tryFetch(endpoint, { method: "HEAD", headers: { "User-Agent": UA }, redirect: "follow" });
  if (r && r.status === 405) {
    r = await tryFetch(endpoint, { method: "GET", headers: { "User-Agent": UA, Accept: "*/*" }, redirect: "follow" });
  }
  if (!r) return { status: "dead", http: null };
  if (r.status === 402) return { status: "paywalled", http: 402 };
  if (r.ok) return { status: "live", http: r.status };
  return { status: "dead", http: r.status };
}

// ---- active x402 challenge: pick a safe skill, make ONE minimal real call ----
const SAFE_NAME = /^(overview|info|status|health|list|get|current|search|query|read|view|summary|ping)/i;
const DESTRUCTIVE =
  /(buy|sell|trade|execut|swap|send|transfer|withdraw|deposit|mint|burn|deploy|delete|remove|create|write|pay|sign|approve)/i;

function safeSkill(card) {
  const skills = Array.isArray(card?.skills) ? card.skills : [];
  for (const s of skills) {
    const name = String(s?.name || s?.id || "");
    if (name && SAFE_NAME.test(name) && !DESTRUCTIVE.test(name)) return name;
  }
  return null;
}

// resolve the invoke path: prefer the card's declared entrypoints REST convention,
// else fall back to <a2a-origin>/entrypoints/{skill}/invoke.
function invokeUrl(card, a2aEndpoint, skill) {
  // some cards expose an entrypoints base or per-skill invoke url
  const ep = card?.entrypoints;
  if (ep && typeof ep === "object" && !Array.isArray(ep)) {
    const hit = ep[skill];
    if (typeof hit === "string" && fetchable(hit)) return hit;
    if (hit && typeof hit.invoke === "string" && fetchable(hit.invoke)) return hit.invoke;
  }
  try {
    const origin = new URL(a2aEndpoint).origin;
    return `${origin}/entrypoints/${encodeURIComponent(skill)}/invoke`;
  } catch {
    return null;
  }
}

// returns {status, http, probe} to merge over the liveness result, or null to skip
async function challenge(card, a2aEndpoint) {
  const skill = safeSkill(card);
  if (!skill) return null;
  const url = invokeUrl(card, a2aEndpoint, skill);
  if (!url || !fetchable(url)) return null;
  const r = await tryFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, */*", "User-Agent": UA },
    body: JSON.stringify({ input: {} }),
    redirect: "follow",
  });
  if (!r) return null; // neterr/timeout -> keep liveness result
  if (r.status === 402) return { status: "paywalled", http: 402, probe: "challenge" };
  if (r.ok) return { status: "live", http: r.status, probe: "challenge" }; // free
  if (r.status === 400 || r.status === 422) return { status: "live", http: r.status, probe: "challenge" }; // reachable, needs input
  if (r.status === 401 || r.status === 403) return { status: "live", http: r.status, probe: "challenge" }; // auth, but reachable
  return null; // 5xx etc -> keep liveness result
}

// ---- per-endpoint probe ------------------------------------------------------
async function probeEndpoint(provider, ep) {
  const url = (ep.url || "").trim();
  const proto = ep.proto || null;
  const rec = { id: provider.id, url, proto, status: "dead", http: null, probe: "liveness" };

  if (!url || !fetchable(url)) {
    rec.status = "dead";
    return rec;
  }

  let card = null;
  let cardEndpoint = url;
  if (proto === "a2a") {
    const r = await probeA2A(url);
    rec.status = r.status;
    rec.http = r.http;
    if (r.card) {
      card = r.card;
      cardEndpoint = url;
    }
  } else if (proto === "mcp") {
    const r = await probeMCP(url);
    rec.status = r.status;
    rec.http = r.http;
  } else {
    const r = await probeWeb(url);
    rec.status = r.status;
    rec.http = r.http;
  }

  // active x402 challenge — only when flagged payable, a2a, reachable, with a card
  if (provider.x402 && proto === "a2a" && rec.status === "live" && card) {
    const c = await challenge(card, cardEndpoint);
    if (c) {
      rec.status = c.status;
      rec.http = c.http;
      rec.probe = c.probe;
    }
  }
  return rec;
}

function interleaveByHost(items) {
  const buckets = new Map();
  for (const it of items) {
    const h = hostOf(it.url) || "?";
    if (!buckets.has(h)) buckets.set(h, []);
    buckets.get(h).push(it);
  }
  const lists = [...buckets.values()];
  const out = [];
  for (let i = 0, added = true; added; i++) {
    added = false;
    for (const l of lists)
      if (i < l.length) {
        out.push(l[i]);
        added = true;
      }
  }
  return out;
}

async function run() {
  const doc = JSON.parse(readFileSync(IN, "utf8"));
  let providers = doc.providers || [];
  if (IDS.length) providers = providers.filter((p) => IDS.includes(p.id));

  // flatten to one job per endpoint; carry the provider for x402/challenge context
  let jobs = [];
  for (const p of providers) {
    for (const ep of p.endpoints || []) {
      if (!ep.url) continue;
      jobs.push({ id: p.id, url: ep.url.trim(), provider: p, ep });
    }
  }
  jobs = interleaveByHost(jobs);
  if (LIMIT > 0) jobs = jobs.slice(0, LIMIT);

  const last_probed = new Date().toISOString();
  const total = jobs.length;
  console.log(`probing ${total} endpoints across ${providers.length} providers · concurrency ${CONCURRENCY}`);

  // one active challenge per service max — track which providers have been challenged
  const challenged = new Set();
  const records = new Array(total);
  let next = 0,
    done = 0;
  async function worker() {
    while (next < total) {
      const i = next++;
      const job = jobs[i];
      const allowChallenge = job.provider.x402 && job.ep.proto === "a2a" && !challenged.has(job.id);
      if (allowChallenge) challenged.add(job.id);
      const rec = await probeEndpoint(allowChallenge ? job.provider : { ...job.provider, x402: false }, job.ep);
      records[i] = { ...rec, last_probed };
      done++;
      if (done % 50 === 0 || done === total) {
        const live = records.filter((r) => r?.status === "live").length;
        process.stdout.write(`\r  ${done}/${total}  live:${live}   `);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  process.stdout.write("\n");

  const by_status = { live: 0, paywalled: 0, dead: 0 };
  for (const r of records) by_status[r.status] = (by_status[r.status] || 0) + 1;

  const out = {
    generated_at: last_probed,
    total,
    by_status,
    records,
  };
  writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `health.json: ${total} endpoints · live ${by_status.live} · paywalled ${by_status.paywalled} · dead ${by_status.dead} -> ${OUT}`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
