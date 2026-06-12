/* Headless test for pose.js measurement math (no DOM, no MediaPipe, no network).
   estimateMeasurements() turns 33 MediaPipe pose landmarks + the user's known
   height into the 9 body measurements that feed the tailor's spec sheet — so a
   silent drift in the calibration (nose→ankle ≈ 88% of height) or any of the
   anthropometric ratios would ship wrong garment numbers. Nothing tested this.
   pose.js only touches a browser global on its last line (window.Pose), now
   guarded, and dual-exports for Node; the math itself is pure. We drive it with
   synthetic, symmetric standing figures whose proportions are known. */
const path = require("path");
const Pose = require(path.join(__dirname, "..", "js", "pose.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// Build a 33-entry landmark array (x,y normalised in [0,1], y down) for a
// symmetric standing figure. Hip x is a parameter so we can vary hip width.
function figure({ hipHalfWidth = 0.06 } = {}) {
  const L = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const set = (i, x, y) => { L[i] = { x, y, visibility: 1 }; };
  set(0, 0.50, 0.12);                          // nose
  set(11, 0.40, 0.25); set(12, 0.60, 0.25);    // shoulders (half-width 0.10)
  set(13, 0.38, 0.40); set(14, 0.62, 0.40);    // elbows
  set(15, 0.37, 0.55); set(16, 0.63, 0.55);    // wrists
  set(23, 0.5 - hipHalfWidth, 0.55); set(24, 0.5 + hipHalfWidth, 0.55); // hips
  set(25, 0.45, 0.75); set(26, 0.55, 0.75);    // knees
  set(27, 0.46, 0.95); set(28, 0.54, 0.95);    // ankles
  return L;
}

console.log("\n— public API wiring —");
assert(typeof Pose.estimateMeasurements === "function", "Pose.estimateMeasurements is exported");

console.log("\n— canonical figure (180 cm, narrow hips) is deterministic —");
const m = Pose.estimateMeasurements(figure(), 180);
{
  // Height is the calibration reference and must pass straight through.
  assert(m.height === 180, "height passes through unchanged (it is the reference)");
  // Weight is first-principles: BMI 22 → round(22 · h²). Not a tunable heuristic.
  assert(m.weight === Math.round(22 * 1.8 * 1.8), "weight = round(22·h²) = 71 at 180 cm");
  // Full snapshot of the canonical figure — locks calibration + every ratio.
  assert(m.shoulder === 38, "shoulder = 38");
  assert(m.chest === 94, "chest = 94");
  assert(m.waist === 79, "waist = 79");
  assert(m.hips === 91, "hips = 91 (narrow-hip floor)");
  assert(m.arm === 58, "arm = 58");
  assert(m.inseam === 76, "inseam = 76");
  assert(m.neck === 33, "neck = 33");
}

console.log("\n— every field is a positive finite integer —");
for (const k of ["height", "weight", "chest", "waist", "hips", "shoulder", "arm", "inseam", "neck"]) {
  assert(Number.isInteger(m[k]) && m[k] > 0, `${k} is a positive integer (${m[k]})`);
}

console.log("\n— documented anthropometric ratios hold (±rounding) —");
{
  // chest ≈ shoulderWidth · 2.45, waist ≈ chest · 0.85, neck ≈ shoulder · 0.86.
  assert(near(m.chest, m.shoulder * 2.45, 2), "chest ≈ shoulder · 2.45");
  assert(near(m.waist, m.chest * 0.85, 1.5), "waist ≈ chest · 0.85");
  assert(near(m.neck, m.shoulder * 0.86, 1.5), "neck ≈ shoulder · 0.86");
  // Spec-sheet sanity: chest is the widest circumference, waist the smallest.
  assert(m.chest > m.shoulder && m.chest > m.waist, "chest > shoulder and chest > waist");
}

console.log("\n— hips: max() branch responds to hip width, floor protects narrow hips —");
{
  const narrow = Pose.estimateMeasurements(figure({ hipHalfWidth: 0.06 }), 180);
  const wide = Pose.estimateMeasurements(figure({ hipHalfWidth: 0.16 }), 180);
  // Narrow male-type hips: MediaPipe's joint distance underestimates, so the
  // chest·0.97 floor must win and keep hips realistic (not collapse).
  assert(near(narrow.hips, narrow.chest * 0.97, 2), "narrow hips fall back to ≈ chest · 0.97");
  assert(narrow.hips > narrow.waist - 1, "narrow hips don't collapse below the waist");
  // Wider hips must push the measurement up via hipWidth · 3.4.
  assert(wide.hips > narrow.hips, "wider hip landmarks → larger hips measurement");
  // Hip width must NOT leak into the shoulder-derived measures.
  assert(wide.chest === narrow.chest && wide.shoulder === narrow.shoulder && wide.neck === narrow.neck,
    "changing hip width leaves chest/shoulder/neck unchanged");
}

console.log("\n— calibration scales linearly with reference height —");
{
  const big = Pose.estimateMeasurements(figure(), 360); // same landmarks, 2× height
  // px2cm doubles → linear measures double (within rounding).
  assert(near(big.shoulder, m.shoulder * 2, 1), "shoulder doubles when height doubles");
  assert(near(big.chest, m.chest * 2, 2), "chest doubles when height doubles");
  assert(near(big.arm, m.arm * 2, 2), "arm doubles when height doubles");
  // Scale-invariant ratio is preserved exactly through the calibration change.
  assert(near(big.chest / big.shoulder, m.chest / m.shoulder, 0.05), "chest/shoulder ratio is scale-invariant");
  // Weight follows h² (BMI 22), not the px scale.
  assert(big.weight === Math.round(22 * 3.6 * 3.6), "weight = round(22·h²) = 285 at 360 cm");
}

console.log("\n— deterministic —");
assert(JSON.stringify(Pose.estimateMeasurements(figure(), 180)) === JSON.stringify(m), "same inputs → identical output");

if (failures > 0) {
  console.log(`\n✗ ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\n✓ all assertions passed");
