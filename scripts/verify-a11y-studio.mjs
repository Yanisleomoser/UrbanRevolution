/**
 * Targeted headless verification for the studio a11y/i18n hardening.
 * Boots the real site and drives the exact surfaces the change touches:
 *  - hotspot modality: focus lands on the first revealed choice, returns to the
 *    dot after a pick; the strip is a labelled group.
 *  - cards modality: every tile button carries an explicit aria-label.
 *  - measure presets + ownership size buttons: aria-pressed mirrors selection.
 *  - preset-person buttons: accessible name is localised (DE default → EN).
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";

let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fails++; };

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("  ✗ pageerror:", e.message); fails++; });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.DEModalities && window.DEVisuals && window.I18N);

console.log("\n— hotspot modality: focus + group labelling —");
const hotspot = await page.evaluate(() => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const node = {
    question: { de: "Frage", en: "Question" },
    regions: [{
      id: "collar", label: { de: "Kragen", en: "Collar" }, x: 50, y: 20,
      choices: [
        { id: "pointed", label: { de: "Spitz", en: "Pointed" }, effects: { set: {} } },
        { id: "round", label: { de: "Rund", en: "Round" } },
      ],
    }],
  };
  const ctx = { lang: "de", dna: null, t: (k) => k, commit() {}, live() {} };
  window.DEModalities.hotspot(host, node, ctx);
  const dot = host.querySelector(".de-hotspot-dot");
  dot.click(); // reveal choices
  const strip = host.querySelector(".de-hotspot-strip");
  const afterReveal = {
    stripVisible: !strip.hidden,
    role: strip.getAttribute("role"),
    label: strip.getAttribute("aria-label"),
    focusIsFirstChoice: document.activeElement === strip.querySelector("button"),
    firstChoiceText: strip.querySelector("button").textContent,
  };
  strip.querySelector("button").click(); // pick first choice
  const afterPick = {
    stripHidden: strip.hidden,
    focusReturnedToDot: document.activeElement === dot,
  };
  host.remove();
  return { afterReveal, afterPick };
});
ok(hotspot.afterReveal.stripVisible, "choice strip is revealed on dot tap");
ok(hotspot.afterReveal.role === "group", "strip is role=group");
ok(hotspot.afterReveal.label === "Kragen", `strip aria-label names the region ("${hotspot.afterReveal.label}")`);
ok(hotspot.afterReveal.focusIsFirstChoice, `focus moves to first choice ("${hotspot.afterReveal.firstChoiceText}")`);
ok(hotspot.afterPick.stripHidden, "strip hides after a pick");
ok(hotspot.afterPick.focusReturnedToDot, "focus returns to the tapped dot after a pick");

console.log("\n— cards modality: explicit aria-label per tile —");
const cards = await page.evaluate(() => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const node = {
    id: "test", question: { de: "Frage", en: "Q" },
    choices: [
      { id: "a", label: { de: "Alpha", en: "Alpha" } },
      { id: "b", label: { de: "Beta", en: "Beta" } },
    ],
  };
  window.DEModalities.cards(host, node, { lang: "de", dna: null, t: (k) => k, commit() {} });
  const labels = [...host.querySelectorAll(".de-card")].map((b) => b.getAttribute("aria-label"));
  host.remove();
  return labels;
});
ok(cards.length === 2 && cards[0] === "Alpha" && cards[1] === "Beta",
  `each card button has its label as aria-label (${JSON.stringify(cards)})`);

console.log("\n— measure presets: aria-pressed mirrors selection —");
const presets = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".preset-btn")];
  const m = btns.find((b) => b.dataset.preset === "M");
  m.click();
  return btns.map((b) => ({ p: b.dataset.preset, pressed: b.getAttribute("aria-pressed") }));
});
const mRow = presets.find((r) => r.p === "M");
ok(mRow && mRow.pressed === "true", "clicked preset M → aria-pressed=true");
ok(presets.filter((r) => r.p !== "M").every((r) => r.pressed === "false"),
  "all other presets → aria-pressed=false");

console.log("\n— ownership size buttons: aria-pressed present after sync —");
const oeSizes = await page.evaluate(() =>
  [...document.querySelectorAll("#oe-sizes .oe-size")].map((b) => b.getAttribute("aria-pressed")));
ok(oeSizes.length === 4 && oeSizes.every((v) => v === "true" || v === "false"),
  `oe-size buttons expose aria-pressed (${JSON.stringify(oeSizes)})`);

console.log("\n— preset-person buttons: localised accessible name (DE → EN) —");
const de = await page.evaluate(() =>
  [...document.querySelectorAll("#own-presets .own-preset")].map((b) => b.getAttribute("aria-label")));
ok(de[0] === "Vorschau-Person 1" && de[5] === "Vorschau-Person 6",
  `DE default labels are German (${de[0]} … ${de[5]})`);
await page.evaluate(() => window.I18N.setLang("en"));
const en = await page.evaluate(() =>
  [...document.querySelectorAll("#own-presets .own-preset")].map((b) => b.getAttribute("aria-label")));
ok(en[0] === "Preview person 1" && en[5] === "Preview person 6",
  `after EN toggle labels switch to English (${en[0]} … ${en[5]})`);
ok(!en.some((l) => /Person [1-6]$/.test(l) && !/Preview/.test(l)),
  "no stale hardcoded English 'Person N' leaks through");

await browser.close();
server.close();
console.log(fails ? `\n✗ ${fails} check(s) failed` : "\n✓ all targeted a11y checks passed");
process.exit(fails ? 1 : 0);
