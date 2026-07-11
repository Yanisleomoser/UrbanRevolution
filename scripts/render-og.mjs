/**
 * Rendert scripts/og-comp.html → assets/og-image.png (1200×630).
 *
 * Reproduzierbar: eigener Static-Server (Repo-Root, wegen /assets/fonts/…),
 * headless Chromium aus dem Playwright-Download (PLAYWRIGHT_BROWSERS_PATH),
 * Element-Screenshot auf #card nach document.fonts.ready.
 *
 *   node scripts/render-og.mjs            # schreibt assets/og-image.png
 *   OUT=/tmp/og.png node scripts/render-og.mjs
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";

const OUT = process.env.OUT || "assets/og-image.png";

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1360, height: 760 },
    // dSF 1: die PNG-Pixel SIND die 1200×630 des og:image-Standards.
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => { throw new Error("og-comp page error: " + e); });
  await page.goto(`${base}/scripts/og-comp.html`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.locator("#card").screenshot({ path: OUT });
  console.log("wrote", OUT);
} finally {
  await browser.close();
  server.close();
}
