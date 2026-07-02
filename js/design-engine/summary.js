/**
 * Urban Revolution — Design Engine · Summary
 *
 * Turns a (finalised) DesignDNA into:
 *   toSentence(dna, lang) → the human-readable "your design in words" line
 *   toPrompt(dna, lang)   → the free-text prompt handed to AI.generateDesign()
 *
 * This is the "you never had to type it" payoff: the system phrases the design
 * the user only ever *chose*. Word maps are bilingual; unknown values fall back
 * to the raw token so a new JSON option still reads sensibly.
 */
const DesignSummary = (() => {
  const W = {
    category: {
      tshirt: { de: "T-Shirt", en: "tee" }, hoodie: { de: "Hoodie", en: "hoodie" },
      shirt: { de: "Hemd", en: "shirt" }, pants: { de: "Hose", en: "pants" },
      jacket: { de: "Jacke", en: "jacket" }, dress: { de: "Kleid", en: "dress" },
    },
    subArchetype: {
      puffer: { de: "Puffer-", en: "puffer " }, bomber: { de: "Bomber-", en: "bomber " },
      trench: { de: "Trench-", en: "trench " }, blazer: { de: "Blazer-", en: "blazer " },
      work: { de: "Workwear-", en: "work " },
      pullover: { de: "Pullover-", en: "pullover " }, zip: { de: "Zip-", en: "zip " },
      oversized: { de: "Oversized-", en: "oversized " },
      classic: { de: "", en: "" }, boxy: { de: "Boxy-", en: "boxy " }, fitted: { de: "tailliertes ", en: "fitted " },
      // Intentionally empty: the "cropped" sub-archetype also sets length=cropped,
      // so the length word already says "cropped" — a word here would duplicate it.
      // Explicit entry (not an undefined→"" fallback) so it can't be "fixed" into a dupe.
      cropped: { de: "", en: "" },
      overshirt: { de: "Overshirt-", en: "overshirt " }, camp: { de: "Resort-", en: "camp " }, popover: { de: "Popover-", en: "popover " },
      tailored: { de: "Tailored-", en: "tailored " }, slim: { de: "Slim-", en: "slim " },
      wide: { de: "weite ", en: "wide-leg " }, cargo: { de: "Cargo-", en: "cargo " },
      aline: { de: "A-Linien-", en: "A-line " }, column: { de: "gerades ", en: "column " },
      wrap: { de: "Wickel-", en: "wrap " }, slip: { de: "Slip-", en: "slip " },
    },
    material: {
      // `f: true` = grammatically feminine in German — the finish adjective
      // must agree ("aus matter Wolle", never "aus mattem Wolle").
      // cotton is plain "Baumwolle": the per-category cards phrase it as
      // Popeline/Twill/Canvas/Bio-Baumwolle, so any more specific word here
      // would contradict most of them (a poplin shirt is not canvas).
      cotton: { de: "Baumwolle", en: "cotton", f: true }, linen: { de: "Leinen", en: "linen" },
      denim: { de: "Denim", en: "denim" }, wool: { de: "Wolle", en: "wool", f: true },
      fleece: { de: "Fleece", en: "fleece" }, silk: { de: "Seide", en: "silk", f: true },
      // "Polyester", not "Nylon": the key IS polyester (config/spec sheet say
      // so) — naming a different polymer here contradicted the chips and the
      // production spec at the moment the user reads their design back.
      polyester: { de: "recyceltem Polyester", en: "recycled polyester" },
    },
    length: {
      cropped: { de: "cropped", en: "cropped" }, regular: { de: "hüftlang", en: "hip-length" },
      long: { de: "lang", en: "long" },
    },
    closure: {
      zip: { de: "Reissverschluss", en: "zip closure" }, button: { de: "Knopfleiste", en: "button closure" },
      half: { de: "Half-Placket", en: "half placket" }, none: { de: "offenem Schnitt", en: "open front" },
    },
    collar: {
      stand: { de: "Stehkragen", en: "stand collar" }, notched: { de: "Reverskragen", en: "notched lapel" },
      hood: { de: "Kapuze", en: "hood" }, crew: { de: "Rundhals", en: "crew neck" },
      vneck: { de: "V-Ausschnitt", en: "v-neck" }, shirt: { de: "Hemdkragen", en: "shirt collar" },
      none: { de: "ohne Kragen", en: "collarless" },
    },
    sleeveLength: {
      sleeveless: { de: "ärmellos", en: "sleeveless" }, cap: { de: "Cap-Ärmeln", en: "cap sleeves" },
      short: { de: "kurzen Ärmeln", en: "short sleeves" }, long: { de: "langen Ärmeln", en: "long sleeves" },
    },
    pockets: {
      none: null, side: { de: "Seitentaschen", en: "side pockets" }, flap: { de: "Pattentaschen", en: "flap pockets" },
      cargo: { de: "Cargo-Taschen", en: "cargo pockets" }, kangaroo: { de: "Kängurutasche", en: "kangaroo pocket" },
      chest: { de: "Brusttasche", en: "chest pocket" },
    },
    waistband: {
      belt: { de: "Gürtelschlaufen", en: "belt loops" }, drawcord: { de: "Kordelzug-Bund", en: "drawcord waist" },
      elastic: { de: "elastischem Bund", en: "elastic waist" },
    },
    signature: {
      "asymmetric-zip": { de: "asymmetrischem Zip", en: "asymmetric zip" },
      "contrast-stitch": { de: "Kontrastnähten", en: "contrast stitching" },
      "branding-patch": { de: "Branding-Patch", en: "branding patch" },
      "side-slit": { de: "Seitenschlitz", en: "side slit" },
    },
    hardware: {
      tonal: { de: "tonaler Hardware", en: "tonal hardware" },
      matte: { de: "matt-metallener Hardware", en: "matte-metal hardware" },
      metal: { de: "glänzender Metall-Hardware", en: "shiny metal hardware" },
    },
    pattern: {
      none: null, stripe: { de: "Streifen", en: "stripes" }, check: { de: "Karo", en: "check" },
      camo: { de: "Camo", en: "camo" }, graphic: { de: "Grafik-Print", en: "graphic print" },
      abstract: { de: "abstraktem Muster", en: "abstract pattern" },
    },
  };

  const pick = (lang, entry, raw) => (entry ? entry[lang] || entry.de : raw);

  function fitWord(v, lang) {
    if (v == null) return null;
    if (v < 0.33) return lang === "en" ? "slim" : "schmal";
    if (v > 0.66) return lang === "en" ? "oversized" : "oversized";
    return lang === "en" ? "regular-fit" : "regular";
  }

  function colorPhrase(dna, lang) {
    const g = (p) => DesignDNA.get(dna, p);
    const stops = g("color.stops") || [];
    const scheme = g("color.scheme");
    // Hex → human colour name (i18n) — never show a raw "#1a1a1a" in the sentence.
    const cn = (h) => (typeof window !== "undefined" && window.I18N && window.I18N.colorName ? window.I18N.colorName(h) : h);
    if (scheme === "duo-gradient" && stops.length >= 2) {
      return lang === "en"
        ? `a ${cn(stops[0])}-to-${cn(stops[1])} gradient`
        : `einem Verlauf von ${cn(stops[0])} zu ${cn(stops[1])}`;
    }
    if (stops.length) return lang === "en" ? `in ${cn(stops[0])}` : `in ${cn(stops[0])}`;
    return null;
  }

  function parts(dna, lang) {
    const g = (p) => DesignDNA.get(dna, p);
    const out = [];
    const fit = fitWord(g("silhouette.fit"), lang);
    const len = pick(lang, W.length[g("length")], g("length"));
    const sub = pick(lang, W.subArchetype[g("subArchetype")], "");
    const cat = pick(lang, W.category[g("category")], g("category") || (lang === "en" ? "piece" : "Stück"));
    const matEntry = W.material[g("material") || g("fabric.material")];
    const mat = pick(lang, matEntry, g("fabric.material"));
    // German adjective agrees with the material's gender (dative): feminine
    // "aus matter Wolle", masculine/neuter "aus mattem Denim/Leinen".
    const fem = !!(matEntry && matEntry.f);
    const finish = (g("fabric.finish") === "sheen")
      ? (lang === "en" ? "sheen" : fem ? "glänzender" : "glänzendem")
      : (lang === "en" ? "matte" : fem ? "matter" : "mattem");

    // Head noun: "oversized hip-length puffer jacket"
    const head = [fit, len, sub + cat].filter(Boolean).join(" ");
    out.push(head);
    if (mat) out.push(lang === "en" ? `in ${finish} ${mat}` : `aus ${finish} ${mat}`);
    const col = colorPhrase(dna, lang);
    if (col) out.push(col);

    const details = [];
    const collar = pick(lang, W.collar[g("construction.collar")], null);
    const sleeves = pick(lang, W.sleeveLength[g("construction.sleeveLength")], null);
    const closure = pick(lang, W.closure[g("construction.closure")], null);
    const pockets = pick(lang, W.pockets[g("construction.pockets")], null);
    const waistband = pick(lang, W.waistband[g("construction.waistband")], null);
    const hw = pick(lang, W.hardware[g("hardware.finish")], null);
    const pat = pick(lang, W.pattern[g("pattern.type")], null);
    const sig = (Array.isArray(g("signature")) ? g("signature") : [])
      .map((s) => pick(lang, W.signature[s], null)).filter(Boolean).join(lang === "en" ? " and " : " und ") || null;
    [collar, sleeves, closure, pockets, waistband, hw, pat, sig].forEach((d) => d && details.push(d));
    return { out, details };
  }

  function toSentence(dna, lang) {
    const l = lang === "en" ? "en" : "de";
    const { out, details } = parts(dna, l);
    let s = out.filter(Boolean).join(", ");
    if (details.length) s += (l === "en" ? ", with " : ", mit ") + details.join(l === "en" ? ", " : ", ");
    s = s.charAt(0).toUpperCase() + s.slice(1) + ".";
    return s;
  }

  // Prompt for AI.generateDesign — same content, framed as a design brief.
  function toPrompt(dna, lang) {
    const l = lang === "en" ? "en" : "de";
    const sentence = toSentence(dna, l);
    return l === "en"
      ? `Design a ${sentence} Sustainable, made-to-measure, one of one.`
      : `Entwirf ${sentence} Nachhaltig, massgeschneidert, ein Einzelstück.`;
  }

  return { toSentence, toPrompt };
})();

if (typeof window !== "undefined") window.DesignSummary = DesignSummary;
if (typeof module !== "undefined" && module.exports) module.exports = DesignSummary;
