/**
 * Urban Revolution — Design Engine · Flow controller
 *
 * Orchestrates the journey: loads JSON content, drives the engine one node at a
 * time, renders the active modality, keeps a live 2D preview proxy + maturity
 * ring, flashes micro-feedback on each choice, persists progress to localStorage
 * (resume after reload), runs Phase F (inference + warmer/colder refinement),
 * mirrors concrete attributes into StateManager, and hands the finished
 * DesignDNA to AI.generateDesign via summary.toPrompt.
 *
 *   DesignFlow.mount(hostEl, { contentBase, onDesign, onFinish })  → Promise
 *
 * Globals (all optional-guarded): DesignDNA, DesignEngine, DesignInference,
 * DesignPreview, DesignSummary, DEModalities, I18N, CONFIG, StateManager.
 */
const DesignFlow = (() => {
  // Root-absolute so the journey's content JSON resolves from ANY document path
  // (e.g. the prerendered /en/ page), not just the site root — a relative base
  // would fetch /en/js/… and 404. Matches the other content fetches in the app.
  const DEFAULT_BASE = "/js/design-engine/content/";
  const STORAGE_KEY = "urev_journey_v1";
  // Attributes that drive the live flat — the user's value (incl. a live slider
  // drag at confidence 0) must always win over the archetype inference in the
  // preview clone, so every decision is visible immediately.
  const LIVE_PATHS = [
    "silhouette.fit", "silhouette.volume", "silhouette.structure", "length",
    "construction.collar", "construction.sleeve", "construction.sleeveLength",
    "construction.closure", "construction.pockets", "construction.cuffs",
    "construction.hem", "construction.waistband", "construction.waist",
    "pattern.type", "pattern.scale", "color.scheme", "color.stops",
    "fabric.material", "fabric.finishWeight", "intent.energy",
  ];

  // Fat-finger guard: single-select cards commit instantly on tap, so the next
  // question renders under the user's finger — the second tap of a double-tap
  // would land on whatever button now sits there (worst case the generate
  // button, which shares the confirm styling). A tap that arrives within this
  // window of a fresh render is the tail of a tap aimed at the PREVIOUS screen;
  // ignore it. 350 ms is far below any deliberate read-and-decide, and keyboard
  // users are unaffected (focus lands on the question heading after render).
  const COMMIT_GUARD_MS = 350;
  const isGuardedTap = (nowMs, renderedAtMs) => nowMs - renderedAtMs < COMMIT_GUARD_MS;
  const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function S(key, value) {
    if (!window.StateManager) return;
    try { window.StateManager.set(key, value); } catch (_e) { /* validation guard */ }
  }
  const lang = () => (window.I18N ? window.I18N.getLang() : "de");
  const t = (k, v) => (window.I18N ? window.I18N.t(k, v) : k);

  // Neutral energy seed (roadmap C1): ohne dies lässt ein übersprungenes
  // mood_calm_bold intent.energy undefiniert, wodurch jedes
  // `intent.energy > x`-Gate zu `NaN > x` = false wird und Muster/Signature/
  // Hardware dauerhaft verschwinden. 0.5 hält den Auftakt neutral (0.5 > 0.45 →
  // Muster sichtbar; 0.5 ≯ 0.5 / 0.6 → Signature/Hardware bleiben aus). Die
  // niedrige Confidence (0.05) sorgt dafür, dass eine echte Mood-Wahl (conf 1)
  // sie überschreibt und der Seed nicht als „entschieden" zählt (kein Chip,
  // keine Reifegrad-/Inferenz-Wirkung — intent.energy ist weder required noch
  // in ATTR_LABELS).
  function seedDefaults(d) { DesignDNA.set(d, "intent.energy", 0.5, 0.05); return d; }

  // ── Widerspruchs-Eviction (Atelier-Analyse 2026-07-23, Ursache 1) ─────────
  // Drei chirurgische Regeln, damit die Maschine dem User nie widerspricht.

  // (1) fabric.finishWeight ist die explizite Finish-Antwort (Slider, conf
  // 0.8). Der kategorische fabric.finish (Archetyp-Default, Material-
  // Nebeneffekt) darf ihr nicht widersprechen — real passiert: Refine-Chip
  // „Finish: matt" unter einem Satz „aus glänzendem …", alle sechs Branches.
  // Ab conf ≥ 0.6 wird fabric.finish abgeleitet und trägt die Confidence des
  // Gewichts, womit completeFrom/suggestions ihn als entschieden behandeln.
  function syncDerivedFinish(d) {
    const wConf = DesignDNA.confidence(d, "fabric.finishWeight");
    if (wConf < 0.6) return d;
    const w = DesignDNA.get(d, "fabric.finishWeight");
    if (typeof w !== "number") return d;
    const derived = w > 0.5 ? "sheen" : "matte";
    if (DesignDNA.get(d, "fabric.finish") !== derived || DesignDNA.confidence(d, "fabric.finish") < wConf) {
      DesignDNA.set(d, "fabric.finish", derived, wConf);
    }
    return d;
  }

  // (2) Sekundäre set-Effekte (z. B. Hosen-„Tailored" → silhouette.fit 0.45)
  // überschreiben keine Dimension, die der User bereits selbst beantwortet hat
  // (conf ≥ 0.75: Karten/Farbe/Ranking/Regionen 1.0, Slider 0.8 — Inferenz
  // ≤ 0.5 bleibt überschreibbar). Der Bind des Nodes ist ausgenommen: das IST
  // die gestellte Frage. Gibt einen bereinigten Klon zurück — eff kann eine
  // Referenz in die geladene content-JSON sein und darf nie mutiert werden.
  const PROTECT_CONF = 0.75;
  function protectExplicit(d, node, eff) {
    if (!eff || !eff.set) return eff;
    const out = { ...eff, set: { ...eff.set } };
    Object.keys(out.set).forEach((p) => {
      if (node && node.bind === p) return;
      if (DesignDNA.confidence(d, p) >= PROTECT_CONF && DesignDNA.get(d, p) !== out.set[p]) {
        delete out.set[p];
      }
    });
    return out;
  }

  // (3) Inferenz-Füllungen (conf ≤ threshold) müssen baubar sein: ein T-Shirt
  // bekommt keine Knopfleiste, nur weil der Archetyp-Default „button" sagt.
  // allowedFn kommt vom Renderer (GarmentSVG.closureAllowed — der weiss, was
  // seine Kategorie zeichnen kann); ohne ihn passiert nichts (graceful, z. B.
  // im Test-Harness ohne GarmentSVG).
  function scrubImpossibleFills(d, threshold, allowedFn) {
    if (typeof allowedFn !== "function") return d;
    const cat = DesignDNA.get(d, "category");
    if (!cat) return d;
    const th = threshold == null ? 0.5 : threshold;
    const v = DesignDNA.get(d, "construction.closure");
    const conf = DesignDNA.confidence(d, "construction.closure");
    if (v != null && conf <= th && !allowedFn(cat, v)) {
      DesignDNA.set(d, "construction.closure", "none", conf);
    }
    return d;
  }

  // Every garment category now has its own node branch (each gated by
  // `when: category=='X'`), so the journey goes deep for all six — not just the
  // jacket. All branches load upfront; the engine only surfaces matching nodes.
  const CATEGORY_NODES = ["jacket", "hoodie", "shirt", "tshirt", "pants", "dress"];

  async function loadContent(base) {
    const get = async (p) => (await fetch(base + p)).json();
    const [arch, attrs, intent, ...cats] = await Promise.all([
      get("archetypes.json"), get("attributes.json"), get("nodes/intent.json"),
      ...CATEGORY_NODES.map((c) => get(`nodes/${c}.json`)),
    ]);
    const nodes = [...intent.nodes];
    cats.forEach((c) => { if (c && Array.isArray(c.nodes)) nodes.push(...c.nodes); });
    // Photo honesty manifest (roadmap §3.5) — best-effort: without it the
    // realism layer stays off (fail-closed; the flat is always correct).
    const photoManifest = await get("preview-photos.json").catch(() => null);
    return { archetypes: arch.archetypes, attributes: attrs, nodes, photoManifest };
  }

  function resolveEffects(node, payload) {
    if (node.modality === "describe") {
      // „Beschreib es" (U4): geparste Worte des Users seeden die DNA bei
      // conf 0.62 — ÜBER der Entscheidungs-Schwelle (0.5) und den üblichen
      // when-Gates (< 0.6), damit der Motor beantwortete Fragen wirklich
      // überspringt; UNTER protectExplicit (0.75), damit jede spätere echte
      // Antwort das gelesene Wort überstimmen darf. Skip = keine Effekte.
      const set = payload && payload.set && typeof payload.set === "object" ? payload.set : {};
      return { eff: { set, weight: {} }, conf: 0.62 };
    }
    if (node.modality === "slider") {
      const eff = { set: { [node.bind]: payload }, weight: {} };
      if (node.weightAt) {
        if (payload < 0.34 && node.weightAt.low) Object.assign(eff.weight, node.weightAt.low);
        if (payload > 0.66 && node.weightAt.high) Object.assign(eff.weight, node.weightAt.high);
      }
      return { eff, conf: 0.8 };
    }
    if (node.modality === "colorGradient") {
      // Only scheme + stops — the colour is fully carried by the stops. The old
      // color.value/color.saturation HSL derivations were read by no renderer
      // (roadmap C3), so they're no longer written.
      return { eff: { set: {
        "color.scheme": payload.scheme, "color.stops": payload.stops,
      } }, conf: 1 };
    }
    if (node.modality === "ranking") {
      const decay = [1, 0.6, 0.35, 0.2, 0.1];
      const weight = {};
      (payload || []).forEach((id, idx) => {
        const opt = (node.options || []).find((o) => o.id === id);
        const w = opt && opt.effects && opt.effects.weight;
        if (w) { const f = decay[idx] != null ? decay[idx] : 0.05; Object.entries(w).forEach(([k, v]) => { weight[k] = (weight[k] || 0) + v * f; }); }
      });
      const eff = { weight, set: {} };
      // The top-ranked option also writes its rendered set() so the ranking
      // visibly reshapes the flat — not only the (invisible) archetype weights.
      const topOpt = (node.options || []).find((o) => o.id === (payload || [])[0]);
      if (topOpt && topOpt.effects && topOpt.effects.set) Object.assign(eff.set, topOpt.effects.set);
      if (node.bind && (payload || []).length) eff.set[node.bind] = payload[0];
      return { eff, conf: 1 };
    }
    if (node.modality === "regions") {
      // Detail atelier (roadmap §7): payload = { regionId: choiceId } for the
      // regions the user actually touched. Untouched regions stay undecided —
      // the archetype inference fills them at finalize, which is exactly the
      // compression the board exists for. Effects merge like multi-cards.
      const picks = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
      const eff = { set: {}, weight: {} };
      Object.entries(picks).forEach(([rid, cid]) => {
        const region = (node.regions || []).find((rg) => rg.id === rid);
        const choice = region && (region.choices || []).find((c) => c.id === cid);
        const e = choice && choice.effects;
        if (e && e.set) Object.assign(eff.set, e.set);
        if (e && e.weight) Object.entries(e.weight).forEach(([k, v]) => { eff.weight[k] = (eff.weight[k] || 0) + v; });
      });
      return { eff, conf: 1 };
    }
    if (node.modality === "cards" && Array.isArray(payload)) {
      const eff = { set: {}, weight: {} };
      payload.forEach((id) => {
        const e = DesignEngine.choiceEffects(node, id);
        if (e && e.set) Object.assign(eff.set, e.set);
        if (e && e.weight) Object.entries(e.weight).forEach(([k, v]) => { eff.weight[k] = (eff.weight[k] || 0) + v; });
      });
      if (node.bind) eff.set[node.bind] = payload.join("+");
      return { eff, conf: 1 };
    }
    return { eff: DesignEngine.choiceEffects(node, payload), conf: 1 };
  }

  // ── Concept-Studio (Direktive Schritte 3+4): Varianten + EVOLVE ───────────
  // Deterministische Mutationen der konvergierten DNA — jede Variante ist eine
  // echte, weiterentwickelbare Richtung (Farbe/Fit/Muster/Finish-Deltas), keine
  // Zufalls-Lotterie: hash(seed) ist stabil pro (Konzept, Version).
  const hash01 = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + (c || 0) * 74.7 + 13.37) * 43758.5453; return s - Math.floor(s); };
  function shiftHex(hex, dh, dl) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return hex;
    const r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0; const li = (mx + mn) / 2;
    const d = mx - mn;
    const sa = d === 0 ? 0 : d / (1 - Math.abs(2 * li - 1));
    if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    h = (h + dh + 360) % 360; const l2 = Math.min(0.92, Math.max(0.08, li + dl));
    const c = (1 - Math.abs(2 * l2 - 1)) * sa, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m2 = l2 - c / 2;
    let rr = 0, gg = 0, bb = 0;
    if (h < 60) { rr = c; gg = x; } else if (h < 120) { rr = x; gg = c; } else if (h < 180) { gg = c; bb = x; }
    else if (h < 240) { gg = x; bb = c; } else if (h < 300) { rr = x; bb = c; } else { rr = c; bb = x; }
    const to = (v) => Math.round((v + m2) * 255).toString(16).padStart(2, "0");
    return "#" + to(rr) + to(gg) + to(bb);
  }
  const PATTERN_POOL = ["none", "stripe", "graphic", "check", "camo", "abstract"];
  function mutateDna(base, idx, version) {
    const d = JSON.parse(JSON.stringify(base));
    const set = (p, v) => DesignDNA.set(d, p, v, 1);
    const g = (p) => DesignDNA.get(d, p);
    const r1 = hash01(idx + 1, version, 1), r2 = hash01(idx + 1, version, 2), r3 = hash01(idx + 1, version, 3);
    // Farbe: Hue-Drift + Lichtjitter (Konzept-Index spreizt, Version verfeinert)
    const stops = (g("color.stops") || []).map((s, i) =>
      shiftHex(s, (idx - 1.5) * 34 + (version - 1) * 16 + i * 8, (r1 - 0.5) * 0.14));
    if (stops.length) set("color.stops", stops);
    // Fit/Finish: kleine, fühlbare Verschiebungen
    const fit = typeof g("silhouette.fit") === "number" ? g("silhouette.fit") : 0.5;
    set("silhouette.fit", Math.min(1, Math.max(0, fit + (r2 - 0.5) * 0.3)));
    const fin = typeof g("fabric.finishWeight") === "number" ? g("fabric.finishWeight") : 0.4;
    set("fabric.finishWeight", Math.min(1, Math.max(0, fin + (r3 - 0.5) * 0.36)));
    // Eine Variante wagt ein anderes Muster / eine andere Länge — ABER ein vom
    // User ENTSCHIEDENES "kein Muster" (conf ≥ 0.6; Inferenz stempelt nur bis
    // 0.5) bleibt respektiert (roadmap §8.2): statt der Muster-Lotterie dreht
    // diese Variante dann stärker an Farbton und Licht.
    const keepClean = g("pattern.type") === "none" && DesignDNA.confidence(d, "pattern.type") >= 0.6;
    if (idx % 2 === 1 && r1 > 0.35) {
      if (keepClean) {
        const swung = (g("color.stops") || []).map((s) => shiftHex(s, (r2 - 0.5) * 44, (r3 - 0.5) * 0.12));
        if (swung.length) set("color.stops", swung);
      } else {
        set("pattern.type", PATTERN_POOL[Math.floor(r2 * PATTERN_POOL.length) % PATTERN_POOL.length]);
        set("pattern.scale", 0.25 + r3 * 0.6);
      }
    }
    if (idx === 3 && r2 > 0.5) {
      const L = ["cropped", "regular", "long"]; const cur = Math.max(0, L.indexOf(g("length")));
      set("length", L[(cur + 1 + Math.floor(r3 * 2)) % 3]);
    }
    return d;
  }

  // ── Konzept-Namen aus dem Delta (roadmap §8.2) ─────────────────────────────
  // Vier fast identische dunkle Kacheln lesen sich nicht — jede Richtung
  // bekommt einen NAMEN aus dem, was sie tatsächlich verschiebt ("Wärmer ·
  // Weiter"). Pure: (Basis-DNA, Varianten-DNA) → bis zu 2 i18n-Keys, der
  // Aufrufer übersetzt. Unter Node testbar wie die anderen Helfer.
  function hexHue(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return null;
    const r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return null; // grau trägt keinen Farbton
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
  }
  // Distanz zum warmen Pol (30° Rot-Orange) auf dem Farbkreis — sinkt sie,
  // wurde die Variante wärmer.
  const warmDist = (h) => { const d = Math.abs(h - 30); return Math.min(d, 360 - d); };
  // Alle Achsen-Deltas einer Variante, nach Stärke sortiert. `strong` markiert
  // die alten Sichtbarkeits-Schwellen; darunterliegende Deltas bleiben als
  // Tie-Breaker für die Namens-Eindeutigkeit verfügbar (conceptLabelSets).
  function conceptCandidates(base, variant) {
    const gb = (p) => DesignDNA.get(base, p);
    const gv = (p) => DesignDNA.get(variant, p);
    const cand = [];
    const hb = hexHue((gb("color.stops") || [])[0]);
    const hv = hexHue((gv("color.stops") || [])[0]);
    if (hb != null && hv != null) {
      const dw = warmDist(hv) - warmDist(hb);
      if (dw) cand.push({ k: dw < 0 ? "concept.warmer" : "concept.cooler", m: Math.abs(dw) / 180 + 0.1, strong: Math.abs(dw) >= 10 });
    }
    const fb = gb("silhouette.fit"), fv = gv("silhouette.fit");
    if (typeof fb === "number" && typeof fv === "number" && fv !== fb)
      cand.push({ k: fv > fb ? "concept.wider" : "concept.slimmer", m: Math.abs(fv - fb) * 1.4, strong: Math.abs(fv - fb) >= 0.06 });
    const nb = gb("fabric.finishWeight"), nv = gv("fabric.finishWeight");
    if (typeof nb === "number" && typeof nv === "number" && nv !== nb)
      cand.push({ k: nv > nb ? "concept.sheen" : "concept.matte", m: Math.abs(nv - nb), strong: Math.abs(nv - nb) >= 0.08 });
    const pb = gb("pattern.type") || "none", pv = gv("pattern.type") || "none";
    if (pb !== pv) cand.push({ k: pv === "none" ? "concept.cleaner" : "concept.pattern", m: 0.42, strong: true });
    const lb = gb("length"), lv = gv("length");
    if (lb !== lv && lv) cand.push({ k: "concept.len_" + lv, m: 0.4, strong: true });
    cand.sort((a, b) => b.m - a.m);
    return cand;
  }
  function conceptDeltas(base, variant) {
    const keys = conceptCandidates(base, variant).filter((c) => c.strong).slice(0, 2).map((c) => c.k);
    return keys.length ? keys : ["concept.subtle"];
  }
  // Eindeutige Namen für ALLE Richtungen einer Runde: zwei von vier Kacheln
  // hiessen real identisch „Muster gewagt · Kühler" (jeder Branch, U6). Bei
  // Kollision kommt die nächststärkste, noch ungenutzte Achse dazu (max. 3),
  // danach ersetzt sie die schwächste. Zwei wirklich identische Deltas dürfen
  // identisch heissen — das wäre dann ehrlich.
  function conceptLabelSets(base, variants) {
    const seen = new Set();
    return (variants || []).map((v) => {
      const K = conceptCandidates(base, v).map((c) => c.k);
      let keys = conceptDeltas(base, v);
      for (let n = 0; seen.has(keys.join("|")) && n < K.length + 1; n++) {
        const extra = K.find((k) => !keys.includes(k));
        if (!extra) break;
        keys = keys.length < 3 ? keys.concat(extra) : [keys[0], extra];
      }
      seen.add(keys.join("|"));
      return keys;
    });
  }

  // ── "Made for one" (roadmap §9) ────────────────────────────────────────────
  // Gentle silhouette multipliers from the user's own measurements, relative
  // to the M reference body: the shoulder drives the frame, the waist/chest
  // ratio the suppression, the hips the trouser/skirt frame. Capped at ±8 %
  // (GarmentSVG clamps again) — a subtle personal silhouette, never a
  // caricature. Pure; null when nothing usable exists (flat stays generic).
  function bodyFactors(m, ref) {
    const R = ref || ((typeof CONFIG !== "undefined" && CONFIG.MEASUREMENT_PRESETS && CONFIG.MEASUREMENT_PRESETS.M) || { chest: 96, waist: 82, hips: 98, shoulder: 44 });
    if (!m || typeof m !== "object") return null;
    const num = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);
    const cl = (v) => Math.max(0.92, Math.min(1.08, v));
    const shoulder = num(m.shoulder), chest = num(m.chest), waist = num(m.waist), hips = num(m.hips);
    if (!shoulder && !chest && !waist && !hips) return null;
    const f = { shoulder: 1, waist: 1, hip: 1 };
    if (shoulder) f.shoulder = cl(shoulder / R.shoulder);
    // Waist relative to the chest (the suppression), normalised by the
    // reference ratio — the absolute waist alone would just rescale the flat.
    if (waist && chest) f.waist = cl((waist / chest) / (R.waist / R.chest));
    else if (waist) f.waist = cl(waist / R.waist);
    if (hips) f.hip = cl(hips / R.hips);
    return f;
  }

  // Honest progress: a calm orientation stepper over the journey's named phases
  // (A–E). NOT a 0–100% gauge — the journey is adaptive and always-viable, so a
  // fill bar would have to invent a finish line (which is exactly what made the
  // old maturity ring read as "already finished"). The stepper only answers
  // "where am I"; readiness ("you can finish whenever") stays on the "Fertig"
  // button. Phase F (refine) lights every beat as traversed. Pure + label-injected
  // so it stays unit-testable; labels come from i18n (trusted, not user input).
  const PHASE_ORDER = "ABCDEF";
  const PHASE_BEATS = [
    { p: "A", key: "engine.phase_feeling" },
    { p: "B", key: "engine.phase_form" },
    { p: "C", key: "engine.phase_fabric" },
    { p: "D", key: "engine.phase_color" },
    { p: "E", key: "engine.phase_details" },
  ];
  function phaseStepper(currentPhase, label) {
    const ci = Math.max(0, PHASE_ORDER.indexOf(String(currentPhase || "A").toUpperCase()));
    return PHASE_BEATS.map((b, i) => {
      const oi = PHASE_ORDER.indexOf(b.p);
      const state = oi < ci ? "done" : oi === ci ? "cur" : "todo";
      const bar = i < PHASE_BEATS.length - 1
        ? `<span class="de-step-bar${oi < ci ? " is-done" : ""}"></span>` : "";
      return `<span class="de-step is-${state}"><span class="de-step-dot"></span>${label(b.key)}</span>${bar}`;
    }).join("");
  }

  // The preview chip shows the WORD THE USER TAPPED, not a second vocabulary:
  // look up the current category's node choice that sets `path` to `value`
  // ("Mini" stays "Mini", never a generic "Cropped"; "A-Linie" never a raw
  // "Aline"). Inferred values get the same word the user WOULD have tapped.
  // Pure (nodes + category in, word out) so the offline suite can cover it.
  // Mobile dock visibility (roadmap §4): the docked mini-preview appears only
  // when the loop is otherwise broken — small screen, the real preview
  // scrolled out of view, but the user still inside the journey. Pure so the
  // offline suite can pin the truth table.
  function dockShouldShow(small, previewInView, stageInView) {
    return !!small && !previewInView && !!stageInView;
  }

  // Of all matching choices, the one setting the FEWEST paths wins: the
  // dedicated card for a dimension sets little besides that dimension, while
  // a side-effect setter carries its own attribute too (the dress subarch
  // "Slip" also sets fabric.material=silk and would otherwise label the
  // STOFF chip "Slip" instead of the material card's "Seide").
  function choiceWord(nodes, category, lang, path, value) {
    if (!category || value == null) return null;
    let best = null;
    let bestKeys = Infinity;
    (nodes || []).forEach((n) => {
      if (!n.id || n.id.indexOf(category + "_") !== 0 || !n.choices) return;
      n.choices.forEach((c) => {
        const set = c.effects && c.effects.set;
        if (!set || set[path] !== value || !c.label) return;
        const keys = Object.keys(set).length;
        if (keys < bestKeys) { bestKeys = keys; best = c.label[lang] || c.label.de; }
      });
    });
    return best;
  }

  function mirror(dna, attributes) {
    const map = attributes.stateMap || {};
    Object.entries(map).forEach(([dnaPath, stateKey]) => {
      const v = DesignDNA.get(dna, dnaPath);
      if (v !== undefined && v !== null) S(stateKey, v);
    });
  }


  // Short human label of what a choice just changed (micro-feedback, brief §7).
  function changeLabel(node, payload, l) {
    if (node.modality === "describe") {
      return payload && payload.skip ? t("engine.dsc_skipped") : t("engine.dsc_read_label");
    }
    if (node.modality === "ranking") {
      const top = (node.options || []).find((o) => o.id === (payload || [])[0]);
      return top && top.label ? top.label[l] : "";
    }
    if (node.modality === "cards" && Array.isArray(payload)) return payload.length + "×";
    if (node.modality === "regions") {
      const n = payload && typeof payload === "object" ? Object.keys(payload).length : 0;
      return n ? n + "×" : t("engine.changed_details");
    }
    if (node.modality === "cards") {
      const c = (node.choices || []).find((x) => x.id === payload);
      return c && c.label ? c.label[l] : "";
    }
    if (node.modality === "thisOrThat") {
      const c = (node.pair || []).find((x) => x.id === payload);
      return c && c.label ? c.label[l] : "";
    }
    if (node.modality === "slider") {
      const ax = node.axis && node.axis[l];
      if (!ax) return "";
      return payload > 0.66 ? ax[1] : payload < 0.34 ? ax[0] : "·";
    }
    if (node.modality === "colorGradient") return t("engine.changed_color");
    return "";
  }

  function mount(hostEl, opts) {
    const options = opts || {};
    const base = options.contentBase || DEFAULT_BASE;
    let dna = seedDefaults(DesignDNA.create());
    let answered = new Set();
    const history = [];
    let content = null;
    let currentNode = null;
    // Pre-live snapshot of any path a slider/live modality mutates via ctx.live()
    // before the user commits — { path: { value, confidence } }, captured lazily
    // on first live() write per node so Skip can discard unconfirmed edits
    // instead of baking them into the DNA (see skipBtn handler below).
    let pendingLive = null;
    let generated = false;
    // Stamped on every question/refine render; commits within COMMIT_GUARD_MS
    // of it are ignored (double-tap protection, see isGuardedTap above).
    let lastRenderAt = 0;
    // True only on the Phase-F refine screen → the preview crossfades from the
    // morphing flat to the recoloured hero photo (realism layer, brief §1).
    let atRefine = false;
    // A11y: focus moves to each new question heading as the journey advances —
    // but not on the very first mount (the user just arrived; avoid a jump).
    let firstQuestionShown = false;
    // Highest phase index the orientation stepper has reached — it must only
    // ever advance. When a node surfaces slightly out of phase order (e.g. a
    // Phase-C finish slider scoring just after the Phase-D colour step), the
    // stepper clamps to this so it never visibly jumps backward. Reset on restart.
    let maxPhaseIdx = -1;
    const T = (event, props) => { if (window.DesignTelemetry) window.DesignTelemetry.track(event, props); };

    hostEl.classList.add("de-stage");
    hostEl.innerHTML = `
      <div class="de-stage-grid">
        <div class="de-preview-col">
          <div class="de-preview-stage">
            <div class="de-preview" id="de-preview" aria-hidden="true"></div>
            <span class="de-flash" id="de-flash" role="status" aria-live="polite"></span>
          </div>
          <div class="de-preview-chips" id="de-preview-chips"></div>
          <p class="de-body-caption" id="de-body-caption" hidden data-i18n="engine.body_caption">${t("engine.body_caption")}</p>
          <button type="button" class="de-preview-dock" id="de-preview-dock" hidden aria-label="${t("engine.dock_aria")}">
            <span class="de-dock-flat" aria-hidden="true"></span>
          </button>
        </div>
        <div class="de-ask-col">
          <div class="de-stepper" id="de-stepper" role="img"></div>
          <span class="de-phase-flash" id="de-phase-flash" aria-hidden="true"></span>
          <div class="de-body" id="de-body"></div>
          <p class="de-live" id="de-live"></p>
          <div class="de-controls">
            <button type="button" class="de-nav" id="de-back" data-i18n="engine.back" disabled>${t("engine.back")}</button>
            <button type="button" class="de-nav" id="de-skip" data-i18n="engine.skip" disabled>${t("engine.skip")}</button>
            <button type="button" class="de-nav" id="de-restart" data-i18n="engine.restart" disabled>${t("engine.restart")}</button>
            <button type="button" class="de-nav de-finish" id="de-finish" data-i18n="engine.finish_early" hidden>${t("engine.finish_early")}</button>
          </div>
        </div>
      </div>`;

    const body = hostEl.querySelector("#de-body");
    const stepperEl = hostEl.querySelector("#de-stepper");
    const live = hostEl.querySelector("#de-live");
    const previewEl = hostEl.querySelector("#de-preview");
    const flashEl = hostEl.querySelector("#de-flash");
    const backBtn = hostEl.querySelector("#de-back");
    const skipBtn = hostEl.querySelector("#de-skip");
    const restartBtn = hostEl.querySelector("#de-restart");
    const finishBtn = hostEl.querySelector("#de-finish");

    const maturity = () => DesignDNA.maturity(dna, content.attributes.required, content.attributes.confidenceThreshold);

    // ── Mobile dock mini-preview (roadmap §4) ───────────────────────────────
    // ≤480 px the preview column is static and scrolls away exactly when the
    // visual decisions (colour, fit) happen. The dock keeps a tiny live flat
    // in the thumb corner — it mirrors every render AND every morph frame
    // (render-preview's opts.mirror), and tapping it scrolls back up to the
    // full preview. Functional UI, not decoration: shown regardless of
    // html.fx; its entrance transition is CSS-gated on reduced-motion.
    const dockBtn = hostEl.querySelector("#de-preview-dock");
    const dockFlat = hostEl.querySelector(".de-dock-flat");
    // position:fixed is hijacked inside the studio: the revealed section keeps
    // an identity transform and .design-journey has will-change:transform —
    // both make ancestors the containing block, so the dock would render
    // mid-page and scroll with the content. Hoist it to <body>.
    if (dockBtn && typeof document !== "undefined" && document.body) document.body.appendChild(dockBtn);
    const smallScreen = () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(max-width: 480px)").matches
        : false;
    let previewInView = true;
    let stageInView = true;
    const syncDock = () => {
      if (!dockBtn) return;
      // Im Regions-Cockpit ist die Bühne bewusst aus (das Board zeigt das
      // Flat selbst) — der Dock darf dann nicht über dem Board aufpoppen.
      if (hostEl.dataset.deMod === "regions") {
        dockBtn.hidden = true;
        dockBtn.classList.remove("is-on");
        return;
      }
      const show = dockShouldShow(smallScreen(), previewInView, stageInView);
      dockBtn.hidden = !show;
      // .is-on drives the CSS entrance (fade/rise) after unhide.
      requestAnimationFrame(() => dockBtn.classList.toggle("is-on", show));
    };
    if (dockBtn && typeof IntersectionObserver !== "undefined") {
      // 0.3: a bottom sliver of the stage (floor shadow, no garment) must not
      // count as "the user can see the preview" — only ≥30% visible hides the
      // dock, so it survives the per-answer focus-scroll to the next question.
      new IntersectionObserver((entries) => {
        entries.forEach((e) => { previewInView = e.isIntersecting; });
        syncDock();
      }, { threshold: 0.3 }).observe(hostEl.querySelector("#de-preview"));
      new IntersectionObserver((entries) => {
        entries.forEach((e) => { stageInView = e.isIntersecting; });
        syncDock();
      }).observe(hostEl);
      window.matchMedia("(max-width: 480px)").addEventListener("change", syncDock);
      dockBtn.addEventListener("click", () => {
        // Hand-rolled tween: native smooth scrollIntoView/scrollTo are dead in
        // Chromium under the global overflow-x:hidden (same workaround as
        // ur-create.js's ownership scroll). Reduced-motion jumps instantly.
        const target = hostEl.querySelector("#de-preview");
        const to = target.getBoundingClientRect().top + window.scrollY - 72;
        const from = window.scrollY;
        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) { window.scrollTo(0, to); return; }
        const t0 = performance.now();
        const D = 450;
        const ease = (x) => 1 - Math.pow(1 - x, 3);
        const step = (now) => {
          const x = Math.min(1, (now - t0) / D);
          window.scrollTo(0, from + (to - from) * ease(x));
          if (x < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }

    // ── Question-swap choreography (roadmap §6) ─────────────────────────────
    // Two phases: the outgoing content sinks away (150 ms), then the new
    // question's children stagger in (CSS .is-entering, ≤250 ms total). Only
    // under html.fx and without prefers-reduced-motion — everyone else keeps
    // the instant swap. While leaving, commits are blocked (swapping flag +
    // pointer-events CSS); a second navigation during the leave simply
    // replaces the pending paint, so back/skip can't double-render.
    let swapping = false;
    let pendingPaint = null;
    const fxOn = () => typeof document !== "undefined" && document.documentElement.classList.contains("fx");
    const reduceMotion = () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    function swapBody(paint) {
      if (!fxOn() || reduceMotion() || !firstQuestionShown) { paint(); return; }
      pendingPaint = paint;
      if (swapping) return; // leave already running — it will paint the latest
      swapping = true;
      // The leave owns its frames: nothing else runs during the sink-out (the
      // preview morph is deliberately inside paint(), i.e. after the leave —
      // starting it earlier starves the leave animation on slow devices).
      body.classList.add("is-leaving");
      setTimeout(() => {
        body.classList.remove("is-leaving");
        swapping = false;
        const p = pendingPaint;
        pendingPaint = null;
        if (p) p();
        body.classList.add("is-entering");
        setTimeout(() => body.classList.remove("is-entering"), 450);
      }, 150);
    }

    // ── Ankunfts-Beat (roadmap §8.1): der Satz tippt sich in Mono auf ──────
    // Die Maschinenstimme spricht das Design aus, EINEN Atemzug bevor die
    // Optionen erscheinen (deren Eintritt verzögert .is-refine im CSS).
    // Ohne fx / mit reduced-motion: sofort voller Text. Ein Re-Render bricht
    // die laufende Animation sauber ab (cancelTypeOn).
    let typeRaf = 0;
    function cancelTypeOn() { if (typeRaf) { cancelAnimationFrame(typeRaf); typeRaf = 0; } }
    function typeOn(el, text) {
      cancelTypeOn();
      if (!el) return;
      if (!fxOn() || reduceMotion()) { el.textContent = text; return; }
      el.classList.add("is-typing");
      // Wall-clock statt Frame-Zählung: bei ~13 fps (Headless, Low-End) tippte
      // der Satz sonst sekundenlang und stand in jedem Standbild „abgeschnitten"
      // mitten im Wort (Atelier-Analyse U6). Jetzt ist die Dauer geräte-
      // unabhängig: ~110 Zeichen/s ≙ den bisherigen 2 Zeichen pro 60-fps-Frame.
      const CPS = 110;
      const startedAt = nowMs();
      const step = () => {
        const i = Math.min(text.length, Math.ceil(((nowMs() - startedAt) / 1000) * CPS));
        el.textContent = text.slice(0, i);
        if (i < text.length) typeRaf = requestAnimationFrame(step);
        else { typeRaf = 0; el.classList.remove("is-typing"); }
      };
      typeRaf = requestAnimationFrame(step);
    }

    // Phase interstitial: crossing A→B→…→F flashes the new chapter's mono
    // title on its permanently reserved line (no layout jump) and pulses the
    // stepper's current beat. Decorative (aria-hidden) — the stepper's
    // aria-label already announces the phase to assistive tech.
    const phaseFlashEl = hostEl.querySelector("#de-phase-flash");
    let lastPhase = null;
    let phaseFlashTimer = null;
    function phaseFlash(phase) {
      if (!phaseFlashEl || !fxOn() || reduceMotion()) return;
      const ci = PHASE_ORDER.indexOf(String(phase || "A").toUpperCase());
      const beat = PHASE_BEATS[ci < 0 ? 0 : Math.min(ci, PHASE_BEATS.length - 1)];
      phaseFlashEl.textContent = t(beat.key);
      phaseFlashEl.classList.remove("is-on");
      void phaseFlashEl.offsetWidth;
      phaseFlashEl.classList.add("is-on");
      stepperEl.classList.remove("is-crossed");
      void stepperEl.offsetWidth;
      stepperEl.classList.add("is-crossed");
      clearTimeout(phaseFlashTimer);
      phaseFlashTimer = setTimeout(() => { phaseFlashEl.classList.remove("is-on"); phaseFlashEl.textContent = ""; }, 950);
    }

    const chipsEl = hostEl.querySelector("#de-preview-chips");
    function updatePreview(animate) {
      // Render the COMPLETED design (chosen + inferred-from-archetype) so the
      // preview takes shape early and evolves with every mood/colour choice —
      // not a static placeholder until the last question.
      const previewDna = JSON.parse(JSON.stringify(dna));
      DesignEngine.finalize(previewDna, content.archetypes, content.attributes.required, content.attributes.confidenceThreshold);
      // Inferenz-Füllungen, die die Kategorie nicht zeichnen kann, fliegen auch
      // aus dem Preview-Klon (Ursache 1 — sonst trägt das Tee im Preview die
      // Knopfleiste, die der Refine-Scrub später entfernt).
      syncDerivedFinish(previewDna);
      scrubImpossibleFills(previewDna, content.attributes.confidenceThreshold,
        window.GarmentSVG && window.GarmentSVG.closureAllowed);
      // The user's own choices ALWAYS win over the archetype inference — incl.
      // live slider drags (set at confidence 0), which finalize would otherwise
      // overwrite, making the Passform/Finish sliders feel dead. Overlay them.
      LIVE_PATHS.forEach((path) => {
        const v = DesignDNA.get(dna, path);
        if (v !== undefined && v !== null) DesignDNA.set(previewDna, path, v, 1);
      });
      if (window.DesignPreview) {
        if (animate) { previewEl.classList.remove("is-fade"); void previewEl.offsetWidth; previewEl.classList.add("is-fade"); }
        // Genesis: as long as the USER hasn't decided a category (raw-DNA
        // confidence, not the inferred preview clone), no garment is shown —
        // the abstract thread-flow builds up instead, and the category answer
        // weaves it into the silhouette. progress staggers the materialisation.
        const catConf = DesignDNA.confidence(dna, "category");
        // "Made for one" (§9): once measurements exist, the flat carries the
        // user's own proportions — the brand thesis made visible.
        const body = bodyFactors(window.StateManager ? window.StateManager.get("measurements") : null);
        window.DesignPreview.renderInto(previewEl, previewDna, {
          // Refine-Held ist das ECHTE Flat des Users, nicht mehr das kuratierte
          // Foto: trotz Honesty-Gate zeigte der Shirt-Branch ein rosa Preset
          // gegen einen Burgunder-Build (Atelier-Analyse U6). Der Flat ist
          // immer korrekt — das Foto-Moment gehört dem generierten Render im
          // Ownership-Beat. (Gate + Manifest bleiben für die Zukunft im Code.)
          realism: false,
          photoManifest: content.photoManifest,
          mirror: dockFlat,
          genesis: catConf < (content.attributes.confidenceThreshold || 0.5),
          progress: 0.38 + maturity() * 0.62,
          seed: answered.size,
          body,
        });
        // U2: das personalisierte Zeichnen war komplett stumm — eine leise
        // Mono-Zeile benennt es, sobald echte Masse einfliessen (und ein
        // Kleidungsstück sichtbar ist, nicht die Genesis-Wolke).
        const bodyCap = hostEl.querySelector("#de-body-caption");
        if (bodyCap) bodyCap.hidden = !(body && catConf >= (content.attributes.confidenceThreshold || 0.5));
      }
      // Attribut-Chips unter der Vorschau (brief §3.1) — geben pro Wahl
      // sichtbares Feedback (Subarch/Fit/Länge/Material/Muster), nicht ins Foto.
      if (chipsEl) {
        const g = (p) => DesignDNA.get(previewDna, p);
        const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");
        // Each chip carries a mono dimension micro-label so two same-worded
        // values never blur ("FIT Regular · LÄNGE Regular", not "Regular ·
        // Regular") and every chip says which decision it reflects.
        const chips = [];
        const cat = DesignDNA.get(dna, "category");
        // Only surface a chip for a dimension the USER actually decided — its RAW
        // confidence must clear the threshold. An archetype-inferred fill sits at
        // exactly the threshold (completeFrom) and must NOT read as a committed
        // choice; that was the "inferred value shown as decided before its step"
        // report. The displayed value still comes from previewDna via g() so the
        // wording matches the flat.
        const chipTh = (content.attributes && content.attributes.confidenceThreshold) || 0.5;
        const decided = (path) => DesignDNA.confidence(dna, path) > chipTh;
        if (cat) {
          const word = (path, value) => choiceWord(content.nodes, cat, lang(), path, value);
          const sub = g("subArchetype"); if (sub && decided("subArchetype")) chips.push({ dim: t("chip.style"), text: word("subArchetype", sub) || cap(sub) });
          const fit = g("silhouette.fit");
          if (typeof fit === "number" && decided("silhouette.fit")) chips.push({ dim: t("chip.fit"), text: window.I18N ? window.I18N.t(fit < 0.33 ? "fit.slim" : fit > 0.66 ? "fit.oversized" : "fit.regular") : (fit < 0.33 ? "Slim" : fit > 0.66 ? "Oversized" : "Regular") });
          const len = g("length"); if (len && decided("length")) chips.push({ dim: t("chip.length"), text: word("length", len) || (window.I18N ? window.I18N.t("length." + len) : len) });
          const mat = g("fabric.material"); if (mat && decided("fabric.material")) chips.push({ dim: t("chip.material"), text: word("fabric.material", mat) || (window.I18N ? window.I18N.material(mat) : mat) });
          const pat = g("pattern.type"); if (pat && pat !== "none" && decided("pattern.type")) chips.push({ dim: t("chip.pattern"), text: word("pattern.type", pat) || (window.I18N ? window.I18N.pattern(pat) : pat) });
        }
        const frag = document.createDocumentFragment();
        chips.forEach((c) => {
          const span = document.createElement("span");
          span.className = "de-preview-chip";
          const dim = document.createElement("span");
          dim.className = "de-chip-dim";
          dim.textContent = c.dim;
          span.appendChild(dim);
          span.appendChild(document.createTextNode(c.text));
          frag.appendChild(span);
        });
        chipsEl.textContent = "";
        chipsEl.appendChild(frag);
      }
      // The live sentence only appears once it reads as a sentence — below
      // half maturity it would be a bare fragment ("Stück.", "Jacke.") that
      // looks like debris under the controls (roadmap §3.1). On the refine
      // screen the typed-on summary IS the design's voice — the same sentence
      // a second time under the controls was §8.4's duplicate; suppress it.
      live.textContent = (!atRefine && maturity() >= 0.5) ? DesignSummary.toSentence(dna, lang()) : "";
    }
    // Orientation stepper: light the current phase, mark earlier ones done.
    // Label it for assistive tech with the current beat ("Design-Phase: Stoff").
    function updateStepper(phase) {
      const p = String(phase || "A").toUpperCase();
      let ci = PHASE_ORDER.indexOf(p);
      if (ci < 0) ci = 0;
      // Monotonic: the stepper only ever advances. If a node surfaces out of
      // phase order (a Phase-C finish slider scoring just after Phase-D colour),
      // clamp the displayed phase to the furthest reached so the arc never jumps
      // backward. Phase F (refine) is the natural high-water mark at the end.
      if (ci < maxPhaseIdx) ci = maxPhaseIdx; else maxPhaseIdx = ci;
      const shown = PHASE_ORDER[ci] || "A";
      const beat = PHASE_BEATS[Math.min(ci, PHASE_BEATS.length - 1)];
      // Phase F (refine/generate) has no beat of its own — clamping to E's
      // "Details" would announce the wrong word right as the user arrives at
      // the refine screen (same trap phaseFlash's comment calls out above).
      const label = shown === "F" ? t("engine.refine_title") : t(beat.key);
      stepperEl.innerHTML = phaseStepper(shown, (k) => t(k));
      stepperEl.setAttribute("aria-label", t("engine.phase_aria") + ": " + label);
    }
    function refreshChrome() {
      const m = maturity();
      updatePreview(true);
      backBtn.disabled = history.length === 0;
      // "Fertig" appears once the required attributes are mature enough to
      // generate — an explicit user affordance, not a "you're done" gauge.
      finishBtn.hidden = m < 0.6;
    }
    let flashTimer = null;
    function flash(text) {
      if (!text) return;
      flashEl.textContent = text;
      flashEl.classList.add("is-on");
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => flashEl.classList.remove("is-on"), 1600);
    }

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ dna, answered: [...answered] }));
      } catch (_e) { /* private mode / quota */ }
    }
    function loadSaved() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const o = JSON.parse(raw);
        // Both fields must be well-formed: resume reads o.dna.archetypeWeights
        // straight away, so a truncated/hand-edited blob with a missing or
        // non-object dna would throw a TypeError that dead-ends the journey on
        // `engine.load_fail` (and logs a console error). Treat it as no save.
        if (!o || !Array.isArray(o.answered)) return null;
        if (!o.dna || typeof o.dna !== "object") return null;
        return o;
      } catch (_e) { return null; }
    }
    function clearSaved() { try { localStorage.removeItem(STORAGE_KEY); } catch (_e) { /* no-op */ } }

    function snapshot() { history.push({ dna: JSON.parse(JSON.stringify(dna)), answered: new Set(answered) }); }

    const ctx = {
      get lang() { return lang(); },
      get dna() { return dna; },
      t,
      live(payload) {
        const { eff } = resolveEffects(currentNode, payload);
        if (eff && eff.set) {
          if (!pendingLive) pendingLive = {};
          Object.entries(eff.set).forEach(([p, v]) => {
            if (!(p in pendingLive)) pendingLive[p] = { value: DesignDNA.get(dna, p), confidence: DesignDNA.confidence(dna, p) };
            DesignDNA.set(dna, p, v, 0);
          });
        }
        mirror(dna, content.attributes);
        updatePreview();
      },
      commit(payload) {
        if (swapping || isGuardedTap(nowMs(), lastRenderAt)) return;
        const { eff: rawEff, conf } = resolveEffects(currentNode, payload);
        // Explizit schlägt Nebeneffekt: bereits selbst beantwortete Dimensionen
        // bleiben stehen (Ursache 1 der Atelier-Analyse).
        const eff = protectExplicit(dna, currentNode, rawEff);
        if (currentNode) T("node_choice", { id: currentNode.id, modality: currentNode.modality });
        snapshot();
        // Gutgeschriebene Sprünge (U2 „die Maschine liest mit"): Fragen, die
        // durch DIESE Antwort wegfallen (when-Gates/Konfidenz — nicht die
        // beantwortete selbst), werden im Flash benannt statt still
        // verschluckt. Das ist der billigste sichtbare Beweis des Zuhörens.
        const beforeIds = new Set(DesignEngine.eligible(content.nodes, dna, answered).map((n) => n.id));
        const answeredId = currentNode && currentNode.id;
        DesignEngine.answer(dna, currentNode, eff, answered, conf);
        syncDerivedFinish(dna);
        const afterIds = new Set(DesignEngine.eligible(content.nodes, dna, answered).map((n) => n.id));
        let saved = 0;
        beforeIds.forEach((nid) => { if (nid !== answeredId && !afterIds.has(nid)) saved++; });
        flash("✓ " + changeLabel(currentNode, payload, lang()) +
          (saved ? " · " + t(saved === 1 ? "engine.saved_one" : "engine.saved_many", { n: saved }) : ""));
        mirror(dna, content.attributes);
        pendingLive = null;
        persist();
        renderNext();
      },
    };

    function renderModality(node) {
      atRefine = false; // back to the morphing flat for any question
      currentNode = node;
      pendingLive = null;
      // Cockpit-Regie (≤899px): das CSS liest die aktive Modalität am Host —
      // Regions blendet die Bühne aus (das Board TRÄGT das Flat), Describe/
      // Refine bekommen eine kompaktere Bühne für mehr Blatt-Raum.
      hostEl.dataset.deMod = node.modality;
      updateStepper(node.phase);
      const crossed = lastPhase !== null && node.phase !== lastPhase;
      lastPhase = node.phase;
      T("node_shown", { id: node.id, phase: node.phase, modality: node.modality, lang: lang() });
      // Journey breadcrumb for Sentry: which step the user was on when an error
      // later fires (no answer values — only node id / phase / garment category).
      if (window.Sentry) {
        window.Sentry.addBreadcrumb({
          category: "journey", level: "info", message: "node_shown",
          data: { id: node.id, phase: node.phase, garment: DesignDNA.get(dna, "category") },
        });
      }
      const renderer = window.DEModalities && window.DEModalities[node.modality];
      if (!renderer) { console.warn("[DesignFlow] no modality:", node.modality); return renderRefine(); }
      swapBody(() => {
        lastRenderAt = nowMs(); // guard counts from the visible paint
        cancelTypeOn();
        body.classList.remove("is-refine"); // "Tiefer verfeinern" kehrt zur Frage zurück
        clearNameplate(); // zurück in die Reise → das Namensschild gehört zum Ergebnis
        // Preview refresh (morph) starts WITH the new question's entrance —
        // one clean sequence: sink out → question staggers in while the
        // garment reshapes. (Running it during the leave starves the leave.)
        refreshChrome();
        renderer(body, node, ctx);
        // Opening frame (roadmap C2): on the very first question — nothing
        // decided yet — a quiet mono line names what's happening (YOU design
        // your piece, and it begins with the feeling), so the abstract mood
        // opener reads as the start of designing a garment, not a mood quiz. It
        // lives INSIDE the swapping body so it enters with the question and is
        // simply absent from the next screen on (no separate chrome → no layout
        // jump). The engine always surfaces a Phase-A feeling node first, so
        // answered.size === 0 is exactly (and only) that screen.
        if (answered.size === 0) {
          const frame = document.createElement("p");
          frame.className = "de-opening-frame";
          frame.setAttribute("data-i18n", "engine.opening_frame");
          frame.textContent = t("engine.opening_frame");
          body.insertBefore(frame, body.firstChild);
        }
        if (crossed) phaseFlash(node.phase);
        // A11y: each render replaces the question DOM, so the control the user
        // just activated is gone and focus falls to <body> — leaving keyboard/SR
        // users with no announcement of the new question and a blind re-Tab from
        // the top. Move focus to the new question heading (focusable via
        // tabindex=-1), which both announces it and makes the next Tab land
        // logically. Skip the first mount so arriving doesn't yank the viewport.
        const q = body.querySelector(".de-question");
        if (q) {
          q.setAttribute("tabindex", "-1");
          if (firstQuestionShown) focusQuestion(q);
          else firstQuestionShown = true;
        }
      });
    }

    // Cockpit (≤899px): der A11y-Fokus auf die neue Frage darf die SEITE nicht
    // verschieben — real geschah genau das (Frage-Fokus scrollte den Rahmen
    // 250px+ nach oben, die Bühne verschwand, der Dock sprang ein). Im
    // Cockpit steht der Rahmen; nur das Blatt (de-body) springt für die neue
    // Frage auf Anfang. Desktop (Zwei-Spalten, sticky Bühne) behält den
    // normalen Fokus-Scroll.
    const cockpitActive = () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(max-width: 899px)").matches
        : false;
    function focusQuestion(q) {
      if (!cockpitActive()) { q.focus(); return; }
      try { q.focus({ preventScroll: true }); } catch (_e) { q.focus(); }
      body.scrollTop = 0;
      // Rahmen bündig nachziehen, falls doch etwas bewegt hat (Tastatur zu,
      // alte Engines ohne preventScroll) — nur bei echter Verschiebung.
      const top = hostEl.getBoundingClientRect().top;
      if (Math.abs(top) > 48) hostEl.scrollIntoView({ block: "start" });
    }

    function renderNext() {
      // Kein refreshChrome hier: renderModality/renderRefine rendern selbst.
      // Ein doppelter Render würde u. a. die einmalige Weave-In-Animation
      // (Genesis → Silhouette) sofort wieder überschreiben.
      const node = DesignEngine.nextNode(content.nodes, dna, answered);
      if (!node) return renderRefine();
      renderModality(node);
    }

    // Phase F — inference & confirmation (brief §6F): complete the DNA, show it
    // in words + the inferred fills, let the user nudge warmer/colder, or dive
    // deeper, then generate.
    function renderRefine() {
      T("journey_refine", { archetype: DesignDNA.topArchetype(dna), maturity: Math.round(maturity() * 100) });
      // Any live slider drag / region pick still sitting at confidence 0 (the
      // user never hit the modality's own confirm) must win over the archetype
      // default here too — the same reason updatePreview() overlays LIVE_PATHS
      // onto its preview clone above, just applied to the real dna this time,
      // since this is the value that actually ships (finalize/persist/share).
      LIVE_PATHS.forEach((path) => {
        const v = DesignDNA.get(dna, path);
        if (v !== undefined && v !== null) DesignDNA.set(dna, path, v, 1);
      });
      pendingLive = null;
      syncDerivedFinish(dna);
      DesignEngine.finalize(dna, content.archetypes, content.attributes.required, content.attributes.confidenceThreshold);
      // Nach dem Füllen: unbaubare Inferenz-Werte raus, BEVOR Chips/Satz/
      // Spec/Share sie je sehen (Ursache 1 der Atelier-Analyse).
      scrubImpossibleFills(dna, content.attributes.confidenceThreshold,
        window.GarmentSVG && window.GarmentSVG.closureAllowed);
      mirror(dna, content.attributes);
      persist();
      currentNode = null;
      lastPhase = "F";
      hostEl.dataset.deMod = "refine";
      atRefine = true; // Phase F → crossfade the flat to the realism photo
      updateStepper("F"); // the arc is traversed; the user is refining/generating
      finishBtn.hidden = true;
      const l = lang();
      const sugg = window.DesignInference ? DesignInference.suggestions(dna, content.attributes, l) : [];
      const chips = sugg.length
        ? `<div class="de-inferred"><p class="de-inferred-h">${t("engine.refine_inferred")}</p><div class="de-chips">${
            sugg.map((s) => `<span class="de-chip">${s.label}: <b>${s.valueLabel}</b></span>`).join("")}</div></div>`
        : "";
      const axisRows = (window.DesignInference ? ["energy", "brightness", "temperature"] : []).map((ax) => {
        const label = DesignInference.AXES[ax][l === "en" ? "en" : "de"];
        return `<div class="de-axis"><span class="de-axis-label">${label}</span>
          <button type="button" class="de-nudge" data-ax="${ax}" data-dir="-1" aria-label="${label} ${t("engine.nudge_down")}">${t("engine.nudge_down")}</button>
          <button type="button" class="de-nudge" data-ax="${ax}" data-dir="1" aria-label="${label} ${t("engine.nudge_up")}">${t("engine.nudge_up")}</button></div>`;
      }).join("");

      swapBody(() => {
      lastRenderAt = nowMs(); // guard counts from the visible paint
      refreshChrome(); // realism crossfade starts with the refine screen's entrance
      // Ankunfts-Beat (roadmap §8.1): .is-refine verzögert im CSS den Eintritt
      // der Options-Sektionen, während der Satz sich in Mono auftippt — die
      // finale Materialisierung der Vorschau läuft synchron (refreshChrome).
      body.classList.add("is-refine");
      body.innerHTML = `
        <h2 class="de-question">${t("engine.refine_title")}</h2>
        <p class="de-summary de-summary-type" id="de-refine-summary"></p>
        <div class="de-concepts">
          <p class="de-inferred-h">${t("engine.concepts_title")}</p>
          <div class="de-concept-grid" id="de-concept-grid"></div>
          <p class="de-concepts-hint">${t("engine.concepts_hint")}</p>
        </div>
        ${chips}
        ${axisRows ? `<div class="de-refine-axes"><p class="de-inferred-h">${t("engine.refine_adjust")}</p>${axisRows}</div>` : ""}
        <div class="de-freetext">
          <label class="de-freetext-label" for="de-freetext-input">${t("engine.refine_freetext_label")}</label>
          <textarea id="de-freetext-input" class="de-freetext-input" rows="2" placeholder="${t("engine.refine_freetext_ph")}"></textarea>
        </div>
        <div class="de-refine-actions">
          <button type="button" class="de-nav" id="de-deeper">${t("engine.deeper")}</button>
          <button type="button" class="de-nav" id="de-share">${t("engine.share")}</button>
          <button type="button" class="de-confirm de-generate" id="de-generate">${t("engine.generate")}</button>
        </div>`;

      const reSummary = () => { cancelTypeOn(); const el = body.querySelector("#de-refine-summary"); el.classList.remove("is-typing"); el.textContent = DesignSummary.toSentence(dna, lang()); };
      typeOn(body.querySelector("#de-refine-summary"), DesignSummary.toSentence(dna, l));

      // ── Concept-Studio: 4 Varianten der konvergierten DNA, jede mit EVOLVE
      // (Versionskette V1→V2→…) und „Wählen“. Wählen macht die Variante zur
      // aktiven DNA (Vorschau, Satz, Share, Generieren). Die Original-Richtung
      // bleibt als Konzept 0 erhalten — nichts geht verloren.
      const baseDna = JSON.parse(JSON.stringify(dna));
      const concepts = [0, 1, 2, 3].map((i) => ({
        history: [i === 0 ? baseDna : mutateDna(baseDna, i, 1)],
        version: 1,
      }));
      let selected = 0;
      const grid = body.querySelector("#de-concept-grid");
      const tileSvg = (cdna) => {
        if (!window.GarmentSVG || !window.DesignPreview) return "";
        const p = window.DesignPreview.params(cdna);
        return window.GarmentSVG.build(p.category || "tshirt", p);
      };
      const applySelected = () => {
        const c = concepts[selected];
        dna = JSON.parse(JSON.stringify(c.history[c.history.length - 1]));
        DesignEngine.finalize(dna, content.archetypes, content.attributes.required, content.attributes.confidenceThreshold);
        scrubImpossibleFills(dna, content.attributes.confidenceThreshold,
          window.GarmentSVG && window.GarmentSVG.closureAllowed);
        mirror(dna, content.attributes); persist(); updatePreview(); reSummary();
      };
      const renderConcepts = () => {
        if (!grid) return;
        // Namen für ALLE Richtungen in einem Zug — paarweise eindeutig (U6):
        // bei Kollision zieht conceptLabelSets die nächststärkste Achse hinzu.
        const labelSets = conceptLabelSets(baseDna, concepts.map((c) => c.history[c.history.length - 1]));
        grid.innerHTML = concepts.map((c, i) => {
          const cur = c.history[c.history.length - 1];
          // Jede Richtung trägt ihren Namen aus dem eigenen Delta (§8.2):
          // "Wärmer · Weiter" statt vier ununterscheidbarer dunkler Kacheln.
          // Nur i18n-Wörter (kein User-Input) → sicher im Template.
          const name = (i === 0 && c.version === 1)
            ? t("engine.concept_original")
            : labelSets[i].map((k) => t(k)).join(" · ");
          return `<figure class="de-concept${i === selected ? " is-selected" : ""}" data-i="${i}">
            <button type="button" class="de-concept-pick" data-pick="${i}" aria-pressed="${i === selected}" aria-label="${t("engine.concept_pick_aria", { n: i + 1 })}: ${name}">
              <span class="de-concept-stage">${tileSvg(cur)}</span>
              <span class="de-concept-name">${name}</span>
              <span class="de-concept-meta"><span class="de-concept-v mono-label">V${c.version}</span></span>
            </button>
            ${i === selected ? `<div class="de-concept-actions">
              <button type="button" class="de-concept-evolve" data-evolve="${i}">${t("engine.evolve")}</button>
              ${c.history.length > 1 ? `<button type="button" class="de-concept-back" data-back="${i}" aria-label="${t("engine.evolve_back_aria")}">↩</button>` : ""}
            </div>` : ""}
          </figure>`;
        }).join("");
        grid.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
          selected = parseInt(b.dataset.pick, 10); applySelected(); renderConcepts();
          flash("✓ " + t("engine.concept_picked"));
        }));
        grid.querySelectorAll("[data-evolve]").forEach((b) => b.addEventListener("click", () => {
          const i = parseInt(b.dataset.evolve, 10);
          const c = concepts[i];
          c.version += 1;
          c.history.push(mutateDna(c.history[c.history.length - 1], i, c.version));
          // Drop the oldest *mutation*, never index 0 — that's baseDna, which
          // must survive per the "nichts geht verloren" guarantee above.
          if (c.history.length > 8) c.history.splice(1, 1);
          selected = i; applySelected(); renderConcepts();
          T("concept_evolve", { i, v: c.version });
          flash("✓ " + t("engine.evolved", { v: c.version }));
        }));
        grid.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => {
          const i = parseInt(b.dataset.back, 10);
          const c = concepts[i];
          if (c.history.length > 1) { c.history.pop(); c.version = Math.max(1, c.version - 1); }
          selected = i; applySelected(); renderConcepts();
        }));
      };
      renderConcepts();
      body.querySelectorAll(".de-nudge").forEach((btn) => btn.addEventListener("click", () => {
        const r = DesignInference.adjust(dna, btn.dataset.ax, parseInt(btn.dataset.dir, 10), lang());
        DesignEngine.finalize(dna, content.archetypes, content.attributes.required, content.attributes.confidenceThreshold);
        scrubImpossibleFills(dna, content.attributes.confidenceThreshold,
          window.GarmentSVG && window.GarmentSVG.closureAllowed);
        mirror(dna, content.attributes); persist(); updatePreview(); reSummary(); refreshChrome();
        if (r) flash("✓ " + r.label);
      }));
      const deeper = body.querySelector("#de-deeper");
      const moreNode = DesignEngine.nextNode(content.nodes, dna, answered);
      if (!moreNode) deeper.hidden = true;
      else deeper.addEventListener("click", () => { snapshot(); renderModality(moreNode); });

      const shareBtn = body.querySelector("#de-share");
      if (shareBtn) shareBtn.addEventListener("click", () => {
        const url = window.DesignShare ? DesignShare.buildUrl(dna) : "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => flash(t("engine.share_copied")), () => window.prompt(t("engine.share"), url));
        } else { window.prompt(t("engine.share"), url); }
      });
      // U4: der Refine-Freitext läuft durch DENSELBEN Parser wie der Auftakt —
      // erkannte Worte formen das Flat sichtbar um, BEVOR generiert wird
      // (vorher wurde der Text nur unparsed an den KI-Prompt gehängt und
      // konnte dem Stück auf dem Screen stumm widersprechen).
      const ftLive = body.querySelector("#de-freetext-input");
      if (ftLive && window.DEModalities && window.DEModalities.describeParse) {
        ftLive.addEventListener("change", () => {
          const found = window.DEModalities.describeParse(ftLive.value, lang());
          if (!found.length) return;
          const set = {};
          found.forEach((en) => Object.assign(set, en.set));
          // protectExplicit-Semantik von Hand: bereits selbst Entschiedenes
          // (conf ≥ 0.75) gewinnt gegen das nachgereichte Wort.
          Object.entries(set).forEach(([p, v]) => {
            if (DesignDNA.confidence(dna, p) < 0.75) DesignDNA.set(dna, p, v, 0.62);
          });
          syncDerivedFinish(dna);
          mirror(dna, content.attributes);
          persist(); updatePreview(); reSummary();
          flash("✓ " + t("engine.dsc_read_label"));
        });
      }
      body.querySelector("#de-generate").addEventListener("click", (e) => {
        // The generate button sits where a question's confirm just was — a
        // double-tap on the last answer must never fire the AI run.
        if (isGuardedTap(nowMs(), lastRenderAt)) return;
        const ftEl = body.querySelector("#de-freetext-input");
        const extra = ftEl && ftEl.value.trim() ? " " + ftEl.value.trim() : "";
        handoff(DesignSummary.toPrompt(dna, lang()) + extra, DesignDNA.get(dna, "category"), e.currentTarget);
      });
      // No interstitial on the crossing INTO refine: the phase list has no F
      // beat (it would clamp to "Details" — wrong word while arriving at
      // "Dein Design"); the refine headline itself is the arrival marker.
      }); // end swapBody paint

      if (typeof options.onFinish === "function") {
        options.onFinish({ dna, sentence: DesignSummary.toSentence(dna, l), prompt: DesignSummary.toPrompt(dna, l) });
      }
    }

    // ── §5.4 Die Maschine näht ──────────────────────────────────────────────
    // Während AI.generateDesign läuft (1–4 s), kehrt das Genesis-Fadenfeld
    // ÜBER dem Flat zurück — die autonome Fertigung stitcht, die Wartezeit
    // wird zur Geschichte statt zum Spinner. Auf Resolve tippt sich das
    // Namensschild in Mono auf (Maschinenstimme), DANN übernimmt der
    // Ownership-Moment. Nur unter html.fx; reduced-motion/no-fx behalten den
    // reinen Button-Zustand und den sofortigen Handoff.
    function startSewing() {
      if (!fxOn() || reduceMotion() || !window.GarmentSVG || !window.GarmentSVG.nebula) return null;
      const sew = document.createElement("div");
      sew.className = "de-sew";
      sew.setAttribute("aria-hidden", "true");
      sew.innerHTML = window.GarmentSVG.nebula({
        energy: DesignDNA.get(dna, "intent.energy"),
        structure: DesignDNA.get(dna, "silhouette.structure"),
        archetype: DesignDNA.topArchetype(dna),
        seed: answered.size + 4,
      });
      previewEl.appendChild(sew);
      previewEl.classList.add("is-sewing");
      return sew;
    }
    function stopSewing(sew) {
      previewEl.classList.remove("is-sewing");
      if (sew && sew.isConnected) { sew.classList.add("is-done"); setTimeout(() => sew.remove(), 450); }
    }
    // Mono-Namensschild auf der Bühne (bleibt stehen, role=status übernimmt
    // die SR-Ansage — der flüchtige Flash entfällt auf diesem Pfad).
    let plateEl = null;
    const stageForPlate = hostEl.querySelector(".de-preview-stage");
    function nameplate(name) {
      if (!stageForPlate) return;
      if (!plateEl || !plateEl.isConnected) {
        plateEl = document.createElement("span");
        plateEl.className = "de-nameplate";
        plateEl.setAttribute("role", "status");
        stageForPlate.appendChild(plateEl);
      }
      typeOn(plateEl, name);
    }
    function clearNameplate() { if (plateEl) { plateEl.remove(); plateEl = null; } }

    async function handoff(prompt, type, btn) {
      if (!window.AI) return;
      btn.disabled = true;
      btn.textContent = t("engine.generating");
      T("generate", { type: type || "jacket", archetype: DesignDNA.topArchetype(dna) });
      const sew = startSewing();
      try {
        const design = await window.AI.generateDesign(prompt, type || "jacket");
        // "Made for one": carry the body data onto the saved design so the later
        // order/render is truly to-measure (the fit/silhouette already rides in
        // the prompt via toSentence). Read-only snapshot. Measurements stay local
        // and are NOT sent to external APIs (design generation / VTO / preview) —
        // they only ever appear in the exported spec sheet built for production.
        if (design && window.StateManager) {
          const m = window.StateManager.get("measurements");
          if (m) design.measurements = m;
        }
        // Stamp the journey DNA onto the finished design so Share/Publish in the
        // Ownership-Moment still work. clearSaved() below wipes the journey blob
        // the instant S() reveals that panel, and currentDesign isn't persisted
        // across reloads, so the in-memory design is the surviving DNA source for
        // this hand-off flow (ur-create's currentDna() reads it as a fallback).
        if (design) design.dna = dna;
        stopSewing(sew);
        // §9 Ownership-Nahtstelle: EIN durchgehender Bogen — Nähen endet,
        // das Namensschild tippt sich auf, DANN erst zündet der Handoff
        // (S(currentDesign) enthüllt den Ownership-Moment und startet dessen
        // Scroll). Ohne fx/Name: sofort wie bisher, mit Flash als Ansage.
        const finish = () => {
          if (window.StateManager) S("currentDesign", design);
          clearSaved();
          generated = true;
          T("generate_ok", { type: type || "jacket" });
          // onDesign läuft (fx-Pfad) in einem setTimeout — ein Fehler im
          // App-Renderer darf den Button nicht dauerhaft sperren.
          try {
            if (typeof options.onDesign === "function") options.onDesign(design);
          } catch (e2) {
            console.error("[DesignFlow] onDesign failed:", e2);
            if (window.Sentry) window.Sentry.captureException(e2, { tags: { area: "engine" } });
          }
          // Per click kein Render (brief §4): die KI läuft nur auf explizites
          // Generieren. Danach lädt der Button zum "Neu generieren — mehr
          // individualisieren" ein; das Ergebnis ersetzt die Stilvorschau über
          // den onDesign-Handoff in die bestehende Render-Pipeline.
          btn.disabled = false;
          btn.textContent = t("engine.regenerate");
        };
        if (fxOn() && !reduceMotion() && design && design.name) {
          nameplate(design.name);
          setTimeout(finish, 750);
        } else {
          if (design && design.name) flash(design.name);
          finish();
        }
      } catch (e) {
        console.error("[DesignFlow] generate failed:", e);
        if (window.Sentry) window.Sentry.captureException(e, { tags: { area: "engine" } });
        T("generate_fail");
        stopSewing(sew);
        btn.disabled = false;
        btn.textContent = t("engine.generate");
      }
    }

    // Calm intro screen (brief §2): one statement, lots of negative space,
    // announces the ritual + that the AI does the final touch from one sentence.
    function showIntro() {
      const grid = hostEl.querySelector(".de-stage-grid");
      if (grid) grid.style.display = "none";
      const intro = document.createElement("div");
      intro.className = "de-intro";
      intro.innerHTML = `
        <div class="de-intro-inner">
          <h2 class="de-intro-title">${t("engine.intro_title")}</h2>
          <p class="de-intro-sub">${t("engine.intro_sub")}</p>
          <button type="button" class="de-confirm de-intro-start">${t("engine.intro_start")}</button>
        </div>`;
      hostEl.appendChild(intro);
      intro.querySelector(".de-intro-start").addEventListener("click", () => {
        intro.remove();
        if (grid) grid.style.display = "";
        renderNext();
      });
    }

    function resetJourney() {
      clearSaved();
      clearNameplate();
      dna = seedDefaults(DesignDNA.create());
      answered = new Set();
      history.length = 0;
      maxPhaseIdx = -1; // fresh journey → the stepper starts at Phase A again
      currentNode = null;
      // Direktive: kein Onboarding — sofort die erste Frage (kein Intro-Screen).
      renderNext();
    }

    backBtn.addEventListener("click", () => {
      if (!history.length) return;
      T("node_back", { id: currentNode && currentNode.id });
      const snap = history.pop();
      dna = JSON.parse(JSON.stringify(snap.dna));
      answered = new Set(snap.answered);
      persist();
      renderNext();
    });
    skipBtn.addEventListener("click", () => {
      if (currentNode) {
        // Discard any unconfirmed live() edits (e.g. a dragged-then-abandoned
        // slider) instead of baking them into the DNA at confidence 0.
        if (pendingLive) {
          Object.entries(pendingLive).forEach(([p, prev]) => DesignDNA.set(dna, p, prev.value, prev.confidence));
          pendingLive = null;
        }
        T("node_skip", { id: currentNode.id }); snapshot(); answered.add(currentNode.id); persist();
      }
      renderNext();
    });
    restartBtn.addEventListener("click", resetJourney);
    finishBtn.addEventListener("click", renderRefine);

    // Abbruch-Signal: verlässt die Seite mit begonnener, aber nicht generierter Reise.
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => {
        if (answered.size > 0 && !generated) T("abandon", { last: currentNode && currentNode.id, answered: answered.size });
      });
    }

    return loadContent(base).then((c) => {
      content = c;
      // Skip/Restart both call renderNext()/resetJourney(), which read
      // content.nodes — only safe once content has actually loaded, so they
      // start disabled (see the template above) and are enabled here.
      skipBtn.disabled = false;
      restartBtn.disabled = false;
      const shared = window.DesignShare ? DesignShare.read() : null;
      if (shared && typeof shared === "object" && shared.archetypeWeights !== undefined) {
        dna = shared;
        // A crafted #dna= link can carry archetypeWeights: null (sanitize()
        // only guards color.stops) — same repair as the resume path below,
        // or the first refine warmer/colder tap throws inside applyEffects().
        if (!dna.archetypeWeights || typeof dna.archetypeWeights !== "object") {
          dna.archetypeWeights = DesignDNA.create().archetypeWeights;
        }
        if (!dna._confidence) dna._confidence = {};
        DesignShare.clear();
        try { hostEl.scrollIntoView({ block: "start" }); } catch (_e) { /* no-op */ }
        return renderRefine();
      }
      const saved = loadSaved();
      if (saved && saved.answered.length) {
        dna = saved.dna;
        if (!dna.archetypeWeights) dna.archetypeWeights = DesignDNA.create().archetypeWeights;
        if (!dna._confidence) dna._confidence = {};
        // Resume-Robustheit (C1): ein vor dem Seed gespeicherter Lauf mit
        // übersprungenem mood_calm_bold trägt kein intent.energy → beim Fortsetzen
        // würden Muster/Signature weiterhin fehlen. Neutral nachseeden, ohne eine
        // echte Wahl zu überschreiben (nur wenn wirklich ungesetzt).
        if (DesignDNA.get(dna, "intent.energy") == null) seedDefaults(dna);
        answered = new Set(saved.answered);
        // Resume-Falle: Ein BEREITS KONVERGIERTER Durchlauf (keine offenen
        // Fragen mehr) würde jeden Wiederbesuch direkt aufs Ergebnis werfen —
        // „die Reise ist weg". Fertige Sessions gelten als abgeschlossen: das
        // Design lebt in StateManager/Library weiter, die Reise startet frisch.
        if (DesignEngine.nextNode(content.nodes, dna, answered)) return renderNext();
        clearSaved();
        dna = seedDefaults(DesignDNA.create());
        answered = new Set();
      }
      // Direktive: „No onboarding" — Nutzer erschaffen sofort (showIntro bleibt
      // als Funktion erhalten, wird aber nicht mehr aufgerufen).
      void showIntro;
      return renderNext();
    }).catch((err) => {
      // A content-JSON fetch (archetypes/attributes/nodes) can fail (network,
      // a 404) leaving `content` permanently null — without this, the journey
      // hangs on the bare skeleton with no feedback and an unhandled rejection.
      console.error("[DesignFlow] content load failed:", err);
      if (window.Sentry) window.Sentry.captureException(err, { tags: { area: "engine" } });
      body.innerHTML = `<p class="de-question">${t("engine.load_fail")}</p>`;
    });
  }

  // `mount` is the only runtime entry point; the rest are pure helpers exposed
  // purely so the offline test suite can exercise them headless (same seam
  // convention as api/try-on.js exporting its error mappers).
  return { mount, resolveEffects, shiftHex, mutateDna, phaseStepper, isGuardedTap, COMMIT_GUARD_MS, choiceWord, dockShouldShow, conceptDeltas, conceptLabelSets, hexHue, bodyFactors, seedDefaults, syncDerivedFinish, protectExplicit, scrubImpossibleFills };
})();

if (typeof window !== "undefined") window.DesignFlow = DesignFlow;
if (typeof module !== "undefined" && module.exports) module.exports = DesignFlow;
