/**
 * Walk the UR-Create journey end to end and capture EVERY question screen
 * (desktop + mobile) plus the refine/concept screen — the studio counterpart
 * to shoot-sections.mjs. Use it to verify any change to the design-engine
 * journey at the real render (project rule: never judge a flow from code).
 *
 *   node scripts/shoot-journey.mjs             # both viewports → screenshots/journey/
 *   node scripts/shoot-journey.mjs desktop     # one viewport
 *
 * Answers deterministically (always the first option, slider at 0.78,
 * duo-gradient with two swatches), so runs are comparable across sessions.
 * Also samples 5 frames of the genesis→silhouette weave right after the
 * category pick (journey/<vp>-weave-*.png) — the morph must be judged from
 * frames, not stills. Fails loudly on page errors.
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

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
console.log("Shooting journey at", base);

const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function walk(vp) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
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
    const f = `${OUT}/${vp.name}-${String(step).padStart(2, "0")}-${label}.png`;
    if (el) await el.screenshot({ path: f }); else await page.screenshot({ path: f });
    console.log("wrote", f);
  };
  const questionText = () => page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");

  for (let i = 0; i < 24; i++) {
    if (await page.$("#de-concept-grid")) break; // refine screen reached
    const q = await questionText();
    const slug = (q || "q").toLowerCase().replace(/[^a-z0-9äöü]+/g, "-").slice(0, 40);
    await shoot(slug || "question");

    if (await page.$(".de-tot")) {
      await page.click(".de-tot .de-tot-panel:first-child");
    } else if (await page.$(".de-cards")) {
      const isCategory = (q || "").includes("entsteht") || /making/i.test(q || "");
      await page.click(".de-cards .de-card");
      if (isCategory) {
        // sample the weave-in over ~600 ms — the beat must be judged as motion
        for (let f = 0; f < 5; f++) {
          await page.waitForTimeout(120);
          const el = await page.$("#de-preview");
          if (el) await el.screenshot({ path: `${OUT}/${vp.name}-weave-${f}.png` });
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
