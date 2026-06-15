/* Headless test for the Design-Engine client telemetry (js/design-engine/telemetry.js).

   DesignTelemetry emits aggregate-only journey signals — no PII — and must:
     • respect Do-Not-Track (navigator.doNotTrack / msDoNotTrack / window.doNotTrack),
     • no-op on an empty event,
     • mirror to Vercel Web Analytics (window.va) AND a best-effort /api/track beacon,
     • never throw into the UI.

   Node ships a built-in read-only `navigator`, so `global.navigator = …` does
   NOT take effect — we override it with Object.defineProperty(globalThis, …). */
const path = require("path");
const Telemetry = require(path.join(__dirname, "..", "js", "design-engine", "telemetry.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
function setNavigator(obj) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: obj });
}

console.log("\n— enabled(): Do-Not-Track is respected across all signals —");
setNavigator({});
delete global.window;
assert(Telemetry.enabled() === true, "no DNT signal → enabled");
setNavigator({ doNotTrack: "1" });
assert(Telemetry.enabled() === false, "navigator.doNotTrack '1' → disabled");
setNavigator({ doNotTrack: "yes" });
assert(Telemetry.enabled() === false, "navigator.doNotTrack 'yes' → disabled");
setNavigator({ msDoNotTrack: "1" });
assert(Telemetry.enabled() === false, "navigator.msDoNotTrack '1' → disabled (legacy IE/Edge)");
setNavigator({ doNotTrack: "0" });
assert(Telemetry.enabled() === true, "doNotTrack '0' → enabled (explicit opt-in to tracking)");
setNavigator({});
global.window = { doNotTrack: "1" };
assert(Telemetry.enabled() === false, "window.doNotTrack '1' → disabled");
delete global.window;

console.log("\n— track(): mirrors to window.va AND beacons /api/track when enabled —");
setNavigator({
  sendBeacon: (url, blob) => { beacons.push({ url, type: blob && blob.type, body: blob && blob._body }); return true; },
});
const va = [];
const beacons = [];
global.window = { va: (kind, payload) => va.push({ kind, payload }) };
global.Blob = class { constructor(parts, opts) { this._body = String(parts[0]); this.type = opts && opts.type; } };

Telemetry.track("node_shown", { node: "intent_energy" });
assert(va.length === 1, "one Vercel Analytics event emitted");
assert(va[0].kind === "event" && va[0].payload.name === "de_node_shown", "event is namespaced 'de_<event>'");
assert(va[0].payload.data.node === "intent_energy", "props are forwarded as event data");
assert(beacons.length === 1 && beacons[0].url === "/api/track", "one beacon POSTed to /api/track");
assert(beacons[0].type === "application/json", "beacon body is application/json");
{
  const sent = JSON.parse(beacons[0].body);
  assert(sent.event === "node_shown" && sent.node === "intent_energy", "beacon body carries the event + props");
}

console.log("\n— track(): guards (no event, DNT) are silent no-ops —");
va.length = 0; beacons.length = 0;
Telemetry.track("", { node: "x" });
assert(va.length === 0 && beacons.length === 0, "empty event → no analytics, no beacon");
Telemetry.track(undefined);
assert(va.length === 0 && beacons.length === 0, "undefined event → no-op");
setNavigator({ doNotTrack: "1", sendBeacon: () => { beacons.push({}); return true; } });
Telemetry.track("node_shown", {});
assert(va.length === 0 && beacons.length === 0, "DNT on → track() is a no-op");

console.log("\n— track(): never throws, even if window.va blows up —");
setNavigator({}); // DNT off
global.window = { va: () => { throw new Error("analytics exploded"); } };
delete global.Blob;
let threw = false;
try { Telemetry.track("node_shown", {}); } catch { threw = true; }
assert(!threw, "a throwing analytics sink is swallowed (UI never blocked)");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
