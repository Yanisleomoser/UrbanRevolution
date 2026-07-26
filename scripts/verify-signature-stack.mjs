/**
 * Permanent regression guard (Runde 3): stapelbare Signaturen am echten Render.
   Bold-Pfad (Laut → energy 0.8) bis zum Signature-Screen, dann:
   zwei Karten stapeln, „Keins" räumt, wieder stapeln, committen —
   und die DNA (Resume-Blob) muss BEIDE Signaturen tragen.
 *
 *   node scripts/verify-signature-stack.mjs   (bootet den eigenen Static-Server)
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";
import { walkJourney } from "./journey-walk.mjs";

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = 0;
const check = (c, m) => { console.log(`  ${c ? "✓" : "✗ FAIL:"} ${m}`); if (!c) failed++; };

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
await routeCdnThroughNode(page);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + "/?dseed=7#design", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
await page.waitForTimeout(900);

const qText = () => page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
const sigSeen = await walkJourney(page, {
  settle: 700,
  until: async (p) => /stapelbar/i.test(await p.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "")),
  on: {
    // BOLD wählen (letztes Panel) → energy hoch → Signature-Node bleibt offen.
    // Das ist der EINZIGE Screen, auf dem dieser Guard etwas Eigenes will.
    thisOrThat: async (p) => {
      const panels = await p.$$(".de-tot .de-tot-panel");
      await panels[panels.length - 1].click();
    },
  },
});
check(sigSeen, `der Bold-Pfad erreicht den Signature-Screen („${(await qText()).trim()}")`);

if (sigSeen) {
  const cards = await page.$$(".de-cards .de-card");
  check(cards.length >= 3, `Signature-Karten vorhanden (${cards.length})`);
  const confirmDisabled = await page.$eval("#de-body .de-confirm", (n) => n.disabled);
  check(confirmDisabled === true, "Confirm startet gesperrt (Multi-Select)");
  // Karte 2 + 3 stapeln (Karte 1 = exklusives „Keins“).
  await cards[1].click(); await cards[2].click();
  let pressed = await page.$$eval(".de-cards .de-card[aria-pressed='true']", (els) => els.length);
  check(pressed === 2, `zwei Signaturen gleichzeitig gewählt (${pressed})`);
  // „Keins“ räumt den Stapel.
  await cards[0].click();
  pressed = await page.$$eval(".de-cards .de-card[aria-pressed='true']", (els) => els.length);
  const nonePressed = await cards[0].evaluate((n) => n.getAttribute("aria-pressed"));
  check(pressed === 1 && nonePressed === "true", "„Keins“ ist exklusiv: räumt den Stapel und steht allein");
  // Wieder stapeln → „Keins“ fliegt automatisch raus.
  await cards[1].click();
  const noneAfter = await cards[0].evaluate((n) => n.getAttribute("aria-pressed"));
  check(noneAfter === "false", "ein Stapel-Pick entfernt das exklusive „Keins“");
  await cards[2].click();
  await page.click("#de-body .de-confirm");
  await page.waitForTimeout(900);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("urev_journey_v1") || "null"));
  const sig = saved && saved.dna && saved.dna.signature;
  check(Array.isArray(sig) && sig.length === 2, `die DNA trägt BEIDE Signaturen (${JSON.stringify(sig)})`);
  const svg = await page.$eval("#de-preview", (n) => n.innerHTML);
  check(svg.includes("stroke-dasharray"), "der Flat zeichnet die gestapelten Details (Dash-Signaturen sichtbar)");
}
check(errors.length === 0, `keine Page-Errors (${errors.join(" | ") || "clean"})`);

await page.screenshot({ path: "screenshots/journey/signature-stack-check.png" });
await browser.close();
server.close();
console.log(failed ? "✗ signature stack FAILED" : "✓ signature stack verified");
process.exit(failed ? 1 : 0);
