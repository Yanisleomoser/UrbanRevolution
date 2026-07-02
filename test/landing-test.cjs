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

const { shouldRevealForHash, STUDIO_ANCHORS, pivotBendPath } = Landing;

/* pivotBendPath — the pure geometry behind the #pivot "line bends into a
   circle" scrub. A wrong path silently breaks the page's signature moment
   (degenerate radius → NaN coords → invisible SVG), so pin the math here. */
function parsePath(d) {
  return d.replace(/^M/, "").split(" L").map((pair) => pair.trim().split(" ").map(Number));
}
const L = 754, CX = 210, CY = 310;

console.log("\n— pivotBendPath: p=0 is a straight vertical line of length L, centred —");
{
  const pts = parsePath(pivotBendPath(0, L, CX, CY, 64));
  assert(pts.length === 65, "64 samples → 65 points");
  assert(pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])), "all coordinates finite");
  assert(pts.every((p) => Math.abs(p[0] - CX) < 0.01), "straight: every x sits on the centre axis");
  const ys = pts.map((p) => p[1]);
  assert(Math.abs((Math.max(...ys) - Math.min(...ys)) - L) < 0.1, "vertical span equals the seam length L");
  assert(Math.abs((Math.max(...ys) + Math.min(...ys)) / 2 - CY) < 0.1, "line is centred on cy");
}

console.log("\n— pivotBendPath: p=1 closes into a circle of circumference L —");
{
  const pts = parsePath(pivotBendPath(1, L, CX, CY, 64));
  const first = pts[0], last = pts[pts.length - 1];
  assert(Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.5, "the curve closes (first ≈ last point)");
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const D = L / Math.PI; // diameter of a circle with circumference L
  assert(Math.abs(width - D) < 1.5, `width ≈ L/π (${width.toFixed(1)} vs ${D.toFixed(1)})`);
  assert(Math.abs(height - D) < 1.5, "height ≈ L/π (it is a circle, not an ellipse)");
  assert(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2 - CX) < 0.1, "circle centred on cx");
}

console.log("\n— pivotBendPath: mid-bend stays open, figure contracts monotonically —");
{
  const mid = parsePath(pivotBendPath(0.5, L, CX, CY, 64));
  const first = mid[0], last = mid[mid.length - 1];
  assert(Math.hypot(first[0] - last[0], first[1] - last[1]) > 10, "half-bent arc is still open");
  const heightAt = (p) => {
    const ys = parsePath(pivotBendPath(p, L, CX, CY, 64)).map((pt) => pt[1]);
    return Math.max(...ys) - Math.min(...ys);
  };
  assert(heightAt(0.25) > heightAt(0.6) && heightAt(0.6) > heightAt(1), "height shrinks as the line rolls up");
}

console.log("\n— pivotBendPath: robust to junk progress (never NaN, never throws) —");
[NaN, -1, 2, null, undefined, "0.5"].forEach((p) => {
  const d = pivotBendPath(p, L, CX, CY, 32);
  assert(typeof d === "string" && !d.includes("NaN"), `progress ${String(p)} → valid path`);
});

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
["#about", "#facts", "#pivot", "#community", "#", "", "#designer", "#dnax"].forEach((h) => {
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
