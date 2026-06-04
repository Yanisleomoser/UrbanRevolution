/* Headless logic test for the Design Engine core (no DOM, no browser).
   Loads the classic-script modules as CommonJS (their dual export guard),
   places them on `global` so cross-references resolve, then drives the engine
   through two opposite personas to prove emergent branching. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "js", "design-engine");
global.DesignDNA = require(path.join(ROOT, "dna.js"));
global.DesignCondition = require(path.join(ROOT, "condition.js"));
const Engine = require(path.join(ROOT, "engine.js"));
global.DesignSummary = require(path.join(ROOT, "summary.js"));
const Inference = require(path.join(ROOT, "inference.js"));
const DNA = global.DesignDNA;

const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const archetypes = readJSON("content/archetypes.json").archetypes;
const attributes = readJSON("content/attributes.json");
const nodes = [
  ...readJSON("content/nodes/intent.json").nodes,
  ...readJSON("content/nodes/jacket.json").nodes,
];

const phaseOf = (id) => (nodes.find((n) => n.id === id) || {}).phase;
// The mood "spine": the two core This-or-That pairs come first, the garment
// category lands by ~the 3rd question (so the preview shows the piece early),
// and neither core mood pair resurfaces afterwards.
const CORE_MOOD = ["mood_calm_bold", "mood_soft_sharp"];
function moodSpineOk(order) {
  const catIdx = order.indexOf("category_select");
  if (catIdx === -1 || catIdx > 2) return false;
  return CORE_MOOD.every((id) => {
    const idx = order.indexOf(id);
    return idx !== -1 && idx < catIdx && order.lastIndexOf(id) === idx;
  });
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

// Turn a persona's choice into an effects object per modality (mirrors flow.js).
function resolveEffects(node, choice) {
  if (node.modality === "slider") {
    const eff = { set: { [node.bind]: choice }, weight: {} };
    if (node.weightAt) {
      if (choice < 0.34 && node.weightAt.low) Object.assign(eff.weight, node.weightAt.low);
      if (choice > 0.66 && node.weightAt.high) Object.assign(eff.weight, node.weightAt.high);
    }
    return { eff, conf: 0.8 };
  }
  if (node.modality === "colorGradient") return { eff: choice, conf: 1 };
  return { eff: Engine.choiceEffects(node, choice), conf: 1 };
}

function run(label, persona) {
  const dna = DNA.create();
  const answered = new Set();
  const order = [];
  let guard = 0;
  while (guard++ < 100) {
    const node = Engine.nextNode(nodes, dna, answered);
    if (!node) break;
    order.push(node.id);
    const choice = persona[node.id] !== undefined ? persona[node.id] : persona._default(node);
    const { eff, conf } = resolveEffects(node, choice);
    Engine.answer(dna, node, eff, answered, conf);
  }
  Engine.finalize(dna, archetypes, attributes.required, attributes.confidenceThreshold);
  return { dna, order };
}

const calm = {
  mood_calm_bold: "calm",
  mood_soft_sharp: "soft",
  mood_clean_expressive: "clean",
  mood_vintage_future: "vintage",
  intent_occasion: "work",
  intent_season: "all",
  intent_formality: 0.7,
  category_select: "jacket",
  jacket_subarch: "trench",
  jacket_fit: 0.2,
  jacket_length: "long",
  jacket_material: "wool",
  jacket_finish: 0.2,
  jacket_color: { set: { "color.scheme": "mono", "color.stops": ["#1a1a1a"], "color.value": 0.2, "color.saturation": 0.1 } },
  jacket_collar: "notched",
  _default: () => "regular",
};

const bold = {
  mood_calm_bold: "bold",
  mood_soft_sharp: "sharp",
  mood_clean_expressive: "expressive",
  mood_vintage_future: "future",
  intent_occasion: "active",
  intent_season: "cold",
  intent_formality: 0.2,
  category_select: "jacket",
  jacket_subarch: "puffer",
  jacket_fit: 0.92,
  jacket_length: "cropped",
  jacket_material: "polyester",
  jacket_finish: 0.5,
  jacket_color: { set: { "color.scheme": "duo-gradient", "color.stops": ["#ec4899", "#06b6d4"], "color.value": 0.4, "color.saturation": 0.85 } },
  jacket_pattern: "graphic",
  jacket_pattern_scale: 0.7,
  jacket_closure: "zip",
  jacket_collar: "hood",
  jacket_sleeve: "drop",
  jacket_pockets: "cargo",
  jacket_cuffs: "ribbed",
  jacket_hem: "drawcord",
  jacket_hardware: "metal",
  jacket_signature: "branding",
  _default: () => "regular",
};

console.log("\n— Condition evaluator —");
assert(DesignCondition.evaluate("true", {}) === true, "'true' → true");
assert(DesignCondition.evaluate("category == 'jacket'", { category: "jacket" }) === true, "string equality");
assert(DesignCondition.evaluate("_confidence.silhouette.fit < 0.6", DNA.create()) === true, "missing confidence → 0 (< 0.6)");
assert(DesignCondition.evaluate("intent.energy > 0.6 && category == 'jacket'", { intent: { energy: 0.8 }, category: "jacket" }) === true, "compound && ");
assert(DesignCondition.evaluate("subArchetype != 'blazer'", {}) === true, "undefined != literal → true");
assert(DesignCondition.evaluate("nope (((", {}) === false, "malformed → fail-closed false");

console.log("\n— Persona: CALM / minimal —");
const C = run("calm", calm);
console.log("  order:", C.order.join(" → "));
console.log("  top archetype:", DNA.topArchetype(C.dna));
console.log("  summary:", DesignSummary.toSentence(C.dna, "en"));
assert(C.order[0].indexOf("mood") === 0, "starts with a mood node (phase A)");
const catIdx = C.order.indexOf("category_select");
const firstJacket = C.order.findIndex((id) => id.startsWith("jacket_"));
assert(catIdx !== -1 && catIdx < firstJacket, "category resolved before any jacket node");
assert(!C.order.includes("jacket_hardware"), "calm path SKIPS jacket_hardware (energy ≤ 0.6 gate)");
assert(new Set(C.order).size === C.order.length, "no node offered twice");
assert(DNA.maturity(C.dna, attributes.required, attributes.confidenceThreshold) > 0.9, "maturity > 0.9 after finalize");
assert(["quietMinimal", "softCouture"].includes(DNA.topArchetype(C.dna)), "calm → quiet/soft archetype");
assert(moodSpineOk(C.order), "Reihenfolge: 2 Mood-Paare -> Kategorie <=Frage 3, kein Kern-Mood danach (calm)");

console.log("\n— Persona: BOLD / Y2K —");
const B = run("bold", bold);
console.log("  order:", B.order.join(" → "));
console.log("  top archetype:", DNA.topArchetype(B.dna));
console.log("  summary:", DesignSummary.toSentence(B.dna, "de"));
console.log("  prompt:", DesignSummary.toPrompt(B.dna, "de"));
assert(B.order.includes("jacket_hardware"), "bold path INCLUDES jacket_hardware (energy > 0.6)");
assert(["y2kStreet", "techAvant", "sport"].includes(DNA.topArchetype(B.dna)), "bold → y2k/tech/sport archetype");
assert(JSON.stringify(C.order) !== JSON.stringify(B.order), "the two personas take DIFFERENT paths (emergent branching)");
assert(B.order.includes("jacket_pattern"), "bold reaches Phase-D pattern node (deep branch)");
assert(B.order.includes("jacket_pockets") && B.order.includes("jacket_cuffs") && B.order.includes("jacket_signature"), "bold reaches deep Phase-E detail nodes");
assert(!C.order.includes("jacket_pattern") && !C.order.includes("jacket_signature"), "calm SKIPS loud pattern/signature nodes (energy gate, brief §11)");
assert(moodSpineOk(B.order), "Reihenfolge: 2 Mood-Paare -> Kategorie frueh (bold)");

console.log("\n— Bug 1: pure express (only category) → 100% —");
const pe = DNA.create();
DNA.set(pe, "category", "jacket", 1);
Engine.finalize(pe, archetypes, attributes.required, attributes.confidenceThreshold);
assert(DNA.get(pe, "length") !== undefined, "length filled from archetype default");
assert(DNA.maturity(pe, attributes.required, attributes.confidenceThreshold) > 0.999, "pure express reaches 100% maturity");

console.log("\n— Inference layer (Phase F) —");
const vec = Inference.styleVector(B.dna);
assert(Object.keys(vec).length === 6 && Math.abs(Object.values(vec).reduce((a, b) => a + b, 0) - 1) < 1e-6, "styleVector is a normalised distribution");
assert(Array.isArray(Inference.suggestions(B.dna, attributes, "de")), "suggestions() returns inferred fills");
const beforeColor = DNA.get(B.dna, "color.stops")[0];
Inference.adjust(B.dna, "brightness", 1, "de");
assert(DNA.get(B.dna, "color.stops")[0] !== beforeColor, "warmer/colder visibly repaints colour stops");
const beforeEnergy = DNA.get(B.dna, "intent.energy");
Inference.adjust(B.dna, "energy", -1, "de");
assert(DNA.get(B.dna, "intent.energy") < beforeEnergy, "energy nudge lowers intent.energy");

console.log("\n— Share (URL roundtrip) —");
const Share = require(path.join(ROOT, "share.js"));
const dec = Share.decode(Share.encode(B.dna));
assert(dec && dec.category === DNA.get(B.dna, "category") && JSON.stringify(dec.color) === JSON.stringify(DNA.get(B.dna, "color")), "encode → decode roundtrips the DNA");
assert(Share.decode("@@not-base64@@") === null, "decode of garbage → null");

console.log("\n— Short path completion (express) —");
const S = run("express", { mood_calm_bold: "calm", category_select: "jacket", _default: () => "regular" });
Engine.finalize(S.dna, archetypes, attributes.required, attributes.confidenceThreshold);
const haveAll = attributes.required.every((p) => DNA.get(S.dna, p) !== undefined);
assert(haveAll, "express path still yields a COMPLETE design (all required attrs filled)");
console.log("  express summary:", DesignSummary.toSentence(S.dna, "en"));

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
