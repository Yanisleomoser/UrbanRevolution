/**
 * Urban Revolution — Production Export
 * Erstellt produktionsfertige Vorlagen für Schneider und Fertigung.
 */

const Export = (() => {
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
        fit: design.fit < 0.33 ? "Slim" : design.fit > 0.66 ? "Oversized" : "Regular",
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
          `<tr><td>${Measurements.LABELS[k] || k}</td><td>${v} cm</td></tr>`
      )
      .join("");

    const notesHTML = spec.production.constructionNotes
      .map((n) => `<li>${n}</li>`)
      .join("");

    const tagsHTML = spec.design.tags
      .map((t) => `<span class="tag">${t}</span>`)
      .join(" ");

    return `<!DOCTYPE html>
<html lang="de">
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
    .description { background: #fafafa; padding: 16px; border-left: 3px solid #ec4899; font-style: italic; color: #444; margin-bottom: 24px; font-size: 14px; }
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
            ${new Date(spec.metadata.generatedAt).toLocaleDateString("de-DE")}
        </div>
    </div>

    <div class="description">"${spec.design.description}"</div>

    <h2>Original Prompt</h2>
    <p style="font-size: 14px; color: #444; font-style: italic;">"${spec.design.originalPrompt}"</p>

    <h2>Tags</h2>
    <p>${tagsHTML || '<span class="tag">custom</span>'}</p>

    <h2>Spezifikationen</h2>
    <table>
        <tr><td>Kleidungstyp</td><td>${spec.specifications.garmentType}</td></tr>
        <tr><td>Material</td><td>${spec.specifications.material}</td></tr>
        <tr><td>Primärfarbe</td><td><span class="color-chip" style="background:${spec.specifications.color}"></span>${spec.specifications.color}</td></tr>
        <tr><td>Passform</td><td>${spec.specifications.fit}</td></tr>
        <tr><td>Konfektionsgröße</td><td>${spec.specifications.size}</td></tr>
    </table>

    <h2>Körpermaße</h2>
    <table>${measurementsHTML}</table>

    <h2>Produktionsdaten</h2>
    <table>
        <tr><td>Geschätzte Stoffmenge</td><td>${spec.production.estimatedFabric}</td></tr>
        <tr><td>Geschätzte Nahtlänge</td><td>${spec.production.estimatedSeamLength}</td></tr>
        <tr><td>Produktionsdauer</td><td>${spec.production.estimatedProductionDays} Tage</td></tr>
        <tr><td>Preisspanne</td><td>${spec.production.estimatedPriceRange.currency} ${spec.production.estimatedPriceRange.min} – ${spec.production.estimatedPriceRange.max}</td></tr>
    </table>

    <h2>Schnitt-Notizen für den Schneider</h2>
    <ul>${notesHTML}</ul>

    <div class="footer">
        Generiert von Urban Revolution AI Atelier · ${new Date().toLocaleString("de-DE")}
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
          ).toLocaleDateString("de-DE"),
          confirmation: `Auftrag ${orderId} wurde an die Produktion gesendet`,
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
