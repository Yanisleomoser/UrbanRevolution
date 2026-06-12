/**
 * Visuelle Selbstprüfung der Portfolio-Studie (CLAUDE.md-Pflicht):
 * Konsole-Fehler, Desktop/Mobil-Screens, Frame-Serie der Hero-Intro-
 * Animation und gescrollte Zustände (Manifest-Scrub, Work, Contact).
 *   node scripts/verify-portfolio.mjs [base]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

/* Sandbox-Workaround: Chromium misstraut dem MITM-Proxy-Zertifikat, curl
   (System-CA) nicht. CDN-Requests (GSAP, Google Fonts) durch curl tunneln,
   damit die Seite im Test exakt wie in Produktion läuft. */
const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];
const cdnCache = new Map();
function curlFetch(url) {
    if (!cdnCache.has(url)) {
        cdnCache.set(url, execFileSync("curl", ["-sL", "--max-time", "30", url], {
            maxBuffer: 50 * 1024 * 1024,
            encoding: "buffer",
        }));
    }
    return cdnCache.get(url);
}
async function routeCdn(p) {
    await p.route((u) => CDN_HOSTS.includes(new URL(u).hostname), (route) => {
        try {
            const u = route.request().url();
            const type = u.endsWith(".js") ? "application/javascript"
                : u.includes("css2") ? "text/css"
                : u.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
            route.fulfill({ status: 200, contentType: type, body: curlFetch(u) });
        } catch {
            route.abort();
        }
    });
}

const base = process.argv[2] || "http://localhost:8080";
const url = `${base}/portfolio/`;
mkdirSync("screenshots", { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
const failed = [];

async function page(width, height) {
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    await routeCdn(p);
    return p;
}

// --- Hero-Intro: dichte Frame-Serie ab Navigationsstart (alle ~120 ms) ---
const d = await page(1440, 900);
const nav = d.goto(url, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 16; i++) {
    await d.screenshot({ path: `screenshots/pf-intro-${String(i).padStart(2, "0")}.png` });
    await d.waitForTimeout(120);
}
await nav;
await d.waitForTimeout(800);
await d.screenshot({ path: "screenshots/pf-desktop-hero.png" });

// --- Gescrollte Zustände Desktop ---
const shots = [
    ["#work", "pf-desktop-work"],
    ["#manifesto", "pf-desktop-manifesto"],
    [".caps", "pf-desktop-caps"],
    ["#contact", "pf-desktop-contact"],
];
for (const [sel, name] of shots) {
    await d.locator(sel).scrollIntoViewIfNeeded();
    await d.waitForTimeout(1300);
    await d.screenshot({ path: `screenshots/${name}.png` });
}
// Manifest-Scrub: opacity der Wort-Spans über die Scroll-Position samplen
await d.locator("#manifesto").scrollIntoViewIfNeeded();
const scrub = await d.evaluate(() => {
    const ws = [...document.querySelectorAll("#manifesto .w")];
    return ws.length
        ? { words: ws.length, first: getComputedStyle(ws[0]).opacity, last: getComputedStyle(ws[ws.length - 1]).opacity }
        : null;
});
console.log("manifesto scrub state:", JSON.stringify(scrub));
await d.close();

// --- Mobil (390 px) ---
const m = await page(390, 844);
await m.goto(url, { waitUntil: "domcontentloaded" });
await m.waitForTimeout(2400);
await m.screenshot({ path: "screenshots/pf-mobile-hero.png" });
const hScroll = await m.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log("mobile horizontal overflow px:", hScroll);
for (const [sel, name] of shots) {
    await m.locator(sel).scrollIntoViewIfNeeded();
    await m.waitForTimeout(1300);
    await m.screenshot({ path: `screenshots/${name.replace("desktop", "mobile")}.png` });
}
await m.screenshot({ path: "screenshots/pf-mobile-full.png", fullPage: true });
await m.close();

// --- Reduced Motion: alles sofort sichtbar? ---
const r = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await routeCdn(r);
await r.emulateMedia({ reducedMotion: "reduce" });
await r.goto(url, { waitUntil: "domcontentloaded" });
await r.waitForTimeout(600);
const rmOk = await r.evaluate(() => {
    const els = [...document.querySelectorAll("[data-reveal],[data-intro],.line-inner")];
    return els.every((e) => getComputedStyle(e).opacity === "1");
});
console.log("reduced-motion all visible:", rmOk);
await r.screenshot({ path: "screenshots/pf-reduced-motion.png" });
await r.close();

await browser.close();
console.log("console errors:", errors.length ? errors : "none");
console.log("failed requests:", failed.length ? failed : "none");
