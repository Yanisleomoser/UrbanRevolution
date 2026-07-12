/* Headless test for js/focus-trap.js — window.FocusTrap, the keyboard focus
   containment for modal dialogs. This is the one accessibility guarantee the
   axe gate can't verify (Tab must cycle *inside* an open dialog and never
   escape to the inert-but-focusable page behind it), and it was previously at
   0 % coverage. FocusTrap touches only a handful of DOM APIs, so a small mock
   drives it fully without a browser: we fire real keydown events through the
   listener it registers and assert where focus lands. */
const path = require("path");

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

// A focusable element mock. offsetWidth > 0 so focusables() treats it as
// visible (unless we hide it); focus() moves document.activeElement here.
function makeEl(id, { visible = true } = {}) {
  return {
    id,
    offsetWidth: visible ? 10 : 0,
    offsetHeight: visible ? 10 : 0,
    focus() { global.document.activeElement = this; },
  };
}

// A container mock: an ordered list of focusable descendants, a tiny event
// system (add/removeEventListener + a test-only dispatch), and the two reads
// FocusTrap makes — querySelectorAll (returns the descendants; a real browser
// pre-filters by the focusable selector, which our list already represents)
// and contains().
function makeContainer(items) {
  const handlers = {};
  return {
    _items: items,
    querySelectorAll() { return this._items.slice(); },
    contains(el) { return el === this || this._items.includes(el); },
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    removeEventListener(type, fn) {
      handlers[type] = (handlers[type] || []).filter((h) => h !== fn);
    },
    // Test helper: fire a keydown and report whether preventDefault fired.
    fireTab(shiftKey = false, key = "Tab") {
      let prevented = false;
      const evt = { key, shiftKey, preventDefault() { prevented = true; } };
      (handlers.keydown || []).forEach((h) => h(evt));
      return prevented;
    },
  };
}

global.document = { activeElement: null };
const FocusTrap = require(path.join(__dirname, "..", "js", "focus-trap.js"));

console.log("\n— activate(null) is a safe no-op —");
{
  let threw = false;
  let release;
  try { release = FocusTrap.activate(null); release(); } catch (_e) { threw = true; }
  assert(!threw && typeof release === "function", "null container → returns a no-op release, never throws");
}

console.log("\n— Tab wraps forward at the last element —");
{
  const a = makeEl("a"), b = makeEl("b"), c = makeEl("c");
  const box = makeContainer([a, b, c]);
  FocusTrap.activate(box);
  global.document.activeElement = c;              // focus on the last item
  const prevented = box.fireTab(false);
  assert(prevented, "Tab at the last item calls preventDefault");
  assert(global.document.activeElement === a, "…and wraps focus to the first item");
}

console.log("\n— Shift+Tab wraps backward at the first element —");
{
  const a = makeEl("a"), b = makeEl("b"), c = makeEl("c");
  const box = makeContainer([a, b, c]);
  FocusTrap.activate(box);
  global.document.activeElement = a;              // focus on the first item
  const prevented = box.fireTab(true);
  assert(prevented, "Shift+Tab at the first item calls preventDefault");
  assert(global.document.activeElement === c, "…and wraps focus to the last item");
}

console.log("\n— Tab in the middle is left to the browser —");
{
  const a = makeEl("a"), b = makeEl("b"), c = makeEl("c");
  const box = makeContainer([a, b, c]);
  FocusTrap.activate(box);
  global.document.activeElement = b;
  const prevented = box.fireTab(false);
  assert(!prevented, "Tab away from the edges does NOT preventDefault (natural focus order)");
  assert(global.document.activeElement === b, "…and focus is unchanged");
}

console.log("\n— non-Tab keys are ignored —");
{
  const a = makeEl("a"), b = makeEl("b");
  const box = makeContainer([a, b]);
  FocusTrap.activate(box);
  global.document.activeElement = b;
  const prevented = box.fireTab(false, "Enter");
  assert(!prevented && global.document.activeElement === b, "Enter is not intercepted");
}

console.log("\n— focus that escaped the container is pulled back in —");
{
  const a = makeEl("a"), b = makeEl("b"), c = makeEl("c");
  const outside = makeEl("outside");
  const box = makeContainer([a, b, c]);
  FocusTrap.activate(box);

  global.document.activeElement = outside;        // somehow outside the dialog
  assert(box.fireTab(false), "Tab from outside preventDefaults");
  assert(global.document.activeElement === a, "…and pulls focus to the first item");

  global.document.activeElement = outside;
  assert(box.fireTab(true), "Shift+Tab from outside preventDefaults");
  assert(global.document.activeElement === c, "…and pulls focus to the last item");
}

console.log("\n— release() detaches the trap —");
{
  const a = makeEl("a"), b = makeEl("b");
  const box = makeContainer([a, b]);
  const release = FocusTrap.activate(box);
  release();
  global.document.activeElement = b;
  const prevented = box.fireTab(false);           // would have wrapped while active
  assert(!prevented && global.document.activeElement === b, "after release, Tab is no longer intercepted");
}

console.log("\n— an empty container never throws —");
{
  const box = makeContainer([]);
  FocusTrap.activate(box);
  global.document.activeElement = null;
  let threw = false;
  try { assert(box.fireTab(false) === false, "Tab with no focusables is a no-op"); }
  catch (_e) { threw = true; }
  assert(!threw, "…and never throws");
}

console.log("\n— focusables() hides invisible nodes but keeps the active one —");
{
  const visible = makeEl("v");
  const hidden = makeEl("h", { visible: false });
  const hiddenActive = makeEl("ha", { visible: false });
  const box = makeContainer([visible, hidden, hiddenActive]);
  global.document.activeElement = hiddenActive;   // active even though display:none-ish
  const result = FocusTrap.focusables(box);
  assert(result.includes(visible), "a visible element is focusable");
  assert(!result.includes(hidden), "a zero-size, inactive element is skipped");
  assert(result.includes(hiddenActive), "the currently-focused element is kept even when zero-size");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
