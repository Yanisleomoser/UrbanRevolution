/* Error-mapping test for the Replicate proxy Edge Functions (no network).
   The load-bearing privacy/security invariant: upstream Replicate failures
   (402 insufficient credit, 401/403 auth, 429, 5xx) must be mapped to a
   NEUTRAL, coded client error — the raw upstream status/body (which can leak
   billing/credit/account state) must never reach the browser. These helpers
   are exported from the edge functions purely for this test; the runtime only
   calls the default handler. Uses the global `Response` (Node 18+). */
import { upstreamError as toUpstream, jsonError as toJsonError } from "../api/try-on.js";
import { upstreamError as pvUpstream } from "../api/preview-design.js";

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

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
