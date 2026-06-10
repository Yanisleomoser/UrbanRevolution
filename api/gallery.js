/**
 * Urban Revolution — Community-Galerie (UR Create · Save → Share → Remix)
 *
 * Edge Function im Stil von waitlist.js: Upstash Redis über die REST-API
 * (edge-nativ, kein npm-Paket). Speichert publizierte Kreationen als
 * kompakte DNA-Share-Strings (dasselbe Format wie js/design-engine/share.js —
 * KEINE Bilder, KEINE personenbezogenen Daten; der optionale Name ist ein
 * frei gewähltes Pseudonym).
 *
 *   GET  /api/gallery                    → { ok, items: [{ d, name, by, ts }] }  (neueste zuerst, max 24)
 *   POST /api/gallery { d, name?, by? }  → { ok }
 *
 * Graceful: ohne Upstash-Env antwortet GET mit { ok, items: null } (der
 * Client zeigt die kuratierte Fallback-Galerie) und POST mit dem neutralen
 * coded error — wie bei den Replicate-Funktionen.
 */
export const config = { runtime: "edge" };

const KEY = "urev:gallery";
const MAX_ITEMS = 60;   // Ringpuffer in Redis
const PAGE = 24;        // pro GET ausgeliefert
const MAX_DNA = 4000;   // Share-Strings sind ~200–600 Zeichen; Schutzlimit
const MAX_NAME = 48;
const MAX_BY = 24;

function jsonError(status, message, code) {
  const body = code ? { error: message, code } : { error: message };
  return Response.json(body, { status });
}

export default async function handler(req) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const configured = Boolean(url && token);
  const redis = async (cmd) => {
    const res = await fetch(`${url}/${cmd.map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    return (await res.json()).result;
  };

  try {
    if (req.method === "GET") {
      if (!configured) return Response.json({ ok: true, items: null });
      const raw = (await redis(["LRANGE", KEY, "0", String(PAGE - 1)])) || [];
      const items = raw.map((s) => { try { return JSON.parse(s); } catch (_e) { return null; } }).filter(Boolean);
      return Response.json({ ok: true, items });
    }

    if (req.method === "POST") {
      if (!configured) return jsonError(503, "Gallery unavailable", "service_unavailable");
      let body;
      try { body = await req.json(); } catch (_e) { return jsonError(400, "Invalid JSON", "bad_request"); }
      const d = typeof body.d === "string" ? body.d.trim() : "";
      // Share-Strings sind URL-sicheres Base64 (siehe share.js) — alles andere ablehnen.
      if (!d || d.length > MAX_DNA || !/^[A-Za-z0-9\-_=%.]+$/.test(d)) {
        return jsonError(400, "Invalid creation data", "bad_request");
      }
      const name = typeof body.name === "string" ? body.name.slice(0, MAX_NAME).trim() : "";
      const by = typeof body.by === "string" ? body.by.slice(0, MAX_BY).trim() : "";
      const item = JSON.stringify({ d, name, by, ts: Date.now() });
      await redis(["LPUSH", KEY, item]);
      await redis(["LTRIM", KEY, "0", String(MAX_ITEMS - 1)]);
      return Response.json({ ok: true });
    }

    return jsonError(405, "Method not allowed");
  } catch (err) {
    console.error("[gallery]", err && err.message);
    return jsonError(503, "Gallery unavailable", "service_unavailable");
  }
}
