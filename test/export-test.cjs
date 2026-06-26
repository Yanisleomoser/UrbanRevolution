/* Headless logic test for export.js (no DOM download, no browser).
   Two concerns:
     1. SECURITY — renderPrintableHTML interpolates AI/user-derived strings
        (name, description, original prompt, tags, construction notes) into a
        downloadable HTML document. They MUST be HTML-escaped or a crafted
        prompt/AI response is stored XSS in the exported spec sheet.
     2. buildSpecData's length-factor fabric math (cropped/regular/long).
   export.js reads window.I18N / window.Measurements / window.CONFIG and bare
   CONFIG / Measurements globals, so we shim them before requiring it. The
   i18n lookups fall back to the raw key when window.I18N is absent — fine,
   we only assert on the escaping and the numbers. */
const path = require("path");

const CONFIG = require(path.join(__dirname, "..", "js", "config.js"));
global.CONFIG = CONFIG;
global.window = { CONFIG }; // export.js: `window.CONFIG && CONFIG...`
const Measurements = require(path.join(__dirname, "..", "js", "measurements.js"));
global.Measurements = Measurements;
const Export = require(path.join(__dirname, "..", "js", "export.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

console.log("\n— renderPrintableHTML escapes untrusted strings (XSS) —");
const XSS = "<script>alert('xss')</script>";
const IMG = '"><img src=x onerror=alert(1)>';
const spec = {
  metadata: { designId: "UR-TEST-1", generatedAt: "2026-01-01T00:00:00.000Z", version: "1.0.0" },
  design: {
    name: XSS,
    description: IMG,
    originalPrompt: "<b>prompt</b>",
    tags: ["<script>tag</script>", "ok"],
  },
  specifications: {
    garmentType: "tshirt", color: "#1a1a1a", material: "cotton",
    fit: "Regular", length: "Regulär", print: "", size: "M",
  },
  measurements: { chest: 96, height: 175, unit: "cm" },
  production: {
    estimatedFabric: "2.02 m²",
    estimatedSeamLength: "352 cm",
    constructionNotes: ["<i>note</i>", "plain note"],
    estimatedProductionDays: 14,
    estimatedPriceRange: { min: 145, max: 220, currency: "CHF" },
  },
};
const html = Export.renderPrintableHTML(spec);

assert(!html.includes(XSS), "raw <script> from design.name is NOT present");
assert(html.includes("&lt;script&gt;alert"), "design.name is HTML-escaped");
assert(!html.includes("<img src=x onerror"), "raw <img onerror> from description is NOT present");
assert(html.includes("&lt;img src=x onerror"), "description is HTML-escaped");
assert(!html.includes("<b>prompt</b>"), "raw originalPrompt markup is NOT present");
assert(html.includes("&lt;b&gt;prompt&lt;/b&gt;"), "originalPrompt is HTML-escaped");
assert(!html.includes("<script>tag</script>"), "raw tag markup is NOT present");
assert(html.includes("&lt;i&gt;note&lt;/i&gt;"), "construction note is HTML-escaped");

console.log("\n— buildSpecData length-factor fabric math —");
const design = {
  designId: "UR-TEST-2", generatedAt: "2026-01-01T00:00:00.000Z",
  name: "Test", description: "d", originalPrompt: "p", tags: [],
  color: "#1a1a1a", material: "cotton", fit: 0.5,
  constructionNotes: [],
};
const M = CONFIG.MEASUREMENT_PRESETS.M; // chest 96, height 175 → tshirt 2.02 m²
const regular = Export.buildSpecData({ ...design, length: "regular" }, M, "tshirt");
const long = Export.buildSpecData({ ...design, length: "long" }, M, "tshirt");
const cropped = Export.buildSpecData({ ...design, length: "cropped" }, M, "tshirt");

assert(regular.production.estimatedFabric === "2.02 m²", "regular length → base fabric estimate");
assert(long.production.estimatedFabric === "2.46 m²", "long length scales fabric up (×1.22)");
assert(cropped.production.estimatedFabric === "1.65 m²", "cropped length scales fabric down (×0.82), rounded once from the raw area");
assert(regular.specifications.size === "M", "size derived from chest 96 → M");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
