/**
 * Headless-Verifikation der sphärischen Galerie (/gallery/).
 * Prüft: Ressourcen (HTTP-Status), Console-Fehler, Intro, Drag-Trägheit
 * (Yaw-Kurve + Frame-Serie), Hover, Klick→Detailseite, Esc→zurück, Mobil.
 * Usage: node scripts/verify-gallery.mjs [base]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const base = process.argv[2] || "http://localhost:8080";
const out = "screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--ignore-certificate-errors"] });
const failures = [];
const consoleErrors = [];
const badResponses = [];

const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
// three.js/GSAP kommen per Import-Map vom CDN; headless erreicht Chromium
// den Agent-Proxy nicht selbst — ohne diese Route bootet die Seite gar nicht
// und der Guard stirbt an einem undefined __gallery statt rot zu melden.
await routeCdnThroughNode(page);

await page.goto(`${base}/gallery/`, { waitUntil: "domcontentloaded", timeout: 30000 });

// Intro abwarten (Veil weg + intro-Flag aus)
try {
  await page.waitForFunction(() => globalThis.__gallery && !globalThis.__gallery.state.intro, null, { timeout: 25000 });
} catch {
  failures.push("Intro hat nicht abgeschlossen (state.intro blieb true)");
}
await page.waitForTimeout(600);
// Jede Quelle hängt in drei Ausschnitten an der Wand — die Erwartung wird
// abgeleitet, nicht notiert (siehe Kommentar am __gallery-Haken).
const wall = await page.evaluate(() => ({
  cards: globalThis.__gallery.cards.length,
  expect: globalThis.__gallery.sources * globalThis.__gallery.variants,
}));
if (wall.cards !== wall.expect) failures.push(`Erwartet ${wall.expect} Karten (${wall.expect / 3} Quellen × 3), gefunden: ${wall.cards}`);
await page.screenshot({ path: `${out}/gal-desktop.png` });

// ---- Drag + Trägheit: Yaw über die Zeit samplen ----
const samples = [];
const sampler = setInterval(async () => {
  try { samples.push(await page.evaluate(() => globalThis.__gallery.rot.yaw)); } catch { /* page busy */ }
}, 80);
await page.mouse.move(1100, 450);
await page.mouse.down();
for (let i = 0; i < 12; i++) {
  await page.mouse.move(1100 - (i + 1) * 55, 450 + Math.sin(i / 3) * 10, { steps: 3 });
  await page.waitForTimeout(16);
}
await page.mouse.up();
// Frames während des Ausrollens (Trägheit)
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/gal-inertia-${i}.png` });
}
await page.waitForTimeout(800);
clearInterval(sampler);
const deltas = samples.slice(1).map((v, i) => +(v - samples[i]).toFixed(4));
console.log("Yaw-Samples (80ms):", samples.map((v) => +v.toFixed(3)).join(", "));
console.log("Yaw-Deltas:", deltas.join(", "));
const movedDuringInertia = Math.abs(samples.at(-1) - samples[Math.floor(samples.length / 2)]) > 0.001;
if (!movedDuringInertia) failures.push("Keine erkennbare Trägheit nach dem Loslassen");

// ---- Hover: Karte nahe Bildmitte finden, anfahren ----
const target = await page.evaluate(() => {
  const g = globalThis.__gallery;
  let best = null;
  for (const m of g.cards) {
    const p = m.position.clone().project(g.camera);
    if (p.z > 1 || p.z < -1) continue;
    const sx = (p.x * 0.5 + 0.5) * innerWidth;
    const sy = (-p.y * 0.5 + 0.5) * innerHeight;
    const d = Math.hypot(sx - innerWidth / 2, sy - innerHeight / 2);
    // Karte muss vor der Kamera liegen (Blickrichtung prüfen)
    const dir = m.position.clone().normalize();
    const fwd = new (Object.getPrototypeOf(g.camera.position).constructor)(0, 0, -1).applyEuler(g.camera.rotation);
    if (dir.dot(fwd) < 0.6) continue;
    if (!best || d < best.d) best = { d, sx, sy, title: m.userData.title };
  }
  return best;
});
if (!target) {
  failures.push("Keine Karte vor der Kamera gefunden");
} else {
  await page.mouse.move(target.sx, target.sy, { steps: 8 });
  await page.waitForTimeout(700);
  const hoverState = await page.evaluate(() => ({
    hasHover: document.body.classList.contains("has-hover"),
    label: document.getElementById("hl-title").textContent,
    labelVisible: +getComputedStyle(document.getElementById("hover-label")).opacity > 0.5,
  }));
  if (!hoverState.hasHover) failures.push("Hover: body.has-hover fehlt");
  if (!hoverState.labelVisible) failures.push("Hover: Label nicht sichtbar");
  console.log("Hover über:", JSON.stringify(hoverState));
  await page.screenshot({ path: `${out}/gal-hover.png` });

  // ---- Klick → Detailseite (Frame-Serie der Transition) ----
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  for (let i = 0; i < 9; i++) {
    await page.screenshot({ path: `${out}/gal-open-${i}.png` });
    await page.waitForTimeout(170);
  }
  const openState = await page.evaluate(() => ({
    open: globalThis.__gallery.state.open,
    ariaHidden: document.getElementById("detail").getAttribute("aria-hidden"),
    title: document.getElementById("detail-title").textContent,
    imgLoaded: document.getElementById("detail-img").naturalWidth > 0,
  }));
  if (!openState.open || openState.ariaHidden !== "false") failures.push("Detailseite nicht geöffnet");
  if (!openState.imgLoaded) failures.push("Detail-Hero-Bild nicht geladen");
  console.log("Detail offen:", JSON.stringify(openState));
  await page.screenshot({ path: `${out}/gal-detail.png` });

  // ---- Esc → zurück zur Galerie ----
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1600);
  const closed = await page.evaluate(() => !globalThis.__gallery.state.open);
  if (!closed) failures.push("Esc hat die Detailseite nicht geschlossen");
  await page.screenshot({ path: `${out}/gal-closed.png` });
}

await page.close();

// ---- Mobil ----
const mob = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
mob.on("pageerror", (e) => consoleErrors.push("mobile pageerror: " + e.message));
await routeCdnThroughNode(mob);
await mob.goto(`${base}/gallery/`, { waitUntil: "domcontentloaded", timeout: 30000 });
try {
  await mob.waitForFunction(() => globalThis.__gallery && !globalThis.__gallery.state.intro, null, { timeout: 25000 });
} catch {
  failures.push("Mobil: Intro hat nicht abgeschlossen");
}
await mob.waitForTimeout(500);
await mob.screenshot({ path: `${out}/gal-mobile.png` });
await mob.close();
await browser.close();

console.log("\nConsole-Fehler:", consoleErrors.length ? consoleErrors : "keine");
console.log("HTTP >=400:", badResponses.length ? badResponses : "keine");
console.log("Checks:", failures.length ? "FEHLGESCHLAGEN" : "OK");
for (const f of failures) console.log("  ✗ " + f);
if (consoleErrors.length || badResponses.length || failures.length) process.exit(1);
