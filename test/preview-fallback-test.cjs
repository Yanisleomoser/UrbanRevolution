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

/* — svgNode(): the DOM-safe node builder (sanitiser) —
   svgNode parses svg()'s markup and strips anything dangerous before the
   fragment is imported into the live document. The DOM surface it touches is
   tiny (DOMParser, importNode, querySelectorAll, attributes), so a hand-rolled
   stub exercises the sanitiser fully — same convention as spec-view-test. */
function fakeEl(localName, ns, attrs = [], children = []) {
  return {
    localName,
    namespaceURI: ns,
    attributes: attrs.map((a) => ({ name: a[0], value: a[1] })),
    children,
    _removed: false,
    remove() { this._removed = true; },
    removeAttribute(n) { this.attributes = this.attributes.filter((a) => a.name !== n); },
    querySelectorAll(sel) {
      const all = [];
      (function walk(node) {
        node.children.forEach((c) => { all.push(c); walk(c); });
      })(this);
      const live = all.filter((n) => !n._removed);
      if (sel === "*") return live;
      const wanted = sel.split(",");
      return live.filter((n) => wanted.includes(n.localName));
    },
  };
}

let lastMarkup = null;
let nextRoot = null;
let imported = null;
global.DOMParser = class {
  parseFromString(str) { lastMarkup = str; return { documentElement: nextRoot }; }
};
global.document = { importNode(node, deep) { imported = { node, deep }; return node; } };

console.log("\n— svgNode: sanitises the parsed fragment before import —");
{
  const script = fakeEl("script", "http://www.w3.org/2000/svg");
  const foreign = fakeEl("foreignObject", "http://www.w3.org/2000/svg");
  const handler = fakeEl("rect", "http://www.w3.org/2000/svg", [["onclick", "alert(1)"], ["fill", "#111111"]]);
  const badHref = fakeEl("a", "http://www.w3.org/2000/svg", [["href", "javascript:alert(1)"]]);
  const badXlink = fakeEl("use", "http://www.w3.org/2000/svg", [["xlink:href", "data:text/html,x"]]);
  const goodHref = fakeEl("a", "http://www.w3.org/2000/svg", [["href", "#pf1clip"]]);
  nextRoot = fakeEl("svg", "http://www.w3.org/2000/svg", [], [script, foreign, handler, badHref, badXlink, goodHref]);
  imported = null;
  const node = PreviewFallback.svgNode({ type: "jacket", color: "#2779a8", material: "silk", pattern: "plaid", name: "Test" });
  assert(node === nextRoot, "returns the imported root node");
  assert(imported && imported.deep === true, "imports the node deeply into the live document");
  assert(script._removed, "<script> children are removed");
  assert(foreign._removed, "<foreignObject> children are removed");
  assert(!handler.attributes.some((a) => a.name === "onclick"), "on* handler attributes are stripped");
  assert(handler.attributes.some((a) => a.name === "fill"), "harmless attributes survive");
  assert(!badHref.attributes.length, "javascript: hrefs are stripped");
  assert(!badXlink.attributes.length, "data: xlink:hrefs are stripped");
  assert(goodHref.attributes.some((a) => a.name === "href"), "fragment hrefs survive");
}

console.log("\n— svgNode: refuses anything that did not parse to a real <svg> root —");
{
  nextRoot = fakeEl("parsererror", "http://www.mozilla.org/newlayout/xml/parsererror.xml");
  assert(PreviewFallback.svgNode({ type: "tshirt", color: "#222222" }) === null, "parsererror root \u2192 null");
  nextRoot = fakeEl("svg", "http://www.w3.org/1999/xhtml");
  assert(PreviewFallback.svgNode({ type: "tshirt", color: "#222222" }) === null, "wrong namespace \u2192 null");
  nextRoot = null;
  assert(PreviewFallback.svgNode({ type: "tshirt", color: "#222222" }) === null, "no root at all \u2192 null");
}

console.log("\n— svgNode: gates its inputs exactly like svg() (defaults visible in the markup) —");
{
  nextRoot = fakeEl("svg", "http://www.w3.org/2000/svg");
  PreviewFallback.svgNode({ type: "cape", color: "red", material: "vibranium", pattern: 7, name: "x".repeat(200) });
  assert(lastMarkup.includes(TSHIRT_PATH), "unknown type falls back to the tshirt silhouette");
  assert(lastMarkup.includes("#9aa0a8"), "invalid colour falls back to the neutral default");
  assert(!lastMarkup.includes("x".repeat(121)), "over-long names are truncated to 120 chars");
  PreviewFallback.svgNode(null);
  assert(lastMarkup.includes(TSHIRT_PATH), "null input still renders the default garment");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
