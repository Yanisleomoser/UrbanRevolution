/**
 * Urban Revolution — Shared Upstash-backed rate limiter (Edge Functions)
 *
 * A cost-DoS safety net for the billed AI proxies (generate-design.js,
 * preview-design.js, try-on.js). The only existing throttle on those was
 * `urev_preview_count` in the BROWSER's localStorage — a script that POSTs
 * to the endpoint directly, skipping the UI entirely, never sets it, so it
 * can run up the Anthropic/Replicate bill without limit. This adds a
 * server-side, per-IP fixed-window counter in the same Upstash Redis
 * gallery.js/track.js/waitlist.js already use — no new env var/integration.
 *
 * Prefixed with `_` so Vercel does not turn this file into its own route
 * (same convention Vercel uses for shared helpers under /api).
 *
 * Fails OPEN, same spirit as track.js: without Upstash configured (local
 * dev, or a deploy before the integration is added) requests are never
 * blocked by this — only a genuinely configured store can throttle. An
 * Upstash network hiccup also fails open rather than turning a transient
 * store issue into a hard outage of a billed, revenue-relevant flow.
 */

// Fixed-window counter: the window number is baked into the key, so a plain
// INCR + EXPIRE (no NX dance) is race-free — a fresh window is always a
// fresh key, and the previous window's key just expires on its own.
export function rateLimitKey(prefix, ip, windowSeconds, nowMs) {
  const bucket = Math.floor(nowMs / 1000 / windowSeconds);
  return `urev:rl:${prefix}:${ip}:${bucket}`;
}

// Best-effort client IP for a Vercel Edge Function. `x-forwarded-for` can
// carry a client,proxy1,proxy2 chain — the first entry is the original
// client. Falls back to a shared "unknown" bucket (only ever reachable
// locally — real internet traffic reaching a deployed edge function always
// carries this header) rather than throwing.
export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || "unknown";
}

// Returns { limited, count }. On any Upstash error (incl. not configured)
// resolves to { limited: false, count: 0 } — see file header.
export async function checkRateLimit(request, { url, token, prefix, limit, windowSeconds }) {
  if (!url || !token) return { limited: false, count: 0 };
  const ip = clientIp(request);
  const key = rateLimitKey(prefix, ip, windowSeconds, Date.now());
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds + 5],
      ]),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data[0]?.error) throw new Error("Unexpected pipeline response");
    const count = Number(data[0]?.result) || 0;
    return { limited: count > limit, count };
  } catch (err) {
    console.error(`[rate-limit:${prefix}] check failed, failing open: ${err.message}`);
    return { limited: false, count: 0 };
  }
}
