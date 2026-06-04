/* Headless logic test for the core boundary layer (no DOM, no browser).
   Covers CONFIG's validators (the "validate at the boundary" guarantee the
   whole app leans on) and the pure production math in measurements.js
   (size buckets, fabric area, seam formulas). Both modules expose a CJS
   export guard; measurements.js reads a global `CONFIG` at IIFE eval time,
   so we place it on `global` before requiring it (mirrors engine-test.cjs). */
const path = require("path");

const CONFIG = require(path.join(__dirname, "..", "js", "config.js"));
global.CONFIG = CONFIG; // measurements.js reads bare `CONFIG` at load time
const Measurements = require(path.join(__dirname, "..", "js", "measurements.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
function throws(fn, msg) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, msg);
}

console.log("\n— CONFIG.validateMeasurement —");
assert(CONFIG.validateMeasurement("chest", 96) === 96, "valid value passes through as a number");
assert(CONFIG.validateMeasurement("chest", "96") === 96, "numeric string is parsed to int");
assert(CONFIG.validateMeasurement("height", 140) === 140, "lower bound (140) is inclusive");
assert(CONFIG.validateMeasurement("height", 220) === 220, "upper bound (220) is inclusive");
throws(() => CONFIG.validateMeasurement("height", 139), "below min throws");
throws(() => CONFIG.validateMeasurement("height", 221), "above max throws");
throws(() => CONFIG.validateMeasurement("chest", "abc"), "non-numeric throws");
throws(() => CONFIG.validateMeasurement("nope", 50), "unknown field throws");

console.log("\n— CONFIG.validateGarmentType / Material / Length —");
assert(CONFIG.validateGarmentType("jacket") === "jacket", "known garment type passes");
throws(() => CONFIG.validateGarmentType("cape"), "unknown garment type throws");
assert(CONFIG.validateMaterial("wool") === "wool", "known material passes");
throws(() => CONFIG.validateMaterial("kevlar"), "unknown material throws");
assert(CONFIG.validateLength("cropped") === "cropped", "known length passes");
throws(() => CONFIG.validateLength("midi"), "unknown length throws");

console.log("\n— CONFIG.validateColor —");
assert(CONFIG.validateColor("#1a1a1a") === "#1a1a1a", "lowercase #RRGGBB passes");
assert(CONFIG.validateColor("#FFFFFF") === "#FFFFFF", "uppercase #RRGGBB passes");
throws(() => CONFIG.validateColor("#fff"), "3-digit shorthand throws");
throws(() => CONFIG.validateColor("red"), "named colour throws");
throws(() => CONFIG.validateColor("#GG0000"), "non-hex digits throw");
throws(() => CONFIG.validateColor("1a1a1a"), "missing # throws");

console.log("\n— CONFIG.validatePrint —");
assert(CONFIG.validatePrint(null) === "", "null → empty string (no print)");
assert(CONFIG.validatePrint(undefined) === "", "undefined → empty string");
assert(CONFIG.validatePrint("  hi  ") === "hi", "trims surrounding whitespace");
assert(CONFIG.validatePrint("a<script>b") === "ascriptb", "strips angle brackets (no markup)");
assert(CONFIG.validatePrint("x".repeat(40)).length === CONFIG.PRINT_MAX_LENGTH, "caps at PRINT_MAX_LENGTH");

console.log("\n— Measurements.calculateSize (chest buckets) —");
const size = (chest) => Measurements.calculateSize({ chest });
assert(size(89) === "XS", "chest 89 → XS");
assert(size(90) === "S", "chest 90 → S (lower edge)");
assert(size(95) === "S", "chest 95 → S");
assert(size(96) === "M", "chest 96 → M (lower edge)");
assert(size(101) === "M", "chest 101 → M");
assert(size(102) === "L", "chest 102 → L (lower edge)");
assert(size(109) === "L", "chest 109 → L");
assert(size(110) === "XL", "chest 110 → XL (lower edge)");
assert(size(117) === "XL", "chest 117 → XL");
assert(size(118) === "XXL", "chest 118 → XXL");

console.log("\n— Measurements.estimateFabric —");
const M = CONFIG.MEASUREMENT_PRESETS.M; // chest 96, height 175
// baseArea = 96 * 175 / 10000 = 1.68 ; tshirt factor 1.2 → 2.016 → "2.02"
assert(Measurements.estimateFabric(M, "tshirt") === "2.02", "tshirt area = chest×height/10000 × factor, 2-dp string");
// jacket factor 2.4 → 1.68 × 2.4 = 4.032 → "4.03"
assert(Measurements.estimateFabric(M, "jacket") === "4.03", "jacket uses its larger fabric factor");
assert(Measurements.estimateFabric(M, "bogus") === Measurements.estimateFabric(M, "tshirt"), "invalid type falls back to tshirt");

console.log("\n— Measurements.estimateSeams —");
// tshirt: 2*chest + 2*30 + 4*25 = 2*96 + 60 + 100 = 352
assert(Measurements.estimateSeams(M, "tshirt") === 352, "tshirt seam formula");
// pants: 4*inseam + 2*waist + 80 = 4*82 + 2*82 + 80 = 572
assert(Measurements.estimateSeams(M, "pants") === 572, "pants seam formula");
assert(Measurements.estimateSeams(M, "bogus") === Measurements.estimateSeams(M, "tshirt"), "invalid type falls back to tshirt seams");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
