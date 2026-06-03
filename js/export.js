/**
 * Urban Revolution — Production Export
 * Erstellt produktionsfertige Vorlagen für Schneider und Fertigung.
 */

const Export = (() => {
  const t = (key, vars) => (window.I18N ? window.I18N.t(key, vars) : key);
  const loc = () => (window.I18N ? window.I18N.locale() : "de-DE");
  const matLabel = (key) => (window.I18N ? window.I18N.material(key) : key);
  const typeLabel = (key) => (window.I18N ? window.I18N.typeLabel(key) : key);
  const mLabel = (key) =>
    window.I18N
      ? window.I18N.measureLabel(key)
      : (window.Measurements && window.Measurements.LABELS[key]) || key;

  function fitLabel(fit) {
    if (fit < 0.33) return t("fit.slim");
    if (fit > 0.66) return t("fit.oversized");
    return t("fit.regular");
  }

  function buildSpecData(design, measurements, garmentType) {
    const size = Measurements.calculateSize(measurements);
    const fabric = Measurements.estimateFabric(measurements, garmentType);
    const seams = Measurements.estimateSeams(measurements, garmentType);

    return {
      metadata: {
        brand: "Urban Revolution",
        designId: design.designId,
        generatedAt: design.generatedAt,
        version: "1.0.0",
      },
      design: {
        name: design.name,
        description: design.description,
        originalPrompt: design.originalPrompt,
        tags: design.tags,
      },
      specifications: {
        garmentType,
        color: design.color,
        material: design.material,
        fit: fitLabel(design.fit),
        size,
      },
      measurements: {
        ...measurements,
        unit: "cm",
      },
      production: {
        estimatedFabric: `${fabric} m²`,
        estimatedSeamLength: `${seams} cm`,
        constructionNotes: design.constructionNotes,
        estimatedProductionDays: 14,
        estimatedPriceRange: { min: 145, max: 220, currency: "CHF" },
      },
    };
  }

  function downloadJSON(specData) {
    const blob = new Blob([JSON.stringify(specData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${specData.metadata.designId}_spec.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadHTML(specData) {
    const html = renderPrintableHTML(specData);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${specData.metadata.designId}_spec.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderPrintableHTML(spec) {
    const measurementsHTML = Object.entries(spec.measurements)
      .filter(([k]) => k !== "unit")
      .map(
        ([k, v]) =>
          `<tr><td>${mLabel(k)}</td><td>${v} cm</td></tr>`
      )
      .join("");

    const notesHTML = spec.production.constructionNotes
      .map((n) => `<li>${n}</li>`)
      .join("");

    const tagsHTML = spec.design.tags
      .map((t) => `<span class="tag">${t}</span>`)
      .join(" ");

    return `<!DOCTYPE html>
<html lang="${loc().slice(0, 2)}">
<head>
<meta charset="UTF-8">
<title>${spec.metadata.designId} — ${spec.design.name}</title>
<style>
    @page { size: A4; margin: 1.5cm; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #111; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
    h1 { font-family: Georgia, serif; font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin: 32px 0 12px; font-weight: 700; }
    .header { border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .id { font-family: monospace; color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    td:first-child { color: #666; width: 50%; }
    td:last-child { font-weight: 600; text-align: right; }
    .color-chip { display: inline-block; width: 16px; height: 16px; vertical-align: middle; border: 1px solid #ccc; margin-right: 6px; border-radius: 3px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; font-size: 14px; }
    .tag { background: #f4f4f5; padding: 3px 10px; border-radius: 100px; font-size: 11px; margin-right: 4px; display: inline-block; }
    .description { background: #fafafa; padding: 16px; border-left: 3px solid #1f3bff; font-style: italic; color: #444; margin-bottom: 24px; font-size: 14px; }
    .footer { margin-top: 60px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
</style>
</head>
<body>
    <div class="header">
        <div>
            <h1>${spec.design.name}</h1>
            <p>Urban Revolution · Production Spec Sheet</p>
        </div>
        <div class="id">
            ${spec.metadata.designId}<br>
            ${new Date(spec.metadata.generatedAt).toLocaleDateString(loc())}
        </div>
    </div>

    <div class="description">"${spec.design.description}"</div>

    <h2>${t("export.original_prompt")}</h2>
    <p style="font-size: 14px; color: #444; font-style: italic;">"${spec.design.originalPrompt}"</p>

    <h2>${t("export.tags")}</h2>
    <p>${tagsHTML || '<span class="tag">custom</span>'}</p>

    <h2>${t("spec.specs_h4")}</h2>
    <table>
        <tr><td>${t("spec.type")}</td><td>${typeLabel(spec.specifications.garmentType)}</td></tr>
        <tr><td>${t("spec.material")}</td><td>${matLabel(spec.specifications.material)}</td></tr>
        <tr><td>${t("spec.color")}</td><td><span class="color-chip" style="background:${spec.specifications.color}"></span>${spec.specifications.color}</td></tr>
        <tr><td>${t("spec.fit")}</td><td>${spec.specifications.fit}</td></tr>
        <tr><td>${t("spec.size")}</td><td>${spec.specifications.size}</td></tr>
    </table>

    <h2>${t("export.body_measures")}</h2>
    <table>${measurementsHTML}</table>

    <h2>${t("export.production_data")}</h2>
    <table>
        <tr><td>${t("export.est_fabric")}</td><td>${spec.production.estimatedFabric}</td></tr>
        <tr><td>${t("export.est_seams")}</td><td>${spec.production.estimatedSeamLength}</td></tr>
        <tr><td>${t("export.duration")}</td><td>${t("est.days", { n: spec.production.estimatedProductionDays })}</td></tr>
        <tr><td>${t("export.price_range")}</td><td>${spec.production.estimatedPriceRange.currency} ${spec.production.estimatedPriceRange.min} – ${spec.production.estimatedPriceRange.max}</td></tr>
    </table>

    <h2>${t("spec.notes_h4")}</h2>
    <ul>${notesHTML}</ul>

    <div class="footer">
        ${t("export.footer")} · ${new Date().toLocaleString(loc())}
    </div>
</body>
</html>`;
  }

  function print() {
    window.print();
  }

  function simulateOrderSubmission(_specData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const orderId = "ORD-" + Date.now().toString(36).toUpperCase();
        resolve({
          success: true,
          orderId,
          estimatedDelivery: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          ).toLocaleDateString(loc()),
          confirmation: t("export.order_confirmation", { id: orderId }),
        });
      }, 1200);
    });
  }

  return {
    buildSpecData,
    downloadJSON,
    downloadHTML,
    print,
    simulateOrderSubmission,
    renderPrintableHTML,
  };
})();

window.Export = Export;
