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
import { walkJourney } from "./journey-walk.mjs";

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
    const c = await page.$("#de-body .de-card, #de-body .de-tot-panel, #de-body .de-gallery-skip, #de-body .de-confirm:not([disabled])");
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
      // Saum-Reserve (Owner-Brief 2026-07-25: „Pillen quer über dem Rock"):
      // die Registratur-Zeile hat einen EIGENEN Boden. Gemessen wird gegen
      // die Content-Box der Bühne — genau dort endet das gezeichnete Flat
      // (padding-bottom verkleinert das object-fit:contain-SVG mit).
      // Nach unten darf sie ebenso wenig unters Glas-Dock rutschen.
      chipsClearOfFlat: (() => {
        const prev = document.querySelector("#de-preview");
        if (!prev || !chips) return null;
        const r = prev.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(prev).paddingBottom) || 0;
        return Math.round(chips.top - (r.bottom - pad)) >= 0;
      })(),
      chipsAboveDock: chips && dock ? Math.round(dock.top - chips.bottom) >= 0 : null,
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
  check(g.chipsClearOfFlat === true, "die Chip-Reihe hat eigenen Boden — sie schneidet nicht in den Saum");
  check(g.chipsAboveDock === true, "die Chip-Reihe verschwindet nicht unter dem Glas-Dock");
  check(g.navOneLine === true, "die Navigation steht auf EINER Zeile");
  check(g.noWordWrap === true, "kein Label bricht innerhalb des Wortes um");
  await page.close();
}

// ── 4) EIN Rahmen, ZWEI Flächen — und [hidden] bleibt hidden (Touch!) ─────
// Der Owner sah auf dem iPhone drei verschachtelte Kästen mit sich
// kreuzenden Linien; ausserdem eine „Fertig"-Pille auf dem ERSTEN Screen,
// wo die Reise noch gar nicht reif ist. Ursache 2 war die alte
// [hidden]-Falle: `html.is-touch .de-nav { display:inline-flex }` überstieg
// das UA-`[hidden]{display:none}` — sichtbar NUR auf Touch-Geräten,
// deshalb headless nie aufgefallen. Dieser Block läuft daher mit
// hasTouch/isMobile, sonst prüft er die falsche Welt.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE", hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await routeCdnThroughNode(page);
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-preview", { timeout: 20000 });
  console.log("  — EIN Rahmen, ZWEI Flächen @ Touch —");
  const g = await page.evaluate(() => {
    const R = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { l: b.left, r: b.right, t: b.top, b2: b.bottom, border: parseFloat(cs.borderTopWidth) }; };
    const frame = R(".design-journey"), stage = R("#de-preview"), dock = R(".de-ask-col");
    const fin = document.getElementById("de-finish");
    return {
      isTouch: document.documentElement.classList.contains("is-touch"),
      // Die zwei Flächen füllen den EINEN Rahmen randlos.
      stageFillsX: Math.abs(stage.l - frame.l) <= 1.5 && Math.abs(stage.r - frame.r) <= 1.5,
      dockFillsX: Math.abs(dock.l - frame.l) <= 1.5 && Math.abs(dock.r - frame.r) <= 1.5,
      stageAtTop: Math.abs(stage.t - frame.t) <= 2,
      dockAtBottom: Math.abs(dock.b2 - frame.b2) <= 2,
      // Nur der äussere Rahmen zeichnet noch eine Kontur.
      innerBorders: stage.border + dock.border,
      marks: getComputedStyle(document.querySelector(".de-preview-stage"), "::after").content,
      // Und: eine verborgene Steuerung wird NICHT gemalt.
      finishHiddenAttr: fin ? fin.hidden : null,
      finishPainted: fin ? fin.getBoundingClientRect().width > 0 : null,
    };
  });
  check(g.isTouch === true, "der Touch-Pfad ist aktiv (sonst prüft dieser Block die falsche Welt)");
  check(g.stageFillsX && g.dockFillsX, "beide Flächen füllen den Rahmen randlos (keine verschachtelten Kästen)");
  check(g.stageAtTop && g.dockAtBottom, "die Bühne sitzt am Rahmen-Oberrand, das Dock am Unterrand");
  check(g.innerBorders === 0, `nur der äussere Rahmen trägt eine Kontur (innen ${g.innerBorders}px)`);
  check(g.marks === "none", "keine Passermarken mehr (der vierte Kantensatz ist weg)");
  check(g.finishHiddenAttr === true && g.finishPainted === false,
    "REGRESSION GUARD: eine [hidden]-Steuerung wird auf Touch NICHT gemalt");
  await page.close();
  await ctx.close();
}

