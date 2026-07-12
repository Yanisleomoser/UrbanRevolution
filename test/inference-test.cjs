/* Headless test for js/design-engine/inference.js — DesignInference, the layer
   that turns the accumulated soft signals into concrete, user-visible output:
   the archetype ranking, the "we filled these in for you" suggestions, and the
   warmer/colder refine nudges. engine-test.cjs touches it at a high level;
   this pins the product-critical *branches* that were uncovered — topArchetypes
   ordering, the suggestion surface/skip rule, valueWord's numeric buckets, and
   every refine axis (brightness / temperature / energy) plus the unknown-axis
   guard. Pure module (its only dependency is DesignDNA), so a require + a small
   fixture exercises it fully without a browser. */
const path = require("path");
const ROOT = path.join(__dirname, "..", "js", "design-engine");

global.DesignDNA = require(path.join(ROOT, "dna.js"));
const Inference = require(path.join(ROOT, "inference.js"));
const DNA = global.DesignDNA;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

// Local colour helpers to independently judge what a repaint did (mirrors the
// module's own math, kept separate so the test isn't circular).
function hexToRgb(h) {
  h = String(h).replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const lumOf = (h) => { const [r, g, b] = hexToRgb(h).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const satOf = (h) => { const [r, g, b] = hexToRgb(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const firstStop = (dna) => DNA.get(dna, "color.stops")[0];

console.log("\n— styleVector is a monotonic normalised distribution —");
{
  const dna = DNA.create();
  DNA.applyEffects(dna, { weight: { techAvant: 2, quietMinimal: 1 } });
  const v = Inference.styleVector(dna);
  const sum = Object.values(v).reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1) < 1e-9, "probabilities sum to 1");
  assert(v.techAvant > v.quietMinimal, "a higher weight → a higher probability");
  assert(v.quietMinimal > v.utility, "a zero-weight archetype ranks below a positive one");
  assert(Object.keys(Inference.styleVector({})).length === 0, "no archetypeWeights → empty distribution (no throw)");
}

console.log("\n— topArchetypes ranks + truncates —");
{
  const dna = DNA.create();
  DNA.applyEffects(dna, { weight: { y2kStreet: 3, sport: 2, utility: 1 } });
  const top = Inference.topArchetypes(dna);
  assert(top.length === 3, "defaults to the top 3");
  assert(top[0].id === "y2kStreet" && top[1].id === "sport", "sorted by descending probability");
  assert(top[0].p >= top[1].p && top[1].p >= top[2].p, "probabilities are monotonically non-increasing");
  assert(Inference.topArchetypes(dna, 2).length === 2, "respects an explicit n");
  assert(Inference.topArchetypes({}).length === 0, "empty DNA → no archetypes");
}

console.log("\n— valueWord: numeric buckets + dictionary + fallback —");
{
  assert(Inference.valueWord(0.2, "de") === "niedrig" && Inference.valueWord(0.2, "en") === "low", "< 0.33 → low/niedrig");
  assert(Inference.valueWord(0.8, "de") === "hoch" && Inference.valueWord(0.8, "en") === "high", "> 0.66 → high/hoch");
  assert(Inference.valueWord(0.5, "de") === "ausgewogen" && Inference.valueWord(0.5, "en") === "balanced", "mid → balanced/ausgewogen");
  assert(Inference.valueWord("denim", "de") === "Denim" && Inference.valueWord("denim", "en") === "denim", "known word → localised label");
  assert(Inference.valueWord("florp", "en") === "florp", "unknown word → echoes the raw value");
}

console.log("\n— suggestions surfaces only inferred (low-confidence) fills —");
{
  const dna = DNA.create();
  DNA.set(dna, "fabric.material", "wool", 0.4);      // inferred (conf ≤ threshold) → surface
  DNA.set(dna, "silhouette.fit", "fitted", 0.9);     // user-chosen (high conf) → skip
  DNA.set(dna, "color.scheme", "mono", 0);           // conf 0 → skip (not really known)
  DNA.set(dna, "construction.collar", "stand", 0.5); // exactly at threshold → surface (≤)

  const out = Inference.suggestions(dna, {}, "de");
  const paths = out.map((s) => s.path);
  assert(paths.includes("fabric.material"), "a low-confidence fill is surfaced");
  assert(paths.includes("construction.collar"), "confidence exactly at the threshold is included (≤)");
  assert(!paths.includes("silhouette.fit"), "a high-confidence (user) choice is NOT surfaced");
  assert(!paths.includes("color.scheme"), "a confidence-0 value is NOT surfaced");

  const mat = out.find((s) => s.path === "fabric.material");
  assert(mat.label === "Material" && mat.valueLabel === "Wolle", "DE labels: Material → Wolle");
  const matEn = Inference.suggestions(dna, {}, "en").find((s) => s.path === "fabric.material");
  assert(matEn.label === "Material" && matEn.valueLabel === "wool", "EN labels: Material → wool");

  // A custom (higher) threshold pulls in a formerly-excluded higher-conf fill.
  const withFit = Inference.suggestions(dna, { confidenceThreshold: 0.95 }, "de").map((s) => s.path);
  assert(withFit.includes("silhouette.fit"), "a higher confidenceThreshold widens what counts as 'inferred'");
}

console.log("\n— adjust · brightness repaints stops + writes derived colour —");
{
  const dna = DNA.create();
  DNA.set(dna, "color.stops", ["#404040", "#606060"], 1);
  const before = lumOf(firstStop(dna));
  const r = Inference.adjust(dna, "brightness", 1, "en");
  assert(r && r.axis === "brightness" && r.label === "Brightness", "returns the axis + localised label");
  assert(lumOf(firstStop(dna)) > before, "dir +1 lightens the first stop");
  assert(typeof DNA.get(dna, "color.value") === "number" && typeof DNA.get(dna, "color.saturation") === "number", "derived color.value + color.saturation are written back");

  const dna2 = DNA.create();
  DNA.set(dna2, "color.stops", ["#a0a0a0"], 1);
  Inference.adjust(dna2, "brightness", -1, "de");
  assert(lumOf(firstStop(dna2)) < lumOf("#a0a0a0"), "dir -1 darkens the first stop");
}

console.log("\n— adjust · temperature shifts warm vs cool —");
{
  const warm = DNA.create(); DNA.set(warm, "color.stops", ["#808080"], 1);
  Inference.adjust(warm, "temperature", 1, "de");
  const [wr, , wb] = hexToRgb(firstStop(warm));
  assert(wr > wb, "dir +1 pushes the stop warmer (red channel overtakes blue)");

  const cool = DNA.create(); DNA.set(cool, "color.stops", ["#808080"], 1);
  const r = Inference.adjust(cool, "temperature", -1, "en");
  const [cr, , cb] = hexToRgb(firstStop(cool));
  assert(cb > cr, "dir -1 pushes the stop cooler (blue channel overtakes red)");
  assert(r.label === "Temperature", "EN label for temperature");
}

console.log("\n— adjust · energy saturates/desaturates + re-weights archetypes —");
{
  const up = DNA.create(); DNA.set(up, "color.stops", ["#804030"], 1);
  const beforeSat = satOf(firstStop(up));
  Inference.adjust(up, "energy", 1, "de");
  assert(satOf(firstStop(up)) > beforeSat, "dir +1 saturates the stop");
  assert(up.archetypeWeights.techAvant > 0 && up.archetypeWeights.y2kStreet > 0, "dir +1 re-weights toward tech/street");
  assert(DNA.get(up, "intent.energy") > 0.5, "dir +1 raises intent.energy above the 0.5 default");

  const down = DNA.create();
  DNA.set(down, "color.stops", ["#804030"], 1);
  DNA.set(down, "intent.energy", 0.1, 0.9);          // exercise the numeric-energy branch
  const beforeSatD = satOf(firstStop(down));
  Inference.adjust(down, "energy", -1, "de");
  assert(satOf(firstStop(down)) < beforeSatD, "dir -1 desaturates the stop");
  assert(down.archetypeWeights.quietMinimal > 0 && down.archetypeWeights.softCouture > 0, "dir -1 re-weights toward quiet/couture");
  assert(DNA.get(down, "intent.energy") >= 0, "intent.energy stays clamped ≥ 0 even from a low start");
}

console.log("\n— adjust guards: unknown axis + no colour stops —");
{
  const dna = DNA.create();
  DNA.set(dna, "color.stops", ["#404040"], 1);
  assert(Inference.adjust(dna, "bogus-axis", 1, "de") === null, "an unknown axis returns null");

  const empty = DNA.create();                        // no color.stops at all
  let threw = false, res;
  try { res = Inference.adjust(empty, "brightness", 1, "de"); } catch (_e) { threw = true; }
  assert(!threw && res && res.axis === "brightness", "brightness with no stops is a safe no-op that still reports the axis");
  assert(DNA.get(empty, "color.value") === undefined, "…and writes no derived colour when there was nothing to repaint");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
