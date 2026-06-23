/* Headless test for the landing controller's studio-reveal predicate
   (js/landing.js).

   The landing experience keeps the studio (#studio) hidden until a CTA anchor
   OR a share/deep link reveals it. The decision "does this URL fragment open
   the studio?" is load-bearing for share links (#dna=…) and deep links —
   getting it wrong means a shared design opens to a blank landing. That
   predicate is pure and now hoisted above all DOM access (the module exports it
   and early-returns in a non-DOM context, so the GSAP/canvas body never runs). */
const path = require("path");
const Landing = require(path.join(__dirname, "..", "js", "landing.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

const { shouldRevealForHash, STUDIO_ANCHORS } = Landing;

console.log("\n— the documented studio anchors all reveal the studio —");
assert(Array.isArray(STUDIO_ANCHORS) && STUDIO_ANCHORS.length === 5, "five studio anchors are exported");
["design", "ownership", "measure", "production", "faq"].forEach((a) => {
  assert(STUDIO_ANCHORS.includes(a), `'${a}' is a studio anchor`);
  assert(shouldRevealForHash("#" + a) === true, `#${a} → reveal`);
});

console.log("\n— share / deep links carrying an encoded design reveal the studio —");
assert(shouldRevealForHash("#dna=AbC-123_xyz") === true, "#dna=… (leading) → reveal");
assert(shouldRevealForHash("#measure&dna=zzz") === true, "&dna=… (combined fragment) → reveal");
assert(shouldRevealForHash("#x&dna=") === true, "the &dna= marker is enough to reveal");

console.log("\n— unrelated fragments leave the landing intact —");
["#about", "#facts", "#community", "#", "", "#designer", "#dnax"].forEach((h) => {
  assert(shouldRevealForHash(h) === false, `${JSON.stringify(h)} → no reveal`);
});

console.log("\n— prefix-safety: only the exact anchor names match (no #designer/#measurements) —");
assert(shouldRevealForHash("#designer") === false, "'#designer' does NOT match the 'design' anchor");
assert(shouldRevealForHash("#measurements") === false, "'#measurements' does NOT match the 'measure' anchor");

console.log("\n— robust to junk input (never throws) —");
assert(shouldRevealForHash(null) === false, "null → false");
assert(shouldRevealForHash(undefined) === false, "undefined → false");
assert(shouldRevealForHash("design") === true, "a fragment without the leading # still resolves");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
