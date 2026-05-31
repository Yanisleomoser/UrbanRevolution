/**
 * Headless screenshot helper for local visual checks.
 *
 * Boots nothing itself — expects a static server already running (default
 * http://localhost:8080). Captures the given path at desktop + mobile widths
 * into screenshots/. Usage:
 *   node scripts/shoot.mjs [url] [outPrefix]
 *   node scripts/shoot.mjs http://localhost:8080/ hero
 *
 * Browser comes from the playwright chromium download (PLAYWRIGHT_BROWSERS_PATH).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:8080/";
const prefix = process.argv[3] || "shot";
const outDir = "screenshots";
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    // domcontentloaded (not networkidle): the live site keeps analytics /
    // speed-insights sockets open, so "networkidle" never settles and the
    // shot times out. We just need the DOM + a beat for the hero animation.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Let the hero typewriter type a bit so the shot captures it mid-animation.
    await page.waitForTimeout(2200);
    const file = `${outDir}/${prefix}-${vp.name}.png`;
    await page.screenshot({ path: file });
    console.log("wrote", file);
    await page.close();
  }
} finally {
  await browser.close();
}
