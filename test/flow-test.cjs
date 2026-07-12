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
const fs = require("fs");
const ROOT = path.join(__dirname, "..", "js", "design-engine");
global.DesignDNA = require(path.join(ROOT, "dna.js"));
global.DesignCondition = require(path.join(ROOT, "condition.js"));
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

console.log("\n— resolveEffects · colorGradient (maps scheme + stops; C3: no dead HSL fields) —");
{
  const r = Flow.resolveEffects({ modality: "colorGradient" }, { scheme: "duo-gradient", stops: ["#fff", "#000"] });
  assert(r.conf === 1, "colour choice is fully confident");
  assert(r.eff.set["color.scheme"] === "duo-gradient" && eq(r.eff.set["color.stops"], ["#fff", "#000"]), "scheme + stops mapped");
  assert(!("color.value" in r.eff.set) && !("color.saturation" in r.eff.set),
    "the render-dead color.value/color.saturation HSL fields are no longer written (roadmap C3)");
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

console.log("\n— resolveEffects · regions (detail atelier merges the touched regions) —");
{
  const node = { modality: "regions", regions: [
    { id: "closure", choices: [
      { id: "zip", effects: { set: { "construction.closure": "zip" }, weight: { techAvant: 0.1 } } },
      { id: "button", effects: { set: { "construction.closure": "button" } } },
    ] },
    { id: "hem", choices: [
      { id: "ribbed", effects: { set: { "construction.hem": "ribbed", "construction.cuffs": "ribbed" }, weight: { techAvant: 0.2, sport: 0.1 } } },
    ] },
  ] };
  const r = Flow.resolveEffects(node, { closure: "zip", hem: "ribbed" });
  assert(r.conf === 1, "board picks land fully confident");
  assert(r.eff.set["construction.closure"] === "zip" && r.eff.set["construction.hem"] === "ribbed"
    && r.eff.set["construction.cuffs"] === "ribbed", "every touched region's set() merges (multi-path choices too)");
  assert(Math.abs(r.eff.weight.techAvant - 0.3) < 1e-9 && r.eff.weight.sport === 0.1, "archetype weights ADD across regions");

  const partial = Flow.resolveEffects(node, { hem: "ribbed" });
  assert(partial.eff.set["construction.closure"] === undefined, "untouched regions set NOTHING (inference fills them)");

  const empty = Flow.resolveEffects(node, {});
  assert(Object.keys(empty.eff.set).length === 0 && Object.keys(empty.eff.weight).length === 0,
    "'accept as is' commits empty effects (node answered, attrs stay open)");

  const junk = Flow.resolveEffects(node, "regular");
  assert(Object.keys(junk.eff.set).length === 0, "a non-object payload is treated as 'accept as is', never iterated as chars");
  const unknown = Flow.resolveEffects(node, { closure: "nope", ghost: "zip" });
  assert(Object.keys(unknown.eff.set).length === 0, "unknown region/choice ids are ignored");
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

console.log("\n— mutateDna respects a DECIDED 'no pattern' (roadmap §8.2) —");
{
  const mk = (conf) => {
    const d = global.DesignDNA.create();
    global.DesignDNA.set(d, "category", "jacket", 1);
    global.DesignDNA.set(d, "color.stops", ["#8a2f2f", "#5a1f2f"], 1);
    global.DesignDNA.set(d, "pattern.type", "none", conf);
    return d;
  };
  // Explicit "Keins" (conf 1): NO variant of NO version may re-introduce a
  // pattern — the lottery previously overrode the user's cleaned-away choice.
  let reintroduced = false;
  for (let idx = 0; idx < 4; idx++) {
    for (let v = 1; v <= 4; v++) {
      if (global.DesignDNA.get(Flow.mutateDna(mk(1), idx, v), "pattern.type") !== "none") reintroduced = true;
    }
  }
  assert(!reintroduced, "explicit pattern.type 'none' (conf 1) survives every concept × version");
  // Merely inferred none (conf 0.4) keeps the playful lottery: SOME variant dares a pattern.
  let dared = false;
  for (let idx = 0; idx < 4; idx++) {
    for (let v = 1; v <= 4; v++) {
      if (global.DesignDNA.get(Flow.mutateDna(mk(0.4), idx, v), "pattern.type") !== "none") dared = true;
    }
  }
  assert(dared, "an INFERRED none still lets some variant dare a pattern (lottery intact)");
  // The clean variant still visibly moves: its colour swings instead.
  const base = mk(1);
  const variant = Flow.mutateDna(base, 1, 1);
  assert(JSON.stringify(global.DesignDNA.get(variant, "color.stops")) !== JSON.stringify(global.DesignDNA.get(base, "color.stops")),
    "the pattern-respecting variant shifts colour instead of going inert");
}

console.log("\n— conceptDeltas (each direction is named by what it changes, §8.2) —");
{
  const D = global.DesignDNA;
  const mk = (mods) => {
    const d = D.create();
    D.set(d, "silhouette.fit", 0.5, 1);
    D.set(d, "fabric.finishWeight", 0.4, 1);
    D.set(d, "color.stops", ["#2779a8"], 1); // ocean blue (cool)
    D.set(d, "pattern.type", "none", 1);
    D.set(d, "length", "regular", 1);
    Object.entries(mods || {}).forEach(([p, v]) => D.set(d, p, v, 1));
    return d;
  };
  const base = mk();
  assert(eq(Flow.conceptDeltas(base, mk({ "color.stops": ["#a85527"] })), ["concept.warmer"]),
    "blue → rust names the direction 'warmer'");
  assert(Flow.conceptDeltas(base, mk({ "silhouette.fit": 0.8 })).includes("concept.wider"), "fit +0.3 → 'roomier'");
  assert(Flow.conceptDeltas(base, mk({ "silhouette.fit": 0.2 })).includes("concept.slimmer"), "fit -0.3 → 'slimmer'");
  assert(Flow.conceptDeltas(base, mk({ "fabric.finishWeight": 0.8 })).includes("concept.sheen"), "finish up → 'more sheen'");
  assert(Flow.conceptDeltas(base, mk({ "pattern.type": "graphic" })).includes("concept.pattern"), "none → graphic names the dared pattern");
  assert(Flow.conceptDeltas(mk({ "pattern.type": "camo" }), mk({ "pattern.type": "none" })).includes("concept.cleaner"), "pattern → none reads 'calmer'");
  assert(Flow.conceptDeltas(base, mk({ length: "cropped" })).includes("concept.len_cropped"), "length change carries its value key");
  assert(eq(Flow.conceptDeltas(base, mk()), ["concept.subtle"]), "no perceptible delta → 'subtle shift', never an empty name");
  const many = Flow.conceptDeltas(base, mk({ "silhouette.fit": 0.9, "fabric.finishWeight": 0.9, "pattern.type": "camo", length: "long" }));
  assert(many.length === 2, "at most TWO deltas make the name (biggest first), not a laundry list");
  assert(Flow.hexHue("#808080") === null && Flow.hexHue("garbage") === null, "grey / invalid hex carries no hue (no NaN warmth)");
}

console.log("\n— bodyFactors (made-for-one silhouette from the user's measurements, §9) —");
{
  const REF = { chest: 96, waist: 82, hips: 98, shoulder: 44 };
  const M = { height: 175, weight: 70, chest: 96, waist: 82, hips: 98, shoulder: 44, arm: 62, inseam: 82, neck: 38 };
  const f = Flow.bodyFactors(M, REF);
  assert(f && Math.abs(f.shoulder - 1) < 1e-9 && Math.abs(f.waist - 1) < 1e-9 && Math.abs(f.hip - 1) < 1e-9,
    "the M reference body maps to identity (no visible change)");
  const broad = Flow.bodyFactors({ shoulder: 50, chest: 96, waist: 82, hips: 98 }, REF);
  assert(Math.abs(broad.shoulder - 1.08) < 1e-9, "broad shoulders cap at +8% (50/44 → clamp 1.08)");
  const nipped = Flow.bodyFactors({ chest: 100, waist: 74, hips: 98 }, REF);
  assert(nipped.waist < 1 && nipped.waist >= 0.92, `waist factor uses the CHEST-RELATIVE ratio (got ${nipped.waist.toFixed(3)})`);
  assert(Flow.bodyFactors(null, REF) === null && Flow.bodyFactors({}, REF) === null
    && Flow.bodyFactors({ shoulder: NaN, chest: -3, waist: "x" }, REF) === null,
    "no usable measurements → null (the flat stays generic)");
}

console.log("\n— phaseStepper (honest orientation: where you are, never a % gauge) —");
{
  const L = (k) => k; // identity label so we can assert on the i18n keys
  // Match by LITERAL string (no RegExp built from the key) so the test never
  // depends on regex-escaping its input — correct for any key, and CodeQL-clean.
  const stateOf = (svg, key) => {
    for (const st of ["done", "cur", "todo"]) {
      if (svg.includes(`de-step is-${st}"><span class="de-step-dot"></span>${key}</span>`)) return st;
    }
    return null;
  };
  const BEATS = ["engine.phase_feeling", "engine.phase_form", "engine.phase_fabric", "engine.phase_color", "engine.phase_details"];
  const sA = Flow.phaseStepper("A", L), sC = Flow.phaseStepper("C", L), sF = Flow.phaseStepper("F", L);
  BEATS.forEach((k) => assert(sC.includes(k), `stepper always lists every named beat (${k})`));
  // The whole point: no percentage / number anywhere on it.
  assert(!/\d/.test(sC), "stepper carries NO number (no false 'finished' cue)");
  assert(stateOf(sA, "engine.phase_feeling") === "cur", "phase A → Gefühl is the current beat");
  assert(stateOf(sA, "engine.phase_form") === "todo", "phase A → later beats are upcoming");
  assert(stateOf(sC, "engine.phase_fabric") === "cur", "phase C → Stoff is current");
  assert(stateOf(sC, "engine.phase_feeling") === "done" && stateOf(sC, "engine.phase_form") === "done", "phase C → earlier beats are done");
  assert(stateOf(sC, "engine.phase_details") === "todo", "phase C → Details still upcoming");
  // Phase F (refine): the arc is traversed — every beat done, none 'current'.
  assert(!sF.includes("is-cur"), "phase F (refine) → no beat is 'current' (arc traversed)");
  assert(BEATS.every((k) => stateOf(sF, k) === "done"), "phase F → every beat reads done");
  // Robustness: junk / missing phase clamps to the first beat, never throws.
  assert(stateOf(Flow.phaseStepper("zzz", L), "engine.phase_feeling") === "cur", "unknown phase clamps to the first beat");
  assert(stateOf(Flow.phaseStepper(undefined, L), "engine.phase_feeling") === "cur", "missing phase clamps to the first beat");
  // Lowercase phase letters are accepted (defensive).
  assert(stateOf(Flow.phaseStepper("c", L), "engine.phase_fabric") === "cur", "phase letter is case-insensitive");
}

console.log("\n— isGuardedTap (double-tap must not answer the NEXT question / fire generate) —");
{
  const G = Flow.COMMIT_GUARD_MS;
  assert(typeof G === "number" && G > 0 && G <= 600, "guard window is a sane, sub-read-time constant");
  assert(Flow.isGuardedTap(1000, 1000) === true, "a tap in the same instant as the render is guarded");
  assert(Flow.isGuardedTap(1000 + G - 1, 1000) === true, "a tap just inside the window is guarded");
  assert(Flow.isGuardedTap(1000 + G, 1000) === false, "a tap at the window edge passes (deliberate)");
  assert(Flow.isGuardedTap(1000 + G * 4, 1000) === false, "a considered tap long after render passes");
}

console.log("\n— choiceWord (chips echo the tapped card label, across every category) —");
{
  const nodes = [
    { id: "dress_subarch", choices: [
      { id: "aline", label: { de: "A-Linie", en: "A-line" }, effects: { set: { subArchetype: "aline" } } },
      { id: "wrap", label: { de: "Wickel", en: "Wrap" }, effects: { set: { subArchetype: "wrap" } } },
    ] },
    { id: "dress_length", choices: [
      { id: "mini", label: { de: "Mini", en: "Mini" }, effects: { set: { length: "cropped" } } },
    ] },
    { id: "jacket_subarch", choices: [
      { id: "work", label: { de: "Workwear", en: "Work" }, effects: { set: { subArchetype: "work" } } },
    ] },
    { id: "dress_mood", pair: [{ id: "x" }] }, // no choices → skipped, no throw
    // Side-effect trap: the subarch card "Slip" ALSO sets the material —
    // the dedicated material card's word must win for the STOFF chip.
    { id: "dress_subarch2", choices: [
      { id: "slip", label: { de: "Slip", en: "Slip" }, effects: { set: { subArchetype: "slip", "fabric.material": "silk" } } },
    ] },
    { id: "dress_material", choices: [
      { id: "silk", label: { de: "Seide", en: "Silk" }, effects: { set: { "fabric.material": "silk" } } },
      { id: "cotton", label: { de: "Baumwolle", en: "Cotton" }, effects: { set: { "fabric.material": "cotton" } } },
    ] },
  ];
  assert(Flow.choiceWord(nodes, "dress", "de", "subArchetype", "aline") === "A-Linie", "raw id 'aline' resolves to the tapped word 'A-Linie'");
  assert(Flow.choiceWord(nodes, "dress", "en", "subArchetype", "aline") === "A-line", "…and to the EN label under lang 'en'");
  assert(Flow.choiceWord(nodes, "dress", "de", "length", "cropped") === "Mini", "generic 'cropped' shows as the tapped 'Mini' for a dress");
  assert(Flow.choiceWord(nodes, "jacket", "de", "subArchetype", "work") === "Workwear", "lookup is scoped to the CURRENT category's nodes");
  assert(Flow.choiceWord(nodes, "dress", "de", "subArchetype", "work") === null, "a value from another category's cards → null (fallback path)");
  assert(Flow.choiceWord(nodes, null, "de", "subArchetype", "aline") === null, "no category yet → null, never a throw");
  assert(Flow.choiceWord(nodes, "dress", "de", "pattern.type", "graphic") === null, "unknown value → null (i18n fallback takes over)");
  assert(Flow.choiceWord(nodes, "dress", "de", "fabric.material", "silk") === "Seide", "dedicated material card ('Seide') beats the side-effect subarch card ('Slip')");
  assert(Flow.choiceWord(nodes, "dress", "de", "subArchetype", "slip") === "Slip", "…while the subarch chip still gets the subarch word");
}

console.log("\n— dockShouldShow (mobile dock: only when the loop is otherwise broken) —");
{
  assert(Flow.dockShouldShow(true, false, true) === true, "small screen + preview gone + journey on screen → dock");
  assert(Flow.dockShouldShow(true, true, true) === false, "preview still visible → no dock");
  assert(Flow.dockShouldShow(false, false, true) === false, "desktop/tablet → never a dock (preview is sticky there)");
  assert(Flow.dockShouldShow(true, false, false) === false, "scrolled past the whole journey → no dock");
  assert(Flow.dockShouldShow(undefined, false, true) === false, "no matchMedia (old browser) → fails closed, no dock");
}

console.log("\n— toSentence German adjective agreement (feminine materials) —");
{
  const Summary = require(path.join(ROOT, "summary.js"));
  const mk = (mat) => {
    const d = global.DesignDNA.create();
    global.DesignDNA.set(d, "category", "jacket", 1);
    global.DesignDNA.set(d, "fabric.material", mat, 1);
    return d;
  };
  assert(Summary.toSentence(mk("wool"), "de").includes("aus matter Wolle"), "feminine: 'aus matter Wolle' (not 'mattem Wolle')");
  assert(Summary.toSentence(mk("silk"), "de").includes("aus matter Seide"), "feminine: 'aus matter Seide'");
  assert(Summary.toSentence(mk("denim"), "de").includes("aus mattem Denim"), "masculine/neuter keeps 'aus mattem Denim'");
  assert(Summary.toSentence(mk("cotton"), "de").includes("aus matter Baumwolle"), "cotton reads as plain 'Baumwolle' (true for every cotton card)");
  assert(Summary.toSentence(mk("wool"), "en").includes("in matte wool"), "EN unaffected by German gender handling");
}

console.log("\n— seedDefaults: a skipped mood must not kill pattern/signature (roadmap C1) —");
{
  const D = global.DesignDNA;
  const readNodes = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "content/nodes", f), "utf8")).nodes;
  const nodes = [...readNodes("intent.json"), ...readNodes("tshirt.json")];

  // The seed itself: neutral value, non-decisive confidence.
  const seeded = Flow.seedDefaults(D.create());
  assert(D.get(seeded, "intent.energy") === 0.5, "seedDefaults sets intent.energy to the neutral 0.5");
  assert(D.confidence(seeded, "intent.energy") === 0.05, "…at a low confidence (a real mood pick at conf 1 overrides it)");
  assert(D.confidence(seeded, "intent.energy") < 0.5, "…below the 'decided' threshold → no chip, no maturity/inference effect");

  // Reachability probe: pre-set the category (already chosen), SKIP the mood
  // question (answered, no effects applied), then walk the engine to see which
  // gated nodes ever surface. We only test reachability, so we mark each
  // surfaced node answered without applying its effects.
  function reachable(dna) {
    const answered = new Set(["category_select", "mood_calm_bold"]);
    D.set(dna, "category", "tshirt", 1);
    const seen = [];
    for (let i = 0; i < 60; i++) {
      const n = global.DesignEngine.nextNode(nodes, dna, answered);
      if (!n) break;
      seen.push(n.id);
      answered.add(n.id);
    }
    return seen;
  }
  const hasPattern = (ids) => ids.some((id) => /pattern/.test(id));
  const hasSig = (ids) => ids.some((id) => /signature/.test(id));

  // Without the seed (the bug): intent.energy is undefined → `NaN > 0.45` is
  // false → the pattern node is unreachable forever.
  const bug = reachable(D.create());
  assert(!hasPattern(bug), "REGRESSION GUARD: unseeded skip leaves intent.energy undefined → pattern node unreachable");

  // With the seed: pattern surfaces (0.5 > 0.45); signature stays off (0.5 ≯ 0.5).
  const withSeed = reachable(Flow.seedDefaults(D.create()));
  assert(hasPattern(withSeed), "seeded skip → the pattern node surfaces again (0.5 > 0.45)");
  assert(!hasSig(withSeed), "…but signature stays off on a neutral skip (0.5 is not > 0.5)");

  // A real 'calm' pick (0.25) still suppresses the pattern node as designed.
  const calm = D.create(); D.set(calm, "intent.energy", 0.25, 1);
  assert(!hasPattern(reachable(calm)), "an explicit 'calm' (0.25) still hides the pattern node (0.25 ≯ 0.45)");

  // A real 'bold' pick (0.8) opens pattern AND signature.
  const bold = D.create(); D.set(bold, "intent.energy", 0.8, 1);
  const b = reachable(bold);
  assert(hasPattern(b) && hasSig(b), "an explicit 'bold' (0.8) opens both pattern and signature");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
