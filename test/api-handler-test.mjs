/* Handler-flow test for the Upstash-backed Edge Functions (waitlist / track /
   gallery). api-validation-test.mjs already pins the pure exported helpers;
   this drives each default handler() end-to-end with a stubbed fetch + env, so
   the request→response CONTRACT itself is verified — the part that was largely
   uncovered before:
     • GET/POST happy paths (right status, right JSON body).
     • the graceful "no Upstash configured" degradation each function promises
       (GET must not error, POST must return the neutral coded error / 204).
     • the load-bearing gates actually reaching (or not reaching) the store —
       the DSGVO consent gate, the per-IP rate limit, the telemetry whitelist.
     • a store hiccup (throw / non-2xx) never becoming a hard 500 to the client.
   No network, no Redis. Node 18+ ESM (global Request/Response/Headers/URL). */
import waitlist from "../api/waitlist.js";
import track from "../api/track.js";
import gallery from "../api/gallery.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

// Read a handler Response without assuming a JSON body: 204s have none, 405s
// return plain text, everything else is JSON.
async function read(res) {
  const status = res.status;
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status, body };
}

// A fake fetch Response the edge functions understand (they read .ok/.status
// then await .json()).
const resp = (json, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => json });

// Install a routed fetch stub; returns the recorded call list so a test can
// assert whether the store was actually hit. Router gets (url, body) strings.
function spyFetch(router) {
  const calls = [];
  globalThis.fetch = async (u, opts) => {
    const body = opts && opts.body ? String(opts.body) : "";
    calls.push({ url: String(u), body });
    return router(String(u), body);
  };
  return calls;
}

const ORIG_FETCH = globalThis.fetch;
const URL_ENV = "UPSTASH_REDIS_REST_URL";
const TOK_ENV = "UPSTASH_REDIS_REST_TOKEN";
function configure(on) {
  if (on) { process.env[URL_ENV] = "https://stub.upstash.io"; process.env[TOK_ENV] = "tok"; }
  else { delete process.env[URL_ENV]; delete process.env[TOK_ENV]; }
}
const jsonReq = (url, method, obj) =>
  new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

