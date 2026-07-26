/**
 * EIN Walker für alle Studio-Guards.
 *
 * Warum: jeder Guard trug bisher seine eigene Kopie der „klick dich durch die
 * Reise"-Schleife. Als der Frei-Text-Auftakt (#444) und später die
 * Startpunkt-Galerie (B4) dazukamen, rotteten die Kopien einzeln und still —
 * sie brachen ab und stürzten danach auf einem null-Element, statt rot zu
 * melden. Drei Guards prüften dadurch über Tage gar nichts.
 *
 * Der Walker kennt jeden Screen-Typ EINMAL. Ein Guard, der auf einem Screen
 * etwas Bestimmtes tun muss (Bold-Panel wählen, zwei Farben setzen, eine
 * bestimmte Kategorie), überschreibt genau diesen Screen über `on` — der Rest
 * bleibt geteilt. Kommt ein neuer Modalitäts-Screen dazu, wird er hier
 * ergänzt und alle Guards laufen weiter.
 *
 *   import { walkJourney, SCREENS } from "./journey-walk.mjs";
 *   const ok = await walkJourney(page, {
 *     until: (p) => p.$(".de-regions"),          // Ziel-Screen
 *     on: { thisOrThat: async (p) => { … } },     // eigene Geste
 *   });
 */

/** Reihenfolge zählt: der erste Treffer gewinnt. */
export const SCREENS = [
  ["describe", ".de-describe"],
  ["thisOrThat", ".de-tot"],
  ["gallery", ".de-gallery"],
  ["regions", ".de-regions"],
  ["palette", ".de-palette"],
  ["ranking", ".de-rank"],
  ["slider", ".de-range"],
  ["cards", ".de-cards"],
];

const qText = (page) =>
  page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");

/** Welcher Screen steht gerade? `null`, wenn keiner davon passt. */
export async function currentScreen(page) {
  for (const [name, sel] of SCREENS) {
    if (await page.$(sel)) return name;
  }
  return null;
}

// Die neutrale Geste pro Screen: „nimm das Angebotene an und geh weiter".
// Guards, die auf einem Screen etwas Bestimmtes brauchen, überschreiben ihn.
const DEFAULT = {
  describe: async (page) => { await page.click(".de-describe-skip"); },
  thisOrThat: async (page) => { await page.click(".de-tot .de-tot-panel:first-child"); },
  // Der stille Weg durch die Startpunkt-Galerie („von vorn") lässt die Reise
  // dahinter identisch zu der Zeit vor B4 — Guards, die etwas anderes prüfen,
  // sollen von ihr nicht abgelenkt werden.
  gallery: async (page) => { await page.click(".de-gallery-skip"); },
  regions: async (page) => { await page.click("#de-body .de-confirm"); },
  ranking: async (page) => { await page.click("#de-body .de-confirm"); },
  palette: async (page) => {
    const sw = await page.$$(".de-palette .de-palette-swatch");
    if (sw[2]) await sw[2].click();
    await page.waitForTimeout(150);
    await page.click("#de-body .de-confirm");
  },
  slider: async (page) => {
    await page.$eval(".de-range", (n) => { n.value = 78; n.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.waitForTimeout(250);
    await page.click("#de-body .de-confirm");
  },
  cards: async (page, { question, category }) => {
    // Die Kategorie-Frage ist die einzige, bei der die Wahl die ganze weitere
    // Reise bestimmt — deshalb per Name, nicht „die erste Karte".
    const isCat = (question || "").includes("entsteht") || /making/i.test(question || "");
    if (isCat) await page.click(`.de-cards .de-card[aria-label="${category}"]`);
    else await page.click(".de-cards .de-card");
    await page.waitForTimeout(500);
    // Mehrfachwahl-Screens bleiben nach einem Klick stehen und wollen Confirm.
    if ((await qText(page)) === question) {
      const c = await page.$("#de-body .de-confirm");
      if (c) await c.click().catch(() => {});
    }
  },
};

/**
 * Klickt die Reise weiter, bis `until` wahr wird.
 * @returns {Promise<boolean>} true, wenn das Ziel erreicht wurde.
 */
export async function walkJourney(page, opts = {}) {
  const o = opts;
  const on = o.on || {};
  const category = o.category || "Jacke";
  const max = o.max || 24;
  const settle = o.settle === undefined ? 650 : o.settle;
  for (let i = 0; i < max; i++) {
    if (o.until && await o.until(page)) return true;
    if (o.stopAt && await o.stopAt(page)) return false;
    const screen = await currentScreen(page);
    if (!screen) return false;
    const question = await qText(page);
    const step = on[screen] || DEFAULT[screen];
    if (!step) return false;
    await step(page, { question, category, screen });
    await page.waitForTimeout(settle);
  }
  return o.until ? !!(await o.until(page)) : false;
}
