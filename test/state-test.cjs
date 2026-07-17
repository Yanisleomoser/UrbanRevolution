/* Headless logic test for state-manager.js (no DOM).
   StateManager is the single source of truth — every design change flows
   through set(), and the 3D modules + spec sheet rebuild off the events it
   emits. This pins the guarantees they rely on: validation at the gate, the
   exact change events, no-op suppression, history cap, and listener
   isolation. It reads a global `CONFIG` for validation, so we set it first. */
const path = require("path");

const CONFIG = require(path.join(__dirname, "..", "js", "config.js"));
global.CONFIG = CONFIG;
const S = require(path.join(__dirname, "..", "js", "state-manager.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
function throws(fn, msg) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, msg);
}

console.log("\n— get / set happy path —");
S.set("currentType", "hoodie");
assert(S.get("currentType") === "hoodie", "set then get returns the new value");
S.set("currentFit", "0.3");
assert(S.get("currentFit") === 0.3, "currentFit parses a numeric string to a float");
S.set("currentColor", "#FFFFFF");
assert(S.get("currentColor") === "#FFFFFF", "valid hex colour is accepted");

console.log("\n— validation at the gate (invalid input must throw) —");
throws(() => S.set("currentColor", "rot"), "named colour throws");
throws(() => S.set("currentFit", 5), "fit > 1 throws");
throws(() => S.set("currentFit", -1), "fit < 0 throws");
throws(() => S.set("currentType", "cape"), "unknown garment type throws");
throws(() => S.set("currentMaterial", "kevlar"), "unknown material throws");
throws(() => S.set("nope", 1), "unknown state key throws on set");
throws(() => S.get("nope"), "unknown state key throws on get");
throws(() => S.set("__proto__", { polluted: true }), "__proto__ throws on set (not an own state key)");
throws(() => S.set("constructor", {}), "constructor throws on set (not an own state key)");
throws(() => S.get("toString"), "toString throws on get (inherited, not an own state key)");

console.log("\n— change events —");
let typeChange = 0, stateChange = 0, lastDetail = null;
const off1 = S.subscribe("currentType:change", (d) => { typeChange++; lastDetail = d; });
const off2 = S.subscribe("state:change", () => { stateChange++; });
S.set("currentType", "jacket");
assert(typeChange === 1 && stateChange === 1, "set fires both ${key}:change and state:change once");
assert(lastDetail.oldValue === "hoodie" && lastDetail.newValue === "jacket", "event detail carries old + new value");
S.set("currentType", "jacket"); // same value
assert(typeChange === 1, "setting the same value is a no-op (no event)");
off1(); off2();
S.set("currentType", "shirt");
assert(typeChange === 1, "unsubscribe stops further notifications");

console.log("\n— listener error isolation —");
let secondRan = false;
const offA = S.subscribe("currentColor:change", () => { throw new Error("boom"); });
const offB = S.subscribe("currentColor:change", () => { secondRan = true; });
S.set("currentColor", "#1a1a1a");
assert(secondRan, "a throwing listener does not prevent the others from running");
offA(); offB();

console.log("\n— reset —");
let resetFired = false;
const offR = S.subscribe("state:reset", () => { resetFired = true; });
S.reset();
assert(resetFired, "reset() emits state:reset");
assert(S.get("currentType") === "tshirt" && S.get("currentFit") === 0.5, "reset() restores defaults");
offR();

console.log("\n— history cap (50) —");
for (let i = 1; i <= 60; i++) S.set("currentFit", i / 100);
const hist = S.getHistory();
assert(hist.length === 50, "history is capped at 50 entries (FIFO)");
assert(hist[hist.length - 1].key === "currentFit", "newest history entry is the last write");

console.log("\n— destroy —");
S.destroy();
assert(S.getHistory().length === 0, "destroy() clears the history");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
