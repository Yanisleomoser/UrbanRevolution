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
  // U4: idea_describe schiebt das Rückgrat um genau eine Position (Kategorie
  // spätestens Frage 4 statt 3).
  if (catIdx === -1 || catIdx > 3) return false;
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
  if (node.modality === "ranking") {
    // Mirrors flow.js: choice is a ranked array of option ids; decayed weights
    // plus the top pick's own set() + the bind path.
    const decay = [1, 0.6, 0.35, 0.2, 0.1];
    const payload = Array.isArray(choice) ? choice : [];
    const weight = {};
    payload.forEach((id, idx) => {
      const opt = (node.options || []).find((o) => o.id === id);
      const w = opt && opt.effects && opt.effects.weight;
      if (w) { const f = decay[idx] != null ? decay[idx] : 0.05; Object.entries(w).forEach(([k, v]) => { weight[k] = (weight[k] || 0) + v * f; }); }
    });
    const eff = { weight, set: {} };
    const topOpt = (node.options || []).find((o) => o.id === payload[0]);
    if (topOpt && topOpt.effects && topOpt.effects.set) Object.assign(eff.set, topOpt.effects.set);
    if (node.bind && payload.length) eff.set[node.bind] = payload[0];
    return { eff, conf: 1 };
  }
  if (node.modality === "regions") {
    // Mirrors flow.js: { regionId: choiceId } picks merge; a non-object payload
    // (a persona's _default string) means "accept as is" — empty effects.
    const picks = choice && typeof choice === "object" && !Array.isArray(choice) ? choice : {};
    const eff = { set: {}, weight: {} };
    Object.entries(picks).forEach(([rid, cid]) => {
      const region = (node.regions || []).find((rg) => rg.id === rid);
      const c = region && (region.choices || []).find((x) => x.id === cid);
      if (c && c.effects && c.effects.set) Object.assign(eff.set, c.effects.set);
      if (c && c.effects && c.effects.weight) Object.entries(c.effects.weight).forEach(([k, v]) => { eff.weight[k] = (eff.weight[k] || 0) + v; });
    });
    return { eff, conf: 1 };
  }
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
  category_select: "jacket",
  jacket_subarch: "trench",
  jacket_fit: 0.2,
  jacket_length: "long",
  jacket_material: "wool",
  jacket_finish: 0.2,
  jacket_color: { set: { "color.scheme": "mono", "color.stops": ["#1a1a1a"] } },
  // Detail board: calm touches ONE region and leaves the rest to inference —
  // exactly the partial-answer path the board exists for.
  jacket_details: { collar: "notched" },
  _default: () => "regular",
};

