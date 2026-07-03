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

console.log("\n— nebulaModel / lerpNebulaModel: the §5.2 re-tension tween is pure —");
{
  const calm = GarmentSVG.nebulaModel({ seed: 2, energy: 0, structure: 0 });
  const bold = GarmentSVG.nebulaModel({ seed: 2, energy: 1, structure: 0 });
  assert(GarmentSVG.nebulaPaint(calm) === GarmentSVG.nebula({ seed: 2, energy: 0, structure: 0 }),
    "nebula() ≡ nebulaPaint(nebulaModel()) — the split changes nothing for old callers");
  assert(calm.threads.length === 18, "seed 2 → 14 + 2·2 threads");
  // The hash-driven anchors are param-independent — a mood answer keeps every
  // thread pinned and only re-tensions its bow (the §5.2 mechanic).
  assert(calm.threads[0].x0 === bold.threads[0].x0 && calm.threads[0].y1 === bold.threads[0].y1,
    "thread anchors don't move with energy (endpoints stay pinned)");
  const bow = (m) => Math.max(...m.threads.map((t) => Math.abs(t.c1x - 120) + Math.abs(t.c1y - 134)));
  assert(bow(bold) > bow(calm), "energy swings the control points wider (bolder crossings)");
  const soft = GarmentSVG.nebulaModel({ seed: 2, energy: 1, structure: 0 });
  const sharp = GarmentSVG.nebulaModel({ seed: 2, energy: 1, structure: 1 });
  const secondBow = (m) => Math.max(...m.threads.map((t) => Math.abs(t.c2x - 120)));
  assert(secondBow(sharp) < secondBow(soft), "structure straightens the second bow (tenser threads)");

  const at0 = GarmentSVG.lerpNebulaModel(calm, bold, 0);
  const at1 = GarmentSVG.lerpNebulaModel(calm, bold, 1);
  const mid = GarmentSVG.lerpNebulaModel(calm, bold, 0.5);
  assert(at0.threads[5].c1y === calm.threads[5].c1y, "t=0 reproduces the previous tension");
  assert(at1.threads[5].c1y === bold.threads[5].c1y, "t=1 reproduces the new tension");
  assert(Math.abs(mid.threads[3].c1x - (calm.threads[3].c1x + bold.threads[3].c1x) / 2) < 1e-9,
    "t=0.5 lands exactly halfway (true interpolation, not a snap)");
  assert(!/NaN|undefined/.test(GarmentSVG.nebulaPaint(mid)), "a painted lerp frame is clean SVG");

  // An answer ADDS threads — they fade in with t instead of popping.
  const grown = GarmentSVG.lerpNebulaModel(calm, GarmentSVG.nebulaModel({ seed: 4, energy: 0, structure: 0 }), 0.25);
  assert(grown.threads.length === 22, "lerp keeps the target's (larger) thread count");
  assert(Math.abs(grown.threads[20].op - GarmentSVG.nebulaModel({ seed: 4, energy: 0, structure: 0 }).threads[20].op * 0.25) < 1e-9,
    "freshly added threads fade in with t");
  assert(GarmentSVG.lerpNebulaModel(null, bold, 0.5) === bold, "null source → returns target (caller repaints)");
}

console.log("\n— weave hero-beat layer classes (outline draws first, panels fill last) —");
["tshirt", "hoodie", "shirt", "jacket", "pants", "dress"].forEach((cat) => {
  const svg = GarmentSVG.build(cat, { fit: 0.5, length: "regular", material: "cotton" });
  assert(svg.includes('class="gs-int"') && svg.includes('class="gs-outline"')
    && svg.includes('class="gs-seams"') && svg.includes('class="gs-ground"'),
    `${cat}: carries the gs-int / gs-outline / gs-seams / gs-ground stage layers`);
});

console.log("\n— colour stops: duo-gradient renders a gradient fill —");
const duo = GarmentSVG.build("tshirt", { fit: 0.5, scheme: "duo-gradient", stops: ["#2a9d8f", "#64d6c4"], material: "silk", finish: 0.8, energy: 0.7 });
assert(duo.includes("linearGradient") && duo.includes("#2a9d8f") && duo.includes("#64d6c4"),
  "duo-gradient + two hex stops → a <linearGradient> carrying both stop colours");
assert(GarmentSVG.build("tshirt", { fit: 0.5, scheme: "mono", stops: ["#831843"] }).includes("#831843"),
  "single stop → the chosen colour fills the flat");

console.log("\n— security: hostile colour stops are sanitised, never injected (XSS) —");
// A shared #dna= link is attacker-controlled; stops are written into the SVG.
const EVIL = '#000"/></linearGradient></defs></svg><img src=x onerror=alert(1)>';
const hostile = GarmentSVG.build("tshirt", { fit: 0.5, scheme: "duo-gradient", stops: [EVIL, "#64d6c4"] });
assert(!hostile.includes("<img") && !hostile.toLowerCase().includes("onerror"),
  "a non-hex stop carrying markup never reaches the SVG output");
assert(hostile.includes("#64d6c4"), "the legitimate hex stop in the same array survives");
assert(GarmentSVG.build("tshirt", { scheme: "duo-gradient", stops: ["javascript:alert(1)", "rgb(0,0,0)"] }).startsWith("<svg"),
  "non-hex stops (url:/rgb()) fall back cleanly to a neutral tone, no throw");
