/* Test for the API-error → user-message seam.

   The Edge Functions (api/try-on.js) return a SAFE coded
   error — service_unavailable / rate_limited / failed — and app.js's
   codedErrorMessage() turns that code into a localised string. That mapping was
   buried in app.js (untestable: app.js can't load headless). It now lives in
   CONFIG.errorMessageKey() (code → i18n key), so app.js is a thin delegator:

     function codedErrorMessage(body) {
       const key = CONFIG.errorMessageKey(body && body.code);
       return key ? t(key) : null;
     }

   This pins both halves of the contract: (1) the code→key mapping, and (2) that
   every mapped key actually resolves to real DE *and* EN copy — so a user never
   sees a raw key. i18n.js runs apply() at load, so we shim a minimal DOM. */
const path = require("path");

global.window = global.window || {};
global.document = {
  readyState: "complete", querySelectorAll: () => [],
  documentElement: { setAttribute() {} }, addEventListener() {}, title: "",
};

const CONFIG = require(path.join(__dirname, "..", "js", "config.js"));
const I18N = require(path.join(__dirname, "..", "js", "i18n.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

console.log("\n— CONFIG.errorMessageKey maps each coded error to its i18n key —");
assert(CONFIG.errorMessageKey("service_unavailable") === "err.service_unavailable", "service_unavailable → err.service_unavailable");
assert(CONFIG.errorMessageKey("rate_limited") === "err.rate_limited", "rate_limited → err.rate_limited");
assert(CONFIG.errorMessageKey("failed") === "err.failed", "failed → err.failed");

console.log("\n— unknown / missing codes return null (caller shows a raw-reason fallback) —");
assert(CONFIG.errorMessageKey("nope") === null, "unknown code → null");
assert(CONFIG.errorMessageKey(undefined) === null, "undefined → null");
assert(CONFIG.errorMessageKey(null) === null, "null → null");
assert(CONFIG.errorMessageKey("") === null, "empty string → null");

console.log("\n— inherited Object keys never accidentally map (hasOwnProperty guard) —");
assert(CONFIG.errorMessageKey("toString") === null, "'toString' → null (not Object.prototype.toString)");
assert(CONFIG.errorMessageKey("hasOwnProperty") === null, "'hasOwnProperty' → null");
assert(CONFIG.errorMessageKey("constructor") === null, "'constructor' → null");

console.log("\n— end-to-end: every mapped code resolves to real DE *and* EN copy —");
const de = I18N.dict.de, en = I18N.dict.en;
Object.entries(CONFIG.ERROR_CODE_KEYS).forEach(([code, key]) => {
  assert(typeof de[key] === "string" && de[key].length > 0, `${code} → '${key}' has German copy`);
  assert(typeof en[key] === "string" && en[key].length > 0, `${code} → '${key}' has English copy`);
  // The whole point: the user must never see the raw key as the message.
  assert(de[key] !== key && en[key] !== key, `${code}: resolved message is real copy, not the raw key`);
});

console.log("\n— replays app.js's codedErrorMessage() exactly (code → localised string) —");
// Mirror of the (now one-line) app.js helper.
const codedErrorMessage = (body) => {
  const key = CONFIG.errorMessageKey(body && body.code);
  return key ? I18N.t(key) : null;
};
assert(codedErrorMessage({ code: "rate_limited" }) === I18N.t("err.rate_limited"), "a coded body → the localised rate-limit message");
assert(codedErrorMessage({ error: "raw upstream blah" }) === null, "a body with no code → null (app.js then shows the raw reason)");
assert(codedErrorMessage(null) === null, "a null body → null, no throw");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
