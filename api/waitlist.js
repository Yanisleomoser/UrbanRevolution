/**
 * Urban Revolution — Waitlist Edge Function
 *
 * Persists pre-launch waitlist signups in Upstash Redis (free tier, pick an
 * EU region for DSGVO-friendly residency). Talked to over its plain REST API
 * with `fetch` — no npm package, edge-runtime native, in the spirit of the
 * other api/ functions.
 *
 *   POST { email, consent }  →  { ok, status: "joined" | "already", count }
 *   GET                      →  { count }            (live signup count)
 *
 * On any failure (store not configured yet, upstream error) the real reason
 * is logged server-side and the browser gets a neutral, coded message — same
 * pattern as preview-design.js / try-on.js. The site never breaks: GET just
 * returns { count: null } and the page hides the number.
 *
 * Storage (DSGVO-minimal — only what a waitlist needs):
 *   SET  urev:waitlist            → the set of emails (auto-dedupes)
 *   HASH urev:waitlist:ts         → email → ISO signup timestamp (for export)
 *
 * Setup: add the Upstash integration in Vercel (Marketplace → Upstash Redis,
 * free tier, EU region). It auto-injects UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN. No other config.
 */

import { checkRateLimit } from "./_lib/rate-limit.js";

export const config = { runtime: "edge" };

const SET_KEY = "urev:waitlist";
const TS_KEY = "urev:waitlist:ts";
// Mirrors gallery.js's POST rate limit: without it, an unthrottled loop could
// both grow the Upstash-stored set unboundedly and exhaust the shared
// instance's quota, which would trip _lib/rate-limit.js's fail-open behavior
// for the billed AI proxies that share the same store.
const RATE_LIMIT = { prefix: "waitlist-post", limit: 10, windowSeconds: 600 };
// Basic, permissive email shape check (real validation is delivery anyway).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trim + lowercase the submitted email (or "" for anything non-string).
export function normalizeEmail(raw) {
    return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

// Pure validation of a signup payload — the DSGVO-load-bearing gate. Returns
// the normalised email on success, or a coded rejection (same codes the client
// maps via err.*). Split out of the handler so it can be unit-tested without a
// Redis/network round-trip.
export function validateSignup(payload) {
    const email = normalizeEmail(payload && payload.email);
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return { ok: false, status: 400, message: "Invalid email", code: "invalid_email" };
    }
    if (!payload || payload.consent !== true) {
        return { ok: false, status: 400, message: "Consent required", code: "consent_required" };
    }
    return { ok: true, email };
}

export default async function handler(request) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    const configured = Boolean(url && token);

    if (request.method === "GET") {
        if (!configured) return Response.json({ count: null });
        try {
            const n = await redis(url, token, ["SCARD", SET_KEY]);
            return Response.json({ count: typeof n === "number" ? n : null });
        } catch (err) {
            console.error(`[waitlist] count failed: ${err.message}`);
            return Response.json({ count: null });
        }
    }

    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    if (!configured) {
        console.error("[waitlist] UPSTASH_REDIS_REST_URL / _TOKEN not configured");
        return jsonError(503, "Waitlist store not configured", "service_unavailable");
    }

    const { limited } = await checkRateLimit(request, { url, token, ...RATE_LIMIT });
    if (limited) return jsonError(429, "Too many requests", "rate_limited");

    let payload;
    try {
        payload = await request.json();
    } catch {
        // A malformed body isn't an email problem — don't mistag it
        // "invalid_email" (validateSignup's actual code for that case).
        return jsonError(400, "Body must be JSON");
    }

    const check = validateSignup(payload);
    if (!check.ok) return jsonError(check.status, check.message, check.code);
    const email = check.email;

    try {
        // One round-trip: add to the set, record the timestamp, read the count.
        const [added, , count] = await pipeline(url, token, [
            ["SADD", SET_KEY, email],
            ["HSET", TS_KEY, email, new Date().toISOString()],
            ["SCARD", SET_KEY],
        ]);
        return Response.json({
            ok: true,
            status: added === 1 ? "joined" : "already",
            count: typeof count === "number" ? count : null,
        });
    } catch (err) {
        console.error(`[waitlist] signup failed: ${err.message}`);
        return jsonError(502, "Upstream store failed", "service_unavailable");
    }
}

// Single Redis command via the Upstash REST API. Returns the `result` field.
async function redis(url, token, command) {
    const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    return data.result;
}

// Pipelined commands → array of result values (in order).
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

function jsonError(status, message, code) {
    return Response.json(code ? { error: message, code } : { error: message }, { status });
}
