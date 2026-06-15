/* Input-validation / sanitisation test for the Upstash-backed Edge Functions
   (no network, no Redis). These functions guard real invariants that nothing
   exercised before:
     • waitlist.js — the DSGVO-load-bearing consent gate + email normalisation.
     • gallery.js  — the URL-safe-base64 DNA filter + field clamping (injection
                     bound on attacker-supplied share strings).
     • track.js    — the event whitelist + node-id sanitisation (only vetted
                     strings ever become Redis keys).
   The handlers keep their behaviour; these pure helpers are exported purely so
   they can be unit-tested here (same convention as try-on.js's upstreamError).
   Uses the global `Response` indirectly only via the modules; nothing here
   needs it. Node 18+ ESM. */
import { normalizeEmail, validateSignup } from "../api/waitlist.js";
import { validateDna, clampField, parseItems } from "../api/gallery.js";
import { buildCommands, sanitiseId, toObj, ALLOWED } from "../api/track.js";
import { validateInput as validateDesignInput, extractDesign } from "../api/generate-design.js";
import { validateRequest as validateGenImage } from "../api/gen-image.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("\n— waitlist.normalizeEmail —");
assert(normalizeEmail("  Foo@Bar.COM ") === "foo@bar.com", "trims + lowercases");
assert(normalizeEmail(123) === "", "non-string → ''");
assert(normalizeEmail(null) === "", "null → ''");

console.log("\n— waitlist.validateSignup (consent gate) —");
{
  const ok = validateSignup({ email: "  User@Example.com ", consent: true });
  assert(ok.ok === true && ok.email === "user@example.com", "valid + consent → ok, normalised email");

  const noConsent = validateSignup({ email: "user@example.com", consent: false });
  assert(noConsent.ok === false && noConsent.code === "consent_required", "consent:false → consent_required");

  const missingConsent = validateSignup({ email: "user@example.com" });
  assert(missingConsent.code === "consent_required", "missing consent → consent_required");

  const truthyConsent = validateSignup({ email: "user@example.com", consent: "yes" });
  assert(truthyConsent.code === "consent_required", "consent must be strictly true (truthy 'yes' rejected)");

  assert(validateSignup({ email: "", consent: true }).code === "invalid_email", "empty email → invalid_email");
  assert(validateSignup({ email: "nope", consent: true }).code === "invalid_email", "no '@' → invalid_email");
  assert(validateSignup({ email: "a@b", consent: true }).code === "invalid_email", "no TLD dot → invalid_email");
  assert(
    validateSignup({ email: "a@" + "x".repeat(260) + ".com", consent: true }).code === "invalid_email",
    "over 254 chars → invalid_email",
  );
  // Email is checked before consent: a bad email with no consent still reports the email problem.
  assert(validateSignup({ email: "bad" }).code === "invalid_email", "email checked before consent");
  // Must not throw on a null/garbage payload.
  let threw = false;
  try { assert(validateSignup(null).code === "invalid_email", "null payload → invalid_email, no throw"); }
  catch { threw = true; }
  assert(!threw, "validateSignup(null) does not throw");
}

console.log("\n— gallery.validateDna (URL-safe base64 filter) —");
assert(validateDna("AbC0-_=%.") === "AbC0-_=%.", "URL-safe base64 alphabet passes through");
assert(validateDna("  AbC123  ") === "AbC123", "trims surrounding whitespace");
assert(validateDna("") === null, "empty → null");
assert(validateDna("   ") === null, "whitespace-only → null");
assert(validateDna(42) === null, "non-string → null");
assert(validateDna("has space") === null, "space (illegal char) → null");
assert(validateDna("<script>") === null, "angle brackets (injection) → null");
assert(validateDna("a/b+c") === null, "raw base64 '+'/'/' rejected (must be URL-safe)");
assert(validateDna("x".repeat(4001)) === null, "over 4000 chars → null");
assert(typeof validateDna("x".repeat(4000)) === "string", "exactly 4000 chars allowed");

console.log("\n— gallery.clampField —");
assert(clampField("hello", 48) === "hello", "short string passes through");
assert(clampField("x".repeat(60), 48).length === 48, "clamps to max length");
assert(clampField("  trim me  ", 48) === "trim me", "trims after slicing");
assert(clampField(undefined, 48) === "", "non-string → ''");

console.log("\n— gallery.parseItems —");
assert(eq(parseItems(['{"d":"abc"}', '{"d":"def"}']), [{ d: "abc" }, { d: "def" }]), "parses valid JSON rows");
assert(eq(parseItems(['{"d":"ok"}', "not json", "{bad"]), [{ d: "ok" }]), "drops corrupt rows");
assert(eq(parseItems(null), []), "null input → []");
assert(eq(parseItems(undefined), []), "undefined input → []");

console.log("\n— track.sanitiseId —");
assert(sanitiseId("node_123-abc") === "node_123-abc", "keeps [a-zA-Z0-9_-]");
assert(sanitiseId("a b/c<d>") === "abcd", "strips illegal chars");
assert(sanitiseId("x".repeat(60)).length === 48, "caps at 48 chars");
assert(sanitiseId(99) === "", "non-string → ''");

