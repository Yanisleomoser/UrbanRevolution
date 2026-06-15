/* Headless test for the Design-Engine technical-flat builder
   (js/design-engine/garment-svg.js) — the project's core *visual* deliverable.

   garment-svg.js is a pure, self-contained IIFE (only local constants at eval,
   no window/DOM), so its public API — build / model / paint / lerpModel /
   nebula — is fully unit-testable headless. It emits deterministic inline SVG
   strings. We pin the documented geometry INVARIANTS (brief §2): the shoulder
   is always the widest point, the flat never leaks NaN/undefined into path
   coordinates, unknown categories fall back to a real garment, sleeves stay
   visible, and the morph (lerpModel) is a true a→b interpolation. */
const path = require("path");
const GarmentSVG = require(path.join(__dirname, "..", "js", "design-engine", "garment-svg.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

const TYPES = ["tshirt", "hoodie", "shirt", "jacket", "pants", "dress"];

console.log("\n— build() produces valid SVG for every garment type —");
TYPES.forEach((cat) => {
  const svg = GarmentSVG.build(cat, { fit: 0.5, length: "regular", color: "#223344", material: "cotton" });
  assert(typeof svg === "string" && svg.startsWith("<svg"), `${cat}: returns an <svg> string`);
  assert(svg.includes('viewBox="0 0 240 340"'), `${cat}: uses the fixed 240×340 viewBox`);
  assert(svg.includes("</svg>"), `${cat}: SVG is closed`);
});

console.log("\n— no garbage input ever leaks NaN/undefined into the markup —");
const GARBAGE = [
  { fit: "abc" }, { fit: null, length: 42 }, { fit: NaN, structure: undefined, volume: {} },
  {}, null, undefined,
];
TYPES.forEach((cat) => {
  GARBAGE.forEach((bad) => {
    const svg = GarmentSVG.build(cat, bad);
    assert(svg.startsWith("<svg") && !/NaN|undefined/.test(svg),
      `${cat} + ${JSON.stringify(bad)} → clean SVG (no NaN/undefined)`);
  });
});
assert(GarmentSVG.build().startsWith("<svg"), "build() with no args still returns SVG");

console.log("\n— geometry invariant: shoulder is the widest point (brief §2) —");
// Across the whole fit range, chest/waist/hem must never exceed the shoulder.
["tshirt", "hoodie", "shirt", "jacket"].forEach((cat) => {
  for (let fit = 0; fit <= 1.0001; fit += 0.25) {
    const g = GarmentSVG.model(cat, { fit }).g;
    assert(g.chestHalf < g.shoulderHalf, `${cat} fit=${fit}: chest (${g.chestHalf.toFixed(1)}) < shoulder (${g.shoulderHalf.toFixed(1)})`);
    assert(g.waistHalf <= g.chestHalf + 1e-6, `${cat} fit=${fit}: waist ≤ chest`);
    assert(g.hemHalf <= g.shoulderHalf, `${cat} fit=${fit}: hem never exceeds shoulder (no bell past the widest point)`);
  }
});

console.log("\n— fit drives the silhouette wider (slim → oversized spread) —");
["tshirt", "jacket"].forEach((cat) => {
  const slim = GarmentSVG.model(cat, { fit: 0.1 }).g;
  const over = GarmentSVG.model(cat, { fit: 0.95 }).g;
  assert(over.shoulderHalf > slim.shoulderHalf, `${cat}: oversized shoulder wider than slim`);
});

console.log("\n— sleeves are always-visible limbs unless explicitly sleeveless —");
const sleeved = GarmentSVG.model("tshirt", { fit: 0.5, sleeveLength: "short" }).g;
assert(sleeved.sleeveless === false && sleeved.wristY > sleeved.shoulderY,
  "short sleeve → real limb (wristY below the shoulder line)");
const bare = GarmentSVG.model("tshirt", { fit: 0.5, sleeveLength: "sleeveless" }).g;
assert(bare.sleeveless === true && bare.coX === bare.chestHalf,
  "sleeveless → limb collapses onto the chest line (tank silhouette)");

console.log("\n— unknown category degrades to a real garment (tshirt), never blank —");
assert(GarmentSVG.model("banana").cat === "tshirt", "unknown top category → tshirt model");
assert(GarmentSVG.build("banana", { fit: 0.5 }).startsWith("<svg"), "unknown category still renders SVG");
assert(GarmentSVG.model("JACKET").cat === "jacket", "category is case-insensitive");

console.log("\n— lerpModel is a true a→b morph of the numeric geometry —");
const a = GarmentSVG.model("jacket", { fit: 0 });
const b = GarmentSVG.model("jacket", { fit: 1 });
const at0 = GarmentSVG.lerpModel(a, b, 0);
const at1 = GarmentSVG.lerpModel(a, b, 1);
const mid = GarmentSVG.lerpModel(a, b, 0.5);
assert(Math.abs(at0.g.shoulderHalf - a.g.shoulderHalf) < 1e-9, "t=0 reproduces model a");
assert(Math.abs(at1.g.shoulderHalf - b.g.shoulderHalf) < 1e-9, "t=1 reproduces model b");
assert(mid.g.shoulderHalf > a.g.shoulderHalf && mid.g.shoulderHalf < b.g.shoulderHalf,
  "t=0.5 lands strictly between a and b (interpolated, not snapped)");
// Different category/kind → not comparable, returns the target verbatim.
assert(GarmentSVG.lerpModel(GarmentSVG.model("pants", {}), b, 0.5) === b,
  "incomparable models → returns target b (caller crossfades)");
assert(GarmentSVG.lerpModel(null, b, 0.5) === b, "null source → returns target b");

console.log("\n— paint(model) === build(category, params) (build is paint∘model) —");
// renderFlat tags each call with an incrementing uid (gradient ids gN), so two
// renders differ only in those ids — normalise them before comparing shape.
const normId = (svg) => svg.replace(/g\d+/g, "gN");
TYPES.forEach((cat) => {
  const params = { fit: 0.4, length: "regular", material: "denim" };
  assert(normId(GarmentSVG.paint(GarmentSVG.model(cat, params))) === normId(GarmentSVG.build(cat, params)),
    `${cat}: build composes paint∘model (ids aside)`);
});
assert(GarmentSVG.paint(null) === "", "paint(null) → empty string (no throw)");

console.log("\n— nebula (pre-category genesis) is valid, deterministic, and grows with seed —");
const neb0 = GarmentSVG.nebula({ seed: 0, energy: 0.5 });
const neb0b = GarmentSVG.nebula({ seed: 0, energy: 0.5 });
const neb8 = GarmentSVG.nebula({ seed: 8, energy: 0.5 });
assert(neb0.startsWith("<svg") && neb0.includes("de-nebula"), "nebula returns the nebula SVG");
assert(neb0 === neb0b, "nebula is deterministic for identical input");
assert(neb8.length > neb0.length, "more seed (more answers) → more woven threads");
assert(!/NaN|undefined/.test(GarmentSVG.nebula({})), "nebula with empty params → no NaN/undefined");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
