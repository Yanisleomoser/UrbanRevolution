/**
 * Permanent regression guard for the "describe" opener (Atelier-Analyse U4):
 * „Beschreib es. Die Maschine liest mit." — the journey's first screen lets
 * the user seed the DNA in their own words, plays the reading back as
 * editable chips, skips the questions it answered, and stays one tap away
 * from the classic step-by-step path.
 *
 *   node scripts/verify-describe.mjs        (boots its own static server)
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });

let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

// ── 1) The opener IS the first question, and skip is one tap ───────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
  const q1 = await page.$eval("#de-body .de-question", (n) => n.textContent);
  check(/beschreib/i.test(q1), `the journey opens with the describe question ("${q1.trim().slice(0, 40)}…")`);
  check(!!(await page.$(".de-describe-skip")), "the one-tap 'Schritt für Schritt' skip is present (no forced onboarding)");
  await page.click(".de-describe-skip");
  await page.waitForTimeout(900);
  const q2 = await page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
  check(q2 && !/beschreib/i.test(q2), "skip lands on the classic first question in one tap");
  check(errors.length === 0, `no page errors on the skip path (${errors.join(" | ") || "clean"})`);
  await page.close();
}

// ── 2) Typing the example idea reads back and truly skips questions ────────
// Läuft auf Desktop UND Mobil (390 px) — die Modalität muss auf beiden
// Breiten lesen, zurückspielen und committen (Tap-Ziele, kein Overflow).
for (const vp of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log(`  — describe path @ ${vp.name} (${vp.width}px) —`);
  await page.waitForSelector(".de-describe-input", { timeout: 20000 });
  if (vp.name === "mobile") {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 1, `no horizontal overflow with the describe surface open (${overflow}px)`);
  }
  await page.fill(".de-describe-input", "eine kastige, kurze Jacke in tiefem Rot, matt, viele Taschen");
  await page.click(".de-describe-read");
  await page.waitForSelector(".de-understood-row", { timeout: 5000 });
  const rows = await page.$$eval(".de-understood-row", (els) => els.map((el) => el.textContent));
  check(rows.length >= 4, `the machine reads back ≥4 understood dimensions (${rows.length})`);
  check(!!(await page.$(".de-understood-x")), "each reading is editable (removable) before it commits");
  // Remove one reading (the LAST — the category row must stay so the seed
  // still carries the garment) — the user stays the author.
  const before = rows.length;
  await page.click(".de-understood-row:last-of-type .de-understood-x");
  const after = await page.$$eval(".de-understood-row", (els) => els.length);
  check(after === before - 1, "removing a reading drops exactly that row");
  await page.click(".de-understood-apply");
  await page.waitForTimeout(1200);
  // The flat must already BE the described garment (category seeded → no
  // genesis cloud), and the flash credits the saved questions.
  const state = await page.evaluate(() => ({
    q: (document.querySelector("#de-body .de-question") || {}).textContent || "",
    flash: (document.getElementById("de-flash") || {}).textContent || "",
    svg: !!document.querySelector("#de-preview svg.de-garment"),
    chips: (document.getElementById("de-preview-chips") || {}).textContent || "",
  }));
  check(state.svg, "a garment (not the genesis cloud) renders right after apply — the category was read");
  check(/gespart/.test(state.flash), `the flash credits saved questions ("${state.flash.trim()}")`);
  check(!/beschreib/i.test(state.q), "the journey moved on to a real next question");
  check(/jacke|puffer|blazer|trench|bomber|work/i.test(state.chips) || /STIL|FIT|LÄNGE/i.test(state.chips),
    `the preview chips carry the read piece (${state.chips.trim().slice(0, 60) || "—"})`);
  if (vp.name === "mobile") {
    // Cockpit-Vertrag (Owner-Feedback 2026-07-24): Bühne UND Aktionsleiste
    // stehen nach jeder Antwort GEMEINSAM im Viewport — die Seite bewegt
    // sich nicht, der Fokus-Scroll darf den Rahmen nie verschieben.
    const cockpit = await page.evaluate(() => {
      const pv = document.getElementById("de-preview").getBoundingClientRect();
      const controls = document.querySelector(".de-controls").getBoundingClientRect();
      return {
        stageVisible: pv.top >= -8 && pv.bottom > 100,
        controlsInView: controls.top >= 0 && controls.bottom <= window.innerHeight + 1,
      };
    });
    check(cockpit.stageVisible, "cockpit: the stage stays in frame after the commit (no focus-scroll drift)");
    check(cockpit.controlsInView, "cockpit: the action row sits inside the viewport (thumb zone)");
  }
  check(errors.length === 0, `no page errors on the describe path (${errors.join(" | ") || "clean"})`);
  await page.close();
}

// ── 3) Cockpit v4 (Atelier-Wow B1+B5): Bühne ≥ 60 % auf jedem Standard-
// Frage-Screen, Karten-Sets als Dock-Rail, hohe Inhalte heben das Dock
// („Dock hebt sich") statt unter dem sticky Confirm zu scrollen. Der Walk
// seedet NUR die Kategorie („eine Jacke") und überspringt dann jede Frage —
// so zeigt sich jeder Screen des Jacken-Branches einmal, ohne dass Antworten
// weitere Fragen wegschneiden.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("  — cockpit v4 contract @ mobile (390px) —");
  await page.waitForSelector(".de-describe-input", { timeout: 20000 });
  const glass = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".de-ask-col"));
    return { blur: cs.backdropFilter || cs.webkitBackdropFilter || "none", bg: cs.backgroundColor };
  });
  check(glass.blur !== "none", `the dock carries the instrument-glass blur (${glass.blur})`);
  check(/rgba\(/.test(glass.bg), `the dock surface is the translucent glass token (${glass.bg})`);
  await page.fill(".de-describe-input", "eine Jacke");
  await page.click(".de-describe-read");
  await page.waitForSelector(".de-understood-row", { timeout: 5000 });
  await page.click(".de-understood-apply");
  await page.waitForTimeout(1100);
  const SPECIAL = new Set(["describe", "regions", "refine"]);
  let seen = 0;
  let sawRail = false;
  let sawLift = false;
  for (let i = 0; i < 14; i++) {
    const s = await page.evaluate(() => {
      const host = document.querySelector(".de-stage");
      const pv = document.getElementById("de-preview");
      const body = document.getElementById("de-body");
      const controls = document.querySelector(".de-controls").getBoundingClientRect();
      const cards = body.querySelector(".de-cards");
      const cs = cards ? getComputedStyle(cards) : null;
      return {
        mod: host.dataset.deMod || "",
        lifted: host.classList.contains("is-dock-lift"),
        ratio: pv && pv.offsetParent ? pv.getBoundingClientRect().height / host.getBoundingClientRect().height : null,
        bodyGap: body.scrollHeight - body.clientHeight,
        controlsIn: controls.top >= 0 && controls.bottom <= window.innerHeight + 1,
        rail: cs ? cs.display === "flex" && cs.overflowX === "auto" : null,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (s.mod === "refine") break;
    seen++;
    const tag = `${s.mod}${s.lifted ? "+lift" : ""}`;
    if (!SPECIAL.has(s.mod)) {
      if (s.lifted) {
        sawLift = true;
        check(s.bodyGap <= 4 && s.ratio >= 0.3,
          `screen ${seen} (${tag}): lifted dock fits its content (gap ${s.bodyGap}px), stage keeps presence (${Math.round(s.ratio * 100)}%)`);
      } else {
        check(s.ratio >= 0.6, `screen ${seen} (${tag}): the stage carries ≥60% of the frame (${Math.round(s.ratio * 100)}%)`);
        check(s.bodyGap <= 4, `screen ${seen} (${tag}): nothing scrolls under the sticky confirm (gap ${s.bodyGap}px)`);
      }
      if (s.rail !== null) { sawRail = true; check(s.rail, `screen ${seen} (${tag}): the card set runs as a swipeable dock rail`); }
    } else if (s.mod === "regions") {
      check(s.ratio === null, `screen ${seen} (regions): the board carries the flat itself (stage off)`);
    } else {
      check(s.ratio !== null && s.ratio < 0.5, `screen ${seen} (${tag}): special layout keeps its compact stage (${Math.round((s.ratio || 0) * 100)}%)`);
    }
    check(s.controlsIn, `screen ${seen} (${tag}): the action row stays in the thumb zone`);
    check(s.overflowX <= 1, `screen ${seen} (${tag}): no horizontal page overflow (${s.overflowX}px)`);
    await page.click("#de-skip");
    await page.waitForTimeout(750);
  }
  check(seen >= 6, `the walk saw a real breadth of question screens (${seen})`);
  check(sawRail, "at least one card set rendered as a rail");
  check(sawLift, "at least one tall set lifted the dock (Farb-Atelier/Ranking)");
  const refined = await page.evaluate(() => (document.querySelector(".de-stage").dataset.deMod || "") === "refine");
  check(refined, "the skip-walk lands on the refine screen (journey stays viable)");
  check(errors.length === 0, `no page errors across the cockpit walk (${errors.join(" | ") || "clean"})`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ describe opener verified");
process.exit(failed ? 1 : 0);
