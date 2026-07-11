/* Headless logic test for design-engine/share.js (no DOM, no browser).
   DesignShare encodes a DesignDNA into a URL-safe base64 fragment so a design
   can be shared by link and re-opened straight into Phase F. Two concerns:
     1. ROUNDTRIP — decode(encode(dna)) must deep-equal the original, including
        Unicode (German umlauts/emoji), nested objects and arrays. The URL-safe
        base64 padding dance (+→-, /→_, strip/re-pad =) is a classic off-by-one
        bug source, so we pin it.
     2. FAIL CLOSED — the #dna= fragment is attacker-reachable. decode() of
        garbage / oversized / non-JSON input must return null, never throw.
   share.js uses btoa/atob/unescape/escape (Node 18+ globals) and guards
   location/history with typeof checks, so encode/decode run without a shim;
   read()/buildUrl() are exercised with a minimal location shim. */
const path = require("path");

const DesignShare = require(path.join(__dirname, "..", "js", "design-engine", "share.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
// Structural deep-equal good enough for plain JSON (objects/arrays/primitives).
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

console.log("\n— encode → URL-safe alphabet only —");
{
  const dna = { category: "jacket", fit: 0.4, tags: ["a/b", "c+d"] };
  const enc = DesignShare.encode(dna);
  assert(typeof enc === "string" && enc.length > 0, "encode returns a non-empty string");
  assert(!/[+/=]/.test(enc), "no '+', '/' or '=' in the encoded fragment (URL-safe)");
  assert(/^[A-Za-z0-9\-_]+$/.test(enc), "only [A-Za-z0-9-_] characters");
}

console.log("\n— roundtrip: decode(encode(dna)) deep-equals the original —");
{
  const cases = [
    { label: "flat object", dna: { type: "hoodie", color: "#2A9D8F", fit: 0.5 } },
    { label: "nested + arrays", dna: { a: { b: { c: [1, 2, 3] } }, list: [{ x: 1 }, { y: 2 }] } },
    { label: "German umlauts (DE copy)", dna: { name: "Grün-weißes Trägeroberteil", note: "für Größe M" } },
    { label: "emoji / non-latin", dna: { vibe: "🌊 océan", glyph: "日本語" } },
    { label: "empty object", dna: {} },
    { label: "numbers + booleans + null", dna: { n: 0, neg: -3.14, t: true, f: false, z: null } },
  ];
  for (const { label, dna } of cases) {
    const back = DesignShare.decode(DesignShare.encode(dna));
    assert(deepEqual(back, dna), `roundtrip preserves ${label}`);
  }
}

console.log("\n— decode tolerates pre-existing '=' padding —");
{
  // The gallery DNA_RE permits '=' in a stored DNA, so a non-stripping client
  // can persist a standard-padded fragment. decode() must strip before
  // re-padding (it used to over-pad and return null).
  const dna = { type: "jacket", color: "#64D6C4", fit: 0.7, archetypeWeights: { quietMinimal: 3 } };
  const stripped = DesignShare.encode(dna);            // url-safe, no padding
  const padded = stripped + "==";                       // hand-added over-padding
  assert(deepEqual(DesignShare.decode(padded), dna), "decode ignores extra '=' padding");
  // Standard base64 (with real padding + '+'/'/') must also decode.
  const std = Buffer.from(JSON.stringify(dna), "utf8").toString("base64");
  assert(deepEqual(DesignShare.decode(std), dna), "decode accepts standard padded base64");
}

console.log("\n— decode fails closed (returns null, never throws) —");
{
  const bad = [
    ["not base64 at all", "!!!not-valid!!!"],
    ["valid b64 of non-JSON", DesignShare.encode("plain string").slice(0, 4) + "@@"],
    ["truncated fragment", DesignShare.encode({ a: 1 }).slice(0, 3)],
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["number", 12345],
  ];
  for (const [label, input] of bad) {
    let result, threw = false;
    try { result = DesignShare.decode(input); } catch { threw = true; }
    assert(!threw && result === null, `decode(${label}) → null, no throw`);
  }
}

console.log("\n— decode sanitises hostile colour stops (XSS hardening) —");
{
  // A well-formed share link can still carry hostile VALUES. Colour stops are
  // written unescaped into the SVG (garment-svg.js), so decode() must strip any
  // stop that isn't a strict hex literal — while leaving legitimate hex intact.
  const evil = {
    archetypeWeights: { minimal: 1 },
    color: { scheme: "duo-gradient", stops: ['#000"/></linearGradient></defs></svg><img src=x onerror=alert(1)>', "#64d6c4"] },
  };
  const back = DesignShare.decode(DesignShare.encode(evil));
  assert(back !== null, "decode of a well-formed-but-hostile payload still returns the design");
  assert(Array.isArray(back.color.stops), "color.stops remains an array");
  assert(back.color.stops.every((s) => /^#[0-9a-fA-F]{3,8}$/.test(s)), "every surviving stop is a strict hex literal");
  assert(!back.color.stops.some((s) => s.includes("<")), "no markup-bearing stop survives decode");
  assert(back.color.stops.includes("#64d6c4"), "the legitimate hex stop is preserved");

  // Legitimate designs with valid hex stops must roundtrip untouched.
  const good = { color: { scheme: "duo-gradient", stops: ["#2a9d8f", "#64d6c4"] }, fit: 0.4 };
  assert(deepEqual(DesignShare.decode(DesignShare.encode(good)), good), "valid hex stops roundtrip unchanged");
}

console.log("\n— buildUrl + read roundtrip through a real hash string —");
{
  const dna = { category: "dress", fit: 0.6, tags: ["flowy"] };
  // No location in Node → buildUrl uses "" base, so it starts with "#dna=".
  const url = DesignShare.buildUrl(dna);
  assert(url.startsWith("#" + DesignShare.PARAM + "="), "buildUrl emits a '#dna=' fragment");

  // Shim location so read() can parse the fragment back out.
  const hash = url.slice(url.indexOf("#"));
  global.location = { hash, origin: "https://revolveurban.com", pathname: "/", search: "" };
  assert(deepEqual(DesignShare.read(), dna), "read() decodes the dna out of location.hash");

  // The param may also appear after other fragment params (&dna=…).
  global.location.hash = "#foo=1&" + DesignShare.PARAM + "=" + DesignShare.encode(dna);
  assert(deepEqual(DesignShare.read(), dna), "read() finds dna after a '&' separator");

  // No fragment → null.
  global.location.hash = "#something-else=1";
  assert(DesignShare.read() === null, "read() returns null when no dna fragment present");
  delete global.location;
}

console.log("\n— buildUrl carries the sharer's language (?lang=) —");
{
  const dna = { category: "dress" };
  global.location = { origin: "https://revolveurban.com", pathname: "/", search: "", hash: "" };
  // EN sharer → der Empfänger landet auf EN (?lang=en VOR dem #dna-Fragment).
  global.window = { I18N: { getLang: () => "en" } };
  assert(
    DesignShare.buildUrl(dna).startsWith("https://revolveurban.com/?lang=en#" + DesignShare.PARAM + "="),
    "EN sharer → ?lang=en before the #dna fragment",
  );
  // DE (Default) → saubere URL ohne Query.
  global.window.I18N.getLang = () => "de";
  assert(
    DesignShare.buildUrl(dna).startsWith("https://revolveurban.com/#" + DesignShare.PARAM + "="),
    "DE (default) sharer → clean URL without ?lang",
  );
  // Ohne I18N (z. B. Standalone-Kontext) → wie bisher.
  delete global.window;
  assert(
    DesignShare.buildUrl(dna).startsWith("https://revolveurban.com/#" + DesignShare.PARAM + "="),
    "no I18N → clean URL, no throw",
  );
  delete global.location;
}

console.log("\n— PARAM is the documented key —");
assert(DesignShare.PARAM === "dna", "PARAM === 'dna'");

if (failures > 0) {
  console.log(`\n✗ ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\n✓ all assertions passed");
