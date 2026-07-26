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
      if (svg.includes(`de-step is-${st}">${key}</span>`)) return st;
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
  // Die Fortschritts-Schiene (Kapitel-Index, Owner-Brief 2026-07-26): der
  // Füllstand hängt am PHASEN-BUCHSTABEN, nie an einer Prozentzahl — genau
  // deshalb bleibt der Ziffern-Test oben gültig.
  const railAt = (s) => (s.match(/de-step-fill is-at-([a-e])/) || [])[1] || null;
  assert(sA.includes("de-step-rail") && sC.includes("de-step-rail"), "the index carries ONE rail, not four segment bars");
  assert(railAt(sA) === "a", "phase A → the rail lights the first chapter");
  assert(railAt(sC) === "c", "phase C → the rail lights up to the third chapter");
  assert(railAt(sF) === "e", "phase F (refine) → the rail is full (clamped to the last chapter)");
  assert(railAt(Flow.phaseStepper("zzz", L)) === "a", "junk phase → the rail clamps to the first chapter, never empty/NaN");
  // Kein Punkt- und kein Segment-Ornament mehr (das war das „gimmicky").
  assert(!sC.includes("de-step-dot") && !sC.includes("de-step-bar"), "no dots, no gradient segment bars");
}

console.log("\n— subArchFor (B4: welche Silhouette gehört zu welcher Richtung) —");
{
  // Die Zuordnung darf KEINE zweite Tabelle sein: sie liest die Gewichte, die
  // die Silhouetten-Fragen ohnehin deklarieren. Sonst veraltet sie neben ihnen.
  const nodes = [
    {
      id: "jacket_subarch", when: "category == 'jacket' && x", choices: [
        { id: "puffer", effects: { set: { subArchetype: "puffer" }, weight: { techAvant: 0.2, sport: 0.15 } } },
        { id: "trench", effects: { set: { subArchetype: "trench" }, weight: { quietMinimal: 0.3 } } },
      ],
    },
    // Fremde Kategorie darf NIE gewinnen (sonst trüge die Hose einen Trench).
    { id: "dress_subarch", when: "category == 'dress'", choices: [
      { id: "slip", effects: { set: { subArchetype: "slip" }, weight: { techAvant: 0.9 } } },
    ] },
    // Ein Knoten ohne subArchetype-Effekt ist kein Silhouetten-Knoten.
    { id: "jacket_color", when: "category == 'jacket'", choices: [
      { id: "red", effects: { set: { "color.scheme": "mono" }, weight: { techAvant: 5 } } },
    ] },
  ];
  const f = (arch) => Flow.subArchFor(nodes, "jacket", arch);
  assert(f("techAvant").value === "puffer", "techAvant zieht am stärksten zum Puffer");
  assert(f("quietMinimal").value === "trench", "quietMinimal zum Trench");
  assert(f("sport").value === "puffer", "sport ebenfalls zum Puffer (0.15 ist das einzige Gewicht)");
  assert(f("utility") === null, "eine Richtung ohne deklarierte Affinität bekommt KEINE erfundene Silhouette");
  assert(f(null) === null, "ohne Richtung keine Zuordnung");
  assert(Flow.subArchFor([], "jacket", "techAvant") === null, "ohne Knoten keine Zuordnung");
  assert(Flow.subArchFor(null, "jacket", "techAvant") === null, "auch null-Knoten werfen nicht");
  // Der Farb-Knoten hat das mit Abstand höchste techAvant-Gewicht (5) — er
  // setzt aber keine Silhouette und darf deshalb nicht gewinnen.
  assert(f("techAvant").value === "puffer", "ein Knoten ohne subArchetype-Effekt gewinnt nie, egal wie schwer");
  // Die Effekte kommen mit, damit der Startpunkt genau das übernimmt, was er zeigt.
  assert(f("quietMinimal").effects.set.subArchetype === "trench", "die Effekte der Wahl reisen mit");
}

