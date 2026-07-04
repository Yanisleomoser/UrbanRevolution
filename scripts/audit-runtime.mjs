/**
 * Laufzeit-Audit („Hausputz", headless): JEDE Seite der Site in Desktop- und
 * Mobil-Viewport plus die kritischen Deep-Link-Pfade — gesammelt werden
 * Page-Errors, console.error, fehlgeschlagene Requests (Status ≥ 400),
 * horizontaler Overflow und kaputte Bilder (naturalWidth 0). CDN-Ressourcen
 * laufen wie in den anderen Skripten über den Node-Router; externe Hosts, die
 * headless legitim fehlen (Vercel-Endpunkte, Formspree, Sentry, Analytics),
 * stehen auf einer Ignore-Liste, damit nur ECHTE Defekte melden.
 *
 *   node scripts/audit-runtime.mjs
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const PAGES = [
  { path: "/", name: "landing" },
  { path: "/#design", name: "studio-deeplink", waitFor: "#de-body .de-question" },
  { path: "/impressum.html", name: "impressum" },
  { path: "/datenschutz.html", name: "datenschutz" },
  { path: "/404.html", name: "not-found" },
  { path: "/insights.html", name: "insights" },
  { path: "/gallery/", name: "gallery" },
];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
// Headless/lokal legitim abwesend — kein Defekt der Site.
const IGNORE_URL = /_vercel|formspree|sentry|vercel-insights|va\.vercel|browser\.sentry-cdn|api\/gallery|api\/track|api\/waitlist/;

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let findings = 0;

for (const vp of VIEWPORTS) {
  for (const pg of PAGES) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await routeCdnThroughNode(page);
    const errs = [], consoleErrs = [], badReq = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      // Ressourcen-Fehler tragen ihre URL nur in location() — ohne sie ist
      // jeder Eintrag unzuordenbar UND ungefiltert (lokal legitime /api/*-
      // 404s würden als Defekt rauschen).
      const src = (m.location() && m.location().url) || "";
      if (IGNORE_URL.test(src)) return;
      consoleErrs.push(`${m.text().slice(0, 140)}${src ? `  ← ${src.replace(base, "")}` : ""}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400 && !IGNORE_URL.test(r.url())) badReq.push(`${r.status()} ${r.url().replace(base, "")}`);
    });
    page.on("requestfailed", (r) => {
      if (!IGNORE_URL.test(r.url())) badReq.push(`FAILED(${(r.failure() || {}).errorText}) ${r.url().replace(base, "").slice(0, 120)}`);
    });
    try {
      await page.goto(base + pg.path, { waitUntil: "load", timeout: 30000 });
      if (pg.waitFor) await page.waitForSelector(pg.waitFor, { timeout: 20000 });
      await page.waitForTimeout(1800);
      const dom = await page.evaluate(() => ({
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        brokenImgs: [...document.images]
          .filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:"))
          .map((i) => `src="${i.getAttribute("src")}" (id=${i.id || "—"}, class=${i.className || "—"})`).slice(0, 6),
      }));
      const label = `${pg.name} @ ${vp.name}`;
      const report = (kind, list) => { if (list.length) { findings += list.length; console.log(`  ✗ ${label} — ${kind}:`); [...new Set(list)].slice(0, 6).forEach((x) => console.log(`      ${x}`)); } };
      report("pageerror", errs);
      report("console.error", consoleErrs.filter((c) => !IGNORE_URL.test(c)));
      report("HTTP ≥ 400", badReq);
      if (dom.overflowX > 1) { findings++; console.log(`  ✗ ${label} — horizontaler Overflow: ${dom.overflowX}px`); }
      report("kaputte Bilder", dom.brokenImgs);
      if (!errs.length && !badReq.length && dom.overflowX <= 1 && !dom.brokenImgs.length && !consoleErrs.filter((c) => !IGNORE_URL.test(c)).length) {
        console.log(`  ✓ ${label}`);
      }
    } catch (e) {
      findings++;
      console.log(`  ✗ ${pg.name} @ ${vp.name} — Navigations-/Warte-Fehler: ${String(e).slice(0, 160)}`);
    }
    await page.close();
  }
}

await browser.close();
server.close();
console.log(`\n${findings ? `✗ ${findings} Laufzeit-Fund(e)` : "✓ Laufzeit sauber (alle Seiten, beide Viewports)"}`);
process.exit(findings ? 1 : 0);
