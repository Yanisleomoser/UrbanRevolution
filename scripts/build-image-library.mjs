#!/usr/bin/env node
/**
 * Urban Revolution — Design Engine · offline image-library builder (Brief §5)
 *
 * Generates the whole curated image library once, offline, with a consistent
 * style/grade, via Replicate FLUX 1.1 Pro — Hero (preview), Mood and Material
 * images — from js/design-engine/content/img-library.json. Datengetrieben:
 * edit looks/prompts/categories in the JSON, re-run. Filenames match §3.1/§3.2
 * so render-preview.js + the selection nodes find them.
 *
 * Usage (zwei Wege):
 *   A) Token bleibt in Vercel (empfohlen) — via die key-gated /api/gen-image-Route:
 *      node scripts/build-image-library.mjs --endpoint=https://revolveurban.com/api/gen-image --key=<IMAGE_GEN_KEY>
 *   B) Lokaler Token:
 *      REPLICATE_API_TOKEN=r8_xxx node scripts/build-image-library.mjs
 *   Flags:
 *     --dry            print composed prompts + target paths, no API call
 *     --force          regenerate images that already exist
 *     --only=hero|mood|material   restrict to one group
 *
 * Cost: ~$0.04 per image. The journey works without these (on-brand fallback);
 * this swaps in the real, cohesive library.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "js/design-engine/content");
const CONFIG = path.join(CONTENT, "img-library.json");
const MODEL = "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions";
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes("--dry");
const FORCE = ARGS.includes("--force");
const ONLY = (ARGS.find((a) => a.startsWith("--only=")) || "").split("=")[1] || null;
// Restrict to jobs whose output path contains this substring (e.g. one motif).
const MATCH = (ARGS.find((a) => a.startsWith("--match=")) || "").split("=")[1] || null;
// Pause zwischen Jobs in ms (Default 2500; bei reduziertem Replicate-Limit —
// 6/min unter $5 Guthaben — z. B. --throttle=11000 setzen).
const THROTTLE = parseInt((ARGS.find((a) => a.startsWith("--throttle=")) || "").split("=")[1], 10) || 2500;
const TOKEN = process.env.REPLICATE_API_TOKEN;
// Optional: generate via the deployed key-gated /api/gen-image route, so the
// Replicate token never leaves Vercel (no local token needed).
const ENDPOINT = (ARGS.find((a) => a.startsWith("--endpoint=")) || "").split("=")[1] || null;
const GATE_KEY = (ARGS.find((a) => a.startsWith("--key=")) || "").split("=")[1] || process.env.IMAGE_GEN_KEY || null;
const ARCHETYPES = ["quietMinimal", "techAvant", "y2kStreet", "softCouture", "utility", "sport"];

function die(m) { console.error("✗ " + m); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Build the full job list: [{ prompt, out }]
function plan(cfg) {
  const jobs = [];
  const add = (rel, prompt) => jobs.push({ rel, out: path.join(ROOT, rel), prompt: `${prompt}, ${cfg.style}` });
  if (!ONLY || ONLY === "hero") {
    (cfg.categories || []).forEach((cat) => {
      // Prompt noun per category ("tshirt" → "t-shirt") so FLUX gets real
      // garment words; the FILENAME keeps the engine's category key.
      const noun = (cfg.category_nouns || {})[cat] || cat;
      ARCHETYPES.forEach((arch) => {
        const look = cfg.looks[arch];
        if (!look) return;
        const prompt = cfg.hero_template.replace("{category}", noun).replace("{look}", look);
        add(`js/design-engine/content/img/preview/${cat}-${arch}.jpg`, prompt);
      });
    });
  }
  if (!ONLY || ONLY === "mood") {
    Object.entries(cfg.mood || {}).forEach(([key, subject]) =>
      add(`js/design-engine/content/img/mood/${key}.jpg`, subject));
  }
  if (!ONLY || ONLY === "context") {
    Object.entries(cfg.context || {}).forEach(([key, subject]) =>
      add(`js/design-engine/content/img/context/${key}.jpg`, subject));
  }
  if (!ONLY || ONLY === "material") {
    Object.entries(cfg.materials || {}).forEach(([key, label]) =>
      add(`js/design-engine/content/img/material/${key}.jpg`, cfg.material_template.replace("{material}", label)));
  }
  return jobs;
}

// Via the deployed key-gated route — Replicate token stays in Vercel. Retries
// a couple of times on a transient "pending".
async function generateViaEndpoint(prompt) {
  let lastErr = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await sleep(2000 * attempt); // backoff: 2,4,6,8,10s
    let res, data;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspect: "4:5", key: GATE_KEY }),
      });
      data = await res.json().catch(() => ({}));
    } catch (err) { lastErr = "network " + err.message; continue; }
    if (res.ok && data.imageUrl) return data.imageUrl;
    if (res.status === 403) throw new Error("403 forbidden — IMAGE_GEN_KEY in Vercel und --key müssen übereinstimmen");
    // pending / 429 / 5xx (Replicate-Rate-Limit) → transient, weiter retrien
    lastErr = `endpoint ${res.status}: ${data.error || data.code || "no imageUrl"}`;
  }
  throw new Error(lastErr || "failed after retries");
}

async function generateViaReplicate(prompt) {
  let res;
  // 429 (Replicate-Rate-Limit, z. B. 6/min bei niedrigem Guthaben) → mit
  // Backoff weiterprobieren statt das Bild aufzugeben.
  for (let attempt = 0; ; attempt++) {
    res = await fetch(MODEL, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
      body: JSON.stringify({ input: { prompt, aspect_ratio: "4:5", output_format: "jpg", output_quality: 90, prompt_upsampling: false, safety_tolerance: 2 } }),
    });
    if (res.status !== 429 || attempt >= 5) break;
    await sleep(15000 + attempt * 5000);
  }
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let pred = await res.json();
  let tries = 0;
  while (pred.status !== "succeeded" && pred.status !== "failed" && tries++ < 30) {
    await sleep(2000);
    res = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } });
    pred = await res.json();
  }
  if (pred.status !== "succeeded") throw new Error(`generation ${pred.status}`);
  return Array.isArray(pred.output) ? pred.output[0] : pred.output;
}

const generate = (prompt) => (ENDPOINT ? generateViaEndpoint(prompt) : generateViaReplicate(prompt));

async function main() {
  if (!fs.existsSync(CONFIG)) die("Config fehlt: " + CONFIG);
  const cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const jobs = plan(cfg).filter((j) => !MATCH || j.rel.includes(MATCH));
  console.log(`→ ${jobs.length} Bilder geplant${ONLY ? " (--only=" + ONLY + ")" : ""}${MATCH ? " (--match=" + MATCH + ")" : ""}${DRY ? " [DRY]" : ""}\n`);

  if (DRY) {
    jobs.forEach((j) => console.log(`· ${j.rel}\n    ${j.prompt}\n`));
    console.log("Dry-Run — nichts generiert. Ohne --dry (mit REPLICATE_API_TOKEN) erzeugt es die Bilder.");
    return;
  }
  if (ENDPOINT) {
    if (!GATE_KEY) die("--endpoint gesetzt, aber kein --key=… (oder IMAGE_GEN_KEY). Der Gate-Key muss zu Vercels IMAGE_GEN_KEY passen.");
    console.log(`→ via Endpoint ${ENDPOINT} (Replicate-Token bleibt in Vercel)\n`);
  } else if (!TOKEN) {
    die("Kein Generierungs-Weg: entweder --endpoint=<url> --key=<key> (Token bleibt in Vercel)\noder REPLICATE_API_TOKEN=r8_… (lokal). --dry prüft ohne beides.");
  }

  let made = 0, skipped = 0, failed = 0;
  let first = true;
  for (const j of jobs) {
    if (fs.existsSync(j.out) && !FORCE) { console.log(`· skip: ${j.rel}`); skipped++; continue; }
    if (!first) await sleep(THROTTLE); // throttle, um das Replicate-Rate-Limit zu schonen
    first = false;
    process.stdout.write(`· ${j.rel} … `);
    try {
      const url = await generate(j.prompt);
      const img = await fetch(url);
      if (!img.ok) throw new Error(`download ${img.status}`);
      fs.mkdirSync(path.dirname(j.out), { recursive: true });
      fs.writeFileSync(j.out, Buffer.from(await img.arrayBuffer()));
      console.log("✓"); made++;
    } catch (err) { console.log("✗ " + err.message); failed++; }
  }
  console.log(`\nFertig: ${made} erzeugt, ${skipped} übersprungen, ${failed} fehlgeschlagen.`);
  if (made) console.log("Bilder liegen unter js/design-engine/content/img/ — committen & pushen, dann live.");
  process.exit(failed && !made ? 1 : 0);
}

main();
