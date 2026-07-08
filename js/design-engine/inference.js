/**
 * Urban Revolution — Design Engine · Inference layer (brief §3.4)
 *
 * Aggregates the soft signals into a style vector and turns it into concrete
 * proposals — the "reads it off your tongue" part. Also powers the Phase-F
 * warmer/colder refinement: each axis visibly re-paints the colour stops and/or
 * re-weights the archetypes so the inferred fills stay coherent.
 *
 *   styleVector(dna)                   → { archetypeId: probability }  (softmax)
 *   topArchetypes(dna, n)              → [{ id, p }]
 *   suggestions(dna, attributes, lang) → [{ path, value, label, valueLabel }]
 *   adjust(dna, axis, dir, lang)       → { label }   (warmer/colder nudge)
 */
const DesignInference = (() => {
  const ATTR_LABELS = {
    "silhouette.fit": { de: "Passform", en: "Fit" },
    "silhouette.structure": { de: "Struktur", en: "Structure" },
    "fabric.material": { de: "Material", en: "Material" },
    "fabric.finish": { de: "Finish", en: "Finish" },
    "color.scheme": { de: "Farbschema", en: "Colour scheme" },
    "construction.closure": { de: "Verschluss", en: "Closure" },
    "construction.collar": { de: "Kragen", en: "Collar" },
    "construction.sleeveLength": { de: "Ärmel", en: "Sleeves" },
    "construction.pockets": { de: "Taschen", en: "Pockets" },
    "construction.hem": { de: "Saum", en: "Hem" },
    "construction.waistband": { de: "Bund", en: "Waistband" },
    "construction.waist": { de: "Taille", en: "Waist" },
    "hardware.finish": { de: "Hardware", en: "Hardware" },
    "pattern.type": { de: "Muster", en: "Pattern" },
  };
  const VALUE_WORDS = {
    wool: { de: "Wolle", en: "wool" }, polyester: { de: "Recycled Nylon", en: "recycled nylon" },
    denim: { de: "Denim", en: "denim" }, cotton: { de: "Canvas", en: "canvas" },
    silk: { de: "Seide", en: "silk" }, fleece: { de: "Fleece", en: "fleece" }, linen: { de: "Leinen", en: "linen" },
    matte: { de: "matt", en: "matte" }, sheen: { de: "glänzend", en: "sheen" },
    mono: { de: "Uni", en: "solid" }, "duo-gradient": { de: "Verlauf", en: "gradient" }, multi: { de: "Mehrfarbig", en: "multi" },
    zip: { de: "Reissverschluss", en: "zip" }, button: { de: "Knöpfe", en: "buttons" }, none: { de: "keins", en: "none" },
    stand: { de: "Stehkragen", en: "stand" }, notched: { de: "Revers", en: "notched" }, hood: { de: "Kapuze", en: "hood" },
    tonal: { de: "tonal", en: "tonal" }, metal: { de: "Glanz-Metall", en: "shiny metal" }, matteHw: { de: "Matt-Metall", en: "matte metal" },
    stripe: { de: "Streifen", en: "stripe" }, camo: { de: "Camo", en: "camo" }, graphic: { de: "Grafik", en: "graphic" }, abstract: { de: "Abstrakt", en: "abstract" },
    check: { de: "Karo", en: "check" }, half: { de: "Half-Placket", en: "half placket" },
    crew: { de: "Rundhals", en: "crew" }, vneck: { de: "V-Ausschnitt", en: "v-neck" }, shirt: { de: "Hemdkragen", en: "shirt collar" },
    sleeveless: { de: "ärmellos", en: "sleeveless" }, cap: { de: "Cap-Ärmel", en: "cap sleeves" }, short: { de: "kurz", en: "short" }, long: { de: "lang", en: "long" },
    chest: { de: "Brusttasche", en: "chest pocket" }, side: { de: "seitlich", en: "side" }, flap: { de: "Patten", en: "flap" }, cargo: { de: "Cargo", en: "cargo" }, kangaroo: { de: "Kängurutasche", en: "kangaroo" },
    straight: { de: "gerade", en: "straight" }, curved: { de: "gerundet", en: "curved" }, ribbed: { de: "gerippt", en: "ribbed" }, drawcord: { de: "Kordelzug", en: "drawcord" }, cuffed: { de: "Umschlag", en: "cuffed" }, elastic: { de: "elastisch", en: "elastic" },
    belt: { de: "Gürtelschlaufen", en: "belt loops" }, fitted: { de: "betont", en: "fitted" }, natural: { de: "natürlich", en: "natural" }, relaxed: { de: "fliessend", en: "relaxed" },
  };

  const valueWord = (v, lang) => {
    if (typeof v === "number") {
      if (v < 0.33) return lang === "en" ? "low" : "niedrig";
      if (v > 0.66) return lang === "en" ? "high" : "hoch";
      return lang === "en" ? "balanced" : "ausgewogen";
    }
    const e = VALUE_WORDS[v];
    return e ? e[lang] || e.de : String(v);
  };

  // ── colour helpers ───────────────────────────────────────────────
  // Shared DNA can carry shorthand hex (#0af, #0af8 with alpha) from
  // share.js/garment-svg.js's HEX_RE — expand to 6+ digits before parsing so
  // a 3/4-digit value doesn't yield NaN channels (which then poison mixHex/
  // saturate and get written back into the DNA at confidence 0.85).
  const toRgb = (hex) => {
    let c = String(hex).replace("#", "");
    if (c.length === 3 || c.length === 4) c = c.split("").map((ch) => ch + ch).join("");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mixHex = (hex, target, t) => {
    const a = toRgb(hex), b = toRgb(target);
    return toHex(a.map((v, i) => v + (b[i] - v) * t));
  };
  const lum = (hex) => { const [r, g, b] = toRgb(hex).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const satOf = (hex) => { const [r, g, b] = toRgb(hex).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
  const saturate = (hex, t) => {
    const [r, g, b] = toRgb(hex); const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return toHex([r + (r - gray) * t, g + (g - gray) * t, b + (b - gray) * t]);
  };

  function styleVector(dna) {
    const ws = dna.archetypeWeights || {};
    const ids = Object.keys(ws);
    const exps = ids.map((id) => Math.exp(ws[id]));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    const out = {};
    ids.forEach((id, i) => (out[id] = exps[i] / sum));
    return out;
  }

  function topArchetypes(dna, n) {
    const v = styleVector(dna);
    return Object.entries(v).map(([id, p]) => ({ id, p })).sort((a, b) => b.p - a.p).slice(0, n || 3);
  }

  // The attributes the system filled in for the user (present but low-confidence).
  function suggestions(dna, attributes, lang) {
    const th = (attributes && attributes.confidenceThreshold) || 0.5;
    const l = lang === "en" ? "en" : "de";
    const out = [];
    Object.keys(ATTR_LABELS).forEach((path) => {
      const val = DesignDNA.get(dna, path);
      const conf = DesignDNA.confidence(dna, path);
      if (val !== undefined && val !== null && conf > 0 && conf <= th) {
        out.push({ path, value: val, label: ATTR_LABELS[path][l], valueLabel: valueWord(val, l) });
      }
    });
    return out;
  }

  // Warmer/colder nudge — visibly re-paints colour stops and/or re-weights
  // archetypes. Returns a short human label of what moved (for micro-feedback).
  const AXES = {
    brightness: { de: "Helligkeit", en: "Brightness" },
    temperature: { de: "Temperatur", en: "Temperature" },
    energy: { de: "Energie", en: "Energy" },
  };

  function repaint(dna, fn) {
    const stops = (DesignDNA.get(dna, "color.stops") || []).map(fn);
    if (!stops.length) return;
    DesignDNA.set(dna, "color.stops", stops, 0.85);
    DesignDNA.set(dna, "color.value", 1 - lum(stops[0]), 0.85);
    DesignDNA.set(dna, "color.saturation", satOf(stops[0]), 0.85);
  }

  function adjust(dna, axis, dir, lang) {
    const l = lang === "en" ? "en" : "de";
    if (axis === "brightness") {
      repaint(dna, (s) => mixHex(s, dir > 0 ? "#ffffff" : "#0a0a0b", 0.16));
    } else if (axis === "temperature") {
      repaint(dna, (s) => mixHex(s, dir > 0 ? "#ff8a3d" : "#3da5ff", 0.14));
    } else if (axis === "energy") {
      repaint(dna, (s) => (dir > 0 ? saturate(s, 0.18) : mixHex(s, "#6b6b70", 0.16)));
      DesignDNA.applyEffects(dna, {
        weight: dir > 0 ? { techAvant: 0.25, y2kStreet: 0.2 } : { quietMinimal: 0.25, softCouture: 0.15 },
      });
      const e = typeof DesignDNA.get(dna, "intent.energy") === "number" ? DesignDNA.get(dna, "intent.energy") : 0.5;
      DesignDNA.set(dna, "intent.energy", Math.max(0, Math.min(1, e + dir * 0.15)), 0.85);
    } else {
      return null;
    }
    return { axis, label: AXES[axis] ? AXES[axis][l] : axis };
  }

  return { styleVector, topArchetypes, suggestions, adjust, valueWord, AXES };
})();

if (typeof window !== "undefined") window.DesignInference = DesignInference;
if (typeof module !== "undefined" && module.exports) module.exports = DesignInference;
