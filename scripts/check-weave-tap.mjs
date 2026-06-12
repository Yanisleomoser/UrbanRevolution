/**
 * Tap-Morph-Check: Klick/Tap im Hero lässt die Punkte die Silhouette des
 * nächsten Kleidungsstücks formen (T-Shirt → Hoodie → Hose → …).
 * Frame-Serie pro Formation + Console-Fehler. Desktop + Mobil.
 * Run: node scripts/check-weave-tap.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

mkdirSync("screenshots", { recursive: true });
const url = "http://localhost:8080/";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const vp of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3200);

  // Drei Garments durchtippen, je eine kurze Frame-Serie der Formation
  for (let g = 0; g < 3; g++) {
    await page.mouse.click(vp.width * 0.55, vp.height * 0.45);
    for (const [fi, wait] of [[0, 300], [1, 500], [2, 900]].values()) {
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `screenshots/tap-${vp.name}-g${g}-f${fi}.png` });
    }
    // Auflösung abwarten (FORM_HOLD 4200ms + Puffer)
    await page.waitForTimeout(3200);
  }
  await page.screenshot({ path: `screenshots/tap-${vp.name}-released.png` });
  console.log(`[${vp.name}] errors: ${errors.length ? "\n  " + errors.join("\n  ") : "none"}`);
  await page.close();
}
await browser.close();
