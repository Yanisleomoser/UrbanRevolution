/**
 * Permanent regression guard for the STUDIO LIGHT (Atelier-Wow-Roadmap B2):
 * „Studio-Licht für den Blueprint" — die Bühne ist eine ausgeleuchtete
 * Aufnahme (Podest-Kegel, Bodenpool, Hohlkehle, Vignette), das Stück steht
 * auf einem zweistufigen Kontaktschatten, und der Flat ANTWORTET dem Licht
 * über einen vertikalen Bühnen-Stop aus der (spec, rough)-Optik.
 *
 * Warum es diesen Guard braucht — drei Dinge sind still zerbrechlich:
 *   1. Das Licht lebt in :root-Tokens, die Basis UND Cockpit teilen. Kippt
 *      die Custom-Property-Kaskade, verliert das Cockpit seinen starken
 *      Bodenpool — und damit verliert das Glas-Dock genau das, was es
 *      brechen soll (B5 wäre wieder ein No-Op, ohne dass irgendetwas bricht).
 *   2. Vor B2 war der Lichtpool auf ≤899px gescoped: die GRÖSSTE Bühne
 *      (Desktop) war komplett unbeleuchtet, und niemandem fiel es auf.
 *   3. Der Kontaktschatten war dunkel auf dunkel und praktisch unsichtbar —
 *      ohne Beleg „ist er da" heisst nicht „sieht man ihn".
 *
 *   node scripts/verify-stage-light.mjs        (bootet seinen eigenen Server)
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });

let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

// ── 1) Die Bühne ist auf JEDER Breite beleuchtet, und das Cockpit hebt den
// Pool an (das Glas-Dock liegt dort darauf) ────────────────────────────────
for (const vp of [{ name: "mobile", width: 390, height: 844, cockpit: true },
                  { name: "desktop", width: 1440, height: 900, cockpit: false }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-preview", { timeout: 20000 });
  console.log(`  — Bühnen-Licht @ ${vp.name} (${vp.width}px) —`);
  const s = await page.evaluate(() => {
    const pv = document.getElementById("de-preview");
    const cs = getComputedStyle(pv);
    return {
      bg: cs.backgroundImage,
      filter: cs.filter,
      backdrop: cs.backdropFilter || cs.webkitBackdropFilter || "none",
    };
  });
  // Der Kegel (Quelle über dem oberen Rand) und die Hohlkehle (Bodenebene)
  // sind die zwei Lagen, ohne die die Bühne wieder eine Fläche ist.
  check(/186,\s*192,\s*255/.test(s.bg), "der Podest-Kegel liegt auf der Bühne");
  check(/linear-gradient/.test(s.bg), "die Hohlkehle (Bodenebene) liegt auf der Bühne");
  check(/rgba\(4,\s*4,\s*7/.test(s.bg), "die Vignette liegt auf der Bühne");
  if (vp.cockpit) {
    check(/0\.34/.test(s.bg), "Cockpit: der Bodenpool ist angehoben — das Glas-Dock hat etwas zu brechen");
  } else {
    check(/0\.12/.test(s.bg), "Desktop: der ruhige Basis-Pool (kein zweiter Boden unter kurzen Stücken)");
  }
  // Budget: die Bühne repaintet pro Morph-Frame — ein Filter würde jeden
  // Frame kosten. B2 ist bewusst rein aus Verläufen gebaut.
  check(s.filter === "none", `kein filter auf der Bühne (${s.filter})`);
  check(s.backdrop === "none", `kein backdrop-filter auf der Bühne (${s.backdrop})`);
  check(errors.length === 0, `keine Page-Errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

// ── 2) Der Flat antwortet dem Licht — und der Schatten wandert mit ────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => !!window.GarmentSVG, { timeout: 20000 });
  console.log("  — der Flat antwortet dem Bühnen-Licht —");
  const r = await page.evaluate(() => {
    const build = (extra) => window.GarmentSVG.build("tshirt", {
      fit: 0.5, length: "regular", stops: ["#40506a"], scheme: "solid",
      material: "cotton", finish: 0.5, energy: 0.6, reveal: 1, ...extra,
    });
    const topStop = (s) => {
      const m = /<linearGradient id="[^"]*sl"[^>]*>\s*<stop offset="0"[^>]*stop-opacity="([\d.]+)"/.exec(s);
      return m ? parseFloat(m[1]) : null;
    };
    const dressAt = (length) => window.GarmentSVG.build("dress", {
      fit: 0.4, length, stops: ["#40506a"], scheme: "solid", material: "cotton",
      finish: 0.5, energy: 0.6, reveal: 1,
    });
    const groundCy = (s) => [...s.matchAll(/<ellipse class="gs-ground"[^>]*cy="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
    return {
      vertical: /<linearGradient id="[^"]*sl" x1="0" y1="0" x2="0" y2="1">/.test(build({})),
      silk: topStop(build({ material: "silk" })),
      fleece: topStop(build({ material: "fleece" })),
      groundCropped: groundCy(dressAt("cropped")),
      groundLong: groundCy(dressAt("long")),
      // Schwarz muss sich abheben: das Rim-Light ist der Strich, der ein
      // dunkles Stück überhaupt vom dunklen Hintergrund trennt.
      blackHasRim: /stroke="#dff1f4"/.test(build({ stops: ["#0d0d10"] })),
    };
  });
  check(r.vertical, "der Bühnen-Stop ist vertikal (die Richtung, aus der die Bühne leuchtet)");
  check(r.silk != null && r.fleece != null && r.silk > r.fleece,
    `Material antwortet unterschiedlich — Seide fängt härter als Fleece (${r.silk} > ${r.fleece})`);
  check(r.silk <= 0.24, `der Fang bleibt Key/Sheen untergeordnet (${r.silk} ≤ 0.24)`);
  check(r.groundCropped.length === 2 && r.groundLong.length === 2,
    `der Kontaktschatten ist zweistufig (Kern + Halbschatten): ${r.groundCropped.length} Ellipsen`);
  check(r.groundCropped[0] < r.groundLong[0],
    `der Schatten wandert mit dem Saum (mini ${r.groundCropped[0]} < maxi ${r.groundLong[0]})`);
  check(r.blackHasRim, "ein schwarzes Stück trägt das Rim-Light, das es vom Hintergrund löst");
  await page.close();
}

// ── 3) Bühnen-Overlays kollidieren nicht (Owner-iPhone 2026-07-25) ────────
// Drei Elemente teilen sich die Bühnenränder: die STILVORSCHAU-Marke, die
// Masse-Zeile und die Chip-Reihe — dazu der Registratur-Rahmen und, im Dock,
// die Fertig-Pille. Alle fünf sind absolut positioniert und kannten
// einander nicht: real überlappten Marke und Masse-Zeile um 17px, die
// Chip-Reihe lag auf den unteren Passermarken, und die Fertig-Pille lief aus
// dem Dock (abgeschnitten und halb untippbar).
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".de-describe-input", { timeout: 20000 });
  console.log("  — Bühnen-Overlays @ 390px —");
  // Masse setzen, damit die Masse-Zeile überhaupt erscheint.
  await page.evaluate(() => window.StateManager && window.StateManager.set("measurements",
    { height: 178, weight: 74, chest: 100, waist: 84, hips: 99, shoulder: 46, arm: 62, inseam: 82, neck: 38 }));
  await page.fill(".de-describe-input", "eine kastige kurze Jacke in Tiefrot, viele Taschen");
  await page.click(".de-describe-read");
  await page.waitForSelector(".de-understood-row", { timeout: 5000 });
  await page.click(".de-understood-apply");
  await page.waitForTimeout(1300);
  for (let i = 0; i < 10; i++) {
    const vis = await page.evaluate(() => { const f = document.getElementById("de-finish"); return f && !f.hidden; });
    if (vis) break;
    const c = await page.$("#de-body .de-card, #de-body .de-tot-panel, #de-body .de-confirm:not([disabled])");
    if (c) { await c.click(); await page.waitForTimeout(750); } else break;
  }
  const g = await page.evaluate(() => {
    const rect = (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
    const stage = rect(".de-preview-stage");
    const dock = rect(".de-ask-col");
    const fin = rect("#de-finish");
    const cap = rect("#de-body-caption");
    const badge = rect(".de-preview-badge");
    const chips = rect("#de-preview-chips");
    const over = (a, b) => (a && b)
      ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) > 0 &&
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 0
      : false;
    return {
      finishSeen: !!fin,
      finishInside: fin && dock ? (fin.right <= dock.right + 0.5 && fin.left >= dock.left - 0.5) : null,
      capSeen: !!cap,
      capHitsBadge: over(cap, badge),
      // Die unteren Passermarken sitzen 40px über dem Bühnenboden (::after-inset).
      chipsAboveMarks: chips && stage ? Math.round(stage.bottom - chips.bottom) > 40 : null,
      navOneLine: (() => {
        const navs = [...document.querySelectorAll(".de-controls .de-nav")].filter((n) => !n.hidden);
        // Eine Zeile: jedes Label passt in die Zeilenhöhe des höchsten Elements.
        const tops = navs.map((n) => n.getBoundingClientRect().top);
        return Math.max(...tops) - Math.min(...tops) < 14;
      })(),
      // NUR die Textlinks: .de-finish ist ebenfalls .de-nav, aber als Pille
      // mit Innenabstand naturgemäss höher — sie hier mitzumessen prüfte die
      // Polsterung, nicht den Umbruch.
      noWordWrap: [...document.querySelectorAll(".de-controls .de-nav:not(.de-finish)")]
        .every((n) => n.getBoundingClientRect().height < 22),
    };
  });
  check(g.finishSeen, "die Fertig-Pille ist auf einem reifen Screen sichtbar");
  check(g.finishInside === true, "die Fertig-Pille liegt VOLLSTÄNDIG im Dock (nicht abgeschnitten)");
  check(g.capSeen, "die Masse-Zeile erscheint, sobald Masse vorliegen");
  check(g.capHitsBadge === false, "Masse-Zeile und STILVORSCHAU-Marke überlappen nicht");
  check(g.chipsAboveMarks === true, "die Chip-Reihe liegt über den unteren Passermarken");
  check(g.navOneLine === true, "die Navigation steht auf EINER Zeile");
  check(g.noWordWrap === true, "kein Label bricht innerhalb des Wortes um");
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ studio light verified");
process.exit(failed ? 1 : 0);
