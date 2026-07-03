/**
 * Atelier-Ausbau verification (living board): walk the jacket journey to the
 * detail atelier and judge the premium layer AS MOTION — a pick must MORPH
 * the board flat (outline path curve, not a snap) with the hotspots riding
 * the moving geometry, hovering a picker option must ghost-preview it (and
 * revert without committing), the changed part must bloom (.de-region-glow),
 * and the hotspots must enter staggered. Reduced-motion: instant snaps, no
 * glow, fully functional. Fails on page errors or a vacuous run.
 *
 *   node scripts/verify-atelier.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const OUT = "screenshots/verify-atelier";
mkdirSync(OUT, { recursive: true });

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

// Deterministic mini-walk (mirrors shoot-journey.mjs) until the board shows.
async function walkToBoard(page) {
  await page.goto(base + "/#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 20; i++) {
    if (await page.$(".de-regions")) return true;
    if (await page.$("#de-concept-grid")) return false;
    const q = await page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
    if (await page.$(".de-tot")) {
      await page.click(".de-tot .de-tot-panel:first-child");
    } else if (await page.$(".de-cards")) {
      const isCategory = (q || "").includes("entsteht") || /making/i.test(q || "");
      if (isCategory) await page.click('.de-cards .de-card[aria-label="Jacke"]');
      else await page.click(".de-cards .de-card");
      await page.waitForTimeout(500);
      const q2 = await page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
      if (q2 === q) { const c = await page.$("#de-body .de-confirm"); if (c) await c.click().catch(() => {}); }
    } else if (await page.$(".de-range")) {
      await page.$eval(".de-range", (n) => { n.value = 78; n.dispatchEvent(new Event("input", { bubbles: true })); });
      await page.waitForTimeout(250);
      await page.click("#de-body .de-confirm");
    } else if (await page.$(".de-palette")) {
      await page.click(".de-scheme-tabs .de-scheme-tab:nth-child(2)");
      const sw = await page.$$(".de-palette .de-palette-swatch");
      await sw[2].click(); await sw[6].click();
      await page.waitForTimeout(200);
      await page.click("#de-body .de-confirm");
    } else { return false; }
    await page.waitForTimeout(650);
  }
  return !!(await page.$(".de-regions"));
}

const outlineD = (page) => page.$eval(".de-regions-stage .gs-outline", (n) => n.getAttribute("d")).catch(() => null);

// ── 1) Full-motion board ────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  check(await walkToBoard(page), "the walk reaches the detail atelier (jacket)");
  await page.waitForTimeout(800);

  // Staggered pin entry: every hotspot carries its own animation delay.
  const delays = await page.$$eval(".de-hotspot", (els) => els.map((el) => el.style.animationDelay));
  check(delays.length >= 5 && new Set(delays).size === delays.length,
    `hotspots enter staggered (${delays.join(", ")})`);

  // Ghost try-on: hover the sleeve "Drop" option — the board previews it
  // WITHOUT committing; leaving reverts.
  const dBefore = await outlineD(page);
  const sleeveSpot = await page.$('.de-hotspot[aria-label^="Ärmel"]');
  check(!!sleeveSpot, "sleeve hotspot present");
  await sleeveSpot.click();
  await page.waitForTimeout(300);
  const opts = await page.$$(".de-region-picker .de-region-opt");
  check(opts.length === 3, "sleeve micro-picker offers its three cuts");
  await opts[opts.length - 1].hover(); // Drop-Shoulder
  await page.waitForTimeout(600);
  const dGhost = await outlineD(page);
  check(dGhost !== dBefore, "hovering an option TRIES IT ON the board (outline reshapes)");
  await page.screenshot({ path: `${OUT}/ghost-tryon.png` });
  await page.mouse.move(60, 300); // leave the option
  await page.waitForTimeout(600);
  const dReverted = await outlineD(page);
  check(dReverted === dBefore, "leaving the option reverts the ghost (nothing committed)");
  const confirmLabel = await page.$eval(".de-regions-confirm", (n) => n.textContent);
  check(/passt so|fine as is/i.test(confirmLabel), "confirm still offers 'accept as is' — the ghost never counted as a pick");

  // The pick itself MORPHS the flat: sample the outline path per rAF frame.
  await page.evaluate(() => {
    window.__morph = [];
    const tick = () => {
      const p = document.querySelector(".de-regions-stage .gs-outline");
      window.__morph.push(p ? p.getAttribute("d") : null);
      if (window.__morph.length < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const spotLeftBefore = await page.$eval('.de-hotspot[aria-label^="Ärmel"]', (n) => n.style.left);
  await (await page.$$(".de-region-picker .de-region-opt"))[2].click(); // Drop
  await page.waitForTimeout(1500);
  const frames = (await page.evaluate(() => window.__morph)).filter(Boolean);
  const uniques = new Set(frames).size;
  check(uniques >= 3, `the pick MORPHS the board — ${uniques} distinct outline states sampled (curve, not snap)`);
  const spotLeftAfter = await page.$eval('.de-hotspot[aria-label^="Ärmel"]', (n) => n.style.left);
  check(spotLeftBefore !== spotLeftAfter, `hotspots ride the moving geometry (${spotLeftBefore} → ${spotLeftAfter})`);
  const glowSeen = await page.evaluate(() => new Promise((res) => {
    if (document.querySelector(".de-region-glow")) return res(true);
    // glow may already be gone at 13 fps — re-pick to catch it live
    res(false);
  }));
  if (!glowSeen) {
    // second pick with an armed observer — the glow is a 550 ms one-shot
    await page.evaluate(() => {
      window.__glow = false;
      new MutationObserver((muts) => {
        muts.forEach((m) => m.addedNodes.forEach((n) => {
          if (n.classList && n.classList.contains("de-region-glow")) window.__glow = true;
        }));
      }).observe(document.querySelector(".de-regions"), { childList: true });
    });
    await page.click('.de-hotspot[aria-label^="Saum"]');
    await page.waitForTimeout(300);
    const o2 = await page.$$(".de-region-picker .de-region-opt");
    if (o2.length) await o2[o2.length - 1].click();
    await page.waitForTimeout(500);
    check(await page.evaluate(() => window.__glow), "a pick blooms a glow on the changed part (§6 reaction)");
  } else {
    check(true, "a pick blooms a glow on the changed part (§6 reaction)");
  }
  await page.screenshot({ path: `${OUT}/board-after-picks.png` });
  check(errors.length === 0, `no page errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

// ── 2) Reduced motion: snaps, no glow, fully functional ────────────────────
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  check(await walkToBoard(page), "reduced-motion walk reaches the atelier");
  const d0 = await outlineD(page);
  await page.click('.de-hotspot[aria-label^="Ärmel"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__snap = [];
    const tick = () => {
      const p = document.querySelector(".de-regions-stage .gs-outline");
      window.__snap.push(p ? p.getAttribute("d") : null);
      if (window.__snap.length < 20) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const o = await page.$$(".de-region-picker .de-region-opt");
  await o[o.length - 1].click();
  await page.waitForTimeout(900);
  const snap = (await page.evaluate(() => window.__snap)).filter(Boolean);
  check(new Set(snap).size <= 2, `reduced-motion pick SNAPS (${new Set(snap).size} states — from → to, no tween)`);
  check((await outlineD(page)) !== d0, "…and the pick still lands (board updated)");
  check(!(await page.$(".de-region-glow")), "reduced-motion: no glow spawns");
  check(errors.length === 0, `no page errors on the reduced path (${errors.join(" | ") || "clean"})`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ living atelier verified");
process.exit(failed ? 1 : 0);
