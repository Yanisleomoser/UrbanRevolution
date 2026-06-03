/**
 * Urban Revolution — Design Engine · Flow controller
 *
 * Orchestrates the journey: loads JSON content, drives the engine one node at a
 * time, renders the active modality, tracks a maturity ring, mirrors concrete
 * attributes into StateManager (so the existing 3D + spec preview react), and
 * hands the finished DesignDNA to AI.generateDesign via summary.toPrompt.
 *
 *   DesignFlow.mount(hostEl, { contentBase, onFinish })  → Promise
 *
 * Depends on the classic-script globals: DesignDNA, DesignEngine, DesignSummary,
 * DEModalities, I18N, CONFIG, StateManager (all optional-guarded).
 */
const DesignFlow = (() => {
  const DEFAULT_BASE = "js/design-engine/content/";

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
    return {
      archetypes: arch.archetypes,
      attributes: attrs,
      nodes: [...intent.nodes, ...jacket.nodes],
    };
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
      return {
        eff: { set: {
          "color.scheme": payload.scheme,
          "color.stops": payload.stops,
          "color.value": payload.value,
          "color.saturation": payload.saturation,
        } },
        conf: 1,
      };
    }
    return { eff: DesignEngine.choiceEffects(node, payload), conf: 1 };
  }

  function mirror(dna, attributes) {
    const map = (attributes.stateMap) || {};
    Object.entries(map).forEach(([dnaPath, stateKey]) => {
      const v = DesignDNA.get(dna, dnaPath);
      if (v !== undefined && v !== null) S(stateKey, v);
    });
  }

  function ring(maturity) {
    const C = 163.36; // 2π·26
    const off = C * (1 - Math.max(0, Math.min(1, maturity)));
    return `
      <svg class="de-ring" viewBox="0 0 64 64" aria-hidden="true">
        <defs><linearGradient id="deRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ec4899"/><stop offset="0.5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#06b6d4"/>
        </linearGradient></defs>
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>
        <circle cx="32" cy="32" r="26" fill="none" stroke="url(#deRingGrad)" stroke-width="4"
          stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"
          transform="rotate(-90 32 32)"/>
        <text x="32" y="36" text-anchor="middle" class="de-ring-pct">${Math.round(maturity * 100)}</text>
      </svg>`;
  }

  function mount(hostEl, opts) {
    const options = opts || {};
    const base = options.contentBase || DEFAULT_BASE;
    const dna = DesignDNA.create();
    const answered = new Set();
    const history = [];
    let content = null;

    hostEl.classList.add("de-stage");
    hostEl.innerHTML = `
      <div class="de-head">
        <div class="de-ring-wrap" id="de-ring"></div>
        <p class="de-live" id="de-live"></p>
      </div>
      <div class="de-body" id="de-body"></div>
      <div class="de-controls">
        <button type="button" class="de-nav" id="de-back" disabled>${t("engine.back")}</button>
        <button type="button" class="de-nav" id="de-skip">${t("engine.skip")}</button>
        <button type="button" class="de-nav de-finish" id="de-finish" hidden>${t("engine.finish_early")}</button>
      </div>`;

    const body = hostEl.querySelector("#de-body");
    const ringWrap = hostEl.querySelector("#de-ring");
    const live = hostEl.querySelector("#de-live");
    const backBtn = hostEl.querySelector("#de-back");
    const skipBtn = hostEl.querySelector("#de-skip");
    const finishBtn = hostEl.querySelector("#de-finish");

    function maturity() {
      return DesignDNA.maturity(dna, content.attributes.required, content.attributes.confidenceThreshold);
    }
    function refreshChrome() {
      const m = maturity();
      ringWrap.innerHTML = ring(m);
      live.textContent = DesignSummary.toSentence(dna, lang());
      backBtn.disabled = history.length === 0;
      finishBtn.hidden = m < 0.6;
    }
    function snapshot() {
      history.push({ dna: JSON.parse(JSON.stringify(dna)), answered: new Set(answered) });
    }
    function restore(snap) {
      Object.keys(dna).forEach((k) => delete dna[k]);
      Object.assign(dna, JSON.parse(JSON.stringify(snap.dna)));
      answered.clear();
      snap.answered.forEach((id) => answered.add(id));
    }

    const ctx = {
      get lang() { return lang(); },
      t,
      live(payload) {
        const { eff } = resolveEffects(currentNode, payload);
        if (eff && eff.set) Object.entries(eff.set).forEach(([p, v]) => DesignDNA.set(dna, p, v, 0));
        mirror(dna, content.attributes);
        live.textContent = DesignSummary.toSentence(dna, lang());
      },
      commit(payload) {
        const { eff, conf } = resolveEffects(currentNode, payload);
        snapshot();
        DesignEngine.answer(dna, currentNode, eff, answered, conf);
        mirror(dna, content.attributes);
        renderNext();
      },
    };

    let currentNode = null;

    function renderNext() {
      refreshChrome();
      const node = DesignEngine.nextNode(content.nodes, dna, answered);
      currentNode = node;
      if (!node) return finish();
      const renderer = window.DEModalities && window.DEModalities[node.modality];
      if (!renderer) { console.warn("[DesignFlow] no modality:", node.modality); return finish(); }
      renderer(body, node, ctx);
    }

    function finish() {
      DesignEngine.finalize(dna, content.archetypes, content.attributes.required, content.attributes.confidenceThreshold);
      mirror(dna, content.attributes);
      refreshChrome();
      const l = lang();
      const sentence = DesignSummary.toSentence(dna, l);
      const prompt = DesignSummary.toPrompt(dna, l);
      body.innerHTML = `
        <h2 class="de-question">${t("engine.done_title")}</h2>
        <p class="de-summary">${sentence}</p>
        <button type="button" class="de-confirm" id="de-generate">${t("engine.generate")}</button>`;
      finishBtn.hidden = true;
      skipBtn.disabled = true;
      const genBtn = body.querySelector("#de-generate");
      genBtn.addEventListener("click", () => handoff(prompt, DesignDNA.get(dna, "category"), genBtn));
      if (typeof options.onFinish === "function") options.onFinish({ dna, sentence, prompt });
    }

    async function handoff(prompt, type, btn) {
      if (!window.AI) return;
      btn.disabled = true;
      btn.textContent = t("engine.generating");
      try {
        const design = await window.AI.generateDesign(prompt, type || "jacket");
        if (window.StateManager) S("currentDesign", design);
        if (typeof options.onDesign === "function") options.onDesign(design);
        btn.textContent = design.name || t("engine.generate");
      } catch (e) {
        console.error("[DesignFlow] generate failed:", e);
        btn.disabled = false;
        btn.textContent = t("engine.generate");
      }
    }

    backBtn.addEventListener("click", () => {
      if (!history.length) return;
      restore(history.pop());
      renderNext();
    });
    skipBtn.addEventListener("click", () => {
      if (currentNode) { snapshot(); answered.add(currentNode.id); }
      renderNext();
    });
    finishBtn.addEventListener("click", finish);

    return loadContent(base).then((c) => { content = c; renderNext(); });
  }

  return { mount };
})();

if (typeof window !== "undefined") window.DesignFlow = DesignFlow;
if (typeof module !== "undefined" && module.exports) module.exports = DesignFlow;
