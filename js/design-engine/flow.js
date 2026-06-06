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
    "construction.collar", "construction.sleeve", "construction.closure",
    "construction.pockets", "construction.cuffs", "construction.hem",
    "pattern.type", "pattern.scale", "color.scheme", "color.stops",
    "fabric.material", "fabric.finishWeight", "intent.energy",
  ];

  function S(key, value) {
    if (!window.StateManager) return;
    try { window.StateManager.set(key, value); } catch (_e) { /* validation guard */ }
  }
  const lang = () => (window.I18N ? window.I18N.getLang() : "de");
  const t = (k, v) => (window.I18N ? window.I18N.t(k, v) : k);

  async function loadContent(base) {
    const get = async (p) => (await fetch(base + p)).json();
    const [arch, attrs, intent, jacket] = await Promise.all([
      get("archetypes.json"), get("attributes.json"),
      get("nodes/intent.json"), get("nodes/jacket.json"),
    ]);
    return { archetypes: arch.archetypes, attributes: attrs, nodes: [...intent.nodes, ...jacket.nodes] };
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
      const eff = { weight };
      if (node.bind && (payload || []).length) eff.set = { [node.bind]: payload[0] };
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

  function mirror(dna, attributes) {
    const map = attributes.stateMap || {};
    Object.entries(map).forEach(([dnaPath, stateKey]) => {
      const v = DesignDNA.get(dna, dnaPath);
      if (v !== undefined && v !== null) S(stateKey, v);
    });
  }

  function ring(maturity) {
    const C = 163.36;
    const off = C * (1 - Math.max(0, Math.min(1, maturity)));
    return `<svg class="de-ring" viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="deRingGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ec4899"/><stop offset="0.5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#06b6d4"/>
      </linearGradient></defs>
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="url(#deRingGrad)" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 32 32)"/>
      <text x="32" y="36" text-anchor="middle" class="de-ring-pct">${Math.round(maturity * 100)}</text></svg>`;
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
            <div class="de-ring-wrap" id="de-ring"></div>
            <span class="de-flash" id="de-flash" role="status" aria-live="polite"></span>
          </div>
          <div class="de-preview-chips" id="de-preview-chips"></div>
        </div>
        <div class="de-ask-col">
          <div class="de-body" id="de-body"></div>
          <p class="de-live" id="de-live"></p>
          <div class="de-controls">
            <button type="button" class="de-nav" id="de-back" disabled>${t("engine.back")}</button>
            <button type="button" class="de-nav" id="de-skip">${t("engine.skip")}</button>
            <button type="button" class="de-nav" id="de-restart">${t("engine.restart")}</button>
            <button type="button" class="de-nav de-finish" id="de-finish" hidden>${t("engine.finish_early")}</button>
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
        window.DesignPreview.renderInto(previewEl, previewDna, { realism: atRefine });
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
      ringWrap.innerHTML = ring(maturity());
      updatePreview(true);
      backBtn.disabled = history.length === 0;
      finishBtn.hidden = maturity() < 0.6;
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
      refreshChrome();
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
        // the prompt via toSentence). Read-only snapshot, no PII leaves here.
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
      showIntro();
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
        return renderNext();
      }
      return showIntro();
    });
  }

  return { mount };
})();

if (typeof window !== "undefined") window.DesignFlow = DesignFlow;
if (typeof module !== "undefined" && module.exports) module.exports = DesignFlow;
