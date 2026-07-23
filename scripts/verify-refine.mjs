/**
 * Slice-9 verification (§8 refine crescendo): drop straight into Phase F via a
 * #dna= share link and judge the ARRIVAL as motion — the mono sentence must
 * visibly type on (curve, not snap), the option sections must enter a breath
 * AFTER it, the duplicate bottom sentence must be gone, every concept tile
 * must carry a delta-derived name, and exactly ONE evolve control may exist
 * (on the selected tile). Reduced-motion gets everything instantly. Fails on
 * page errors or a vacuous run.
 *
 *   node scripts/verify-refine.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const require = createRequire(import.meta.url);
global.DesignDNA = require("../js/design-engine/dna.js");
const Share = require("../js/design-engine/share.js");

const OUT = "screenshots/verify-refine";
mkdirSync(OUT, { recursive: true });

// A converged jacket with an EXPLICIT "no pattern" (the §8.2 respect case).
const D = global.DesignDNA;
const dna = D.create();
D.set(dna, "category", "jacket", 1);
D.set(dna, "subArchetype", "bomber", 1);
D.set(dna, "silhouette.fit", 0.62, 1);
D.set(dna, "length", "cropped", 1);
D.set(dna, "fabric.material", "polyester", 1);
D.set(dna, "fabric.finishWeight", 0.35, 1);
D.set(dna, "color.scheme", "duo-gradient", 1);
D.set(dna, "color.stops", ["#7a2f3f", "#2f4a6b"], 1);
D.set(dna, "pattern.type", "none", 1);
D.set(dna, "intent.energy", 0.62, 1);
dna.archetypeWeights.y2kStreet = 1.2;
const SHARE = "#dna=" + Share.encode(dna);

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

// ── 1) Full-motion arrival: type-on curve + delayed section entry ──────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Sampler starts at document start so the very first refine frames are seen.
  await page.addInitScript(() => {
    window.__refine = [];
    const t0 = performance.now();
    const tick = () => {
      const sum = document.getElementById("de-refine-summary");
      const con = document.querySelector(".de-concepts");
      const live = document.getElementById("de-live");
      window.__refine.push({
        t: Math.round(performance.now() - t0),
        len: sum ? sum.textContent.length : null,
        typing: sum ? sum.classList.contains("is-typing") : null,
        conOp: con ? Number(getComputedStyle(con).opacity).toFixed(2) : null,
        live: live ? live.textContent : null,
      });
      if (performance.now() - t0 < 15000) setTimeout(tick, 100);
    };
    tick();
  });
  await page.goto(base + "/" + SHARE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-concept-grid .de-concept", { timeout: 20000 });
  await page.waitForTimeout(4200);
  const samples = (await page.evaluate(() => window.__refine)).filter((s) => s.len !== null);
  check(samples.length >= 8, `sampler saw the refine arrival (${samples.length} samples)`);
  const lens = samples.map((s) => s.len);
  const finalLen = lens[lens.length - 1];
  const growth = lens.filter((v, i) => i && v > lens[i - 1]).length;
  check(finalLen > 40, `summary sentence is substantial (${finalLen} chars)`);
  check(growth >= 3, `sentence TYPES on — length grew across ${growth} sampled steps (curve, not snap)`);
  const tSentenceStart = samples.find((s) => s.len > 0);
  const tConceptsIn = samples.find((s) => s.conOp !== null && Number(s.conOp) > 0.9);
  const conceptsHeldBack = samples.some((s) => s.conOp !== null && Number(s.conOp) < 0.1);
  check(conceptsHeldBack, "option sections start held back (opacity ~0 while the sentence speaks)");
  check(!!tSentenceStart && !!tConceptsIn && tConceptsIn.t > tSentenceStart.t,
    `options enter AFTER the sentence begins (${tSentenceStart && tSentenceStart.t}ms → ${tConceptsIn && tConceptsIn.t}ms)`);
  const lastLive = samples[samples.length - 1].live;
  check(lastLive === "", "duplicate bottom sentence is gone (#de-live empty at refine)");

  const tiles = await page.$$eval("#de-concept-grid .de-concept", (els) => els.map((el) => ({
    name: (el.querySelector(".de-concept-name") || {}).textContent || "",
    selected: el.classList.contains("is-selected"),
    hasEvolve: !!el.querySelector(".de-concept-evolve"),
    pressed: (el.querySelector(".de-concept-pick") || {}).getAttribute ? el.querySelector(".de-concept-pick").getAttribute("aria-pressed") : null,
  })));
  check(tiles.length === 4, "four concept directions render");
  check(tiles.every((t) => t.name.trim().length > 0), "every tile carries a name");
  // U6: früher hiessen zwei von vier Richtungen identisch — jetzt Pflicht auf
  // volle Eindeutigkeit (conceptLabelSets zieht bei Kollision die dritte Achse).
  check(new Set(tiles.map((t) => t.name)).size === 4, `all four direction names are unique (${tiles.map((t) => t.name).join(" | ")})`);
  // U6: der Satz TIPPT wall-clock-basiert und muss vollständig enden — ein
  // abgeschnittener Satz („…Verlauf von Bu") war der sichtbarste Defekt des
  // Crescendos in Headless-Frames.
  const finalText = await page.$eval("#de-refine-summary", (el) => el.textContent);
  check(/\.\s*$/.test(finalText), `typed sentence completes with a full stop ("…${finalText.slice(-24)}")`);
  // U6: der Refine-Held ist das ECHTE Flat (SVG), kein kuratiertes Preset-Foto.
  const hero = await page.evaluate(() => {
    const stage = document.querySelector(".de-preview-stage") || document.querySelector("#de-preview");
    const img = stage && stage.querySelector("img");
    return { hasSvg: !!(stage && stage.querySelector("svg")), photoVisible: !!(img && img.offsetParent && getComputedStyle(img).opacity !== "0") };
  });
  check(hero.hasSvg && !hero.photoVisible, "refine hero is the user's SVG flat — no preset photo layer visible");
  check(tiles.filter((t) => t.hasEvolve).length === 1 && tiles.find((t) => t.selected).hasEvolve,
    "exactly ONE evolve control, and it sits on the selected tile");
  check(tiles.find((t) => t.selected).pressed === "true", "selected tile announces aria-pressed=true");

  // Selecting another tile moves the single evolve control with the selection.
  await page.click('#de-concept-grid .de-concept[data-i="2"] .de-concept-pick');
  await page.waitForTimeout(400);
  const after = await page.$$eval("#de-concept-grid .de-concept", (els) => els.map((el) => ({
    selected: el.classList.contains("is-selected"), hasEvolve: !!el.querySelector(".de-concept-evolve"),
  })));
  check(after[2].selected && after[2].hasEvolve && after.filter((t) => t.hasEvolve).length === 1,
    "picking a direction moves the ONE evolve control onto it");

  await page.screenshot({ path: `${OUT}/desktop-refine.png`, fullPage: false });
  const host = await page.$("#engine-host");
  if (host) await host.screenshot({ path: `${OUT}/desktop-refine-host.png` }).catch(() => {});
  check(errors.length === 0, `no page errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

// ── 2) Reduced motion: everything instant, full text, no held-back sections ─
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/" + SHARE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-concept-grid .de-concept", { timeout: 20000 });
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => ({
    len: document.getElementById("de-refine-summary").textContent.length,
    typing: document.getElementById("de-refine-summary").classList.contains("is-typing"),
    conOp: Number(getComputedStyle(document.querySelector(".de-concepts")).opacity),
  }));
  check(state.len > 40 && !state.typing, "reduced-motion: full sentence immediately, no caret");
  check(state.conOp > 0.9, "reduced-motion: option sections visible immediately");
  await page.$("#engine-host").then((h) => h && h.screenshot({ path: `${OUT}/mobile-refine-reduced.png` })).catch(() => {});
  check(errors.length === 0, `no page errors on the reduced path (${errors.join(" | ") || "clean"})`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ refine crescendo verified");
process.exit(failed ? 1 : 0);
