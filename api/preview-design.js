/**
 * Urban Revolution — AI Design Preview (garment visualisation) Edge Function
 *
 * Receives { designPrompt } and returns a professional studio "ghost
 * mannequin" product render of the *garment* — NO user photo involved.
 *
 * This is the cheap, privacy-free "do I like it?" gate the user sees
 * BEFORE spending a photorealistic try-on run on their own photo. Most
 * visitors can judge the design from this render and only reach for the
 * (more expensive, photo-based) /api/try-on once the piece actually
 * appeals to them.
 *
 * It reuses the same Replicate token as api/try-on.js
 * (REPLICATE_API_TOKEN) but calls a pure text-to-image model
 * (FLUX 1.1 Pro) instead of the Kontext image editor. To switch engines
 * (e.g. recraft-ai/recraft-v3 for a cheaper "catalogue" look) change
 * MODEL_ENDPOINT and, if needed, the input field names below — nothing
 * else depends on the model.
 *
 * Edge runtime limits (Vercel free tier) mirror try-on.js: 25 s timeout
 * (we use Prefer: wait=20 to stay under) and a 4.5 MB body — not a
 * concern here since the request is just a text prompt.
 *
 * Response shape (consumed by js/app.js generateDesignPreview):
 *   { imageUrl }                              on success
 *   { pending, pollUrl, predictionId }        if still running after 20 s
 *   { error }                                 on any failure
 */

export const config = { runtime: "edge" };

// FLUX 1.1 Pro — text-to-image, ~$0.04/image, ~4–6 s. Swap this single
// constant to change the visualisation engine.
const MODEL_ENDPOINT =
    "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions";

export default async function handler(request) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
        // Log the actionable detail server-side; the browser only gets a
        // neutral, coded message (never leak config/billing state to users).
        console.error("[preview-design] REPLICATE_API_TOKEN not configured");
        return jsonError(503, "Preview service unavailable", "service_unavailable");
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return jsonError(400, "Body must be JSON");
    }

    const { designPrompt } = payload;
    if (!designPrompt || typeof designPrompt !== "string") {
        return jsonError(400, "Missing or invalid designPrompt");
    }
    if (designPrompt.length > 1000) {
        return jsonError(400, "designPrompt must be a string under 1000 chars");
    }

    // Wrap the raw design concept in a studio product-photography brief.
    // Ghost-mannequin / no face → no uncanny valley, no representation
    // pitfalls, maximally consistent and "e-commerce clean". The brief
    // pushes for true colour + fabric detail so the render reads as the
    // actual garment, not a stylised illustration.
    const prompt =
        `Professional e-commerce fashion product photograph of a single garment: ${designPrompt}. ` +
        `Ghost mannequin / invisible mannequin presentation — the garment is shown three-dimensionally as if worn, ` +
        `but with no visible person, no face, no head, no hands. ` +
        `Centered on a seamless soft neutral studio background, even softbox lighting, crisp focus on the fabric texture, weave, seams and stitching, accurate true-to-life colour. ` +
        `High-end fashion catalogue look, editorial quality, ultra photorealistic. No text, no logo, no watermark, no props.`;

    let createResponse;
    try {
        createResponse = await fetch(MODEL_ENDPOINT, {
            method: "POST",
            // Bound the call so a slow/black-holed upstream can't hang the
            // (billed) function; the catch maps it to a neutral error. 25 s
            // leaves margin over the Prefer: wait=20 below.
            signal: AbortSignal.timeout(25000),
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                // Synchronous wait: Replicate holds the connection open
                // until the prediction finishes (or 20 s, whichever first).
                Prefer: "wait=20",
            },
            body: JSON.stringify({
                input: {
                    prompt,
                    // Portrait 4:5 frames a single garment well for a card.
                    aspect_ratio: "4:5",
                    output_format: "jpg",
                    output_quality: 90,
                    // Keep the brief verbatim (the prompt is already rich) so
                    // the render stays faithful to the user's concept.
                    prompt_upsampling: false,
                    safety_tolerance: 2,
                },
            }),
        });
    } catch (err) {
        console.error(`[preview-design] Replicate request failed: ${err.message}`);
        return jsonError(502, "Upstream request failed", "service_unavailable");
    }

    if (!createResponse.ok) {
        const text = await createResponse.text().catch(() => "");
        return upstreamError("preview-design", createResponse.status, text.slice(0, 400));
    }

    // Guard the parse like generate-design.js does: a 2xx with a malformed /
    // non-JSON body (edge-gateway hiccup, truncated/empty response) would
    // otherwise reject uncaught → a bare HTML 500 instead of the coded error.
    let prediction;
    try {
        prediction = await createResponse.json();
    } catch {
        console.error("[preview-design] Replicate returned non-JSON on a 2xx response");
        return jsonError(502, "Generation failed", "service_unavailable");
    }

    if (prediction.status === "succeeded") {
        const imageUrl = Array.isArray(prediction.output)
            ? prediction.output[0]
            : prediction.output;
        return Response.json({ imageUrl });
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
        console.error(`[preview-design] prediction ${prediction.status}: ${prediction.error || ""}`);
        return jsonError(502, "Generation failed", "failed");
    }

    // Still processing after the synchronous wait — hand the client the
    // polling URL (it can finish the request). We don't poll here because
    // the edge function would time out.
    return Response.json({
        pending: true,
        pollUrl: prediction.urls?.get,
        predictionId: prediction.id,
    }, { status: 202 });
}

// Classify an upstream Replicate failure into a SAFE, coded client error.
// The real status/body (which can include billing/credit/account state) is
// logged server-side only — the browser never sees it. `code` drives the
// localised user message in js/app.js.
function upstreamError(tag, status, detail) {
    console.error(`[${tag}] Replicate ${status}: ${detail}`);
    if (status === 429) return jsonError(503, "Rate limited", "rate_limited");
    // 402 (insufficient credit), 401/403 (auth), 5xx, etc. → generic.
    return jsonError(503, "Image service unavailable", "service_unavailable");
}

function jsonError(status, message, code) {
    return Response.json(code ? { error: message, code } : { error: message }, { status });
}

// Exported for unit tests (test/api-test.mjs). Not used by the edge runtime,
// which only invokes the default handler export.
export { upstreamError, jsonError };
