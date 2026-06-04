/* DE/EN key-parity test for i18n.js (no DOM).
   The whole UI is bilingual; the project convention is "add a key to BOTH de
   and en". The classic failure mode is adding a key to one language only —
   the other silently falls back to German (or the raw key). This test diffs
   the two tables so that mistake fails CI instead of shipping.
   i18n.js runs apply() at load (DOM walk) and assigns window.I18N, so we shim
   a minimal document/window before requiring it. */
const path = require("path");

global.window = global.window || {};
global.document = {
  readyState: "complete",
  querySelectorAll: () => [],
  documentElement: { setAttribute() {} },
  addEventListener() {},
  title: "",
};

const I18N = require(path.join(__dirname, "..", "js", "i18n.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

const de = I18N.dict.de;
const en = I18N.dict.en;
const deKeys = Object.keys(de);
const enKeys = Object.keys(en);

const onlyInDe = deKeys.filter((k) => !(k in en));
const onlyInEn = enKeys.filter((k) => !(k in de));

console.log(`\n— i18n parity (de: ${deKeys.length} keys, en: ${enKeys.length} keys) —`);
if (onlyInDe.length) console.log("  missing from EN:", onlyInDe.join(", "));
if (onlyInEn.length) console.log("  missing from DE:", onlyInEn.join(", "));

assert(onlyInDe.length === 0, "every DE key has an EN translation");
assert(onlyInEn.length === 0, "every EN key has a DE translation");
assert(deKeys.length === enKeys.length, "DE and EN tables have the same key count");
assert(typeof de["head.title"] === "string" && typeof en["head.title"] === "string", "spot-check: head.title present in both");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
