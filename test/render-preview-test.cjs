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

// Minimal stand-in for the .de-preview element: renderInto only needs a
// classList + an innerHTML sink + a null-returning querySelector to run the
// (non-realism / no-photo) paths where the realism dim is cleared.
function fakeEl(initialClasses) {
  const classes = new Set(initialClasses || []);
  return {
    innerHTML: "",
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    querySelector: () => null,
  };
}

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

console.log("\n— renderInto clears a stale .is-realism so a restart never shows a dimmed flat —");
{
  // The realism path adds .is-realism to .de-preview at convergence (the dimmed
  // flat under the crossfaded photo). It must be cleared on the next non-realism
  // render, or the restarted journey paints the new flat at opacity 0.1 until a
  // hard refresh — the reported "switch garment type → dimmed preview" bug.
  const live = fakeEl(["is-realism"]);
  DP.renderInto(live, jacketDna(), { realism: false });
  assert(live.classList.contains("is-realism") === false, "non-realism (live journey) render clears a stale .is-realism");

  // Realism requested but no curated photo (empty DNA → no category → no hero
  // candidates) → keep the flat visible, clear any leftover dim.
  const noPhoto = fakeEl(["is-realism"]);
  DP.renderInto(noPhoto, DesignDNA.create(), { realism: true });
  assert(noPhoto.classList.contains("is-realism") === false, "realism render with no curated photo clears the realism dim");
}

console.log("\n— renderInto ignores a stale realism photo-probe superseded by a later render —");
{
  // The realism branch loads the hero photo asynchronously (new Image() +
  // onload). If the user backs out to a question (renderInto called again,
  // realism: false) before that probe resolves, the late onload must NOT
  // resurrect .is-realism / show its photo over the render that superseded
  // it — that would reintroduce the exact "stale dimmed preview" bug fixed
  // above, just via the async path instead of a leftover DOM class.
  const instances = [];
  class FakeImage { constructor() { instances.push(this); } }
  const realImage = global.Image;
  global.Image = FakeImage;
  let rafQueue = [];
  const realRaf = global.requestAnimationFrame;
  global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };

  const photoWrap = { hidden: true, classList: { add: () => {}, remove: () => {}, contains: () => false } };
  const img = { src: "" };
  const classes = new Set();
  const el = {
    innerHTML: "",
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    querySelector: (sel) => (sel === ".de-preview-photo" ? photoWrap : sel === ".de-preview-photo img" ? img : null),
  };

  DP.renderInto(el, jacketDna(), { realism: true }); // kicks off the (never-resolved) probe
  assert(instances.length === 1, "realism render with a curated photo starts one probe");
  DP.renderInto(el, jacketDna(), { realism: false }); // user backs out before it resolves

  instances[0].onload(); // the superseded probe finally resolves
  assert(img.src === "", "a superseded probe never applies its image");
  assert(photoWrap.hidden === true, "a superseded probe never reveals the photo wrap");
  assert(rafQueue.length === 0, "a superseded probe never schedules the crossfade");
  assert(classes.has("is-realism") === false, "a superseded probe never re-adds .is-realism");

  global.Image = realImage;
  global.requestAnimationFrame = realRaf;
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
