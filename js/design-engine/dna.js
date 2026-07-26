/**
 * Urban Revolution — Design Engine · DesignDNA model
 *
 * The "genome" of a design: a nested object across all design dimensions,
 * plus a parallel `_confidence` tree (same shape) holding 0..1 per attribute.
 * Pure data — no DOM, no globals beyond the exposed factory.
 *
 *   create()                       → empty DNA (archetype weights zeroed)
 *   get(dna, "silhouette.fit")     → value (nested walk, arrays by index)
 *   set(dna, path, value, conf)    → set value + confidence
 *   applyEffects(dna, effects)     → { set:{path:val}, weight:{arch:delta} }
 *   confidence(dna, path)          → 0..1 (0 if unset)
 *   topArchetype(dna)              → archetype id with highest weight
 *   completeFrom(dna, archetypes, required) → fill missing required attrs
 *   maturity(dna, required, threshold)      → 0..1 readiness score
 */
const DesignDNA = (() => {
  const ARCHETYPE_IDS = [
    "quietMinimal", "techAvant", "y2kStreet", "softCouture", "utility", "sport",
  ];

  function create() {
    const weights = {};
    ARCHETYPE_IDS.forEach((id) => (weights[id] = 0));
    return { archetypeWeights: weights, _confidence: {} };
  }

  // Paths can originate from data-driven content (content/nodes/*.json) that
  // itself derives keys from shared/imported DNA (e.g. inference-based fills).
  // Reject "__proto__"/"constructor"/"prototype" segments so a crafted path
  // can never walk `cur[p]` onto Object.prototype and pollute it globally —
  // mirrors the trust-boundary hardening share.js already applies to DNA values.
  const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

  function walk(obj, parts, build) {
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (UNSAFE_KEYS.has(p)) return undefined;
      if (cur[p] == null || typeof cur[p] !== "object") {
        if (!build) return undefined;
        cur[p] = {};
      }
      cur = cur[p];
    }
    return cur;
  }

  function get(dna, path) {
    const parts = String(path).split(".");
    let cur = dna;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = Array.isArray(cur) ? cur[parseInt(p, 10)] : cur[p];
    }
    return cur;
  }

  function set(dna, path, value, conf) {
    const parts = String(path).split(".");
    if (parts.some((p) => UNSAFE_KEYS.has(p))) return dna;
    const parent = walk(dna, parts, true);
    parent[parts[parts.length - 1]] = value;
    if (conf !== undefined) setConfidence(dna, path, conf);
    return dna;
  }

  function setConfidence(dna, path, conf) {
    const parts = ("_confidence." + path).split(".");
    if (parts.some((p) => UNSAFE_KEYS.has(p))) return;
    const parent = walk(dna, parts, true);
    parent[parts[parts.length - 1]] = Math.max(0, Math.min(1, conf));
  }

  function confidence(dna, path) {
    const v = get(dna, "_confidence." + path);
    return typeof v === "number" ? v : 0;
  }

  // effects: { set: { path: value }, weight: { archetypeId: delta } }
  // `setConf` is the confidence stamped on hard-set attributes (default 1).
  function applyEffects(dna, effects, setConf) {
    if (!effects) return dna;
    if (effects.set) {
      for (const [path, value] of Object.entries(effects.set)) {
        set(dna, path, value, setConf == null ? 1 : setConf);
      }
    }
    if (effects.weight) {
      if (!dna.archetypeWeights || typeof dna.archetypeWeights !== "object") dna.archetypeWeights = {};
      for (const [arch, delta] of Object.entries(effects.weight)) {
        if (dna.archetypeWeights[arch] == null) dna.archetypeWeights[arch] = 0;
        dna.archetypeWeights[arch] += delta;
      }
    }
    return dna;
  }

  function topArchetype(dna) {
    let best = null;
    let bestW = -Infinity;
    for (const [id, w] of Object.entries(dna.archetypeWeights || {})) {
      // Skip non-finite weights (null/NaN/Infinity from a corrupt or crafted
      // #dna= link): `null > -Infinity` is true, so a null weight would
      // otherwise win over real negative weights and pick the wrong archetype.
      if (Number.isFinite(w) && w > bestW) { bestW = w; best = id; }
    }
    return best;
  }

  function archetypeById(archetypes, id) {
    return (archetypes || []).find((a) => a.id === id) || null;
  }

  // Fill every required attribute still below threshold with the top
  // archetype's default. Inferred required attrs are stamped AT the threshold
  // so a fully-inferred (express) design reads as 100% mature, yet still counts
  // as "inferred" for the Phase-F suggestions (conf <= threshold). Guarantees a
  // complete design from even a short path (brief §7 Bug 1).
  function completeFrom(dna, archetypes, required, threshold) {
    const top = archetypeById(archetypes, topArchetype(dna));
    if (!top) return dna;
    return completeAs(dna, top, required, threshold);
  }

  // Dasselbe, aber mit EINEM ausdrücklich genannten Archetyp statt dem
  // stärksten der DNA. Die Startpunkt-Galerie (Roadmap B4) braucht genau das:
  // acht Auflösungen DERSELBEN Mood-DNA in acht Richtungen. Über den Umweg
  // „Gewichte verbiegen, damit topArchetype das Gewünschte liefert" wäre die
  // DNA der Vorschau nicht mehr die DNA des Nutzers.
  function completeAs(dna, arch, required, threshold) {
    if (!arch || !arch.defaults) return dna;
    const th = threshold == null ? 0.5 : threshold;
    (required || []).forEach((path) => {
      if (confidence(dna, path) < th && arch.defaults[path] !== undefined) {
        set(dna, path, clone(arch.defaults[path]), th);
      }
    });
    // Also pull any other archetype defaults for still-empty attrs (soft fill).
    for (const [path, value] of Object.entries(arch.defaults)) {
      if (get(dna, path) === undefined) set(dna, path, clone(value), 0.4);
    }
    return dna;
  }

  function maturity(dna, required, threshold) {
    const list = required || [];
    if (!list.length) return 0;
    const th = threshold == null ? 0.5 : threshold;
    let sum = 0;
    list.forEach((path) => {
      sum += Math.min(1, confidence(dna, path) / th);
    });
    return sum / list.length;
  }

  function clone(v) {
    return Array.isArray(v) ? v.slice() : v;
  }

  return {
    ARCHETYPE_IDS,
    create, get, set, setConfidence, confidence,
    applyEffects, topArchetype, completeFrom, completeAs, maturity,
  };
})();

if (typeof window !== "undefined") window.DesignDNA = DesignDNA;
if (typeof module !== "undefined" && module.exports) module.exports = DesignDNA;
