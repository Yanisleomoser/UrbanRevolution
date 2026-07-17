/**
 * scripts/render-blob.mjs — rastert die zwei Thermal-Blob-Varianten aus
 * scripts/blob-comp.html zu assets/tblob-cool.webp + assets/tblob-thermal.webp
 * (WebP MIT Alpha, 1600px Kante).
 *
 * WARUM: Die Blobs liefen zunächst als Live-Inline-SVG-Instanzen mit
 * feGaussianBlur+feTurbulence-Filter — fünf große Filter-Raster pro Seite
 * machten das Scrollen auf Mobile spürbar unflüssig. Einmal im Build
 * gerastert kompositiert die Site nur noch fertige Bitmaps (ein Layer,
 * kein Filter-Repaint). Weiche Verlaufs-Inhalte skalieren als Bitmap
 * verlustfrei genug; Korn ist eingebacken.
 *
 * Lauf: node scripts/render-blob.mjs   (nach jeder Änderung an blob-comp.html;
 * Budget-Gate: scripts/check-asset-budget.mjs, Cap 350 KB/Bild.)
 */
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMP = pathToFileURL(resolve(__dirname, "blob-comp.html")).href;
const OUT = resolve(__dirname, "..", "assets");
const QUALITY = 0.58;

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1750 } });
await page.goto(COMP, { waitUntil: "networkidle" });
await page.waitForTimeout(600); // Filter-Raster abwarten

for (const id of ["cool", "thermal"]) {
  // SVG → Canvas → WebP mit Alpha (Chromiums Canvas-Encoder; Playwright-
  // Screenshots könnten nur PNG/JPEG — PNG wäre mit Korn ~2 MB, JPEG hat
  // kein Alpha).
  const dataUrl = await page.evaluate(async ({ id, q }) => {
    // Eigenständiges SVG bauen: Defs aus dem Haupt-SVG MITSCHICKEN — ein
    // serialisiertes <use> ohne seine Defs rendert sonst leer.
    const defs = new XMLSerializer().serializeToString(document.querySelector("#cool defs"));
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1667" viewBox="0 0 1200 1250">${defs}<use href="#tblob-${id}-g"/></svg>`;
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement("canvas");
    c.width = 1440; c.height = 1500;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 1440, 1500);
    URL.revokeObjectURL(url);
    // Filmkorn im Canvas einbacken — feTurbulence rendert im SVG-als-Bild-
    // Kontext nicht (Chromium), also additives Zufallskorn nur dort, wo die
    // Masse deckt (Alpha-gewichtet, ±STR wie der Slide-Look).
    const STR = 13;
    const im = ctx.getImageData(0, 0, 1440, 1500);
    const d = im.data;
    let s = 1234567;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (!a) continue;
      const n = (rnd() - 0.5) * 2 * STR * (a / 255);
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(im, 0, 0);
    return c.toDataURL("image/webp", q);
  }, { id, q: QUALITY });
  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  writeFileSync(`${OUT}/tblob-${id}.webp`, buf);
  console.log(`assets/tblob-${id}.webp  ${(buf.length / 1024).toFixed(1)} KB`);
}
await browser.close();
