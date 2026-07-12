/* Staleness guard for the committed en/index.html.

   /en/ is a generated file (scripts/build-en.mjs) committed to the repo so
   Vercel keeps serving pure static files (the app's "no build" property stays
   literally true). This test regenerates it in memory and fails if the checked-in
   page differs — i.e. someone changed index.html or a dictionary string but
   forgot to run `npm run build:en`. Mirrors the DE/EN parity / honesty guard
   pattern: drift is caught by CI, it never ships. */
import { buildEn } from "../scripts/build-en.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const committedPath = resolve(__dirname, "..", "en", "index.html");

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

const norm = (s) => s.replace(/\r\n/g, "\n"); // ignore EOL normalisation only

console.log("\n— en/index.html is up to date with the generator —");
let committed = "";
try {
  committed = readFileSync(committedPath, "utf8");
  assert(true, "committed en/index.html exists");
} catch {
  assert(false, "committed en/index.html exists — run `npm run build:en` and commit it");
}

const { html, warnings } = buildEn();
assert(warnings.length === 0, `generator emits no warnings (${warnings.join("; ")})`);

if (committed) {
  const same = norm(html) === norm(committed);
  if (!same) {
    // Show the first differing line to make the fix obvious.
    const a = norm(html).split("\n"), b = norm(committed).split("\n");
    const i = a.findIndex((l, idx) => l !== b[idx]);
    console.log(`    first diff at line ${i + 1}:\n      generated: ${JSON.stringify((a[i] || "").slice(0, 100))}\n      committed: ${JSON.stringify((b[i] || "").slice(0, 100))}`);
  }
  assert(same, "committed en/index.html matches the generator output — else run `npm run build:en` and commit");
}

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
