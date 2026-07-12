/* Behavioural test for I18N.t() — the runtime translator (js/i18n.js).

   The existing i18n-test.cjs proves DE/EN key PARITY; this one proves the t()
   FUNCTION itself: {placeholder} interpolation, missing-var passthrough, the
   raw-key fallback for unknown keys, array passthrough (notes.* tables), and a
   setLang/getLang language switch. These power every dynamic string (toasts,
   spec sheet, suggestions) — a regression here ships silently.

   i18n.js runs apply() (a DOM walk) at load and calls setLang on switch, so we
   shim a minimal document/window/localStorage before requiring it — same
   pattern as i18n-test.cjs, plus the bits setLang touches. */
const path = require("path");

global.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
// Boot deterministisch auf DE pinnen: seit der Tier-1-Sprachauflösung zählt
// auch navigator.language, und Node's globaler navigator meldet "en-US" —
// eine gespeicherte Wahl schlägt ihn (genau das prüft die erste Assertion).
const store = { urev_lang: "de" };
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
global.window = { dispatchEvent: () => {}, addEventListener: () => {} };
global.document = {
  readyState: "complete",
  querySelectorAll: () => [],
  documentElement: { setAttribute() {} },
  addEventListener() {},
  title: "",
};

const I18N = require(path.join(__dirname, "..", "js", "i18n.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

console.log("\n— default language —");
assert(I18N.getLang() === "de", "saved choice (de) wins at boot — even over navigator en-US");

console.log("\n— resolveLang: ?lang= > gespeichert > navigator > de —");
{
  const R = I18N.resolveLang;
  assert(R({}) === "de", "no signals → de (brand default)");
  assert(R({ navLangs: ["en-US", "de-DE"] }) === "en", "navigator en-US → en");
  assert(R({ navLangs: ["fr-FR", "it-CH"] }) === "de", "unsupported navigator languages → de");
  assert(R({ saved: "en", navLangs: ["de-DE"] }) === "en", "saved choice beats navigator");
  assert(R({ param: "de", saved: "en" }) === "de", "?lang= beats the saved choice");
  assert(R({ param: "EN" }) === "en", "?lang= is case-insensitive");
  assert(R({ param: "en-GB" }) === "en", "?lang= regional tag normalises to its base language");
  assert(R({ param: "xx", saved: "en" }) === "en", "invalid ?lang= falls through to saved");
}

console.log("\n— resolveLang: the /en path is authoritative (highest priority) —");
{
  const R = I18N.resolveLang;
  assert(R({ path: "/en/" }) === "en", "/en/ → en");
  assert(R({ path: "/en" }) === "en", "/en (no trailing slash) → en");
  assert(R({ path: "/en/", saved: "de" }) === "en", "/en/ beats a stale saved 'de' (never clobbers the prerendered page)");
  assert(R({ path: "/en/", param: "de", saved: "de", navLangs: ["de-DE"] }) === "en", "/en/ outranks every other signal");
  assert(R({ path: "/", saved: "en" }) === "en", "the root path falls through to the other signals (saved)");
  assert(R({ path: "/", navLangs: ["de-DE"] }) === "de", "root + DE browser → de (root unchanged)");
  assert(R({ path: "/enterprise" }) === "de", "/enterprise is NOT matched as /en (no startsWith false-positive)");
  assert(R({ path: "/impressum.html", param: "en" }) === "en", "a non-en path still lets ?lang= decide");
}

console.log("\n— langPath: each language's canonical URL —");
{
  assert(I18N.langPath("en") === "/en/", "en → /en/");
  assert(I18N.langPath("de") === "/", "de → /");
  assert(I18N.langPath("xx") === "/", "unknown language → root (safe default)");
}

console.log("\n— {placeholder} interpolation —");
// 'engine.evolved' = "Version {v}" (de). Pick a couple of real keyed strings.
assert(I18N.t("engine.evolved", { v: 3 }) === "Version 3", "single {v} token is substituted");
const limitMsg = I18N.t("vto.hint_limit", { limit: 5 });
assert(limitMsg.includes("5") && !limitMsg.includes("{limit}"), "every {limit} occurrence is filled (no leftover token)");

console.log("\n— missing / extra vars are handled gracefully —");
assert(I18N.t("engine.evolved", {}) === "Version {v}", "a missing var leaves its token intact (no 'undefined')");
assert(I18N.t("engine.evolved", { v: 0 }) === "Version 0", "a falsy-but-present var (0) is still substituted");
assert(I18N.t("engine.evolved", { v: 2, unused: "x" }) === "Version 2", "extra vars are ignored");
assert(I18N.t("engine.evolved") === "Version {v}", "no vars arg → raw template returned, no throw");

console.log("\n— unknown key falls back to the raw key (never blank) —");
assert(I18N.t("this.key.does.not.exist") === "this.key.does.not.exist", "unknown key → the key itself");
assert(I18N.t("nope.key", { v: 1 }) === "nope.key", "unknown key with vars still → the key");

console.log("\n— array-valued keys (notes.*) pass through as arrays —");
const notes = I18N.t("notes.tshirt");
assert(Array.isArray(notes) && notes.length > 0, "notes.tshirt resolves to a non-empty array");

console.log("\n— setLang switches the active table; getLang reflects it —");
I18N.setLang("en");
assert(I18N.getLang() === "en", "setLang('en') switches the active language");
assert(store.urev_lang === "en", "the choice is persisted to localStorage");
assert(I18N.t("engine.evolved", { v: 4 }).includes("4"), "interpolation still works after a language switch");
// EN and DE copy for the same key should differ for at least one spot-check key.
I18N.setLang("de");
const deTitle = I18N.t("head.title");
I18N.setLang("en");
const enTitle = I18N.t("head.title");
assert(typeof deTitle === "string" && typeof enTitle === "string", "head.title resolves in both languages");
assert(I18N.getLang() === "en", "language remains 'en' after the second switch");

console.log("\n— unsupported / repeat language is a no-op —");
I18N.setLang("fr");
assert(I18N.getLang() === "en", "an unsupported language is ignored");
I18N.setLang("en");
assert(I18N.getLang() === "en", "setting the current language again is a harmless no-op");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
