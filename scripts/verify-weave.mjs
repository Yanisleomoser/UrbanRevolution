/**
 * Slice-5 verification: sample the §5.2 re-tension and the §5.3 weave hero
 * beat as MOTION (curves over the full duration), not stills.
 *
 *   node verify-weave.mjs [category]   (node scripts/verify-weave.mjs)
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const CATEGORY = (process.argv[2] || "jacket").trim();
const CAT_LABEL = { jacket: "Jacke", hoodie: "Hoodie", tshirt: "T-Shirt", shirt: "Hemd", pants: "Hose", dress: "Kleid" };
const OUT = "screenshots/verify-weave";
mkdirSync(OUT, { recursive: true });

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await routeCdnThroughNode(page);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(base + "/#design", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector("#de-body .de-question", { timeout: 20000 });
await page.waitForTimeout(1500);

// ── 1. Genesis idle state: nebula present, tempo vars set ──────────────────
const genesis = await page.evaluate(() => {
  const wrap = document.querySelector("#de-preview .de-garment-wrap.is-genesis");
  const neb = wrap && wrap.querySelector(".de-nebula");
  const anims = neb ? neb.getAnimations({ subtree: false }).map((a) => ({ name: a.animationName, dur: a.effect.getTiming().duration, state: a.playState })) : [];
  return {
    hasWrap: !!wrap, hasNebula: !!neb,
    breath: wrap ? wrap.style.getPropertyValue("--neb-breath") : null,
    pulse: wrap ? wrap.style.getPropertyValue("--neb-pulse") : null,
    pathCount: neb ? neb.querySelectorAll("path").length : 0,
    anims,
  };
});
console.log("GENESIS idle:", JSON.stringify(genesis));

// ── 2. Re-tension (§5.2): answer the first mood question, sample a thread's
//      `d` + classes every ~70 ms across the 620 ms tween ──────────────────
await page.evaluate(() => {
  window.__samples = [];
  const el = document.querySelector("#de-preview");
  const t0 = performance.now();
  const tick = () => {
    const wrap = el.querySelector(".de-garment-wrap");
    const p = wrap && wrap.querySelector(".de-nebula path:nth-of-type(4)");
    window.__samples.push({
      t: Math.round(performance.now() - t0),
      retension: wrap ? wrap.classList.contains("is-retension") : null,
      d: p ? p.getAttribute("d").slice(0, 60) : null,
      breath: wrap ? wrap.style.getPropertyValue("--neb-breath") : null,
    });
    if (performance.now() - t0 < 1400) setTimeout(tick, 70);
  };
  tick();
});
// answer the first question, whatever modality it is (mirrors shoot-journey)
async function answerCurrent() {
  const q = await page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
  if (await page.$(".de-tot")) await page.click(".de-tot .de-tot-panel:first-child");
  else if (await page.$(".de-cards")) {
    await page.click(".de-cards .de-card");
    await page.waitForTimeout(500);
    const q2 = await page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
    if (q2 === q) { const c = await page.$("#de-body .de-confirm"); if (c) await c.click().catch(() => {}); }
  } else if (await page.$(".de-range")) {
    await page.$eval(".de-range", (n) => { n.value = 60; n.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.click("#de-body .de-confirm");
  } else if (await page.$(".de-rank")) await page.click("#de-body .de-confirm");
}
await answerCurrent();
await page.waitForTimeout(1600);
const retension = await page.evaluate(() => window.__samples);
console.log("RETENSION samples:");
retension.forEach((s) => console.log(`  t=${String(s.t).padStart(4)}  retension=${s.retension}  breath=${s.breath}  d=${s.d}`));

// ── 3. Walk to the category question ───────────────────────────────────────
const questionText = () => page.$eval("#de-body .de-question", (n) => n.textContent).catch(() => "");
let clicked = false;
for (let i = 0; i < 10 && !clicked; i++) {
  const q = await questionText();
  const isCategory = (q || "").includes("entsteht") || /making/i.test(q || "");
  if (isCategory) {
    // §5.3: instrument BEFORE the pick — sample outline dashoffset, panel
    // opacity, seams opacity, ghost presence every ~90 ms over ~2.2 s.
    await page.evaluate(() => {
      window.__weave = [];
      const el = document.querySelector("#de-preview");
      const t0 = performance.now();
      const tick = () => {
        const wrap = el.querySelector(".de-garment-wrap");
        const outline = wrap && wrap.querySelector(".gs-outline");
        const int = wrap && wrap.querySelector(".gs-int");
        const seams = wrap && wrap.querySelector(".gs-seams");
        const ghost = el.querySelector(".de-weave-ghost");
        window.__weave.push({
          t: Math.round(performance.now() - t0),
          weave: wrap ? wrap.classList.contains("is-weave") : null,
          ghost: ghost ? Number(getComputedStyle(ghost).opacity).toFixed(2) : null,
          dash: outline ? Number(getComputedStyle(outline).strokeDashoffset.replace("px", "")).toFixed(3) : null,
          fill: int ? Number(getComputedStyle(int).opacity).toFixed(2) : null,
          seams: seams ? Number(getComputedStyle(seams).opacity).toFixed(2) : null,
        });
        if (performance.now() - t0 < 2400) setTimeout(tick, 90);
      };
      tick();
    });
    await page.click(`.de-cards .de-card[aria-label="${CAT_LABEL[CATEGORY]}"]`);
    // frame series in parallel with the in-page sampling
    for (let f = 0; f < 12; f++) {
      const el = await page.$("#de-preview");
      if (el) await el.screenshot({ path: `${OUT}/${CATEGORY}-weave-${String(f).padStart(2, "0")}.png` }).catch(() => {});
      await page.waitForTimeout(120);
    }
    clicked = true;
    break;
  }
  await answerCurrent();
  await page.waitForTimeout(700);
}
await page.waitForTimeout(800);
const weave = await page.evaluate(() => window.__weave || []);
console.log("WEAVE samples (dash 1→0 = outline draws; fill/seams 0→1 AFTER):");
weave.forEach((s) => console.log(`  t=${String(s.t).padStart(4)}  weave=${s.weave} ghost=${s.ghost}  dash=${s.dash}  seams=${s.seams}  fill=${s.fill}`));

// final still after the beat
const el = await page.$("#de-preview");
if (el) await el.screenshot({ path: `${OUT}/${CATEGORY}-final.png` });
console.log("pageerrors:", errors.length ? errors : "none");
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
