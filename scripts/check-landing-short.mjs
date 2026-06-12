/**
 * Höhen-Check für die gepinnte Kreislauf-Sektion: passt der aktive
 * Stationstext bei kurzen Viewports in den Fold?
 * Run: node scripts/check-landing-short.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

mkdirSync("screenshots", { recursive: true });
const url = "http://localhost:8080/";
const viewports = [
  { name: "iphone", width: 390, height: 844 },
  { name: "iphone-toolbar", width: 390, height: 660 },
  { name: "se", width: 320, height: 568 },
  { name: "landscape", width: 740, height: 360 },
  { name: "webview", width: 520, height: 420 },
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  const pinTop = await page.evaluate(() =>
    document.getElementById("loop-pin").getBoundingClientRect().top + window.scrollY
  );
  // Mitte der gepinnten Strecke (Station 02/03)
  await page.evaluate(([y]) => window.scrollTo(0, y), [pinTop + vp.height * 1.4]);
  await page.waitForTimeout(700);
  const check = await page.evaluate(() => {
    const active = document.querySelector(".lp-loop-step.is-active");
    const r = active.getBoundingClientRect();
    return {
      textTop: Math.round(r.top),
      textBottom: Math.round(r.bottom),
      vh: window.innerHeight,
      fits: r.top >= 0 && r.bottom <= window.innerHeight,
    };
  });
  console.log(`[${vp.name} ${vp.width}x${vp.height}]`, JSON.stringify(check));
  await page.screenshot({ path: `screenshots/home-short-${vp.name}.png` });
  await page.close();
}
await browser.close();
