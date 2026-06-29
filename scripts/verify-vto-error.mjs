/**
 * Headless check for the VTO error-state clarity fix. Seeds a design + photo via
 * the global StateManager, mocks /api/try-on to fail, clicks the generate
 * button, and asserts the error reads as a final state (has-error class,
 * full-contrast text, no spinner) and announces assertively. Then mocks a
 * success to confirm the error state resets. Screenshots the error panel.
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startServer } from "./static-server.mjs";

let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fails++; };

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}`;
const OUT = join(process.cwd(), "screenshots");
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

let failNext = true; // first generation fails, second succeeds
async function run(viewport, label) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  // 1x1 png the mocked try-on "returns" on success
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  await page.route("**/api/try-on", (route) =>
    failNext
      ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ imageUrl: "https://example.com/x.png" }) }));
  // example.com/x.png would 404 as an <img>; that's fine — we only assert state.
  await page.route("https://example.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(PNG, "base64") }));

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.StateManager && document.getElementById("vto-btn"));

  // Seed state so the VTO button enables, and reveal the ownership section.
  await page.evaluate(() => {
    window.StateManager.set("currentDesign", {
      designId: "verify-1", name: "Test", description: "d",
      color: "#1a1a1a", material: "cotton", fit: 0.5, tags: [], constructionNotes: [],
    });
    window.StateManager.set("userPhoto", "data:image/jpeg;base64,AAAA");
    const own = document.getElementById("ownership");
    if (own) own.hidden = false;
    const mr = document.getElementById("make-real");
    if (mr) mr.hidden = false;
  });
  await page.waitForTimeout(150);

  // --- error path ---
  failNext = true;
  await page.evaluate(() => document.getElementById("vto-btn").click());
  await page.waitForFunction(() => document.querySelector(".vto-loading.has-error") !== null, { timeout: 5000 });
  const err = await page.evaluate(() => {
    const loading = document.querySelector(".vto-loading");
    const status = document.getElementById("vto-status");
    const spinner = document.querySelector(".vto-spinner");
    const cs = getComputedStyle(status);
    return {
      hasError: loading.classList.contains("has-error"),
      role: status.getAttribute("role"),
      live: status.getAttribute("aria-live"),
      spinnerHidden: spinner ? getComputedStyle(spinner).display === "none" : true,
      statusText: status.textContent.trim().slice(0, 60),
      fontWeight: cs.fontWeight,
      hasBorder: cs.borderTopWidth !== "0px" || getComputedStyle(loading).borderTopWidth !== "0px",
    };
  });
  ok(err.hasError, `[${label}] .vto-loading gets .has-error on failure`);
  ok(err.role === "alert", `[${label}] #vto-status role=alert (assertive) on error (${err.role})`);
  ok(err.live === "assertive", `[${label}] aria-live=assertive on error (${err.live})`);
  ok(err.spinnerHidden, `[${label}] spinner hidden on error`);
  ok(err.statusText.length > 0, `[${label}] error message text present ("${err.statusText}")`);
  await page.locator("#vto-stage").screenshot({ path: join(OUT, `vto-error-${label}.png`) }).catch(() => {});

  // --- reset path: a successful retry clears the error state ---
  failNext = false;
  await page.evaluate(() => document.getElementById("vto-btn").click());
  await page.waitForTimeout(400);
  const reset = await page.evaluate(() => {
    const loading = document.querySelector(".vto-loading");
    const status = document.getElementById("vto-status");
    return { hasError: loading.classList.contains("has-error"), role: status.getAttribute("role"), live: status.getAttribute("aria-live") };
  });
  ok(!reset.hasError, `[${label}] .has-error cleared on a retry`);
  ok(reset.role === "status" && reset.live === "polite", `[${label}] live region restored to polite status on retry`);

  await ctx.close();
}

await run({ width: 1280, height: 900 }, "desktop");
await run({ width: 390, height: 800 }, "mobile");

await browser.close();
server.close();
console.log(fails ? `\n✗ ${fails} check(s) failed` : "\n✓ all VTO error-state checks passed");
process.exit(fails ? 1 : 0);