try {
  /* ------------------------------- waitlist ------------------------------- */
  console.log("\n— waitlist GET —");
  {
    configure(false);
    globalThis.fetch = () => { throw new Error("GET must not touch the network when unconfigured"); };
    let r = await read(await waitlist(new Request("https://x/api/waitlist")));
    assert(r.status === 200 && r.body.count === null, "unconfigured → { count: null }, no network");

    configure(true);
    spyFetch(() => resp({ result: 42 }));
    r = await read(await waitlist(new Request("https://x/api/waitlist")));
    assert(r.status === 200 && r.body.count === 42, "configured → live SCARD count");

    spyFetch(() => { throw new Error("upstash down"); });
    r = await read(await waitlist(new Request("https://x/api/waitlist")));
    assert(r.status === 200 && r.body.count === null, "store error on GET degrades to { count: null } (never breaks the page)");
  }

  console.log("\n— waitlist POST —");
  {
    configure(false);
    let r = await read(await waitlist(jsonReq("https://x/api/waitlist", "POST", { email: "a@b.co", consent: true })));
    assert(r.status === 503 && r.body.code === "service_unavailable", "unconfigured POST → neutral 503 coded error");

    configure(true);
    spyFetch((u, body) => resp(body.includes("pipeline") || body.includes("SADD") ? [{ result: 1 }, { result: "OK" }, { result: 5 }] : { result: 5 }));
    r = await read(await waitlist(jsonReq("https://x/api/waitlist", "POST", { email: " User@Example.com ", consent: true })));
    assert(r.status === 200 && r.body.ok === true && r.body.status === "joined" && r.body.count === 5, "new signup → joined + count");

    spyFetch(() => resp([{ result: 0 }, { result: "OK" }, { result: 5 }]));
    r = await read(await waitlist(jsonReq("https://x/api/waitlist", "POST", { email: "dupe@example.com", consent: true })));
    assert(r.status === 200 && r.body.status === "already", "duplicate email (SADD→0) → already");

    // DSGVO consent gate must reach neither the store nor a success.
    const calls = spyFetch(() => resp([{ result: 1 }]));
    r = await read(await waitlist(jsonReq("https://x/api/waitlist", "POST", { email: "a@b.co", consent: false })));
    assert(r.status === 400 && r.body.code === "consent_required", "consent:false → 400 consent_required");
    assert(calls.length === 0, "…and never writes to the store");

    spyFetch(() => resp([{ result: 1 }]));
    r = await read(await waitlist(jsonReq("https://x/api/waitlist", "POST", { email: "not-an-email", consent: true })));
    assert(r.status === 400 && r.body.code === "invalid_email", "malformed email → 400 invalid_email");

    // Malformed JSON body is NOT an email problem (must not be mistagged).
    spyFetch(() => resp([{ result: 1 }]));
    r = await read(await waitlist(new Request("https://x/api/waitlist", { method: "POST", body: "not json{" })));
    assert(r.status === 400 && r.body.error === "Body must be JSON" && r.body.code === undefined, "invalid JSON → 400 Body must be JSON (uncoded)");

    // Store failure on write → neutral 502, never a raw throw / 500.
    spyFetch(() => resp(null, { ok: false, status: 500 }));
    r = await read(await waitlist(jsonReq("https://x/api/waitlist", "POST", { email: "a@b.co", consent: true })));
    assert(r.status === 502 && r.body.code === "service_unavailable", "store write failure → neutral 502, no leak");

    r = await read(await waitlist(new Request("https://x/api/waitlist", { method: "PUT" })));
    assert(r.status === 405, "unsupported method → 405");
  }

  /* -------------------------------- track --------------------------------- */
  console.log("\n— track GET (admin, key-gated) —");
  {
    configure(true);
    delete process.env.TELEMETRY_KEY;
    let r = await read(await track(new Request("https://x/api/track?key=whatever")));
    assert(r.status === 403 && r.body.code === "forbidden", "no TELEMETRY_KEY configured → 403 (no oracle)");

    process.env.TELEMETRY_KEY = "s3cret";
    r = await read(await track(new Request("https://x/api/track?key=wrong")));
    assert(r.status === 403 && r.body.code === "forbidden", "wrong key → 403");

    const calls = spyFetch((u, body) => resp(body.includes("HGETALL") ? [{ result: ["generate", "5"] }, { result: ["mood:shown", "3"] }] : []));
    r = await read(await track(new Request("https://x/api/track?key=s3cret")));
    assert(r.status === 200 && r.body.configured === true && r.body.events.generate === 5 && r.body.nodes["mood:shown"] === 3, "correct key → decoded aggregates");
    assert(calls.length === 1, "…via a single pipelined read");

    delete process.env.TELEMETRY_KEY;
  }

  console.log("\n— track POST (best-effort beacon) —");
  {
    configure(false);
    let r = await read(await track(jsonReq("https://x/api/track", "POST", { event: "generate" })));
    assert(r.status === 204, "unconfigured → 204, silently swallowed");

    configure(true);
    // Non-whitelisted event must NOT reach the store.
    let calls = spyFetch(() => resp([{ result: 1 }]));
    r = await read(await track(jsonReq("https://x/api/track", "POST", { event: "definitely_not_allowed" })));
    assert(r.status === 204, "non-whitelisted event → 204");
    assert(calls.length === 0, "…and writes nothing to Redis (whitelist gates the store)");

    // Whitelisted event with no node suffix → one write, no HEXISTS probe.
    calls = spyFetch((u, body) => resp(body.includes("HINCRBY") ? [{ result: 1 }] : []));
    r = await read(await track(jsonReq("https://x/api/track", "POST", { event: "generate" })));
    assert(r.status === 204 && calls.length === 1 && calls[0].body.includes("HINCRBY"), "whitelisted event → one counter increment");

    // node_shown + id → distinct-field cap probe, then the write.
    calls = spyFetch((u, body) => resp(body.includes("HEXISTS") ? [{ result: 0 }, { result: 5 }] : [{ result: 1 }, { result: 1 }]));
    r = await read(await track(jsonReq("https://x/api/track", "POST", { event: "node_shown", id: "mood_calm" })));
    assert(r.status === 204 && calls.length === 2, "node event → cap probe + write (two round-trips)");

    // A store throw must still 204 (never surfaces to the UI).
    spyFetch(() => { throw new Error("upstash down"); });
    r = await read(await track(jsonReq("https://x/api/track", "POST", { event: "generate" })));
    assert(r.status === 204, "store error on POST → still 204 (fire-and-forget)");

    r = await read(await track(new Request("https://x/api/track", { method: "PUT" })));
    assert(r.status === 405, "unsupported method → 405");
  }

  /* ------------------------------- gallery -------------------------------- */
  console.log("\n— gallery GET —");
  {
    configure(false);
    let r = await read(await gallery(new Request("https://x/api/gallery")));
    assert(r.status === 200 && r.body.ok === true && r.body.items === null, "unconfigured → { items: null } (client shows curated fallback)");

    configure(true);
    spyFetch((u) => resp({ result: ['{"d":"AbC1"}', "corrupt-not-json"] }));
    r = await read(await gallery(new Request("https://x/api/gallery")));
    assert(r.status === 200 && Array.isArray(r.body.items) && r.body.items.length === 1 && r.body.items[0].d === "AbC1", "configured → parsed items, corrupt rows dropped");
  }

  console.log("\n— gallery POST —");
  {
    configure(false);
    let r = await read(await gallery(jsonReq("https://x/api/gallery", "POST", { d: "AbC1" })));
    assert(r.status === 503 && r.body.code === "service_unavailable", "unconfigured POST → neutral 503");

    configure(true);
    // Route by command: rate-limit INCR under the limit, then the LPUSH write.
    let calls = spyFetch((u, body) => {
      if (body.includes("INCR")) return resp([{ result: 1 }, { result: 1 }]);       // count 1 ≤ 20
      if (body.includes("LPUSH")) return resp([{ result: 1 }, { result: "OK" }]);
      throw new Error("unexpected fetch: " + body);
    });
    r = await read(await gallery(jsonReq("https://x/api/gallery", "POST", { d: "AbC1-_=", name: "Yanis", by: "me" })));
    assert(r.status === 200 && r.body.ok === true, "valid publish → ok");
    assert(calls.some((c) => c.body.includes("LPUSH")), "…and the creation reaches the ring buffer");

    // Over the per-IP rate limit → 429, and the write never happens.
    calls = spyFetch((u, body) => {
      if (body.includes("INCR")) return resp([{ result: 21 }, { result: 1 }]);      // count 21 > 20
      if (body.includes("LPUSH")) throw new Error("must not write when rate-limited");
      return resp([]);
    });
    r = await read(await gallery(jsonReq("https://x/api/gallery", "POST", { d: "AbC1" })));
    assert(r.status === 429 && r.body.code === "rate_limited", "over rate limit → 429 rate_limited");
    assert(!calls.some((c) => c.body.includes("LPUSH")), "…and nothing is written");

    // Invalid DNA is rejected after the rate check, before any write.
    spyFetch((u, body) => (body.includes("INCR") ? resp([{ result: 1 }, { result: 1 }]) : resp([{ result: 1 }])));
    r = await read(await gallery(jsonReq("https://x/api/gallery", "POST", { d: "<script>" })));
    assert(r.status === 400 && r.body.code === "bad_request", "non-base64 DNA → 400 bad_request");

    r = await read(await gallery(new Request("https://x/api/gallery", { method: "DELETE" })));
    assert(r.status === 405, "unsupported method → 405");
  }
} finally {
  globalThis.fetch = ORIG_FETCH;
  configure(false);
  delete process.env.TELEMETRY_KEY;
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
