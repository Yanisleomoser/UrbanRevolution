/* Permanenter Verify-Check: Ownership-Reservieren-Karte („Sei zuerst dran",
   docs/WEBSITE-IMPROVEMENTS.md #02).
   - setzt einen echten Entwurf (kuratierte DNA) in den StateManager
   - prüft Reveal, Flat-Miniatur, Validierung (leer → Fehler) und den
     Erfolgs-Pfad gegen einen gemockten Formspree (Payload enthält die DNA)
   - Screenshots Desktop 1440 + Mobil 390 (≤480-Regel) → screenshots/
   Run: node scripts/verify-reserve.mjs   (bootet eigenen Static-Server;
   BASE=http://localhost:8080/ nutzt stattdessen einen laufenden Server) */
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "node:fs";
import { routeCdnThroughNode } from "./cdn-route.mjs";
import { startServer } from "./static-server.mjs";

const ownServer = process.env.BASE ? null : await startServer();
const BASE = process.env.BASE || `http://127.0.0.1:${ownServer.address().port}/`;
const curated = JSON.parse(readFileSync("js/design-engine/content/gallery-curated.json", "utf8"));
const dnaStr = curated.items[0].d;
mkdirSync("screenshots", { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;
const check = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ FAIL: ") + msg); if (!cond) failures++; };

for (const vp of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await routeCdnThroughNode(page);
  // #design-Deep-Link: klappt das Studio (den #ownership-Wrapper) sofort auf.
  await page.goto(BASE + "#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.StateManager && window.DesignShare && window.DesignPreview && window.I18N, null, { timeout: 15000 });

  // Formspree mocken, BEVOR irgendetwas submitten kann.
  await page.evaluate(() => {
    const orig = window.fetch;
    window.__formspreeBody = null;
    window.fetch = (url, opts) => {
      if (String(url).includes("formspree.io")) {
        window.__formspreeBody = opts && opts.body;
        return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      return orig(url, opts);
    };
  });

  // Entwurf setzen → Ownership-Moment enthüllt sich.
  await page.evaluate((d) => {
    const dna = window.DesignShare.decode(d);
    window.StateManager.set("currentDesign", {
      name: "Tide Runner", description: "verify", color: "#2FAE9E",
      material: "cotton", fit: "regular", tags: [], constructionNotes: [], dna,
    });
  }, dnaStr);
  await page.waitForSelector("#ownership:not([hidden])", { timeout: 5000 });
  const card = page.locator(".own-reserve");
  // Zentriert scrollen — Playwrights Minimal-Scroll legt das Ziel sonst an die
  // Viewport-Oberkante unter die fixe Navbar (reines Test-Artefakt).
  await page.evaluate(() => document.querySelector(".own-reserve").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(900); // data-reveal Entrance

  check(await card.isVisible(), `${vp.name}: Karte sichtbar`);
  check(await page.locator("#reserve-flat svg").count() > 0, `${vp.name}: Flat-Miniatur gerendert`);
  check(!(await page.locator("#reserve-flat").isHidden()), `${vp.name}: Flat nicht hidden`);

  // Validierung: leer absenden → Fehlertext + aria-invalid auf dem Feld.
  await page.locator("#reserve-form button[type=submit]").click();
  await page.waitForTimeout(150);
  const errText = await page.locator("#reserve-status").textContent();
  check(errText && errText.length > 4, `${vp.name}: Leer-Submit zeigt Fehler ("${errText}")`);
  check((await page.locator("#reserve-email").getAttribute("aria-invalid")) === "true", `${vp.name}: aria-invalid gesetzt`);
  await page.screenshot({ path: `screenshots/reserve-${vp.name}-error.png` });

  // Erfolgs-Pfad: E-Mail + Consent → own.reserve_ok, Payload trägt die DNA.
  await page.fill("#reserve-email", "test@example.ch");
  await page.check("#reserve-consent");
  await page.locator("#reserve-form button[type=submit]").click();
  await page.waitForTimeout(400);
  const okText = await page.locator("#reserve-status").textContent();
  const okExpected = await page.evaluate(() => window.I18N.t("own.reserve_ok"));
  check(okText === okExpected, `${vp.name}: Erfolgstext ("${okText}")`);
  const body = await page.evaluate(() => window.__formspreeBody);
  const payload = body ? JSON.parse(body) : {};
  check(payload.email === "test@example.ch", `${vp.name}: Payload email`);
  check(typeof payload.design === "string" && payload.design.length > 50, `${vp.name}: Payload trägt DNA (${(payload.design || "").length} Zeichen)`);
  check(typeof payload.designUrl === "string" && payload.designUrl.includes("#dna="), `${vp.name}: Payload trägt Share-URL`);
  check(payload.designName === "Tide Runner", `${vp.name}: Payload designName`);

  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = await card.boundingBox();
  await page.screenshot({ path: `screenshots/reserve-${vp.name}.png`, clip: box ? { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: Math.min(vp.width, box.width + 24), height: box.height + 24 } : undefined });

  // Unteres Join-Formular unberührt: Submit-Event leer → eigener Fehlertext.
  // (Das Formular lebt im Community-Overlay und ist ohne CTA nicht sichtbar —
  // der Handler lässt sich aber direkt über das Event prüfen.)
  await page.evaluate(() => {
    document.querySelector("#join-form").dispatchEvent(new Event("submit", { cancelable: true }));
  });
  await page.waitForTimeout(150);
  const joinErr = await page.locator("#join-status").textContent();
  check(joinErr && joinErr.length > 4, `${vp.name}: #join-form validiert weiter ("${joinErr}")`);

  // /api/* läuft nur auf Vercel (Edge Functions) — auf dem Static-Server sind
  // 404/501 dafür erwartete Umgebungs-Artefakte, ebenso deren generische
  // "Failed to load resource"-Konsolen-Spiegel.
  const realErrors = errors.filter((e) =>
    !/favicon|_vercel|speed-insights|sentry|via\.placeholder|\/api\/|Failed to load resource/i.test(e));
  check(realErrors.length === 0, `${vp.name}: keine Console-/Page-Errors${realErrors.length ? " — " + realErrors.join(" | ") : ""}`);
  await page.close();
}
await browser.close();
if (ownServer) ownServer.close();
console.log(failures ? `\n✗ ${failures} failure(s)` : "\n✓ Reserve-Karte verifiziert");
process.exit(failures ? 1 : 0);
