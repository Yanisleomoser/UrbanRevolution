import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const out = "/tmp/claude-0/-home-user-UrbanRevolution/feb76f78-87f7-5af7-8a3b-63d7c4719ac4/scratchpad";

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
await routeCdnThroughNode(page);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console:" + m.text()); });
await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".de-describe-input", { timeout: 20000 });

await page.fill(".de-describe-input", "etwas Weites mit Knöpfen in tiefem Rot");
await page.click(".de-describe-read");
await page.waitForSelector(".de-understood-row", { timeout: 5000 });
await page.locator(".de-understood").screenshot({ path: out + "/d2-nocat-block.png" });
await page.click(".de-understood-apply");
await page.waitForTimeout(1400);

const pick = async () => {
  const q = await page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
  const labels = await page.$$eval("#de-body .de-card, #de-body .de-tot-panel", (els) => els.map((e) => e.textContent.trim().replace(/\s+/g, " ").slice(0, 26)));
  console.log(`Q: "${q.trim().slice(0, 46)}" → ${JSON.stringify(labels)}`);
  const kleid = page.locator("#de-body .de-card, #de-body .de-tot-panel").filter({ hasText: /Kleid/ });
  const target = (await kleid.count()) ? kleid.first() : page.locator("#de-body .de-card, #de-body .de-tot-panel").first();
  const isKleid = (await kleid.count()) > 0;
  if (!(await target.count())) return "stop";
  await target.click();
  await page.waitForTimeout(350);
  const c = await page.$("#de-body .de-confirm:not([disabled])");
  if (c) await c.click();
  await page.waitForTimeout(1300);
  return isKleid ? "dress" : "next";
};
for (let i = 0; i < 10; i++) {
  const r = await pick();
  if (r === "dress") { console.log("→ picked Kleid at step " + i); break; }
  if (r === "stop") break;
}
await page.waitForTimeout(1200);

// read the live DNA out of the flow via the chips + the actual rendered flat
const state = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#de-preview-chips *")].map((e) => e.textContent.trim()).filter(Boolean);
  const svg = document.querySelector("#de-preview svg, .de-preview svg");
  return {
    chips: [...new Set(chips)].slice(0, 20),
    svgCircles: svg ? svg.querySelectorAll("circle").length : -1,
    svgLen: svg ? svg.outerHTML.length : -1,
  };
});
console.log("STATE AFTER KLEID:", JSON.stringify(state, null, 1));
await page.screenshot({ path: out + "/d2-after-dress-pick.png" });

// ---- shared #dna= link: dress + button ----------------------------------
const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
await routeCdnThroughNode(p2);
await p2.goto(base + "/?dseed=7#dna=eyJjYXRlZ29yeSI6ImRyZXNzIiwiY29uc3RydWN0aW9uIjp7ImNsb3N1cmUiOiJidXR0b24ifSwiY29sb3IiOnsic2NoZW1lIjoibW9ubyIsInN0b3BzIjpbIiNkYzI2MjYiXX19", { waitUntil: "domcontentloaded", timeout: 30000 });
await p2.waitForTimeout(4000);
const shared = await p2.evaluate(() => {
  const svg = document.querySelector("#de-preview svg, .de-preview svg, .de-stage svg");
  return { found: !!svg, circles: svg ? svg.querySelectorAll("circle").length : -1 };
});
console.log("SHARED DNA LINK RENDER:", JSON.stringify(shared));
await p2.screenshot({ path: out + "/d2-shared-dna.png" });

console.log("ERRORS:", errors.slice(0, 6));
await browser.close();
server.close();
