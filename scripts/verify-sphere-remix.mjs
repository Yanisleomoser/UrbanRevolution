/**
 * „Der Kreis schließt sich" verification: published DNA pieces float in the
 * community sphere as stage-card flats, the detail overlay offers REMIX with
 * a share URL, and a fresh publish (urev:published) drops the piece into the
 * globe live — including the pre-boot queue path. Fails on page errors or a
 * vacuous run.
 *
 *   node scripts/verify-sphere-remix.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const require = createRequire(import.meta.url);
const DesignDNA = require("../js/design-engine/dna.js");
const DesignShare = require("../js/design-engine/share.js");

const OUT = "screenshots/verify-sphere";
mkdirSync(OUT, { recursive: true });

// Echte DNA-Strings aus dem kuratierten Set — bleiben mit dem Content synchron.
const curated = JSON.parse(readFileSync("js/design-engine/content/gallery-curated.json", "utf8")).items;
if (curated.length < 3) throw new Error("gallery-curated.json braucht ≥ 3 Items für diesen Check");
const [DNA_A, DNA_B, DNA_PUB] = curated;

// Bösartige/kaputte, aber base64-gültige DNA (unauth. POST validiert nur den
// String): (a) unbekannte, aber renderbare Kategorie → Karte rendert (Fallback
// tshirt), Typ-Label MUSS leer bleiben (kein roher i18n-Key); (b) nicht
// renderbare Kategorie (Objekt) → MUSS lautlos rausfallen UND darf den
// kuratierten Fallback NICHT unterdrücken.
const unicorn = DesignDNA.create();
DesignDNA.set(unicorn, "category", "unicorn", 1);
const DNA_UNICORN = DesignShare.encode(unicorn);
const broken = DesignDNA.create();
broken.category = { a: 1 };
const DNA_UNRENDERABLE = DesignShare.encode(broken);

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗ FAIL:"} ${msg}`); if (!cond) failed++; };

// /api/gallery-Stub: 1 Foto-Item, 2 DNA-Items, 1 kaputtes DNA-Item (muss
// lautlos rausfallen) — läuft lokal ja nie (Edge-Function nur auf Vercel).
const stubGallery = (page) => page.route("**/api/gallery", (route) => route.fulfill({
  contentType: "application/json",
  body: JSON.stringify({ ok: true, items: [
    { img: "/assets/logo.png", name: "Foto-Probe", by: "", type: "", style: "" },
    { d: DNA_A.d, name: DNA_A.name, by: DNA_A.by, ts: 1 },
    { d: DNA_B.d, name: DNA_B.name, by: DNA_B.by, ts: 2 },
    { d: "%%%kaputt%%%", name: "Junk", ts: 3 },
  ] }),
}));

const bootSphere = async (page) => {
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.$eval("#community", (n) => n.scrollIntoView());
  await page.waitForFunction(() => globalThis.__communitySphere, { timeout: 25000 });
};
const waitCards = (page, min) =>
  page.waitForFunction((m) => globalThis.__communitySphere.cards.length >= m, min, { timeout: 25000 });

