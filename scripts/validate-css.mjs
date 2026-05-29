#!/usr/bin/env node
/**
 * CSS structural validator (CI guard)
 *
 * Guards against the "missing brace" class of bug: when a `}` is dropped
 * (e.g. a bad merge), the following rules get re-parsed as CSS *nesting*
 * and silently stop applying site-wide — exactly the breakage that once
 * collapsed the whole layout. A plain parse-error check does NOT catch
 * this, because CSS nesting is valid syntax.
 *
 * This codebase does not use CSS nesting, so the validator fails on:
 *   1. Any hard parse error reported by css-tree.
 *   2. Any style rule nested directly inside another style rule
 *      (legitimate nesting inside @media / @supports is fine — those are
 *      Atrule nodes, not Rule-in-Rule).
 *
 * Run: `node scripts/validate-css.mjs` (after `npm install css-tree`).
 */
import fs from "node:fs";
import * as csstree from "css-tree";

const FILE = process.argv[2] || "css/styles.css";
const css = fs.readFileSync(FILE, "utf8");

let parseErrors = 0;
const ast = csstree.parse(css, {
    positions: true,
    onParseError(err) {
        parseErrors++;
        console.error(`✗ Parse error: ${err.message}`);
    },
});

let nestingErrors = 0;
csstree.walk(ast, {
    visit: "Rule",
    enter(node) {
        if (!node.block || !node.block.children) return;
        node.block.children.forEach((child) => {
            // A style rule's block should hold declarations, not rules.
            // A Rule (or Raw block) here means a preceding `}` is missing.
            if (child.type === "Rule" || child.type === "Raw") {
                // Ignore empty Raw nodes (whitespace/comments only).
                if (child.type === "Raw" && !/\{/.test(child.value || "")) return;
                nestingErrors++;
                const outer = csstree.generate(node.prelude);
                const line = child.loc ? child.loc.start.line : "?";
                const inner = child.type === "Rule"
                    ? csstree.generate(child.prelude)
                    : (child.value || "").trim().slice(0, 40);
                console.error(
                    `✗ Unintended nesting near line ${line}: "${inner}" ` +
                    `appears inside "${outer}" — likely a missing } above it.`,
                );
            }
        });
    },
});

if (parseErrors || nestingErrors) {
    console.error(
        `\nCSS validation FAILED for ${FILE}: ` +
        `${parseErrors} parse error(s), ${nestingErrors} nesting error(s).`,
    );
    process.exit(1);
}
console.log(`✓ ${FILE} is structurally valid (no parse errors, no unintended nesting).`);