const bold = {
  mood_calm_bold: "bold",
  mood_soft_sharp: "sharp",
  mood_clean_expressive: "expressive",
  category_select: "jacket",
  jacket_subarch: "puffer",
  jacket_fit: 0.92,
  jacket_length: "cropped",
  jacket_material: "polyester",
  jacket_finish: 0.5,
  jacket_color: { set: { "color.scheme": "duo-gradient", "color.stops": ["#ec4899", "#06b6d4"] } },
  jacket_pattern: "graphic",
  jacket_pattern_scale: 0.7,
  jacket_details: { closure: "zip", collar: "hood", sleeve: "drop", pockets: "cargo", cuffs: "ribbed", hem: "drawcord" },
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
// U4: der Auftakt in eigenen Worten (idea_describe) ist jetzt deterministisch
// Q1; die Mood-Paare folgen direkt dahinter.
assert(C.order[0] === "idea_describe", "starts with the describe opener (own words, Q1)");
assert(C.order[1].indexOf("mood") === 0, "the first mood node follows the opener");
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
assert(B.order.includes("jacket_details") && B.order.includes("jacket_signature"), "bold reaches the Phase-E detail board + signature");
assert(DNA.get(B.dna, "construction.pockets") === "cargo" && DNA.get(B.dna, "construction.cuffs") === "ribbed"
  && DNA.get(B.dna, "construction.hem") === "drawcord" && DNA.get(B.dna, "construction.closure") === "zip",
  "one board answer lands ALL touched regions in the DNA (Eingabe == Output)");
// 15, not 14: the fixed mood_rank bug (see below) restores one real, previously
// unreachable question (a ranking node) to this path — the ceiling moves by
// exactly that +1, not because the board stopped compressing phase E.
assert(B.order.length <= 16,
  `the board compresses phase E: even the answer-everything bold path fits in 16 screens incl. the describe opener, was 19 (${B.order.length})`);
assert(!C.order.includes("jacket_pattern") && !C.order.includes("jacket_signature"), "calm SKIPS loud pattern/signature nodes (energy gate, brief §11)");
assert(moodSpineOk(B.order), "Reihenfolge: 2 Mood-Paare -> Kategorie frueh (bold)");

console.log("\n— category lands on Q3 DETERMINISTICALLY, not by array order (roadmap C2) —");
{
  // At priority 1 the category node scored exactly 0.90 = mood_soft_sharp, so a
  // pure iteration-order tie decided whether category was Q2 or Q3. Lowering it
  // to 0.95 (→ 0.855) makes mood_soft_sharp reliably win Q2 and category reliably
  // land Q3, regardless of how the intent nodes are ordered in the array.
  const intent = readJSON("content/nodes/intent.json").nodes;
  const jacket = readJSON("content/nodes/jacket.json").nodes;
  const openingOrder = (intentNodes) => {
    const nodeList = [...intentNodes, ...jacket];
    const dna = DNA.create();
    DNA.set(dna, "intent.energy", 0.5, 0.05); // C1 seed (mirrors flow.js mount)
    const answered = new Set();
    const order = [];
    for (let i = 0; i < 10; i++) {
      const n = Engine.nextNode(nodeList, dna, answered);
      if (!n) break;
      order.push(n.id);
      if (n.id === "category_select") break;
      const eff = (n.pair && n.pair[0] && n.pair[0].effects) || (n.choices && n.choices[0] && n.choices[0].effects) || null;
      if (eff) DNA.applyEffects(dna, eff, 0.8);
      answered.add(n.id);
    }
    return order;
  };
  const normal = openingOrder(intent);
  const reversed = openingOrder([...intent].reverse());
  // U4: idea_describe ist deterministisch Q1 → das ganze Rückgrat rückt um
  // eine Position (Kategorie Q4 statt Q3), bleibt aber deterministisch.
  assert(normal[0] === "idea_describe", "the describe opener is deterministically Q1");
  assert(normal.indexOf("category_select") === 3, "category is Q4 with the nodes in file order");
  assert(reversed.indexOf("category_select") === 3, "category is STILL Q4 with the intent nodes reversed (tie broken deterministically)");
  assert(JSON.stringify(normal) === JSON.stringify(reversed), "the whole opening is identical regardless of node array order");
  assert(normal[2] === "mood_soft_sharp", "the second mood pair reliably wins Q3 over the category node");
}

console.log("\n— Session-Jitter (Runde 3): Branch-Reihenfolge variiert pro Seed, Spine bleibt —");
{
  const Flow = require(path.join(ROOT, "flow.js"));
  const walk = (rand) => {
    const dna = DNA.create();
    const answered = new Set();
    const order = [];
    let guard = 0;
    while (guard++ < 100) {
      const node = Engine.nextNode(nodes, dna, answered, undefined, rand);
      if (!node) break;
      order.push(node.id);
      const choice = bold[node.id] !== undefined ? bold[node.id] : bold._default(node);
      const { eff, conf } = resolveEffects(node, choice);
      Engine.answer(dna, node, eff, answered, conf);
    }
    return order;
  };
  const plain = walk(undefined);
  assert(JSON.stringify(plain) === JSON.stringify(B.order),
    "without a rand fn nextNode is byte-identical to the classic order (all old callers untouched)");
  // Zwei Seeds, deren Branch-Reihenfolge nachweislich auseinanderfällt —
  // deterministisch (orderRand ist ein purer Hash), also stabil im CI.
  const seedOrders = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => walk(Flow.orderRand(s)));
  const catAt = (o) => o.indexOf("category_select");
  assert(seedOrders.every((o) => o.slice(0, catAt(o) + 1).join("|") === plain.slice(0, catAt(plain) + 1).join("|")),
    "the opening spine (describe → moods → category) is IDENTICAL under every seed (jitter starts after the category)");
  assert(seedOrders.every((o) => new Set(o).size === o.length && o.length === plain.length),
    "every seeded walk asks the same questions exactly once (variation reorders, never drops/duplicates)");
  const distinct = new Set(seedOrders.map((o) => o.join("|")));
  assert(distinct.size >= 2,
    `different seeds produce genuinely different branch orders (${distinct.size}/8 distinct)`);
  assert(JSON.stringify(walk(Flow.orderRand(7))) === JSON.stringify(walk(Flow.orderRand(7))),
    "the same seed always replays the same order (Zurück/Resume-Stabilität)");
}

