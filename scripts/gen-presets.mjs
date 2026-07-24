/**
 * One-off generator for the 6 photoreal preset persons used in the
 * Ownership/Try-on moment (male/female × 3 skin tones). Runs FLUX 1.1 Pro
 * (same engine as api/try-on.js) and writes full-body neutral studio
 * portraits to assets/presets/. These ship as static assets; at runtime a
 * selected preset is sent to /api/try-on as the "userPhoto" base the VTO
 * edits the garment onto.
 *
 *   REPLICATE_API_TOKEN=… node scripts/gen-presets.mjs
 *
 * Not part of the app or CI — a build-time tool. Re-run only to refresh art.
 */

import { writeFile, mkdir, access } from "node:fs/promises";

const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) {
    console.error("REPLICATE_API_TOKEN not set");
    process.exit(1);
}

const MODEL =
    "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions";

// Neutral base outfit + clean cinematic backdrop so flux-kontext can later
// re-dress the figure, and so skin tone — not clothing — is what varies.
const BASE =
    "Full-body studio fashion photograph of a %S, head to toe fully visible, " +
    "standing relaxed and natural facing the camera, arms slightly away from the body, " +
    "calm neutral expression, wearing a plain fitted light-grey short-sleeve top and plain mid-grey trousers, " +
    "barefoot, %SKIN. " +
    "Seamless deep charcoal-grey studio backdrop, soft even cinematic softbox lighting, " +
    "sharp focus, ultra photorealistic, editorial lookbook quality, true-to-life colour. " +
    "No text, no logo, no watermark, no props, single person centered with full headroom and feet in frame.";

const SUBJECTS = [
    { id: "f-1", s: "woman in her late twenties", skin: "fair light skin" },
    { id: "f-2", s: "woman in her late twenties", skin: "medium olive skin" },
    { id: "f-3", s: "woman in her late twenties", skin: "deep dark brown skin" },
    { id: "m-1", s: "man in his late twenties", skin: "fair light skin" },
    { id: "m-2", s: "man in his late twenties", skin: "medium olive skin" },
    { id: "m-3", s: "man in his late twenties", skin: "deep dark brown skin" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function create(prompt) {
    // Low-credit Replicate accounts are throttled to ~6 req/min, burst 1.
    // Honour the server's retry_after on 429 instead of failing.
    for (let attempt = 0; attempt < 8; attempt++) {
        const res = await fetch(MODEL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
                Prefer: "wait=30",
            },
            body: JSON.stringify({
                input: {
                    prompt,
                    aspect_ratio: "2:3",
                    output_format: "jpg",
                    output_quality: 92,
                    prompt_upsampling: false,
                    safety_tolerance: 2,
                },
            }),
        });
        if (res.status === 429) {
            const body = await res.json().catch(() => ({}));
            const wait = (body.retry_after || 10) + 2;
            process.stdout.write(`(throttled, wait ${wait}s) `);
            await sleep(wait * 1000);
            continue;
        }
        if (!res.ok) throw new Error(`create ${res.status}: ${await res.text()}`);
        return res.json();
    }
    throw new Error("create: gave up after repeated 429s");
}

async function generate(prompt) {
    let pred = await create(prompt);

    // Poll if still running after the synchronous wait.
    while (pred.status !== "succeeded") {
        if (pred.status === "failed" || pred.status === "canceled") {
            throw new Error(`prediction ${pred.status}: ${pred.error || ""}`);
        }
        await sleep(2000);
        const poll = await fetch(pred.urls.get, {
            headers: { Authorization: `Bearer ${TOKEN}` },
        });
        pred = await poll.json();
    }
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    const img = await fetch(url);
    return Buffer.from(await img.arrayBuffer());
}

await mkdir("assets/presets", { recursive: true });
for (const sub of SUBJECTS) {
    const out = `assets/presets/${sub.id}.jpg`;
    if (await access(out).then(() => true).catch(() => false)) {
        console.log(`Skipping ${sub.id} (exists)`);
        continue;
    }
    const prompt = BASE.replace("%S", sub.s).replace("%SKIN", sub.skin);
    process.stdout.write(`Generating ${sub.id} … `);
    try {
        const buf = await generate(prompt);
        await writeFile(out, buf);
        console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
        console.log(`FAILED: ${e.message}`);
    }
}
console.log("Done.");
