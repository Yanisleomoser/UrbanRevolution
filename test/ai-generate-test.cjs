/* Headless test for AI.generateDesign()'s assembled output — the local
   keyword-fallback path (js/ai.js).

   ai-test.cjs covers the detect* helpers in isolation; this one covers the
   public generateDesign() that stitches them into the design object the rest of
   the app (and the /api/generate-design proxy) must agree on. CLAUDE.md flags
   that JSON contract — { name, description, color, material, fit, tags,
   constructionNotes } — as load-bearing.

   generateDesign tries the server proxy then the browser-key path before the
   local generator. Under node both fall through: fetch('/api/...') rejects on
   the relative URL (caught → null) and window.URBAN_REVOLUTION_API_KEY is unset
   (→ null), so the deterministic local generator runs. We wire the real I18N so
   description/notes resolve to real copy, and shim the window bits ai.js touches
   (dispatchEvent, no API key). */
const path = require("path");

global.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
global.document = {
  readyState: "complete", querySelectorAll: () => [],
  documentElement: { setAttribute() {} }, addEventListener() {}, title: "",
};
// window must exist BEFORE i18n.js (it assigns window.I18N) and ai.js load.
global.window = { dispatchEvent: () => {}, addEventListener: () => {} };
window.I18N = require(path.join(__dirname, "..", "js", "i18n.js"));
// ai.js reads a bare global `CONFIG` at IIFE eval (it builds COLOR_DICT from
// CONFIG.COLORS), so CONFIG must live on `global` before requiring it.
const CONFIG = require(path.join(__dirname, "..", "js", "config.js"));
global.CONFIG = CONFIG;
const AI = require(path.join(__dirname, "..", "js", "ai.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^UR-[0-9A-Z]+-[0-9A-Z]{6}$/;

(async () => {
  console.log("\n— generateDesign assembles the full design contract (local fallback) —");
  const d = await AI.generateDesign("ein oversized schwarzer hoodie aus fleece, gestreift, nachhaltig", "hoodie");

  // The contract every consumer relies on.
  ["name", "description", "color", "material", "fit", "tags", "constructionNotes", "type", "designId", "generatedAt", "originalPrompt"]
    .forEach((k) => assert(k in d, `output has '${k}'`));

  console.log("\n— fields are well-typed and validatable —");
  assert(d.type === "hoodie", "explicit garmentType wins");
  assert(HEX.test(d.color), `color is a #RRGGBB hex (${d.color})`);
  assert(CONFIG.validateColor(d.color) === d.color, "color passes CONFIG.validateColor");
  assert(CONFIG.MATERIALS[d.material] !== undefined, `material is a known CONFIG material (${d.material})`);
  assert(typeof d.fit === "number" && d.fit >= 0 && d.fit <= 1, `fit is a 0..1 scalar (${d.fit})`);
  assert(Array.isArray(d.tags), "tags is an array");
  assert(Array.isArray(d.constructionNotes) && d.constructionNotes.length > 0, "constructionNotes is a non-empty array");
  assert(typeof d.name === "string" && d.name.trim().length > 0, "name is a non-empty string");
  assert(typeof d.description === "string" && d.description.length > 0, "description is a non-empty string");

  console.log("\n— detect* helpers are wired into the assembled object —");
  assert(d.material === "fleece", "'fleece' from the prompt drives the material");
  assert(d.fit === 0.93, "'oversized' from the prompt drives fit (0.93)");
  assert(d.pattern === "stripes_h", "'gestreift' from the prompt drives the pattern");
  assert(d.tags.includes("nachhaltig"), "recognised keyword surfaces as a tag");

  console.log("\n— metadata: stable id format, ISO timestamp, echoed prompt —");
  assert(ID.test(d.designId), `designId matches UR-…-… (${d.designId})`);
  assert(!isNaN(Date.parse(d.generatedAt)), "generatedAt parses as a date");
  assert(d.originalPrompt.includes("hoodie"), "originalPrompt echoes the input");

  console.log("\n— type defaults to tshirt when none is given or detected —");
  const d2 = await AI.generateDesign("etwas schlichtes in weiß");
  assert(d2.type === "tshirt", "no garmentType + no type word → tshirt");
  assert(HEX.test(d2.color), "default-type design still has a valid colour");

  console.log("\n— garmentType is detected from the prompt when not passed —");
  const d3 = await AI.generateDesign("ein langes elegantes Kleid");
  assert(d3.type === "dress", "'Kleid' in the prompt → dress");

  console.log("\n— invalid prompts are rejected (boundary contract) —");
  let threw = false;
  try { await AI.generateDesign(""); } catch { threw = true; }
  assert(threw, "empty prompt throws");
  threw = false;
  try { await AI.generateDesign(null); } catch { threw = true; }
  assert(threw, "null prompt throws");

  console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
  process.exit(failures ? 1 : 0);
})();
