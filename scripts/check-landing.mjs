/**
 * Visueller Selbst-Check für landing.html (lokal, headless).
 * - Sammelt Console-Fehler + fehlgeschlagene Requests
 * - Screenshots: Hero (nach Intro), Manifest, Kreislauf als FRAME-SERIE
 *   (gepinnte Animation), Zahlen, Finale, Footer — Desktop + Mobil
 * Run: node scripts/check-landing.mjs [url]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:8080/";
mkdirSync("screenshots", { recursive: true });

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const vp of viewports) {
  // ignoreHTTPSErrors: der Sandbox-Proxy terminiert TLS mit eigenem Zertifikat
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url()));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3200); // Loader + Hero-Intro fertig
  await page.screenshot({ path: `screenshots/home-${vp.name}-1-hero.png` });

  // Manifest mittig
  await page.locator("#manifesto").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/home-${vp.name}-2-manifesto.png` });

  // Kreislauf: gepinnt — Frame-Serie über die volle Scroll-Strecke
  const pinTop = await page.evaluate(() => {
    const el = document.getElementById("loop-pin");
    return el.getBoundingClientRect().top + window.scrollY;
  });
  const span = await page.evaluate(() => window.innerHeight * 2.8);
  for (let i = 0; i <= 5; i++) {
    await page.evaluate(([y]) => window.scrollTo(0, y), [pinTop + (span * i) / 5]);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `screenshots/home-${vp.name}-3-loop-${i}.png` });
  }

  await page.locator("#facts").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1700);
  await page.screenshot({ path: `screenshots/home-${vp.name}-4-stats.png` });

  await page.locator(".lp-finale").scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `screenshots/home-${vp.name}-5-finale.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `screenshots/home-${vp.name}-6-footer.png` });

  console.log(`[${vp.name}] errors: ${errors.length ? "\n  " + errors.join("\n  ") : "none"}`);
  await page.close();
}
await browser.close();
