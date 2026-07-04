/**
 * One-command visual check: boot the site headless and screenshot every key
 * section at desktop + mobile, so any visual/layout/animation edit is instantly
 * verifiable without hand-wiring a server. This is the loop the project rules
 * require ("JEDE geänderte Visualisierung visuell selbst prüfen — Desktop +
 * Mobil ≤ 480 px").
 *
 *   npm run shoot                 # all sections, both viewports → screenshots/
 *   npm run shoot -- hero,studio  # only these sections
 *   BASE_URL=http://localhost:8080 npm run shoot   # use a running server
 *
 * Self-sufficient (own static server, same one e2e.mjs uses) and CDN-routed so
 * GSAP/three.js render headless behind the agent proxy. Writes PNGs named
 * screenshots/<section>-<desktop|mobile>.png. One section failing never aborts
 * the rest — the run reports which shots it wrote.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startServer } from "./static-server.mjs";
import { routeCdnThroughNode } from "./cdn-route.mjs";

const OUT = "screenshots";

// Each key surface of the page. `hash` deep-links the section; `reveal: true`
// marks the studio sections, which only exist after landing.js reveals the
// studio (the deep-link hash triggers that on load). `target` is the element to
// scroll into frame before the shot (defaults to the hash's id).
const SECTIONS = [
  { name: "hero", hash: "", target: null },
  { name: "how", hash: "#how", target: "how" },
  { name: "facts", hash: "#facts", target: "facts" },
  { name: "pivot", hash: "#pivot", target: "pivot" },
  { name: "aidr", hash: "#ai-done-right", target: "ai-done-right" },
  { name: "style", hash: "#your-style", target: "your-style" },
  { name: "studio", hash: "#design", target: "design", reveal: true },
  { name: "community", hash: "#community", target: "community" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const only = (process.argv[2] || "").split(",").map((s) => s.trim()).filter(Boolean);
const sections = only.length ? SECTIONS.filter((s) => only.includes(s.name)) : SECTIONS;
if (!sections.length) {
  console.error(`No matching sections. Known: ${SECTIONS.map((s) => s.name).join(", ")}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const ownServer = !process.env.BASE_URL;
const server = ownServer ? await startServer() : null;
const base = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}`;
console.log("Shooting", base);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const written = [];
try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    await routeCdnThroughNode(page);
    for (const sec of sections) {
      try {
        await page.goto(`${base}/${sec.hash}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        // Beat for the landing animation / studio reveal / WebGL to settle.
        await page.waitForTimeout(sec.reveal ? 2600 : 2200);
        if (sec.target) {
          await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "start" }), sec.target);
          await page.waitForTimeout(700);
        }
        const file = `${OUT}/${sec.name}-${vp.name}.png`;
        await page.screenshot({ path: file });
        written.push(file);
        console.log("  wrote", file);
      } catch (err) {
        console.log(`  ✗ ${sec.name}-${vp.name}: ${err.message}`);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  if (server) server.close();
}

console.log(`\nDone — ${written.length}/${sections.length * VIEWPORTS.length} shots in ${OUT}/`);
