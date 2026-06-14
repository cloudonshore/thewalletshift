#!/usr/bin/env node
// SECOND HOP — fetch what each callable agent can actually DO.
//   A2A services  -> GET /.well-known/agent-card.json, read skills:[{name,description,tags}]
//   MCP services  -> JSON-RPC initialize + tools/list (best-effort; SSE-aware)
//   web services  -> nothing fetchable (just an HTTP endpoint)
// The registry card only points at these endpoints; the skills/tools live one hop
// out and are the real signal for LLM classification + the search API.
//
//   node scripts/fetch-skills.mjs                  # full run over enrich-input.json
//   node scripts/fetch-skills.mjs --limit 40       # sample
//   node scripts/fetch-skills.mjs --concurrency 8
//
// Reads:  web/src/data/enrich-input.json   (build-enrich-input.mjs)
// Writes: web/src/data/skills.json         {generated_at, total, with_a2a, with_mcp, agents:[...]}
// Safety: SSRF guard (skip private/loopback), 10s timeout, host-interleaved, 1MB cap.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const LIMIT = parseInt(flag("--limit", "0"), 10);
const CONCURRENCY = parseInt(flag("--concurrency", "8"), 10);
const IN = flag("--in", "web/src/data/enrich-input.json");
const OUT = flag("--out", "web/src/data/skills.json");
const UA = "TheWalletShift-CardIndexer/1.0 (+https://thewalletshift.com)";
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

// ---- A2A: resolve the agent card and read skills ----------------------------
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
async function a2aSkills(endpoint) {
  for (const url of a2aCandidates(endpoint)) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json, */*" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) continue;
      const card = await readBody(r);
      if (!card || typeof card !== "object") continue;
      const skills = Array.isArray(card.skills) ? card.skills : [];
      if (skills.length || card.description) {
        return {
          ok: true,
          url,
          desc: card.description ? String(card.description).slice(0, 400) : null,
          skills: skills
            .map((s) => ({
              name: (s?.name || s?.id) ? String(s.name || s.id).slice(0, 60) : null,
              desc: s?.description ? String(s.description).slice(0, 240) : null,
              tags: Array.isArray(s?.tags) ? s.tags.map((t) => String(t).slice(0, 32)).slice(0, 8) : undefined,
            }))
            .filter((s) => s.name || s.desc)
            .slice(0, 40),
        };
      }
    } catch {}
  }
  return { ok: false };
}

// ---- MCP: best-effort initialize + tools/list -------------------------------
async function mcpTools(endpoint) {
  if (!fetchable(endpoint)) return { ok: false };
  const base = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "User-Agent": UA };
  try {
    const initReq = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "thewalletshift", version: "1.0" } },
    };
    const r1 = await fetch(endpoint, {
      method: "POST",
      headers: base,
      body: JSON.stringify(initReq),
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r1.ok) return { ok: false };
    await readBody(r1);
    const sid = r1.headers.get("mcp-session-id");
    const h2 = sid ? { ...base, "mcp-session-id": sid } : base;
    const r2 = await fetch(endpoint, {
      method: "POST",
      headers: h2,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r2.ok) return { ok: false };
    const body = await readBody(r2);
    const tools = body?.result?.tools;
    if (!Array.isArray(tools)) return { ok: false };
    return {
      ok: true,
      tools: tools
        .map((t) => ({
          name: t?.name ? String(t.name).slice(0, 60) : null,
          desc: t?.description ? String(t.description).slice(0, 240) : null,
        }))
        .filter((t) => t.name)
        .slice(0, 40),
    };
  } catch {
    return { ok: false };
  }
}

// ---- per-agent: hit each callable service, collect skills/tools -------------
async function fetchAgent(a) {
  const a2aSvcs = a.services.filter((s) => s.proto === "a2a" && s.endpoint);
  const mcpSvcs = a.services.filter((s) => s.proto === "mcp" && s.endpoint);
  let a2a = null;
  for (const s of a2aSvcs) {
    const r = await a2aSkills(s.endpoint);
    if (r.ok) {
      a2a = r;
      break;
    }
  }
  let mcp = null;
  for (const s of mcpSvcs) {
    const r = await mcpTools(s.endpoint);
    if (r.ok) {
      mcp = r;
      break;
    }
  }
  const out = { id: a.id, reachable: !!(a2a || mcp) };
  if (a2a) {
    out.a2a_url = a2a.url;
    out.a2a_desc = a2a.desc;
    out.a2a_skills = a2a.skills;
  }
  if (mcp) out.mcp_tools = mcp.tools;
  return out;
}

function interleaveByHost(items) {
  const buckets = new Map();
  for (const it of items) {
    const h = hostOf(it.services?.[0]?.endpoint) || "?";
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
  const inp = JSON.parse(readFileSync(IN, "utf8"));
  let agents = (inp.agents || []).filter((a) => a.protos.includes("a2a") || a.protos.includes("mcp"));
  agents = interleaveByHost(agents);
  if (LIMIT > 0) agents = agents.slice(0, LIMIT);
  const total = agents.length;
  console.log(`fetching skills for ${total} a2a/mcp agents · concurrency ${CONCURRENCY}`);

  const results = new Array(total);
  let next = 0,
    done = 0;
  async function worker() {
    while (next < total) {
      const i = next++;
      results[i] = await fetchAgent(agents[i]);
      done++;
      if (done % 100 === 0 || done === total) {
        const r = results.filter((x) => x?.reachable).length;
        process.stdout.write(`\r  ${done}/${total}  reachable:${r}   `);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  process.stdout.write("\n");

  const today = new Date().toISOString().slice(0, 10);
  const withA2a = results.filter((r) => r.a2a_skills?.length || r.a2a_desc).length;
  const withMcp = results.filter((r) => r.mcp_tools?.length).length;
  const out = {
    generated_at: today,
    total,
    reachable: results.filter((r) => r.reachable).length,
    with_a2a: withA2a,
    with_mcp: withMcp,
    agents: results.filter((r) => r.reachable),
  };
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`reachable ${out.reachable}/${total} · a2a-skills ${withA2a} · mcp-tools ${withMcp} -> ${OUT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
