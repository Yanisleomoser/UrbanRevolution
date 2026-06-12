/**
 * Opens the UR-Create studio (CTA click) and screenshots the design journey
 * at desktop + mobile widths. Usage: node scripts/audit-studio.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

mkdirSync("screenshots", { recursive: true });
const url = process.argv[2] || "http://localhost:8080/";

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
      ignoreHTTPSErrors: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.click('.lp-hero-ctas a[href="#design"]');
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `screenshots/studio-${vp.name}-0-open.png` });
    console.log("wrote studio-" + vp.name + "-0-open.png");

    // Walk a few steps of the engine journey by clicking the first option.
    for (let step = 1; step <= 4; step++) {
      const clicked = await page.evaluate(() => {
        const host = document.getElementById("engine-host");
        if (!host) return "no-host";
        const btn = host.querySelector(
          "button:not([disabled]), [role='button'], .de-card, .de-visual-option"
        );
        if (!btn) return "no-option";
        btn.click();
        return (btn.className || btn.tagName).toString().slice(0, 60);
      });
      await page.waitForTimeout(1300);
      await page.screenshot({
        path: `screenshots/studio-${vp.name}-${step}.png`,
      });
      console.log(`step ${step}: clicked`, clicked);
    }
    if (errors.length) console.log("errors:", errors.join(" | "));
    await page.close();
  }
} finally {
  await browser.close();
}
