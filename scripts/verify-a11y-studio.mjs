/**
 * Targeted headless verification for the studio a11y/i18n hardening.
 * Boots the real site and drives the exact surfaces the change touches:
 *  - regions modality (Detail-Atelier): the picker is a labelled group, focus
 *    lands on the first option and returns to the hotspot after a pick.
 *  - cards modality: every tile button carries an explicit aria-label.
 *  - measure presets + ownership size buttons: aria-pressed mirrors selection.
 *  - preset-person buttons: accessible name is localised (DE default → EN).
 *
 * Der erste Block lief NIE: er rief `DEModalities.hotspot` mit einem selbst
 * gebauten Knoten auf — die Modalität heisst `regions`, und der Guard stürzte
 * an dieser Zeile ab, statt irgendetwas zu prüfen. Ein synthetischer Knoten
 * bildet die API zudem nur nach; jetzt prüft der Block den ECHTEN Screen.
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fails++; };

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
// Locale pinnen: die Sprache löst sich aus navigator.languages auf, und in
// einem en-US-Container prüfte der DE-Block unten still eine englische Seite
// gegen deutsche Erwartungen (er war rot, ohne dass etwas kaputt war).
const page = await browser.newPage({ locale: "de-DE" });
page.on("pageerror", (e) => { console.log("  ✗ pageerror:", e.message); fails++; });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.DEModalities && window.DEVisuals && window.I18N);

console.log("\n— regions modality (Detail-Atelier): focus + group labelling —");
{
  // Deterministischer Mini-Walk zum echten Detail-Atelier (wie in
  // verify-atelier.mjs) — jede Modalität auf dem Weg mit ihrer eigenen Geste.
  const ap = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  await routeCdnThroughNode(ap);
  ap.on("pageerror", (e) => { console.log("  ✗ pageerror:", e.message); fails++; });
  await ap.goto(url + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await ap.waitForSelector("#de-body .de-question", { timeout: 20000 });
  await ap.waitForTimeout(1200);
  let reached = false;
  for (let i = 0; i < 22; i++) {
    if (await ap.$(".de-regions")) { reached = true; break; }
    if (await ap.$("#de-concept-grid")) break;
    const q = await ap.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
    if (await ap.$(".de-describe")) await ap.click(".de-describe-skip");
    else if (await ap.$(".de-tot")) await ap.click(".de-tot .de-tot-panel:first-child");
    else if (await ap.$(".de-gallery")) await ap.click(".de-gallery-skip");
    else if (await ap.$(".de-rank")) await ap.click("#de-body .de-confirm");
    else if (await ap.$(".de-cards")) {
      if ((q || "").includes("entsteht")) await ap.click('.de-cards .de-card[aria-label="Jacke"]');
      else await ap.click(".de-cards .de-card");
      await ap.waitForTimeout(500);
      const q2 = await ap.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
      if (q2 === q) { const c = await ap.$("#de-body .de-confirm"); if (c) await c.click().catch(() => {}); }
    } else if (await ap.$(".de-range")) {
      await ap.$eval(".de-range", (n) => { n.value = 78; n.dispatchEvent(new Event("input", { bubbles: true })); });
      await ap.waitForTimeout(250);
      await ap.click("#de-body .de-confirm");
    } else if (await ap.$(".de-palette")) {
      await ap.click(".de-scheme-tabs .de-scheme-tab:nth-child(2)");
      const sw = await ap.$$(".de-palette .de-palette-swatch");
      await sw[2].click(); await sw[6].click();
      await ap.waitForTimeout(200);
      await ap.click("#de-body .de-confirm");
    } else break;
    await ap.waitForTimeout(650);
  }
  ok(reached, "der Walk erreicht das Detail-Atelier (sonst prüft dieser Block nichts)");
  if (reached) {
    await ap.waitForTimeout(700);
    // Mit der TASTATUR öffnen — nur dann muss der Fokus in den Picker wandern
    // (per Tipp bleibt er bewusst draussen, focus-visible-Gate).
    const spot = await ap.$(".de-hotspot");
    await spot.focus();
    await ap.keyboard.press("Enter");
    await ap.waitForTimeout(600);
    const opened = await ap.evaluate(() => {
      const p = document.querySelector(".de-region-picker");
      const s = document.querySelector(".de-hotspot[aria-expanded='true']");
      const first = p && p.querySelector(".de-region-opt");
      return {
        visible: !!p && !p.hidden,
        role: p && p.getAttribute("role"),
        label: (p && p.getAttribute("aria-label")) || "",
        spotLabel: (s && s.getAttribute("aria-label")) || "",
        expanded: !!s,
        focusIsFirstOption: !!first && document.activeElement === first,
        firstText: (first && first.textContent.trim().slice(0, 24)) || "",
      };
    });
    ok(opened.visible, "der Picker öffnet sich auf der Tastatur");
    ok(opened.expanded, "der Hotspot meldet aria-expanded=true");
    ok(opened.role === "group", `der Picker ist role=group (${opened.role})`);
    ok(opened.label.length > 0 && opened.spotLabel.startsWith(opened.label),
      `das aria-label benennt genau diese Partie ("${opened.label}" in "${opened.spotLabel}")`);
    ok(opened.focusIsFirstOption, `der Fokus landet auf der ersten Option ("${opened.firstText}")`);
    // Welcher Hotspot war es? Die Rückkehr muss GENAU dorthin gehen — „auf
    // irgendeinen Hotspot" wäre kein Beleg (und das aria-label ändert sich
    // durch die Wahl, taugt also nicht als Schlüssel).
    const spotIndex = await ap.evaluate(() =>
      [...document.querySelectorAll(".de-hotspot")].findIndex((n) => n.getAttribute("aria-expanded") === "true"));
    await ap.keyboard.press("Enter"); // die fokussierte Option wählen
    await ap.waitForTimeout(700);
    const picked = await ap.evaluate((i) => {
      const p = document.querySelector(".de-region-picker");
      const spots = [...document.querySelectorAll(".de-hotspot")];
      return {
        hidden: !p || p.hidden,
        focusBackOnSpot: i >= 0 && document.activeElement === spots[i],
        where: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : "—",
      };
    }, spotIndex);
    ok(picked.hidden, "nach der Wahl schliesst der Picker");
    ok(picked.focusBackOnSpot,
      `der Fokus kehrt auf GENAU diesen Hotspot zurück, nicht an <body> (jetzt: ${picked.where})`);
  }
  await ap.close();
}

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
