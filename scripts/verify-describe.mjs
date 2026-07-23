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
  await page.goto(base + "/#design", { waitUntil: "domcontentloaded", timeout: 30000 });
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
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".de-describe-input", { timeout: 20000 });
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
  check(errors.length === 0, `no page errors on the describe path (${errors.join(" | ") || "clean"})`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ describe opener verified");
process.exit(failed ? 1 : 0);
