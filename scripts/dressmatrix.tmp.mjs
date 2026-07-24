/** THROWAWAY diagnosis probe — dress flat geometry matrix. Delete after use. */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const OUT = "screenshots/dressmatrix";
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "de-DE" });
await routeCdnThroughNode(page);
await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => !!window.GarmentSVG, null, { timeout: 20000 });

const result = await page.evaluate(() => {
  const G = window.GarmentSVG;
  const waists = ["fitted", "natural", "relaxed"];
  const fits = [0.2, 0.5, 0.8, 1.0];
  const lengths = ["cropped", "regular", "long"];
  const sleeves = ["sleeveless", "cap", "short", "long"];
  const collars = ["vneck", "crew", "stand"];
  const rows = [];
  for (const waist of waists)
    for (const fit of fits)
      for (const length of lengths)
        for (const sleeveLength of sleeves)
          for (const collar of collars) {
            const p = { category: "dress", fit, structure: 0.5, length, collar, sleeveLength, waist, reveal: 1 };
            const m = G.model("dress", p);
            const g = m.g;
            rows.push({
              key: [waist, fit, length, sleeveLength, collar].join("|"),
              waist, fit, length, sleeveLength, collar,
              shoulderHalf: +g.shoulderHalf.toFixed(1),
              chestHalf: +g.chestHalf.toFixed(1),
              waistHalf: +g.waistHalf.toFixed(1),
              hemHalf: +g.hemHalf.toFixed(1),
              coX: +g.coX.toFixed(1), ciX: +g.ciX.toFixed(1),
              shoulderY: g.shoulderY, armpitY: g.armpitY, waistY: g.waistY,
              wristY: +(+g.wristY).toFixed(1), hemY: g.hemY,
              sleeveless: g.sleeveless,
              // diagnostics
              wristBelowWaist: g.wristY > g.waistY,
              wristBelowHem: g.wristY > g.hemY,
              cuffOutsideHem: g.coX > g.hemHalf,
              hemNarrowerThanShoulder: g.hemHalf < g.shoulderHalf,
            });
          }
  return rows;
});
writeFileSync("screenshots/dressmatrix/matrix.json", JSON.stringify(result, null, 1));

// Grouped summary
const bad = result.filter((r) => r.wristBelowWaist && !r.sleeveless);
console.log("total", result.length, "wristBelowWaist(non-sleeveless)", bad.length);
const byS = {};
for (const r of result) {
  const k = r.sleeveLength;
  byS[k] = byS[k] || { wristY: new Set(), belowWaist: 0, belowHem: 0, n: 0 };
  byS[k].wristY.add(r.wristY);
  byS[k].n++;
  if (r.wristBelowWaist) byS[k].belowWaist++;
  if (r.wristBelowHem) byS[k].belowHem++;
}
for (const [k, v] of Object.entries(byS)) console.log(k, "wristY", [...v.wristY].join(","), "belowWaist", v.belowWaist + "/" + v.n, "belowHem", v.belowHem + "/" + v.n);

// Render a contact sheet of the interesting subset: sleeveLength x waist x fit for length=regular, collar=stand
const sheet = await page.evaluate(() => {
  const G = window.GarmentSVG;
  const cells = [];
  for (const sleeveLength of ["sleeveless", "cap", "short", "long"])
    for (const waist of ["fitted", "natural", "relaxed"])
      for (const fit of [0.2, 0.5, 0.8, 1.0]) {
        const p = { category: "dress", fit, structure: 0.5, length: "regular", collar: "stand", sleeveLength, waist, reveal: 1, color: "#8a8a90" };
        cells.push({ label: `${sleeveLength} · ${waist} · fit ${fit}`, svg: G.build("dress", p) });
      }
  const host = document.createElement("div");
  host.id = "probe-sheet";
  host.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0B0B0D;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:10px;overflow:auto";
  host.innerHTML = cells.map((c) => `<figure style="margin:0;background:#111119;border:1px solid #333"><div style="aspect-ratio:240/340">${c.svg}</div><figcaption style="color:#9aa;font:10px monospace;text-align:center;padding:2px">${c.label}</figcaption></figure>`).join("");
  document.body.appendChild(host);
  host.querySelectorAll("svg").forEach((s) => { s.style.width = "100%"; s.style.height = "100%"; s.style.display = "block"; });
  return cells.length;
});
console.log("sheet cells", sheet);
await page.setViewportSize({ width: 1500, height: 2400 });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "/sheet.png", fullPage: true });

await browser.close();
server.close();