// ── 5) EINE Kante, EINE Bedeutung pro Farbe (Owner-Brief 2026-07-25) ──────
// „Zu viele Kästen, zu viele Linien": jede Option war doppelt gerahmt (Karte
// + Bild), und der Marken-Verlauf lag gleichzeitig auf Confirm, Fertig-Pille
// und Segment-Tab — drei „Haupt"-Aktionen auf einem Screen heissen: keine.
// Der Vertrag: das BILD ist die Karte (die Karte selbst zeichnet nichts),
// gewählt spricht GRÜN, und unter den Bedienelementen trägt genau EINES den
// Marken-Verlauf. (Die 2px-Verbinder des Steppers sind kein Bedienelement —
// sie zeigen den zurückgelegten Weg und zählen deshalb nicht mit.)
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
  console.log("  — EINE Kante, EINE Bedeutung pro Farbe —");
  const CENSUS = `(() => {
    const BRAND = ["106, 113, 214", "18, 163, 122", "126, 220, 46"];
    const wears = (e) => { const bg = getComputedStyle(e).backgroundImage || ""; return BRAND.every((s) => bg.includes(s)); };
    // ALLE sichtbaren Elemente, nicht nur Bedienelemente: seit die
    // Stepper-Segmente entfallen sind (Owner-Brief 2026-07-26) trägt im
    // ganzen Studio genau EINE Fläche den Marken-Verlauf. Die frühere
    // Einschränkung auf Klickbares war eine Ausrede für die vier
    // Verlaufsbalken im Fortschrittsregler.
    return [...document.querySelectorAll("#engine-host, #engine-host *")]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .filter(wears).map((e) => e.id || e.className);
  })()`;
  // Bis zu einem Screen mit echten Wahl-Karten laufen (der Auftakt ist Text).
  for (let i = 0; i < 6; i++) {
    if (await page.$("#de-body .de-card")) break;
    if (await page.$(".de-describe")) await page.click(".de-describe-skip");
    else if (await page.$(".de-tot")) await page.click(".de-tot .de-tot-panel:first-child");
    else break;
    await page.waitForTimeout(700);
  }
  const g = await page.evaluate(`(() => {
    const card = document.querySelector("#de-body .de-card");
    const cs = card ? getComputedStyle(card) : null;
    const vis = card ? card.querySelector(".de-visual") : null;
    return {
      cardSeen: !!card,
      cardDrawsNothing: cs
        ? cs.backgroundImage === "none" &&
          (cs.backgroundColor === "rgba(0, 0, 0, 0)" || cs.backgroundColor === "transparent") &&
          (cs.borderTopColor === "rgba(0, 0, 0, 0)" || cs.borderTopStyle === "none")
        : null,
      visualRounded: vis ? parseFloat(getComputedStyle(vis).borderTopLeftRadius) >= 8 : null,
    };
  })()`);
  check(g.cardSeen === true, "ein Karten-Screen wurde erreicht (sonst prüft dieser Block nichts)");
  check(g.cardDrawsNothing === true, "die Karte zeichnet selbst nichts mehr — das Bild IST die Karte");
  check(g.visualRounded === true, "das Bild trägt den Radius der Karte");

  // Weiter bis zu einem Screen, der eine SICHTBARE Bestätigung trägt — auf
  // einem Karten-Screen ist keine da, und eine Zählung ohne Kandidaten
  // bestätigt nichts (sie war zuerst mit „0 von höchstens 1" grün).
  let conf = null;
  for (let i = 0; i < 12; i++) {
    conf = await page.$("#de-body .de-confirm");
    if (conf && await conf.isVisible()) break;
    conf = null;
    const c = await page.$("#de-body .de-card, #de-body .de-tot-panel, #de-body .de-gallery-skip");
    if (!c) break;
    await c.click();
    await page.waitForTimeout(800);
  }
  const census = await page.evaluate(CENSUS);
  const finishGreen = await page.evaluate(`(() => {
    const f = document.getElementById("de-finish");
    if (!f) return null;
    const cs = getComputedStyle(f);
    return cs.backgroundImage === "none" && cs.color === "rgb(126, 220, 46)";
  })()`);
  check(!!conf, "ein Screen mit sichtbarer Bestätigung wurde erreicht (sonst zählt die Zählung nichts)");
  check(census.length === 1,
    `genau EINE Fläche im ganzen Studio trägt den Marken-Verlauf (${census.length}: ${census.join(", ") || "—"})`);
  // Der Fortschrittsregler: Kapitel-Index statt Punktekette, und der Füllstand
  // hängt am Phasen-Buchstaben (adaptive Reise — eine Prozentzahl wäre ein
  // Versprechen, das sie nicht halten kann).
  const step = await page.evaluate(`(() => {
    const st = document.querySelector(".de-stepper");
    if (!st) return null;
    const fill = st.querySelector(".de-step-fill");
    const rail = st.querySelector(".de-step-rail");
    const steps = [...st.querySelectorAll(".de-step")];
    const cs = fill ? getComputedStyle(fill) : null;
    return {
      steps: steps.length,
      dots: st.querySelectorAll(".de-step-dot, .de-step-bar").length,
      hasRail: !!rail && !!fill,
      atClass: fill ? (fill.className.match(/is-at-([a-e])/) || [])[1] || null : null,
      // Fortschritt spricht TEAL, damit er nicht mit dem Wahl-Grün kollidiert
      fillColor: cs ? cs.backgroundColor : null,
      // Die Schiene endet auf einer Spaltenkante, nicht irgendwo dazwischen
      pct: (fill && rail) ? Math.round(fill.getBoundingClientRect().width / rail.getBoundingClientRect().width * 100) : null,
      oneLine: steps.length ? Math.max(...steps.map((s) => s.getBoundingClientRect().top)) - Math.min(...steps.map((s) => s.getBoundingClientRect().top)) < 4 : null,
      inFrame: steps.length ? steps[steps.length - 1].getBoundingClientRect().right <= st.getBoundingClientRect().right + 0.5 : null,
    };
  })()`);
  check(step && step.steps === 5, `der Index nennt alle fünf Kapitel (${step && step.steps})`);
  check(step && step.dots === 0, "kein Punkt- und kein Segment-Ornament mehr");
  check(step && step.hasRail === true, "EINE Schiene trägt den Fortschritt");
  check(step && step.pct !== null && step.pct % 20 === 0,
    `die Schiene endet auf einer Kapitel-Kante (${step && step.pct}%)`);
  check(step && step.fillColor === "rgb(20, 184, 133)",
    `Fortschritt spricht Teal, nicht das Wahl-Grün (${step && step.fillColor})`);
  check(step && step.oneLine === true, "die fünf Kapitel stehen auf EINER Zeile");
  check(step && step.inFrame === true, "das letzte Kapitel bleibt im Rahmen");
  check(finishGreen !== false, "Fertig spricht durch Farbe statt durch eine zweite Verlaufs-Pille");
  await page.close();
}

