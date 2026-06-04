#!/usr/bin/env node
/**
 * Urban Revolution — Design Engine · image generator (brief §9)
 *
 * Generates the journey's mood / option images via Replicate FLUX 1.1 Pro
 * (same engine as api/preview-design.js) from js/design-engine/content/
 * img-manifest.json, and writes them to their on-disk slots. The modalities
 * already fall back to on-brand SVG, so the journey works without these — this
 * just swaps in real photos.
 *
 * Usage:
 *   REPLICATE_API_TOKEN=r8_xxx node scripts/generate-engine-images.mjs
 *   …add --force to re-generate images that already exist.
 *
 * Cost: ~$0.04 per image. Data-driven: add entries to img-manifest.json (no
 * code change) and re-run.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "js/design-engine/content/img-manifest.json");
const MODEL = "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions";
const FORCE = process.argv.includes("--force");
const TOKEN = process.env.REPLICATE_API_TOKEN;

function die(msg) { console.error("✗ " + msg); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(prompt) {
  let res = await fetch(MODEL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: {
      prompt, aspect_ratio: "3:4", output_format: "jpg", output_quality: 90,
      prompt_upsampling: false, safety_tolerance: 2,
    } }),
  });
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let pred = await res.json();
  // Poll if not resolved within the synchronous wait window.
  let tries = 0;
  while (pred.status !== "succeeded" && pred.status !== "failed" && tries++ < 30) {
    await sleep(2000);
    res = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } });
    pred = await res.json();
  }
  if (pred.status !== "succeeded") throw new Error(`generation ${pred.status}`);
  return Array.isArray(pred.output) ? pred.output[0] : pred.output;
}

async function main() {
  if (!TOKEN) die("REPLICATE_API_TOKEN nicht gesetzt. Beispiel:\n  REPLICATE_API_TOKEN=r8_xxx node scripts/generate-engine-images.mjs");
  if (!fs.existsSync(MANIFEST)) die("Manifest fehlt: " + MANIFEST);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const style = manifest.style || "";
  const entries = Object.entries(manifest.images || {});
  console.log(`→ ${entries.length} Bilder aus dem Manifest${FORCE ? " (force)" : ""}\n`);

  let made = 0, skipped = 0, failed = 0;
  for (const [rel, subject] of entries) {
    const out = path.join(ROOT, rel);
    if (fs.existsSync(out) && !FORCE) { console.log(`· skip (existiert): ${rel}`); skipped++; continue; }
    process.stdout.write(`· generiere ${rel} … `);
    try {
      const url = await generate(`${subject}, ${style}`);
      const img = await fetch(url);
      if (!img.ok) throw new Error(`download ${img.status}`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(await img.arrayBuffer()));
      console.log("✓"); made++;
    } catch (err) { console.log("✗ " + err.message); failed++; }
  }
  console.log(`\nFertig: ${made} erzeugt, ${skipped} übersprungen, ${failed} fehlgeschlagen.`);
  if (made) console.log("Bilder liegen in js/design-engine/content/img/ — committen & pushen, dann sind sie live.");
  process.exit(failed && !made ? 1 : 0);
}

main();
