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

  function initSuggestions() {
    document.querySelectorAll(".suggestion").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("ai-prompt").value = btn.dataset.prompt;
        document.getElementById("ai-prompt").focus();
      });
    });
  }

  function initTypeSelector() {
    document.querySelectorAll(".type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".type-btn").forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");
        S.set("currentType", btn.dataset.type);
        updateProductionPreview();
      });
    });
  }

  function initColorPalette() {
    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        document.querySelectorAll(".color-swatch").forEach((s) =>
          s.classList.remove("active")
        );
        swatch.classList.add("active");
        const newColor = swatch.dataset.color;
        if (!S.set("currentColor", newColor)) return;
        const design = S.get("currentDesign");
        if (design) {
          design.color = newColor;
          updateProductionPreview();
        }
      });
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
        showToast("Bitte beschreibe dein gewünschtes Design", "error");
        document.getElementById("ai-prompt").focus();
        return;
      }

      btn.classList.add("loading");
      btn.disabled = true;
      btn.querySelector(".btn-text").textContent = "KI generiert...";

      try {
        const design = await AI.generateDesign(prompt, S.get("currentType"));
        S.set("currentDesign", design);
        renderDesignResult(design);
        applyDesignToState(design);
        updateProductionPreview();
        showToast(`Design "${design.name}" generiert!`, "success");
      } catch (error) {
        console.error(error);
        showToast(
          "Fehler bei der Generierung. Bitte erneut versuchen.",
          "error"
        );
      } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
        btn.querySelector(".btn-text").textContent = "Design generieren";
      }
    });
  }

  function renderDesignResult(design) {
    const output = document.getElementById("ai-output");
    const tags = design.tags && design.tags.length
      ? design.tags.map((t) => `<span class="design-tag">${t}</span>`).join("")
      : "<span class=\"design-tag\">custom</span>";

    output.innerHTML = `
            <div class="design-result">
                <h4>KI-DESIGN · ${design.designId}</h4>
                <h3>${design.name}</h3>
                <p>${design.description}</p>
                <div class="design-tags">${tags}</div>
            </div>
        `;

    document.getElementById("customize-controls").style.display = "block";

    document.querySelectorAll(".color-swatch").forEach((s) => {
      s.classList.toggle("active", s.dataset.color === design.color);
    });

    const matSelect = document.getElementById("material-select");
    if (matSelect && design.material) matSelect.value = design.material;

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
      if (S.set("currentType", design.type)) {
        document.querySelectorAll(".type-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.type === design.type);
        });
      }
    }
  }

  function initMeasurements() {
    Measurements.FIELDS.forEach((field) => {
      const input = document.getElementById(field);
      if (input) {
        input.addEventListener("input", updateMeasurements);
      }
    });

    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        Measurements.applyPreset(btn.dataset.preset);
        updateMeasurements();
        showToast(
          `Voreinstellung ${btn.dataset.preset} geladen`,
          "success"
        );
      });
    });

    initPoseUpload();
    updateMeasurements();
  }

  function initPoseUpload() {
    const fileInput = document.getElementById("pose-photo");
    const uploadBtn = document.getElementById("pose-upload-btn");
    const statusEl = document.getElementById("pose-status");
    const previewWrap = document.getElementById("pose-preview");
    const canvas = document.getElementById("pose-canvas");

    if (!fileInput || !uploadBtn || !canvas) return;

    uploadBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fileInput.value = "";

      uploadBtn.disabled = true;
      uploadBtn.textContent = "Lade Modell...";
      statusEl.textContent = "";

      try {
        await window.Pose.init();
        uploadBtn.textContent = "Analysiere...";
        statusEl.textContent = "Erkenne Pose...";

        const { result, img } = await window.Pose.detect(file);

        if (!result.landmarks || !result.landmarks[0]) {
          showToast(
            "Keine Person im Foto erkannt — bitte Ganzkörper-Aufnahme",
            "error"
          );
          statusEl.textContent = "Keine Pose erkannt.";
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
          showToast(
            "Foto braucht den ganzen Körper (inkl. Füße) für korrekte Maße",
            "error"
          );
          statusEl.textContent = "Füße nicht im Bild — neues Foto bitte";
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
        statusEl.textContent = `${measurements.chest}cm Brust · ${measurements.waist}cm Taille · ${measurements.hips}cm Hüfte`;
        showToast(
          personalized
            ? "Maße + Hautton aus Foto übernommen"
            : "Maße aus Foto übernommen — überprüfe & feinjustiere bei Bedarf",
          "success"
        );
      } catch (err) {
        console.error("[pose] failed:", err);
        showToast(
          "Foto-Analyse fehlgeschlagen: " + (err.message || err),
          "error"
        );
        statusEl.textContent = "Fehler — bitte erneut versuchen.";
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Anderes Foto auswählen";
      }
    });
  }

  function updateMeasurements() {
    S.set("measurements", Measurements.read());
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
      name: "Untitled Design",
      description:
        "Noch kein Design generiert. Beschreibe oben dein Wunsch-Outfit.",
      designId: "UR-XXXXXX",
      originalPrompt: "–",
      color: currentColor,
      material: currentMaterial,
      fit: currentFit,
      tags: [],
      constructionNotes: [
        "Generiere zuerst ein Design, um Schneider-Notizen zu erhalten.",
      ],
      generatedAt: new Date().toISOString(),
    };

    const specData = Export.buildSpecData(design, measurements, currentType);

    document.getElementById("spec-title").textContent =
      design.name.toUpperCase();
    document.getElementById("spec-id").textContent = `Design ID: ${design.designId}`;
    document.getElementById("spec-date").textContent =
      new Date().toLocaleDateString("de-DE");
    document.getElementById("spec-brief").textContent =
      `"${design.originalPrompt}" — ${design.description}`;
    document.getElementById("spec-type").textContent = currentType;
    document.getElementById("spec-material").textContent = currentMaterial;

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
          `<tr><td>${Measurements.LABELS[k] || k}</td><td>${v} cm</td></tr>`
      )
      .join("");

    const notesList = document.getElementById("spec-notes");
    notesList.innerHTML = (design.constructionNotes || [])
      .map((n) => `<li>${n}</li>`)
      .join("");

    document.getElementById("est-time").textContent =
      `${specData.production.estimatedProductionDays} Tage`;
    document.getElementById("est-price").textContent =
      `${specData.production.estimatedPriceRange.currency} ${specData.production.estimatedPriceRange.min} – ${specData.production.estimatedPriceRange.max}`;
  }

  function getCurrentSpecData() {
    if (!S.get("currentDesign")) {
      showToast("Bitte zuerst ein Design generieren", "error");
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
      showToast("JSON-Datei heruntergeladen", "success");
    });

    document.getElementById("download-html").addEventListener("click", () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      Export.downloadHTML(spec);
      showToast("Druckbare Vorlage heruntergeladen", "success");
    });

    document.getElementById("print-spec").addEventListener("click", () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      Export.print();
    });

    document.getElementById("send-order").addEventListener("click", async () => {
      const spec = getCurrentSpecData();
      if (!spec) return;
      showToast("Auftrag wird übermittelt...", "info");
      const result = await Export.simulateOrderSubmission(spec);
      if (result.success) {
        showToast(
          `✓ ${result.confirmation}. Lieferung ca. ${result.estimatedDelivery}`,
          "success"
        );
      }
    });
  }

  function init() {
    initSuggestions();
    initTypeSelector();
    initColorPalette();
    initMaterialSelector();
    initFitSlider();
    initGenerateButton();
    initMeasurements();
    initExportButtons();
    trackScrollSteps();

    window.addEventListener("ai-fallback", (e) => {
      showToast(
        `Claude-API nicht erreichbar (${e.detail.reason}) — lokaler Generator wird verwendet`,
        "info"
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
