import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
mkdirSync("screenshots", { recursive: true });
const url = process.argv[2] || "http://localhost:8080/";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);
// full page
await page.screenshot({ path: "screenshots/full-desktop.png", fullPage: true });
console.log("wrote full-desktop");
// scroll to the 3D preview section and shoot the canvas
await page.evaluate(() => document.getElementById("preview")?.scrollIntoView());
await page.waitForTimeout(3500);
await page.screenshot({ path: "screenshots/preview-section.png" });
console.log("wrote preview-section");
await browser.close();
