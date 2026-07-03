/**
 * Slice-6 verification (§5.1 threshold portal): sample the orb→studio portal
 * as MOTION (disc scale curve, under-cover relocation, dissolve) and pin the
 * instant paths (reduced-motion click, #design deep-link) — plus a frame
 * series. Fails on page errors or a vacuous run.
 *
 *   node scripts/verify-threshold.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const OUT = "screenshots/verify-threshold";
mkdirSync(OUT, { recursive: true });

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

// ── 1) Full-motion path: the orb click becomes the portal ──────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("fx"), null, { timeout: 15000 });
  await page.$eval("#cta-orb", (el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    window.__portal = [];
    const t0 = performance.now();
    const tick = () => {
      const p = document.querySelector(".lp-portal");
      const d = p && p.querySelector(".lp-portal-disc");
      const m = d ? getComputedStyle(d).transform : null;
      const scale = m && m.startsWith("matrix(") ? Number(m.slice(7).split(",")[0]).toFixed(3) : null;
      window.__portal.push({
        t: Math.round(performance.now() - t0),
        portal: !!p,
        out: p ? p.classList.contains("is-out") : null,
        scale,
        opacity: d ? Number(getComputedStyle(d).opacity).toFixed(2) : null,
        hidden: document.getElementById("studio").hidden,
        y: Math.round(window.scrollY),
        hash: location.hash,
      });
      if (performance.now() - t0 < 2000) setTimeout(tick, 80);
    };
    tick();
  });
  await page.click("#cta-orb");
  // frame series while the beat runs
  for (let f = 0; f < 8; f++) {
    await page.screenshot({ path: `${OUT}/portal-${String(f).padStart(2, "0")}.png` }).catch(() => {});
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1400);
  const s = await page.evaluate(() => window.__portal);
  console.log("PORTAL samples (scale grows to 1 while hidden=true, then hidden=false + is-out fade):");
  s.forEach((x) => console.log(`  t=${String(x.t).padStart(4)} portal=${x.portal} out=${x.out} scale=${x.scale} op=${x.opacity} hidden=${x.hidden} y=${x.y} hash=${x.hash}`));

  const sawPortal = s.some((x) => x.portal);
  const growth = s.filter((x) => x.scale != null && !x.out).map((x) => Number(x.scale));
  // At the instant the studio unhides, the disc must already cover the
  // viewport (reveal is transitionend-synced, so scale ≈ 1 at that sample).
  const flip = s.find((x) => x.hidden === false);
  const coveredAtReveal = !!flip && flip.portal && Number(flip.scale) > 0.9;
  const revealed = s.some((x) => x.hidden === false);
  const outPhase = s.some((x) => x.out === true);
  const end = await page.evaluate(() => ({
    portalGone: !document.querySelector(".lp-portal"),
    hidden: document.getElementById("studio").hidden,
    hash: location.hash,
    focus: document.activeElement && document.activeElement.id,
    engineVisible: (() => { const el = document.getElementById("engine-host"); return !!el && el.getBoundingClientRect().top < innerHeight; })(),
  }));
  check(sawPortal, "the portal overlay appears on the orb click");
  check(growth.length >= 2 && growth[growth.length - 1] > growth[0], `the disc visibly grows (${growth[0]} → ${growth[growth.length - 1]})`);
  check(coveredAtReveal, `the studio unhides only once the disc covers the viewport (scale at flip: ${flip ? flip.scale : "n/a"})`);
  check(revealed && outPhase, "reveal happens under the cover, then the disc dissolves (is-out)");
  check(end.portalGone, "the portal removes itself");
  check(end.hidden === false && end.hash === "#design", `studio revealed + fragment set (hash=${end.hash})`);
  check(end.focus === "design", `focus moved into the studio (activeElement=${end.focus})`);
  check(end.engineVisible, "the journey stage is on screen after the portal");
  check(errors.length === 0, `no page errors (${errors.length ? errors : "clean"})`);
  await page.screenshot({ path: `${OUT}/portal-after.png` });
  await page.close();
}

// ── 2) Reduced motion: instant reveal, portal never runs ───────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(() => { window.__sawPortal = false; new MutationObserver(() => { if (document.querySelector(".lp-portal")) window.__sawPortal = true; }).observe(document.body, { childList: true }); });
  await page.click('a[href="#design"]');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ hidden: document.getElementById("studio").hidden, sawPortal: window.__sawPortal }));
  check(r.hidden === false, "reduced motion: click reveals the studio instantly");
  check(r.sawPortal === false, "reduced motion: no portal overlay was ever mounted");
  check(errors.length === 0, "reduced motion: no page errors");
  await ctx.close();
}

// ── 3) Deep-link: #design on load stays instant ─────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ hidden: document.getElementById("studio").hidden, portal: !!document.querySelector(".lp-portal") }));
  check(r.hidden === false, "deep-link: studio visible on load (mobile 390px)");
  check(r.portal === false, "deep-link: no portal");
  check(errors.length === 0, "deep-link: no page errors");
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ threshold verified");
process.exit(failed ? 1 : 0);
