/**
 * Headless-Verifikation der Community-Sphäre (Sektion #community auf /).
 * Prüft: Lazy-Boot, 36 Karten, Scroll-Durchlässigkeit (Wheel), Drag-Trägheit,
 * Hover, Tap→Detail-Overlay, Join-Overlay (Formular-IDs), Esc, Mobil.
 * Usage: node scripts/verify-community.mjs [base]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] || "http://localhost:8080";
const out = "screenshots";
mkdirSync(out, { recursive: true });

// Lokal erwartbare Nicht-Fehler (nur auf Vercel vorhandene Endpunkte).
const IGNORE = [/_vercel\//, /\/api\/gallery/, /\/api\/track/, /vercel-insights\.com/, /va\.vercel-scripts\.com/];
const ignorable = (s) => IGNORE.some((re) => re.test(s));

const browser = await chromium.launch({ args: ["--no-sandbox", "--ignore-certificate-errors"] });
const failures = [];
const consoleErrors = [];
const badResponses = [];

const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
page.on("console", (m) => {
  const src = `${m.text()} ${(m.location() && m.location().url) || ""}`;
  if (m.type() === "error" && !ignorable(src)) consoleErrors.push(src.slice(0, 200));
});
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 200)));
page.on("response", (r) => { if (r.status() >= 400 && !ignorable(r.url())) badResponses.push(`${r.status()} ${r.url().slice(0, 120)}`); });

await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(800);

// Zur Sektion scrollen → Lazy-Boot muss anspringen
await page.evaluate(() => document.getElementById("community").scrollIntoView({ block: "start" }));
try {
  await page.waitForFunction(() => globalThis.__communitySphere && globalThis.__communitySphere.cards.length >= 36, null, { timeout: 30000 });
} catch {
  const got = await page.evaluate(() => globalThis.__communitySphere ? globalThis.__communitySphere.cards.length : "kein Boot");
  failures.push(`Sphäre nicht vollständig geladen (Karten: ${got})`);
}
await page.waitForTimeout(1600); // Bloom ausspielen
await page.screenshot({ path: `${out}/com-desktop.png` });

// ---- Wheel über der Sektion muss die SEITE scrollen (kein Hijack) ----
const sy0 = await page.evaluate(() => scrollY);
await page.mouse.move(720, 450);
await page.mouse.wheel(0, 240);
await page.waitForTimeout(400);
const sy1 = await page.evaluate(() => scrollY);
if (sy1 === sy0) failures.push("Wheel über der Sphäre scrollt die Seite nicht (Hijack?)");
await page.evaluate(() => document.getElementById("community").scrollIntoView({ block: "start" }));
await page.waitForTimeout(500);

// ---- Drag: Yaw glatt, Seite scrollt dabei nicht ----
const syd0 = await page.evaluate(() => scrollY);
const samples = [];
const sampler = setInterval(async () => {
  try { samples.push(await page.evaluate(() => globalThis.__communitySphere.rot.yaw)); } catch { /* busy */ }
}, 80);
await page.mouse.move(1050, 480);
await page.mouse.down();
for (let i = 0; i < 10; i++) {
  await page.mouse.move(1050 - (i + 1) * 50, 480, { steps: 3 });
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(1400);
clearInterval(sampler);
const deltas = samples.slice(1).map((v, i) => +(v - samples[i]).toFixed(4));
console.log("Yaw-Deltas:", deltas.join(", "));
if (Math.abs(samples.at(-1) - samples[0]) < 0.2) failures.push("Drag bewegt die Kugel kaum");
const syd1 = await page.evaluate(() => scrollY);
if (syd1 !== syd0) failures.push(`Canvas-Drag hat die Seite gescrollt (${syd0}→${syd1})`);

// ---- Hover + Tap → Detail-Overlay ----
// Restbewegung (Trägheit/Lerp) einfrieren, damit der berechnete Kartenpunkt
// bis zum Klick gültig bleibt.
await page.evaluate(() => {
  const g = globalThis.__communitySphere;
  g.vel.yaw = g.vel.pitch = 0;
  g.target.yaw = g.rot.yaw;
  g.target.pitch = g.rot.pitch;
  g.state.lastInteract = performance.now();
});
await page.waitForTimeout(150);
const targetCard = await page.evaluate(() => {
  const g = globalThis.__communitySphere;
  const c = document.getElementById("community-canvas").getBoundingClientRect();
  let best = null;
  for (const m of g.cards) {
    const p = m.position.clone().project(g.camera);
    const sx = c.left + (p.x * 0.5 + 0.5) * c.width;
    const sy = c.top + (-p.y * 0.5 + 0.5) * c.height;
    const fwd = m.position.clone().normalize();
    const dir = new (Object.getPrototypeOf(g.camera.position).constructor)(0, 0, -1).applyEuler(g.camera.rotation);
    if (fwd.dot(dir) < 0.75) continue;
    const d = Math.hypot(sx - (c.left + c.width / 2), sy - (c.top + c.height / 2));
    if (!best || d < best.d) best = { d, sx, sy, name: m.userData.item.name };
  }
  return best;
});
if (!targetCard) {
  failures.push("Keine Karte vor der Kamera gefunden");
} else {
  await page.mouse.move(targetCard.sx, targetCard.sy, { steps: 6 });
  await page.waitForTimeout(600);
  const hover = await page.evaluate(() => ({
    has: document.getElementById("community").classList.contains("has-hover"),
    label: document.getElementById("sphere-label").classList.contains("is-on"),
    name: document.getElementById("sphere-label-name").textContent,
  }));
  if (!hover.has || !hover.label) failures.push("Hover-Zustand/Label fehlt");
  console.log("Hover:", JSON.stringify(hover));
  await page.screenshot({ path: `${out}/com-hover.png` });

  await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up();
  await page.waitForTimeout(800);
  const detail = await page.evaluate(() => {
    const el = document.getElementById("sphere-detail");
    return {
      open: !el.hidden && el.classList.contains("is-open"),
      name: document.getElementById("sphere-detail-name").textContent,
      meta: document.getElementById("sphere-detail-meta").textContent,
      img: document.getElementById("sphere-detail-img").naturalWidth > 0,
      lock: document.documentElement.classList.contains("sphere-lock"),
    };
  });
  if (!detail.open || !detail.img || !detail.name) failures.push("Detail-Overlay unvollständig: " + JSON.stringify(detail));
  console.log("Detail:", JSON.stringify(detail));
  await page.screenshot({ path: `${out}/com-detail.png` });

  // Detail → „Oder werde Teil der Community" → Join-Overlay mit Formular
  await page.click("#sphere-detail-join");
  await page.waitForTimeout(500);
  const join = await page.evaluate(() => ({
    open: !document.getElementById("sphere-join").hidden,
    form: Boolean(document.querySelector("#sphere-join #join-form")),
    email: Boolean(document.getElementById("join-email")),
  }));
  if (!join.open || !join.form || !join.email) failures.push("Join-Overlay/Formular fehlt: " + JSON.stringify(join));
  console.log("Join:", JSON.stringify(join));
  await page.screenshot({ path: `${out}/com-join.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const closed = await page.evaluate(() =>
    document.getElementById("sphere-join").hidden &&
    !document.documentElement.classList.contains("sphere-lock"));
  if (!closed) failures.push("Esc schließt Join-Overlay nicht / Scroll-Lock bleibt");
}

// ---- Sektions-CTA öffnet Join ----
await page.click("#sphere-join-cta");
await page.waitForTimeout(400);
const ctaJoin = await page.evaluate(() => !document.getElementById("sphere-join").hidden);
if (!ctaJoin) failures.push("Sektions-CTA öffnet Join-Overlay nicht");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
await page.close();

// ---- Mobil ----
const mob = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
mob.on("pageerror", (e) => consoleErrors.push("mobil pageerror: " + e.message.slice(0, 200)));
await mob.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
await mob.waitForTimeout(600);
await mob.evaluate(() => document.getElementById("community").scrollIntoView({ block: "start" }));
try {
  await mob.waitForFunction(() => globalThis.__communitySphere && globalThis.__communitySphere.cards.length >= 36, null, { timeout: 30000 });
} catch { failures.push("Mobil: Sphäre nicht geladen"); }
await mob.waitForTimeout(1500);
const ta = await mob.evaluate(() => getComputedStyle(document.getElementById("community-canvas")).touchAction);
if (ta !== "pan-y") failures.push(`touch-action ist "${ta}" statt pan-y`);
await mob.screenshot({ path: `${out}/com-mobile.png` });
await mob.close();
await browser.close();

console.log("\nConsole-Fehler:", consoleErrors.length ? consoleErrors : "keine");
console.log("HTTP >=400:", badResponses.length ? badResponses : "keine");
console.log("Checks:", failures.length ? "FEHLGESCHLAGEN" : "OK");
for (const f of failures) console.log("  ✗ " + f);
if (consoleErrors.length || badResponses.length || failures.length) process.exit(1);