console.log("\n— track.buildCommands (event whitelist) —");
{
  assert(eq(buildCommands({ event: "nope" }), []), "non-whitelisted event → no commands");
  assert(eq(buildCommands({ event: 123 }), []), "non-string event → no commands");
  assert(eq(buildCommands(null), []), "null payload → no commands, no throw");

  const gen = buildCommands({ event: "generate" });
  assert(gen.length === 1 && gen[0][0] === "HINCRBY" && gen[0][2] === "generate", "allowed event → one events counter");

  const shown = buildCommands({ event: "node_shown", id: "mood_calm_bold" });
  assert(shown.length === 2, "node_shown + id → events + node counter");
  assert(shown[1][2] === "mood_calm_bold:shown", "node counter key uses the :shown suffix");

  const dirty = buildCommands({ event: "node_choice", id: "id with <bad> chars" });
  assert(dirty.length === 2 && dirty[1][2] === "idwithbadchars:choice", "node id is sanitised into the key");

  const noSuffix = buildCommands({ event: "node_back", id: "whatever" });
  assert(noSuffix.length === 1, "allowed event without a node suffix → only the events counter");

  const noId = buildCommands({ event: "node_shown" });
  assert(noId.length === 1, "node_shown without id → only the events counter");
}

console.log("\n— track.toObj (Upstash flat-array HGETALL) —");
assert(eq(toObj(["a", "1", "b", "2"]), { a: 1, b: 2 }), "flat [k,v,k,v] array → numeric object");
assert(eq(toObj({ a: "3", b: "4" }), { a: 3, b: 4 }), "object form → numeric values");
assert(eq(toObj(null), {}), "null → {}");
assert(eq(toObj("nonsense"), {}), "string → {}");

console.log("\n— track.ALLOWED whitelist —");
assert(ALLOWED.has("generate_ok") && ALLOWED.has("abandon"), "expected events are whitelisted");
assert(!ALLOWED.has("__proto__") && !ALLOWED.has(""), "unexpected keys are not whitelisted");

console.log("\n— generate-design.validateInput (prompt + garment-type gate) —");
{
  const ok = validateDesignInput({ prompt: "a red linen jacket", type: "jacket" });
  assert(ok.ok === true && ok.prompt === "a red linen jacket" && ok.garmentType === "jacket", "valid prompt + type → ok");
  assert(validateDesignInput({ prompt: "x" }).garmentType === "tshirt", "missing type defaults to tshirt");
  assert(validateDesignInput({}).ok === false && validateDesignInput({}).status === 400, "missing prompt → 400");
  assert(validateDesignInput({ prompt: 5 }).ok === false, "non-string prompt → rejected");
  assert(validateDesignInput({ prompt: "x".repeat(2001) }).message.includes("2000"), "over-long prompt → 2000-char message");
  assert(validateDesignInput({ prompt: "x", type: "cape" }).message.includes("Invalid garment type"), "unknown garment type → rejected");
  assert(validateDesignInput(null).ok === false, "null payload → rejected, no throw");
}

console.log("\n— generate-design.extractDesign (pull JSON out of the model reply) —");
assert(eq(extractDesign('prose before {"name":"X","fit":0.3} prose after'), { name: "X", fit: 0.3 }), "extracts the JSON object from surrounding prose");
assert(extractDesign("no json at all") === null, "no braces → null");
assert(extractDesign("{ not valid json }") === null, "malformed JSON → null (no throw)");
assert(extractDesign(null) === null, "null text → null");

console.log("\n— gen-image.validateRequest (auth gate ordering + prompt rules) —");
{
  const env = { gateKey: "secret", apiKey: "tok" };
  assert(validateGenImage({ key: "secret", prompt: " a mood shot " }, env).ok === true, "correct key + prompt → ok");
  assert(validateGenImage({ key: "secret", prompt: " a mood shot " }, env).prompt === "a mood shot", "prompt is trimmed");
  // SECURITY: the gate is checked BEFORE the token state, so a wrong key gets
  // the same 'forbidden' whether or not Replicate is configured (no oracle).
  assert(validateGenImage({ key: "nope" }, env).code === "forbidden", "wrong key → forbidden");
  assert(validateGenImage({ key: "nope" }, { gateKey: "secret", apiKey: undefined }).code === "forbidden",
    "wrong key with NO token still → forbidden (never reveals config state)");
  assert(validateGenImage({ key: "secret" }, { gateKey: undefined, apiKey: "tok" }).code === "forbidden", "no gate configured → forbidden");
  assert(validateGenImage({ key: 123 }, env).code === "forbidden", "non-string key → forbidden");
  assert(validateGenImage({ key: "secret", prompt: "x" }, { gateKey: "secret" }).code === "service_unavailable", "authorised but no token → service_unavailable");
  assert(validateGenImage({ key: "secret", prompt: "   " }, env).code === "invalid_prompt", "empty prompt → invalid_prompt");
  assert(validateGenImage({ key: "secret", prompt: "x".repeat(1501) }, env).code === "invalid_prompt", "oversized prompt → invalid_prompt");
  assert(validateGenImage({ key: "secret", prompt: "x", aspect: "16:9" }, env).aspect === "16:9", "valid aspect ratio is kept");
  assert(validateGenImage({ key: "secret", prompt: "x", aspect: "5:5" }, env).aspect === "4:5", "unknown aspect ratio → 4:5 default");
}

if (failures > 0) {
  console.log(`\n✗ ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\n✓ all assertions passed");
