/**
 * Urban Revolution — AI Design Generator Edge Function
 *
 * Receives { prompt, type } from the client, forwards to Anthropic's
 * Messages API server-side, and returns a structured design concept.
 *
 * The Anthropic API key lives only in the ANTHROPIC_API_KEY environment
 * variable on the Vercel server — it never reaches the browser. This
 * replaces the demo-only browser-direct call in js/ai.js
 * (window.URBAN_REVOLUTION_API_KEY) with a production-safe proxy, the
 * same pattern as api/try-on.js for the photorealistic try-on.
 *
 * Without the key configured, the function returns a 500 with a clear
 * message; the client then falls back to the local keyword generator,
 * so the app keeps working either way.
 *
 * Response shape (consumed by generateDesign in js/ai.js):
 *   { name, description, color, material, fit, tags, constructionNotes }
 */

export const config = { runtime: "edge" };

const API_ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";
const VALID_GARMENT_TYPES = ['tshirt', 'hoodie', 'shirt', 'pants', 'jacket', 'dress'];

export default async function handler(request) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return jsonError(500,
            "ANTHROPIC_API_KEY not configured on the server. " +
            "Set it in Vercel → Project Settings → Environment Variables.",
        );
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return jsonError(400, "Body must be JSON");
    }

    const { prompt, type } = payload;
    if (!prompt || typeof prompt !== "string") {
        return jsonError(400, "Missing or invalid prompt");
    }
    if (prompt.length > 2000) {
        return jsonError(400, "prompt must be under 2000 chars");
    }
    const garmentType = typeof type === "string" ? type : "tshirt";
    if (!VALID_GARMENT_TYPES.includes(garmentType)) {
        return jsonError(400, `Invalid garment type: ${garmentType}. Allowed: ${VALID_GARMENT_TYPES.join(', ')}`);
    }

    const userPrompt =
        `Du bist Designer für Urban Revolution. Erstelle ein JSON-Design-Konzept für: ` +
        `"${prompt}". Kleidungstyp: ${garmentType}.\n\n` +
        `Antworte NUR mit JSON:\n` +
        `{\n` +
        `  "name": "Designname (max 4 Wörter)",\n` +
        `  "description": "2-3 Sätze, Deutsch",\n` +
        `  "color": "#hexcode",\n` +
        `  "material": "cotton|linen|denim|wool|fleece|silk|polyester",\n` +
        `  "fit": 0.0 bis 1.0,\n` +
        `  "tags": ["tag1","tag2","tag3"],\n` +
        `  "constructionNotes": ["Note 1","Note 2","Note 3"]\n` +
        `}`;

    let response;
    try {
        response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 1024,
                messages: [{ role: "user", content: userPrompt }],
            }),
        });
    } catch (err) {
        return jsonError(502, `Anthropic request failed: ${err.message}`);
    }

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        return jsonError(502,
            `Anthropic API ${response.status}: ${text.slice(0, 400)}`,
        );
    }

    let data;
    try {
        data = await response.json();
    } catch {
        return jsonError(502, "Anthropic returned non-JSON response");
    }

    const text = data?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return jsonError(502, "Anthropic returned no parseable design JSON");
    }

    let design;
    try {
        design = JSON.parse(jsonMatch[0]);
    } catch {
        return jsonError(502, "Anthropic design JSON was malformed");
    }

    return Response.json(design);
}

function jsonError(status, message) {
    return Response.json({ error: message }, { status });
}
