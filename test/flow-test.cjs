/* Headless test for the Design-Engine flow controller's pure helpers
   (js/design-engine/flow.js).

   flow.js's runtime entry is mount() (DOM + fetch bound), but the journey's
   decision logic lives in small pure helpers that flow.js now exposes as a test
   seam (same convention as api/try-on.js exporting its error mappers):

     resolveEffects(node, payload) — maps a modality answer → DNA effects
     shiftHex(hex, dh, dl)         — HSL hue/lightness drift for variants
     mutateDna(base, idx, version) — deterministic concept-studio mutation

   resolveEffects' cards/default branches delegate to DesignEngine.choiceEffects,
   and mutateDna drives DesignDNA — both bare globals, so we wire the real
   modules onto `global` exactly like engine-test.cjs does. */
const path = require("path");
const ROOT = path.join(__dirname, "..", "js", "design-engine");
global.DesignDNA = require(path.join(ROOT, "dna.js"));
global.DesignEngine = require(path.join(ROOT, "engine.js"));
const Flow = require(path.join(ROOT, "flow.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("\n— resolveEffects · slider (binds value, weights archetypes at the extremes) —");
const slider = { modality: "slider", bind: "silhouette.fit", weightAt: { low: { quietMinimal: 1 }, high: { y2kStreet: 2 } } };
{
  const low = Flow.resolveEffects(slider, 0.2);
  assert(low.conf === 0.8, "slider answers land at confidence 0.8 (still movable)");
  assert(low.eff.set["silhouette.fit"] === 0.2, "raw slider value is bound");
  assert(eq(low.eff.weight, { quietMinimal: 1 }), "value < 0.34 applies the 'low' archetype weight");

  const high = Flow.resolveEffects(slider, 0.9);
  assert(eq(high.eff.weight, { y2kStreet: 2 }), "value > 0.66 applies the 'high' archetype weight");

  const mid = Flow.resolveEffects(slider, 0.5);
  assert(eq(mid.eff.weight, {}), "a mid value weights no archetype (only the extremes do)");
}

console.log("\n— resolveEffects · colorGradient (maps the full colour payload) —");
{
  const r = Flow.resolveEffects({ modality: "colorGradient" }, { scheme: "duo-gradient", stops: ["#fff", "#000"], value: 0.5, saturation: 0.7 });
  assert(r.conf === 1, "colour choice is fully confident");
  assert(r.eff.set["color.scheme"] === "duo-gradient" && eq(r.eff.set["color.stops"], ["#fff", "#000"]), "scheme + stops mapped");
  assert(r.eff.set["color.value"] === 0.5 && r.eff.set["color.saturation"] === 0.7, "value + saturation mapped");
}

console.log("\n— resolveEffects · ranking (decay-weights the order, top option also renders) —");
{
  const node = { modality: "ranking", bind: "topPick", options: [
    { id: "a", effects: { weight: { techAvant: 1 }, set: { "silhouette.fit": 0.2 } } },
    { id: "b", effects: { weight: { sport: 1 } } },
    { id: "c", effects: { weight: { utility: 1 } } },
  ] };
  const r = Flow.resolveEffects(node, ["a", "b", "c"]);
  // decay = [1, 0.6, 0.35, ...] — first place full weight, later places less.
  assert(r.eff.weight.techAvant === 1, "1st place gets full weight (×1)");
  assert(Math.abs(r.eff.weight.sport - 0.6) < 1e-9, "2nd place gets ×0.6");
  assert(Math.abs(r.eff.weight.utility - 0.35) < 1e-9, "3rd place gets ×0.35");
  assert(r.eff.set["silhouette.fit"] === 0.2, "the top option's set() renders (visible reshape)");
  assert(r.eff.set.topPick === "a", "bind records the winner");
  assert(eq(Flow.resolveEffects(node, []).eff.weight, {}), "empty ranking → no weights, no throw");
}

console.log("\n— resolveEffects · cards (multi-select aggregates each card's effects) —");
{
  // DesignEngine.choiceEffects reads node.choices[].effects — give it real ones.
  const node = { modality: "cards", bind: "details", choices: [
    { id: "x", effects: { set: { "construction.collar": "hood" }, weight: { y2kStreet: 1 } } },
    { id: "y", effects: { set: { "construction.cuffs": "ribbed" }, weight: { y2kStreet: 2, sport: 1 } } },
  ] };
  const r = Flow.resolveEffects(node, ["x", "y"]);
  assert(r.eff.set["construction.collar"] === "hood" && r.eff.set["construction.cuffs"] === "ribbed", "both cards' set() merge");
  assert(r.eff.weight.y2kStreet === 3 && r.eff.weight.sport === 1, "overlapping archetype weights ADD across cards");
  assert(r.eff.set.details === "x+y", "bind joins the selected ids");
}

console.log("\n— shiftHex (HSL hue/lightness drift, invalid input passes through) —");
{
  assert(/^#[0-9a-f]{6}$/i.test(Flow.shiftHex("#2779a8", 30, 0.05)), "valid hex → valid hex");
  assert(Flow.shiftHex("#808080", 0, 0).toLowerCase() === "#808080", "zero drift on a neutral grey is a no-op");
  assert(Flow.shiftHex("notahex", 30, 0) === "notahex", "non-hex string passes through unchanged");
  assert(Flow.shiftHex(null, 10, 0) === null, "null passes through (no throw)");
  // A +180° hue rotation must actually change the colour.
  assert(Flow.shiftHex("#2779a8", 180, 0).toLowerCase() !== "#2779a8", "a real hue rotation changes the hex");
}

console.log("\n— mutateDna (deterministic concept-studio variants, base untouched) —");
{
  const base = global.DesignDNA.create();
  global.DesignDNA.set(base, "color.stops", ["#2779a8"], 1);
  global.DesignDNA.set(base, "silhouette.fit", 0.5, 1);
  global.DesignDNA.set(base, "fabric.finishWeight", 0.4, 1);
  const baseSnapshot = JSON.stringify(base);

  const v1a = Flow.mutateDna(base, 1, 1);
  const v1b = Flow.mutateDna(base, 1, 1);
  assert(eq(v1a, v1b), "same (idx, version) → identical variant (stable hash, no RNG lottery)");
  assert(!eq(Flow.mutateDna(base, 1, 1), Flow.mutateDna(base, 2, 1)), "different concept index → different variant");
  assert(!eq(Flow.mutateDna(base, 1, 1), Flow.mutateDna(base, 1, 2)), "different version → refined variant");
  assert(JSON.stringify(base) === baseSnapshot, "mutateDna never mutates the base DNA (deep-cloned)");

  const fit = global.DesignDNA.get(v1a, "silhouette.fit");
  assert(typeof fit === "number" && fit >= 0 && fit <= 1, "mutated fit stays clamped to 0..1");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
