/* Headless test for the $0 client-side preview fallback (js/preview-fallback.js).

   When the paid photoreal render is unavailable, PreviewFallback.svg() draws a
   studio illustration of the garment from the data we already have — it must
   never dead-end, never leak NaN, and (since it embeds a user-supplied name)
   never let markup through unescaped. It's a pure function, so we test it
   headless; the module now carries the standard module.exports guard. */
const path = require("path");
const PreviewFallback = require(path.join(__dirname, "..", "js", "preview-fallback.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

const TYPES = ["tshirt", "hoodie", "shirt", "pants", "jacket", "dress"];
// First path segment of each type's silhouette — enough to identify which
// silhouette was drawn (tshirt is the documented fallback shape).
const TSHIRT_PATH = "M16 16 L24 8";

console.log("\n— svg() renders a valid studio frame for every garment type —");
TYPES.forEach((type) => {
  const svg = PreviewFallback.svg({ type, color: "#2779a8", material: "cotton" });
  assert(svg.startsWith("<svg") && svg.includes("</svg>"), `${type}: returns a closed <svg>`);
  assert(svg.includes('viewBox="0 0 360 440"'), `${type}: uses the 360×440 studio frame`);
  assert(svg.includes('role="img"'), `${type}: carries role="img" (accessible)`);
});

console.log("\n— the chosen colour drives the garment fill —");
assert(PreviewFallback.svg({ type: "tshirt", color: "#2779a8" }).includes("#2779a8"), "valid hex appears as the volume base colour");

console.log("\n— unknown garment type degrades to the tshirt silhouette (never blank) —");
assert(PreviewFallback.svg({ type: "cape", color: "#222222" }).includes(TSHIRT_PATH), "unknown type → tshirt silhouette path");
assert(PreviewFallback.svg({}).includes(TSHIRT_PATH), "no type at all → tshirt silhouette path");

console.log("\n— invalid colour falls back to the neutral default (#9aa0a8) —");
assert(PreviewFallback.svg({ type: "tshirt", color: "red" }).includes("#9aa0a8"), "non-hex colour → neutral default");
assert(PreviewFallback.svg({ type: "tshirt", color: "#fff" }).includes("#9aa0a8"), "3-digit hex is rejected by the 6-digit gate → default");
assert(PreviewFallback.svg({ type: "tshirt", color: "#2A9D8F" }).includes("#2A9D8F"), "a valid #RRGGBB (any case) passes through");

console.log("\n— the user-supplied name is escaped into the aria-label (no markup injection) —");
const xss = PreviewFallback.svg({ type: "tshirt", color: "#222222", name: "<script>alert(1)</script>" });
assert(!xss.includes("<script"), "raw <script> never reaches the markup");
assert(xss.includes("&lt;script&gt;"), "the name is HTML-escaped");

console.log("\n— pattern overlay is woven in only for real patterns —");
assert(!PreviewFallback.svg({ type: "tshirt", color: "#888888", pattern: "solid" }).includes("<pattern id"), "'solid' → no pattern overlay");
assert(!PreviewFallback.svg({ type: "tshirt", color: "#888888" }).includes("<pattern id"), "no pattern → no overlay");
["stripes_h", "stripes_v", "dots", "plaid", "heather", "camo", "floral"].forEach((p) => {
  assert(PreviewFallback.svg({ type: "tshirt", color: "#888888", pattern: p }).includes("<pattern id"), `'${p}' weaves a <pattern> overlay`);
});

console.log("\n— no garbage input ever produces NaN/undefined or throws —");
[{}, null, undefined, { type: 5, color: {}, material: [], pattern: 7, name: 9 }].forEach((bad) => {
  const svg = PreviewFallback.svg(bad);
  assert(svg.startsWith("<svg") && !/NaN|undefined/.test(svg), `${JSON.stringify(bad)} → clean SVG (no NaN/undefined)`);
});

console.log("\n— output is deterministic apart from the per-call element ids —");
const normId = (s) => s.replace(/pf\d+/g, "pfN");
const d = { type: "jacket", color: "#2779a8", material: "silk", pattern: "plaid" };
assert(normId(PreviewFallback.svg(d)) === normId(PreviewFallback.svg(d)), "same input → identical SVG (ids aside)");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
