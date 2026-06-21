#!/usr/bin/env node
/**
 * Image-weight budget (CI guard)
 *
 * Institutionalises the "right-size your images" rule so a regression like the
 * body-preset thumbnails (832×1216 / ~200 KB each, shown in a 160×240 box —
 * ~1.1 MB for six thumbnails) can't creep back in. It is NOT an aggressive
 * optimiser; the caps are deliberately generous anti-bloat ceilings set above
 * today's real sizes, so they catch gross regressions without nagging.
 *
 * Fails (exit 1) if any shipped raster image exceeds the budget for its path.
 * Tune BUDGETS_KB when a larger asset is genuinely justified — that edit is the
 * deliberate, reviewable decision the gate exists to force.
 *
 * Run: `node scripts/check-asset-budget.mjs [dir]`  (default: assets)
 */
import fs from "node:fs";
import path from "node:path";

// Most-specific match wins (first hit, top to bottom). Sizes in KB.
// Matchers test the path by directory segment so they hold regardless of the
// root the script is invoked with (e.g. "assets" in CI, or an absolute path).
const BUDGETS_KB = [
  { test: (p) => /(^|\/)presets\//.test(p), max: 40, label: "preset thumbnail" },
  { test: () => true, max: 350, label: "image" },
];

const RASTER = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

// Pure: the budget (KB) for a repo-relative POSIX path. Exported for testing.
export function budgetForKB(relPath) {
  const p = relPath.split(path.sep).join("/");
  return BUDGETS_KB.find((b) => b.test(p));
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (RASTER.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function main() {
  const root = process.argv[2] || "assets";
  if (!fs.existsSync(root)) {
    console.error(`✗ asset directory not found: ${root}`);
    process.exit(1);
  }
  const files = walk(root).sort();
  const offenders = [];
  for (const f of files) {
    const kb = fs.statSync(f).size / 1024;
    const rule = budgetForKB(f);
    if (kb > rule.max) offenders.push({ f, kb, max: rule.max, label: rule.label });
  }

  if (offenders.length) {
    console.error(`✗ ${offenders.length} image(s) over budget:\n`);
    for (const o of offenders) {
      console.error(`  ${o.f} — ${o.kb.toFixed(0)} KB (${o.label} budget ${o.max} KB)`);
    }
    console.error(
      "\nRight-size the image (a 160×240 box needs ~480×720 max, mozjpeg q80),\n" +
      "or, if the size is genuinely justified, raise the cap in BUDGETS_KB.",
    );
    process.exit(1);
  }
  console.log(`✓ all ${files.length} images within budget (${root})`);
}

// Run only as a CLI, not when imported by a test.
if (import.meta.url === `file://${process.argv[1]}`) main();
