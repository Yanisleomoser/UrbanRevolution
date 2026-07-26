/**
 * Atelier-Ausbau verification (living board): walk the jacket journey to the
 * detail atelier and judge the premium layer AS MOTION — a pick must MORPH
 * the board flat (outline path curve, not a snap) with the hotspots riding
 * the moving geometry, hovering a picker option must ghost-preview it (and
 * revert without committing), the changed part must bloom (.de-region-glow),
 * and the hotspots must enter staggered. Reduced-motion: instant snaps, no
 * glow, fully functional. Fails on page errors or a vacuous run.
 * Pages boot with locale de-DE (the walk clicks the GERMAN "Jacke" card —
 * an en-US container would resolve the EN UI and time out).
 *
 *   node scripts/verify-atelier.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";
import { walkJourney } from "./journey-walk.mjs";

const OUT = "screenshots/verify-atelier";
mkdirSync(OUT, { recursive: true });

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

// Der Walk zum Board nutzt den geteilten Walker (scripts/journey-walk.mjs) —
// eigene Kopien dieser Schleife sind in genau diesem Guard schon zweimal
// still verrottet, als neue Screens dazukamen. Eigen bleibt nur die
// Farbwelt-Geste (Duo-Tab + zwei Stops), weil das Atelier danach mehr
// Regionen anbietet.
async function walkToBoard(page) {
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
  await page.waitForTimeout(1200);
  return walkJourney(page, {
    max: 20,
    until: (p) => p.$(".de-regions"),
    stopAt: (p) => p.$("#de-concept-grid"),
    on: {
      palette: async (p) => {
        await p.click(".de-scheme-tabs .de-scheme-tab:nth-child(2)");
        const sw = await p.$$(".de-palette .de-palette-swatch");
        await sw[2].click(); await sw[6].click();
        await p.waitForTimeout(200);
        await p.click("#de-body .de-confirm");
      },
    },
  });
}

const outlineD = (page) => page.$eval(".de-regions-stage .gs-outline", (n) => n.getAttribute("d")).catch(() => null);

// ── 1) Full-motion board ────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const reached = await walkToBoard(page);
  check(reached, "the walk reaches the detail atelier (jacket)");
  // Ohne Board prüft der Rest nichts — und stürzte bisher auf einem
  // null-Hotspot, was den Guard als Absturz statt als roten Check enden
  // liess. Ein Guard, der crasht, ist schlechter als kein Guard.
  if (!reached) { await page.close(); await browser.close(); server.close(); console.log("\n✗ Abbruch: das Atelier wurde nicht erreicht"); process.exit(1); }
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
  const preBox = await sleeveSpot.boundingBox();
  await sleeveSpot.click();
  await page.waitForTimeout(500); // camera settles
  // Kamerafahrt: opening drives the camera onto the part; the tapped anchor
  // is the transform's FIXED POINT, so the dot must not wander on screen.
  check(await page.$eval(".de-regions", (n) => n.classList.contains("is-zoomed")),
    "opening the picker drives the camera onto the part");
  const tf0 = await page.$eval(".de-regions-zoom", (n) => getComputedStyle(n).transform);
  check(/^matrix\(1\.2[0-9]/.test(tf0), `camera scale applied (${tf0.slice(0, 30)}…)`);
  const postBox = await (await page.$('.de-hotspot[aria-label^="Ärmel"]')).boundingBox();
  const drift = Math.hypot(
    (preBox.x + preBox.width / 2) - (postBox.x + postBox.width / 2),
    (preBox.y + preBox.height / 2) - (postBox.y + postBox.height / 2));
  check(drift <= 10, `the tapped anchor is the camera's fixed point (drift ${drift.toFixed(1)}px)`);
  const opts = await page.$$(".de-region-picker .de-region-opt");
  check(opts.length === 3, "sleeve micro-picker offers its three cuts");
  // Atelier-Lupe: every option carries a REAL close-up of the detail, and the
  // close-ups actually differ between options (no decorative placeholders).
  const thumbs = await page.$$eval(".de-region-picker .de-region-opt-thumb svg", (els) =>
    els.map((el) => ({ vb: el.getAttribute("viewBox"), html: el.innerHTML.length })));
  check(thumbs.length === opts.length, "every option carries a close-up thumbnail");
  check(thumbs.every((th) => th.vb && th.vb !== "0 0 240 340"), `thumbnails are CROPPED views (${thumbs[0] && thumbs[0].vb})`);
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
      }).observe(document.querySelector(".de-regions"), { childList: true, subtree: true }); // glow lives in the zoom wrapper
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
  // Re-opening a decided region: the picker marks what the piece carries.
  await page.click('.de-hotspot[aria-label^="Ärmel"]');
  await page.waitForTimeout(300);
  const marks = await page.$$eval(".de-region-picker .de-region-opt", (els) => els.map((el) => ({
    cur: el.classList.contains("is-current"), pressed: el.getAttribute("aria-pressed"),
  })));
  check(marks.filter((x) => x.cur).length === 1 && marks[2].cur && marks[2].pressed === "true",
    "re-opened picker marks the carried value ('aktuell' on the picked drop cut)");
  await page.screenshot({ path: `${OUT}/picker-lupe.png` });
  // A direct region switch GLIDES: still zoomed, new fixed point. Target the
  // COLLAR spot — it sits above the sleeve panel; spots underneath an open
  // panel are intentionally unreachable (the panel has priority, a stage tap
  // closes it first).
  const tfSleeve = await page.$eval(".de-regions-zoom", (n) => getComputedStyle(n).transform);
  await page.click('.de-hotspot[aria-label^="Kragen"]');
  await page.waitForTimeout(500);
  const tfHem = await page.$eval(".de-regions-zoom", (n) => getComputedStyle(n).transform);
  check(await page.$eval(".de-regions", (n) => n.classList.contains("is-zoomed")) && tfHem !== tfSleeve,
    "switching regions keeps the camera in — it glides to the new fixed point");
  await page.screenshot({ path: `${OUT}/camera-on-hem.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  check(await page.$eval(".de-regions-zoom", (n) => getComputedStyle(n).transform) === "none"
    && !(await page.$eval(".de-regions", (n) => n.classList.contains("is-zoomed"))),
    "Escape pulls the camera back out");
  await page.screenshot({ path: `${OUT}/board-after-picks.png` });
  check(errors.length === 0, `no page errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

// ── 2) Reduced motion: snaps, no glow, fully functional ────────────────────
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", locale: "de-DE" });
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

// ── 3) Touch semantics (the tap-feel contract, headless part) ──────────────
// What a real thumb must get: an offset tap still hits (44px zone), opening
// the picker NEVER tries an option on uninvited (the :focus-visible gate),
// and ONE tap on an option decides — picker closes, pin set.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "de-DE" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  check(await walkToBoard(page), "touch walk reaches the atelier");
  await page.waitForTimeout(600);
  const spot = await page.$('.de-hotspot[aria-label^="Ärmel"]');
  const box = await spot.boundingBox();
  const dBefore = await outlineD(page);
  // Tap 13px off the visible dot centre — inside the 44px zone, must hit.
  await page.touchscreen.tap(box.x + box.width / 2 + 13, box.y + box.height / 2 - 10);
  await page.waitForTimeout(500);
  check(await page.$eval('.de-hotspot[aria-label^="Ärmel"]', (n) => n.getAttribute("aria-expanded")) === "true",
    "an offset tap (13px off the dot) still opens the picker (44px zone)");
  check(await page.$eval(".de-regions", (n) => n.classList.contains("is-zoomed")),
    "the camera move also happens under touch");
  check((await outlineD(page)) === dBefore,
    "opening by TAP does not try anything on (focus-visible gate holds on touch)");
  // ONE tap on an option decides: pin set, picker closed, board updated.
  const opt = (await page.$$(".de-region-picker .de-region-opt"))[2];
  const ob = await opt.boundingBox();
  check(ob.height >= 40, `option rows are thumb-sized (${Math.round(ob.height)}px)`);
  await page.touchscreen.tap(ob.x + ob.width / 2, ob.y + ob.height / 2);
  await page.waitForTimeout(900);
  check(await page.$eval('.de-hotspot[aria-label^="Ärmel"]', (n) => n.classList.contains("is-set")),
    "ONE tap decides — the pin is set");
  check(await page.$eval(".de-region-picker", (n) => n.hidden), "…and the picker closed itself");
  check(!(await page.$eval(".de-regions", (n) => n.classList.contains("is-zoomed"))),
    "…and the camera pulled back with it");
  check((await outlineD(page)) !== dBefore, "…and the board carries the pick");
  check(errors.length === 0, `no page errors on the touch path (${errors.join(" | ") || "clean"})`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ living atelier verified");
process.exit(failed ? 1 : 0);
