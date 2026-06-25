/* Headless test for js/spec-view.js — the DOM-safe spec-sheet renderer that
   replaced the old innerHTML spec sheet (the XSS-hardened path: it builds the
   production fragment with createElement/textContent, never string HTML). It
   only touches a handful of DOM APIs, so a tiny element mock exercises it fully
   without a browser. We pin: the colour swatch + label, the quoted print note
   (locale-aware), the measurement rows, the construction-note list, the empty
   states, and the null-target guards. */
const path = require("path");

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

// Minimal element mock: tracks children + style + textContent the way the
// renderer uses them (appendChild, removeChild, firstChild, createTextNode).
function makeEl() {
  return {
    _text: "",
    style: {},
    children: [],
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
    set textContent(v) { this._text = v; this.children = []; },
    get textContent() { return this._text; },
  };
}

const ids = {};
function el(id) { return (ids[id] = ids[id] || makeEl()); }

global.window = { I18N: { locale: () => "de" } };
global.document = {
  createElement: () => makeEl(),
  createTextNode: (t) => ({ nodeType: 3, _text: t }),
  getElementById: (id) => ids[id] || null,
};

const SpecView = require(path.join(__dirname, "..", "js", "spec-view.js"));

// Seed the target nodes the renderer writes into.
["spec-color", "spec-print", "spec-measures", "spec-notes"].forEach(el);

console.log("\n— renderProductionDetails populates every spec node (DE) —");
SpecView.renderProductionDetails({
  color: "#2a9d8f",
  print: "Brustlogo",
  measurements: { chest: 100, waist: 80, height: 180 },
  constructionNotes: ["Flachnaht", "Doppelsteppung"],
  measureLabel: (k) => `LBL:${k}`,
});

const colorCell = ids["spec-color"];
assert(colorCell.children.length === 2, "colour cell gets a swatch span + a text node");
assert(colorCell.children[0].style.background === "#2a9d8f", "swatch background is the chosen colour");
assert(colorCell.children[1]._text === "#2a9d8f", "colour hex is appended as text");

assert(ids["spec-print"].textContent === "„Brustlogo“", "print note is wrapped in German quotes");
assert(ids["spec-measures"].children.length === 3, "one table row per measurement");
assert(ids["spec-measures"].children[0].children[1].textContent === "100 cm", "measurement value carries the cm unit");
assert(ids["spec-measures"].children[0].children[0].textContent === "LBL:chest", "measure label comes from the provided labeller");
assert(ids["spec-notes"].children.length === 2, "one list item per construction note");
assert(ids["spec-notes"].children[1].textContent === "Doppelsteppung", "note text lands in the <li>");

console.log("\n— empty / missing values degrade cleanly —");
SpecView.renderProductionDetails({ color: "#000000", print: "   ", measurements: null, constructionNotes: null, measureLabel: (k) => k });
assert(ids["spec-print"].textContent === "—", "blank print → em dash placeholder");
assert(ids["spec-measures"].children.length === 0, "null measurements → no rows (cleared)");
assert(ids["spec-notes"].children.length === 0, "null notes → empty list (cleared)");

console.log("\n— re-render clears the previous content (no duplication) —");
SpecView.renderProductionDetails({ color: "#111111", print: "X", measurements: { chest: 90 }, constructionNotes: ["A"], measureLabel: (k) => k });
assert(ids["spec-measures"].children.length === 1, "second render replaces, not appends, rows");
assert(ids["spec-color"].children.length === 2, "colour cell is rebuilt from scratch");

console.log("\n— English locale uses curly double quotes —");
global.window.I18N.locale = () => "en-US";
SpecView.renderProductionDetails({ color: "#222", print: "Chest logo", measurements: {}, constructionNotes: [], measureLabel: (k) => k });
assert(ids["spec-print"].textContent === "“Chest logo”", "EN locale → curly double quotes");

console.log("\n— null target nodes are guarded (no throw) —");
global.document.getElementById = () => null;
let threw = false;
try {
  SpecView.renderProductionDetails({ color: "#333", print: "Y", measurements: { a: 1 }, constructionNotes: ["n"], measureLabel: (k) => k });
} catch (_e) { threw = true; }
assert(!threw, "missing spec nodes → renderProductionDetails is a no-op, never throws");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
