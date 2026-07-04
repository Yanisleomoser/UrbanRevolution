/**
 * „Die Vorlage wird echt" verification: the production spec sheet must carry
 * the TECHNICAL DRAWING of the current piece — same params as the ownership
 * stage (one source), following every state change — and the PRINT medium
 * must turn the light-line stage drawing into workshop ink (dark on white,
 * no full-bleed dark panel). Fails on page errors or a vacuous run.
 *
 *   node scripts/verify-spec.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const require = createRequire(import.meta.url);
global.DesignDNA = require("../js/design-engine/dna.js");
const Share = require("../js/design-engine/share.js");

const OUT = "screenshots/verify-spec";
mkdirSync(OUT, { recursive: true });

// A converged jacket DNA (duo gradient — the drawing must carry BOTH stops).
const D = global.DesignDNA;
const dna = D.create();
D.set(dna, "category", "jacket", 1);
D.set(dna, "subArchetype", "bomber", 1);
D.set(dna, "silhouette.fit", 0.6, 1);
D.set(dna, "length", "cropped", 1);
D.set(dna, "fabric.material", "denim", 1);
D.set(dna, "color.scheme", "duo-gradient", 1);
D.set(dna, "color.stops", ["#7a2f3f", "#2f4a6b"], 1);
D.set(dna, "construction.closure", "zip", 1);
D.set(dna, "intent.energy", 0.6, 1);
dna.archetypeWeights.utility = 1.1;
const SHARE = "#dna=" + Share.encode(dna);

const STUB = `window.AI = window.AI || {};
window.AI.generateDesign = () => new Promise((res) => setTimeout(() => res({
  name: "Vorlage Probe", description: "test", color: "#7a2f3f", material: "denim",
  fit: "regular", tags: ["test"], constructionNotes: ["Doppelnaht am Saum"] }), 400));`;

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/" + SHARE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-generate", { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.evaluate(STUB);
  // Masse setzen (Preset M) — das Spec-Sheet rendert erst mit Massen.
  await page.evaluate(() => {
    window.StateManager.set("measurements", { height: 175, weight: 70, chest: 96, waist: 82, hips: 98, shoulder: 44, arm: 62, inseam: 82, neck: 38 });
  });
  await page.click("#de-generate");
  await page.waitForTimeout(3500); // Handoff-Bogen (Nähen → Schild → Ownership/Spec)

  const spec = await page.evaluate(() => {
    const d = document.getElementById("spec-drawing");
    const svg = d && d.querySelector("svg");
    return {
      hasSvg: !!svg,
      html: d ? d.innerHTML.toLowerCase() : "",
      stageSvg: (document.querySelector("#vto-example .own-flat svg") || {}).outerHTML || "",
    };
  });
  check(spec.hasSvg, "the spec sheet carries the technical drawing");
  check(spec.html.includes("#7a2f3f") && spec.html.includes("#2f4a6b"),
    "…of THIS piece (both duo-gradient stops reach the drawing)");
  // One source: the drawing's geometry equals the ownership stage's geometry.
  const geo = await page.evaluate(() => {
    const g = (sel) => { const p = document.querySelector(sel + " .gs-outline"); return p ? p.getAttribute("d") : null; };
    return { spec: g("#spec-drawing"), own: g("#vto-example .own-flat") };
  });
  check(!!geo.spec && geo.spec === geo.own, "spec drawing and ownership stage show the SAME piece (identical outline geometry)");

  // Live follow: a facade re-dye reaches the spec drawing too.
  await page.$eval(".own-edit", (n) => { n.open = true; });
  const hex = await page.$eval("#oe-colors .oe-color:nth-child(4)", (n) => n.dataset.color.toLowerCase());
  await page.click("#oe-colors .oe-color:nth-child(4)");
  await page.waitForTimeout(400);
  const redye = await page.$eval("#spec-drawing", (n) => n.innerHTML.toLowerCase());
  check(redye.includes(hex), `a facade re-dye reaches the spec drawing (${hex})`);

  await page.$eval("#production", (n) => n.scrollIntoView());
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/spec-screen.png` });

  // PRINT medium: only the sheet is visible and the drawing inverts to ink.
  await page.emulateMedia({ media: "print" });
  const print = await page.evaluate(() => {
    const svg = document.querySelector("#spec-drawing svg");
    const box = document.querySelector(".spec-drawing");
    return {
      filter: svg ? getComputedStyle(svg).filter : "",
      bg: box ? getComputedStyle(box).backgroundImage + getComputedStyle(box).backgroundColor : "",
      heroVisible: getComputedStyle(document.querySelector(".lp-hero") || document.body).visibility,
      sheetVisible: getComputedStyle(document.querySelector(".spec-sheet")).visibility,
    };
  });
  check(/invert/.test(print.filter), `print turns the drawing into workshop ink (filter: ${print.filter.slice(0, 40)}…)`);
  check(/255,\s*255,\s*255|rgb\(255, 255, 255\)|none/.test(print.bg), "…on a white panel (no full-bleed dark print)");
  check(print.sheetVisible === "visible" && print.heroVisible === "hidden", "print shows the sheet, hides the rest (existing contract intact)");
  // Tinten-Palette: echte Drucker lassen Hintergründe weg — das Sheet muss im
  // Print-Medium dunkle Schrift führen (vorbestehender Fund dieser Runde).
  const ink = await page.evaluate(() => ({
    sheetBg: getComputedStyle(document.querySelector(".spec-sheet")).backgroundColor,
    tdColor: getComputedStyle(document.querySelector("#spec-table td")).color,
    h4Color: getComputedStyle(document.querySelector(".spec-section h4")).color,
  }));
  check(ink.sheetBg === "rgb(255, 255, 255)", `print sheet is paper-white (${ink.sheetBg})`);
  check(ink.tdColor === "rgb(17, 17, 17)" && ink.h4Color === "rgb(17, 17, 17)",
    `print text is ink-dark, not screen-light (${ink.tdColor})`);
  // Fürs Auge dient das ARTEFAKT selbst (unten): die On-Page-Print-Ansicht
  // ist per Computed-Styles hart belegt; ihr Screenshot scheitert an
  // Playwright-Actionability/Scroll-Eigenheiten unter emulateMedia und
  // liefert kein ehrliches Bild.
  await page.emulateMedia({ media: "screen" });

  // The downloadable HTML template embeds the same drawing.
  const doc = await page.evaluate(() => {
    const spec = window.Export.buildSpecData(window.StateManager.get("currentDesign"), window.StateManager.get("measurements"), window.StateManager.get("currentType"));
    const drawing = document.getElementById("spec-drawing").innerHTML;
    return window.Export.renderPrintableHTML(spec, drawing);
  });
  check(doc.includes("<svg") && doc.toLowerCase().includes(hex), "the downloadable HTML template embeds the live drawing");
  check(errors.length === 0, `no page errors (${errors.join(" | ") || "clean"})`);

  // Das heruntergeladene Artefakt selbst rendern — Screen (Zeichnung auf
  // dunkler Karte) und Print (Werkstatt-Tinte) als Beweisbilder.
  const artefact = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await artefact.setContent(doc, { waitUntil: "load" });
  await artefact.screenshot({ path: `${OUT}/template-screen.png` });
  await artefact.emulateMedia({ media: "print" });
  const tpl = await artefact.evaluate(() => ({
    filter: getComputedStyle(document.querySelector(".drawing svg")).filter,
    bg: getComputedStyle(document.querySelector(".drawing")).backgroundColor,
  }));
  check(/invert/.test(tpl.filter) && tpl.bg === "rgb(255, 255, 255)",
    "the downloaded template prints the drawing as ink on white too");
  await artefact.screenshot({ path: `${OUT}/template-print.png` });
  await artefact.close();
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ spec drawing verified");
process.exit(failed ? 1 : 0);
