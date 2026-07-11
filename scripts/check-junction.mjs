// Ad-hoc: Übergang #machine → .lp-finale nach Entfernen von #your-style
// prüfen (Desktop + Mobil): Naht sichtbar, kein #your-style im DOM, keine
// Console-Fehler. Nutzt denselben Eigen-Server wie shoot-sections.mjs.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
let failed = false;

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  page.on("pageerror", (e) => errors.push(`[${vp.name}] ${e.message}`));
  // Lokal erwartete 404s (nur-auf-Vercel-Ressourcen) nicht werten; alle
  // anderen 4xx/5xx-Responses schon.
  page.on("response", (r) => {
    if (r.status() >= 400 && !/\/_vercel\/|\/api\//.test(r.url())) {
      errors.push(`[${vp.name}] ${r.status()} ${r.url()}`);
    }
  });
  await routeCdnThroughNode(page);
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2400);

  const gone = await page.evaluate(() => !document.getElementById("your-style"));
  const seams = await page.evaluate(() => document.querySelectorAll(".fil-seam").length);
  console.log(`[${vp.name}] #your-style entfernt: ${gone} · .fil-seam count: ${seams}`);
  if (!gone || seams !== 3) failed = true;

  // Die Naht vor dem Finale mittig ins Bild holen
  await page.evaluate(() => {
    const seam = document.querySelector('.fil-seam[data-fil="3"]');
    if (seam) seam.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/junction-${vp.name}.png` });

  // Finale selbst
  await page.evaluate(() => {
    document.querySelector(".lp-finale")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/finale-${vp.name}.png` });

  // Mobil: kein horizontaler Overflow
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`[${vp.name}] horizontaler Overflow: ${overflow}px`);
  if (overflow > 1) failed = true;
  await page.close();
}

await browser.close();
server.close();
if (errors.length) {
  console.error("Console-/Page-Fehler:", errors);
  process.exit(1);
}
if (failed) {
  console.error("Struktur-Check fehlgeschlagen (siehe oben)");
  process.exit(1);
}
console.log("Junction-Check OK — Screenshots in screenshots/");
