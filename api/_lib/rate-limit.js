/**
 * Urban Revolution — Shared Upstash-backed rate limiter (Edge Functions)
 *
 * A cost-DoS safety net for the billed AI proxies (generate-design.js,
 * try-on.js). The only existing throttle on those was
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

// Best-effort client IP for a Vercel Edge Function. Vercel's own docs note
// that they APPEND to `x-forwarded-for` rather than replace it — a caller can
// send `X-Forwarded-For: <anything>` and Vercel just tacks the real
// connecting IP on after it. Trusting the *first* entry (as this used to)
// let a script defeat the per-IP limiter below entirely by sending a fresh
// fake first entry on every request. `x-real-ip` is what Vercel recommends
// instead — it's set by their edge network from the actual connection, not
// from a client-supplied header, so it can't be spoofed the same way. Fall
// back to the *last* `x-forwarded-for` entry (the hop closest to Vercel's own
// edge) only when `x-real-ip` is absent (e.g. local `vercel dev`), and to a
// shared "unknown" bucket only as a last resort.
export function clientIp(request) {
  const real = request.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
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
    if (data[1]?.error) {
      // INCR landed but EXPIRE didn't — the key would otherwise never expire
      // (a slow, unbounded key leak in the shared Upstash instance). Retry the
      // EXPIRE alone, best-effort: not awaited-for-correctness, doesn't affect
      // the rate-limit result either way.
      console.error(`[rate-limit:${prefix}] EXPIRE failed for ${key}, retrying: ${data[1].error}`);
      fetch(`${url}/EXPIRE/${encodeURIComponent(key)}/${windowSeconds + 5}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    return { limited: count > limit, count };
  } catch (err) {
    console.error(`[rate-limit:${prefix}] check failed, failing open: ${err.message}`);
    return { limited: false, count: 0 };
  }
}
