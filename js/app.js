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
    toast.textContent = message;
    toast.className = `toast show ${type}`;
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
      { id: "measure", step: 2 },
      { id: "preview", step: 3 },
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

  function initColorPalette() {
    document.querySelectorAll("button.color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => applyColor(swatch.dataset.color));
    });
    const customInput = document.getElementById("custom-color");
    if (customInput) {
      customInput.addEventListener("input", () => applyColor(customInput.value));
    }
  }

  function initPatternSelector() {
    const select = document.getElementById("pattern-select");
    if (!select) return;
    select.addEventListener("change", () => {
      const design = S.get("currentDesign");
      if (!design) return;
      // Pattern lives on the design object (no dedicated state key); the spec
      // sheet and design card read it, so refresh both.
      design.pattern = select.value;
      renderDesignResult(design);
      updateProductionPreview();
    });
  }

  function initMaterialSelector() {
    const select = document.getElementById("material-select");
    if (!select) return;
    select.addEventListener("change", () => {
      if (!S.set("currentMaterial", select.value)) return;
      const design = S.get("currentDesign");
      if (design) {
        design.material = select.value;
        updateProductionPreview();
      }
    });
  }

  function initFitSlider() {
    const slider = document.getElementById("fit-slider");
    if (!slider) return;
    slider.addEventListener("input", () => {
      const fit = slider.value / 100;
      if (!S.set("currentFit", fit)) return;
      const design = S.get("currentDesign");
      if (design) {
        design.fit = fit;
        updateProductionPreview();
      }
    });
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

      const output = document.getElementById("ai-output");
      btn.classList.add("loading");
      btn.disabled = true;
      btn.querySelector(".btn-text").textContent = t("design.generate_loading");
      if (output) output.setAttribute("aria-busy", "true");

      try {
        const design = await AI.generateDesign(prompt, S.get("currentType"));
        S.set("currentDesign", design);
        renderDesignResult(design);
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
        if (output) output.setAttribute("aria-busy", "false");
      }
    });
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

  // Localized fabric-pattern label (e.g. "Querstreifen" / "Horizontal stripes").
  function patternLabelText(key) {
    return window.I18N ? window.I18N.pattern(key) : key;
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

  function escapeHtml(str) {
    return String(str).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
    );
  }

  function renderDesignResult(design) {
    const output = document.getElementById("ai-output");

    const type = design.type || S.get("currentType");
    const color = design.color || S.get("currentColor");
    const material = design.material || S.get("currentMaterial");
    const fit = design.fit !== undefined ? design.fit : S.get("currentFit");

    const typeLabelText = typeLabel(type);
    const materialLabel = typeMaterialLabel(material);
    const fitText = fitLabel(fit);
    const patternKey = design.pattern && design.pattern !== "solid" ? design.pattern : null;
    const patternLabel = patternKey ? patternLabelText(patternKey) : null;

    const tagsHtml = (design.tags && design.tags.length
      ? design.tags
      : ["custom"]
    )
      .slice(0, 6)
      .map((t) => `<span class="design-tag">${escapeHtml(t)}</span>`)
      .join("");

    const notes = (design.constructionNotes || []).slice(0, 3);
    const notesHtml = notes.length
      ? `<details class="design-card-notes"><summary>${escapeHtml(t("card.tailor_notes", { n: notes.length }))}</summary><ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul></details>`
      : "";

    const promptHtml = design.originalPrompt
      ? `<blockquote class="design-card-prompt"><span class="design-card-prompt-label">${escapeHtml(t("card.your_wish"))}</span><p>“${escapeHtml(design.originalPrompt)}”</p></blockquote>`
      : "";

    const inLibrary = window.Library && window.Library.get(design.designId);

    output.innerHTML = `
      <article class="design-card">
        <header class="design-card-head">
          <div class="design-card-icon" style="color:${escapeHtml(color)}">${typeIconSvg(type, 56)}</div>
          <div class="design-card-titles">
            <span class="design-card-eyebrow">${escapeHtml(t("card.eyebrow", { id: design.designId || "––––––" }))}</span>
            <h3>${escapeHtml(design.name || "Untitled")}</h3>
            <p class="design-card-subtitle">${escapeHtml(typeLabelText)} · ${escapeHtml(materialLabel)} · ${escapeHtml(fitText)} ${escapeHtml(t("card.fit_suffix"))}</p>
          </div>
          <button id="design-save-btn" class="design-save-btn ${inLibrary ? "is-saved" : ""}" type="button" aria-label="${escapeHtml(t("card.save_aria"))}">
            <span class="design-save-icon" aria-hidden="true">${inLibrary ? "✓" : "+"}</span>
            <span class="design-save-text">${inLibrary ? escapeHtml(t("card.saved")) : escapeHtml(t("card.save"))}</span>
          </button>
        </header>

        ${promptHtml}

        <div class="design-card-specs">
          <div class="spec-pill spec-pill-color">
            <span class="spec-swatch" style="background:${escapeHtml(color)}"></span>
            <span>${escapeHtml(color)}</span>
          </div>
          <div class="spec-pill">${escapeHtml(materialLabel)}</div>
          <div class="spec-pill">${escapeHtml(fitText)} ${escapeHtml(t("card.fit_suffix"))}</div>
          ${patternLabel ? `<div class="spec-pill">${escapeHtml(patternLabel)}</div>` : ""}
        </div>

        ${tagsHtml ? `<div class="design-tags">${tagsHtml}</div>` : ""}

        ${notesHtml}
      </article>
    `;

    const saveBtn = document.getElementById("design-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => saveCurrentDesign());
    }

    document.getElementById("customize-controls").style.display = "block";

    syncColorPalette(color);

    const matSelect = document.getElementById("material-select");
    if (matSelect && design.material) matSelect.value = design.material;

    const patSelect = document.getElementById("pattern-select");
    if (patSelect) patSelect.value = design.pattern || "solid";

    const fitSlider = document.getElementById("fit-slider");
    if (fitSlider && design.fit !== undefined) {
      fitSlider.value = Math.round(design.fit * 100);
    }
  }

  function applyDesignToState(design) {
    // Push design fields through StateManager so the 3D module's
    // subscriptions fire. Validation failures (e.g. Claude returned a
    // non-palette color) are caught in S.set and don't break the flow.
    if (design.color) S.set("currentColor", design.color);
    if (design.material) S.set("currentMaterial", design.material);
    if (design.fit !== undefined) S.set("currentFit", design.fit);
    if (design.type && design.type !== S.get("currentType")) {
      if (S.set("currentType", design.type)) setActiveType(design.type);
    }
  }

  // Flag an out-of-range measurement so the user sees/hears it, instead of
  // it being silently swapped for a preset value in the spec sheet downstream.
  function validateMeasurementField(input) {
    if (!window.CONFIG || input.value === "") {
      input.removeAttribute("aria-invalid");
      return true;
    }
    let valid = true;
    try {
      window.CONFIG.validateMeasurement(input.id, parseInt(input.value, 10));
    } catch (_e) {
      valid = false;
    }
    input.setAttribute("aria-invalid", valid ? "false" : "true");
    return valid;
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
      btn.classList.toggle("is-active", btn.dataset.preset === match);
    });
  }

  function updateSizeReadout(measurements) {
    const el = document.getElementById("measure-size");
    if (el) el.textContent = Measurements.calculateSize(measurements);
  }

  function initPoseUpload() {
    const fileInput = document.getElementById("pose-photo");
    const uploadBtn = document.getElementById("pose-upload-btn");
    const statusEl = document.getElementById("pose-status");
    const previewWrap = document.getElementById("pose-preview");
    const canvas = document.getElementById("pose-canvas");

    if (!fileInput || !uploadBtn || !canvas) return;

    uploadBtn.addEventListener("click", () => fileInput.click());

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
        processPhotoFile(file);
      });
    }

    async function processPhotoFile(file) {
      uploadBtn.disabled = true;
      uploadBtn.textContent = t("measure.photo_btn_loading");
      statusEl.textContent = "";

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
        uploadBtn.textContent = t("measure.photo_btn_analyzing");
        statusEl.textContent = t("measure.status_detecting");

        const { result, img } = await window.Pose.detect(file);

        if (!result.landmarks || !result.landmarks[0]) {
          showToast(t("toast.no_person"), "error");
          statusEl.textContent = t("measure.status_no_pose");
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
          statusEl.textContent = t("measure.status_no_feet");
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
        statusEl.textContent = t("measure.status_result", {
          chest: measurements.chest,
          waist: measurements.waist,
          hips: measurements.hips,
        });
        showToast(
          personalized ? t("toast.photo_skin") : t("toast.photo_only"),
          "success"
        );
      } catch (err) {
        console.error("[pose] failed:", err);
        showToast(t("toast.photo_failed", { msg: err.message || err }), "error");
        statusEl.textContent = t("measure.status_error");
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = t("measure.photo_btn_another");
      }
    }
  }

  function updateMeasurements() {
    const measurements = Measurements.read();
    S.set("measurements", measurements);
    updatePresetActive(measurements);
    updateSizeReadout(measurements);
    updateModelInfo();
    updateProductionPreview();
  }

  function updateModelInfo() {
    const measurements = S.get("measurements");
    if (!measurements) return;
    const type = S.get("currentType");
    const fabric = Measurements.estimateFabric(measurements, type);
    const seams = Measurements.estimateSeams(measurements, type);
    const size = Measurements.calculateSize(measurements);

    const fabricEl = document.getElementById("info-fabric");
    const seamsEl = document.getElementById("info-seams");
    const sizeEl = document.getElementById("info-size");

    if (fabricEl) fabricEl.textContent = `~ ${fabric} m²`;
    if (seamsEl) seamsEl.textContent = `${seams} cm`;
    if (sizeEl) sizeEl.textContent = size;
  }

  function updateProductionPreview() {
    const measurements = S.get("measurements");
    if (!measurements) return;

    const currentColor = S.get("currentColor");
    const currentMaterial = S.get("currentMaterial");
    const currentFit = S.get("currentFit");
    const currentType = S.get("currentType");

    const design = S.get("currentDesign") || {
      name: t("prod.placeholder_name"),
      description: t("prod.placeholder_desc"),
      designId: "UR-XXXXXX",
      originalPrompt: "–",
      color: currentColor,
      material: currentMaterial,
      fit: currentFit,
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

    const colorCell = document.getElementById("spec-color");
    colorCell.innerHTML =
      `<span style="display:inline-block;width:14px;height:14px;background:${currentColor};border:1px solid #ccc;border-radius:3px;vertical-align:middle;margin-right:6px;"></span>${currentColor}`;

    document.getElementById("spec-fit").textContent =
      specData.specifications.fit;
    document.getElementById("spec-size").textContent =
      specData.specifications.size;

    const measuresTable = document.getElementById("spec-measures");
    measuresTable.innerHTML = Object.entries(measurements)
      .map(
        ([k, v]) =>
          `<tr><td>${escapeHtml(measureLabel(k))}</td><td>${v} cm</td></tr>`
      )
      .join("");

    const notesList = document.getElementById("spec-notes");
    notesList.innerHTML = (design.constructionNotes || [])
      .map((n) => `<li>${escapeHtml(n)}</li>`)
      .join("");

    document.getElementById("est-time").textContent =
      t("est.days", { n: specData.production.estimatedProductionDays });
    document.getElementById("est-price").textContent =
      `${specData.production.estimatedPriceRange.currency} ${specData.production.estimatedPriceRange.min} – ${specData.production.estimatedPriceRange.max}`;
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
      Export.downloadHTML(spec);
      showToast(t("toast.html_done"), "success");
    });

    document.getElementById("print-spec").addEventListener("click", () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      Export.print();
    });

    document.getElementById("send-order").addEventListener("click", async () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      showToast(t("toast.order_sending"), "info");
      const result = await Export.simulateOrderSubmission(spec);
      if (result.success) {
        showToast(
          t("toast.order_done", {
            confirmation: result.confirmation,
            date: result.estimatedDelivery,
          }),
          "success"
        );
      }
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
          setVtoError(t("vto.error_prefix", { msg: body.error || res.statusText }));
          return;
        }

        if (body.pending) {
          setVtoError(t("vto.error_pending"));
          return;
        }

        if (body.imageUrl) {
          // Only charge against the limit on a real, billable success.
          // Errors and timeouts don't cost money on Replicate and
          // shouldn't punish the user's quota.
          showVtoResult(body.imageUrl);
          incrementVtoCount();
          updateVtoButtonState();
        } else {
          setVtoError(t("vto.error_unexpected"));
        }
      } catch (err) {
        setVtoError(t("vto.error_network", { msg: err.message }));
      }
    });

    document.getElementById("vto-download")?.addEventListener("click", downloadVtoImage);
  }

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
    return parts.filter(Boolean).join(". ");
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
  }

  function setVtoStatus(text) {
    const status = document.getElementById("vto-status");
    if (status) status.textContent = text;
  }

  function setVtoError(text) {
    setVtoStatus(text);
    // Stop the spinner so the user sees the error as a final state, not
    // a still-loading impression. Loading container stays visible so the
    // error text is positioned where the user already looked.
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

  function saveCurrentDesign() {
    if (!window.Library) return;
    const design = S.get("currentDesign");
    if (!design) {
      showToast(t("toast.need_design"), "error");
      return;
    }
    const entry = window.Library.add(design, {
      type: S.get("currentType"),
      color: S.get("currentColor"),
      material: S.get("currentMaterial"),
      fit: S.get("currentFit"),
      vtoImageUrl: vtoLastImageUrl,
    });
    if (!entry) {
      showToast(t("toast.save_failed"), "error");
      return;
    }
    // Update save button to "saved" state
    const btn = document.getElementById("design-save-btn");
    if (btn) {
      btn.classList.add("is-saved");
      btn.querySelector(".design-save-icon").textContent = "✓";
      btn.querySelector(".design-save-text").textContent = t("card.saved");
    }
    showToast(t("toast.saved_lib", { name: entry.name }), "success");
    updateLibraryCount();
  }

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
      const visual = d.vtoImageUrl
        ? `<img class="library-tile-photo" src="${escapeHtml(d.vtoImageUrl)}" alt="" loading="lazy">`
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
      originalPrompt: entry.originalPrompt || "",
      constructionNotes: entry.constructionNotes || [],
      description: t("lib.loaded_desc"),
      generatedAt: entry.savedAt,
    };
    S.set("currentDesign", design);
    document.getElementById("ai-prompt").value = entry.originalPrompt || "";
    setActiveType(entry.type);
    renderDesignResult(design);
    applyDesignToState(design);
    updateProductionPreview();
    closeLibraryModal();
    showToast(t("toast.loaded", { name: entry.name }), "success");
    document.getElementById("ai-output")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function deleteDesignFromLibrary(id) {
    if (!window.Library) return;
    const entry = window.Library.get(id);
    window.Library.remove(id);
    renderLibraryGrid();
    updateLibraryCount();
    if (entry) showToast(t("toast.deleted", { name: entry.name }), "info");
    // If current design was the deleted one, refresh save button state
    const current = S.get("currentDesign");
    if (current && current.designId === id) {
      const btn = document.getElementById("design-save-btn");
      if (btn) {
        btn.classList.remove("is-saved");
        btn.querySelector(".design-save-icon").textContent = "+";
        btn.querySelector(".design-save-text").textContent = t("card.save");
      }
    }
  }

  function openLibraryModal() {
    const modal = document.getElementById("library-modal");
    if (!modal) return;
    renderLibraryGrid();
    modal.hidden = false;
    libraryFocusReturnEl = document.activeElement;
    document.getElementById("library-modal-close")?.focus();
    libraryEscHandler = (e) => {
      if (e.key === "Escape") closeLibraryModal();
    };
    document.addEventListener("keydown", libraryEscHandler);
  }

  function closeLibraryModal() {
    const modal = document.getElementById("library-modal");
    if (modal) modal.hidden = true;
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

  function initMobileNav() {
    const toggle = document.getElementById("nav-toggle");
    const links = document.getElementById("nav-links");
    if (!toggle || !links) return;

    const setOpen = (open) => {
      links.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? t("nav.toggle_close") : t("nav.toggle_open"));
    };

    toggle.addEventListener("click", () => {
      setOpen(!links.classList.contains("open"));
    });

    // Close after tapping a link (anchor navigation) or pressing Escape.
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => setOpen(false))
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && links.classList.contains("open")) {
        setOpen(false);
        toggle.focus();
      }
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
    updateModelInfo();
    updateProductionPreview();
    updateVtoButtonState();
    // Re-render the design card with the new language if one is showing.
    const design = S.get("currentDesign");
    if (design && document.querySelector(".design-card")) {
      renderDesignResult(design);
    }
    // Refresh the library grid if its modal is currently open.
    const libModal = document.getElementById("library-modal");
    if (libModal && !libModal.hidden) renderLibraryGrid();
    // Keep the hamburger aria-label in sync with its open state.
    const navToggle = document.getElementById("nav-toggle");
    const navLinks = document.getElementById("nav-links");
    if (navToggle && navLinks) {
      navToggle.setAttribute(
        "aria-label",
        navLinks.classList.contains("open") ? t("nav.toggle_close") : t("nav.toggle_open"),
      );
    }
  }

  function init() {
    initLangToggle();
    window.addEventListener("language:change", onLanguageChange);
    initMobileNav();
    initSuggestions();
    initTypeSelector();
    initColorPalette();
    initMaterialSelector();
    initPatternSelector();
    initFitSlider();
    initGenerateButton();
    initMeasurements();
    initExportButtons();
    initVtoButton();
    initLibrary();
    trackScrollSteps();

    if (window.StateManager) {
      window.StateManager.subscribe("currentDesign:change", updateVtoButtonState);
      window.StateManager.subscribe("userPhoto:change", updateVtoButtonState);
    }
    updateVtoButtonState();

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
