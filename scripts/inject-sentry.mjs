/**
 * Sentry release/environment injection for a build-free static site.
 *
 * A static site can't read Vercel env vars at runtime, so we replace the
 * __SENTRY_RELEASE__ / __SENTRY_ENV__ placeholders in index.html at BUILD time
 * (Vercel buildCommand) with the deploy's git SHA + environment. This makes
 * every Sentry error traceable to an exact deploy. Locally (placeholders left
 * intact) the init() falls back to a hostname heuristic — see index.html.
 *
 * Idempotent and best-effort: a missing env var simply leaves its placeholder,
 * and the build never fails on it.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "index.html";
const sha = process.env.VERCEL_GIT_COMMIT_SHA || "";
const env = process.env.VERCEL_ENV || ""; // production | preview | development

try {
  let html = readFileSync(FILE, "utf8");
  if (sha) html = html.replaceAll("__SENTRY_RELEASE__", sha);
  if (env) html = html.replaceAll("__SENTRY_ENV__", env);
  writeFileSync(FILE, html);
  console.log(`[sentry] release=${sha || "(none)"} environment=${env || "(none)"}`);
} catch (err) {
  // Never break the deploy over telemetry wiring.
  console.warn("[sentry] injection skipped:", err && err.message);
}
