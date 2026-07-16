/**
 * Urban Revolution — Telemetry Edge Function (Umsetzungs-Brief §6, Stufe B)
 *
 * Aggregate-only counters for the Design-Engine journey in Upstash Redis — NO
 * PII, no photo/measurement data, only whitelisted event names + sanitised node
 * ids. Reuses the same Upstash integration as api/waitlist.js
 * (UPSTASH_REDIS_REST_URL / _TOKEN). Without it, POST is silently swallowed and
 * GET returns no data — the site/journey never breaks.
 *
 *   POST { event, id }   → 204 (best-effort, never errors to the client)
 *   GET  ?key=<KEY>      → { configured, events:{…}, nodes:{…} }   (admin)
 *
 * The /insights page reads GET (behind ?key matching TELEMETRY_KEY). The
 * question logic does NOT learn across users on its own — these aggregates are
 * the basis for manual (or later: optional soft-prior) node tuning.
 */

import { checkRateLimit } from "./_lib/rate-limit.js";

export const config = { runtime: "edge" };

const EVENTS_KEY = "urev:tel:events";
const NODES_KEY = "urev:tel:nodes";
// Unlike the billed AI proxies, this beacon is fire-and-forget and never
// surfaces errors to the client (see the POST handler below) — so a
// rate-limit hit is handled the same way as any other best-effort failure:
// skip the Redis write, still 204. The limit itself exists so a flood can't
// exhaust the shared Upstash instance's quota, which would otherwise trip
// _lib/rate-limit.js's fail-open behavior for the billed proxies too.
const RATE_LIMIT = { prefix: "track-post", limit: 120, windowSeconds: 600 };
// sanitiseId bounds each id's length but not the number of *distinct* ids —
// without a cap, a caller posting a fresh random id on every request grows
// urev:tel:nodes without bound (unbounded Redis storage/cost, unlike
// gallery.js's LTRIM-bounded list or waitlist.js's legitimately-unbounded set).
const MAX_NODE_FIELDS = 500;

// Constant-time string compare so a wrong TELEMETRY_KEY guess can't be
// narrowed down via response-time side-channel (standard `!==` short-circuits
// on the first differing byte). Mirrors api/gen-image.js's IMAGE_GEN_KEY gate.
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export const ALLOWED = new Set([
  "node_shown", "node_choice", "node_skip", "node_back",
  "journey_refine", "generate", "generate_ok", "generate_fail", "abandon",
]);
export const NODE_SUFFIX = { node_shown: "shown", node_choice: "choice", node_skip: "skip" };
export const sanitiseId = (v) => (typeof v === "string" ? v.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) : "");

// Build the Redis counter increments for one telemetry payload. Returns [] when
// the event isn't whitelisted (the handler then 204s). Drops a per-node counter
// only when the id survives sanitisation AND the event has a node suffix. Pure —
// no network — so the whitelist + id sanitisation can be unit-tested directly.
export function buildCommands(payload) {
  const event = payload && typeof payload.event === "string" ? payload.event : "";
  if (!ALLOWED.has(event)) return [];
  const cmds = [["HINCRBY", EVENTS_KEY, event, 1]];
  const id = sanitiseId(payload && payload.id);
  if (id && NODE_SUFFIX[event]) cmds.push(["HINCRBY", NODES_KEY, `${id}:${NODE_SUFFIX[event]}`, 1]);
  return cmds;
}

export default async function handler(request) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const configured = Boolean(url && token);

  if (request.method === "GET") {
    const adminKey = process.env.TELEMETRY_KEY;
    const given = new URL(request.url).searchParams.get("key");
    if (!adminKey || !timingSafeEqual(given || "", adminKey)) {
      return Response.json({ error: "forbidden", code: "forbidden" }, { status: 403 });
    }
    if (!configured) return Response.json({ configured: false, events: {}, nodes: {} });
    try {
      const [events, nodes] = await pipeline(url, token, [
        ["HGETALL", EVENTS_KEY],
        ["HGETALL", NODES_KEY],
      ]);
      return Response.json({ configured: true, events: toObj(events), nodes: toObj(nodes) });
    } catch (err) {
      console.error(`[track] report failed: ${err.message}`);
      return Response.json({ configured: true, events: {}, nodes: {} });
    }
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Best-effort: any problem → 204, never surface to the UI.
  if (!configured) return new Response(null, { status: 204 });
  const { limited } = await checkRateLimit(request, { url, token, ...RATE_LIMIT });
  if (limited) return new Response(null, { status: 204 });
  try {
    const payload = await request.json();
    const cmds = buildCommands(payload);
    if (cmds.length === 0) return new Response(null, { status: 204 });
    // Node ids are data-driven (content/nodes/*.json), so there's no static
    // allow-list to validate against here — instead cap the *distinct* field
    // count once a new (never-seen) id would be added, so known ids keep
    // incrementing freely but a flood of fresh ids can't grow the hash forever.
    if (cmds.length > 1) {
      const field = cmds[1][2];
      // Both reads in ONE round-trip (was HEXISTS, then a separate HLEN when
      // new) — shaves a full Upstash hop off every new-id event. The distinct-
      // field cap is a soft, best-effort guard on a fire-and-forget beacon, so a
      // rare TOCTOU overshoot of a few fields under concurrency is acceptable.
      const [exists, len] = await pipeline(url, token, [
        ["HEXISTS", NODES_KEY, field],
        ["HLEN", NODES_KEY],
      ]);
      if (!exists && Number(len) >= MAX_NODE_FIELDS) cmds.pop();
    }
    await pipeline(url, token, cmds);
  } catch (err) {
    console.error(`[track] write failed: ${err.message}`);
  }
  return new Response(null, { status: 204 });
}

// Upstash REST flat-array HGETALL → object.
export function toObj(arr) {
  const out = {};
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i += 2) out[arr[i]] = Number(arr[i + 1]);
  } else if (arr && typeof arr === "object") {
    Object.entries(arr).forEach(([k, v]) => (out[k] = Number(v)));
  }
  return out;
}

async function pipeline(url, token, commands) {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected pipeline response");
  return data.map((entry) => {
    if (entry && entry.error) throw new Error(entry.error);
    return entry ? entry.result : null;
  });
}
