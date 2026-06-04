/**
 * Urban Revolution — Photorealistic Try-On Edge Function
 *
 * Receives { userPhoto, designPrompt } from the client, forwards to
 * Replicate's FLUX-Kontext-Pro model, returns the generated image URL.
 *
 * The Replicate API token lives only in the REPLICATE_API_TOKEN
 * environment variable on the Vercel server — it never reaches the
 * browser. This is the entire reason this proxy exists; without it,
 * we'd have to ship an API key in the frontend, which is a security
 * disaster on a public static site.
 *
 * Edge runtime limits on the Vercel free tier:
 *   - 25 s execution timeout (we use Prefer: wait=20 to stay under)
 *   - 4.5 MB request/response body (user photos must be reasonable
 *     size; we expect compressed JPEG/PNG data-URLs from the existing
 *     pose-detection flow, typically < 500 KB)
 */

export const config = { runtime: "edge" };

const MODEL_ENDPOINT =
    "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions";

export default async function handler(request) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
        // Log the actionable detail server-side; the browser only gets a
        // neutral, coded message (never leak config/billing state to users).
        console.error("[try-on] REPLICATE_API_TOKEN not configured");
        return jsonError(503, "Try-on service unavailable", "service_unavailable");
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return jsonError(400, "Body must be JSON");
    }

    const { userPhoto, designPrompt } = payload;
    if (!userPhoto || !designPrompt) {
        return jsonError(400, "Missing userPhoto or designPrompt");
    }
    if (typeof userPhoto !== "string" || !userPhoto.startsWith("data:image/")) {
        return jsonError(400, "userPhoto must be a data:image/... URL");
    }
    if (typeof designPrompt !== "string" || designPrompt.length > 1000) {
        return jsonError(400, "designPrompt must be a string under 1000 chars");
    }

    // FLUX-Kontext is an instruction-following image editor. The prompt
    // tells it to keep the person identity while swapping clothing.
    const editInstruction =
        `Replace this person's clothing with: ${designPrompt}. ` +
        `Keep the person's face, hair, body proportions, pose, and ` +
        `background identical. Studio fashion photography lighting, ` +
        `sharp focus on the garment fabric and fit.`;

    let createResponse;
    try {
        createResponse = await fetch(MODEL_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                // Synchronous wait: Replicate holds the connection open
                // until the prediction finishes (or 20 s, whichever first).
                Prefer: "wait=20",
            },
            body: JSON.stringify({
                input: {
                    input_image: userPhoto,
                    prompt: editInstruction,
                    aspect_ratio: "match_input_image",
                    output_format: "jpg",
                    safety_tolerance: 2,
                },
            }),
        });
    } catch (err) {
        console.error(`[try-on] Replicate request failed: ${err.message}`);
        return jsonError(502, "Upstream request failed", "service_unavailable");
    }

    if (!createResponse.ok) {
        const text = await createResponse.text().catch(() => "");
        return upstreamError("try-on", createResponse.status, text.slice(0, 400));
    }

    const prediction = await createResponse.json();

    if (prediction.status === "succeeded") {
        const imageUrl = Array.isArray(prediction.output)
            ? prediction.output[0]
            : prediction.output;
        return Response.json({ imageUrl });
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
        console.error(`[try-on] prediction ${prediction.status}: ${prediction.error || ""}`);
        return jsonError(502, "Generation failed", "failed");
    }

    // Still processing after the synchronous wait — return the polling
    // URL so the client can finish the request. We don't poll here
    // because the edge function would time out.
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