console.log("\n— buildStartingPoints (B4: Startpunkt, nicht Reset) —");
{
  const archetypes = [
    { id: "quietMinimal", label: { de: "Quiet Minimal", en: "Quiet Minimal" },
      defaults: { "fabric.material": "wool", "silhouette.fit": 0.45, length: "regular" } },
    { id: "y2kStreet", label: { de: "Y2K Street", en: "Y2K Street" },
      defaults: { "fabric.material": "denim", "silhouette.fit": 0.9, length: "cropped" } },
  ];
  const nodes = [{ id: "jacket_subarch", when: "category == 'jacket'", choices: [
    { id: "trench", effects: { set: { subArchetype: "trench" }, weight: { quietMinimal: 0.3 } } },
    { id: "puffer", effects: { set: { subArchetype: "puffer" }, weight: { y2kStreet: 0.4 } } },
  ] }];
  const required = ["fabric.material", "silhouette.fit", "length"];
  const base = global.DesignDNA.create();
  global.DesignDNA.set(base, "category", "jacket", 1);
  global.DesignDNA.set(base, "fabric.material", "silk", 1); // eine ECHTE eigene Entscheidung
  const pts = Flow.buildStartingPoints(base, { archetypes, nodes, required, threshold: 0.5, lang: "de" });

  assert(pts.length === 2, "je Richtung ein Startpunkt");
  assert(pts[0].label === "Quiet Minimal" && pts[1].label === "Y2K Street", "die Richtungen tragen ihre Namen");
  // (1) Eigene Entscheidungen bleiben in JEDER Richtung stehen …
  assert(pts.every((p) => global.DesignDNA.get(p.dna, "fabric.material") === "silk"),
    "die selbst gewählte Seide überlebt jede Richtung");
  // … und tauchen im Beitrag NICHT auf, können also nichts überschreiben.
  assert(pts.every((p) => !("fabric.material" in p.payload.set)),
    "der Startpunkt trägt nichts bei, was schon entschieden ist (Startpunkt, kein Reset)");
  assert(pts.every((p) => !("category" in p.payload.set)), "…auch die Kategorie nicht");
  // (2) Offene Attribute kommen je Richtung unterschiedlich.
  assert(pts[0].payload.set["silhouette.fit"] === 0.45 && pts[1].payload.set["silhouette.fit"] === 0.9,
    "offene Attribute unterscheiden sich je Richtung");
  // Die Silhouette macht die Richtungen überhaupt unterscheidbar.
  assert(pts[0].payload.set.subArchetype === "trench" && pts[1].payload.set.subArchetype === "puffer",
    "jede Richtung bringt ihre eigene Silhouette mit");
  assert(pts[0].payload.weight.quietMinimal === 0.5, "die Übernahme zieht den Stilvektor in ihre Richtung");
  // Robustheit
  assert(eq(Flow.buildStartingPoints(base, { archetypes: [], nodes, required }), []), "ohne Archetypen keine Startpunkte");
  assert(Flow.buildStartingPoints(base, { archetypes, nodes, required, limit: 1 }).length === 1, "limit begrenzt die Zahl");
  // Der scrub-Haken ist die Inferenz-Falle aus Runde 3: er MUSS laufen.
  let scrubbed = 0;
  Flow.buildStartingPoints(base, { archetypes, nodes, required, scrub: () => { scrubbed++; } });
  assert(scrubbed === 2, "jeder Startpunkt läuft durch scrubImpossibleFills (sonst zeigt die Galerie Unmögliches)");
}

