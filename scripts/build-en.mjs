/**
 * scripts/build-en.mjs — generate en/index.html from the single German source
 * (index.html) + the English half of the I18N dictionary (js/i18n.js).
 *
 * WHY: /?lang=en used to return byte-for-byte the German HTML (lang="de",
 * German <title>, canonical → /), so Google indexed German only and treated
 * ?lang=en as a duplicate of the root. This emits a real, server-rendered
 * English page at /en/ — <html lang="en">, English <head>, a self-referencing
 * canonical — a distinct URL Google can index. No hand-maintained second copy:
 * every string comes from the same dictionary the client already ships, so DE
 * and EN can never drift (the DE/EN parity test guarantees no missing key).
 *
 * This is a codegen step, NOT a bundler/transpiler — the app still ships
 * vanilla, no module system change. It mirrors I18N.apply() EXACTLY (the same
 * data-i18n* attributes) and then rewrites the SEO head for English.
 *
 *   node scripts/build-en.mjs                  # writes en/index.html
 *   OUT=/tmp/en.html node scripts/build-en.mjs # writes elsewhere
 *
 * The exported buildEn() returns { html, warnings } for the render/parity tests.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

// i18n.js is a classic IIFE that runs apply() (a DOM walk) at load. Shim the
// browser globals it touches so it loads under Node — the same shim the i18n
// unit tests use. We only need its exported dictionary.
globalThis.window = globalThis.window || { addEventListener() {}, dispatchEvent() {} };
globalThis.document = globalThis.document || {
  readyState: "complete",
  querySelectorAll: () => [],
  documentElement: { setAttribute() {} },
  addEventListener() {},
  title: "",
};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem() {},
  removeItem() {},
};

const I18N = require(resolve(ROOT, "js", "i18n.js"));
const EN = I18N.dict.en;
const DE = I18N.dict.de;

// DE-string → EN-string, for every key whose two translations differ. Used to
// translate the JSON-LD blocks (Organization/Service descriptions via the
// ld.* keys, the FAQPage via faq.*), whose prose is NOT data-i18n-hydrated.
// Whole-value exact match only — schema keywords/URLs/emails aren't dict values.
const DE_TO_EN = {};
for (const k of Object.keys(EN)) {
  const d = DE[k];
  const e = EN[k];
  if (typeof d === "string" && typeof e === "string" && d !== e) DE_TO_EN[d] = e;
}

const CANON = "https://revolveurban.com/en/";
const ROOT_URL = "https://revolveurban.com/";

// Attribute → how I18N.apply() writes it. Mirror it EXACTLY so DE and EN stay in
// lockstep (text / html / placeholder / aria-label / alt / title).
const ATTR_MODES = [
  ["data-i18n", "text"],
  ["data-i18n-html", "html"],
  ["data-i18n-placeholder", "attr:placeholder"],
  ["data-i18n-aria-label", "attr:aria-label"],
  ["data-i18n-alt", "attr:alt"],
  ["data-i18n-title", "attr:title"],
];

// Relative asset/link value → one that does NOT already start with an absolute
// scheme, protocol-relative //, root /, #fragment, data:, mailto: or tel:.
const RELATIVE = /^(?!https?:|\/\/|\/|#|data:|mailto:|tel:)/i;

/**
 * Build the English page string from a German source HTML (defaults to the real
 * index.html). Pure + deterministic — the parity test relies on that.
 */
