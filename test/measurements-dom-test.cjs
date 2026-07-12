/* Headless test for the DOM-facing side of js/measurements.js — read(), write()
   and applyPreset(). core-test.cjs already covers the pure production math
   (calculateSize / estimateFabric / estimateSeams); these three functions are
   the capture funnel: they move the 9 body measurements between the <input>
   fields and the validated model that feeds size + the production spec, so a
   silent fallback here means the wrong garment. They only touch
   document.getElementById + input.value, so a tiny element mock exercises them
   fully without a browser. measurements.js reads a global CONFIG at load, so we
   place it first (mirrors core-test.cjs). */
const path = require("path");

const CONFIG = require(path.join(__dirname, "..", "js", "config.js"));
global.CONFIG = CONFIG;

// Controllable DOM: `inputs` maps field id → { value }. getElementById returns
// the element or null (missing field). Reassigning `inputs` per scenario is
// visible to the closure below (same binding).
let inputs = {};
global.document = { getElementById: (id) => (id in inputs ? inputs[id] : null) };

// Quiet + capture the module's console.warn/error so failure paths can be
// asserted without spamming the test output.
const warns = [];
const errors = [];
console.warn = (...a) => warns.push(a.join(" "));
console.error = (...a) => errors.push(a.join(" "));

const Measurements = require(path.join(__dirname, "..", "js", "measurements.js"));
const M = CONFIG.MEASUREMENT_PRESETS.M;
const L = CONFIG.MEASUREMENT_PRESETS.L;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
const field = (v) => ({ value: v });

console.log("\n— read(): valid inputs are parsed to numbers —");
{
  inputs = {};
  Object.keys(L).forEach((k) => (inputs[k] = field(String(L[k]))));
  const r = Measurements.read();
  assert(r.chest === 104 && r.height === 182 && r.neck === 40, "each field is read + parsed to its numeric value");
  assert(typeof r.waist === "number", "values come back as numbers, not strings");
}

console.log("\n— read(): invalid / missing inputs fall back to the M preset —");
{
  warns.length = 0;
  inputs = {
    height: field("180"),   // valid, in range → kept
    chest: field("999"),    // above max (160) → M fallback
    waist: field("abc"),    // not a number → M fallback
    // neck: no element at all → M fallback
  };
  const r = Measurements.read();
  assert(r.height === 180, "a valid in-range input is kept");
  assert(r.chest === M.chest, "an out-of-range input falls back to the M preset");
  assert(r.waist === M.waist, "a non-numeric input falls back to the M preset");
  assert(r.neck === M.neck, "a missing input element falls back to the M preset");
  assert(warns.some((w) => w.includes("chest")) && warns.some((w) => w.includes("waist")), "the invalid fields are logged (warn), not silently dropped");
}

console.log("\n— write(): valid data lands in the inputs, invalid is rejected —");
{
  errors.length = 0;
  inputs = { chest: field(""), height: field(""), waist: field("") };
  Measurements.write({ chest: 100, height: 180, hips: 105 }); // hips has no input → skipped
  assert(inputs.chest.value === 100 && inputs.height.value === 180, "valid values are written back (validated)");
  assert(inputs.waist.value === "", "a field absent from the data payload is left untouched");

  Measurements.write({ chest: 5 }); // below min (60) → rejected, not written
  assert(inputs.chest.value === 100, "an out-of-range value is NOT written (previous value preserved)");
  assert(errors.some((e) => e.includes("chest")), "the rejected write is logged (error)");

  let threw = false;
  try { Measurements.write({}); Measurements.write({ nope: 1 }); } catch (_e) { threw = true; }
  assert(!threw, "empty / unknown-field payloads never throw");
}

console.log("\n— applyPreset(): writes the preset + returns it —");
{
  inputs = { chest: field(""), waist: field("") };
  const applied = Measurements.applyPreset("M");
  assert(applied === CONFIG.MEASUREMENT_PRESETS.M, "returns the applied preset object");
  assert(inputs.chest.value === M.chest && inputs.waist.value === M.waist, "M values are written into the inputs");

  Measurements.applyPreset("XL");
  assert(inputs.chest.value === CONFIG.MEASUREMENT_PRESETS.XL.chest, "re-applying a different preset overwrites the inputs");

  let threw = false;
  try { Measurements.applyPreset("NOT_A_SIZE"); } catch (_e) { threw = true; }
  assert(threw, "an unknown preset name throws");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
