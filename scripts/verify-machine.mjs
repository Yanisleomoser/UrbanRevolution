/**
 * Maschinen-Verifikation (#machine, js/machine.js): belegt die BEWEGUNG der
 * Ingenieur-Simulation (Item-Fluss, Status-Zyklus der Remake-Zelle, Kamera-
 * Zoom) als Kurven über die Zeit — nicht als Standbilder —, den Reduced-
 * Motion-Ruhezustand (vollständiges, ehrliches Standbild) und die Studio-
 * Brücke (StateManager-Entwurf → Datei-Nummer in Zelle/Schiene/Caption).
 *
 *   node scripts/verify-machine.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const OUT = "screenshots/verify-machine";
mkdirSync(OUT, { recursive: true });

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => {
  console.log((cond ? "  ✓ " : "  ✗ ") + msg);
  if (!cond) failed++;
};

// ── 1. Volle Bewegung: Boot, Item-Fluss, Status-Zyklus, Kamera ─────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/#machine", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.getElementById("machine")?.scrollIntoView({ block: "start" }));

  console.log("— full motion: boot + item flow + cell cycle —");
  const boot = await page.evaluate(() => ({
    svg: !!document.getElementById("mSvg"),
    cards: document.querySelectorAll("button.lp-m-st").length,
    rails: document.querySelectorAll("#mSvg .m-rail").length,
  }));
  check(boot.svg, "#mSvg is present");
  check(boot.cards === 4, `4 station cards render (found ${boot.cards})`);
  check(boot.rails >= 5, `rails present (${boot.rails})`);

  // Status + Items über ~36 s samplen (Boot-Delay 3 s + ZWEI volle Demo-
  // Zyklen: SCHNITT → NAHT → FERTIGSTELLUNG → ETIKETT → SCHIENE — die Linie
  // muss den GANZEN Prozess auch ohne Studio-Datei zeigen, und die Stücke
  // müssen sich in Typ UND Farbe unterscheiden)
  const trace = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 72; i++) {
      const vis = Array.from(document.querySelectorAll("#mItems g"))
        .filter((g) => parseFloat(g.getAttribute("opacity") || "0") > 0.05).length;
      const demoHung = [0, 1, 2, 3].filter((k) => {
        const p = document.querySelector("#mHang" + k + " .hang-line");
        return p && parseFloat(getComputedStyle(p).opacity) > 0.5;
      }).length;
      out.push({
        t: i * 500,
        status: document.getElementById("mStatus")?.textContent || "",
        items: vis,
        chip: getComputedStyle(document.getElementById("mChipG")).opacity,
        demoHung: demoHung,
        sewing: document.getElementById("mSewNeedle")?.classList.contains("sewing") || false,
      });
      await new Promise((r) => setTimeout(r, 500));
    }
    return out;
  });
  const statuses = [...new Set(trace.map((s) => s.status))];
  const maxItems = Math.max(...trace.map((s) => s.items));
  const chipShown = trace.some((s) => parseFloat(s.chip) > 0.5);
  console.log("    statuses seen:", JSON.stringify(statuses));
  console.log("    max concurrent items:", maxItems, "| chip shown:", chipShown);
  check(maxItems >= 2, "items flow on the belt (≥2 concurrently)");
  check(trace.some((s) => /SCHNITT|CUTTING/.test(s.status)), "the cell actually cuts");
  check(trace.some((s) => /NAHT|SEAM/.test(s.status)) && trace.some((s) => s.sewing), "the cell sews (demo mode, needle animating)");
  check(trace.some((s) => /FERTIGSTELLUNG|FINISHING/.test(s.status)), "the cell finishes the piece");
  check(trace.some((s) => /SCHIENE|RAIL/.test(s.status)), "the piece reaches the rail");
  check(Math.max(...trace.map((s) => s.demoHung)) >= 3, "a demo piece lands on an anonymous hanger (beyond the 2 defaults)");
  check(chipShown, "the NIR analysis chip appears during a scan");

  // Vielfalt: die gefertigten Stücke unterscheiden sich in Silhouette UND Farbe
  const rail = await page.evaluate(() => {
    return [0, 1, 2, 3].map((k) => {
      const g = document.getElementById("mHang" + k);
      const line = g.querySelector(".hang-line");
      const fill = g.querySelector(".hang-fill");
      return parseFloat(getComputedStyle(line).opacity) > 0.5
        ? { d: line.getAttribute("d"), fill: fill.getAttribute("fill") }
        : null;
    }).filter(Boolean);
  });
  const shapes = new Set(rail.map((r) => r.d)).size;
  const colours = new Set(rail.map((r) => r.fill)).size;
  console.log(`    rail: ${rail.length} pieces, ${shapes} distinct shapes, ${colours} distinct colours`);
  check(rail.length >= 3, `≥3 pieces hang on the rail (${rail.length})`);
  check(shapes >= 2, `pieces differ in silhouette (${shapes} shapes)`);
  check(colours >= 2, `pieces differ in colour (${colours} colours)`);

  // Kamera: Stations-Karte klicken → viewBox zoomt, Stempel erscheint
  const vb0 = await page.evaluate(() => document.getElementById("mSvg").getAttribute("viewBox"));
  await page.click('button.lp-m-st[data-cam="3"]');
  const cam = await page.evaluate(async () => {
    const svg = document.getElementById("mSvg");
    const seen = [];
    for (let i = 0; i < 12; i++) {
      seen.push(svg.getAttribute("viewBox"));
      await new Promise((r) => setTimeout(r, 100));
    }
    return {
      seen: [...new Set(seen)].length,
      end: svg.getAttribute("viewBox"),
      zoomed: document.querySelector(".lp-machine-band")?.classList.contains("zoomed"),
      pressed: document.querySelector('button.lp-m-st[data-cam="3"]')?.getAttribute("aria-pressed"),
      stamp: getComputedStyle(document.getElementById("mStampOverlay")).opacity,
    };
  });
  check(cam.end !== vb0, `camera zooms on station click (${vb0} → ${cam.end})`);
  check(cam.seen >= 4, `zoom is animated, not a jump (${cam.seen} distinct frames)`);
  check(cam.zoomed === true, "band gets .zoomed");
  check(cam.pressed === "true", "card aria-pressed reflects the zoom");
  check(parseFloat(cam.stamp) > 0.5, "SIMULATION stamp overlays the zoomed view");
  await page.screenshot({ path: `${OUT}/machine-zoom-desktop.png` });

  check(errors.length === 0, `no page errors (${errors.join("; ") || "none"})`);
  await page.close();
}

// ── 2. Reduced motion: vollständiges Standbild + sofortige Studio-Brücke ───
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/#machine", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1800);

  console.log("— reduced motion: honest static frame + studio bridge —");
  const rm = await page.evaluate(() => ({
    items: Array.from(document.querySelectorAll("#mItems g"))
      .filter((g) => parseFloat(g.getAttribute("opacity") || "0") > 0.5).length,
    chip: getComputedStyle(document.getElementById("mChipG")).opacity,
    chipText: document.getElementById("mChipT")?.textContent || "",
    status: document.getElementById("mStatus")?.textContent || "",
    anims: document.getElementById("mSvg").getAnimations({ subtree: true }).length,
    cellPiece: parseFloat(getComputedStyle(document.getElementById("mGarFill")).opacity),
    demoHung: [0, 1, 2, 3].filter((k) => {
      const p = document.querySelector("#mHang" + k + " .hang-line");
      return p && parseFloat(getComputedStyle(p).opacity) > 0.5;
    }).length,
    yours: parseFloat(getComputedStyle(document.getElementById("mHangGar")).opacity),
  }));
  check(rm.items === 3, `static frame paints 3 items (${rm.items})`);
  check(parseFloat(rm.chip) > 0.5 && rm.chipText.length > 4, "chip visible with analysis text");
  check(/EINS NACH DEM ANDEREN|ONE AT A TIME/.test(rm.status), `status carries the line's principle (${rm.status})`);
  check(rm.cellPiece === 1, "static frame shows a finished piece in the cell (whole process)");
  check(rm.demoHung === 2, `two demo pieces rest on the rail (${rm.demoHung})`);
  check(rm.yours === 0, "the DEINS hanger stays reserved until a design exists");
  check(rm.anims === 0, `no running animations under reduced motion (${rm.anims})`);
  await page.screenshot({ path: `${OUT}/machine-reduced-mobile.png` });

  // Studio-Brücke: Entwurf setzen → Datei erscheint sofort (RM-Pfad).
  // Lesen erst NACH einem Frame: der globale Reduced-Motion-Reset gibt allen
  // Elementen transition:all 1e-5s — synchron gelesen zeigt die frisch
  // gestartete Mikro-Transition noch den alten Opacity-Wert.
  const yoursDBefore = await page.evaluate(() => document.getElementById("mHangGar").getAttribute("d"));
  await page.evaluate(() => {
    window.StateManager.set("currentType", "hoodie");
    window.StateManager.set("currentColor", "#831843");
    window.StateManager.set("currentDesign", { name: "Verify Piece" });
  });
  await page.waitForTimeout(150);
  const bridge = await page.evaluate(() => {
    return {
      yoursD: document.getElementById("mHangGar").getAttribute("d"),
      tag: document.getElementById("mTagT")?.textContent || "",
      hangNo: document.getElementById("mHangNo")?.textContent || "",
      cap: document.getElementById("mFileCap")?.textContent || "",
      fill: document.getElementById("mGarFill")?.getAttribute("fill"),
      yours: parseFloat(getComputedStyle(document.getElementById("mHangGar")).opacity),
      status: document.getElementById("mStatus")?.textContent || "",
    };
  });
  check(/\d{4}/.test(bridge.tag), `cell tag carries the file number (${bridge.tag})`);
  check(/\d{4}/.test(bridge.hangNo), `your hanger carries the file number (${bridge.hangNo})`);
  check(/\d{4}/.test(bridge.cap), `file caption switches from invite to file number (${bridge.cap.slice(0, 40)}…)`);
  check(bridge.fill === "#831843", `the cell cuts YOUR colour (${bridge.fill})`);
  check(bridge.yours === 1, "the DEINS hanger now holds your piece");
  check(bridge.yoursD !== yoursDBefore, "the DEINS hanger silhouette matches YOUR garment type (hoodie ≠ tee)");
  await page.screenshot({ path: `${OUT}/machine-bridge-mobile.png` });

  // Sprachwechsel: JS-gesetzte Texte rendern neu
  const en = await page.evaluate(() => {
    window.I18N.setLang("en");
    return {
      status: document.getElementById("mStatus")?.textContent || "",
      tag: document.getElementById("mTagT")?.textContent || "",
      zone: document.querySelector('[data-i18n="machine.z1"]')?.textContent || "",
    };
  });
  check(/ONE AT A TIME|READY|WAITING/.test(en.status), `status re-renders in EN (${en.status})`);
  check(/No\./.test(en.tag), `tag re-renders in EN (${en.tag})`);
  check(en.zone === "01 · INTAKE", `SVG zone captions re-hydrate (${en.zone})`);

  check(errors.length === 0, `no page errors (${errors.join("; ") || "none"})`);
  await ctx.close();
}

// ── 3. Mobil: Karten-Snap-Leiste unter der Zeichnung + Scroll-Sync ─────────
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/#machine", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  console.log("— mobile: card snap-rail + drawing sync —");
  const rail = await page.evaluate(() => {
    const r = document.querySelector(".lp-machine-stations");
    const band = document.querySelector(".lp-machine-band");
    const card = document.querySelector("button.lp-m-st");
    r.scrollIntoView({ block: "end" });
    // Etwas über die 82%-Reveal-Linie hinaus, wie echtes Scrollen — sonst
    // bleibt die kurze Leiste exakt an der Grenze unrevealed (opacity 0).
    window.scrollBy(0, 80);
    const rr = r.getBoundingClientRect();
    const br = band.getBoundingClientRect();
    return {
      scrollable: r.scrollWidth > r.clientWidth + 20,
      snap: getComputedStyle(r).scrollSnapType.includes("x"),
      textHidden: getComputedStyle(card.querySelector(".lp-m-st-text")).display === "none",
      hintHidden: getComputedStyle(card.querySelector(".lp-m-st-hint")).display === "none",
      bandVisibleWithRail: br.bottom > 0 && rr.top < window.innerHeight,
      cardH: Math.round(card.getBoundingClientRect().height),
    };
  });
  check(rail.scrollable, "cards form a horizontal scroll rail (one at a time)");
  check(rail.snap, "the rail snaps per card (scroll-snap-type: x)");
  check(rail.textHidden && rail.hintHidden, "body fragment + zoom hint are dropped on mobile");
  check(rail.bandVisibleWithRail, "drawing and rail share the viewport (band visible while rail on screen)");
  console.log(`    card height: ${rail.cardH}px`);

  // Swipe zur Karte 3 (Remake-Zelle) simulieren: Leiste scrollen → die
  // ZEICHNUNG muss nachfahren. Die Bewegung als Kurve samplen (smooth
  // scroll), nicht nur den Endzustand prüfen.
  const sync = await page.evaluate(async () => {
    const r = document.querySelector(".lp-machine-stations");
    const s = document.querySelector(".lp-machine-scroll");
    const cards = Array.from(document.querySelectorAll("button.lp-m-st"));
    const before = s.scrollLeft;
    const target = cards[2].offsetLeft - r.offsetLeft - (r.clientWidth - cards[2].offsetWidth) / 2;
    r.scrollTo({ left: target });
    const samples = [];
    for (let i = 0; i < 14; i++) {
      samples.push(Math.round(s.scrollLeft));
      await new Promise((res) => setTimeout(res, 100));
    }
    return {
      before: before,
      samples: samples,
      end: s.scrollLeft,
      pressed: cards.map((c) => c.getAttribute("aria-pressed")).join(","),
      distinct: new Set(samples).size,
    };
  });
  console.log("    drawing scrollLeft over time:", JSON.stringify(sync.samples));
  check(sync.end > sync.before + 100, `drawing follows the rail to the remake cell (${sync.before} → ${Math.round(sync.end)})`);
  check(sync.distinct >= 3, `drawing glides (sampled ${sync.distinct} distinct positions, not a jump)`);
  check(sync.pressed === "false,false,true,false", `snapped card is marked active (${sync.pressed})`);
  await page.screenshot({ path: `${OUT}/machine-rail-mobile.png` });

  check(errors.length === 0, `no page errors (${errors.join("; ") || "none"})`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) FAILED` : "\n✓ machine verification passed");
process.exit(failed ? 1 : 0);
