/**
 * Walk the UR-Create journey end to end and capture EVERY question screen
 * (desktop + mobile) plus the refine/concept screen — the studio counterpart
 * to shoot-sections.mjs. Use it to verify any change to the design-engine
 * journey at the real render (project rule: never judge a flow from code).
 *
 *   node scripts/shoot-journey.mjs                    # both viewports → screenshots/journey/
 *   node scripts/shoot-journey.mjs desktop            # one viewport
 *   node scripts/shoot-journey.mjs desktop dress      # walk a specific category branch
 *
 * Answers deterministically (always the first option, slider at 0.78,
 * duo-gradient with two swatches), so runs are comparable across sessions.
 * Pages boot with locale de-DE — the deterministic walk clicks GERMAN
 * aria-labels ("Jacke"), and a container whose navigator.language is en-US
 * would otherwise resolve the EN UI and hang on the first category click.
 * Also samples 10 frames of the genesis→silhouette weave right after the
 * category pick (journey/<vp>-weave-*.png), spread over the full ~1.7 s hero
 * beat — the moment must be judged from frames, not stills. Fails loudly on
 * page errors.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const OUT = "screenshots/journey";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const only = (process.argv[2] || "").trim();
const viewports = only ? VIEWPORTS.filter((v) => v.name === only) : VIEWPORTS;
// Which garment branch to walk (default: first card = jacket). The category
// card's accessible name is its localised label, so click by aria-label.
const CATEGORY = (process.argv[3] || "jacket").trim();
const CAT_LABEL = { jacket: "Jacke", hoodie: "Hoodie", tshirt: "T-Shirt", shirt: "Hemd", pants: "Hose", dress: "Kleid" };

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
console.log("Shooting journey at", base);

const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function walk(vp) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, locale: "de-DE" });
  await routeCdnThroughNode(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/#design", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
  await page.waitForTimeout(1200);

  let step = 0;
  const shoot = async (label) => {
    step += 1;
    const el = await page.$("#engine-host");
    if (el) await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(450);
    const f = `${OUT}/${vp.name}-${CATEGORY}-${String(step).padStart(2, "0")}-${label}.png`;
    if (el) await el.screenshot({ path: f }); else await page.screenshot({ path: f });
    console.log("wrote", f);
  };
  const questionText = () => page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");

  for (let i = 0; i < 24; i++) {
    if (await page.$("#de-concept-grid")) break; // refine screen reached
    const q = await questionText();
    const slug = (q || "q").toLowerCase().replace(/[^a-z0-9äöü]+/g, "-").slice(0, 40);
    await shoot(slug || "question");

    if (await page.$(".de-describe")) {
      // Auftakts-Modalität „describe": der deterministische Referenz-Walk
      // nimmt den Skip-Chip (klassischer Pfad); die Describe-Interaktion
      // selbst prüft scripts/verify-describe.mjs.
      await page.click(".de-describe-skip");
    } else if (await page.$(".de-tot")) {
      await page.click(".de-tot .de-tot-panel:first-child");
    } else if (await page.$(".de-regions")) {
      // Detail atelier: open every hotspot in DOM order, pick the LAST option
      // of each micro-picker (never the first = often "none", which would hide
      // the very details the screenshots must show). Hotspot buttons are
      // stable elements — the flat repaints under them.
      const spotCount = await page.$$eval(".de-hotspot", (els) => els.length);
      for (let s = 0; s < spotCount; s++) {
        const spot = (await page.$$(".de-hotspot"))[s];
        await spot.click();
        await page.waitForTimeout(250);
        if (s === 0) await shoot("regions-picker-open");
        const opts = await page.$$(".de-region-picker .de-region-opt");
        if (opts.length) await opts[opts.length - 1].click();
        await page.waitForTimeout(250);
      }
      await shoot("regions-all-set");
      await page.click("#de-body .de-confirm");
    } else if (await page.$(".de-cards")) {
      const isCategory = (q || "").includes("entsteht") || /making/i.test(q || "");
      if (isCategory && CAT_LABEL[CATEGORY]) await page.click(`.de-cards .de-card[aria-label="${CAT_LABEL[CATEGORY]}"]`);
      else await page.click(".de-cards .de-card");
      if (isCategory) {
        // sample the weave-in over its full ~1.7 s (ghost converge → outline
        // draw → seams → fill → sweep) — the beat must be judged as motion
        for (let f = 0; f < 10; f++) {
          await page.waitForTimeout(150);
          const el = await page.$("#de-preview");
          if (el) await el.screenshot({ path: `${OUT}/${vp.name}-${CATEGORY}-weave-${f}.png` });
        }
      }
      // single-select commits on click; only confirm if the SAME question is
      // still up (multi-select). Otherwise we'd fat-finger the next screen.
      await page.waitForTimeout(500);
      const q2 = await questionText();
      if (q2 === q) { const c = await page.$("#de-body .de-confirm"); if (c) await c.click().catch(() => {}); }
    } else if (await page.$(".de-range")) {
      await page.$eval(".de-range", (n) => { n.value = 78; n.dispatchEvent(new Event("input", { bubbles: true })); });
      await page.waitForTimeout(300);
      await page.click("#de-body .de-confirm");
    } else if (await page.$(".de-palette")) {
      await page.click(".de-scheme-tabs .de-scheme-tab:nth-child(2)");
      const sw = await page.$$(".de-palette .de-palette-swatch");
      await sw[2].click(); await sw[6].click();
      await page.waitForTimeout(200);
      await page.click("#de-body .de-confirm");
    } else if (await page.$(".de-rank")) {
      await page.click("#de-body .de-confirm");
    } else {
      console.warn("unknown modality at:", q);
      break;
    }
    await page.waitForTimeout(650);
  }

  await page.waitForSelector("#de-concept-grid", { timeout: 8000 }).catch(() => {});
  await shoot("refine-concepts");
  console.log(vp.name, "steps:", step, "| pageerrors:", errors.length ? errors : "none");
  await page.close();
  return errors.length;
}

let failed = 0;
try {
  for (const vp of viewports) failed += await walk(vp);
} finally {
  await browser.close();
  server.close();
}
if (failed) { console.error("journey walk hit page errors"); process.exit(1); }
