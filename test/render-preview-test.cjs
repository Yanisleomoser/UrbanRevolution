/* Headless test for the Design-Engine live-preview's pure DNA mappers
   (js/design-engine/render-preview.js).

   renderInto()/morph() are DOM + rAF bound (covered by the screenshot harness),
   but the data transforms that feed them are pure and worth pinning:
     params(dna)        — flattens the DNA into the flat-builder's param bag
     duoBackground(dna) — the colour scheme → CSS background string
     descriptor(dna)    — the {type,color,material,pattern} bag the $0 fallback uses
     heroCandidates(dna)— ordered preview-image URL candidates

   These read a bare global `DesignDNA` (and heroCandidates also checks
   window.DesignDNA), so we wire the real module onto both, like engine-test. */
const path = require("path");
const ROOT = path.join(__dirname, "..", "js", "design-engine");
const DesignDNA = require(path.join(ROOT, "dna.js"));
global.DesignDNA = DesignDNA;
global.window = { DesignDNA };
const DP = require(path.join(ROOT, "render-preview.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A representative, fully-specified design.
function jacketDna() {
  const dna = DesignDNA.create();
  DesignDNA.set(dna, "category", "jacket", 1);
  DesignDNA.set(dna, "silhouette.fit", 0.7, 1);
  DesignDNA.set(dna, "length", "long", 1);
  DesignDNA.set(dna, "color.scheme", "duo-gradient", 1);
  DesignDNA.set(dna, "color.stops", ["#2779a8", "#64d6c4"], 1);
  DesignDNA.set(dna, "fabric.material", "denim", 1);
  DesignDNA.set(dna, "pattern.type", "stripe", 1);
  return dna;
}

console.log("\n— params flattens the DNA into the flat-builder's param bag —");
{
  const p = DP.params(jacketDna());
  assert(p.category === "jacket", "category mapped");
  assert(p.fit === 0.7 && p.length === "long", "silhouette + length mapped");
  assert(p.material === "denim", "material mapped");
  assert(p.scheme === "duo-gradient" && eq(p.stops, ["#2779a8", "#64d6c4"]), "colour scheme + stops mapped");
  assert(p.pattern === "stripe", "pattern.type mapped");
  assert("archetype" in p, "always includes a (possibly null) archetype for the neutral tone");
}

console.log("\n— params.finish: numeric finishWeight wins, else maps the string finish —");
{
  const dna = jacketDna();
  assert(DP.params(dna).finish === undefined, "no finishWeight + no finish → undefined (flat uses its default)");
  DesignDNA.set(dna, "fabric.finish", "matte", 1);
  assert(DP.params(dna).finish === 0.15, "string finish 'matte' → 0.15");
  DesignDNA.set(dna, "fabric.finishWeight", 0.6, 1);
  assert(DP.params(dna).finish === 0.6, "a numeric finishWeight overrides the string finish");
}

console.log("\n— duoBackground maps the colour scheme to a CSS background —");
{
  assert(DP.duoBackground(jacketDna()) === "linear-gradient(155deg, #2779a8, #64d6c4)", "duo-gradient + 2 stops → linear-gradient");
  const single = DesignDNA.create();
  DesignDNA.set(single, "color.stops", ["#abcdef"], 1);
  assert(DP.duoBackground(single) === "#abcdef", "a single stop → that flat colour");
  assert(DP.duoBackground(DesignDNA.create()) === "#9aa0a8", "no stops → neutral default");
  // duo scheme but only one stop → can't gradient, falls back to the first stop.
  const oneStopDuo = DesignDNA.create();
  DesignDNA.set(oneStopDuo, "color.scheme", "duo-gradient", 1);
  DesignDNA.set(oneStopDuo, "color.stops", ["#112233"], 1);
  assert(DP.duoBackground(oneStopDuo) === "#112233", "duo scheme with <2 stops → first stop (no broken gradient)");
}

console.log("\n— descriptor builds the {type,color,material,pattern} bag the $0 fallback consumes —");
{
  assert(eq(DP.descriptor(jacketDna()), { type: "jacket", color: "#2779a8", material: "denim", pattern: "gradient", name: "" }),
    "duo-gradient design → pattern 'gradient', first stop as colour");
  assert(eq(DP.descriptor(DesignDNA.create()), { type: "tshirt", color: "#9aa0a8", material: "cotton", pattern: "solid", name: "" }),
    "empty DNA → safe defaults (tshirt / neutral / cotton / solid)");
  // A real woven pattern (non-gradient scheme) surfaces as that pattern.
  const woven = DesignDNA.create();
  DesignDNA.set(woven, "category", "shirt", 1);
  DesignDNA.set(woven, "pattern.type", "plaid", 1);
  assert(DP.descriptor(woven).pattern === "plaid", "non-gradient design surfaces its pattern.type");
  DesignDNA.set(woven, "pattern.type", "none", 1);
  assert(DP.descriptor(woven).pattern === "solid", "pattern.type 'none' → 'solid'");
}

console.log("\n— heroCandidates lists preview-image URLs, most-specific first —");
{
  const dna = jacketDna();
  DesignDNA.set(dna, "subArchetype", "bomber", 1);
  const list = DP.heroCandidates(dna);
  assert(list.length === 2, "category + subArchetype → two candidates");
  assert(list[0].endsWith("-bomber.jpg") && list[0].includes("jacket-"), "the sub-archetype-specific image is tried first");
  assert(list[1].endsWith(".jpg") && !list[1].includes("-bomber"), "the generic category+archetype image is the fallback");
  assert(eq(DP.heroCandidates(DesignDNA.create()), []), "no category → no candidates (empty list, no throw)");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