{ // ── Kontext 1: Desktop, volle Motion — Kern des Kreises ──────────────────
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await stubGallery(page);
  await bootSphere(page);
  await waitCards(page, 10);
  await page.waitForTimeout(1200);

  const stats = await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    const dna = s.cards.filter((c) => c.userData.item.dna);
    return {
      total: s.cards.length,
      dnaCount: dna.length,
      dnaNames: dna.map((c) => c.userData.item.name),
      dnaTypes: dna.map((c) => c.userData.item.type),
      junk: s.items.some((it) => it.name === "Junk"),
      photo: s.cards.some((c) => c.userData.item.img === "/assets/logo.png"),
    };
  });
  check(stats.dnaCount === 2, `both valid DNA pieces float in the globe (${stats.dnaCount}, ${stats.dnaNames.join(", ")})`);
  check(!stats.junk, "the broken DNA string is dropped silently");
  check(stats.photo, "photo-render items still work alongside");
  check(stats.dnaTypes.every(Boolean), `DNA cards carry their garment type for the hover label (${stats.dnaTypes.join(", ")})`);

  // Detail-Overlay eines DNA-Stücks: Bühnen-Karte + REMIX, Create versteckt.
  await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    s.openDetail(s.cards.find((c) => c.userData.item.dna));
  });
  await page.waitForTimeout(400);
  // COMPUTED display prüfen, nicht die hidden-Property: Klassen mit eigenem
  // display (.manifesto-cta) überstimmen [hidden] ohne den CSS-Guard — die
  // Property lügt dann übers Render (genau so beim ersten Lauf passiert).
  const dnaDetail = await page.evaluate(() => ({
    open: !document.getElementById("sphere-detail").hidden,
    img: document.getElementById("sphere-detail-img").src.slice(0, 22),
    remixShown: getComputedStyle(document.getElementById("sphere-detail-remix")).display !== "none",
    remixHref: document.getElementById("sphere-detail-remix").href,
    createShown: getComputedStyle(document.getElementById("sphere-detail-create")).display !== "none",
    name: document.getElementById("sphere-detail-name").textContent,
  }));
  check(dnaDetail.open && dnaDetail.img.startsWith("data:image/png"), `the DNA detail shows the rendered stage card (${dnaDetail.img}…)`);
  check(dnaDetail.remixShown && dnaDetail.remixHref.includes("#dna="), "REMIX is offered and carries the share URL");
  check(!dnaDetail.createShown, "the generic create CTA steps back for REMIX (computed display)");
  check(dnaDetail.name === DNA_A.name || dnaDetail.name === DNA_B.name, `the piece keeps its name (${dnaDetail.name})`);
  await page.screenshot({ path: `${OUT}/detail-dna-desktop.png` });
  await page.evaluate(() => document.querySelector("#sphere-detail .sphere-close").click());
  await page.waitForTimeout(500);

  // Foto-Item: unverändertes Verhalten (kein Remix, Create sichtbar).
  await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    s.openDetail(s.cards.find((c) => c.userData.item.img === "/assets/logo.png"));
  });
  await page.waitForTimeout(300);
  const photoDetail = await page.evaluate(() => ({
    remixShown: getComputedStyle(document.getElementById("sphere-detail-remix")).display !== "none",
    createShown: getComputedStyle(document.getElementById("sphere-detail-create")).display !== "none",
  }));
  check(!photoDetail.remixShown && photoDetail.createShown, "photo items keep the original actions (no remix, computed display)");
  await page.evaluate(() => document.querySelector("#sphere-detail .sphere-close").click());
  await page.waitForTimeout(500);

  // Publish NACH dem Boot: Stück erscheint live, Bloom wächst wirklich
  // (Kurve über die volle Dauer sampeln, nicht zwei Standbilder).
  const before = await page.evaluate(() => globalThis.__communitySphere.cards.length);
  await page.evaluate((d) => {
    globalThis.dispatchEvent(new CustomEvent("urev:published", { detail: { d, name: "Mein Stück" } }));
  }, DNA_PUB.d);
  // Gezielt DAS publizierte Stück beobachten — cards[length-1] ist nicht
  // stabil (spät eintreffende Showcase-Fotos hängen sich hinten an).
  await page.waitForFunction(() =>
    globalThis.__communitySphere.cards.some((c) => c.userData.item.name === "Mein Stück"), { timeout: 15000 });
  check(true, `the freshly published piece joins the globe live (+${await page.evaluate(() => globalThis.__communitySphere.cards.length) - before} card)`);
  const growth = [];
  for (let i = 0; i < 12; i++) {
    growth.push(await page.evaluate(() => {
      const m = globalThis.__communitySphere.cards.find((c) => c.userData.item.name === "Mein Stück");
      return { x: m.scale.x, target: m.userData.w };
    }));
    await page.waitForTimeout(130);
  }
  const last = growth[growth.length - 1];
  const distinct = new Set(growth.map((g) => g.x.toFixed(3))).size;
  check(distinct >= 4 && last.x > last.target * 0.85,
    `…and BLOOMS in (${distinct} sampled scale states, reaches ${(last.x / last.target * 100).toFixed(0)}% of target)`);
  // Slot-Kollisions-Regression: bei vollen 36 Slots landete das Live-Stück
  // exakt hinter Karte 0 (36 % 36 = 0) und blieb unsichtbar. Es muss einen
  // eigenen Platz haben — sichtbar vor der Wand, von jeder Karte abgesetzt.
  // Geometrie garantiert ≥ 1.4 Einheiten (live-Radius 11.4 vs. Wand ≥ 12.8),
  // daher > 1.2 deterministisch — NICHT > 0.8 (die alte Schwelle konnte bei
  // 0.6 garantiertem Abstand intermittierend flaken, siehe Review).
  const spacing = await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    const mine = s.cards.find((c) => c.userData.item.name === "Mein Stück");
    const minDist = Math.min(...s.cards.filter((c) => c !== mine)
      .map((c) => c.position.distanceTo(mine.position)));
    return { minDist, radius: mine.position.length() };
  });
  check(spacing.minDist > 1.2 && spacing.radius < 12, `the live piece takes its OWN spot in front of the wall (radius ${spacing.radius.toFixed(1)}, nearest card ${spacing.minDist.toFixed(1)} units away)`);

  // Doppelklick-Dedupe-Regression: dasselbe Stück ein zweites Mal publizieren
  // (identischer d-String) darf KEINE zweite Karte erzeugen.
  const dupBefore = await page.evaluate(() =>
    globalThis.__communitySphere.cards.filter((c) => c.userData.item.name === "Mein Stück").length);
  await page.evaluate((d) => {
    globalThis.dispatchEvent(new CustomEvent("urev:published", { detail: { d, name: "Mein Stück" } }));
    globalThis.dispatchEvent(new CustomEvent("urev:published", { detail: { d, name: "Mein Stück" } }));
  }, DNA_PUB.d);
  await page.waitForTimeout(600);
  const mineCount = await page.evaluate(() =>
    globalThis.__communitySphere.cards.filter((c) => c.userData.item.name === "Mein Stück").length);
  check(mineCount === dupBefore, `re-publishing the same DNA adds no duplicate card (${dupBefore} → ${mineCount})`);

  // Inert-Kugel-Regression: Detail schließen und binnen 240 ms erneut öffnen
  // (Esc→Enter) darf state.open NICHT klemmen lassen — sonst wäre die Kugel
  // bis zum Reload tot.
  await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    s.openDetail(s.cards.find((c) => c.userData.item.dna));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector("#sphere-detail .sphere-close").click());
  await page.waitForTimeout(80); // < 240 ms: mitten im Ausblenden
  await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    s.openDetail(s.cards.find((c) => c.userData.item.dna));
  });
  await page.waitForTimeout(400);
  const reopen = await page.evaluate(() => ({
    open: globalThis.__communitySphere.state.open,
    visible: !document.getElementById("sphere-detail").hidden,
  }));
  check(reopen.open && reopen.visible, "close+reopen within 240ms keeps the overlay live (sphere not inert)");
  await page.evaluate(() => document.querySelector("#sphere-detail .sphere-close").click());
  await page.waitForTimeout(400);
  const afterClose = await page.evaluate(() => ({
    open: globalThis.__communitySphere.state.open,
    hidden: document.getElementById("sphere-detail").hidden,
  }));
  check(!afterClose.open && afterClose.hidden, "…and still closes cleanly afterwards");

  // Fürs Auge: Kamera auf das frisch publizierte Stück richten, damit der
  // Screenshot die Bühnen-Karte wirklich ZEIGT (nicht irgendeine Wandseite).
  await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    const m = s.cards.find((c) => c.userData.item.name === "Mein Stück");
    const n = m.position.clone().normalize();
    s.target.yaw = Math.atan2(-n.x, -n.z);
    s.target.pitch = Math.asin(n.y);
    s.rot.yaw = s.target.yaw;
    s.rot.pitch = s.target.pitch;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/sphere-desktop.png` });
  // Fürs Auge: Kamera auf das frisch publizierte Stück richten, damit der
  // Screenshot die Bühnen-Karte wirklich ZEIGT (nicht irgendeine Wandseite).
  await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    const m = s.cards.find((c) => c.userData.item.name === "Mein Stück");
    const n = m.position.clone().normalize();
    s.target.yaw = Math.atan2(-n.x, -n.z);
    s.target.pitch = Math.asin(n.y);
    s.rot.yaw = s.target.yaw;
    s.rot.pitch = s.target.pitch;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/sphere-desktop.png` });
  check(errors.length === 0, `no page errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

{ // ── Kontext 2: Mobil + Publish VOR dem Boot (Queue-Pfad) ─────────────────
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await stubGallery(page);
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  // Publizieren, BEVOR die Sektion je in Sichtweite war (Kugel noch nicht gebootet).
  await page.evaluate((d) => {
    globalThis.dispatchEvent(new CustomEvent("urev:published", { detail: { d, name: "Vor dem Boot" } }));
  }, DNA_PUB.d);
  await page.$eval("#community", (n) => n.scrollIntoView());
  await page.waitForFunction(() => globalThis.__communitySphere, { timeout: 25000 });
  await waitCards(page, 10);
  await page.waitForTimeout(800);
  const queued = await page.evaluate(() =>
    globalThis.__communitySphere.cards.some((c) => c.userData.item.name === "Vor dem Boot"));
  check(queued, "a piece published BEFORE the sphere booted is queued and appears on boot");
  await page.screenshot({ path: `${OUT}/sphere-mobile.png` });
  check(errors.length === 0, `mobile: no page errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

{ // ── Kontext 3: reduced-motion — alles sofort da, keine Bewegung nötig ────
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await stubGallery(page);
  await bootSphere(page);
  await waitCards(page, 10);
  await page.waitForTimeout(900);
  const rm = await page.evaluate(() => {
    const dna = globalThis.__communitySphere.cards.filter((c) => c.userData.item.dna);
    return { count: dna.length, fullSize: dna.every((c) => c.scale.x > c.userData.w * 0.95) };
  });
  check(rm.count === 2 && rm.fullSize, "reduced-motion: DNA cards appear at full size, no bloom needed");
  check(errors.length === 0, `reduced-motion: no page errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

{ // ── Kontext 4: REMIX behält den Query-String · unbekannte/kaputte DNA ────
  // REMIX-Regression: ein Besucher mit ?utm_/?gclid darf nicht auf einer
  // #dna-losen alten URL landen (reload() bricht sonst die Navigation ab).
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/gallery", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, items: [
      { d: DNA_A.d, name: DNA_A.name, ts: 1 },
      { d: DNA_UNICORN, name: "Einhorn", ts: 2 },        // renderbar, Typ unbekannt
      { d: DNA_UNRENDERABLE, name: "Kaputt", ts: 3 },    // nicht renderbar
    ] }),
  }));
  await page.goto(base + "/?utm_source=test", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.$eval("#community", (n) => n.scrollIntoView());
  await page.waitForFunction(() => globalThis.__communitySphere, { timeout: 25000 });
  await waitCards(page, 5);
  await page.waitForTimeout(1000);

  const cats = await page.evaluate(() => {
    const dna = globalThis.__communitySphere.cards.filter((c) => c.userData.item.dna);
    return {
      names: dna.map((c) => c.userData.item.name),
      unicornType: (dna.find((c) => c.userData.item.name === "Einhorn") || { userData: { item: {} } }).userData.item.type,
      hasBroken: dna.some((c) => c.userData.item.name === "Kaputt"),
    };
  });
  check(cats.names.includes("Einhorn"), "an unknown-but-renderable category still renders a card (fallback silhouette)");
  check(cats.unicornType === "", `…but its unknown type is suppressed, not shown as a raw i18n key (type="${cats.unicornType}")`);
  check(!cats.hasBroken, "a decodable-but-unrenderable DNA is dropped silently");

  // REMIX-Klick mit Query-String: das Stück MUSS im Studio landen (Flow liest
  // #dna beim Boot und ruft dann clear() → Hash konsumiert, search bleibt).
  // Der alte Code (location.href = buildUrl, das search verwarf) machte daraus
  // eine Cross-Document-Navigation, die reload() abbrach → Reload auf die ALTE
  // URL ohne #dna, das Studio öffnete nie. Prüfstein ist also das ERGEBNIS
  // (Studio offen + Refine geladen), nicht der transiente Hash.
  await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    s.openDetail(s.cards.find((c) => c.userData.item.name === "Einhorn"));
  });
  await page.waitForTimeout(400);
  await Promise.all([
    page.waitForNavigation({ timeout: 12000 }).catch(() => {}),
    page.click("#sphere-detail-remix"),
  ]);
  await page.waitForTimeout(2500);
  const outcome = await page.evaluate(() => ({
    search: location.search,
    studioRevealed: document.getElementById("studio") ? !document.getElementById("studio").hidden : false,
    refineLoaded: !!document.querySelector("#engine-host .de-summary, #de-body .de-summary-type"),
  }));
  check(outcome.search.includes("utm_source=test"), `REMIX preserves the query string (${outcome.search || "—"})`);
  check(outcome.studioRevealed && outcome.refineLoaded,
    `…and the remixed piece actually opens in the studio (revealed=${outcome.studioRevealed}, refine=${outcome.refineLoaded})`);
  check(errors.length === 0, `context 4: no page errors (${errors.join(" | ") || "clean"})`);
  await page.close();
}

{ // ── Kontext 4b: laufende Journey → REMIX fragt vor dem Verwerfen nach ─────
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  await page.route("**/api/gallery", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, items: [{ d: DNA_A.d, name: DNA_A.name, ts: 1 }] }),
  }));
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  // Eine laufende Journey vortäuschen (Antworten vorhanden).
  await page.evaluate(() => localStorage.setItem("urev_journey_v1", JSON.stringify({ dna: {}, answered: ["intent"] })));
  await page.$eval("#community", (n) => n.scrollIntoView());
  await page.waitForFunction(() => globalThis.__communitySphere, { timeout: 25000 });
  await waitCards(page, 5);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const s = globalThis.__communitySphere;
    s.openDetail(s.cards.find((c) => c.userData.item.dna));
  });
  await page.waitForTimeout(400);
  // Confirm ABLEHNEN: die Seite darf NICHT navigieren, die Journey bleibt.
  page.once("dialog", (d) => d.dismiss());
  let navigated = false;
  page.once("framenavigated", () => { navigated = true; });
  await page.click("#sphere-detail-remix");
  await page.waitForTimeout(700);
  const kept = await page.evaluate(() => localStorage.getItem("urev_journey_v1"));
  check(!navigated && kept && kept.includes("intent"), "REMIX with an in-progress journey asks first; dismiss keeps the work");
  await page.close();
}

{ // ── Kontext 5: NUR kaputte DNA → kuratierter Fallback bleibt erhalten ─────
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await routeCdnThroughNode(page);
  await page.route("**/api/gallery", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, items: [{ d: DNA_UNRENDERABLE, name: "Kaputt", ts: 1 }] }),
  }));
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.$eval("#community", (n) => n.scrollIntoView());
  await page.waitForFunction(() => globalThis.__communitySphere, { timeout: 25000 });
  await waitCards(page, 5);
  await page.waitForTimeout(1000);
  const fb = await page.evaluate(() =>
    globalThis.__communitySphere.cards.filter((c) => c.userData.item.dna).map((c) => c.userData.item.name));
  // Der kuratierte Fallback (Tide Runner etc.) muss trotz des "echten" (aber
  // unrenderbaren) API-Eintrags einspringen — sonst zeigt die Kugel gar kein
  // Community-Stück.
  check(fb.includes(curated[0].name), `unrenderable API DNA does NOT suppress the curated fallback (${fb.length} curated pieces shown)`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ sphere remix circle verified");
process.exit(failed ? 1 : 0);
