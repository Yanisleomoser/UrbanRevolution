/* Permanenter Verify-Check: Sprachauflösung (Englisch Tier 1).
   ?lang=en → EN vor dem ersten Paint + persistiert; navigator en/de → en/de;
   Toggle strippt den Param; Share-URL trägt die Sprache.
   Run: node scripts/verify-lang.mjs   (bootet eigenen Static-Server;
   BASE=http://localhost:8080/ nutzt stattdessen einen laufenden Server) */
import { chromium } from "playwright-core";
import { routeCdnThroughNode } from "./cdn-route.mjs";
import { startServer } from "./static-server.mjs";

const ownServer = process.env.BASE ? null : await startServer();
const BASE = process.env.BASE || `http://127.0.0.1:${ownServer.address().port}/`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;
const check = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ FAIL: ") + msg); if (!cond) failures++; };

async function freshPage(locale, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale });
  const page = await ctx.newPage();
  await routeCdnThroughNode(page);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.I18N, null, { timeout: 15000 });
  return { ctx, page };
}

// 1 · ?lang=en gewinnt (auch bei DE-Browser) und wird persistiert.
{
  const { ctx, page } = await freshPage("de-DE", BASE + "?lang=en");
  check(await page.getAttribute("html", "lang") === "en", "?lang=en → <html lang=en> trotz DE-Browser");
  check(await page.evaluate(() => window.I18N.getLang()) === "en", "I18N.getLang() === en");
  check(await page.evaluate(() => localStorage.getItem("urev_lang")) === "en", "?lang=en wird persistiert");
  const title = await page.title();
  check(/future of fashion/i.test(title), `EN <title> ("${title}")`);
  // Share-URL trägt die Sprache
  const url = await page.evaluate(() => window.DesignShare.buildUrl({ category: "dress" }));
  check(url.includes("?lang=en#dna="), `Share-URL trägt ?lang=en (${url.slice(0, 60)}…)`);
  // Toggle auf DE strippt den Parameter aus der URL
  await page.evaluate(() => window.I18N.setLang("de"));
  const search = await page.evaluate(() => location.search);
  check(!search.includes("lang"), `Toggle → ?lang aus der URL gestrippt (search="${search}")`);
  check(await page.evaluate(() => localStorage.getItem("urev_lang")) === "de", "Toggle-Wahl persistiert (de)");
  await ctx.close();
}

// 2 · EN-Browser ohne Param/Speicher → EN.
{
  const { ctx, page } = await freshPage("en-US", BASE);
  check(await page.getAttribute("html", "lang") === "en", "navigator en-US → EN by default");
  await ctx.close();
}

// 3 · DE-Browser ohne Param/Speicher → DE (Default unverändert).
{
  const { ctx, page } = await freshPage("de-CH", BASE);
  check(await page.getAttribute("html", "lang") === "de", "navigator de-CH → DE");
  await ctx.close();
}

// 4 · Unsupported Browser-Sprache → DE (Marken-Default).
{
  const { ctx, page } = await freshPage("fr-FR", BASE);
  check(await page.getAttribute("html", "lang") === "de", "navigator fr-FR → DE (x-default)");
  await ctx.close();
}

// 5 · EN-Screenshot (Hero) — Sichtprüfung.
{
  const { ctx, page } = await freshPage("de-DE", BASE + "?lang=en");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "screenshots/lang-en-hero.png" });
  await ctx.close();
}

await browser.close();
if (ownServer) ownServer.close();
console.log(failures ? `\n✗ ${failures} failure(s)` : "\n✓ Sprachauflösung verifiziert");
process.exit(failures ? 1 : 0);
