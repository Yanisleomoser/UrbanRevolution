/**
 * Urban Revolution — Build-time image generator (Edge Function)
 *
 * One-off, KEY-GATED raw text→image route used to build the Design-Engine image
 * library (Hero / Mood / Material) WITHOUT exposing the Replicate token outside
 * Vercel. Calls FLUX 1.1 Pro with the same server-side REPLICATE_API_TOKEN as
 * preview-design.js / try-on.js, but — unlike preview-design — passes the prompt
 * through verbatim (no ghost-mannequin garment wrapper), so atmospheric mood and
 * fabric-macro prompts render correctly.
 *
 * Protected by IMAGE_GEN_KEY so the public can't run up the Replicate bill with
 * arbitrary prompts. If IMAGE_GEN_KEY is unset the route is DISABLED (403).
 * Safe to remove again once the library is built.
 *
 *   POST { prompt, aspect?, key }
 *     → { imageUrl }                  on success
 *     → { error, code }               on failure (403 wrong/missing key, etc.)
 */

export const config = { runtime: "edge" };

const MODEL_ENDPOINT = "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions";
const ASPECTS = new Set(["1:1", "4:5", "3:4", "2:3", "16:9", "9:16"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function jsonError(status, message, code) {
  return Response.json(code ? { error: message, code } : { error: message }, { status });
}

export default async function handler(request) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.REPLICATE_API_TOKEN;
  const gateKey = process.env.IMAGE_GEN_KEY;

  let payload;
  try { payload = await request.json(); } catch { return jsonError(400, "Body must be JSON"); }

  // Gate first — never reveal whether Replicate is configured to an unauthorised caller.
  if (!gateKey || typeof payload.key !== "string" || payload.key !== gateKey) {
    return jsonError(403, "Forbidden", "forbidden");
  }
  if (!apiKey) {
    console.error("[gen-image] REPLICATE_API_TOKEN not configured");
    return jsonError(503, "Image service unavailable", "service_unavailable");
  }

  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt || prompt.length > 1500) return jsonError(400, "Missing or oversized prompt", "invalid_prompt");
  const aspect = ASPECTS.has(payload.aspect) ? payload.aspect : "4:5";

  let res;
  try {
    res = await fetch(MODEL_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Prefer: "wait=20" },
      body: JSON.stringify({ input: { prompt, aspect_ratio: aspect, output_format: "jpg", output_quality: 90, prompt_upsampling: false, safety_tolerance: 2 } }),
    });
  } catch (err) {
    console.error(`[gen-image] Replicate request failed: ${err.message}`);
    return jsonError(502, "Upstream request failed", "service_unavailable");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[gen-image] Replicate ${res.status}: ${text.slice(0, 200)}`);
    return jsonError(502, "Upstream error", "service_unavailable");
  }

  let pred = await res.json();
  // Short server-side poll within the edge budget (token never leaves Vercel).
  let tries = 0;
  while (pred.status !== "succeeded" && pred.status !== "failed" && tries++ < 3) {
    await sleep(2000);
    try {
      const poll = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${apiKey}` } });
      pred = await poll.json();
    } catch { break; }
  }
  if (pred.status !== "succeeded") {
    return jsonError(504, "Generation pending — retry", "pending");
  }
  const imageUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  return Response.json({ imageUrl });
}
