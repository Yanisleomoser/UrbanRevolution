/**
 * Session audit: scrolls through the whole page at desktop + mobile widths,
 * screenshots every viewport-step, and logs console errors + failed requests.
 * Usage: node scripts/audit.mjs [url] [prefix]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:8080/";
const prefix = process.argv[3] || "audit";
mkdirSync("screenshots", { recursive: true });

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.name === "mobile" ? 2 : 1,
      ignoreHTTPSErrors: true, // sandbox proxy re-signs TLS for CDN hosts
    });
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
    page.on("requestfailed", (r) => {
      const u = r.url();
      if (!/sentry|vercel|insights/.test(u)) errors.push("REQFAIL " + u);
    });
    page.on("response", (r) => {
      if (r.status() >= 400 && !/sentry|vercel|insights|api\//.test(r.url())) {
        errors.push(`HTTP ${r.status()} ${r.url()}`);
      }
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2600);

    const total = await page.evaluate(() => document.body.scrollHeight);
    const step = vp.height;
    let i = 0;
    for (let y = 0; y < total; y += step) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(700);
      const file = `screenshots/${prefix}-${vp.name}-${String(i).padStart(2, "0")}.png`;
      await page.screenshot({ path: file });
      console.log("wrote", file);
      i++;
      if (i > 24) break;
    }
    console.log(`--- ${vp.name} console/network issues: ${errors.length}`);
    for (const e of errors.slice(0, 20)) console.log("  ", e.slice(0, 200));
    await page.close();
  }
} finally {
  await browser.close();
}
