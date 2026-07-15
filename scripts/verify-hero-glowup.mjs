/**
 * One-off instrumented verification for the hero "Reclaimed Light" glow-up:
 *   1. aurora layer present + luminous (computed style)
 *   2. photo scroll-parallax: sample transform across the hero exit + assert
 *      the img never uncovers the hero bottom edge (no transparent gap)
 *   3. magnetic CTAs: pointer pull → non-identity transform, leave → settles ~0
 *   4. pointer-bloom: screenshot with pointer over the field (visual)
 *   5. axe-core: no serious/critical contrast fails on the revealed hero
 *   6. reduced-motion: html.fx absent, aurora animation none (static frame)
 *   7. zero uncaught console errors throughout
 */
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";
import { mkdirSync } from "node:fs";

const OUT = "screenshots/hero-verify";   // gitignored, like the other shoot outputs
mkdirSync(OUT, { recursive: true });

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const fails = [];
const note = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) fails.push(msg); };

async function newPage(vp, reduced, forceFinePointer) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, reducedMotion: reduced ? "reduce" : "no-preference" });
  // Headless Chromium reports no pointing device, so `(pointer: fine)` is false
  // and the magnet (like initOrb) self-disables — force it true to exercise the
  // real handler. Other media queries pass through untouched.
  if (forceFinePointer) {
    await ctx.addInitScript(() => {
      const orig = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q === "(pointer: fine)" ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : orig(q));
    });
  }
  const page = await ctx.newPage();
  // Same benign-noise filter as scripts/e2e.mjs (analytics/CDN/font 404s off-Vercel).
  const IGNORE = /vercel|insights|analytics|_vercel|favicon|replicate|googleapis|gstatic|jsdelivr|unpkg|cdn\.|fonts|net::ERR|Failed to load resource|sentry|the server responded with a status of|ERR_/i;
  const errors = [];
  page.on("pageerror", (e) => { if (!IGNORE.test(String(e))) errors.push(String(e)); });
  page.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  await routeCdnThroughNode(page);
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2200);
  page._errors = errors;
  page._ctx = ctx;
  return page;
}

// ── 1) Desktop, motion on ──────────────────────────────────────────────
{
  const page = await newPage({ width: 1440, height: 900 }, false, true);

  const fx = await page.evaluate(() => document.documentElement.classList.contains("fx"));
  note(fx, "html.fx active (full motion path)");

  const aura = await page.evaluate(() => {
    const el = document.querySelector(".lp-hero-aurora");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { blend: cs.mixBlendMode, anim: cs.animationName, hasBg: cs.backgroundImage.includes("gradient"), pe: cs.pointerEvents };
  });
  note(!!aura, "aurora element present");
  if (aura) {
    note(aura.blend === "screen", `aurora mix-blend = screen (${aura.blend})`);
    note(aura.hasBg, "aurora has radial-gradient background");
    note(aura.anim.startsWith("lp-hero-aurora"), `aurora breathes under fx (${aura.anim})`);
    note(aura.pe === "none", "aurora pointer-events:none (can't block taps)");
  }

  // 2) Parallax: sample transform + bottom-gap across the hero exit
  const heroH = await page.evaluate(() => document.querySelector(".lp-hero").offsetHeight);
  const frames = [0, 0.25, 0.5, 0.75, 1];
  let gap = false;
  const m42s = [];
  for (const f of frames) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(f * heroH));
    await page.waitForTimeout(900); // let scrub 0.6 settle
    const s = await page.evaluate(() => {
      const img = document.querySelector(".lp-hero-media img");
      const hero = document.querySelector(".lp-hero");
      const ir = img.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      const m = new DOMMatrix(getComputedStyle(img).transform);
      return { m42: m.m42, scale: m.m11, imgBottom: ir.bottom, heroBottom: hr.bottom };
    });
    m42s.push(+s.m42.toFixed(1));
    if (s.imgBottom < s.heroBottom - 1 && s.heroBottom > 0) gap = true;
    await page.screenshot({ path: `${OUT}/parallax-${Math.round(f * 100)}.png` });
  }
  const travel = Math.abs(m42s[m42s.length - 1] - m42s[0]);
  note(!gap, "photo parallax: NO transparent bottom-edge gap at any scroll point");
  note(travel > 8, `photo parallax: photo rises across scroll (Δy=${travel.toFixed(1)}px, depth reads)`);
  console.log("    m42 (translateY px):", JSON.stringify(m42s));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // 3) Magnet on primary CTA — synthetic pointermove (headless hit-testing is
  //    unreliable; dispatching directly exercises the real handler deterministically).
  await page.evaluate(() => {
    const el = document.querySelector(".lp-hero-ctas .lp-btn--primary");
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent("pointermove", { clientX: r.x + r.width * 0.85, clientY: r.y + r.height / 2, bubbles: true }));
  });
  await page.waitForTimeout(600);
  const pull = await page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector(".lp-hero-ctas .lp-btn--primary")).transform); return { x: m.m41, y: m.m42 }; });
  note(pull.x > 3 && pull.y <= -2, `magnet: primary CTA leans to cursor + folds the lift (x=${pull.x.toFixed(1)}, y=${pull.y.toFixed(1)})`);
  await page.evaluate(() => document.querySelector(".lp-hero-ctas .lp-btn--primary").dispatchEvent(new PointerEvent("pointerleave", { bubbles: true })));
  await page.waitForTimeout(1200);
  const settled = await page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector(".lp-hero-ctas .lp-btn--primary")).transform); return Math.abs(m.m41) + Math.abs(m.m42); });
  note(settled < 1.5, `magnet: settles back to rest on leave (|xy|=${settled.toFixed(2)})`);

  // 4) Pointer-bloom: move over the field (lower-left, away from headline) → screenshot
  await page.mouse.move(360, 760);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/bloom-field.png` });
  // and over the headline — bloom must fade to nothing there (visual)
  await page.mouse.move(360, 300);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/bloom-headline.png` });

  // 5) axe on the hero (scope to the hero section)
  const axe = await new AxeBuilder({ page }).include(".lp-hero").withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  note(bad.length === 0, `axe: no serious/critical WCAG on hero (${bad.length})`);
  bad.forEach((v) => console.log(`      ! ${v.id} [${v.impact}] ${v.nodes.length}× — ${v.help}`));

  note(page._errors.length === 0, `no console errors, desktop (${page._errors.length})`);
  page._errors.slice(0, 5).forEach((e) => console.log("      · " + e.slice(0, 140)));
  await page.close(); await page._ctx.close();
}

