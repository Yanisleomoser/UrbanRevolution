/* Headless test for the "describe" modality's deterministic idea parser
   (js/design-engine/modalities/describe.js — window.DEModalities.describeParse)
   and flow.js's describe commit contract (resolveEffects).

   The parser reads ONLY the user's words (ai.js strict extractors + a small
   construction lexicon) — the guarantee under test: unmentioned dimensions
   are never seeded (no #1a1a1a/cotton fallbacks in the DNA), and impossible
   closures never pass the category whitelist. */
const path = require("path");
const ROOT = path.join(__dirname, "..", "js");

// ai.js reads a global CONFIG at IIFE eval (COLOR_DICT from CONFIG.COLORS).
global.CONFIG = require(path.join(ROOT, "config.js"));
global.DesignDNA = require(path.join(ROOT, "design-engine", "dna.js"));
global.DesignCondition = require(path.join(ROOT, "design-engine", "condition.js"));
global.DesignEngine = require(path.join(ROOT, "design-engine", "engine.js"));
const AI = require(path.join(ROOT, "ai.js"));
const DesignInference = require(path.join(ROOT, "design-engine", "inference.js"));
const GarmentSVG = require(path.join(ROOT, "design-engine", "garment-svg.js"));

// The modality is a browser IIFE — give it the window it expects.
global.window = { AI, DesignInference, GarmentSVG, DEVisuals: { el: () => ({}) } };
global.document = undefined;
require(path.join(ROOT, "design-engine", "modalities", "describe.js"));
const parse = global.window.DEModalities.describeParse;
const Flow = require(path.join(ROOT, "design-engine", "flow.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
const setOf = (entries) => {
  const s = {};
  entries.forEach((e) => Object.assign(s, e.set));
  return s;
};

console.log("\n— parseIdea · the example sentence seeds form/colour/finish/length/pockets —");
{
  const entries = parse("eine kastige, kurze Jacke in tiefem Rot, matt, viele Taschen", "de");
  const s = setOf(entries);
  assert(s.category === "jacket", "『Jacke』 → category jacket");
  assert(Array.isArray(s["color.stops"]) && /^#/.test(s["color.stops"][0]), "『Rot』 → a hex colour stop");
  assert(s["fabric.finishWeight"] === 0.2, "『matt』 → finishWeight 0.2");
  assert(s.length === "cropped", "『kurze』 → length cropped");
  assert(s["silhouette.fit"] >= 0.66, "『kastige』 → oversized fit");
  assert(s["construction.pockets"] === "cargo", "『Taschen』 on a jacket → cargo pockets");
}

console.log("\n— parseIdea · unmentioned dimensions stay unseeded (no silent fallbacks) —");
{
  const s = setOf(parse("ein Hoodie", "de"));
  assert(s.category === "hoodie", "category read");
  assert(!("color.stops" in s), "no colour named → no colour seeded (the #1a1a1a fallback stays out)");
  assert(!("fabric.material" in s), "no material named → no material seeded");
  assert(!("silhouette.fit" in s), "no fit named → no fit seeded");
  assert(parse("", "de").length === 0 && parse("ab", "de").length === 0, "empty/too-short text reads nothing");
}

console.log("\n— parseIdea · closure respects the category whitelist —");
{
  const tee = setOf(parse("ein T-Shirt mit Reissverschluss", "de"));
  assert(!("construction.closure" in tee), "zip on a t-shirt is refused (closureAllowed)");
  const jacket = setOf(parse("eine Jacke mit Reissverschluss", "de"));
  assert(jacket["construction.closure"] === "zip", "zip on a jacket is read");
}

console.log("\n— parseIdea · English reads too —");
{
  const s = setOf(parse("a boxy cropped jacket in deep red, matte, lots of pockets", "en"));
  assert(s.category === "jacket" && s.length === "cropped" && s["fabric.finishWeight"] === 0.2,
    "the same sentence reads in English (jacket · cropped · matte)");
}

console.log("\n— resolveEffects · describe commits at 0.62 (skip gates, lose to real answers) —");
{
  const node = { modality: "describe" };
  const r = Flow.resolveEffects(node, { set: { category: "jacket", length: "cropped" } });
  assert(r.conf === 0.62, "describe confidence is 0.62 — above the decided threshold (0.5) and the <0.6 gates");
  assert(r.conf < 0.75, "…and below protectExplicit (0.75), so later real answers always win");
  assert(r.eff.set.category === "jacket", "parsed set passes through");
  const skip = Flow.resolveEffects(node, { skip: true });
  assert(Object.keys(skip.eff.set).length === 0, "skip carries no effects — the classic path is untouched");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
