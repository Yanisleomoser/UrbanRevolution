/** THROWAWAY diagnosis probe — dress contact sheets. Delete after use. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const OUT = "screenshots/dressmatrix";
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, locale: "de-DE" });
await routeCdnThroughNode(page);
await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => !!window.GarmentSVG, null, { timeout: 20000 });

async function sheet(name, cells, cols) {
  await page.evaluate(({ cells, cols }) => {
    document.querySelectorAll("#probe-sheet").forEach((n) => n.remove());
    const G = window.GarmentSVG;
    const host = document.createElement("div");
    host.id = "probe-sheet";
    host.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:#0B0B0D;display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:10px;overflow:hidden`;
    host.innerHTML = cells.map((c) => `<figure style="margin:0;background:#111119;border:1px solid #333"><div class="cell" style="aspect-ratio:240/340">${G.build("dress", c.p)}</div><figcaption style="color:#9fa8c8;font:11px monospace;text-align:center;padding:2px">${c.label}</figcaption></figure>`).join("");
    document.body.appendChild(host);
    host.querySelectorAll("svg").forEach((s) => { s.style.width = "100%"; s.style.height = "100%"; s.style.display = "block"; });
  }, { cells, cols });
  await page.waitForTimeout(250);
  const el = await page.$("#probe-sheet");
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log("wrote", name);
}

const base_p = (o) => Object.assign({ category: "dress", fit: 0.78, structure: 0.5, length: "regular", collar: "vneck", sleeveLength: "short", waist: "natural", reveal: 1 }, o);

// A) sleeveLength x length (the suspected killer), collar stand, waist relaxed, fit .78
let cells = [];
for (const sleeveLength of ["sleeveless", "cap", "short", "long"])
  for (const length of ["cropped", "regular", "long"])
    cells.push({ label: `sl:${sleeveLength} len:${length}`, p: base_p({ sleeveLength, length, collar: "stand", waist: "relaxed" }) });
await sheet("A-sleeve-x-length", cells, 6);

// B) long sleeve x fit x waist, length cropped
cells = [];
for (const waist of ["fitted", "natural", "relaxed"])
  for (const fit of [0.2, 0.5, 0.78, 1.0])
    cells.push({ label: `LONG/cropped w:${waist} f:${fit}`, p: base_p({ sleeveLength: "long", length: "cropped", waist, fit, collar: "stand" }) });
await sheet("B-long-cropped", cells, 4);

// C) long sleeve x fit x waist, length regular
cells = [];
for (const waist of ["fitted", "natural", "relaxed"])
  for (const fit of [0.2, 0.5, 0.78, 1.0])
    cells.push({ label: `LONG/regular w:${waist} f:${fit}`, p: base_p({ sleeveLength: "long", length: "regular", waist, fit, collar: "stand" }) });
await sheet("C-long-regular", cells, 4);

// D) collar variants on the failing combo + control (short sleeve)
cells = [];
for (const collar of ["vneck", "crew", "stand"])
  for (const sleeveLength of ["short", "long"])
    cells.push({ label: `${collar}/${sleeveLength}/cropped`, p: base_p({ collar, sleeveLength, length: "cropped", waist: "relaxed" }) });
await sheet("D-collar", cells, 6);

await browser.close();
server.close();
