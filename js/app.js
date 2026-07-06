/**
 * Urban Revolution — Main Application Controller
 * Orchestriert AI, Maße, Export und treibt den StateManager als
 * single source of truth. Das 3D-Modul lauscht ausschließlich auf
 * StateManager-Events — app.js ruft es nicht direkt auf.
 */

(function() {
  const S = {
    get: (key) => window.StateManager ? window.StateManager.get(key) : null,
    set: (key, value) => {
      if (!window.StateManager) return false;
      try {
        window.StateManager.set(key, value);
        return true;
      } catch (err) {
        console.warn(`[state] ${key}: ${err.message}`);
        return false;
      }
    },
  };

  // Thin wrapper around I18N.t so the rest of app.js stays terse. Falls back
  // to the raw key if I18N hasn't loaded (defensive — load order guarantees it).
  const t = (key, vars) => (window.I18N ? window.I18N.t(key, vars) : key);

  function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return; // toast lives in the studio; may be absent pre-reveal
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    // Errors are announced assertively so a screen reader doesn't miss feedback
    // that fires mid-utterance; info/success stay polite.
    const isError = type === "error";
    toast.setAttribute("role", isError ? "alert" : "status");
    toast.setAttribute("aria-live", isError ? "assertive" : "polite");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function updateStep(stepNumber) {
    document.querySelectorAll(".step").forEach((s) => {
      const num = parseInt(s.dataset.step, 10);
      s.classList.toggle("active", num <= stepNumber);
    });
  }

  function trackScrollSteps() {
    const sections = [
      { id: "design", step: 1 },
      { id: "ownership", step: 2 },
      { id: "measure", step: 3 },
      { id: "production", step: 4 },
    ];

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const section = sections.find((s) => s.id === entry.target.id);
          if (section) updateStep(section.step);
        }
      });
    }, { rootMargin: "-30% 0px -50% 0px" });

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
  }

  // Localized color name for the current language (adjective form used in
  // labels). The lowercase form feeds the generated prompt body.
  function colorAdjective(hex) {
    return window.I18N ? window.I18N.colorName(hex) : hex;
  }

  function colorLower(hex) {
    return colorAdjective(hex).toLowerCase();
  }

  // Per-type prompt template — the localized template carries {color}/{mat}
  // placeholders so the produced prompt reads naturally in either language.
  const PROMPT_BUILDERS = {
    tshirt: (color, mat) => t("pb.tshirt", { color, mat }),
    hoodie: (color, mat) => t("pb.hoodie", { color, mat }),
    shirt: (color, mat) => t("pb.shirt", { color, mat }),
    pants: (color, mat) => t("pb.pants", { color, mat }),
    jacket: (color, mat) => t("pb.jacket", { color, mat }),
    dress: (color, mat) => t("pb.dress", { color, mat }),
  };

  // Fallback set when the user has no history yet — mirrors the original
  // hardcoded inspirations, now localized via I18N.
  function defaultSuggestions() {
    return [
      { label: t("sugg.minimal_label"), type: "tshirt", prompt: t("sugg.minimal_prompt") },
      { label: t("sugg.cyber_label"), type: "hoodie", prompt: t("sugg.cyber_prompt") },
      { label: t("sugg.oxford_label"), type: "shirt", prompt: t("sugg.oxford_prompt") },
      { label: t("sugg.wide_label"), type: "pants", prompt: t("sugg.wide_prompt") },
    ];
  }

  function buildPersonalizedSuggestions() {
    if (!window.Preferences) return defaultSuggestions();
    const total = window.Preferences.totalDesigns();
    if (total < 1) return defaultSuggestions();

    const topTypes = window.Preferences.topValues("type", 3);
    const topColors = window.Preferences.topValues("color", 2);
    const topMaterials = window.Preferences.topValues("material", 2);

    const allTypes = Object.keys(TYPE_ICON_PATHS);
    const untriedTypes = allTypes.filter((ty) => !topTypes.includes(ty));

    const primaryColor = topColors[0] || "#1a1a1a";
    const primaryMaterialKey = topMaterials[0] || "cotton";
    const primaryMaterialLabel = typeMaterialLabel(primaryMaterialKey);

    const suggestions = [];

    // 1-2 "your style" entries: top types × top color/material
    topTypes.slice(0, 2).forEach((type) => {
      const builder = PROMPT_BUILDERS[type];
      if (!builder) return;
      suggestions.push({
        label: `${colorAdjective(primaryColor)} ${typeLabel(type)}`,
        type,
        prompt: builder(colorLower(primaryColor), primaryMaterialLabel.toLowerCase()),
        personalized: true,
      });
    });

    // 1 second-color combo with the top type, if a 2nd color was seen
    if (topColors[1] && topTypes[0] && PROMPT_BUILDERS[topTypes[0]]) {
      const type = topTypes[0];
      suggestions.push({
        label: `${colorAdjective(topColors[1])} ${typeLabel(type)}`,
        type,
        prompt: PROMPT_BUILDERS[type](colorLower(topColors[1]), primaryMaterialLabel.toLowerCase()),
        personalized: true,
      });
    }

    // 1 discovery entry: pick a type the user hasn't tried — encourages
    // exploration so the suggestion ring doesn't echo-chamber.
    if (untriedTypes.length) {
      const discoveryType = untriedTypes[Math.floor(Math.random() * untriedTypes.length)];
      const builder = PROMPT_BUILDERS[discoveryType];
      if (builder) {
        suggestions.push({
          label: t("sugg.try_prefix", { label: typeLabel(discoveryType) }),
          type: discoveryType,
          prompt: builder(colorLower(primaryColor), primaryMaterialLabel.toLowerCase()),
          discovery: true,
        });
      }
    }

    return suggestions.slice(0, 4);
  }

  function renderSuggestions() {
    const pills = document.getElementById("suggestions-pills");
    const label = document.getElementById("suggestions-label");
    const stats = document.getElementById("suggestions-stats");
    if (!pills) return;

    const list = buildPersonalizedSuggestions();
    const total = window.Preferences ? window.Preferences.totalDesigns() : 0;

    if (total > 0) {
      label.textContent = t("design.suggestions_foryou");
      stats.textContent = t("sugg.foryou_count", { n: total, s: total !== 1 ? "s" : "" });
      stats.hidden = false;
    } else {
      label.textContent = t("design.suggestions_inspiration");
      stats.hidden = true;
    }

    pills.innerHTML = list
      .map((s) => {
        const icon = typeIconSvg(s.type, 22);
        const cls = ["suggestion"];
        if (s.personalized) cls.push("personalized");
        if (s.discovery) cls.push("discovery");
        return `<button class="${cls.join(" ")}" data-prompt="${escapeHtml(s.prompt)}" data-type="${escapeHtml(s.type)}">
          <span class="suggestion-icon">${icon}</span>
          <span class="suggestion-label">${escapeHtml(s.label)}</span>
        </button>`;
      })
      .join("");
  }

  function initSuggestions() {
    renderSuggestions();
    // Event delegation — pills get re-rendered after each generation
    // so binding per-button would leak handlers.
    const container = document.getElementById("suggestions-pills");
    if (!container) return;
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".suggestion");
      if (!btn) return;
      const promptEl = document.getElementById("ai-prompt");
      if (btn.dataset.prompt) {
        promptEl.value = btn.dataset.prompt;
        promptEl.focus();
      }
      if (btn.dataset.type) {
        setActiveType(btn.dataset.type);
        if (S.set("currentType", btn.dataset.type)) updateProductionPreview();
      }
    });
  }

  function initTypeSelector() {
    document.querySelectorAll(".type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveType(btn.dataset.type);
        S.set("currentType", btn.dataset.type);
        updateProductionPreview();
      });
    });
  }

  // Reflect `color` in the palette: activate the matching preset swatch, or
  // fold an off-palette color (e.g. one the AI generated outside the 10-swatch
  // palette) into the custom-color control so it stays visible and
  // re-selectable. Keeps aria-pressed in sync for assistive tech.
  function syncColorPalette(color) {
    const hex = String(color || "").toLowerCase();
    let matched = false;
    document.querySelectorAll("button.color-swatch").forEach((s) => {
      const on = (s.dataset.color || "").toLowerCase() === hex;
      if (on) matched = true;
      s.classList.toggle("active", on);
      s.setAttribute("aria-pressed", on ? "true" : "false");
    });

    // The custom swatch is a <label> wrapping the native color <input>, not a
    // button — aria-pressed is invalid on a non-button role, so we only drive
    // the visual active/has-custom classes here. The pressed state is carried
    // by the input itself.
    const customSwatch = document.getElementById("custom-color-swatch");
    const customInput = document.getElementById("custom-color");
    const isHex = /^#[0-9a-f]{6}$/.test(hex);
    if (customInput && isHex) customInput.value = hex;
    if (customSwatch) {
      const useCustom = !matched && isHex;
      if (useCustom) {
        customSwatch.style.background = hex;
        customSwatch.dataset.color = hex;
        customSwatch.classList.add("has-custom");
      } else {
        customSwatch.style.background = "";
        delete customSwatch.dataset.color;
        customSwatch.classList.remove("has-custom");
      }
      customSwatch.classList.toggle("active", useCustom);
    }
  }

  // Single funnel for a color change from any control (preset swatch or the
  // native custom picker): validate via state, sync the palette UI, mirror it
  // onto the current design and rebuild the spec preview.
  function applyColor(newColor) {
    if (!S.set("currentColor", newColor)) return;
    syncColorPalette(newColor);
    const design = S.get("currentDesign");
    if (design) {
      design.color = newColor;
      updateProductionPreview();
    }
  }

  // Defence-in-depth: clamp a <select> value to a known-good option, falling
  // back to a safe default. The allow-lists are sourced from CONFIG (the single
  // source of truth) — never hand-typed, so they can't drift from the real
  // option keys (e.g. materials include `fleece`/`polyester`; patterns are
  // `stripes_h`/`dots`/… not `stripe`/`dot`).
  function normalizeMaterial(value) {
    const materials = (window.CONFIG && window.CONFIG.MATERIALS) || {};
    return Object.prototype.hasOwnProperty.call(materials, value) ? value : "cotton";
  }

  function normalizeLength(value) {
    const lengths = (window.CONFIG && window.CONFIG.LENGTHS) || ["cropped", "regular", "long"];
    return lengths.includes(value) ? value : "regular";
  }

  function initGenerateButton() {
    const btn = document.getElementById("generate-btn");
    btn.addEventListener("click", async () => {
      const prompt = document.getElementById("ai-prompt").value.trim();
      if (!prompt) {
        showToast(t("toast.empty_prompt"), "error");
        document.getElementById("ai-prompt").focus();
        return;
      }

      btn.classList.add("loading");
      btn.disabled = true;
      btn.querySelector(".btn-text").textContent = t("design.generate_loading");

      try {
        const design = await AI.generateDesign(prompt, S.get("currentType"));
        S.set("currentDesign", design);
        // Sync design.type to the live selector (in case it changed while the
        // request was in flight) so state reflects the user's current choice
        // instead of the stale click-time type; the spec sheet + Ownership
        // moment then update from state.
        applyDesignToState(design);
        updateProductionPreview();
        if (window.Preferences) {
          // Track preferences after the design has been applied to state so
          // we record the *final* color/material (Claude may have overridden
          // the user's pre-click selection).
          window.Preferences.track("type", S.get("currentType"));
          window.Preferences.track("color", S.get("currentColor"));
          window.Preferences.track("material", S.get("currentMaterial"));
          window.Preferences.trackPrompt(prompt);
          renderSuggestions();
        }
        showToast(t("toast.generated", { name: design.name }), "success");
      } catch (error) {
        console.error(error);
        showToast(t("toast.gen_error"), "error");
      } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
        btn.querySelector(".btn-text").textContent = t("design.generate_btn");
      }
    });
  }

  // Takes the adaptive Design Engine journey's finished design and hands it
  // into the shared pipeline. The journey already mirrors the user's concrete
  // choices (type/colour/material/fit/length) into StateManager live, so we
  // make those authoritative over anything the AI re-interpreted, then rebuild
  // the spec sheet from state.
  function applyJourneyDesign(design) {
    if (!design) return;
    design.type = S.get("currentType") || design.type;
    const color = S.get("currentColor"); if (color) design.color = color;
    const material = S.get("currentMaterial"); if (material) design.material = material;
    const fit = S.get("currentFit"); if (fit !== null && fit !== undefined) design.fit = fit;
    const length = S.get("currentLength"); if (length) design.length = length;
    design.print = S.get("currentPrint") || "";
    S.set("currentDesign", design);
    updateProductionPreview();
    if (window.Preferences) {
      window.Preferences.track("type", design.type);
      window.Preferences.track("color", design.color);
      window.Preferences.track("material", design.material);
      renderSuggestions();
    }
    showToast(t("toast.generated", { name: design.name }), "success");
  }

  function initDesignJourney() {
    const host = document.getElementById("engine-host");
    if (!host || !window.DesignFlow) return;
    window.DesignFlow.mount(host, {
      onDesign: (design) => applyJourneyDesign(design),
    }).catch((err) => console.error("[app] journey mount failed:", err));
  }

  // Inline outline paths for the 6 garment types, mirrored from the
  // .type-btn SVGs in index.html. Used inside the design-result card so
  // the user sees a visual cue for the garment type they generated.
  const TYPE_ICON_PATHS = {
    tshirt: "M16 16 L24 8 L40 8 L48 16 L56 22 L48 30 L48 56 L16 56 L16 30 L8 22 Z",
    hoodie: "M20 14 Q32 4 44 14 L52 22 L58 28 L50 34 L50 58 L14 58 L14 34 L6 28 L12 22 Z",
    shirt: "M18 14 L28 8 L36 8 L46 14 L54 22 L48 28 L48 56 L16 56 L16 28 L10 22 Z M28 8 L32 16 L36 8",
    pants: "M16 8 L48 8 L46 32 L44 58 L34 58 L32 34 L30 58 L20 58 L18 32 Z",
    jacket: "M16 14 L24 8 L40 8 L48 14 L56 22 L50 28 L50 58 L32 58 L32 8 L32 58 L14 58 L14 28 L8 22 Z",
    dress: "M22 12 L28 8 L36 8 L42 12 L40 24 L52 58 L12 58 L24 24 Z",
  };

  // Localized garment-type label (e.g. "Hemd" / "Shirt").
  function typeLabel(type) {
    return window.I18N ? window.I18N.typeLabel(type) : type;
  }

  // Localized material label (e.g. "Bio-Baumwolle" / "Organic cotton").
  function typeMaterialLabel(key) {
    return window.I18N ? window.I18N.material(key) : key;
  }

  // Localized measurement label (e.g. "Brustumfang" / "Chest").
  function measureLabel(key) {
    if (window.I18N) return window.I18N.measureLabel(key);
    return (window.Measurements && window.Measurements.LABELS[key]) || key;
  }

  // Reflect the active garment type across the type-grid buttons, keeping
  // aria-pressed in sync for assistive tech. Centralizes the toggle logic
  // that was previously duplicated across the type/suggestion handlers.
  function setActiveType(type) {
    document.querySelectorAll(".type-btn").forEach((b) => {
      const on = b.dataset.type === type;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function typeIconSvg(type, size = 56) {
    const d = TYPE_ICON_PATHS[type] || TYPE_ICON_PATHS.tshirt;
    return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  }

  function fitLabel(fit) {
    if (fit === undefined || fit === null) return t("fit.regular");
    if (fit < 0.33) return t("fit.slim");
    if (fit > 0.66) return t("fit.oversized");
    return t("fit.regular");
  }

  function lengthLabel(key) {
    return t(`length.${key || "regular"}`);
  }

  function escapeHtml(str) {
    return String(str).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
    );
  }

  function applyDesignToState(design) {
    // Push design fields through StateManager so the 3D module's
    // subscriptions fire. Validation failures (e.g. Claude returned a
    // non-palette color) are caught in S.set and don't break the flow.
    if (design.color) S.set("currentColor", design.color);
    if (design.material) S.set("currentMaterial", design.material);
    if (design.fit !== undefined) S.set("currentFit", design.fit);
    // Length & print are user studio choices, not AI-generated; reset them to
    // their defaults for each fresh design so the preview starts clean.
    S.set("currentLength", design.length || "regular");
    S.set("currentPrint", design.print || "");
    // The live type selector is authoritative over design.type (frozen at the
    // moment the AI request started): if the user changed the type while the
    // request was in flight, correct design.type to match rather than
    // snapping state/UI back to the stale value (mirrors applyJourneyDesign's
    // state-wins rule for the same race).
    const liveType = S.get("currentType");
    if (liveType && design.type !== liveType) design.type = liveType;
  }

  // Flag an out-of-range measurement so the user sees/hears it, instead of
  // it being silently swapped for a preset value in the spec sheet downstream.
  function validateMeasurementField(input) {
    if (!window.CONFIG || input.value === "") {
      input.removeAttribute("aria-invalid");
      clearMeasurementError(input);
      return true;
    }
    let valid = true;
    try {
      window.CONFIG.validateMeasurement(input.id, parseInt(input.value, 10));
    } catch (_e) {
      valid = false;
    }
    input.setAttribute("aria-invalid", valid ? "false" : "true");
    if (valid) clearMeasurementError(input);
    else setMeasurementError(input);
    return valid;
  }

  // Explain the valid range to assistive tech via aria-errormessage. Sighted
  // users already get the red out-of-range border; screen-reader users only
  // heard "invalid entry" with no reason. The message is generated from the
  // CONFIG constraints + the i18n field label, so it stays data-driven and
  // bilingual (no per-field hardcoded strings). The text node is visually
  // hidden — an a11y affordance, not a visual change.
  function setMeasurementError(input) {
    const c = (window.CONFIG.MEASUREMENT_CONSTRAINTS || {})[input.id] || {};
    const errId = `${input.id}-error`;
    let el = document.getElementById(errId);
    if (!el) {
      el = document.createElement("span");
      el.id = errId;
      el.className = "visually-hidden";
      (input.parentElement || input).appendChild(el);
    }
    el.textContent = t("measure.range_error", {
      label: t(`ml.${input.id}`),
      min: c.min,
      max: c.max,
      unit: c.unit || "cm",
    });
    input.setAttribute("aria-errormessage", errId);
  }

  function clearMeasurementError(input) {
    input.removeAttribute("aria-errormessage");
    const el = document.getElementById(`${input.id}-error`);
    if (el) el.textContent = "";
  }

  // Felder, die eine passende Linie im Körperdiagramm haben
  const DIAGRAM_FIELDS = ["height", "shoulder", "chest", "waist", "hips", "inseam"];

  function initMeasurements() {
    Measurements.FIELDS.forEach((field) => {
      const input = document.getElementById(field);
      if (input) {
        input.addEventListener("input", updateMeasurements);
        // Validate on commit (blur/enter) so the flag doesn't flicker mid-type.
        input.addEventListener("change", () => validateMeasurementField(input));
        // Beim Fokus die passende Diagramm-Annotation hervorheben
        if (DIAGRAM_FIELDS.includes(field)) {
          input.addEventListener("focus", () => highlightAnnotation(field));
          input.addEventListener("blur", () => highlightAnnotation(null));
          input.addEventListener("mouseenter", () => highlightAnnotation(field));
          input.addEventListener("mouseleave", () => {
            if (document.activeElement !== input) highlightAnnotation(null);
          });
        }
      }
    });

    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        Measurements.applyPreset(btn.dataset.preset);
        updateMeasurements();
        showToast(t("toast.preset_loaded", { p: btn.dataset.preset }), "success");
      });
    });

    initPoseUpload();
    initAnnotationLinks();
    updateMeasurements();
  }

  // Reverse link: make the markers on the figure tappable. Clicking (or
  // Enter/Space on) a marker focuses its input — opening the collapsed
  // measurements on mobile first — so the photo doubles as a tappable legend.
  function initAnnotationLinks() {
    const group = document.querySelector(".measure-annotations");
    if (!group) return;
    const reduce = !!(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    group.querySelectorAll(".annotation").forEach((el) => {
      const field = el.dataset.measure;
      if (!DIAGRAM_FIELDS.includes(field)) return;
      const input = document.getElementById(field);
      if (!input) return;

      el.classList.add("is-tappable");
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      const labelEl = el.querySelector("text");
      el.setAttribute("aria-label",
        t("measure.jump_aria", { label: labelEl ? labelEl.textContent.trim() : field }));

      const activate = () => {
        const details = input.closest("details");
        if (details && !details.open) details.open = true;
        input.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        // Focus after the optional expand/scroll so the caret lands correctly.
        window.setTimeout(() => {
          input.focus();
          if (typeof input.select === "function") input.select();
        }, reduce ? 0 : 180);
      };

      el.addEventListener("click", activate);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });
      // Hover / keyboard focus previews the same highlight as focusing the field.
      el.addEventListener("mouseenter", () => highlightAnnotation(field));
      el.addEventListener("focus", () => highlightAnnotation(field));
      const clearIfIdle = () => {
        if (document.activeElement !== input && document.activeElement !== el) {
          highlightAnnotation(null);
        }
      };
      el.addEventListener("mouseleave", clearIfIdle);
      el.addEventListener("blur", clearIfIdle);
    });
  }

  // Hebt die zum Feld passende Linie im SVG-Körperdiagramm hervor.
  // field === null setzt alle zurück.
  function highlightAnnotation(field) {
    const group = document.querySelector(".measure-annotations");
    if (!group) return;
    group.classList.toggle("has-active", Boolean(field));
    group.querySelectorAll(".annotation").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.measure === field);
    });
    DIAGRAM_FIELDS.forEach((f) => {
      const fieldEl = document.getElementById(f);
      if (fieldEl) {
        fieldEl.closest(".measure-field")?.classList.toggle(
          "is-linked",
          f === field
        );
      }
    });
  }

  // Markiert den Preset-Button, dessen Werte exakt den aktuellen Maßen
  // entsprechen — oder keinen, sobald der Nutzer manuell abweicht.
  function updatePresetActive(measurements) {
    const match = ["S", "M", "L", "XL"].find((name) => {
      const preset = Measurements.PRESETS[name];
      return preset && Measurements.FIELDS.every(
        (f) => preset[f] === measurements[f]
      );
    });
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      const on = btn.dataset.preset === match;
      btn.classList.toggle("is-active", on);
      // Expose the selected preset to assistive tech, not just the visual class.
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function updateSizeReadout(measurements) {
    const el = document.getElementById("measure-size");
    if (el) el.textContent = Measurements.calculateSize(measurements);
  }

  // Which surface triggered the shared #pose-photo upload, so processPhotoFile
  // routes its progress somewhere that surface can actually see — the Ownership
  // chooser's feedback otherwise lands in the still-hidden #make-real panel.
  let photoFrom = "measure";

  function initPoseUpload() {
    const fileInput = document.getElementById("pose-photo");
    const uploadBtn = document.getElementById("pose-upload-btn");
    const statusEl = document.getElementById("pose-status");
    const previewWrap = document.getElementById("pose-preview");
    const canvas = document.getElementById("pose-canvas");

    if (!fileInput || !uploadBtn || !canvas) return;

    uploadBtn.addEventListener("click", () => { photoFrom = "measure"; fileInput.click(); });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fileInput.value = "";
      processPhotoFile(file);
    });

    // Drag & Drop direkt auf die Foto-Karte
    const card = uploadBtn.closest(".photo-upload-card");
    if (card) {
      // dragenter/dragleave feuern auch beim Wechsel zwischen Kind-
      // Elementen. Ein Tiefen-Zähler verhindert das Flackern: das
      // Highlight verschwindet erst, wenn der Cursor die Karte wirklich
      // verlässt (Zähler zurück auf 0).
      let dragDepth = 0;
      const clearDrag = () => {
        dragDepth = 0;
        card.classList.remove("is-dragover");
      };
      card.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragDepth++;
        card.classList.add("is-dragover");
      });
      card.addEventListener("dragover", (e) => e.preventDefault());
      card.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) card.classList.remove("is-dragover");
      });
      card.addEventListener("dragend", clearDrag);
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        clearDrag();
        if (uploadBtn.disabled) return;
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          showToast(t("toast.no_person"), "error");
          return;
        }
        photoFrom = "measure";
        processPhotoFile(file);
      });
    }

    async function processPhotoFile(file) {
      // Route progress to whichever surface launched the upload (measure section
      // vs the Ownership chooser) so neither looks frozen during MediaPipe analysis.
      const fromOwn = photoFrom === "own";
      const ownBtn = fromOwn ? document.getElementById("own-upload-btn") : null;
      const status = fromOwn ? document.getElementById("vto-status") : statusEl;
      const setStatus = (txt) => { if (status) status.textContent = txt; };
      const setBusy = (busy) => {
        if (ownBtn) { ownBtn.classList.toggle("is-loading", busy); ownBtn.disabled = busy; }
        else { uploadBtn.disabled = busy; uploadBtn.textContent = t(busy ? "measure.photo_btn_loading" : "measure.photo_btn_another"); }
      };
      setBusy(true);
      setStatus("");

      // Hold the photo as a data-URL in memory so the VTO feature can
      // forward it to Replicate later. Lives in StateManager so the
      // VTO button can read it cleanly.
      try {
        const dataUrl = await fileToDataUrl(file);
        S.set("userPhoto", dataUrl);
        updateVtoButtonState();
      } catch (_err) {
        // Non-fatal — measurements still work without retaining the photo
      }

      try {
        await window.Pose.init();
        if (!fromOwn) uploadBtn.textContent = t("measure.photo_btn_analyzing");
        setStatus(t("measure.status_detecting"));

        const { result, img } = await window.Pose.detect(file);

        if (!result.landmarks || !result.landmarks[0]) {
          showToast(t("toast.no_person"), "error");
          setStatus(t("measure.status_no_pose"));
          return;
        }

        const landmarks = result.landmarks[0];
        // Die Maß-Kalibrierung braucht Nase→Knöchel als Referenz. Wenn
        // beide Füße nicht im Bild sind, extrapoliert MediaPipe stille
        // Knöchel-Positionen unter den Bildrand und der px2cm-Faktor
        // wird sinnlos. Das Lite-Modell liefert nicht immer Visibility-
        // Scores, deshalb prüfen wir zusätzlich die Y-Koordinaten:
        // normalisierte Werte liegen normal bei 0..1 im Bild, > 1.05
        // bedeutet extrapoliert unter den unteren Bildrand.
        const ankleUsable = (lm) => {
          if (!lm) return false;
          const vis = lm.visibility ?? 1;
          const y = lm.y ?? 0.5;
          return vis >= 0.3 && y <= 1.05;
        };
        if (!ankleUsable(landmarks[27]) && !ankleUsable(landmarks[28])) {
          showToast(t("toast.no_feet"), "error");
          setStatus(t("measure.status_no_feet"));
          return;
        }
        const heightInput = document.getElementById("height");
        const userHeight = parseInt(heightInput?.value, 10) || 175;
        const measurements = window.Pose.estimateMeasurements(
          landmarks,
          userHeight
        );

        Measurements.write(measurements);
        updateMeasurements();

        const personalization = window.Pose.samplePersonalization(img, landmarks);
        let personalized = false;
        if (personalization.skinTone) {
          personalized = S.set("skinTone", personalization.skinTone);
        }
        if (personalization.hairColor) {
          S.set("hairColor", personalization.hairColor);
        }

        previewWrap.hidden = false;
        window.Pose.drawPoseOverlay(canvas, img, landmarks);
        setStatus(t("measure.status_result", {
          chest: measurements.chest,
          waist: measurements.waist,
          hips: measurements.hips,
        }));
        showToast(
          personalized ? t("toast.photo_skin") : t("toast.photo_only"),
          "success"
        );
      } catch (err) {
        console.error("[pose] failed:", err);
        // Client-side pose/measure failure (MediaPipe load or inference). The
        // photo never leaves the device; only the error reaches Sentry — no PII.
        if (window.Sentry) window.Sentry.captureException(err, { tags: { area: "measure" } });
        showToast(t("toast.photo_failed", { msg: err.message || err }), "error");
        setStatus(t("measure.status_error"));
      } finally {
        setBusy(false);
        photoFrom = "measure";
      }
    }
  }

  function updateMeasurements() {
    const measurements = Measurements.read();
    S.set("measurements", measurements);
    updatePresetActive(measurements);
    updateSizeReadout(measurements);
    updateProductionPreview();
  }

  // The design-info panel inside the merged Ownership/try-on moment. It shows
  // the design's identity (type/material/colour/fit/length) the moment a design
  // exists; size fills in once measurements are present, "—" until then.
  function updateOwnInfo() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const type = S.get("currentType");
    const material = S.get("currentMaterial");
    const fit = S.get("currentFit");
    const length = S.get("currentLength");
    const color = S.get("currentColor");
    const measurements = S.get("measurements");
    set("oi-type", type ? typeLabel(type) : "—");
    set("oi-material", material ? typeMaterialLabel(material) : "—");
    set("oi-fit", (fit !== null && fit !== undefined) ? fitLabel(fit) : "—");
    set("oi-length", length ? lengthLabel(length) : "—");
    set("oi-size", measurements ? Measurements.calculateSize(measurements) : "—");
    const colorEl = document.getElementById("oi-color");
    if (colorEl) {
      colorEl.innerHTML = color
        ? `<span class="oi-swatch" style="background:${escapeHtml(color)}"></span>${escapeHtml(colorAdjective(color))}`
        : "—";
    }
    renderOwnStageFlat();
  }

  // "Dein Stück" statt Beispielfoto (Ehrlichkeits-Regel: nie fremde Ware neben
  // dem eigenen Entwurf): der Platzhalter der Anprobe-Bühne zeigt das ECHTE
  // Teil — die parametrische Flat aus der Design-DNA, inkl. Made-for-one-
  // Proportionen aus den Massen, live nachgeführt bei jeder Facade-Änderung
  // (updateOwnInfo hängt bereits an allen relevanten State-Keys). Designs vom
  // Freitext-Pfad tragen keine DNA — dann baut der State die Params direkt.
  // Ein VTO-Ergebnis ersetzt die Bühne wie bisher (das eigene Foto gewinnt).
  // EINE Quelle für „das aktuelle Stück als Flat-Params": Ownership-Bühne und
  // Produktions-Zeichnung müssen dasselbe Teil zeigen — Journey-DNA mit
  // Facade-Vorrang, sonst Params direkt aus dem State, immer inkl.
  // Made-for-one-Proportionen aus den Massen.
  function currentFlatParams() {
    if (!window.DesignPreview) return null;
    const design = S.get("currentDesign");
    const type = S.get("currentType") || (design && design.type) || "tshirt";
    const color = S.get("currentColor");
    let p;
    if (design && design.dna && window.DesignDNA) {
      const clone = JSON.parse(JSON.stringify(design.dna));
      const setD = (path, v) => window.DesignDNA.set(clone, path, v, 1);
      // Die Facade-Overrides (Weiter anpassen) gewinnen über die Journey-DNA —
      // dieselbe Vorrang-Regel wie applyJourneyDesign in Gegenrichtung.
      if (color) {
        const stops = window.DesignDNA.get(clone, "color.stops");
        const primary = Array.isArray(stops) && stops.length ? String(stops[0]).toLowerCase() : null;
        // Nur eine AKTIVE Umfärbung (Facade-Wahl ≠ DNA-Primärfarbe) greift ein
        // — und dann konsistent als Vollton, denn Karte und Prompt sprechen
        // von EINER Farbe (Review-Fund: halber Alt-Verlauf log). Unverändert
        // gespiegelte Farbe → die Journey-Farbwelt (inkl. Verlauf) bleibt.
        if (!primary || primary !== String(color).toLowerCase()) {
          setD("color.stops", [color]);
          setD("color.scheme", "mono");
        }
      }
      const material = S.get("currentMaterial"); if (material) setD("fabric.material", material);
      const fit = S.get("currentFit"); if (fit !== null && fit !== undefined) setD("silhouette.fit", fit);
      const length = S.get("currentLength"); if (length) setD("length", length);
      // Auch der TYP folgt der Vorrang-Regel: wechselt der User die Kategorie
      // im Studio, zeigt die Bühne nie weiter die alte DNA-Kategorie, während
      // Karte + Spec schon die neue nennen (Review-Fund).
      if (type && window.DesignDNA.get(clone, "category") !== type) setD("category", type);
      p = window.DesignPreview.params(clone);
    } else {
      // CONFIG.PATTERNS und die GarmentSVG-Musterwelt sind zwei Vokabulare —
      // ungemappt fiele z. B. "stripes_h" auf den Abstrakt-Default (Review-
      // Fund: Streifen-Design bekäme Kringel). Flächen-Looks ohne Motiv
      // (heather/gradient) tragen bewusst kein Muster.
      const PATTERN_TO_FLAT = { stripes_h: "stripe", stripes_v: "stripe", dots: "graphic", plaid: "check", camo: "camo", floral: "abstract" };
      p = {
        category: type,
        fit: S.get("currentFit"),
        length: S.get("currentLength"),
        material: S.get("currentMaterial"),
        stops: color ? [color] : undefined,
        scheme: "mono",
        pattern: PATTERN_TO_FLAT[design && design.pattern] || "none",
        energy: 0.55,
      };
    }
    if (window.DesignFlow && window.DesignFlow.bodyFactors) {
      const body = window.DesignFlow.bodyFactors(S.get("measurements"));
      if (body) p.body = body;
    }
    return p;
  }

  function renderOwnStageFlat() {
    const example = document.getElementById("vto-example");
    if (!example || !window.GarmentSVG || !window.DesignPreview) return;
    const design = S.get("currentDesign");
    let host = example.querySelector(".own-flat");
    if (!design) {
      if (host) { host.remove(); example.classList.remove("has-flat"); example.classList.add("has-image"); }
      return;
    }
    const type = S.get("currentType") || design.type || "tshirt";
    const p = currentFlatParams();
    if (!p) return;
    if (!host) {
      host = document.createElement("div");
      host.className = "own-flat";
      host.setAttribute("aria-hidden", "true");
      example.prepend(host);
    }
    example.classList.add("has-flat");
    example.classList.remove("has-image");
    host.innerHTML = window.GarmentSVG.build(p.category || type, p);
    // Das Badge sagt jetzt, WAS auf der Bühne liegt — dauerhaft sprachfest
    // über den data-i18n-Key (Language-Switch re-hydriert das Attribut).
    const tag = example.querySelector(".vto-example-tag");
    if (tag) { tag.setAttribute("data-i18n", "own.stage_tag"); tag.textContent = t("own.stage_tag"); }
  }

  // "Wer trägt es?" — the chooser in the Ownership/try-on moment. Either the
  // user's own photo (reuses the existing pose-upload pipeline, so it also
  // pre-fills measurements) or one of the 6 preset persons. A preset is a
  // same-origin asset; /api/try-on requires a data:image/ URL, so we fetch it
  // and convert before handing it to the unchanged VTO flow as userPhoto.
  function initOwnershipChooser() {
    const grid = document.getElementById("own-presets");
    const uploadBtn = document.getElementById("own-upload-btn");
    const poseInput = document.getElementById("pose-photo");

    const clearPresetSelection = () => {
      document.querySelectorAll(".own-preset").forEach((b) => {
        b.classList.remove("is-selected");
        b.setAttribute("aria-pressed", "false");
      });
    };

    if (uploadBtn && poseInput) {
      uploadBtn.addEventListener("click", () => {
        clearPresetSelection();
        photoFrom = "own"; // route the analysis feedback to the Ownership chooser
        // Programmatic click opens the file dialog even though the input lives
        // in the (still-collapsed) make-real path — visibility is irrelevant.
        poseInput.click();
      });
    }

    if (grid) {
      const buttons = Array.from(grid.querySelectorAll(".own-preset"));
      buttons.forEach((btn, i) => {
        btn.setAttribute("aria-label", t("own.preset_alt", { n: i + 1 }));
        btn.addEventListener("click", () => choosePreset(btn, buttons));
      });
    }
  }

  // Bumped on every choosePreset call so an in-flight fetch from an earlier
  // click can tell it's stale once it resolves.
  let presetRequestSeq = 0;

  async function choosePreset(btn, buttons) {
    buttons.forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const id = btn.dataset.preset;
    btn.classList.add("is-loading");
    const requestId = ++presetRequestSeq;
    try {
      const res = await fetch(`assets/presets/${id}.jpg`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
      // A later click may have started (and possibly already resolved) while
      // this fetch was in flight — only the most recent click should ever
      // win, so the stored photo always matches the visually selected preset.
      if (requestId !== presetRequestSeq) return;
      // Sets userPhoto → the subscribed updateVtoButtonState enables the button.
      S.set("userPhoto", dataUrl);
    } catch (_err) {
      if (requestId !== presetRequestSeq) return;
      btn.classList.remove("is-selected");
      btn.setAttribute("aria-pressed", "false");
      showToast(t("vto.error_unexpected"), "error");
    } finally {
      btn.classList.remove("is-loading");
    }
  }

  // ── „Weiter anpassen" — Inline-Kalibrierung im Ownership-Moment ───────────
  // Die einzige Anpass-Oberfläche (das alte #design-„Atelier"-Panel ist weg):
  // setzt den Zustand direkt (S.set + Design-Objekt + updateProductionPreview),
  // Farbe über applyColor, Größe über die Maß-Presets in #measure. EIN Zustand,
  // die bestehenden Subscriptions hängen die Anzeige (Info-Panel/Spec) nach.
  const OE_COLORS = ["#1a1a1a", "#ffffff", "#7c2d12", "#1e3a8a", "#365314", "#a16207", "#831843", "#6b21a8", "#f59e0b", "#dc2626"];
  const OE_MATERIALS = ["cotton", "linen", "denim", "wool", "fleece", "silk", "polyester"];
  const OE_LENGTHS = ["cropped", "regular", "long"];

  function populateOwnEditorOptions() {
    const oeMat = document.getElementById("oe-material");
    if (oeMat) oeMat.innerHTML = OE_MATERIALS
      .map((k) => `<option value="${k}">${escapeHtml(typeMaterialLabel(k))}</option>`).join("");
    const oeLen = document.getElementById("oe-length");
    if (oeLen) oeLen.innerHTML = OE_LENGTHS
      .map((k) => `<option value="${k}">${escapeHtml(lengthLabel(k))}</option>`).join("");
    const colors = document.getElementById("oe-colors");
    if (!colors) return;
    if (!colors.children.length) {
      OE_COLORS.forEach((hex) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "oe-color";
        b.dataset.color = hex;
        b.style.background = hex;
        b.setAttribute("aria-pressed", "false");
        b.setAttribute("aria-label", colorAdjective(hex));
        b.addEventListener("click", () => { applyColor(hex); syncOwnEditor(); resetOwnStage(); });
        colors.appendChild(b);
      });
    } else {
      // language switch → relocalise the colour names.
      colors.querySelectorAll(".oe-color").forEach((b) =>
        b.setAttribute("aria-label", colorAdjective(b.dataset.color)));
    }
  }

  // Mirror the fit slider's position as a human label — visibly (Slim/Regular/
  // Oversized) and to assistive tech via aria-valuetext, so the raw 0–100 value
  // is never the only feedback. Reuses fitLabel so it follows the active locale.
  function updateFitFeedback(slider) {
    if (!slider) return;
    const label = fitLabel(slider.value / 100);
    slider.setAttribute("aria-valuetext", label);
    const out = document.getElementById("oe-fit-value");
    if (out) out.textContent = label;
  }

  // Reflect current state onto the editor controls without firing their events
  // (setting .value / attributes does not dispatch), so there is no feedback loop.
  function syncOwnEditor() {
    const oeMat = document.getElementById("oe-material");
    const mat = S.get("currentMaterial");
    if (oeMat && mat) oeMat.value = mat;
    const oeLen = document.getElementById("oe-length");
    const len = S.get("currentLength");
    if (oeLen && len) oeLen.value = len;
    const oeFit = document.getElementById("oe-fit");
    const fit = S.get("currentFit");
    if (oeFit && fit !== null && fit !== undefined) oeFit.value = Math.round(fit * 100);
    updateFitFeedback(oeFit);
    const color = S.get("currentColor");
    document.querySelectorAll("#oe-colors .oe-color").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.color === color ? "true" : "false"));
    const measurements = S.get("measurements");
    const size = measurements ? Measurements.calculateSize(measurements) : null;
    document.querySelectorAll("#oe-sizes .oe-size").forEach((b) => {
      const on = b.dataset.size === size;
      b.classList.toggle("is-active", on);
      // Mirror the selected size to assistive tech (matches the colour swatches).
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // After an edit the shown try-on render is stale → revert the stage to the
  // example placeholder so it's clear the user re-generates to see the change.
  function resetOwnStage() {
    const img = document.getElementById("vto-result-img");
    if (!img || img.hidden) return;
    img.hidden = true;
    const actions = document.getElementById("vto-result-actions");
    if (actions) actions.hidden = true;
    const example = document.getElementById("vto-example");
    if (example) example.hidden = false;
  }

  function initOwnEditor() {
    populateOwnEditorOptions();
    const oeMat = document.getElementById("oe-material");
    if (oeMat) oeMat.addEventListener("change", () => {
      const material = normalizeMaterial(oeMat.value);
      if (!S.set("currentMaterial", material)) return;
      const d = S.get("currentDesign"); if (d) d.material = material;
      updateProductionPreview(); resetOwnStage();
    });
    const oeLen = document.getElementById("oe-length");
    if (oeLen) oeLen.addEventListener("change", () => {
      const length = normalizeLength(oeLen.value);
      if (!S.set("currentLength", length)) return;
      const d = S.get("currentDesign"); if (d) d.length = length;
      updateProductionPreview(); resetOwnStage();
    });
    const oeFit = document.getElementById("oe-fit");
    if (oeFit) oeFit.addEventListener("input", () => {
      const fit = oeFit.value / 100;
      updateFitFeedback(oeFit);
      if (!S.set("currentFit", fit)) return;
      const d = S.get("currentDesign"); if (d) d.fit = fit;
      updateProductionPreview(); resetOwnStage();
    });
    // Size reuses the measurement presets in #measure (still the source of truth).
    document.querySelectorAll("#oe-sizes .oe-size").forEach((b) =>
      b.addEventListener("click", () => {
        const pb = document.querySelector(`.preset-btn[data-preset="${b.dataset.size}"]`);
        if (pb) pb.click();
        resetOwnStage();
        syncOwnEditor();
      }));
    syncOwnEditor();
  }

  function updateProductionPreview() {
    const measurements = S.get("measurements");
    if (!measurements) return;

    // Die Vorlage wird echt: die technische Zeichnung des Stücks (dieselben
    // Flat-Params wie die Ownership-Bühne — eine Quelle, ein Teil) läuft im
    // selben Funnel mit und folgt damit jeder State-Änderung.
    const drawingHost = document.getElementById("spec-drawing");
    if (drawingHost && window.GarmentSVG) {
      const fp = currentFlatParams();
      if (fp) drawingHost.innerHTML = window.GarmentSVG.build(fp.category || "tshirt", fp);
    }

    const currentColor = S.get("currentColor");
    const currentMaterial = S.get("currentMaterial");
    const currentFit = S.get("currentFit");
    const currentType = S.get("currentType");
    const currentLength = S.get("currentLength");
    const currentPrint = S.get("currentPrint");

    const design = S.get("currentDesign") || {
      name: t("prod.placeholder_name"),
      description: t("prod.placeholder_desc"),
      designId: "UR-XXXXXX",
      originalPrompt: "–",
      color: currentColor,
      material: currentMaterial,
      fit: currentFit,
      length: currentLength,
      print: currentPrint,
      tags: [],
      constructionNotes: [t("prod.placeholder_note")],
      generatedAt: new Date().toISOString(),
    };

    const specData = Export.buildSpecData(design, measurements, currentType);

    document.getElementById("spec-title").textContent =
      design.name.toUpperCase();
    document.getElementById("spec-id").textContent = t("spec.id_prefix", { id: design.designId });
    document.getElementById("spec-date").textContent =
      new Date().toLocaleDateString(window.I18N ? window.I18N.locale() : "de-DE");
    document.getElementById("spec-brief").textContent =
      `"${design.originalPrompt}" — ${design.description}`;
    document.getElementById("spec-type").textContent = typeLabel(currentType);
    document.getElementById("spec-material").textContent = typeMaterialLabel(currentMaterial);

    document.getElementById("spec-fit").textContent =
      specData.specifications.fit;
    document.getElementById("spec-length").textContent =
      lengthLabel(currentLength);
    // SpecView owns the #spec-color fragment (clears + rebuilds the swatch in
    // renderColor), so the spec sheet's colour cell is rendered here, once.
    window.SpecView.renderProductionDetails({
      color: currentColor,
      print: currentPrint,
      measurements,
      constructionNotes: design.constructionNotes,
      measureLabel,
    });
    document.getElementById("spec-size").textContent =
      specData.specifications.size;

    // Pre-launch: no live lead time or price exists yet, so the estimate block
    // shows an honest forward-looking placeholder instead of a concrete quote
    // (which would read as a real offer). The computed days/range stay in the
    // spec data for the future, but aren't presented as a deliverable here.
    document.getElementById("est-time").textContent = t("est.future");
    document.getElementById("est-price").textContent = t("est.price_planned");
  }

  function getCurrentSpecData() {
    if (!S.get("currentDesign")) {
      showToast(t("toast.need_design"), "error");
      return null;
    }
    return Export.buildSpecData(
      S.get("currentDesign"),
      S.get("measurements"),
      S.get("currentType"),
    );
  }

  function initExportButtons() {
    document.getElementById("download-json").addEventListener("click", () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      Export.downloadJSON(spec);
      showToast(t("toast.json_done"), "success");
    });

    document.getElementById("download-html").addEventListener("click", () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      // Die Zeichnung der Vorlage reist mit — exakt das SVG, das auf dem
      // Spec-Sheet steht (eine Quelle; nur GarmentSVG-Output, hex-geklemmt).
      const drawing = document.getElementById("spec-drawing");
      Export.downloadHTML(spec, drawing ? drawing.innerHTML : "");
      showToast(t("toast.html_done"), "success");
    });

    document.getElementById("print-spec").addEventListener("click", () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      Export.print();
    });

    document.getElementById("send-order").addEventListener("click", () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      // Pre-launch: there is no production or checkout yet, so the honest
      // action is to JOIN ("be first"), not to place an order. Open the
      // existing Formspree join overlay — its CTA (#sphere-join-cta) wires the
      // overlay at module load, independent of the lazy 3D boot. Fall back to
      // navigating to #community if the CTA isn't in the DOM.
      const joinCta = document.getElementById("sphere-join-cta");
      if (joinCta) joinCta.click();
      else location.hash = "#community";
    });
  }

  // Downscale to max 1024 px on the longest edge and encode as JPEG. The
  // Vercel Edge Function caps request bodies at 4.5 MB; a raw 4-8 MB
  // phone photo + base64 overhead blows past that. JPEG @ 0.85 keeps a
  // typical full-body shot under ~300 KB while preserving enough detail
  // for FLUX-Kontext to recognize the person.
  function fileToDataUrl(file, maxDim = 1024) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = Math.min(1, maxDim / longest);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(img.src);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(img.src);
        reject(e);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  // Client-side rate limit. localStorage persists across sessions so
  // refreshing the page doesn't reset the count. A motivated user can
  // still bypass via incognito / devtools, but for honest visitors this
  // caps the per-browser Replicate spend at VTO_LIMIT × ~$0.04. Set high
  // enough (25 ≈ $1/browser) that real users never hit it — it exists only
  // as a cheap backstop against accidental runaway spend.
  const VTO_LIMIT = 25;
  const VTO_STORAGE_KEY = "urev_vto_count";

  function getVtoCount() {
    try {
      const n = parseInt(localStorage.getItem(VTO_STORAGE_KEY) || "0", 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  function incrementVtoCount() {
    try {
      localStorage.setItem(VTO_STORAGE_KEY, String(getVtoCount() + 1));
    } catch {
      // localStorage blocked (Safari private mode, storage full) — silently skip
    }
  }

  function updateVtoButtonState() {
    const btn = document.getElementById("vto-btn");
    const hint = document.getElementById("vto-btn-hint");
    if (!btn || !hint) return;
    const hasPhoto = !!S.get("userPhoto");
    const hasDesign = !!S.get("currentDesign");
    const used = getVtoCount();
    const remaining = Math.max(0, VTO_LIMIT - used);
    if (!hasPhoto) {
      btn.disabled = true;
      hint.textContent = t("vto.hint_no_photo");
    } else if (!hasDesign) {
      btn.disabled = true;
      hint.textContent = t("vto.hint_no_design");
    } else if (remaining === 0) {
      btn.disabled = true;
      hint.textContent = t("vto.hint_limit", { limit: VTO_LIMIT });
    } else {
      btn.disabled = false;
      hint.textContent = used === 0
        ? t("vto.hint_ready_first", { limit: VTO_LIMIT })
        : t("vto.hint_ready_remaining", { remaining, limit: VTO_LIMIT });
    }
  }

  function initVtoButton() {
    const btn = document.getElementById("vto-btn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const userPhoto = S.get("userPhoto");
      const design = S.get("currentDesign");
      if (!userPhoto || !design) return;
      if (getVtoCount() >= VTO_LIMIT) {
        // Belt-and-suspenders: button should already be disabled, but
        // guard against stale DOM state.
        return;
      }

      btn.disabled = true;
      startVtoInline();
      setVtoStatus(t("vto.status_sending"));

      const designPrompt = buildVtoPrompt(design);

      try {
        const res = await fetch("/api/try-on", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPhoto, designPrompt }),
        });
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          setVtoError(codedErrorMessage(body) || t("vto.error_prefix", { msg: body.error || res.statusText }));
          return;
        }

        if (body.pending) {
          setVtoError(t("vto.error_pending"));
          return;
        }

        if (body.imageUrl && CONFIG.isSafeImageUrl(body.imageUrl)) {
          // Only charge against the limit on a real, billable success.
          // Errors and timeouts don't cost money on Replicate and
          // shouldn't punish the user's quota. The URL is validated as
          // https:// before it reaches img.src / fetch / window.open.
          showVtoResult(body.imageUrl);
          incrementVtoCount();
        } else {
          setVtoError(t("vto.error_unexpected"));
        }
      } catch (err) {
        // Photoreal try-on (Replicate). No photo / prompt sent to Sentry.
        if (window.Sentry) window.Sentry.captureException(err, { tags: { area: "vto" } });
        setVtoError(t("vto.error_network", { msg: err.message }));
      } finally {
        // Always refresh the button/hint state — previously only the success
        // branch did, so an error or pending result left it out of sync.
        updateVtoButtonState();
      }
    });

    document.getElementById("vto-download")?.addEventListener("click", downloadVtoImage);
  }

  // Map a coded edge-function error (service_unavailable / rate_limited /
  // failed) to a friendly, localised message. The edge functions never send
  // the raw upstream reason (billing/credit/auth) to the browser — only a
  // code. Returns null for unknown codes so callers keep their own fallback.
  function codedErrorMessage(body) {
    const key = CONFIG.errorMessageKey(body && body.code);
    return key ? t(key) : null;
  }

  // Per-material fabric optics, in plain observable terms (weave · drape ·
  // surface · sheen) the image model can actually render. Physically grounded:
  // silk = low roughness → sharp specular sheen + fluid drape; wool/fleece =
  // high roughness + nap → matte, no highlight; denim = stiff twill; linen =
  // crisp slubby weave. Describes the FABRIC the user picked — never the design
  // (the user owns the design; see CLAUDE.md "AI's role").
  const FABRIC_DESCRIPTORS = {
    cotton: "matte plain-weave cotton, soft diffuse surface, easy medium drape",
    linen: "crisp linen weave with subtle slubs, matte, structured drape, natural creasing",
    denim: "dense indigo twill denim, stiff heavy drape, slight nap, subtle fade at seams",
    wool: "matte napped wool, soft fuzzy surface, no sheen, heavy structured drape",
    fleece: "dense napped fleece pile, fully matte, soft thick surface, gentle drape",
    silk: "smooth lustrous silk, sharp specular sheen, fluid liquid drape, fine weave",
    polyester: "tight technical weave, faint even synthetic sheen, smooth medium drape",
  };

  function buildVtoPrompt(design) {
    const parts = [];
    if (design.name) parts.push(design.name);
    if (design.description) parts.push(design.description);
    if (design.originalPrompt) parts.push(design.originalPrompt);
    // Garment type + material + color as a fallback for terse designs
    const type = S.get("currentType");
    const material = S.get("currentMaterial");
    const color = S.get("currentColor");
    parts.push(`${type} in ${color} (${material})`);
    // Fabric optics for the chosen material so the render reads as that cloth
    // (sheen/drape/weave), not a generic surface. Appended last so the 990-char
    // cap trims it before the user's own words if a prompt is very long.
    const fabric = FABRIC_DESCRIPTORS[material];
    if (fabric) parts.push(`Fabric: ${fabric}`);
    // Both /api/try-on and /api/preview-design reject a designPrompt over
    // 1000 chars (400). A detailed prompt + a verbose AI description can
    // exceed that, so cap the joined string with a small safety margin —
    // the trailing type/colour/material clause is the least important to
    // keep intact, so trimming the tail is fine.
    return parts.filter(Boolean).join(". ").slice(0, 990);
  }

  // Last successful generation URL, kept so the download button can fetch it.
  let vtoLastImageUrl = null;

  // Put the inline preview stage into its "generating" state: hide the example
  // placeholder and any prior result, reveal the spinner. (The result renders
  // inline in step 3 now — there is no modal.)
  function startVtoInline() {
    const stage = document.getElementById("vto-stage");
    const example = document.getElementById("vto-example");
    const loading = stage?.querySelector(".vto-loading");
    const spinner = stage?.querySelector(".vto-spinner");
    const img = document.getElementById("vto-result-img");
    const actions = document.getElementById("vto-result-actions");
    // Toggle the hidden attribute (not inline display) so the markup stays
    // semantically correct; CSS [hidden] guards on .vto-stage handle layout.
    if (example) example.hidden = true;
    if (img) {
      img.hidden = true;
      img.removeAttribute("src");
    }
    if (actions) actions.hidden = true;
    if (loading) loading.hidden = false;
    if (spinner) spinner.style.display = "";
    // Leave the error state behind on a retry: restore the loading look and the
    // polite live region (an in-progress status, not an alert).
    if (loading) loading.classList.remove("has-error");
    const status = document.getElementById("vto-status");
    if (status) {
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
    }
  }

  function setVtoStatus(text) {
    const status = document.getElementById("vto-status");
    if (status) status.textContent = text;
  }

  function setVtoError(text) {
    // Make the failure read as a final state, not a stalled loader: the spinner
    // is removed and .has-error restyles the panel (full-contrast message, no
    // spinner gap) so sighted users don't mistake it for "still generating".
    // Announce assertively (role=alert) so a screen reader interrupts with the
    // error, mirroring the showToast error pattern. Set the role BEFORE the
    // text so AT registers the live region as assertive when the text lands.
    const loading = document.querySelector(".vto-loading");
    const status = document.getElementById("vto-status");
    if (loading) loading.classList.add("has-error");
    if (status) {
      status.setAttribute("role", "alert");
      status.setAttribute("aria-live", "assertive");
    }
    setVtoStatus(text);
    const spinner = document.querySelector(".vto-spinner");
    if (spinner) spinner.style.display = "none";
  }

  function showVtoResult(url) {
    const loading = document.querySelector(".vto-loading");
    const example = document.getElementById("vto-example");
    const img = document.getElementById("vto-result-img");
    const actions = document.getElementById("vto-result-actions");
    if (loading) loading.hidden = true;
    if (example) example.hidden = true;
    if (img) {
      img.src = url;
      img.hidden = false;
    }
    if (actions) actions.hidden = false;
    vtoLastImageUrl = url;
    // If the current design is in the library, attach this VTO image so
    // the library tile gets a real preview thumbnail next time it renders.
    const current = S.get("currentDesign");
    if (current && window.Library && window.Library.get(current.designId)) {
      window.Library.setVtoImage(current.designId, url);
    }
  }

  async function downloadVtoImage() {
    if (!vtoLastImageUrl) return;
    const filename = `urban-revolution-${Date.now()}.jpg`;
    try {
      // Replicate's CDN sets CORS allow-origin: *, so this normally
      // works. If it ever doesn't, fall through to opening in a new
      // tab where the user can long-press / right-click to save.
      const res = await fetch(vtoLastImageUrl, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so the browser has time to start the download.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (_err) {
      window.open(vtoLastImageUrl, "_blank", "noopener");
    }
  }

  // ───── Saved Designs Library ─────

  let libraryEscHandler = null;
  let libraryFocusReturnEl = null;
  let libraryTrapRelease = null;

  function updateLibraryCount() {
    if (!window.Library) return;
    const count = window.Library.count();
    const trigger = document.getElementById("library-open");
    const countEl = document.getElementById("library-count");
    if (!trigger || !countEl) return;
    countEl.textContent = String(count);
    trigger.hidden = count === 0;
  }

  function renderLibraryGrid() {
    const grid = document.getElementById("library-grid");
    const hint = document.getElementById("library-modal-hint");
    if (!grid || !window.Library) return;
    const designs = window.Library.list();

    if (designs.length === 0) {
      hint.textContent = t("library.empty");
      grid.innerHTML = "";
      return;
    }

    const max = window.Library.MAX_ENTRIES || 20;
    hint.textContent = t("library.count", { n: designs.length, max });

    grid.innerHTML = designs.map((d) => {
      const tLabel = typeLabel(d.type);
      const matLabel = typeMaterialLabel(d.material);
      const dateStr = (() => {
        try { return new Date(d.savedAt).toLocaleDateString(window.I18N ? window.I18N.locale() : "de-DE"); }
        catch { return ""; }
      })();
      const tileImage = d.vtoImageUrl || d.previewImageUrl;
      const visual = tileImage
        ? `<img class="library-tile-photo" src="${escapeHtml(tileImage)}" alt="" loading="lazy">`
        : `<div class="library-tile-icon" style="color:${escapeHtml(d.color)}">${typeIconSvg(d.type, 56)}</div>`;
      return `
        <article class="library-tile" data-id="${escapeHtml(d.id)}">
          <div class="library-tile-visual">
            ${visual}
            <span class="library-tile-swatch" style="background:${escapeHtml(d.color)}" aria-hidden="true"></span>
          </div>
          <div class="library-tile-body">
            <h4>${escapeHtml(d.name)}</h4>
            <p class="library-tile-meta">${escapeHtml(tLabel)} · ${escapeHtml(matLabel)}</p>
            ${dateStr ? `<p class="library-tile-date">${dateStr}</p>` : ""}
            <div class="library-tile-actions">
              <button class="library-tile-load" data-action="load" data-id="${escapeHtml(d.id)}" type="button">${escapeHtml(t("library.load"))}</button>
              <button class="library-tile-delete" data-action="delete" data-id="${escapeHtml(d.id)}" type="button" aria-label="${escapeHtml(t("library.delete"))}">×</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function loadDesignFromLibrary(id) {
    if (!window.Library) return;
    const entry = window.Library.get(id);
    if (!entry) {
      showToast(t("toast.not_found"), "error");
      return;
    }
    const design = {
      designId: entry.id,
      name: entry.name,
      type: entry.type,
      color: entry.color,
      material: entry.material,
      fit: entry.fit,
      tags: entry.tags || [],
      pattern: entry.pattern || "solid",
      length: entry.length || "regular",
      print: entry.print || "",
      originalPrompt: entry.originalPrompt || "",
      constructionNotes: entry.constructionNotes || [],
      description: t("lib.loaded_desc"),
      generatedAt: entry.savedAt,
      previewImageUrl: entry.previewImageUrl || null,
      measurements: entry.measurements || null,
    };
    // Explizites Zurückholen ist KEIN In-Flight-Race: der gespeicherte Typ
    // gewinnt. Erst currentType setzen, DANN applyDesignToState — dessen
    // "State-gewinnt"-Regel würde sonst design.type auf den alten Selektor-
    // Stand zurückzwingen (gespeicherte Jacke käme als T-Shirt zurück).
    S.set("currentType", entry.type);
    S.set("currentDesign", design);
    document.getElementById("ai-prompt").value = entry.originalPrompt || "";
    setActiveType(entry.type);
    applyDesignToState(design);
    // Restore the design's own measurement snapshot (library.js keeps one per
    // entry) — otherwise the recalled design silently inherits whatever
    // measurements are currently in the form/state from a different design.
    if (entry.measurements) {
      Measurements.write(entry.measurements);
      updateMeasurements();
    }
    updateProductionPreview();
    closeLibraryModal();
    showToast(t("toast.loaded", { name: entry.name }), "success");
  }

  function deleteDesignFromLibrary(id) {
    if (!window.Library) return;
    const entry = window.Library.get(id);
    window.Library.remove(id);
    renderLibraryGrid();
    updateLibraryCount();
    if (entry) showToast(t("toast.deleted", { name: entry.name }), "info");
  }

  function openLibraryModal() {
    const modal = document.getElementById("library-modal");
    if (!modal) return;
    renderLibraryGrid();
    modal.hidden = false;
    libraryFocusReturnEl = document.activeElement;
    document.getElementById("library-modal-close")?.focus();
    const content = modal.querySelector(".library-modal-content");
    libraryTrapRelease = window.FocusTrap ? window.FocusTrap.activate(content) : null;
    libraryEscHandler = (e) => {
      if (e.key === "Escape") closeLibraryModal();
    };
    document.addEventListener("keydown", libraryEscHandler);
  }

  function closeLibraryModal() {
    const modal = document.getElementById("library-modal");
    if (modal) modal.hidden = true;
    if (libraryTrapRelease) { libraryTrapRelease(); libraryTrapRelease = null; }
    if (libraryEscHandler) {
      document.removeEventListener("keydown", libraryEscHandler);
      libraryEscHandler = null;
    }
    if (libraryFocusReturnEl && typeof libraryFocusReturnEl.focus === "function") {
      libraryFocusReturnEl.focus();
    }
    libraryFocusReturnEl = null;
  }

  function initLibrary() {
    if (!window.Library) return;
    updateLibraryCount();

    document.getElementById("library-open")?.addEventListener("click", openLibraryModal);
    document.getElementById("library-modal-close")?.addEventListener("click", closeLibraryModal);
    document.querySelector(".library-modal-backdrop")?.addEventListener("click", closeLibraryModal);

    // Event-delegation for tile actions — tiles get re-rendered each open
    document.getElementById("library-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "load") loadDesignFromLibrary(id);
      else if (btn.dataset.action === "delete") deleteDesignFromLibrary(id);
    });
  }

  // Reflect the active language on the DE / EN segmented control.
  function updateLangToggleState() {
    if (!window.I18N) return;
    const lang = window.I18N.getLang();
    document.querySelectorAll("#lang-toggle .lang-opt").forEach((opt) => {
      const on = opt.dataset.lang === lang;
      opt.classList.toggle("is-active", on);
      if (on) opt.setAttribute("aria-current", "true");
      else opt.removeAttribute("aria-current");
    });
  }

  function initLangToggle() {
    const toggle = document.getElementById("lang-toggle");
    if (!toggle || !window.I18N) return;
    updateLangToggleState();
    toggle.addEventListener("click", (e) => {
      const opt = e.target.closest(".lang-opt");
      // Click a specific option, or just flip to the other language.
      const target = opt
        ? opt.dataset.lang
        : window.I18N.getLang() === "de" ? "en" : "de";
      window.I18N.setLang(target);
    });
  }

  // I18N.apply() retranslates the static DOM; here we rebuild everything
  // app.js renders dynamically so a language switch is reflected everywhere.
  function onLanguageChange() {
    updateLangToggleState();
    renderSuggestions();
    updateProductionPreview();
    updateVtoButtonState();
    updateOwnInfo();
    // Re-clone the editor's option labels in the new language, then re-sync.
    populateOwnEditorOptions();
    syncOwnEditor();
    // Re-localize the preset persons' accessible names.
    document.querySelectorAll("#own-presets .own-preset").forEach((b, i) =>
      b.setAttribute("aria-label", t("own.preset_alt", { n: i + 1 })));
    // Re-localize any measurement range-error text currently shown (idempotent
    // for valid/empty fields) so a mid-error language switch stays correct.
    if (window.Measurements && Array.isArray(Measurements.FIELDS)) {
      Measurements.FIELDS.forEach((f) => {
        const input = document.getElementById(f);
        if (input) validateMeasurementField(input);
      });
    }
    // Refresh the library grid if its modal is currently open.
    const libModal = document.getElementById("library-modal");
    if (libModal && !libModal.hidden) renderLibraryGrid();
  }

  function init() {
    initLangToggle();
    window.addEventListener("language:change", onLanguageChange);
    initSuggestions();
    initTypeSelector();
    initGenerateButton();
    initDesignJourney();
    initMeasurements();
    initExportButtons();
    initVtoButton();
    initOwnershipChooser();
    initOwnEditor();
    initLibrary();
    trackScrollSteps();

    if (window.StateManager) {
      window.StateManager.subscribe("currentDesign:change", updateVtoButtonState);
      window.StateManager.subscribe("userPhoto:change", updateVtoButtonState);
      // Keep the Ownership-moment design-info panel live as the design evolves.
      ["currentDesign", "currentType", "currentMaterial", "currentColor",
        "currentFit", "currentLength", "measurements"].forEach((key) =>
        window.StateManager.subscribe(`${key}:change`, () => { updateOwnInfo(); syncOwnEditor(); }));
    }
    updateVtoButtonState();
    updateOwnInfo();

    window.addEventListener("ai-fallback", (e) => {
      showToast(t("toast.ai_fallback", { reason: e.detail.reason }), "info");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
