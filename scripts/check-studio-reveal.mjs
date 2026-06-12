/**
 * Studio-Reveal-Check: das UR-Create-Studio (#studio) ist anfangs verborgen,
 * öffnet sich nach Klick auf einen CTA (Anker #design) und die Design-Engine
 * rendert sichtbar. Community-Sektion bleibt am Seitenende erreichbar.
 * Run: node scripts/check-studio-reveal.mjs
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
  await page.waitForTimeout(3000);

  const before = await page.evaluate(() => document.getElementById("studio").hidden);
  await page.click('.lp-hero-ctas a[href="#design"]');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({
    hidden: document.getElementById("studio").hidden,
    designInView: (() => {
      const r = document.getElementById("design").getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    })(),
    engineHasContent: (document.getElementById("engine-host") || {}).childElementCount > 0,
    engineHeight: Math.round(document.getElementById("engine-host").getBoundingClientRect().height),
  }));
  console.log(`[${vp.name}] studio hidden vorher=${before} nachher=${after.hidden} | #design im Viewport=${after.designInView} | Engine gerendert=${after.engineHasContent} (h=${after.engineHeight}px)`);
  await page.screenshot({ path: `screenshots/home-${vp.name}-studio.png` });

  // Community am Ende erreichbar?
  await page.locator("#community").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `screenshots/home-${vp.name}-community.png` });

  console.log(`[${vp.name}] errors: ${errors.length ? "\n  " + errors.join("\n  ") : "none"}`);
  await page.close();
}
await browser.close();
