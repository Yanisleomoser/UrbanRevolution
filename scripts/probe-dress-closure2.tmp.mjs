import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";
import fs from "node:fs";

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const out = "/tmp/claude-0/-home-user-UrbanRevolution/feb76f78-87f7-5af7-8a3b-63d7c4719ac4/scratchpad";

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
await routeCdnThroughNode(page);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".de-describe-input", { timeout: 20000 });

// --- exact SVG diff dress none vs button ----------------------------------
const diff = await page.evaluate(() => {
  const G = window.GarmentSVG;
  const a = G.build("dress", { closure: "none", collar: "vneck" });
  const b = G.build("dress", { closure: "button", collar: "vneck" });
  const c = G.build("dress", { closure: "zip", collar: "vneck" });
  // find first differing index
  const firstDiff = (x, y) => { for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return i; return -1; };
  const i1 = firstDiff(a, b), i2 = firstDiff(a, c);
  return {
    none_vs_button_firstDiff: i1,
    none_ctx: a.slice(Math.max(0, i1 - 90), i1 + 120),
    button_ctx: b.slice(Math.max(0, i1 - 90), i1 + 120),
    none_vs_zip_firstDiff: i2,
    zip_ctx: c.slice(Math.max(0, i2 - 90), i2 + 160),
  };
});
console.log("DRESS SVG DIFF:\n" + JSON.stringify(diff, null, 1));

// --- the "shown then dropped" path ----------------------------------------
await page.fill(".de-describe-input", "etwas Weites mit Knöpfen in tiefem Rot");
await page.click(".de-describe-read");
await page.waitForSelector(".de-understood-row", { timeout: 5000 });
await page.locator(".de-understood").screenshot({ path: out + "/d2-nocat-block.png" });
await page.click(".de-understood-apply");
await page.waitForTimeout(1200);

// walk until the category question, choose Kleid
for (let step = 0; step < 8; step++) {
  const q = await page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
  const opts = await page.$$eval("#de-body [data-opt], #de-body .de-card", (els) => els.map((e) => (e.dataset.opt || "") + "|" + e.textContent.trim().slice(0, 30)));
  console.log(`STEP ${step}: q="${q.trim().slice(0, 50)}" opts=${JSON.stringify(opts.slice(0, 8))}`);
  const kleid = await page.$('#de-body [data-opt="dress"]');
  if (kleid) {
    await kleid.click();
    await page.waitForTimeout(300);
    const confirm = await page.$("#de-body .de-confirm:not([disabled])");
    if (confirm) await confirm.click();
    await page.waitForTimeout(1400);
    break;
  }
  const first = await page.$("#de-body [data-opt]");
  if (!first) break;
  await first.click();
  await page.waitForTimeout(300);
  const confirm = await page.$("#de-body .de-confirm:not([disabled])");
  if (confirm) await confirm.click();
  await page.waitForTimeout(1000);
}
const dnaAfter = await page.evaluate(() => {
  const d = window.__deDna || null;
  return d ? JSON.stringify(d).slice(0, 400) : "no __deDna global";
});
console.log("DNA AFTER DRESS PICK:", dnaAfter);
await page.screenshot({ path: out + "/d2-after-dress-pick.png", fullPage: false });

// --- shared #dna= link with dress + button --------------------------------
const link = await page.evaluate(() => {
  const S = window.DesignShare;
  if (!S || !S.encode) return null;
  const dna = { category: "dress", construction: { closure: "button" }, "color": { scheme: "mono", stops: ["#dc2626"] } };
  try { return S.encode(dna); } catch (e) { return "ERR " + e.message; }
});
console.log("SHARE ENCODE:", link);

// render-preview mapping for a high-confidence dress+button
const mapped = await page.evaluate(() => {
  const D = window.DesignDNA, P = window.DesignPreview, G = window.GarmentSVG;
  const d = D.create ? D.create() : {};
  D.set(d, "category", "dress", 1);
  D.set(d, "construction.closure", "button", 1);
  const raw = D.get(d, "construction.closure");
  const allowed = G.closureAllowed("dress", raw);
  return { raw, allowed, note: "render-preview.js:124 maps to 'none' when !allowed" };
});
console.log("RENDER-PREVIEW MAP:", JSON.stringify(mapped));

console.log("ERRORS:", errors);
await browser.close();
server.close();
