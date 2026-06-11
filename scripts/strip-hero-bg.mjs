/**
 * One-off: remove the studio background from the 4 hero garment photos so the
 * real photo sits on the SAME (transparent → dark stage) background as the
 * technical flat in the hero weave. Writes transparent PNGs next to the jpgs.
 *
 *   REPLICATE_API_TOKEN=… node scripts/strip-hero-bg.mjs
 *
 * After this writes the transparent {id}.png, they were downscaled (max height
 * 1000) and re-encoded to alpha {id}.webp (Chromium canvas, q0.85) — that is
 * what the runtime hero loads (~211 KB total vs ~3.3 MB PNG). The .png are the
 * intermediate and are not committed.
 *
 * Build-time tool, not part of the app/CI. Re-run only to refresh.
 */
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) { console.error("REPLICATE_API_TOKEN not set"); process.exit(1); }

const PREDICTIONS = "https://api.replicate.com/v1/predictions";
const VERSION = "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc"; // 851-labs/background-remover
const DIR = "js/design-engine/content/img/hero/";
const IDS = ["dress", "hoodie", "jacket", "pants"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function create(dataUri) {
    for (let attempt = 0; attempt < 8; attempt++) {
        const res = await fetch(PREDICTIONS, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
                Prefer: "wait=30",
            },
            body: JSON.stringify({
                version: VERSION,
                input: { image: dataUri, format: "png", background_type: "rgba" },
            }),
        });
        if (res.status === 429) {
            const body = await res.json().catch(() => ({}));
            const wait = (body.retry_after || 10) + 2;
            process.stdout.write(`(throttled ${wait}s) `);
            await sleep(wait * 1000);
            continue;
        }
        if (!res.ok) throw new Error(`create ${res.status}: ${await res.text()}`);
        return res.json();
    }
    throw new Error("gave up after 429s");
}

for (const id of IDS) {
    process.stdout.write(`Stripping ${id} … `);
    try {
        const buf = await readFile(`${DIR}${id}.jpg`);
        const dataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;
        let pred = await create(dataUri);
        while (pred.status !== "succeeded") {
            if (pred.status === "failed" || pred.status === "canceled") {
                throw new Error(`prediction ${pred.status}: ${pred.error || ""}`);
            }
            await sleep(2000);
            const poll = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } });
            pred = await poll.json();
        }
        const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
        const img = await fetch(url);
        const out = Buffer.from(await img.arrayBuffer());
        await writeFile(`${DIR}${id}.png`, out);
        console.log(`ok (${(out.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
        console.log(`FAILED: ${e.message}`);
    }
}
console.log("Done.");
