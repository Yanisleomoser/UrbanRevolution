/**
 * CSS dead-code auditor for css/styles.css.
 *
 * Reports selectors whose class tokens are never referenced anywhere in the
 * shipped HTML / JS / JSON — the input to a safe dead-CSS prune. It is
 * deliberately CONSERVATIVE (errs toward "used" / keep):
 *
 *   A class is USED if ANY of these hold:
 *     (a) it is a class token in a static HTML `class="…"` attribute;
 *     (b) its exact name appears as a substring in any JS/JSON source
 *         (covers classList.add("x"), className="x y", querySelector(".x"),
 *          insertAdjacentHTML('…class="x"…'), JSON-driven class strings);
 *     (c) it STARTS WITH a dynamic prefix built in JS — a string literal that
 *         is concatenated or interpolated to construct a class name at runtime
 *         (e.g. "gs-" + layer, `de-${x}`, "ur-hero-" + type). This is the key
 *         guard against pruning dynamically-constructed classes.
 *
 *   A RULE is removable only if EVERY one of its selectors is "subject-dead":
 *   the selector's subject (rightmost compound) contains a dead class, so no
 *   element can ever match it. Rules whose subject is an id/tag/live-class are
 *   kept untouched. IDs are never used to mark a rule dead (too entangled with
 *   getElementById / aria / url(#…) refs).
 *
 * Runtime CSS coverage (a positive keep-signal for classes actually applied
 * during a full journey walk) is layered on separately by
 * scripts/audit-css-coverage.mjs; this script is the static half.
 *
 * Usage: node scripts/audit-css-usage.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const csstree = require("css-tree");

const ROOT = process.cwd();
const CSS_PATH = join(ROOT, "css/styles.css");

// ── Collect source text to search for usage ──────────────────────────────
function walkFiles(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "screenshots") continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, exts, out);
    else if (exts.includes(extname(name))) out.push(abs);
  }
  return out;
}

const htmlFiles = walkFiles(ROOT, [".html"]).filter((f) => !f.includes("/gallery/"));
// gallery/ has its OWN css (gallery/*.css) and does not use css/styles.css, so
// its classes are irrelevant here; excluding it avoids false "used" rescues.
const jsFiles = walkFiles(join(ROOT, "js"), [".js"]);
const jsonFiles = [
  ...walkFiles(join(ROOT, "js/design-engine/content"), [".json"]),
];

const htmlText = htmlFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const jsText = jsFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const jsonText = jsonFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const codeText = jsText + "\n" + jsonText;

// (a) static HTML class tokens
const htmlClassTokens = new Set();
for (const m of htmlText.matchAll(/class\s*=\s*"([^"]*)"/g)) {
  for (const t of m[1].split(/\s+/)) if (t) htmlClassTokens.add(t);
}
// data-i18n-html and i18n dict strings embed class="…"; also scan those via jsText below.
for (const m of jsText.matchAll(/class=\\?["']([^"'\\]*)/g)) {
  for (const t of m[1].split(/\s+/)) if (t) htmlClassTokens.add(t);
}

// (c) dynamic class prefixes built in JS: string literals that end in '-' (the
// classic concat stem) OR the static head of a template literal before ${ that
// ends in '-'. Conservative: any class starting with one of these is kept.
const dynamicPrefixes = new Set();
// plain string literals ending in a hyphen: "gs-", 'ur-hero-'
for (const m of jsText.matchAll(/["']([a-zA-Z][\w-]*-)["']/g)) dynamicPrefixes.add(m[1]);
// ANY hyphen-terminated head immediately before a `${…}` interpolation, wherever
// it sits in a template literal — catches `de-step is-${state}` (mid-string,
// second class) and `class="foo-${x}"` alike. This is the guard that keeps
// dynamically-built state classes like is-todo / is-cur (flow.js phaseStepper).
for (const m of jsText.matchAll(/([a-zA-Z][\w-]*-)\$\{/g)) dynamicPrefixes.add(m[1]);

function isUsed(cls) {
  if (htmlClassTokens.has(cls)) return "html";
  // exact-substring in code (JS + JSON). Word-ish boundary check to avoid a
  // short class matching inside an unrelated longer identifier is intentionally
  // NOT applied — we prefer false "used" (safe) over false "dead".
  if (codeText.includes(cls)) return "code";
  for (const p of dynamicPrefixes) {
    if (cls.startsWith(p) && cls.length > p.length) return `prefix:${p}`;
  }
  return null;
}

// ── Parse styles.css, analyse each rule ──────────────────────────────────
const css = readFileSync(CSS_PATH, "utf8");
const ast = csstree.parse(css, { positions: true });

const allClasses = new Set();
const rules = []; // { selectorsText, subjectClassesPerSelector, start, end, line }

csstree.walk(ast, {
  visit: "Rule",
  enter(node) {
    if (node.prelude.type !== "SelectorList") return;
    const selectors = [];
    csstree.walk(node.prelude, {
      visit: "Selector",
      enter(sel) {
        // Split the compound sequence on combinators; the subject is the last
        // compound. Collect all class names + the subject's class names.
        const all = [];
        let subject = [];
        for (const child of sel.children) {
          if (child.type === "Combinator" || child.type === "WhiteSpace") {
            subject = [];
          } else if (child.type === "ClassSelector") {
            all.push(child.name);
            subject.push(child.name);
            allClasses.add(child.name);
          }
        }
        selectors.push({ all, subject, hasClass: all.length > 0 });
      },
    });
    rules.push({
      text: csstree.generate(node.prelude),
      selectors,
      start: node.loc.start.offset,
      end: node.loc.end.offset,
      line: node.loc.start.line,
    });
  },
});

// dead classes
const deadClasses = [...allClasses].filter((c) => !isUsed(c)).sort();
const deadSet = new Set(deadClasses);

// Removable rules: EVERY selector contains a dead class among its top-level
// (non-pseudo-nested) class tokens, so no element can ever match it — a required
// class never exists in the DOM, whether it's the subject or an ancestor
// (`.dead .live`, `.dead div`) or part of a compound (`.live.dead`). Classes
// inside :not()/:is()/:has() are NOT collected (they sit under a
// PseudoClassSelector, which the selector walk skips), so a negated dead class
// like `.live:not(.dead)` is correctly KEPT. Selectors with no class token at
// all (pure id/tag) never mark a rule dead.
const removable = rules.filter((r) =>
  r.selectors.length > 0 &&
  r.selectors.every((s) => s.all.length > 0 && s.all.some((c) => deadSet.has(c)))
);

const asJson = process.argv.includes("--json");
if (asJson) {
  console.log(JSON.stringify({ deadClasses, removable: removable.map((r) => ({ text: r.text, line: r.line, start: r.start, end: r.end })) }, null, 2));
} else {
  console.log(`\nTotal distinct CSS class names: ${allClasses.size}`);
  console.log(`Dead (unreferenced) class names: ${deadClasses.length}`);
  console.log(`Dynamic prefixes detected in JS: ${[...dynamicPrefixes].sort().join(", ")}`);
  console.log(`\nRemovable rules (every selector subject-dead): ${removable.length}`);
  const bytes = removable.reduce((n, r) => n + (r.end - r.start), 0);
  console.log(`Approx bytes removable: ${bytes} (${(bytes / 1024).toFixed(1)} KB)\n`);
  console.log("── Dead classes ──");
  console.log(deadClasses.join("  "));
  console.log("\n── Removable rules (line · selector) ──");
  for (const r of removable) console.log(`${String(r.line).padStart(5)}  ${r.text}`);
}