console.log("\n— materialGesture (B3: der Stoff-Moment muss es auf dem TELEFON auch geben) —");
{
  const P = "/img/material/wool.jpg";
  const g = (ev, o) => Flow.materialGesture(ev, o);
  // Zeiger-Gerät: zeigen bringt die Bahn, weggehen nimmt sie mit.
  assert(eq(g("point", { photo: P, hasHover: true }), { show: true, hold: 0 }), "Zeiger: zeigen blendet die Bahn ein (ohne Halt)");
  assert(eq(g("leave", { photo: P, hasHover: true }), { show: false, hold: 0 }), "Zeiger: weggehen blendet sie aus");
  // Touch: es gibt keinen Hover — der Hover-Weg darf dort NICHTS tun, sonst
  // hinge der Moment an einem Ereignis, das das Gerät nie sendet.
  assert(g("point", { photo: P, hasHover: false }) === null, "Touch: 'zeigen' ist kein Weg (kein Zeiger vorhanden)");
  assert(g("leave", { photo: P, hasHover: false }) === null, "Touch: 'weggehen' ebenso wenig");
  // …stattdessen hängt er am Wählen — mit Halt, damit man ihn überhaupt sieht.
  const commit = g("commit", { photo: P, hasHover: false });
  assert(commit && commit.show === true && commit.hold === Flow.MAT_HOLD_MS, "Touch: das Wählen bringt die Bahn, und sie HÄLT");
  assert(Flow.MAT_HOLD_MS >= 800, `der Halt ist lang genug, um gesehen zu werden (${Flow.MAT_HOLD_MS}ms)`);
  // Der Halt gehört sich selbst: der focusout der getippten Karte darf ihn
  // nicht im selben Atemzug löschen (real gemessener Fehler).
  assert(g("blur", { photo: P, hasHover: false, holding: true }) === null, "ein laufender Halt wird von blur NICHT abgeräumt");
  assert(g("leave", { photo: P, hasHover: true, holding: true }) === null, "…und auch nicht vom Zeiger, der weiterwandert");
  assert(eq(g("blur", { photo: P, hasHover: false, holding: false }), { show: false, hold: 0 }), "ohne Halt räumt blur normal ab");
  // Tastatur erreicht denselben Moment.
  assert(eq(g("focus", { photo: P, hasHover: false }), { show: true, hold: 0 }), "Tastatur: der Fokus zeigt die Bahn auch ohne Zeiger");
  // Karten ohne Makro-Aufnahme (alles ausser Stoff) lösen nie etwas aus.
  ["point", "focus", "commit", "blur", "leave"].forEach((ev) =>
    assert(g(ev, { photo: null, hasHover: true }) === null, `ohne Foto passiert bei "${ev}" nichts`));
  assert(g("weird", { photo: P, hasHover: true }) === null, "unbekannte Geste löst nichts aus");

  // Der Stil-Patch: hier sitzt das Escaping für die CSS-url().
  const S = Flow.materialStyle;
  assert(S(null, P) === null, "ohne Geste kein Stil-Patch");
  assert(eq(S({ show: false, hold: 0 }, P), { "--mat-on": "0" }), "ausblenden setzt nur die Deckkraft zurück");
  const shown = S({ show: true, hold: 0 }, P);
  assert(shown["--mat-img"] === 'url("' + P + '")', "einblenden setzt Bild und Deckkraft");
  assert(parseFloat(shown["--mat-on"]) > 0.1 && parseFloat(shown["--mat-on"]) < 0.45,
    `die Bahn bleibt dem Stück untergeordnet (${shown["--mat-on"]})`);
  assert(S({ show: true, hold: 0 }, null) === null, "einblenden ohne Bild ergibt keinen Patch");
  // Aus einer CSS-url() bricht man mit " ' ( ) aus — der Rumpf darf keins
  // davon roh enthalten, sonst endet die Deklaration mitten im Pfad und der
  // Rest wird als eigene Regel gelesen.
  const payload = (v) => v.slice('url("'.length, -'")'.length);
  const nasty = S({ show: true, hold: 0 }, '/a".jpg");background:red;x(\'');
  assert(!/["'()]/.test(payload(nasty["--mat-img"])), "Anführungszeichen und Klammern im Pfad werden entschärft");
  assert(nasty["--mat-img"].startsWith('url("') && nasty["--mat-img"].endsWith('")'),
    "…die url() bleibt genau eine, sauber geschlossene Deklaration");
  assert(!/["'()]/.test(payload(S({ show: true, hold: 0 }, "/a)b('c\".jpg")["--mat-img"])),
    "auch Klammern und einfache Anführungszeichen — encodeURIComponent liesse genau die durch");
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

console.log("\n— conceptLabelSets · direction names are pairwise unique (U6) —");
{
  const D = global.DesignDNA;
  const mk = (stops, pattern, fit) => {
    const d = D.create();
    D.set(d, "color.stops", stops, 1);
    D.set(d, "pattern.type", pattern, 1);
    D.set(d, "silhouette.fit", fit, 1);
    return d;
  };
  const base = mk(["#a03030"], "none", 0.5);
  // Two variants whose TOP-2 deltas collide (both: pattern + cooler) but whose
  // weaker fit axis differs — exactly the shipped 'Muster gewagt · Kühler ×2'.
  const v1 = mk(["#3050a0"], "check", 0.52);
  const v2 = mk(["#3060a0"], "camo", 0.7);
  const sets = Flow.conceptLabelSets(base, [v1, v2]);
  assert(sets[0].join("|") !== sets[1].join("|"),
    "two variants with identical top-2 deltas get distinct names (third axis pulled in)");
  assert(sets[0].length <= 3 && sets[1].length <= 3, "names stay at most three axes long");
  // A twin extends by its OWN next-weakest axis — still a true delta of the
  // twin, so the longer name stays honest while becoming distinct.
  const twin = JSON.parse(JSON.stringify(v1));
  const twinSets = Flow.conceptLabelSets(base, [v1, twin]);
  assert(twinSets[0].join("|") !== twinSets[1].join("|") && twinSets[1].length === 3,
    "a twin gets a distinct name via its next (true) axis");
  // Zero-delta variants have no axis to extend by → honestly share 'subtle'.
  const zero = Flow.conceptLabelSets(base, [base, JSON.parse(JSON.stringify(base))]);
  assert(zero[0].join("|") === zero[1].join("|") && zero[0][0] === "concept.subtle",
    "zero-delta variants share the honest 'subtle' name (nothing to extend by)");
  // conceptDeltas keeps its old contract for single variants.
  assert(Flow.conceptDeltas(base, v1).length >= 1 && Flow.conceptDeltas(base, base)[0] === "concept.subtle",
    "conceptDeltas API unchanged (top strong axes; 'subtle' for no delta)");
}

console.log("\n— syncDerivedFinish · the finish slider drives the categorical finish (U1a) —");
{
  const D = global.DesignDNA;
  // Confident slider (0.8) + contradicting archetype string → derived sheen.
  const d = D.create();
  D.set(d, "fabric.finishWeight", 0.78, 0.8);
  D.set(d, "fabric.finish", "matte", 0.4); // archetype soft-fill
  Flow.syncDerivedFinish(d);
  assert(D.get(d, "fabric.finish") === "sheen", "finishWeight 0.78 (conf 0.8) derives fabric.finish 'sheen' over the soft-filled 'matte'");
  assert(D.confidence(d, "fabric.finish") === 0.8, "derived finish carries the slider's confidence (counts as decided — no inferred chip)");

  // Matte side of the slider.
  const m = D.create();
  D.set(m, "fabric.finishWeight", 0.2, 0.8);
  Flow.syncDerivedFinish(m);
  assert(D.get(m, "fabric.finish") === "matte", "finishWeight 0.2 derives 'matte'");

  // Unanswered slider (low conf) → hands off, archetype value untouched.
  const u = D.create();
  D.set(u, "fabric.finishWeight", 0.9, 0.3);
  D.set(u, "fabric.finish", "matte", 0.4);
  Flow.syncDerivedFinish(u);
  assert(D.get(u, "fabric.finish") === "matte", "a low-confidence finishWeight (0.3) does not override — only real answers derive");
}

console.log("\n— protectExplicit · secondary card effects can no longer clobber explicit answers (U1b) —");
{
  const D = global.DesignDNA;
  const d = D.create();
  D.set(d, "silhouette.fit", 0.9, 0.8); // explicit slider answer (Oversized)
  const node = { id: "pants_subarch", modality: "cards" }; // no bind — fit is a side-effect
  const eff = { set: { subArchetype: "tailored", "silhouette.fit": 0.45 }, weight: { softCouture: 0.15 } };
  const safe = Flow.protectExplicit(d, node, eff);
  assert(!("silhouette.fit" in safe.set), "Tailored's silhouette.fit side-effect is evicted — the user's 0.9 stays");
  assert(safe.set.subArchetype === "tailored", "the card's own subject (subArchetype) still commits");
  assert(eff.set["silhouette.fit"] === 0.45, "the original effects object is NOT mutated (may be a content-JSON reference)");

  // The node's own bind is exempt — re-answering the asked question is allowed.
  const bindNode = { id: "pants_fit", modality: "slider", bind: "silhouette.fit" };
  const bindEff = { set: { "silhouette.fit": 0.2 } };
  assert("silhouette.fit" in Flow.protectExplicit(d, bindNode, bindEff).set,
    "the node's own bind path is exempt from protection (that IS the question)");

  // Low-confidence (inferred) values stay overridable.
  const soft = D.create();
  D.set(soft, "silhouette.fit", 0.5, 0.4);
  assert("silhouette.fit" in Flow.protectExplicit(soft, node, eff).set,
    "an inferred fit (conf 0.4) is still overridable by a card side-effect");
}

console.log("\n— scrubImpossibleFills · inferred closures must be buildable per category (U1c) —");
{
  const D = global.DesignDNA;
  const allowed = (cat, v) => !(cat === "tshirt" && v !== "none");
  // Inferred button on a tee → scrubbed to none at the same (low) confidence.
  const d = D.create();
  D.set(d, "category", "tshirt", 1);
  D.set(d, "construction.closure", "button", 0.4); // archetype soft-fill
  Flow.scrubImpossibleFills(d, 0.5, allowed);
  assert(D.get(d, "construction.closure") === "none", "inferred closure 'button' on a tshirt is scrubbed to 'none'");
  assert(D.confidence(d, "construction.closure") === 0.4, "scrub keeps the low confidence — it stays visibly inferred");

  // An EXPLICIT value (conf > threshold) is never scrubbed.
  const e = D.create();
  D.set(e, "category", "tshirt", 1);
  D.set(e, "construction.closure", "button", 1);
  Flow.scrubImpossibleFills(e, 0.5, allowed);
  assert(D.get(e, "construction.closure") === "button", "an explicit closure answer is never scrubbed (only inferred fills are)");

  // No allowedFn → graceful no-op (test harness without GarmentSVG).
  const g = D.create();
  D.set(g, "category", "tshirt", 1);
  D.set(g, "construction.closure", "button", 0.4);
  Flow.scrubImpossibleFills(g, 0.5, undefined);
  assert(D.get(g, "construction.closure") === "button", "without an allowedFn the scrub is a graceful no-op");
}

console.log("\n— scrubImpossibleFills mit dem ECHTEN Renderer-Gate (zeichenbar ≠ erratbar) —");
{
  // Der Stub oben (`allowed`) kann per Konstruktion nie melden, dass die
  // echten Listen auseinanderlaufen: als das Kleid „button" ZEICHNEN lernte,
  // überlebte damit prompt auch der Archetyp-Default (quietMinimal setzt
  // construction.closure: "button") — jedes Kleid trug ab dem Kategorie-Tap
  // eine Knopfleiste, die niemand gewählt hatte, und kein Test schlug an.
  // Diese Suite fragt deshalb die echten GarmentSVG-Gates.
  const D = global.DesignDNA;
  const G = require("../js/design-engine/garment-svg.js");

  assert(G.closureAllowed("dress", "button"), "zeichenbar: das Kleid kann eine Knopfleiste darstellen");
  assert(!G.closureInferable("dress", "button"), "erratbar: die Maschine setzt sie NICHT von sich aus");
  assert(G.closureInferable("jacket", "zip"), "andere Kategorien erben ihre Zeichenliste (Jacke: Zip erratbar)");
  assert(!G.closureInferable("tshirt", "button"), "das T-Shirt bleibt in beiden Listen knopflos");

  // Der Archetyp-Fill (conf = Schwelle) fliegt beim Kleid raus …
  const inferred = D.create();
  D.set(inferred, "category", "dress", 1);
  D.set(inferred, "construction.closure", "button", 0.5);
  Flow.scrubImpossibleFills(inferred, 0.5, G.closureInferable);
  assert(D.get(inferred, "construction.closure") === "none",
    "REGRESSION GUARD: eine GERATENE Knopfleiste am Kleid wird ausgeräumt");

  // … die selbst getroffene Wahl (Regions-Confirm, conf 1) bleibt.
  const chosen = D.create();
  D.set(chosen, "category", "dress", 1);
  D.set(chosen, "construction.closure", "button", 1);
  Flow.scrubImpossibleFills(chosen, 0.5, G.closureInferable);
  assert(D.get(chosen, "construction.closure") === "button",
    "die selbst gewählte Knopfleiste am Kleid überlebt");

  // … und das GELESENE Wort (Describe, conf 0.62) läuft gegen das
  // Zeichen-Gate, nicht gegen das strengere Inferenz-Gate.
  const described = D.create();
  D.set(described, "category", "dress", 1);
  D.set(described, "construction.closure", "button", 0.62);
  Flow.scrubImpossibleFills(described, 0.62, G.closureAllowed);
  assert(D.get(described, "construction.closure") === "button",
    "„ein Kleid mit Knöpfen\" überlebt den Describe-Scrub");
}

console.log("\n— resolveEffects · cards multi UNION-merges array values (stapelbare Signaturen) —");
{
  const node = { modality: "cards", choices: [
    { id: "none", exclusive: true, effects: { set: { signature: [] } } },
    { id: "zip", effects: { set: { signature: ["asymmetric-zip"] }, weight: { techAvant: 0.15 } } },
    { id: "stitch", effects: { set: { signature: ["contrast-stitch"] }, weight: { utility: 0.1 } } },
  ] };
  const two = Flow.resolveEffects(node, ["zip", "stitch"]);
  assert(eq(two.eff.set.signature, ["asymmetric-zip", "contrast-stitch"]),
    "two stacked signature picks UNION on the same path (last tap no longer wins)");
  assert(two.eff.weight.techAvant === 0.15 && two.eff.weight.utility === 0.1, "both picks' weights accumulate");
  const dup = Flow.resolveEffects(node, ["zip", "zip"]);
  assert(eq(dup.eff.set.signature, ["asymmetric-zip"]), "duplicate ids dedupe (Set semantics)");
  const none = Flow.resolveEffects(node, ["none"]);
  assert(eq(none.eff.set.signature, []), "an exclusive 'none' commits the empty stack");
}

console.log("\n— mutateDna · Archetyp-Zug (Runde 3: Richtungen mit benannter Heimat) —");
{
  const D = global.DesignDNA;
  const mkBase = () => {
    const b = D.create();
    D.set(b, "color.stops", ["#2779a8"], 1);
    D.set(b, "silhouette.fit", 0.2, 1);
    D.set(b, "silhouette.structure", 0.5, 1);
    D.set(b, "fabric.finishWeight", 0.2, 1);
    return b;
  };
  const soft = { id: "softCouture", defaults: {
    "silhouette.fit": 0.9, "silhouette.structure": 0.3,
    "fabric.finish": "sheen", "color.stops": ["#831843"], "pattern.type": "none",
  } };
  const plain = Flow.mutateDna(mkBase(), 2, 1);
  const noArch = Flow.mutateDna(mkBase(), 2, 1, null);
  assert(eq(plain, noArch), "without an archetype the variant is byte-identical (backwards compatible)");

  const pulled = Flow.mutateDna(mkBase(), 2, 1, soft);
  assert(!eq(plain, pulled), "an archetype visibly reshapes the variant");
  const fitPlain = D.get(plain, "silhouette.fit"), fitPulled = D.get(pulled, "silhouette.fit");
  assert(fitPulled > fitPlain, "fit moves TOWARD the archetype's default (0.2 → toward 0.9)");
  const finPulled = D.get(pulled, "fabric.finishWeight");
  assert(finPulled > D.get(plain, "fabric.finishWeight"), "a 'sheen' archetype lifts the finish weight");
  assert(Flow.hexHue(D.get(pulled, "color.stops")[0]) !== null, "pulled stops remain valid hex colours");
  assert(eq(Flow.mutateDna(mkBase(), 2, 1, soft), pulled), "the archetype pull is deterministic (same in, same out)");

  // Ein ENTSCHIEDENES „kein Muster" übersteht auch den Muster-Archetyp.
  const street = { id: "y2kStreet", defaults: { "pattern.type": "graphic", "pattern.scale": 0.7, "color.stops": ["#2a9d8f"] } };
  let reintroduced = false;
  for (let idx = 1; idx <= 3; idx++) {
    for (let v = 1; v <= 4; v++) {
      const b = mkBase();
      D.set(b, "pattern.type", "none", 1);
      if (D.get(Flow.mutateDna(b, idx, v, street), "pattern.type") !== "none") reintroduced = true;
    }
  }
  assert(!reintroduced, "explicit pattern.type 'none' (conf 1) survives every archetype-fed concept × version");
}

console.log("\n— scrubImpossibleFills räumt Describe-/Freitext-Saat (conf 0.62) aus —");
{
  const D = global.DesignDNA;
  const allowed = (cat, v) => (cat === "tshirt" ? v === "none" : true);
  // „mit Reissverschluss" ohne Garment-Wort passiert das Parser-Gate und
  // landet bei 0.62 — über der Finalize-Schwelle 0.5. Der Commit-/Freitext-
  // Scrub läuft deshalb mit 0.62 und muss genau diese Saat ausräumen.
  const d = D.create();
  D.set(d, "category", "tshirt", 1);
  D.set(d, "construction.closure", "zip", 0.62);
  Flow.scrubImpossibleFills(d, 0.62, allowed);
  assert(D.get(d, "construction.closure") === "none", "ein unbaubarer 0.62-Verschluss wird auf 'none' ausgeräumt");
  const e = D.create();
  D.set(e, "category", "tshirt", 1);
  D.set(e, "construction.closure", "zip", 1);
  Flow.scrubImpossibleFills(e, 0.62, allowed);
  assert(D.get(e, "construction.closure") === "zip", "eine explizite Antwort (conf 1) bleibt unangetastet");
  const f = D.create();
  D.set(f, "category", "hoodie", 1);
  D.set(f, "construction.closure", "zip", 0.62);
  Flow.scrubImpossibleFills(f, 0.62, allowed);
  assert(D.get(f, "construction.closure") === "zip", "eine für die Kategorie baubare Saat bleibt stehen");
}

console.log("\n— changeLabel · Commit-Flash-Worte (inkl. Multi-Select-Stapel) —");
{
  // t() liest window.I18N zur Laufzeit — im Node-Harness genügt der Key-Echo.
  global.window = global.window || {};
  global.window.I18N = global.window.I18N || { t: (k) => k };
  const node = { modality: "cards", choices: [
    { id: "a", label: { de: "Kontrastnaht", en: "Contrast stitch" } },
    { id: "b", label: { de: "Patch", en: "Patch" } },
    { id: "c", label: { de: "Zip", en: "Zip" } },
  ] };
  assert(Flow.changeLabel(node, "b", "de") === "Patch", "Single-Select: das getippte Wort");
  assert(Flow.changeLabel(node, ["a", "b"], "de") === "Kontrastnaht · Patch", "Stapel: zwei Worte mit Mittelpunkt");
  assert(Flow.changeLabel(node, ["a", "b", "c"], "de") === "Kontrastnaht · Patch +1", "Stapel: ab drei Worten gezählt (+n)");
  assert(Flow.changeLabel(node, [], "de") === "engine.changed_details", "leerer Stapel fällt auf den i18n-Key zurück");
  const slider = { modality: "slider", axis: { de: ["Matt", "Glanz"], en: ["Matte", "Sheen"] } };
  assert(Flow.changeLabel(slider, 0.9, "de") === "Glanz", "Slider: hoher Wert nennt den Hi-Pol");
  assert(Flow.changeLabel(slider, 0.1, "de") === "Matt", "Slider: tiefer Wert nennt den Lo-Pol");
  assert(Flow.changeLabel(slider, 0.5, "de") === "·", "Slider: Mitte bleibt der stille Punkt");
}

console.log("\n— orderRand (Session-Seed → node-id → 0..1, stabil und seed-verschieden) —");
{
  const r7 = Flow.orderRand(7);
  const ids = ["jacket_fit", "jacket_length", "jacket_material", "jacket_color", "jacket_details"];
  assert(ids.every((id) => r7(id) === Flow.orderRand(7)(id)), "same seed → same value per node (Zurück/Resume stabil)");
  assert(ids.every((id) => { const v = r7(id); return v >= 0 && v < 1; }), "values stay in [0,1)");
  const r8 = Flow.orderRand(8);
  assert(ids.some((id) => r7(id) !== r8(id)), "a different seed shifts at least one node's draw");
  assert(typeof Flow.orderRand(NaN)("x") === "number", "a broken seed degrades to a number, never throws");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
