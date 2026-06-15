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
  const DEFAULT_BASE = "js/design-engine/content/";
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

  function S(key, value) {
    if (!window.StateManager) return;
    try { window.StateManager.set(key, value); } catch (_e) { /* validation guard */ }
  }
  const lang = () => (window.I18N ? window.I18N.getLang() : "de");
  const t = (k, v) => (window.I18N ? window.I18N.t(k, v) : k);

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
    return { archetypes: arch.archetypes, attributes: attrs, nodes };
  }

  function resolveEffects(node, payload) {
    if (node.modality === "slider") {
      const eff = { set: { [node.bind]: payload }, weight: {} };
      if (node.weightAt) {
        if (payload < 0.34 && node.weightAt.low) Object.assign(eff.weight, node.weightAt.low);
        if (payload > 0.66 && node.weightAt.high) Object.assign(eff.weight, node.weightAt.high);
      }
      return { eff, conf: 0.8 };
    }
    if (node.modality === "colorGradient") {
      return { eff: { set: {
        "color.scheme": payload.scheme, "color.stops": payload.stops,
        "color.value": payload.value, "color.saturation": payload.saturation,
      } }, conf: 1 };
    }
    if (node.modality === "hotspot") return { eff: payload, conf: 1 };
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
    // Eine Variante wagt ein anderes Muster / eine andere Länge
    if (idx % 2 === 1 && r1 > 0.35) {
      set("pattern.type", PATTERN_POOL[Math.floor(r2 * PATTERN_POOL.length) % PATTERN_POOL.length]);
      set("pattern.scale", 0.25 + r3 * 0.6);
    }
    if (idx === 3 && r2 > 0.5) {
      const L = ["cropped", "regular", "long"]; const cur = L.indexOf(g("length"));
      set("length", L[(cur + 1 + Math.floor(r3 * 2)) % 3]);
    }
    return d;
  }

  function mirror(dna, attributes) {
    const map = attributes.stateMap || {};
    Object.entries(map).forEach(([dnaPath, stateKey]) => {
      const v = DesignDNA.get(dna, dnaPath);
      if (v !== undefined && v !== null) S(stateKey, v);
    });
  }

  function ring(maturity) {
    const C = 163.36;
    const m = Math.max(0, Math.min(1, maturity));
    const off = C * (1 - m);
    return `<svg class="de-ring" viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="deRingGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2a9d8f"/><stop offset="0.5" stop-color="#2779a8"/><stop offset="1" stop-color="#64d6c4"/>
      </linearGradient></defs>
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="4"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="url(#deRingGrad)" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 32 32)"/>
      <text x="32" y="35" text-anchor="middle" class="de-ring-pct">${Math.round(m * 100)}<tspan class="de-ring-unit" dx="0.5">%</tspan></text></svg>`;
  }

  // Short human label of what a choice just changed (micro-feedback, brief §7).
  function changeLabel(node, payload, l) {
    if (node.modality === "ranking") {
      const top = (node.options || []).find((o) => o.id === (payload || [])[0]);
      return top && top.label ? top.label[l] : "";
    }
    if (node.modality === "hotspot") return t("engine.changed_details");
    if (node.modality === "cards" && Array.isArray(payload)) return payload.length + "×";
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
    let dna = DesignDNA.create();
    let answered = new Set();
    const history = [];
    let content = null;
    let currentNode = null;
    let generated = false;
    // True only on the Phase-F refine screen → the preview crossfades from the
    // morphing flat to the recoloured hero photo (realism layer, brief §1).
    let atRefine = false;
    const T = (event, props) => { if (window.DesignTelemetry) window.DesignTelemetry.track(event, props); };

    hostEl.classList.add("de-stage");
    hostEl.innerHTML = `
      <div class="de-stage-grid">
        <div class="de-preview-col">
          <div class="de-preview-stage">
            <div class="de-preview" id="de-preview" aria-hidden="true"></div>
            <div class="de-ring-wrap" id="de-ring" role="img"></div>
            <span class="de-flash" id="de-flash" role="status" aria-live="polite"></span>
          </div>
          <div class="de-preview-chips" id="de-preview-chips"></div>
        </div>
        <div class="de-ask-col">
          <div class="de-body" id="de-body"></div>
          <p class="de-live" id="de-live"></p>
          <div class="de-controls">
            <button type="button" class="de-nav" id="de-back" data-i18n="engine.back" disabled>${t("engine.back")}</button>
            <button type="button" class="de-nav" id="de-skip" data-i18n="engine.skip">${t("engine.skip")}</button>
            <button type="button" class="de-nav" id="de-restart" data-i18n="engine.restart">${t("engine.restart")}</button>
            <button type="button" class="de-nav de-finish" id="de-finish" data-i18n="engine.finish_early" hidden>${t("engine.finish_early")}</button>
          </div>
        </div>
      </div>`;

    const body = hostEl.querySelector("#de-body");
    const ringWrap = hostEl.querySelector("#de-ring");
    const live = hostEl.querySelector("#de-live");
    const previewEl = hostEl.querySelector("#de-preview");
    const flashEl = hostEl.querySelector("#de-flash");
    const backBtn = hostEl.querySelector("#de-back");
    const skipBtn = hostEl.querySelector("#de-skip");
    const restartBtn = hostEl.querySelector("#de-restart");
    const finishBtn = hostEl.querySelector("#de-finish");

    const maturity = () => DesignDNA.maturity(dna, content.attributes.required, content.attributes.confidenceThreshold);

    const chipsEl = hostEl.querySelector("#de-preview-chips");
    function updatePreview(animate) {
      // Render the COMPLETED design (chosen + inferred-from-archetype) so the
      // preview takes shape early and evolves with every mood/colour choice —
      // not a static placeholder until the last question.
      const previewDna = JSON.parse(JSON.stringify(dna));
      DesignEngine.finalize(previewDna, content.archetypes, content.attributes.required, content.attributes.confidenceThreshold);
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
        window.DesignPreview.renderInto(previewEl, previewDna, {
          realism: atRefine,
          genesis: catConf < (content.attributes.confidenceThreshold || 0.5),
          progress: 0.38 + maturity() * 0.62,
          seed: answered.size,
        });
      }
      // Attribut-Chips unter der Vorschau (brief §3.1) — geben pro Wahl
      // sichtbares Feedback (Subarch/Fit/Länge/Material/Muster), nicht ins Foto.
      if (chipsEl) {
        const l = lang();
        const g = (p) => DesignDNA.get(previewDna, p);
        const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");
        const chips = [];
        if (DesignDNA.get(dna, "category")) {
          const sub = g("subArchetype"); if (sub) chips.push(cap(sub));
          const fit = g("silhouette.fit");
          if (typeof fit === "number") chips.push(fit < 0.34 ? (l === "en" ? "Slim" : "Schmal") : fit > 0.66 ? "Oversized" : (l === "en" ? "Regular" : "Regular"));
          const len = g("length"); if (len) chips.push(window.I18N ? window.I18N.t("length." + len) : len);
          const mat = g("fabric.material"); if (mat) chips.push(window.I18N ? window.I18N.material(mat) : mat);
          const pat = g("pattern.type"); if (pat && pat !== "none") chips.push(window.I18N ? window.I18N.pattern(pat) : pat);
        }
        chipsEl.innerHTML = chips.map((c) => `<span class="de-preview-chip">${c}</span>`).join("");
      }
      live.textContent = DesignSummary.toSentence(dna, lang());
    }
    function refreshChrome() {
      const m = maturity();
      ringWrap.innerHTML = ring(m);
      // Ready state: once the design is mature enough to finish, the ring picks
      // up an accent glow — tying the cryptic number to the "Fertig" affordance.
      ringWrap.classList.toggle("is-ready", m >= 0.6);
      ringWrap.setAttribute("aria-label", t("engine.maturity_aria") + ": " + Math.round(m * 100) + "%");
      updatePreview(true);
      backBtn.disabled = history.length === 0;
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
        if (!o || !Array.isArray(o.answered)) return null;
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
        if (eff && eff.set) Object.entries(eff.set).forEach(([p, v]) => DesignDNA.set(dna, p, v, 0));
        mirror(dna, content.attributes);
        updatePreview();
      },
      commit(payload) {
        const { eff, conf } = resolveEffects(currentNode, payload);
        if (currentNode) T("node_choice", { id: currentNode.id, modality: currentNode.modality });
        snapshot();
        flash("✓ " + changeLabel(currentNode, payload, lang()));
        DesignEngine.answer(dna, currentNode, eff, answered, conf);
        mirror(dna, content.attributes);
        persist();
        renderNext();
      },
    };

    function renderModality(node) {
      atRefine = false; // back to the morphing flat for any question
      currentNode = node;
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
      renderer(body, node, ctx);
      refreshChrome();
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
      DesignEngine.finalize(dna, content.archetypes, content.attributes.required, content.attributes.confidenceThreshold);
      mirror(dna, content.attributes);
      persist();
      currentNode = null;
      atRefine = true; // Phase F → crossfade the flat to the realism photo
      refreshChrome();
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

      body.innerHTML = `
        <h2 class="de-question">${t("engine.refine_title")}</h2>
        <p class="de-summary" id="de-refine-summary">${DesignSummary.toSentence(dna, l)}</p>
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
          <button type="button" class="de-confirm" id="de-generate">${t("engine.generate")}</button>
        </div>`;

      const reSummary = () => { body.querySelector("#de-refine-summary").textContent = DesignSummary.toSentence(dna, lang()); };

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
        mirror(dna, content.attributes); persist(); updatePreview(); reSummary();
      };
      const renderConcepts = () => {
        if (!grid) return;
        grid.innerHTML = concepts.map((c, i) => {
          const cur = c.history[c.history.length - 1];
          return `<figure class="de-concept${i === selected ? " is-selected" : ""}" data-i="${i}">
            <button type="button" class="de-concept-pick" data-pick="${i}" aria-label="${t("engine.concept_pick_aria", { n: i + 1 })}">
              <span class="de-concept-stage">${tileSvg(cur)}</span>
              <span class="de-concept-meta"><span class="de-concept-v mono-label">V${c.version}</span>${i === 0 && c.version === 1 ? `<span class="de-concept-tag">${t("engine.concept_original")}</span>` : ""}</span>
            </button>
            <div class="de-concept-actions">
              <button type="button" class="de-concept-evolve" data-evolve="${i}">${t("engine.evolve")}</button>
              ${c.history.length > 1 ? `<button type="button" class="de-concept-back" data-back="${i}" aria-label="${t("engine.evolve_back_aria")}">↩</button>` : ""}
            </div>
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
          if (c.history.length > 8) c.history.shift();
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
      body.querySelector("#de-generate").addEventListener("click", (e) => {
        const ftEl = body.querySelector("#de-freetext-input");
        const extra = ftEl && ftEl.value.trim() ? " " + ftEl.value.trim() : "";
        handoff(DesignSummary.toPrompt(dna, lang()) + extra, DesignDNA.get(dna, "category"), e.currentTarget);
      });

      if (typeof options.onFinish === "function") {
        options.onFinish({ dna, sentence: DesignSummary.toSentence(dna, l), prompt: DesignSummary.toPrompt(dna, l) });
      }
    }

    async function handoff(prompt, type, btn) {
      if (!window.AI) return;
      btn.disabled = true;
      btn.textContent = t("engine.generating");
      T("generate", { type: type || "jacket", archetype: DesignDNA.topArchetype(dna) });
      try {
        const design = await window.AI.generateDesign(prompt, type || "jacket");
        // "Made for one": carry the body data onto the saved design so the later
        // order/render is truly to-measure (the fit/silhouette already rides in
        // the prompt via toSentence). Read-only snapshot. Measurements stay local
        // and are NOT sent to external APIs (design generation / VTO / preview) —
        // they only ever appear in the exported spec sheet built for the tailor.
        if (design && window.StateManager) {
          const m = window.StateManager.get("measurements");
          if (m) design.measurements = m;
        }
        if (window.StateManager) S("currentDesign", design);
        clearSaved();
        generated = true;
        T("generate_ok", { type: type || "jacket" });
        if (typeof options.onDesign === "function") options.onDesign(design);
        if (design && design.name) flash(design.name);
        // Per click kein Render (brief §4): die KI läuft nur auf explizites
        // Generieren. Danach lädt der Button zum "Neu generieren — mehr
        // individualisieren" ein; das Ergebnis ersetzt die Stilvorschau über
        // den onDesign-Handoff in die bestehende Render-Pipeline.
        btn.disabled = false;
        btn.textContent = t("engine.regenerate");
      } catch (e) {
        console.error("[DesignFlow] generate failed:", e);
        if (window.Sentry) window.Sentry.captureException(e, { tags: { area: "engine" } });
        T("generate_fail");
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
      dna = DesignDNA.create();
      answered = new Set();
      history.length = 0;
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
      if (currentNode) { T("node_skip", { id: currentNode.id }); snapshot(); answered.add(currentNode.id); persist(); }
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
      const shared = window.DesignShare ? DesignShare.read() : null;
      if (shared && typeof shared === "object" && shared.archetypeWeights !== undefined) {
        dna = shared;
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
        answered = new Set(saved.answered);
        // Resume-Falle: Ein BEREITS KONVERGIERTER Durchlauf (keine offenen
        // Fragen mehr) würde jeden Wiederbesuch direkt aufs Ergebnis werfen —
        // „die Reise ist weg". Fertige Sessions gelten als abgeschlossen: das
        // Design lebt in StateManager/Library weiter, die Reise startet frisch.
        if (DesignEngine.nextNode(content.nodes, dna, answered)) return renderNext();
        clearSaved();
        dna = DesignDNA.create();
        answered = new Set();
      }
      // Direktive: „No onboarding" — Nutzer erschaffen sofort (showIntro bleibt
      // als Funktion erhalten, wird aber nicht mehr aufgerufen).
      void showIntro;
      return renderNext();
    });
  }

  // `mount` is the only runtime entry point; the rest are pure helpers exposed
  // purely so the offline test suite can exercise them headless (same seam
  // convention as api/try-on.js exporting its error mappers).
  return { mount, resolveEffects, shiftHex, mutateDna, ring };
})();

if (typeof window !== "undefined") window.DesignFlow = DesignFlow;
if (typeof module !== "undefined" && module.exports) module.exports = DesignFlow;
