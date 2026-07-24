import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";
import fs from "node:fs";

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const out = "/tmp/claude-0/-home-user-UrbanRevolution/feb76f78-87f7-5af7-8a3b-63d7c4719ac4/scratchpad";
fs.mkdirSync(out, { recursive: true });

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
await routeCdnThroughNode(page);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".de-describe-input", { timeout: 20000 });

// --- A) parser truth table -------------------------------------------------
const parse = await page.evaluate(() => {
  const G = window.GarmentSVG;
  const A = window.AI || {};
  const res = {};
  const texts = [
    "ein Kleid mit Knöpfen",
    "ein langes Kleid mit Knopfleiste in tiefem Rot",
    "ein Hemd mit Knöpfen",
    "eine Jacke mit Knöpfen",
    "etwas mit Knöpfen",
    "a dress with buttons",
  ];
  for (const t of texts) {
    res[t] = {
      detectType: A.detectType ? A.detectType(t.toLowerCase()) : null,
      closureAllowed_button: G ? G.closureAllowed(A.detectType ? A.detectType(t.toLowerCase()) : "x", "button") : null,
    };
  }
  res._allowedTable = {};
  for (const c of ["jacket", "hoodie", "shirt", "tshirt", "pants", "dress"]) {
    res._allowedTable[c] = ["zip", "button", "half", "none"].filter((v) => G.closureAllowed(c, v));
  }
  return res;
});
console.log("PARSE TRUTH TABLE:\n" + JSON.stringify(parse, null, 1));

// --- B) can the dress flat draw a placket at all? --------------------------
const svgProbe = await page.evaluate(() => {
  const G = window.GarmentSVG;
  const mk = (cat, closure) => {
    const s = G.build(cat, { closure, collar: "vneck", length: "regular", hardware: "metal" });
    return { len: s.length, circles: (s.match(/<circle/g) || []).length, hash: s.length };
  };
  return {
    dress_none: mk("dress", "none"),
    dress_button: mk("dress", "button"),
    dress_zip: mk("dress", "zip"),
    identical_none_vs_button: G.build("dress", { closure: "none" }) === G.build("dress", { closure: "button" }),
    identical_none_vs_zip: G.build("dress", { closure: "none" }) === G.build("dress", { closure: "zip" }),
    shirt_none_vs_button_identical: G.build("shirt", { closure: "none" }) === G.build("shirt", { closure: "button" }),
    dressAnchors: Object.keys(G.regionAnchors("dress", {})),
    shirtAnchors: Object.keys(G.regionAnchors("shirt", {})),
  };
});
console.log("SVG PROBE:\n" + JSON.stringify(svgProbe, null, 1));

// --- C) the real user path: type it, look at what is read back -------------
await page.fill(".de-describe-input", "ein langes Kleid mit Knöpfen in tiefem Rot");
await page.click(".de-describe-read");
await page.waitForSelector(".de-understood-row", { timeout: 5000 });
const rows = await page.$$eval(".de-understood-row", (els) => els.map((e) => e.textContent.trim()));
console.log("UNDERSTOOD (Kleid mit Knöpfen):", JSON.stringify(rows));
await page.screenshot({ path: out + "/d2-dress-understood.png", fullPage: false });

// control: same sentence but a shirt
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".de-describe-input", { timeout: 20000 });
await page.fill(".de-describe-input", "ein langes Hemd mit Knöpfen in tiefem Rot");
await page.click(".de-describe-read");
await page.waitForSelector(".de-understood-row", { timeout: 5000 });
console.log("UNDERSTOOD (Hemd mit Knöpfen):", JSON.stringify(await page.$$eval(".de-understood-row", (els) => els.map((e) => e.textContent.trim()))));
await page.screenshot({ path: out + "/d2-shirt-understood.png" });

// --- D) the WORST path: closure read WITHOUT a category, then dress chosen -
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".de-describe-input", { timeout: 20000 });
await page.fill(".de-describe-input", "etwas Langes mit Knöpfen in tiefem Rot");
await page.click(".de-describe-read");
await page.waitForSelector(".de-understood-row", { timeout: 5000 });
console.log("UNDERSTOOD (no category, mit Knöpfen):", JSON.stringify(await page.$$eval(".de-understood-row", (els) => els.map((e) => e.textContent.trim()))));
await page.screenshot({ path: out + "/d2-nocat-understood.png" });
await page.click(".de-understood-apply");
await page.waitForTimeout(1400);
const q = await page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
console.log("NEXT QUESTION AFTER APPLY:", q);
await page.screenshot({ path: out + "/d2-after-apply.png" });

console.log("ERRORS:", errors);
await browser.close();
server.close();
