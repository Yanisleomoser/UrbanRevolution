/**
 * R5 guard — the landing manifesto word-scrub must never dim the thesis below
 * WCAG-AA contrast for a real (non-reduced-motion) reader. The e2e axe gate runs
 * under prefers-reduced-motion (final, full-opacity state) and so cannot see the
 * scrub's floor; this check runs in FULL MOTION and asserts the dimmest .w word
 * clears AA. Deterministic (reads the settled floor opacity + composites it over
 * the page background), so it doesn't race entrance animations.
 *
 * The manifesto is clamp(26px…) → WCAG "large text" → 3:1 threshold. We assert a
 * small margin above that. If someone lowers the gsap floor again, this fails.
 *
 *   node scripts/verify-contrast.mjs
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const MIN = 3.0;          // WCAG-AA large-text threshold
const MARGIN = 3.3;       // fail if we drift close to the edge (current ≈3.6)

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (c, m) => { console.log(`  ${c ? "✓" : "✗ FAIL:"} ${m}`); if (!c) failed++; };

// In-page: read every .w word's text colour, effective (multiplied) opacity and
// the nearest opaque background behind it, composite, and return the WCAG
// contrast of the WEAKEST word.
const measure = () => {
  const srgbToLin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const opaqueBg = (el) => {
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > 0)) return [c[0], c[1], c[2]];
      n = n.parentElement;
    }
    return [10, 22, 34]; // --bg fallback
  };
  const effOpacity = (el) => { let o = 1, n = el; while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity || "1"); n = n.parentElement; } return o; };
  const words = [...document.querySelectorAll("#manifesto-text .w")];
  if (!words.length) return null;
  let min = Infinity, minInfo = null;
  for (const w of words) {
    const cs = getComputedStyle(w);
    const fg = parse(cs.color), bg = opaqueBg(w), a = effOpacity(w);
    const comp = [0, 1, 2].map((i) => Math.round(a * fg[i] + (1 - a) * bg[i]));
    const L1 = lum(comp), L2 = lum(bg);
    const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (cr < min) { min = cr; minInfo = { opacity: +a.toFixed(2), fontSize: cs.fontSize, cr: +cr.toFixed(2) }; }
  }
  return { count: words.length, min: +min.toFixed(2), minInfo };
};

for (const vp of [{ name: "desktop", width: 1280, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("fx"), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600); // let the fromTo set the floor
  const r = await page.evaluate(measure);
  if (!r) { check(false, `${vp.name}: manifesto words found`); await ctx.close(); continue; }
  console.log(`  [${vp.name}] ${r.count} words · weakest opacity=${r.minInfo.opacity} size=${r.minInfo.fontSize} → contrast ${r.min}:1`);
  check(r.min >= MIN, `${vp.name}: weakest manifesto word clears WCAG-AA large-text (${r.min} ≥ ${MIN})`);
  check(r.min >= MARGIN, `${vp.name}: weakest word keeps margin above the edge (${r.min} ≥ ${MARGIN})`);
  check(errors.length === 0, `${vp.name}: no page errors`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} contrast check(s) failed` : "\n✓ manifesto contrast floor verified (full motion)");
process.exit(failed ? 1 : 0);