console.log("\n— Bug 1: pure express (only category) → 100% —");
const pe = DNA.create();
DNA.set(pe, "category", "jacket", 1);
Engine.finalize(pe, archetypes, attributes.required, attributes.confidenceThreshold);
assert(DNA.get(pe, "length") !== undefined, "length filled from archetype default");
assert(DNA.maturity(pe, attributes.required, attributes.confidenceThreshold) > 0.999, "pure express reaches 100% maturity");

console.log("\n— Bug: abstract mood pairs are retracted once the category is chosen —");
// Omit the secondary mood pairs from the persona so the engine decides when to
// surface them; they must never appear AFTER the category (mood_clean_expressive
// previously slipped the retraction because its 'clean' side sets pattern.type).
const moodP = run("mood-retract", {
  mood_calm_bold: "bold", mood_soft_sharp: "sharp",
  category_select: "jacket", jacket_subarch: "puffer",
  _default: () => "regular",
});
const mCat = moodP.order.indexOf("category_select");
["mood_clean_expressive"].forEach((id) => {
  const idx = moodP.order.indexOf(id);
  assert(idx === -1 || idx < mCat, `${id} never resurfaces after the category (idx ${idx} vs cat ${mCat})`);
});

console.log("\n— Bug: mood_rank (a real `ranking` question) was permanently unreachable —");
// isPureSoftMood()'s /^(mood_|inspo_)/ id check used to fire for ANY node with
// that id prefix, not just the intended thisOrThat mood pairs — so the real
// `ranking` question mood_rank (bind: intent.aesthetic) was retracted the
// instant category_select resolved, exactly like the thisOrThat pairs above,
// even though it has its own concrete bind/gate and was never meant to be
// treated as content-free. It must now actually surface and resolve.
const rankP = run("mood-rank-reachable", {
  mood_calm_bold: "bold", mood_soft_sharp: "sharp",
  category_select: "jacket", jacket_subarch: "puffer",
  mood_rank: ["tech", "street", "minimal", "couture"],
  _default: () => "regular",
});
assert(rankP.order.includes("mood_rank"), "mood_rank is offered somewhere in the journey");
assert(DNA.confidence(rankP.dna, "intent.aesthetic") > 0, "answering mood_rank sets confidence on intent.aesthetic");
assert(DNA.get(rankP.dna, "intent.aesthetic") === "tech", "the top-ranked option writes its bind path");

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

// ─── Garment parity: every category offers jacket-depth choices ─────────────
// (the journey must not be deep only for jackets — brief + user requirement)
console.log("\n— Garment parity (all 6 categories at jacket depth) —");
const GARMENTS = ["jacket", "hoodie", "shirt", "tshirt", "pants", "dress"];
const fileNodes = {};
GARMENTS.forEach((g) => (fileNodes[g] = readJSON(`content/nodes/${g}.json`).nodes));
const setsPath = (ns, p) => ns.some((n) =>
  (n.bind === p) ||
  (n.choices || []).some((c) => c.effects && c.effects.set && Object.prototype.hasOwnProperty.call(c.effects.set, p)) ||
  (n.regions || []).some((rg) => (rg.choices || []).some((c) => c.effects && c.effects.set && Object.prototype.hasOwnProperty.call(c.effects.set, p))));