// A shared DNA can carry prototype keys as the winning archetype
// ("constructor" → Object constructor on a bare-object lookup); the tint must
// stay a real hex, never a stringified function/object in the paint.
["constructor", "__proto__", "toString", "hasOwnProperty"].forEach((evilArch) => {
  const flat = GarmentSVG.build("tshirt", { archetype: evilArch, energy: 0.6 });
  const neb = GarmentSVG.nebula({ archetype: evilArch, seed: 1 });
  assert(!/function|\[object|native code/.test(flat) && flat.includes("#8b8f96"),
    `flat with archetype "${evilArch}" → neutral hex tint, no stringified prototype member`);
  assert(!/function|\[object|native code/.test(neb) && neb.includes("#8b96a4"),
    `nebula with archetype "${evilArch}" → neutral hex tint, no stringified prototype member`);
});

console.log("\n— rich Phase-E params exercise the detail layers cleanly —");
["jacket", "hoodie", "shirt", "dress", "pants"].forEach((cat) => {
  const rich = GarmentSVG.build(cat, {
    fit: 0.6, length: "long", material: "denim", finish: 0.7,
    scheme: "duo-gradient", stops: ["#1e3a8a", "#64d6c4"],
    pattern: "stripe", patternScale: 0.5, subArchetype: "puffer",
    hardware: "gold", signature: "contrast-stitch", energy: 0.9, archetype: "utility",
  });
  assert(rich.startsWith("<svg") && rich.includes("</svg>") && !/NaN|undefined/.test(rich),
    `${cat}: rich Phase-E params → clean, closed SVG (no NaN/undefined)`);
});

console.log("\n— per-material weave grain + silk satin streak (the material cue) —");
// Woven/napped fabrics get a fine <pattern> grain so they read as distinct
// cloth (a smooth gradient can't); pattern:"none" so the only <pattern> is the
// weave. silk carries no weave — its cue is the anisotropic streak instead.
["cotton", "linen", "denim", "wool", "fleece", "polyester"].forEach((m) => {
  const svg = GarmentSVG.build("tshirt", { material: m, pattern: "none", fit: 0.5 });
  assert(svg.includes("<pattern"), `${m}: emits a weave grain <pattern>`);
});
const silkFlat = GarmentSVG.build("tshirt", { material: "silk", pattern: "none", fit: 0.5 });
assert(!silkFlat.includes("<pattern"), "silk: no weave grain (stays smooth)");
// The satin streak is a vertically-flattened radial (scale(1 0.26)); every
// garment now also carries a grounded contact-shadow radial, so we match the
// streak by its unique transform, not just any <radialGradient>.
const STREAK = "scale(1 0.26)";
assert(silkFlat.includes(STREAK), "silk: emits the anisotropic satin streak");
assert(GarmentSVG.build("tshirt", { material: "denim", pattern: "none" }).includes('patternTransform="rotate(63)"'),
  "denim: weave is a diagonal twill");
// Streak is gated to genuinely glossy cloth: matte polyester (finish .5) gets
// no satin pool; pushing the finish slider glossy turns it satiny.
assert(!GarmentSVG.build("tshirt", { material: "polyester", pattern: "none", finish: 0.5 }).includes(STREAK),
  "polyester (matte finish): no satin streak");
assert(GarmentSVG.build("tshirt", { material: "polyester", pattern: "none", finish: 1 }).includes(STREAK),
  "polyester (glossy finish): satin streak appears");
// A non-whitelisted material can't inject markup via the weave switch.
const weird = GarmentSVG.build("tshirt", { material: '"><img onerror=alert(1)>', pattern: "none" });
assert(weird.startsWith("<svg") && !weird.includes("<pattern") && !/<img|onerror/i.test(weird),
  "unknown/hostile material → no weave, no markup injection");

console.log("\n— cinematic cloth layers: key light, drape, edge AO/rim, contact shadow —");
// Every painted garment now sits in a lit studio: a directional key-light
// gradient (form), constant-ink drape creases + self-shadows (cloth), edge
// ambient occlusion + rim (the turn), and a grounded contact shadow that tracks
// the hem. All ink is constant → still XSS-safe (no DNA value reaches them).
TYPES.forEach((cat) => {
  const svg = GarmentSVG.build(cat, { fit: 0.55, length: "regular", material: "cotton", finish: 0.4, scheme: "solid", stops: ["#2A9D8F"] });
  assert(svg.includes('x1="0.08"'), `${cat}: emits the directional key-light gradient`);
  assert(svg.includes("#04090f"), `${cat}: emits the edge ambient-occlusion strokes`);
  assert(svg.includes("#dff1f4"), `${cat}: emits the edge rim light`);
  assert(svg.includes("#06101c"), `${cat}: emits drape crease / self-shadow ink`);
  assert(svg.includes("<ellipse"), `${cat}: emits the grounded contact shadow`);
});
// Soft cloth (silk) ripples into more skirt folds than a stiff one (denim) —
// drape is material-driven. Compare crease-ink occurrences on a dress.
const softDress = GarmentSVG.build("dress", { fit: 0.6, length: "long", material: "silk", subArchetype: "slip" });
const stiffDress = GarmentSVG.build("dress", { fit: 0.6, length: "long", material: "denim", structure: 0.9 });
const creaseCount = (s) => (s.match(/#06101c/g) || []).length;
assert(creaseCount(softDress) > creaseCount(stiffDress),
  `soft silk drapes into more folds than stiff denim (${creaseCount(softDress)} > ${creaseCount(stiffDress)})`);
// Contact shadow + key light must survive the garbage/hostile inputs too.
GARBAGE.concat([{ material: '"><img onerror=x>', stops: ["#000\"><img>"] }]).forEach((bad) => {
  const svg = GarmentSVG.build("dress", bad);
  assert(svg.includes("<ellipse") && !/NaN|undefined/.test(svg) && !/<img|onerror/i.test(svg),
    `dress + ${JSON.stringify(bad)} → grounded, clean, no injection`);
});

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