export function buildEn(srcHtml = readFileSync(resolve(ROOT, "index.html"), "utf8")) {
  const warnings = [];
  // decodeEntities:false keeps the UTF-8 punctuation (— · × ↓ → umlauts) as-is
  // instead of re-encoding it to numeric entities, so the output stays close to
  // the source.
  const $ = cheerio.load(srcHtml, { decodeEntities: false });

  // 1 · Language.
  $("html").attr("lang", "en");

  // 2 · Translate every keyed node, exactly like I18N.apply().
  for (const [attr, mode] of ATTR_MODES) {
    $(`[${attr}]`).each((_, el) => {
      const $el = $(el);
      const key = $el.attr(attr);
      const val = EN[key];
      if (typeof val !== "string") {
        // notes.* are arrays used only via t() in JS, never as data-i18n; any
        // other miss means a key absent from EN. With the parity test green this
        // never fires — leave the node untouched and record it as a build error.
        warnings.push(`${attr}="${key}" → missing or non-string EN value`);
        return;
      }
      if (mode === "text") $el.text(val);
      else if (mode === "html") $el.html(val);
      else if (mode.startsWith("attr:")) $el.attr(mode.slice(5), val);
    });
  }

  // 2b · Translate the JSON-LD structured data (Organization/Service/FAQPage)
  // from the same dictionary. Google reads these for rich results, so German
  // schema on an English page would undercut the whole point of /en/.
  $('script[type="application/ld+json"]').each((_, el) => {
    const $el = $(el);
    let data;
    try {
      data = JSON.parse($el.text());
    } catch {
      warnings.push("JSON-LD block is not valid JSON — left untranslated");
      return;
    }
    const walk = (v) => {
      if (typeof v === "string") return Object.prototype.hasOwnProperty.call(DE_TO_EN, v) ? DE_TO_EN[v] : v;
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") {
        for (const k of Object.keys(v)) v[k] = walk(v[k]);
        return v;
      }
      return v;
    };
    $el.text(JSON.stringify(walk(data), null, 2));
  });

  // 3 · English SEO head. Every textual value is driven by the SAME dictionary
  // keys the client uses (single source of truth); the URLs point at /en/ and
  // self-canonicalise. The og:image itself is language-neutral — left as-is.
  const setContent = (sel, v) => {
    const el = $(sel);
    if (el.length && v != null) el.attr("content", v);
    else if (!el.length) warnings.push(`head tag not found: ${sel}`);
  };
  $("title").text(EN["head.title"]);
  setContent('meta[name="description"]', EN["meta.description"]);
  setContent('meta[property="og:title"]', EN["meta.og_title"]);
  setContent('meta[name="twitter:title"]', EN["meta.og_title"]);
  setContent('meta[property="og:description"]', EN["meta.og_description"]);
  setContent('meta[name="twitter:description"]', EN["meta.og_description"]);
  setContent('meta[property="og:image:alt"]', EN["meta.og_image_alt"]);
  setContent('meta[name="twitter:image:alt"]', EN["meta.og_image_alt"]);
  setContent('meta[property="og:url"]', CANON);
  setContent('meta[property="og:locale"]', "en_US");
  setContent('meta[property="og:locale:alternate"]', "de_DE");
  $('link[rel="canonical"]').attr("href", CANON);

  // hreflang: the identical set on both pages (each names the other as its twin).
  $('link[rel="alternate"][hreflang="de"]').attr("href", ROOT_URL);
  $('link[rel="alternate"][hreflang="en"]').attr("href", CANON);
  $('link[rel="alternate"][hreflang="x-default"]').attr("href", ROOT_URL);

  // 4 · Make relative asset/link paths root-absolute so they resolve from /en/
  // (a document at /en/ would otherwise resolve `css/…` to `/en/css/…`). Runs
  // AFTER translation so hrefs inside injected data-i18n-html (e.g. the footer's
  // legal links) are caught too. No <base> tag is used — it would break in-page
  // #anchors — so we assert its absence instead.
  if ($("base").length) warnings.push("<base> tag present — would change relative-path resolution");
  $("[href], [src], [srcset]").each((_, el) => {
    const $el = $(el);
    for (const a of ["href", "src"]) {
      const v = $el.attr(a);
      if (v && RELATIVE.test(v)) $el.attr(a, "/" + v);
    }
    const srcset = $el.attr("srcset");
    if (srcset) {
      const rewritten = srcset
        .split(",")
        .map((part) => {
          const trimmed = part.trim();
          const spaceIdx = trimmed.indexOf(" ");
          const url = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
          const descriptor = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx);
          return (RELATIVE.test(url) ? "/" + url : url) + descriptor;
        })
        .join(", ");
      $el.attr("srcset", rewritten);
    }
  });

  return { html: $.html(), warnings };
}

// CLI: write the file (default en/index.html; OUT env overrides).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { html, warnings } = buildEn();
  if (warnings.length) {
    console.error("build-en warnings:\n  " + warnings.join("\n  "));
    // The DE/EN parity test guarantees no missing key, so a warning here is a
    // real defect — fail rather than ship a half-translated / malformed page.
    process.exit(1);
  }
  const out = process.env.OUT || resolve(ROOT, "en", "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log("wrote", out);
}