// The regions board replaced the phase-E card grids (roadmap §7) — depth now
// lives in the board's regions, so parity counts SURFACES (nodes + regions).
const REGIONS_CATS = ["jacket", "hoodie", "shirt", "tshirt", "pants"];
GARMENTS.forEach((g) => {
  const ns = fileNodes[g];
  const regionCount = ns.reduce((s, n) => s + (n.regions || []).length, 0);
  assert(ns.length + regionCount >= 12, `${g}: >= 12 decision surfaces (has ${ns.length} nodes + ${regionCount} regions)`);
  ["subArchetype", "silhouette.fit", "length", "fabric.material", "fabric.finishWeight", "pattern.type", "pattern.scale", "signature"]
    .forEach((p) => assert(setsPath(ns, p), `${g}: resolves ${p}`));
  assert(ns.some((n) => n.modality === "colorGradient"), `${g}: has a colour node`);
});
REGIONS_CATS.forEach((g) => {
  const board = fileNodes[g].find((n) => n.modality === "regions");
  assert(board && board.id === `${g}_details` && (board.regions || []).length >= 2,
    `${g}: has a regions detail board with >= 2 regions`);
  const ids = (board.regions || []).map((r) => r.id);
  assert(new Set(ids).size === ids.length, `${g}: region ids are unique`);
  (board.regions || []).forEach((rg) => {
    assert((rg.choices || []).length >= 2, `${g}/${rg.id}: >= 2 choices`);
    assert(rg.label && rg.label.de && rg.label.en, `${g}/${rg.id}: bilingual label`);
    (rg.choices || []).forEach((c) => assert(c.label && c.label.de && c.label.en && c.effects && c.effects.set,
      `${g}/${rg.id}/${c.id}: bilingual label + set effects`));
  });
});
{
  const board = fileNodes.jacket.find((n) => n.id === "jacket_details");
  assert(board.regions.length === 6, "jacket board carries all six construction regions");
  const tp = Engine.targetPaths(board);
  ["construction.closure", "construction.collar", "construction.sleeve", "construction.pockets", "construction.cuffs", "construction.hem"]
    .forEach((p) => assert(tp.includes(p), `jacket board targets ${p} (engine gain sees the regions)`));
  // Blazer: closure decided at the subarch pick → the region gate hides it.
  assert(board.regions[0].id === "closure" && /blazer/.test(board.regions[0].when || ""),
    "closure region is gated off for the blazer subarchetype");
}

// Every attribute path a node sets must surface in the preview params mapping
// (Eingabe == Output: no choice may silently disappear before the renderer).
console.log("\n— Input → output coverage (node sets ⊆ preview params) —");
global.GarmentSVG = require(path.join(ROOT, "garment-svg.js"));
const Preview = require(path.join(ROOT, "render-preview.js"));
const RENDERED_PATHS = new Set([
  "category", "subArchetype", "length", "silhouette.fit", "silhouette.structure", "silhouette.volume",
  "fabric.material", "fabric.finish", "fabric.finishWeight", "color.scheme", "color.stops",
  "pattern.type", "pattern.scale", "hardware.finish", "signature", "intent.energy",
  "construction.collar", "construction.closure", "construction.sleeve", "construction.sleeveLength",
  "construction.pockets", "construction.cuffs", "construction.hem", "construction.waistband", "construction.waist",
]);
const NON_VISUAL = new Set(["fabric.weight"]); // inferred, never a node-set visual path
let uncovered = [];
GARMENTS.forEach((g) => fileNodes[g].forEach((n) => {
  const paths = [];
  if (n.bind) paths.push(n.bind);
  (n.choices || []).forEach((c) => c.effects && c.effects.set && paths.push(...Object.keys(c.effects.set)));
  (n.regions || []).forEach((rg) => (rg.choices || []).forEach((c) => c.effects && c.effects.set && paths.push(...Object.keys(c.effects.set))));
  paths.forEach((p) => { if (!RENDERED_PATHS.has(p) && !NON_VISUAL.has(p)) uncovered.push(`${g}/${n.id} → ${p}`); });
}));
assert(uncovered.length === 0, "every garment-node set path reaches the renderer" + (uncovered.length ? ` (uncovered: ${uncovered.join(", ")})` : ""));

