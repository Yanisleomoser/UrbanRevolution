/**
 * Urban Revolution — Spec View helpers
 * DOM-safe renderer for production spec fragments.
 */

const SpecView = (() => {
  function quoteText(text) {
    const lang = window.I18N && typeof window.I18N.locale === "function"
      ? String(window.I18N.locale()).toLowerCase()
      : "de";
    if (lang.startsWith("de")) return `„${text}“`;
    return `“${text}”`;
  }

  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function renderColor(cell, color) {
    if (!cell) return;
    clear(cell);
    const swatch = document.createElement("span");
    swatch.style.display = "inline-block";
    swatch.style.width = "14px";
    swatch.style.height = "14px";
    swatch.style.background = color;
    swatch.style.border = "1px solid #ccc";
    swatch.style.borderRadius = "3px";
    swatch.style.verticalAlign = "middle";
    swatch.style.marginRight = "6px";
    cell.appendChild(swatch);
    cell.appendChild(document.createTextNode(color));
  }

  function renderMeasures(table, measurements, measureLabel) {
    if (!table) return;
    clear(table);
    Object.entries(measurements || {}).forEach(([key, value]) => {
      const tr = document.createElement("tr");
      const thLabel = document.createElement("th");
      thLabel.scope = "row";
      const tdValue = document.createElement("td");
      thLabel.textContent = measureLabel(key);
      // Per-field unit from CONFIG (single source) — weight is kg, all body
      // lengths are cm. Without this, weight rendered as a wrong "70 cm".
      const cc = window.CONFIG && window.CONFIG.MEASUREMENT_CONSTRAINTS[key];
      tdValue.textContent = `${value} ${(cc && cc.unit) || "cm"}`;
      tr.appendChild(thLabel);
      tr.appendChild(tdValue);
      table.appendChild(tr);
    });
  }

  function renderNotes(list, notes) {
    if (!list) return;
    clear(list);
    // Array.isArray, not `notes || []`: a truthy non-array (e.g. a malformed
    // AI response returning a bare string instead of the requested array)
    // would still reach .forEach and throw, wedging the spec sheet since this
    // renders on every state change (see js/ai.js's CONFIG.validateStringArray
    // boundary guard, which is the primary fix — this is defense-in-depth).
    (Array.isArray(notes) ? notes : []).forEach((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      list.appendChild(li);
    });
  }

  function renderProductionDetails({
    color,
    print,
    measurements,
    constructionNotes,
    measureLabel,
  }) {
    renderColor(document.getElementById("spec-color"), color);
    const printEl = document.getElementById("spec-print");
    if (printEl) {
      const normalisedPrint = typeof print === "string" ? print.trim() : "";
      printEl.textContent = normalisedPrint ? quoteText(normalisedPrint) : "—";
    }
    renderMeasures(
      document.getElementById("spec-measures"),
      measurements,
      measureLabel,
    );
    renderNotes(document.getElementById("spec-notes"), constructionNotes);
  }

  return {
    renderProductionDetails,
  };
})();

if (typeof window !== "undefined") window.SpecView = SpecView;
if (typeof module !== "undefined" && module.exports) module.exports = SpecView;
