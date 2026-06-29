/**
 * Urban Revolution — End-to-end browser smoke test (headless Chromium).
 *
 * Boots the real site on a self-contained static server and drives it like a
 * user in a real browser — the layer the offline unit suites can't reach. It
 * asserts the things that only break in an actual DOM: the page boots without
 * uncaught exceptions, the studio reveals on a CTA *and* a #dna deep-link, the
 * data-driven design journey actually mounts and renders a question, the
 * DE/EN language toggle swaps copy, and the mobile layout has no overflow.
 *
 * Self-sufficient: no external test runner, no python, no network to third
 * parties required (CDN/analytics failures are tolerated — the site is built to
 * degrade without them). Chromium comes from playwright-core (the same browser
 * scripts/shoot.mjs uses). Writes screenshots to screenshots/ as artifacts.
 *
 *   node scripts/e2e.mjs            # boots its own server on a free port
 *   BASE_URL=http://localhost:8080 node scripts/e2e.mjs   # use a running server
 *
 * Exit code 0 = all checks passed, 1 = at least one failed.
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startServer } from "./static-server.mjs";

const ROOT = process.cwd();
const OUT = join(ROOT, "screenshots");

// ── tiny assertion harness ────────────────────────────────────────────────
let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
function section(name) { console.log("\n— " + name + " —"); }

// Console/network noise from third parties the static box can't (and needn't)
// serve. Real app errors (our own scripts throwing) are NOT in this list.
const IGNORE = /vercel|insights|analytics|_vercel|favicon|replicate|googleapis|gstatic|jsdelivr|unpkg|cdn\.|fonts|net::ERR|Failed to load resource|sentry|the server responded with a status of|ERR_/i;
function watchErrors(page, bag) {
  page.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) bag.push("console: " + m.text()); });
  page.on("pageerror", (e) => { if (!IGNORE.test(e.message)) bag.push("pageerror: " + e.message); });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const ownServer = !process.env.BASE_URL;
  const server = ownServer ? await startServer() : null;
  const base = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}`;
  console.log("E2E against", base);

  const browser = await chromium.launch();
  const errors = [];

  try {
    // ── 1) Desktop boot ───────────────────────────────────────────────────
    section("Desktop boot: page loads cleanly with the core modules live");
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    watchErrors(page, errors);
    await page.goto(base + "/index.html", { waitUntil: "networkidle", timeout: 30000 });

    assert((await page.title()).length > 0, "document has a <title>");
    const globals = await page.evaluate(() => ({
      config: typeof window.CONFIG === "object",
      i18n: typeof window.I18N === "object",
      state: typeof window.StateManager === "object",
      flow: typeof window.DesignFlow === "object",
      garment: typeof window.GarmentSVG === "object",
    }));
    assert(globals.config && globals.i18n && globals.state, "CONFIG / I18N / StateManager are initialised");
    assert(globals.flow && globals.garment, "design-engine globals (DesignFlow, GarmentSVG) are live");

    section("Landing evidence band: the cited facts render and count");
    const facts = await page.evaluate(() => {
      const f = document.getElementById("facts");
      return { exists: !!f, counters: f ? f.querySelectorAll("[data-count]").length : 0 };
    });
    assert(facts.exists, "#facts evidence section is present");
    assert(facts.counters >= 3, `the three cited stat counters render (found ${facts.counters})`);

    // ── 2) Studio reveal via CTA ──────────────────────────────────────────
    section("Studio reveal: hidden until a CTA opens it");
    assert(await page.evaluate(() => document.getElementById("studio")?.hidden === true), "#studio starts hidden");
    await page.evaluate(() => document.querySelector('a[href="#design"]').click());
    await page.waitForFunction(() => document.getElementById("studio")?.hidden === false, { timeout: 5000 });
    assert(true, "clicking a #design CTA reveals the studio");

    // ── 3) The data-driven design journey actually mounts ─────────────────
    section("Design journey: the adaptive engine mounts and renders a question");
    await page.waitForFunction(() => {
      const h = document.getElementById("engine-host");
      const body = h && h.querySelector("#de-body");
      return h && h.classList.contains("de-stage") && body && body.children.length > 0;
    }, { timeout: 15000 });
    const journey = await page.evaluate(() => {
      const h = document.getElementById("engine-host");
      const body = h.querySelector("#de-body");
      return {
        mounted: h.classList.contains("de-stage"),
        bodyChildren: body ? body.children.length : 0,
        hasPreview: !!h.querySelector(".de-preview svg, .de-garment-wrap svg"),
      };
    });
    assert(journey.mounted, "the engine host mounts as a .de-stage");
    assert(journey.bodyChildren > 0, `a question/modality renders into the journey body (engine fetched its JSON content; ${journey.bodyChildren} node(s))`);
    assert(journey.hasPreview, "the live garment/genesis preview SVG renders alongside the question");
    await page.screenshot({ path: join(OUT, "e2e-desktop.png"), fullPage: false });

    // ── 4) Language toggle DE → EN ────────────────────────────────────────
    section("Language toggle: DE ↔ EN swaps copy and <html lang>");
    const beforeLang = await page.evaluate(() => document.documentElement.lang);
    const enterBefore = await page.evaluate(() => document.querySelector('[data-i18n="nav.enter"]')?.textContent.trim());
    await page.evaluate(() => document.getElementById("lang-toggle").click());
    await page.waitForFunction((prev) => document.documentElement.lang !== prev, beforeLang, { timeout: 5000 });
    const afterLang = await page.evaluate(() => document.documentElement.lang);
    const enterAfter = await page.evaluate(() => document.querySelector('[data-i18n="nav.enter"]')?.textContent.trim());
    assert(beforeLang !== afterLang, `<html lang> flips (${beforeLang} → ${afterLang})`);
    assert(enterBefore && enterAfter && enterBefore !== enterAfter, `nav copy is re-translated ("${enterBefore}" → "${enterAfter}")`);
    await ctx.close();

    // ── 5) Deep-link reveal (#dna=…) ──────────────────────────────────────
    section("Deep-link: a #dna= share link opens the studio on load");
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page2 = await ctx2.newPage();
    watchErrors(page2, errors);
    await page2.goto(base + "/index.html#dna=ABC123xyz", { waitUntil: "networkidle", timeout: 30000 });
    await page2.waitForFunction(() => document.getElementById("studio")?.hidden === false, { timeout: 5000 }).catch(() => {});
    assert(await page2.evaluate(() => document.getElementById("studio")?.hidden === false), "#dna deep-link reveals the studio without a click");
    await ctx2.close();

    // ── 6) Mobile layout (≤480px): no horizontal overflow ─────────────────
    section("Mobile (390px): boots clean with no horizontal overflow");
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mpage = await mctx.newPage();
    watchErrors(mpage, errors);
    await mpage.goto(base + "/index.html", { waitUntil: "networkidle", timeout: 30000 });
    const overflow = await mpage.evaluate(() => {
      const el = document.documentElement;
      return { scrollW: el.scrollWidth, clientW: el.clientWidth };
    });
    // Allow a 2px rounding tolerance.
    assert(overflow.scrollW <= overflow.clientW + 2, `no horizontal overflow (scrollW ${overflow.scrollW} ≤ clientW ${overflow.clientW} + 2)`);
    await mpage.screenshot({ path: join(OUT, "e2e-mobile.png"), fullPage: false });
    await mctx.close();

    // ── 7) Accessibility: axe-core finds no serious/critical violations ───
    // a11y is a hard project rule (CLAUDE.md) — this turns it from a manual
    // promise into an automated gate. axe catches ~30-40% of WCAG issues
    // (contrast, labels, roles, landmarks); it is the floor, not the ceiling.
    // Gates on serious+critical only (moderate/minor are reported, not blocking).
    section("Accessibility: no serious/critical axe-core violations");
    let AxeBuilder = null;
    try { ({ AxeBuilder } = await import("@axe-core/playwright")); }
    catch { console.log("    ⚠ a11y audit skipped — @axe-core/playwright not installed (CI installs it)"); }
    if (AxeBuilder) {
      const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
      const BLOCK = new Set(["serious", "critical"]);
      // Audit under prefers-reduced-motion: it renders every animated element in
      // its final, static, readable state — the contrast a user actually ends up
      // with — instead of transient keyframes axe can't reason about (e.g. the
      // landing manifesto word-scrub resting at opacity 0.13 before scroll). It is
      // also a real supported mode, so we're checking a genuine user experience.
      async function auditA11y(name, viewport, reveal) {
        const c = await browser.newContext({ viewport, reducedMotion: "reduce" });
        const p = await c.newPage();
        await p.goto(base + "/index.html", { waitUntil: "networkidle", timeout: 30000 });
        if (reveal) {
          await p.evaluate(() => document.querySelector('a[href="#design"]')?.click());
          await p.waitForFunction(() => document.getElementById("studio")?.hidden === false, { timeout: 5000 }).catch(() => {});
        }
        const { violations } = await new AxeBuilder({ page: p }).withTags(WCAG).analyze();
        const blocking = violations.filter((v) => BLOCK.has(v.impact));
        for (const v of blocking) {
          console.log(`    • [${v.impact}] ${v.id} (${v.nodes.length}): ${v.help}`);
          v.nodes.slice(0, 3).forEach((n) => console.log(`        ${n.target.join(" ")}`));
        }
        const moderate = violations.length - blocking.length;
        assert(blocking.length === 0, `${name}: no serious/critical violations${moderate ? ` (${moderate} moderate/minor noted)` : ""}`);
        await c.close();
      }
      await auditA11y("Landing (desktop)", { width: 1280, height: 900 });
      await auditA11y("Studio revealed (desktop)", { width: 1280, height: 900 }, true);
      await auditA11y("Landing (mobile)", { width: 390, height: 844 });
    }

    // ── 8) Aggregate: zero uncaught app errors across every flow ──────────
    section("No uncaught application errors across all flows");
    if (errors.length) errors.forEach((e) => console.log("    •", e));
    assert(errors.length === 0, `clean console/page across all flows (${errors.length} app error(s))`);
  } finally {
    await browser.close();
    if (server) server.close();
  }

  console.log("\n" + (failures ? `✗ ${failures} E2E check(s) failed` : "✓ all E2E checks passed"));
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error("E2E harness crashed:", err); process.exit(1); });