// ─── Persona: STREET HOODIE — deep branch + DNA mirrors the answers ─────────
console.log("\n— Persona: STREET / hoodie —");
const hoodieNodes = [...readJSON("content/nodes/intent.json").nodes, ...fileNodes.hoodie];
function runOn(nodeList, persona) {
  const dna = DNA.create();
  const answered = new Set();
  const order = [];
  let guard = 0;
  while (guard++ < 100) {
    const node = Engine.nextNode(nodeList, dna, answered);
    if (!node) break;
    order.push(node.id);
    const choice = persona[node.id] !== undefined ? persona[node.id] : persona._default(node);
    const { eff, conf } = resolveEffects(node, choice);
    Engine.answer(dna, node, eff, answered, conf);
  }
  Engine.finalize(dna, archetypes, attributes.required, attributes.confidenceThreshold);
  return { dna, order };
}
const street = {
  mood_calm_bold: "bold", mood_soft_sharp: "sharp", mood_clean_expressive: "expressive",
  category_select: "hoodie",
  hoodie_subarch: "zip", hoodie_fit: 0.9, hoodie_length: "regular", hoodie_sleeve: "drop",
  hoodie_material: "fleece", hoodie_finish: 0.8,
  hoodie_color: { set: { "color.scheme": "mono", "color.stops": ["#2a9d8f"] } },
  hoodie_pattern: "graphic", hoodie_pattern_scale: 0.8,
  hoodie_details: { pockets: "kangaroo", hem: "ribbed" }, hoodie_hardware: "metal", hoodie_signature: "branding",
  _default: (n) => (n.modality === "slider" ? 0.5 : (n.choices && n.choices[0] ? n.choices[0].id : "regular")),
};
const H = runOn(hoodieNodes, street);
console.log("  order:", H.order.join(" → "));
assert(H.order.includes("hoodie_pattern") && H.order.includes("hoodie_signature") && H.order.includes("hoodie_hardware"),
  "street hoodie reaches deep pattern/hardware/signature nodes");
assert(DNA.get(H.dna, "pattern.type") === "graphic" && DNA.get(H.dna, "construction.closure") === "zip"
  && DNA.get(H.dna, "hardware.finish") === "metal" && DNA.get(H.dna, "construction.pockets") === "kangaroo",
  "hoodie DNA mirrors every answer (Eingabe == Output)");
const hParams = Preview.params(H.dna);
const hSvg = global.GarmentSVG.build(hParams.category, hParams);
assert(hSvg.includes("<svg") && !hSvg.includes("NaN"), "hoodie persona renders a clean flat");
assert(hSvg !== global.GarmentSVG.build("hoodie", { fit: 0.5 }), "hoodie persona flat differs from the default flat");

// ─── Persona: COUTURE DRESS — sleeveless slip + slit reach the flat ─────────
console.log("\n— Persona: COUTURE / dress —");
const dressNodes = [...readJSON("content/nodes/intent.json").nodes, ...fileNodes.dress];
const couture = {
  mood_calm_bold: "bold", mood_soft_sharp: "soft", mood_clean_expressive: "expressive",
  category_select: "dress",
  dress_subarch: "slip", dress_fit: 0.75, dress_length: "long",
  // Detail-Atelier (Runde 3): Ausschnitt/Ärmel/Taille leben jetzt als
  // Regions-Board — ein Payload landet alle drei, wie beim Jacket-Board.
  dress_details: { collar: "vneck", sleeve: "sleeveless", waist: "fitted" },
  dress_material: "silk", dress_finish: 0.9,
  dress_color: { set: { "color.scheme": "mono", "color.stops": ["#0a1622"] } },
  dress_pattern: "none", dress_signature: "side-slit",
  _default: (n) => (n.modality === "slider" ? 0.5 : (n.choices && n.choices[0] ? n.choices[0].id : "regular")),
};
const D = runOn(dressNodes, couture);
console.log("  order:", D.order.join(" → "));
assert(DNA.get(D.dna, "construction.sleeveLength") === "sleeveless" && DNA.get(D.dna, "construction.waist") === "fitted",
  "dress DNA carries sleeve length + waist");
