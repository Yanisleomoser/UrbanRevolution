/**
 * Headless check for measurement aria-errormessage: an out-of-range value wires
 * aria-invalid + aria-errormessage to a generated, bilingual range message; a
 * valid value clears it; a language switch re-localizes a shown error.
 */
import { chromium } from "playwright-core";
import { startServer } from "./static-server.mjs";

let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fails++; };

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.I18N && window.CONFIG && document.getElementById("chest"));

const drive = (id, value) => page.evaluate(({ id, value }) => {
  const input = document.getElementById(id);
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  const errId = input.getAttribute("aria-errormessage");
  const errEl = errId ? document.getElementById(errId) : null;
  return {
    invalid: input.getAttribute("aria-invalid"),
    errId,
    errText: errEl ? errEl.textContent : null,
    errClass: errEl ? errEl.className : null,
  };
}, { id, value });

console.log("\n— out-of-range chest (max 160 cm) —");
let r = await drive("chest", "999");
ok(r.invalid === "true", "aria-invalid=true on out-of-range value");
ok(r.errId === "chest-error", `aria-errormessage points to #chest-error (${r.errId})`);
ok(/160/.test(r.errText || "") && /cm/.test(r.errText || ""), `error text states the max + cm unit ("${r.errText}")`);
ok(/Brustumfang|Chest/.test(r.errText || ""), "error text includes the localized field label");
ok((r.errClass || "").includes("visually-hidden"), "error node is visually-hidden (no visual change)");

console.log("\n— weight uses kg, not cm —");
r = await drive("weight", "999");
ok(/kg/.test(r.errText || "") && !/cm/.test(r.errText || ""), `weight error uses kg ("${r.errText}")`);

console.log("\n— valid value clears the error —");
r = await drive("chest", "96");
ok(r.invalid === "false", "aria-invalid=false on a valid value");
ok(r.errId === null, "aria-errormessage removed when valid");

console.log("\n— empty value clears the error —");
r = await drive("chest", "");
ok(r.invalid === null, "aria-invalid removed when empty");

console.log("\n— language switch re-localizes a shown error —");
await drive("chest", "999"); // re-trigger error (currently DE)
await page.evaluate(() => window.I18N.setLang("en"));
const en = await page.evaluate(() => {
  const el = document.getElementById("chest-error");
  return el ? el.textContent : null;
});
ok(/must be between/i.test(en || ""), `error text switched to English ("${en}")`);
await page.evaluate(() => window.I18N.setLang("de"));

await browser.close();
server.close();
console.log(fails ? `\n✗ ${fails} check(s) failed` : "\n✓ all measurement-errormessage checks passed");
process.exit(fails ? 1 : 0);
