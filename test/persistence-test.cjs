/* Headless logic test for the localStorage persistence layer (no browser).
   library.js (saved designs) and preferences.js (usage history → suggestions)
   are pure data wrappers with fiddly rules that nobody clicks through by hand:
   a FIFO cap, in-place dedupe, frequency ranking, prompt de-duplication, and
   corrupt-storage resilience (the promised Safari-private-mode / quota
   degrade-to-empty behaviour). We back them with an in-memory localStorage. */
const path = require("path");

const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};

const Library = require(path.join(__dirname, "..", "js", "library.js"));
const Preferences = require(path.join(__dirname, "..", "js", "preferences.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

console.log("\n— Library: add / get / list —");
Library.clear();
Library.add({ designId: "A", name: "Alpha", type: "hoodie", tags: ["x"] });
assert(Library.count() === 1, "add stores one entry");
assert(Library.get("A").name === "Alpha", "get returns the entry by id");
assert(Library.add({ designId: null }) === null, "add without a designId is rejected (null)");

console.log("\n— Library: dedupe + bring-to-top —");
Library.add({ designId: "B", name: "Beta", type: "shirt" });
Library.add({ designId: "A", name: "Alpha v2", type: "jacket" });
assert(Library.count() === 2, "re-adding an existing id updates in place (no duplicate)");
assert(Library.get("A").name === "Alpha v2", "the entry is updated to the new values");
assert(Library.list()[0].id === "A", "the updated entry is moved to the top");

console.log("\n— Library: FIFO cap at MAX_ENTRIES —");
Library.clear();
for (let i = 0; i <= 20; i++) Library.add({ designId: "D" + i, name: "n" + i });
assert(Library.count() === Library.MAX_ENTRIES, `capped at ${Library.MAX_ENTRIES} entries`);
assert(Library.get("D0") === null, "the oldest entry (D0) was dropped");
assert(Library.get("D20") !== null, "the newest entry (D20) is kept");

console.log("\n— Library: cap re-asserted on update-in-place (not only new adds) —");
Library.clear();
// Seed a pre-bloated store (corruption, or a future lower MAX): over the cap.
const bloated = [];
for (let i = 0; i < Library.MAX_ENTRIES + 5; i++) bloated.push({ id: "P" + i, name: "p" + i });
store.set("urev_library_v1", JSON.stringify({ designs: bloated }));
// Updating an EXISTING id must shrink to the cap too — the trim used to live
// only in the new-entry branch, so an update-only session stayed bloated.
Library.add({ designId: "P0", name: "P0 updated" });
assert(Library.count() === Library.MAX_ENTRIES, `update-in-place re-asserts the ${Library.MAX_ENTRIES} cap`);
assert(Library.get("P0").name === "P0 updated", "the updated entry survives and is brought to the top");

console.log("\n— Library: image setters + remove —");
Library.clear();
Library.add({ designId: "C", name: "Gamma" });
Library.setPreviewImage("C", "https://img/p.jpg");
Library.setVtoImage("C", "https://img/v.jpg");
assert(Library.get("C").previewImageUrl === "https://img/p.jpg", "setPreviewImage persists the URL");
assert(Library.get("C").vtoImageUrl === "https://img/v.jpg", "setVtoImage persists the URL");
Library.remove("C");
assert(Library.get("C") === null, "remove deletes the entry");

console.log("\n— Library: corrupt storage degrades to empty —");
store.set("urev_library_v1", "{ this is not json");
assert(Array.isArray(Library.list()) && Library.list().length === 0, "corrupt JSON → empty list (no throw)");

console.log("\n— Preferences: frequency ranking —");
Preferences.clear();
Preferences.track("type", "hoodie");
Preferences.track("type", "hoodie");
Preferences.track("type", "hoodie");
Preferences.track("type", "tshirt");
Preferences.track("type", "");        // ignored (no value)
Preferences.track("bogus", "x");      // ignored (untracked category)
const top = Preferences.topValues("type");
assert(top[0] === "hoodie" && top[1] === "tshirt", "topValues ranks by frequency, descending");
assert(Preferences.totalDesigns() === 4, "totalDesigns sums all type counts");

console.log("\n— Preferences: prompt history (dedupe, order, caps) —");
Preferences.clear();
Preferences.trackPrompt("a");
Preferences.trackPrompt("b");
Preferences.trackPrompt("a"); // re-surface
assert(JSON.stringify(Preferences.getAll().prompts) === JSON.stringify(["a", "b"]), "re-used prompt jumps back to the front, no duplicate");
Preferences.clear();
for (const p of ["p1", "p2", "p3", "p4", "p5", "p6"]) Preferences.trackPrompt(p);
assert(Preferences.getAll().prompts.length === 5, "prompt history is capped at 5");
Preferences.clear();
Preferences.trackPrompt("z".repeat(250));
assert(Preferences.getAll().prompts[0].length === 200, "long prompts are truncated to 200 chars");

console.log("\n— Preferences: corrupt storage degrades to empty —");
store.set("urev_prefs_v1", "}{ broken");
assert(Preferences.topValues("type").length === 0 && Preferences.totalDesigns() === 0, "corrupt JSON → empty prefs (no throw)");

// Valid JSON but wrong-typed count maps (a string / array where an object is
// expected) used to slip through `|| {}` and yield garbage (totalDesigns
// string-concatenating, topValues over string indices).
store.set("urev_prefs_v1", JSON.stringify({ type: "corrupt", color: ["x"], material: { wool: "3" }, prompts: [] }));
assert(Preferences.topValues("type").length === 0, "string-typed map → no top values (degraded to empty)");
assert(Preferences.topValues("color").length === 0, "array-typed map → no top values");
assert(Preferences.totalDesigns() === 0, "wrong-typed type map → totalDesigns 0, not string-concatenated");
assert(Preferences.topValues("material")[0] === "wool", "string count values still rank (coerced numerically)");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
