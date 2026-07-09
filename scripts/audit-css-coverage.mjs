/**
 * Runtime cross-check for the static dead-CSS audit (audit-css-usage.mjs).
 *
 * Drives the REAL site headlessly across an exhaustive walk — landing, the
 * revealed studio journey for several garment categories (every modality +
 * detail atelier), ownership/measure/production/faq, the community sphere,
 * DE↔EN, the library modal, plus impressum / datenschutz / insights / 404 —
 * with Chromium CSS coverage on. Any rule the static pass called "removable"
 * that ACTUALLY MATCHED an element here is a false-dead and is reported so it
 * can be rescued before pruning. (Coverage is used only as a keep-signal: a
 * rule not seen here isn't proven dead, it just wasn't exercised — the static
 * 0-reference result remains the kill evidence.)
 *
 * Usage: node scripts/audit-css-coverage.mjs
 * Exits 0 always; prints the rescue set (removable rules that matched live).
 */
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

// Removable rules from the static pass (same process → same file state).
const stat = JSON.parse(execFileSync("node", ["scripts/audit-css-usage.mjs", "--json"], { encoding: "utf8", maxBuffer: 1 << 24 }));
const removable = stat.removable; // [{text,line,start,end}]

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });

// Accumulate used byte-ranges into styles.css across every page/interaction.
const usedRanges = [];
function absorb(entries) {
  for (const e of entries) {
    if (!/styles\.css/.test(e.url)) continue;
    for (const r of e.ranges) usedRanges.push([r.start, r.end]);
  }
}

async function withCoverage(fn) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await routeCdnThroughNode(page);
  await page.coverage.startCSSCoverage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try { await fn(page); } catch (e) { console.warn("walk step warn:", String(e).slice(0, 120)); }
  absorb(await page.coverage.stopCSSCoverage());
  await page.close();
  return errors;
}

const CAT_LABEL = { jacket: "Jacke", hoodie: "Hoodie", tshirt: "T-Shirt", shirt: "Hemd", pants: "Hose", dress: "Kleid" };

async function walkJourney(page, category) {
  await page.goto(base + "/#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
  await page.waitForTimeout(1000);
  const qText = () => page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
  for (let i = 0; i < 24; i++) {
    if (await page.$("#de-concept-grid")) break;
    const q = await qText();
    if (await page.$(".de-tot")) {
      await page.click(".de-tot .de-tot-panel:first-child").catch(() => {});
    } else if (await page.$(".de-regions")) {
      const spots = await page.$$(".de-hotspot");
      for (let s = 0; s < spots.length; s++) {
        await (await page.$$(".de-hotspot"))[s].click().catch(() => {});
        await page.waitForTimeout(150);
        const opts = await page.$$(".de-region-picker .de-region-opt");
        if (opts.length) await opts[opts.length - 1].click().catch(() => {});
        await page.waitForTimeout(150);
      }
      await page.click("#de-body .de-confirm").catch(() => {});
    } else if (await page.$(".de-cards")) {
      const isCat = (q || "").includes("entsteht") || /making/i.test(q || "");
      if (isCat && CAT_LABEL[category]) await page.click(`.de-cards .de-card[aria-label="${CAT_LABEL[category]}"]`).catch(() => {});
      else await page.click(".de-cards .de-card").catch(() => {});
      await page.waitForTimeout(500);
      const q2 = await qText();
      if (q2 === q) { const c = await page.$("#de-body .de-confirm"); if (c) await c.click().catch(() => {}); }
    } else if (await page.$(".de-range")) {
      await page.$eval(".de-range", (n) => { n.value = 78; n.dispatchEvent(new Event("input", { bubbles: true })); }).catch(() => {});
      await page.click("#de-body .de-confirm").catch(() => {});
    } else if (await page.$(".de-palette")) {
      await page.click(".de-scheme-tabs .de-scheme-tab:nth-child(2)").catch(() => {});
      const sw = await page.$$(".de-palette .de-palette-swatch");
      if (sw[2]) await sw[2].click().catch(() => {});
      if (sw[6]) await sw[6].click().catch(() => {});
      await page.click("#de-body .de-confirm").catch(() => {});
    } else if (await page.$(".de-rank")) {
      await page.click("#de-body .de-confirm").catch(() => {});
    } else break;
    await page.waitForTimeout(550);
  }
  await page.waitForSelector("#de-concept-grid", { timeout: 8000 }).catch(() => {});
  // refine → reveal ownership + make-real (measure/production/faq)
  await page.evaluate(() => { location.hash = "#ownership"; }).catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = "#measure"; }).catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = "#production"; }).catch(() => {});
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = "#faq"; }).catch(() => {});
  await page.waitForTimeout(300);
}

let totalErrors = 0;
// 1) Landing: full scroll so every landing beat's reveal fires.
totalErrors += (await withCoverage(async (page) => {
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  for (let y = 0; y < 12; y++) { await page.evaluate((i) => scrollTo(0, i * innerHeight * 0.9), y); await page.waitForTimeout(250); }
  // toggle EN then back
  await page.click(".nav-lang button, [data-lang='en'], .lang-toggle button").catch(() => {});
  await page.waitForTimeout(400);
  // community sphere lazy-load
  await page.evaluate(() => document.getElementById("community")?.scrollIntoView()).catch(() => {});
  await page.waitForTimeout(1500);
})).length;

// 2) Studio journeys across categories (varied modalities/regions).
for (const cat of ["jacket", "hoodie", "dress", "pants", "shirt", "tshirt"]) {
  totalErrors += (await withCoverage((page) => walkJourney(page, cat))).length;
}

// 3) Library modal + ownership actions on a deep-linked design.
totalErrors += (await withCoverage(async (page) => {
  await page.goto(base + "/#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById("open-library")?.click()).catch(() => {});
  await page.waitForTimeout(600);
})).length;

// 4) Other HTML pages.
for (const p of ["impressum.html", "datenschutz.html", "insights.html", "404.html"]) {
  totalErrors += (await withCoverage(async (page) => {
    await page.goto(base + "/" + p, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(600);
    for (let y = 0; y < 4; y++) { await page.evaluate((i) => scrollTo(0, i * 600), y); await page.waitForTimeout(150); }
  })).length;
}

await browser.close();
server.close();

// Merge ranges, then find removable rules that intersect any used range.
usedRanges.sort((a, b) => a[0] - b[0]);
function overlapsUsed(s, e) {
  for (const [a, b] of usedRanges) { if (a < e && b > s) return true; if (a >= e) break; }
  return false;
}
const rescued = removable.filter((r) => overlapsUsed(r.start, r.end));
console.log(`\nUsed CSS ranges captured: ${usedRanges.length}`);
console.log(`Removable rules (static): ${removable.length}`);
console.log(`⚠ Removable rules that MATCHED at runtime (rescue, DO NOT remove): ${rescued.length}`);
for (const r of rescued) console.log(`  ${String(r.line).padStart(5)}  ${r.text}`);
console.log(`\nWalk page errors: ${totalErrors}`);
