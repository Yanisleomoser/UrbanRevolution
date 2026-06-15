/* Headless test for the live textile-waste ticker's pure math
   (js/ambient-ticker.js).

   The module self-mounts in the browser (a side effect), but its two pure bits
   are the load-bearing content — the cited figure must read correctly:
     RATE         — 2'918 kg/sec (92 Mio t/year ÷ seconds/year)
     wasteKgAt(ms)— whole-second waste mass since page load (floored, ≥ 0)
     swiss(n)     — Swiss thousands grouping (1234567 → "1'234'567")
   The module now exposes these behind a Node test seam and skips the DOM mount. */
const path = require("path");
const Ticker = require(path.join(__dirname, "..", "js", "ambient-ticker.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

console.log("\n— RATE matches the cited derivation (92e9 kg / seconds-per-year ≈ 2918) —");
assert(Ticker.RATE === 2918, "RATE is 2918 kg/sec");
// Sanity-check the derivation: 2918 is a faithful rounding of 92 Mio t/year
// spread over a year (2917.3 for a 365-day year), so within ~1 kg/sec.
assert(Math.abs(Ticker.RATE - 92e9 / (365 * 24 * 3600)) < 1.5, "RATE is within ~1 kg/sec of the cited 92 Mio t/year figure");

console.log("\n— swiss(): locale-independent Swiss thousands grouping —");
assert(Ticker.swiss(0) === "0", "0 → '0'");
assert(Ticker.swiss(42) === "42", "two digits → unchanged");
assert(Ticker.swiss(2918) === "2'918", "four digits → one separator");
assert(Ticker.swiss(1234567) === "1'234'567", "seven digits → two separators");
assert(Ticker.swiss(1000000) === "1'000'000", "round millions grouped correctly");
assert(Ticker.swiss(100) === "100" && Ticker.swiss(1000) === "1'000", "boundary at four digits");

console.log("\n— wasteKgAt(): floors to whole seconds, never negative —");
assert(Ticker.wasteKgAt(0) === 0, "t=0 → 0 kg");
assert(Ticker.wasteKgAt(1000) === 2918, "1s → one RATE step");
assert(Ticker.wasteKgAt(1999) === 2918, "1.999s → still one step (floored)");
assert(Ticker.wasteKgAt(2000) === 5836, "2s → two steps");
assert(Ticker.wasteKgAt(10000) === 29180, "10s → 10 × RATE");
assert(Ticker.wasteKgAt(-5) === 0, "negative elapsed (clock skew) → 0, never negative");
assert(Ticker.wasteKgAt(3600 * 1000) === 2918 * 3600, "one hour → RATE × 3600");

console.log("\n— composed: the odometer string the UI shows —");
assert(Ticker.swiss(Ticker.wasteKgAt(3600 * 1000)) === "10'504'800", "after 1h the ticker reads 10'504'800");

console.log("\n— monotonic: more elapsed time never shows less waste —");
let ok = true;
let prev = -1;
for (let s = 0; s <= 120; s++) {
  const v = Ticker.wasteKgAt(s * 1000);
  if (v < prev) ok = false;
  prev = v;
}
assert(ok, "wasteKgAt is non-decreasing over the first two minutes");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
