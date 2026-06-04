/* Headless logic test for the AI local fallback (no DOM, no network).
   ai.js is the offline experience: when the server proxy and browser-key
   paths are unavailable, these keyword detectors turn a free-text prompt
   into garment attributes. They have subtle behaviour worth pinning:
   longest-match-wins, German colour aliases, and sane defaults.
   ai.js reads a global `CONFIG` at IIFE eval time (it builds COLOR_DICT
   from CONFIG.COLORS), so we place CONFIG on `global` before requiring it. */
const path = require("path");

const CONFIG = require(path.join(__dirname, "..", "js", "config.js"));
global.CONFIG = CONFIG;
const AI = require(path.join(__dirname, "..", "js", "ai.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

console.log("\n— AI.detectColor (German aliases → palette hex) —");
assert(AI.detectColor("Ein schwarzes Hemd") === CONFIG.COLORS.black, "'schwarz' → black hex");
assert(AI.detectColor("weißes Oberteil") === CONFIG.COLORS.white, "'weiß' → white hex");
assert(AI.detectColor("etwas in rot") === CONFIG.COLORS.red, "'rot' → red hex");
assert(AI.detectColor("keine farbe genannt") === "#1a1a1a", "no colour word → default #1a1a1a");

console.log("\n— AI.detectMaterial —");
assert(AI.detectMaterial("aus Merino gestrickt") === "wool", "'merino' maps to wool");
assert(AI.detectMaterial("ein Leinenhemd") === "linen", "'leinen' maps to linen");
assert(AI.detectMaterial("selvedge denim jeans") === "denim", "denim keyword wins");
assert(AI.detectMaterial("unbekanntes gewebe") === "cotton", "no material word → default cotton");

console.log("\n— AI.detectType (+ longest-match-wins) —");
assert(AI.detectType("ein Kapuzenpulli") === "hoodie", "'kapuze' → hoodie");
assert(AI.detectType("schwarzer Blazer") === "jacket", "'blazer' → jacket");
assert(AI.detectType("langes Kleid") === "dress", "'kleid' → dress");
assert(AI.detectType("kein typ hier") === null, "no garment word → null (caller defaults to tshirt)");
// "sweatshirt" contains the substring "shirt" (→shirt) but the longer key
// "sweatshirt" (→hoodie) must win — guards the longest-match logic.
assert(AI.detectType("ein Sweatshirt") === "hoodie", "longest match wins: 'sweatshirt' beats 'shirt'");

console.log("\n— AI.detectFit (keyword → 0..1 scalar) —");
assert(AI.detectFit("oversized hoodie") === 0.93, "'oversized' → 0.93");
assert(AI.detectFit("slim cut") === 0.18, "'slim' → 0.18");
assert(AI.detectFit("ganz normal") === 0.5, "no fit word → 0.5 (regular)");

console.log("\n— AI.detectPattern —");
assert(AI.detectPattern("gestreiftes Shirt") === "stripes_h", "'gestreift' → stripes_h");
assert(AI.detectPattern("mit Karo") === "plaid", "'karo' → plaid");
assert(AI.detectPattern("schlicht und einfarbig") === "solid", "no pattern word → solid");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
