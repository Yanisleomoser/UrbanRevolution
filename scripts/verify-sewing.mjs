/**
 * Slice-10 verification (§5.4 sewing handoff + §9 ownership seam): jump to
 * Phase F via a #dna= share link, stub AI.generateDesign (no network, fixed
 * 1.6 s latency), click generate and judge the handoff AS MOTION — the thread
 * field must sew over the flat while the promise is pending (running
 * deSewRun animations, not just DOM presence), the name-plate must TYPE on
 * after resolve, and the ownership moment must take over only AFTER the
 * plate began speaking. Reduced-motion: no overlay, immediate handoff.
 * Fails on page errors or a vacuous run.
 *
 *   node scripts/verify-sewing.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const require = createRequire(import.meta.url);
global.DesignDNA = require("../js/design-engine/dna.js");
const Share = require("../js/design-engine/share.js");

const OUT = "screenshots/verify-sewing";
mkdirSync(OUT, { recursive: true });

const D = global.DesignDNA;
const dna = D.create();
D.set(dna, "category", "hoodie", 1);
D.set(dna, "silhouette.fit", 0.6, 1);
D.set(dna, "length", "regular", 1);
D.set(dna, "fabric.material", "fleece", 1);
D.set(dna, "color.scheme", "mono", 1);
D.set(dna, "color.stops", ["#2a9d8f"], 1);
D.set(dna, "intent.energy", 0.7, 1);
dna.archetypeWeights.sport = 1.1;
const SHARE = "#dna=" + Share.encode(dna);

// Mirrors the real AI contract exactly (tags + constructionNotes are ARRAYS —
// renderDesignResult forEaches them).
const STUB = `window.AI = window.AI || {};
window.AI.generateDesign = () => new Promise((res) => setTimeout(() => res({
  name: "Circuit One", description: "test", color: "#2a9d8f", material: "fleece",
  fit: "regular", tags: ["test"], constructionNotes: ["Testnaht doppelt"] }), 1600));`;

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

// ── 1) Full-motion handoff: sew → name-plate → ownership ───────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/" + SHARE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-generate", { timeout: 20000 });
  await page.waitForTimeout(2500); // arrival beat settles; guard window passes
  await page.evaluate(STUB);
  await page.evaluate(() => {
    window.__sew = [];
    const t0 = performance.now();
    const tick = () => {
      const sew = document.querySelector(".de-sew");
      const plate = document.querySelector(".de-nameplate");
      const own = document.getElementById("ownership");
      window.__sew.push({
        t: Math.round(performance.now() - t0),
        sew: !!sew,
        sewAnims: sew ? document.getAnimations().filter((a) => a.animationName === "deSewRun" && a.playState === "running").length : 0,
        plateLen: plate ? plate.textContent.length : null,
        ownHidden: own ? own.hidden : null,
        btn: (document.getElementById("de-generate") || {}).textContent || "",
      });
      if (performance.now() - t0 < 6000) setTimeout(tick, 100);
    };
    tick();
  });
  await page.click("#de-generate");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/sewing-pending.png` });
  await page.waitForTimeout(5500);
  await page.screenshot({ path: `${OUT}/handoff-done.png` });
  const s = await page.evaluate(() => window.__sew);

  const pending = s.filter((x) => x.sew);
  check(pending.length >= 6, `sew overlay lives through the wait (${pending.length} samples)`);
  check(pending.some((x) => x.sewAnims >= 10), `threads actually RUN as stitches (max ${Math.max(0, ...pending.map((x) => x.sewAnims))} deSewRun animations)`);
  const afterResolve = s.filter((x) => x.plateLen !== null);
  check(afterResolve.length > 0, "name-plate appears on resolve");
  const plateGrowth = afterResolve.map((x) => x.plateLen).filter((v, i, a) => i && v > a[i - 1]).length;
  check(plateGrowth >= 1, `name-plate TYPES on (${plateGrowth} growth steps for "Circuit One")`);
  check(afterResolve[afterResolve.length - 1].plateLen === "Circuit One".length, "plate ends on the full name");
  const tPlate = afterResolve[0];
  const tOwn = s.find((x) => x.ownHidden === false);
  check(!!tOwn && tOwn.t >= tPlate.t, `ownership takes over AFTER the plate speaks (${tPlate.t}ms → ${tOwn && tOwn.t}ms)`);
  const last = s[s.length - 1];
  check(!last.sew, "sew overlay is gone after the handoff");
  check(/generieren|generate/i.test(last.btn), `button returns to a regenerate affordance ("${last.btn.trim()}")`);
  // The retired #ai-output card no-ops by design — the ownership moment IS
  // the result surface; its name line must carry the piece's name.
  const ownName = await page.$eval("#own-name", (n) => n.textContent).catch(() => "");
  check(ownName.includes("Circuit One"), `ownership carries the piece's name (${JSON.stringify(ownName)})`);
  // "Dein Stück": the try-on stage shows the REAL piece (parametric flat from
  // the design DNA), never an unrelated example photo next to your design.
  const stage = await page.evaluate(() => {
    const ex = document.getElementById("vto-example");
    const svg = ex && ex.querySelector(".own-flat svg");
    const tag = ex && ex.querySelector(".vto-example-tag");
    return ex ? {
      hasFlat: ex.classList.contains("has-flat"),
      hasImage: ex.classList.contains("has-image"),
      svg: !!svg, tag: tag ? tag.textContent : "",
      fillTeal: svg ? svg.outerHTML.includes("#2a9d8f") : false,
    } : null;
  });
  check(!!stage && stage.hasFlat && !stage.hasImage && stage.svg,
    "the try-on stage shows YOUR piece (flat), not the example photo");
  check(!!stage && /dein stück|your piece/i.test(stage.tag), `the badge names it (${stage && stage.tag})`);
  check(!!stage && stage.fillTeal, "…in the design's own colour (teal stops reach the stage flat)");
  // Facade live-follow: picking another colour in "Weiter anpassen" re-dyes
  // the stage flat immediately (updateOwnInfo subscription).
  await page.$eval(".own-edit", (n) => { n.open = true; });
  const before = await page.$eval("#vto-example .own-flat", (n) => n.innerHTML);
  await page.click("#oe-colors .oe-color:nth-child(3)");
  await page.waitForTimeout(400);
  const after = await page.$eval("#vto-example .own-flat", (n) => n.innerHTML);
  check(before !== after, "a facade colour pick re-dyes the stage flat live");
  check(errors.length === 0, `no page errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

// ── 2) Reduced motion: no overlay, no plate — immediate, honest handoff ────
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/" + SHARE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-generate", { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(STUB);
  await page.click("#de-generate");
  await page.waitForTimeout(600);
  check(!(await page.$(".de-sew")), "reduced-motion: no sewing overlay is ever created");
  await page.waitForTimeout(2200);
  const st = await page.evaluate(() => ({
    plate: !!document.querySelector(".de-nameplate"),
    own: document.getElementById("ownership") ? document.getElementById("ownership").hidden : null,
    btn: (document.getElementById("de-generate") || {}).textContent || "",
  }));
  check(!st.plate, "reduced-motion: no typed plate (flash announces instead)");
  check(st.own === false, "reduced-motion: ownership reveals immediately");
  check(/generieren|generate/i.test(st.btn), "button recovered");
  check(errors.length === 0, `no page errors on the reduced path (${errors.join(" | ") || "clean"})`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ sewing handoff verified");
process.exit(failed ? 1 : 0);
