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

  const TYPE_LABELS = {
    tshirt: "T-Shirt",
    hoodie: "Hoodie",
    shirt: "Hemd",
    pants: "Hose",
    jacket: "Jacke",
    dress: "Kleid",
  };

  function typeIconSvg(type, size = 56) {
    const d = TYPE_ICON_PATHS[type] || TYPE_ICON_PATHS.tshirt;
    return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  }

  function fitLabel(fit) {
    if (fit === undefined || fit === null) return "Regular";
    if (fit < 0.33) return "Slim";
    if (fit > 0.66) return "Oversized";
    return "Regular";
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

    const typeLabelText = TYPE_LABELS[type] || type;
    const materialLabel = (window.CONFIG && window.CONFIG.MATERIALS && window.CONFIG.MATERIALS[material]) || material;
    const fitText = fitLabel(fit);
    const patternKey = design.pattern && design.pattern !== "solid" ? design.pattern : null;
    const patternLabel = patternKey && window.CONFIG && window.CONFIG.PATTERNS
      ? (window.CONFIG.PATTERNS[patternKey] || patternKey)
      : patternKey;

    const tagsHtml = (design.tags && design.tags.length
      ? design.tags
      : ["custom"]
    )
      .slice(0, 6)
      .map((t) => `<span class="design-tag">${escapeHtml(t)}</span>`)
      .join("");

    const notes = (design.constructionNotes || []).slice(0, 3);
    const notesHtml = notes.length
      ? `<details class="design-card-notes"><summary>Schneider-Notizen (${notes.length})</summary><ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul></details>`
      : "";

    const promptHtml = design.originalPrompt
      ? `<blockquote class="design-card-prompt"><span class="design-card-prompt-label">Dein Wunsch</span><p>“${escapeHtml(design.originalPrompt)}”</p></blockquote>`
      : "";

    output.innerHTML = `
      <article class="design-card">
        <header class="design-card-head">
          <div class="design-card-icon" style="color:${escapeHtml(color)}">${typeIconSvg(type, 56)}</div>
          <div class="design-card-titles">
            <span class="design-card-eyebrow">KI-DESIGN · ${escapeHtml(design.designId || "––––––")}</span>
            <h3>${escapeHtml(design.name || "Untitled")}</h3>
            <p class="design-card-subtitle">${escapeHtml(typeLabelText)} · ${escapeHtml(materialLabel)} · ${escapeHtml(fitText)} Fit</p>
          </div>
        </header>

        ${promptHtml}

        <div class="design-card-specs">
          <div class="spec-pill spec-pill-color">
            <span class="spec-swatch" style="background:${escapeHtml(color)}"></span>
            <span>${escapeHtml(color)}</span>
          </div>
          <div class="spec-pill">${escapeHtml(materialLabel)}</div>
          <div class="spec-pill">${escapeHtml(fitText)} Fit</div>
          ${patternLabel ? `<div class="spec-pill">${escapeHtml(patternLabel)}</div>` : ""}
        </div>

        ${tagsHtml ? `<div class="design-tags">${tagsHtml}</div>` : ""}

        ${notesHtml}
      </article>
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
  // caps the per-browser Replicate spend at VTO_LIMIT × ~$0.04.
  const VTO_LIMIT = 3;
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
      hint.textContent = "Lade zuerst ein Foto unter \"Maße\" hoch";
    } else if (!hasDesign) {
      btn.disabled = true;
      hint.textContent = "Generiere zuerst ein Design";
    } else if (remaining === 0) {
      btn.disabled = true;
      hint.textContent = `Demo-Limit erreicht (${VTO_LIMIT}/${VTO_LIMIT}) — kontaktiere uns für mehr`;
    } else {
      btn.disabled = false;
      hint.textContent = used === 0
        ? `Klick generiert deine fotorealistische Vorschau (${VTO_LIMIT} pro Browser)`
        : `Klick generiert deine fotorealistische Vorschau (${remaining} von ${VTO_LIMIT} übrig)`;
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

      openVtoModal();
      setVtoStatus("Sende Anfrage an Replicate...");

      const designPrompt = buildVtoPrompt(design);

      try {
        const res = await fetch("/api/try-on", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPhoto, designPrompt }),
        });
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          setVtoStatus(`Fehler: ${body.error || res.statusText}`);
          return;
        }

        if (body.pending) {
          setVtoStatus(
            "Generierung läuft länger als erwartet (>20 s) — Server-Limit erreicht. " +
            "Bitte erneut versuchen oder andere Uhrzeit probieren.",
          );
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
          setVtoStatus("Unerwartete Antwort vom Server.");
        }
      } catch (err) {
        setVtoStatus(`Netzwerkfehler: ${err.message}`);
      }
    });

    document.getElementById("vto-modal-close")?.addEventListener("click", closeVtoModal);
    document.querySelector(".vto-modal-backdrop")?.addEventListener("click", closeVtoModal);
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

  function openVtoModal() {
    const modal = document.getElementById("vto-modal");
    const loading = modal?.querySelector(".vto-loading");
    const img = document.getElementById("vto-result-img");
    if (!modal) return;
    modal.hidden = false;
    if (loading) loading.style.display = "flex";
    if (img) {
      img.hidden = true;
      img.removeAttribute("src");
    }
  }

  function closeVtoModal() {
    const modal = document.getElementById("vto-modal");
    if (modal) modal.hidden = true;
  }

  function setVtoStatus(text) {
    const status = document.getElementById("vto-status");
    if (status) status.textContent = text;
  }

  function showVtoResult(url) {
    const loading = document.querySelector(".vto-loading");
    const img = document.getElementById("vto-result-img");
    if (loading) loading.style.display = "none";
    if (img) {
      img.src = url;
      img.hidden = false;
    }
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
    initVtoButton();
    trackScrollSteps();

    if (window.StateManager) {
      window.StateManager.subscribe("currentDesign:change", updateVtoButtonState);
      window.StateManager.subscribe("userPhoto:change", updateVtoButtonState);
    }
    updateVtoButtonState();

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
