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
        return jsonError(500,
            "REPLICATE_API_TOKEN not configured on the server. " +
            "Set it in Vercel → Project Settings → Environment Variables.",
        );
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
        return jsonError(502, `Replicate request failed: ${err.message}`);
    }

    if (!createResponse.ok) {
        const text = await createResponse.text().catch(() => "");
        return jsonError(502,
            `Replicate API ${createResponse.status}: ${text.slice(0, 400)}`,
        );
    }

    const prediction = await createResponse.json();

    if (prediction.status === "succeeded") {
        const imageUrl = Array.isArray(prediction.output)
            ? prediction.output[0]
            : prediction.output;
        return Response.json({ imageUrl });
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
        return jsonError(502,
            `Generation failed: ${prediction.error || prediction.status}`,
        );
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

function jsonError(status, message) {
    return Response.json({ error: message }, { status });
}
