/* Error-mapping test for the Replicate proxy Edge Functions (no network).
   The load-bearing privacy/security invariant: upstream Replicate failures
   (402 insufficient credit, 401/403 auth, 429, 5xx) must be mapped to a
   NEUTRAL, coded client error — the raw upstream status/body (which can leak
   billing/credit/account state) must never reach the browser. These helpers
   are exported from the edge functions purely for this test; the runtime only
   calls the default handler. Uses the global `Response` (Node 18+). */
import toHandler, { upstreamError as toUpstream, jsonError as toJsonError } from "../api/try-on.js";
import pvHandler, { upstreamError as pvUpstream } from "../api/preview-design.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

console.log("\n— try-on upstreamError → safe coded client error —");
{
  const { status, body } = await read(toUpstream("try-on", 429, "rate limit hit"));
  assert(status === 503 && body.code === "rate_limited", "429 → 503 rate_limited");
}
{
  // 402 insufficient credit: must NOT leak the billing detail to the client.
  const secret = "insufficient credit: account balance $0.00";
  const { status, body } = await read(toUpstream("try-on", 402, secret));
  assert(status === 503 && body.code === "service_unavailable", "402 → 503 service_unavailable");
  assert(!JSON.stringify(body).includes("credit"), "402 billing detail is NOT leaked to the client");
}
{
  const { status, body } = await read(toUpstream("try-on", 401, "invalid token"));
  assert(status === 503 && body.code === "service_unavailable", "401 auth → 503 service_unavailable");
}
{
  const { status, body } = await read(toUpstream("try-on", 500, "upstream boom"));
  assert(status === 503 && body.code === "service_unavailable", "5xx → 503 service_unavailable");
}

console.log("\n— jsonError shape —");
{
  const { status, body } = await read(toJsonError(400, "Body must be JSON"));
  assert(status === 400 && body.error === "Body must be JSON" && body.code === undefined, "no code arg → { error } only, given status");
}
{
  const { body } = await read(toJsonError(503, "x", "failed"));
  assert(body.code === "failed", "code arg is included when provided");
}

console.log("\n— preview-design uses the same safe mapping —");
{
  const { status, body } = await read(pvUpstream("preview-design", 429, "x"));
  assert(status === 503 && body.code === "rate_limited", "preview 429 → 503 rate_limited");
  const { body: b2 } = await read(pvUpstream("preview-design", 402, "credit balance"));
  assert(b2.code === "service_unavailable" && !JSON.stringify(b2).includes("credit"), "preview 402 → generic, no leak");
}

// A 2xx upstream response with a malformed/non-JSON body must still resolve to
// the NEUTRAL coded error — not reject into a bare 500 (which breaks the
// documented { error, code } contract). generate-design.js guarded this; try-on
// and preview-design did not until this fix. Stub fetch to return ok:true with a
// rejecting .json() and assert the handler returns the coded error.
console.log("\n— non-JSON 2xx upstream → coded error, never a throw —");
{
  const origFetch = globalThis.fetch;
  const origToken = process.env.REPLICATE_API_TOKEN;
  process.env.REPLICATE_API_TOKEN = "test-token";
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => { throw new SyntaxError("Unexpected token < in JSON"); },
    text: async () => "<html>gateway</html>",
  });
  try {
    const toReq = new Request("https://x/api/try-on", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userPhoto: "data:image/png;base64,AAAA", designPrompt: "a jacket" }),
    });
    const { status, body } = await read(await toHandler(toReq));
    assert(status === 502 && body.code === "service_unavailable", "try-on: non-JSON 2xx → 502 service_unavailable (not a 500 throw)");
    assert(!JSON.stringify(body).includes("gateway"), "try-on: raw upstream body is not leaked");

    const pvReq = new Request("https://x/api/preview-design", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ designPrompt: "a jacket" }),
    });
    const r2 = await read(await pvHandler(pvReq));
    assert(r2.status === 502 && r2.body.code === "service_unavailable", "preview-design: non-JSON 2xx → 502 service_unavailable");
  } finally {
    globalThis.fetch = origFetch;
    if (origToken === undefined) delete process.env.REPLICATE_API_TOKEN;
    else process.env.REPLICATE_API_TOKEN = origToken;
  }
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