// ── 6) B3 · Material-Realität: die Bühne nimmt den Stoff an ───────────────
// Die Makro-Aufnahme hängt als BAHN an der Rückwand — sie darf die Bühne
// nicht ersetzen. Konkret: sie liegt hinter dem Flat, stirbt vor dem Boden
// (sonst steht das Stück wieder auf nichts — B2s teuerste Lektion), und
// Kegel/Hohlkehle/Vignette malen weiter darüber. Zwei Wege führen hin:
// Zeigen (Zeiger-Geräte) und Wählen (Touch — dort gibt es keinen Hover, und
// die Karte committet sofort; ohne diesen Weg wäre der Moment auf dem
// wichtigsten Gerät gar nicht vorhanden).
// Geteilter Walker (scripts/journey-walk.mjs): dieser Guard braucht keine
// eigene Geste — er will nur bis zu den Stoffkarten.
const fabricScreen = (page) => walkJourney(page, {
  until: (p) => p.$("#de-body .de-card .de-visual-img"),
});

const WALL = `(() => {
  const p = document.querySelector("#de-preview");
  const w = getComputedStyle(p, "::before");
  const s = getComputedStyle(p);
  // B3b · dieselbe Geste füllt auch die Silhouette. Die Schicht ist ein
  // <pattern id="…cl"> im Flat; "cl" ist unter allen Suffixen eindeutig.
  const cl = p.querySelector('svg pattern[id$="cl"]');
  const clImg = cl && cl.querySelector("image");
  const clPath = p.querySelector('svg .gs-int path[style*="mix-blend-mode"]');
  const all = Array.from(document.querySelectorAll('pattern[id$="cl"]'));
  return {
    on: parseFloat(w.opacity) || 0,
    img: w.backgroundImage || "",
    z: w.zIndex,
    cloth: !!cl,
    clothHref: (clImg && (clImg.getAttribute("href") || clImg.getAttribute("xlink:href"))) || "",
    clothBlend: clPath ? getComputedStyle(clPath).mixBlendMode : "",
    clothOp: clPath ? parseFloat(clPath.getAttribute("opacity")) : NaN,
    // Vergleichswert: die synthetische Webung an derselben Stelle. Der echte
    // Stoff muss ihr UNTERGEORDNET bleiben, sonst wird die Zeichnung zum Foto.
    grainOp: (() => {
      const g = p.querySelector('svg .gs-int path[fill^="url("]:not([style])');
      return g ? parseFloat(g.getAttribute("opacity")) : NaN;
    })(),
    // Kacheln, Galerie, Sphäre: der Flat ist dort ein Symbol, kein Stück.
    strayCloth: all.filter((n) => !n.closest("#de-preview") && !n.closest(".de-dock-flat")).length,
    // Die Bahn muss vor dem Boden sterben — sonst löscht sie die Hohlkehle.
    mask: (w.maskImage && w.maskImage !== "none" ? w.maskImage : w.webkitMaskImage) || "",
    // Bühnenlicht malt WEITER (die Bahn ersetzt das Atelier nicht).
    stageBg: s.backgroundImage || "",
    filter: s.filter,
    backdrop: s.backdropFilter || s.webkitBackdropFilter,
  };
})()`;
{
  console.log("  — B3 · die Bühne nimmt den Stoff an —");
  // (a) Zeiger-Gerät: zeigen blendet ein, weggehen blendet aus.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  await routeCdnThroughNode(page);
  await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
  const reached = await fabricScreen(page);
  check(!!reached, "der Stoff-Moment wurde erreicht (sonst prüft dieser Block nichts)");
  await page.mouse.move(4, 4);
  await page.waitForTimeout(450);
  const off = await page.evaluate(WALL);
  const cards = await page.$$("#de-body .de-card");
  if (!cards.length) { console.log("  (kein Karten-Screen — Rest von Block 6 übersprungen)"); await page.close(); }
  else {
  await cards[0].hover();
  await page.waitForTimeout(450);
  const on = await page.evaluate(WALL);
  check(off.on === 0, `ohne Zeiger keine Bahn (${off.on})`);
  check(on.on > 0.1 && on.on < 0.45, `beim Zeigen hängt die Bahn — sichtbar, aber untergeordnet (${on.on})`);
  check(/material\//.test(on.img), "die Bahn trägt die Makro-Aufnahme des Materials");
  check(on.z === "-1", `die Bahn liegt HINTER dem Stück (z-index ${on.z})`);
  check(/transparent|rgba\(0, 0, 0, 0\)/.test(on.mask),
    "die Bahn stirbt vor dem Boden (die Hohlkehle bleibt bestehen)");
  check(/radial-gradient/.test(on.stageBg) && /linear-gradient/.test(on.stageBg),
    "Kegel und Hohlkehle malen weiter — die Bahn ersetzt das Atelier nicht");
  check(on.filter === "none" && (on.backdrop === "none" || !on.backdrop),
    `kein filter/backdrop-filter für die Bahn (${on.filter} / ${on.backdrop})`);
  // B3b · und der Stoff schimmert DURCH die Silhouette (Owner 2026-07-26).
  check(off.cloth === false, "ohne Geste ist der Flat reine Zeichnung (keine Stoffschicht)");
  check(on.cloth === true, "beim Zeigen füllt der Stoff auch die Silhouette");
  check(/^\/js\/design-engine\/content\/img\/material\/[a-z0-9-]+\.(?:jpg|webp|png)$/.test(on.clothHref),
    `die Schicht zieht ein eigenes, relatives Bild (${on.clothHref})`);
  check(on.clothBlend === "soft-light", `die Schicht mischt weich, sie überklebt nicht (${on.clothBlend})`);
  check(on.clothOp > 0 && on.clothOp <= 0.25 && on.clothOp < on.grainOp,
    `der Stoff bleibt der Zeichnung untergeordnet (${on.clothOp} gegen Webung ${on.grainOp})`);
  check(on.strayCloth === 0, `nur die grosse Bühne trägt den Stoff (${on.strayCloth} fremde Vorkommen)`);
  // Eine Karte OHNE Foto darf nichts auslösen.
  await page.mouse.move(4, 4);
  await page.waitForTimeout(400);
  const backAway = await page.evaluate(WALL);
  check(backAway.on === 0, `der Zeiger nimmt die Bahn wieder mit (${backAway.on})`);
  check(backAway.cloth === false, "und die Silhouette ist wieder reine Zeichnung");
  await page.close();
  }

  // (b) Touch: kein Hover — der Moment hängt am Wählen.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE", hasTouch: true, isMobile: true });
  const tp = await ctx.newPage();
  await routeCdnThroughNode(tp);
  await tp.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await tp.waitForSelector("#de-body .de-question", { timeout: 20000 });
  const reached2 = await fabricScreen(tp);
  check(!!reached2, "Touch: der Stoff-Moment wurde erreicht");
  const tCards = await tp.$$("#de-body .de-card");
  check(tCards.length > 0, "Touch: Stoff-Karten sind da");
  if (tCards.length) {
  await tCards[0].click();
  await tp.waitForTimeout(280);
  const tOn = await tp.evaluate(WALL);
  check(tOn.on > 0.1, `Touch: das Wählen bringt die Bahn (${tOn.on}) — ohne Hover gäbe es den Moment sonst nicht`);
  check(tOn.cloth === true, "Touch: und der Stoff schimmert durch die Silhouette");
  await tp.waitForTimeout(1900);
  const tOff = await tp.evaluate(WALL);
  check(tOff.on === 0, `Touch: die Bahn zieht sich danach zurück (${tOff.on})`);
  check(tOff.cloth === false, "Touch: die Silhouette ist danach wieder reine Zeichnung");
  }
  await tp.close();
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ studio light verified");
process.exit(failed ? 1 : 0);
