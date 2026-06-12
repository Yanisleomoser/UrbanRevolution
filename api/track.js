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

export const config = { runtime: "edge" };

const EVENTS_KEY = "urev:tel:events";
const NODES_KEY = "urev:tel:nodes";
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
    if (!adminKey || given !== adminKey) {
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
  try {
    const payload = await request.json();
    const cmds = buildCommands(payload);
    if (cmds.length === 0) return new Response(null, { status: 204 });
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
