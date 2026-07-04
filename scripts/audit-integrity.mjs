/**
 * Statischer Integritäts-Audit („Hausputz", deterministisch — exakte Checks
 * gehören in Code, nicht in Agenten):
 *
 *   1. i18n BEIDSEITIG: jeder data-i18n*-Key im HTML und jeder t("…")-Key im
 *      JS existiert in DE UND EN; und jeder Dictionary-Key wird irgendwo
 *      benutzt (Waisen = totes Gewicht, typisch nach Purges). Dynamische
 *      Präfix-Keys (t("length." + x)) werden über Präfix-Whitelists toleriert.
 *   2. REFERENZEN: jedes lokale href/src in den HTML-Dateien und jedes
 *      url(...) in styles.css zeigt auf eine existierende Datei.
 *   3. ARIA-Bezüge: aria-labelledby/-describedby/for zeigen auf existierende
 *      Element-IDs derselben Datei.
 *
 * Exit ≠ 0 bei HARTEN Fehlern (fehlender Key in einer Sprache, tote Referenz,
 * kaputter ARIA-Bezug). Waisen-Keys werden GEMELDET, brechen aber nicht (sie
 * können von Tests/Fallbacks referenziert sein — Urteil beim Menschen/Agent).
 *
 *   node scripts/audit-integrity.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

let hard = 0, soft = 0;
const fail = (msg) => { console.log("  ✗", msg); hard++; };
const warn = (msg) => { console.log("  ⚠", msg); soft++; };
const ok = (msg) => console.log("  ✓", msg);

// ── i18n-Wörterbuch laden — mit demselben Minimal-DOM-Shim wie der bestehende
// i18n-Test (i18n.js läuft apply() beim Laden und braucht document) ──────────
global.window = global.window || {};
global.document = {
  readyState: "complete",
  querySelectorAll: () => [],
  documentElement: { setAttribute() {} },
  addEventListener() {},
  title: "",
};
const I18N = require(path.join(ROOT, "js", "i18n.js"));
const dictOf = (lang) => {
  // Über die öffentliche API: setLang + t() gibt es; die Tabellen selbst
  // exportiert i18n.js über getKeys()/keys, sonst Quelltext-Scan.
  if (I18N.keys) return new Set(I18N.keys(lang));
  const src = readFileSync(path.join(ROOT, "js", "i18n.js"), "utf8");
  const startTok = lang === "de" ? "    de: {" : "    en: {";
  const start = src.indexOf(startTok);
  const end = lang === "de" ? src.indexOf("    en: {") : src.indexOf("\n  };", start);
  const block = src.slice(start, end);
  return new Set([...block.matchAll(/^\s+"((?:[^"\\]|\\.)+)":/gm)].map((m) => m[1]));
};
const deKeys = dictOf("de");
const enKeys = dictOf("en");
console.log(`\n— i18n: ${deKeys.size} DE-Keys, ${enKeys.size} EN-Keys —`);

const HTML_FILES = ["index.html", "impressum.html", "datenschutz.html", "insights.html", "404.html", "gallery/index.html"]
  .filter((f) => existsSync(path.join(ROOT, f)));
const JS_FILES = [];
const walk = (d) => readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach((e) => {
  if (e.isDirectory()) walk(path.join(d, e.name));
  else if (e.name.endsWith(".js")) JS_FILES.push(path.join(d, e.name));
});
walk("js");

// 1a) Benutzte Keys einsammeln
const used = new Set();
const dynamicPrefixes = new Set();
for (const f of HTML_FILES) {
  const html = readFileSync(path.join(ROOT, f), "utf8");
  for (const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) used.add(m[1]);
}
for (const f of JS_FILES) {
  const src = readFileSync(path.join(ROOT, f), "utf8");
  // Ein "Key", der auf "." endet, ist ein dynamisches Präfix (t("x." + y)).
  const add = (k) => (k.endsWith(".") ? dynamicPrefixes.add(k) : used.add(k));
  for (const m of src.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g)) add(m[1]);
  for (const m of src.matchAll(/I18N\.t\(\s*["']([a-zA-Z0-9_.]+)["']/g)) add(m[1]);
  for (const m of src.matchAll(/["']((?:[a-zA-Z0-9_]+\.)+)["']\s*\+/g)) dynamicPrefixes.add(m[1]);
}
// bekannte dynamische Familien (t("x." + y) im Code) — Präfixe genügen
["length.", "fit.", "material.", "pattern.", "color.", "err.", "chip.", "engine.phase_", "concept.", "ticker.", "est.", "lib.", "own.", "vto.", "spec."].forEach((p) => dynamicPrefixes.add(p));

// 1b) Benutzte Keys müssen in BEIDEN Sprachen existieren (hart)
let missing = 0;
for (const k of used) {
  if (!deKeys.has(k)) { fail(`Key „${k}" fehlt in DE`); missing++; }
  if (!enKeys.has(k)) { fail(`Key „${k}" fehlt in EN`); missing++; }
}
if (!missing) ok(`alle ${used.size} referenzierten Keys existieren in DE + EN`);
// 1c) Paritäts-Differenzen (hart — der bestehende i18n-Test prüft das auch,
// hier zur Vollständigkeit des Audits)
for (const k of deKeys) if (!enKeys.has(k)) fail(`DE-only Key: ${k}`);
for (const k of enKeys) if (!deKeys.has(k)) fail(`EN-only Key: ${k}`);
// 1d) Waisen (weich, aber DETERMINISTISCH): Kandidat = weder direkt benutzt
// noch von einer dynamischen Familie. Bestätigt = das Key-Literal kommt
// AUSSERHALB von js/i18n.js im ganzen Repo nirgends vor (HTML, JS, Tests,
// api/, content-JSONs, Doku) — dann kann ihn auch kein dynamischer Aufbau
// oder Test referenzieren. Nur bestätigte Waisen sind Löschkandidaten.
const candidates = [...deKeys].filter((k) => !used.has(k) && ![...dynamicPrefixes].some((p) => k.startsWith(p)));
let haystack = "";
{
  const SKIP_DIR = /^(node_modules|screenshots|coverage|\.git|assets)$/;
  const TEXT_EXT = /\.(js|mjs|cjs|html|json|md|css)$/;
  const collect = (rel) => readdirSync(path.join(ROOT, rel), { withFileTypes: true }).forEach((e) => {
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) collect(r); return; }
    if (TEXT_EXT.test(e.name) && r !== path.join("js", "i18n.js")) haystack += readFileSync(path.join(ROOT, r), "utf8") + "\n";
  });
  collect("");
  // i18n.js selbst konsumiert Keys in seinem CODE (document.title, Meta-
  // Hydration) — dessen Quelltext zählt als Nutzung, aber die Wörterbuch-
  // Zeilen ("key": "wert") dürfen sich nicht selbst rechtfertigen.
  haystack += readFileSync(path.join(ROOT, "js", "i18n.js"), "utf8")
    .split("\n").filter((l) => !/^\s+"(?:[^"\\]|\\.)+":/.test(l)).join("\n");
}
const confirmed = candidates.filter((k) => !haystack.includes(k));
const unproven = candidates.length - confirmed.length;
if (confirmed.length) warn(`${confirmed.length} BESTÄTIGTE Waisen-Keys (Literal existiert nirgends ausser i18n.js): ${confirmed.join(", ")}`);
else ok(`keine bestätigten Waisen-Keys${unproven ? ` (${unproven} Kandidat(en) anderweitig referenziert — behalten)` : ""}`);

// ── 2) Referenz-Existenz ────────────────────────────────────────────────────
console.log("\n— Referenzen (href/src/url) —");
// /_vercel/* existiert nur auf Vercel (Runtime-Endpunkte, siehe CLAUDE.md).
const isLocal = (u) => u && !/^(https?:|mailto:|tel:|#|data:|\/\/|javascript:|\/_vercel\/)/i.test(u);
// url()-Ziele nur prüfen, wenn sie wie eine echte Asset-Datei aussehen —
// styles.css trägt inline SVG-data-URIs, deren INNERE url(%23…)-Filter-
// Referenzen und Ellipsen sonst als „tote Dateien" fehlalarmieren.
const looksLikeAsset = (u) => /\.(png|jpe?g|webp|gif|avif|svg|woff2?|ttf|otf|ico|css|js|json)$/i.test(u);
let deadRefs = 0;
for (const f of HTML_FILES) {
  const html = readFileSync(path.join(ROOT, f), "utf8");
  const baseDir = path.dirname(path.join(ROOT, f));
  for (const m of html.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
    const u = m[1];
    if (!isLocal(u)) continue;
    const p = u.startsWith("/") ? path.join(ROOT, u) : path.join(baseDir, u);
    if (!existsSync(p)) { fail(`${f}: tote Referenz → ${u}`); deadRefs++; }
  }
}
{
  const css = readFileSync(path.join(ROOT, "css", "styles.css"), "utf8");
  for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const u = m[1];
    if (!isLocal(u) || !looksLikeAsset(u)) continue;
    const p = u.startsWith("/") ? path.join(ROOT, u) : path.join(ROOT, "css", u);
    if (!existsSync(p)) { fail(`styles.css: tote url() → ${u}`); deadRefs++; }
  }
}
if (!deadRefs) ok("alle lokalen href/src/url()-Referenzen existieren");

// ── 3) ARIA-Bezüge ──────────────────────────────────────────────────────────
console.log("\n— ARIA/for-Bezüge —");
let deadIds = 0;
for (const f of HTML_FILES) {
  const html = readFileSync(path.join(ROOT, f), "utf8");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/\b(aria-labelledby|aria-describedby|for)="([^"]+)"/g)) {
    for (const ref of m[2].split(/\s+/)) {
      if (!ids.has(ref)) { fail(`${f}: ${m[1]} → fehlende id „${ref}"`); deadIds++; }
    }
  }
}
if (!deadIds) ok("alle aria-labelledby/-describedby/for-Ziele existieren");

console.log(`\n${hard ? `✗ ${hard} harte(r) Fund(e)` : "✓ Integrität sauber"}${soft ? ` · ${soft} Hinweis(e)` : ""}`);
process.exit(hard ? 1 : 0);
