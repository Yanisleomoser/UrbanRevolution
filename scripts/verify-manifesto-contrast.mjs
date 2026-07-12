/**
 * Manifesto word-scrub a11y guard (R5): the resting/entrance opacity of the
 * `#manifesto .w` words — the state a full-motion user sees before the scrub
 * ignites them — must clear WCAG AA for LARGE text (3:1; the manifesto is
 * clamp(26px,4.6vw,52px), always ≥26px). The floor lives ONLY in the fx tween
 * in landing.js `buildManifesto` ({ opacity: … } → 1); the reduced-motion /
 * no-JS path leaves the words fully opaque, so the axe gate — which audits
 * under prefers-reduced-motion — is blind to this. GSAP also doesn't load in
 * the offline e2e box, so nothing in CI catches a regression here. This is that
 * guard: run it (locally, CDN-routed) whenever you touch the manifesto floor.
 *
 *   node scripts/verify-manifesto-contrast.mjs
 *
 * Exit 0 = floor clears 3:1 on desktop + mobile; 1 = regression or vacuous run.
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const LARGE_TEXT_AA = 3.0; // WCAG 1.4.3 threshold for text ≥ 24px (or ≥ 18.66px bold)

// ── WCAG contrast helpers (sRGB → relative luminance; alpha-composite in sRGB,
//    matching how browsers/axe blend an opacity:α element over its background) ─
const srgbToLin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
const composite = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };
const parseRgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

async function auditFloor(viewport, tag) {
  console.log(`\n— ${tag} (${viewport.width}×${viewport.height}) —`);
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await routeCdnThroughNode(page);
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  // Need the full-motion tween to have set the resting floor.
  const fx = await page.waitForFunction(() => document.documentElement.classList.contains("fx"), null, { timeout: 15000 }).then(() => true).catch(() => false);
  if (!fx) { check(false, "html.fx active (GSAP loaded) — cannot verify the fx-only floor without motion"); await ctx.close(); return; }
  await page.evaluate(() => window.scrollTo(0, 0)); // manifesto below its start trigger → words at the tween `from` floor
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const ws = [...document.querySelectorAll("#manifesto .w")];
    if (!ws.length) return null;
    let min = 1, sample = ws[0];
    for (const w of ws) { const o = parseFloat(getComputedStyle(w).opacity); if (o < min) { min = o; sample = w; } }
    const cs = getComputedStyle(sample);
    return { count: ws.length, floor: min, color: cs.color, fontPx: parseFloat(cs.fontSize),
             bg: (getComputedStyle(document.documentElement).getPropertyValue("--bg") || "#0A1622").trim() };
  });
  check(!!data && data.count >= 10, `manifesto split into words (${data ? data.count : 0})`);
  if (!data) { await ctx.close(); return; }
  const fg = parseRgb(data.color);
  const hex = data.bg.replace("#", "");
  const bg = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const eff = composite(fg, bg, data.floor);
  const cr = ratio(eff, bg);
  check(data.fontPx >= 24, `manifesto is large text (${data.fontPx}px ≥ 24px → 3:1 threshold)`);
  check(cr >= LARGE_TEXT_AA, `resting floor opacity ${data.floor} → contrast ${cr.toFixed(2)}:1 ≥ ${LARGE_TEXT_AA}:1 (fg ${data.color} on ${data.bg})`);
  check(errs.length === 0, `no page errors (${errs.length})`);
  await ctx.close();
}

try {
  await auditFloor({ width: 1440, height: 900 }, "desktop");
  await auditFloor({ width: 390, height: 844 }, "mobile");
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${failed ? `✗ ${failed} check(s) failed` : "✓ manifesto floor clears AA large-text contrast"}`);
process.exit(failed ? 1 : 0);