const dParams = Preview.params(D.dna);
assert(dParams.sleeveLength === "sleeveless" && dParams.waist === "fitted" && Array.isArray(dParams.signature) && dParams.signature.includes("side-slit"),
  "preview params carry the new dress attributes to the renderer");
const dSvg = global.GarmentSVG.build("dress", dParams);
assert(dSvg.includes("<svg") && !dSvg.includes("NaN"), "couture dress renders a clean flat");
assert(dSvg !== global.GarmentSVG.build("dress", Object.assign({}, dParams, { sleeveLength: "short", signature: [] })),
  "sleeveless + slit visibly change the dress flat");

// ─── Genesis & materialisation (immersive Entstehung) ────────────────────────
console.log("\n— Genesis & materialisation —");
const GS = global.GarmentSVG;
const nebCalm = GS.nebula({ energy: 0.1, structure: 0.5, seed: 1 });
const nebBold = GS.nebula({ energy: 0.9, structure: 0.5, seed: 1 });
const nebLate = GS.nebula({ energy: 0.1, structure: 0.5, seed: 6 });
assert(nebCalm.includes("<svg") && nebCalm.includes("de-nebula") && !nebCalm.includes("NaN"), "nebula renders clean");
assert(nebCalm !== nebBold, "mood energy reshapes the nebula");
assert((nebLate.match(/<path/g) || []).length > (nebCalm.match(/<path/g) || []).length,
  "every answer adds threads (the cloth is being spun)");
const revSketch = GS.build("hoodie", { reveal: 0.3, stops: ["#2a9d8f"], pattern: "stripe" });
const revFull = GS.build("hoodie", { reveal: 1, stops: ["#2a9d8f"], pattern: "stripe" });
assert(revSketch !== revFull, "reveal stages the materialisation (sketch → dressed)");
assert(GS.build("hoodie", {}).includes('pathLength="1"'), "flat paths are draw-animatable (weave-in)");

// ─── topArchetype ignores non-finite weights (corrupt/crafted #dna=) ──────────
console.log("\n— topArchetype skips null/NaN/Infinity weights —");
// `null > -Infinity` is true, so a null/NaN weight (e.g. from JSON.stringify of
// Infinity, or a crafted share link) must NOT win over a real weight.
assert(DNA.topArchetype({ archetypeWeights: { quietMinimal: 3, techAvant: null } }) === "quietMinimal",
  "a null weight does not beat a real positive weight");
assert(DNA.topArchetype({ archetypeWeights: { quietMinimal: -5, techAvant: null } }) === "quietMinimal",
  "a real negative weight beats a null weight (null no longer wins)");
assert(DNA.topArchetype({ archetypeWeights: { a: 1, b: 2 } }) === "b", "highest finite weight still wins");
assert(DNA.topArchetype({ archetypeWeights: {} }) === null, "empty weights → null");

// ─── DNA.set/setConfidence reject __proto__/constructor/prototype segments ──
console.log("\n— DNA.set guards against prototype pollution —");
// A path like "__proto__.polluted" walks `cur["__proto__"]` onto the real
// Object.prototype (it's a non-null object, so walk() wouldn't otherwise
// rebuild it) and the final assignment would then write a property onto
// EVERY object in the process. Guards against a future data-driven or
// inference-derived path ever reaching set()/setConfidence() with such a
// segment (no known live call site does today).
{
  const before = ({}).polluted;
  const dna = DNA.create();
  DNA.set(dna, "__proto__.polluted", "evil", 1);
  assert(({}).polluted === before, "path starting with __proto__ does not pollute Object.prototype");

  DNA.set(dna, "category.__proto__.polluted2", "evil", 1);
  assert(({}).polluted2 === undefined, "__proto__ mid-path does not pollute Object.prototype");

  DNA.set(dna, "constructor.prototype.polluted3", "evil", 1);
  assert(({}).polluted3 === undefined, "constructor.prototype path does not pollute Object.prototype");

  DNA.setConfidence(dna, "__proto__.polluted4", 1);
  assert(({}).polluted4 === undefined, "setConfidence rejects __proto__ the same way");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
