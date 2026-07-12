/* Render test for scripts/build-en.mjs — the /en/ prerender generator.
   Runs the generator against the real index.html and asserts the output is a
   genuine, self-canonical English page: <html lang="en">, English head, every
   data-i18n* node resolved to its English value, the SEO head + hreflang point
   at /en/, and relative asset paths are root-absolute. Complements
   test/en-parity-test.mjs (which guards staleness) and test/i18n-test.cjs
   (DE/EN key parity — the upstream guarantee the generator never meets a
   missing key). */
import { buildEn } from "../scripts/build-en.mjs";
import { createRequire } from "node:module";
import * as cheerio from "cheerio";

const require = createRequire(import.meta.url);
const I18N = require("../js/i18n.js"); // cached instance (build-en already shimmed + required it)
const EN = I18N.dict.en;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log("  ✗ FAIL:", msg); failures++; }
  else console.log("  ✓", msg);
}

const { html, warnings } = buildEn();

console.log("\n— generator ran without warnings —");
assert(warnings.length === 0, `no build warnings (${warnings.length}${warnings.length ? ": " + warnings.join("; ") : ""})`);

console.log("\n— <html lang> —");
assert(/<html[^>]*\blang="en"/.test(html), '<html lang="en"> is present');
assert(!/<html[^>]*\blang="de"/.test(html), 'lang="de" is absent');

console.log("\n— SEO head is English + self-referencing —");
assert(new RegExp(`<title>${EN["head.title"].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</title>`).test(html), "<title> equals EN head.title");
assert(/<link[^>]+rel="canonical"[^>]+href="https:\/\/revolveurban\.com\/en\/"/.test(html), "canonical → …/en/ (self-referencing, not the German root)");

console.log("\n— hreflang set (identical on both pages) —");
assert(/hreflang="en"[^>]*href="https:\/\/revolveurban\.com\/en\/"/.test(html), "hreflang en → …/en/");
assert(/hreflang="de"[^>]*href="https:\/\/revolveurban\.com\/"/.test(html), "hreflang de → …/");
assert(/hreflang="x-default"[^>]*href="https:\/\/revolveurban\.com\/"/.test(html), "hreflang x-default → …/");
assert(!/href="https:\/\/revolveurban\.com\/\?lang=en"/.test(html), "the old ?lang=en alternate is gone");

const $ = cheerio.load(html);

console.log("\n— og / twitter head driven by the dictionary —");
assert($('meta[property="og:url"]').attr("content") === "https://revolveurban.com/en/", "og:url → /en/");
assert($('meta[property="og:locale"]').attr("content") === "en_US", "og:locale → en_US");
assert($('meta[property="og:locale:alternate"]').attr("content") === "de_DE", "og:locale:alternate → de_DE");
assert($('meta[property="og:title"]').attr("content") === EN["meta.og_title"], "og:title = EN meta.og_title");
assert($('meta[name="description"]').attr("content") === EN["meta.description"], "description = EN meta.description");
assert($('meta[property="og:image:alt"]').attr("content") === EN["meta.og_image_alt"], "og:image:alt = EN meta.og_image_alt");

console.log("\n— every keyed node resolved to its English value (no leftover German, no raw keys) —");
let textMiss = 0, htmlMiss = 0, phMiss = 0, ariaMiss = 0;
// Compare rendered TEXT for -html nodes (not markup): the generator legitimately
// rewrites hrefs inside injected markup (e.g. the footer's legal links →
// /impressum.html), so an exact-markup match would false-positive. Text is the
// language-sensitive part we care about.
const asText = (s) => cheerio.load("<x>" + String(s) + "</x>")("x").text();
$("[data-i18n]").each((_, el) => { if ($(el).text() !== EN[$(el).attr("data-i18n")]) textMiss++; });
$("[data-i18n-html]").each((_, el) => { if ($(el).text() !== asText(EN[$(el).attr("data-i18n-html")])) htmlMiss++; });
$("[data-i18n-placeholder]").each((_, el) => { if ($(el).attr("placeholder") !== EN[$(el).attr("data-i18n-placeholder")]) phMiss++; });
$("[data-i18n-aria-label]").each((_, el) => { if ($(el).attr("aria-label") !== EN[$(el).attr("data-i18n-aria-label")]) ariaMiss++; });
assert($("[data-i18n]").length > 100, `many data-i18n nodes translated (${$("[data-i18n]").length})`);
assert(textMiss === 0, `every data-i18n node shows its English value (${textMiss} mismatch)`);
assert(htmlMiss === 0, `every data-i18n-html node shows its English markup (${htmlMiss} mismatch)`);
assert(phMiss === 0, `every data-i18n-placeholder is English (${phMiss} mismatch)`);
assert(ariaMiss === 0, `every data-i18n-aria-label is English (${ariaMiss} mismatch)`);

console.log("\n— spot-check: hero copy is English, not German —");
assert($('[data-i18n="nav.enter"]').first().text() === "Enter UR Create", "nav.enter → English (all 4 instances set)");
assert(!html.includes("Erschaffe die Zukunft"), "the German title string does not survive anywhere");

console.log("\n— JSON-LD structured data is English —");
const ld = $('script[type="application/ld+json"]').map((_, el) => $(el).text()).get().join("\n");
assert(/How long does production take\?/.test(ld), "FAQPage schema is translated (EN faq.q1)");
assert(!/Wie lange dauert die Produktion/.test(ld), "no German FAQ text remains in JSON-LD");

console.log("\n— relative asset paths made root-absolute; absolute/#/mailto untouched —");
assert(/href="\/css\/styles\.css/.test(html), "css/styles.css → /css/styles.css");
assert(!/(href|src)="css\//.test(html) && !/(href|src)="js\//.test(html), "no bare relative css/ or js/ paths remain");
assert(/src="https:\/\/cdn\.jsdelivr\.net/.test(html) || /"https:\/\/cdn\.jsdelivr\.net/.test(html), "full CDN URLs are left untouched");
assert(/href="#/.test(html), "#anchor links are left untouched");
assert($('link[rel="manifest"]').attr("href") === "/manifest.webmanifest", "already-root-absolute paths are unchanged");

console.log("\n" + (failures ? `✗ ${failures} failure(s)` : "✓ all assertions passed"));
process.exit(failures ? 1 : 0);