// ── 6) Reduced-motion desktop: static, no fx ────────────────────────────
{
  const page = await newPage({ width: 1440, height: 900 }, true);
  const st = await page.evaluate(() => ({
    fx: document.documentElement.classList.contains("fx"),
    anim: getComputedStyle(document.querySelector(".lp-hero-aurora")).animationName,
    imgT: getComputedStyle(document.querySelector(".lp-hero-media img")).transform,
  }));
  note(!st.fx, "reduced-motion: html.fx NOT set (no JS motion)");
  note(st.anim === "none", `reduced-motion: aurora animation none (${st.anim})`);
  note(st.imgT !== "none", "reduced-motion: photo keeps static 1.08 scale frame (no jump)");
  await page.screenshot({ path: `${OUT}/reduced-desktop.png` });
  note(page._errors.length === 0, `no console errors, reduced-motion (${page._errors.length})`);
  await page.close(); await page._ctx.close();
}

// ── 7) Mobile parallax + overflow ───────────────────────────────────────
{
  const page = await newPage({ width: 390, height: 844 }, false);
  const heroH = await page.evaluate(() => document.querySelector(".lp-hero").offsetHeight);
  let gap = false;
  for (const f of [0, 0.5, 1]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(f * heroH));
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => {
      const img = document.querySelector(".lp-hero-media img"), hero = document.querySelector(".lp-hero");
      const ir = img.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      return { imgBottom: ir.bottom, heroBottom: hr.bottom, docW: document.documentElement.scrollWidth, winW: window.innerWidth };
    });
    if (s.imgBottom < s.heroBottom - 1 && s.heroBottom > 0) gap = true;
    if (f === 0) note(s.docW <= s.winW + 1, `mobile: no horizontal overflow (${s.docW} <= ${s.winW})`);
  }
  note(!gap, "mobile: no bottom-edge gap across scroll");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/mobile.png` });
  note(page._errors.length === 0, `no console errors, mobile (${page._errors.length})`);
  await page.close(); await page._ctx.close();
}

await browser.close();
server.close();
console.log("\n" + (fails.length ? `✗ ${fails.length} FAIL` : "✓ ALL PASS") + `  → shots in ${OUT}`);
process.exit(fails.length ? 1 : 0);
