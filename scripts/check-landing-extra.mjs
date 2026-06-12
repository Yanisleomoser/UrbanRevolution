/**
 * Zusatz-Checks für landing.html:
 *  - Loader-Logo-Draw als Frame-Serie (echte Bewegung prüfen)
 *  - EN-Sprachumschaltung
 *  - prefers-reduced-motion (alles sofort sichtbar, kein Loader)
 *  - GSAP-CDN blockiert → Fallback ohne fx (alles sichtbar)
 * Run: node scripts/check-landing-extra.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = "http://localhost:8080/landing.html";
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

// 1) Loader-Frames (Desktop)
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: `screenshots/landing-loader-${i}.png` });
    await page.waitForTimeout(220);
  }
  await page.close();
}

// 2) EN-Umschaltung
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.click("#lang-toggle");
  await page.waitForTimeout(400);
  const title = await page.title();
  const btn = await page.textContent("#lang-toggle");
  console.log("EN: title =", JSON.stringify(title), "| toggle zeigt:", btn);
  await page.screenshot({ path: "screenshots/landing-en-hero.png" });
  await page.locator("#manifesto").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "screenshots/landing-en-manifesto.png" });
  await page.close();
}

// 3) Reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce", ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const loaderVisible = await page.evaluate(() => {
    const l = document.getElementById("loader");
    return getComputedStyle(l).display !== "none" && !l.classList.contains("is-done");
  });
  console.log("reduced-motion: Loader sichtbar?", loaderVisible, "| pageerrors:", errors.length);
  await page.screenshot({ path: "screenshots/landing-reduced-hero.png" });
  await page.locator("#loop").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/landing-reduced-loop.png" });
  await ctx.close();
}

// 4) GSAP blockiert → No-fx-Fallback
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  await page.route("**/gsap*", (r) => r.abort());
  await page.route("**/ScrollTrigger*", (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const fx = await page.evaluate(() => document.documentElement.classList.contains("fx"));
  console.log("no-gsap: fx-Klasse?", fx, "| pageerrors:", errors.join("; ") || "keine");
  await page.screenshot({ path: "screenshots/landing-nogsap-hero.png" });
  await page.locator("#loop").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/landing-nogsap-loop.png" });
  await page.close();
}

await browser.close();
