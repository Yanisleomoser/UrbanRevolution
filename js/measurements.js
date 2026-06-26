/**
 * Urban Revolution — Measurements (REFACTORED)
 * Verwaltet die Körpermaße des Kunden mit Input-Validierung
 */

const Measurements = (() => {
  const PRESETS = CONFIG.MEASUREMENT_PRESETS;
  const FIELDS = Object.keys(CONFIG.MEASUREMENT_CONSTRAINTS);
  const LABELS = {};

  // Build LABELS from CONFIG
  Object.entries(CONFIG.MEASUREMENT_CONSTRAINTS).forEach(([key, { label }]) => {
    LABELS[key] = label;
  });

  function read() {
    const result = {};
    FIELDS.forEach((field) => {
      const input = document.getElementById(field);
      if (!input) {
        result[field] = PRESETS.M[field];
        return;
      }

      try {
        const value = parseInt(input.value, 10);
        result[field] = CONFIG.validateMeasurement(field, value);
      } catch (err) {
        console.warn(`[Measurements] Invalid ${field}:`, err.message);
        result[field] = PRESETS.M[field];
      }
    });
    return result;
  }

  function write(data) {
    FIELDS.forEach((field) => {
      const input = document.getElementById(field);
      if (input && data[field] !== undefined) {
        try {
          const validated = CONFIG.validateMeasurement(field, data[field]);
          input.value = validated;
        } catch (err) {
          console.error(`[Measurements] Cannot write ${field}:`, err.message);
        }
      }
    });
  }

  function applyPreset(presetName) {
    if (!PRESETS[presetName]) {
      throw new Error(`Unknown preset: ${presetName}`);
    }
    write(PRESETS[presetName]);
    return PRESETS[presetName];
  }

  /**
   * Berechnet die Konfektionsgröße aus den gemessenen Daten
   */
  function calculateSize(measurements) {
    const c = measurements && Number(measurements.chest);
    // Guard partial/empty data: without this, a missing chest fell through every
    // bucket (undefined < n is false) and returned "XXL" — a wrong size. Default
    // to "M" (the same fallback Measurements.read() uses for missing inputs).
    if (!Number.isFinite(c)) return "M";
    if (c < 90) return "XS";
    if (c < 96) return "S";
    if (c < 102) return "M";
    if (c < 110) return "L";
    if (c < 118) return "XL";
    return "XXL";
  }

  /**
   * Schätzt benötigte Stoffmenge in m² basierend auf Maßen und Kleidungstyp
   */
  function estimateFabric(measurements, garmentType, lengthFactor = 1) {
    try {
      CONFIG.validateGarmentType(garmentType);
    } catch (err) {
      console.warn("[Measurements] Invalid garment type:", err.message);
      garmentType = "tshirt";
    }

    const m = measurements || {};
    const chest = Number(m.chest);
    const height = Number(m.height);
    const factors = CONFIG.PRODUCTION_ESTIMATES.fabric;
    const baseArea = (Number.isFinite(chest) && Number.isFinite(height))
      ? (chest * height) / 10000 : 0;
    const factor = factors[garmentType] || 1.5;
    // Accept the length factor here and round ONCE — callers previously rounded
    // estimateFabric to 2dp and then multiplied + rounded again (off by 0.01 in
    // some length combos). Single-round from the raw area is correct.
    const lf = Number.isFinite(lengthFactor) ? lengthFactor : 1;
    return (baseArea * factor * lf).toFixed(2);
  }

  /**
   * Berechnet die geschätzte Nahtlänge
   */
  function estimateSeams(measurements, garmentType) {
    try {
      CONFIG.validateGarmentType(garmentType);
    } catch (err) {
      console.warn("[Measurements] Invalid garment type:", err.message);
      garmentType = "tshirt";
    }

    const m = measurements;
    const seamFormulas = CONFIG.PRODUCTION_ESTIMATES.seams;
    const formula = seamFormulas[garmentType];

    if (typeof formula === "function") {
      return formula(m);
    }
    return 200; // fallback
  }

  return {
    PRESETS,
    FIELDS,
    LABELS,
    read,
    write,
    applyPreset,
    calculateSize,
    estimateFabric,
    estimateSeams,
  };
})();

if (typeof window !== "undefined") window.Measurements = Measurements;
if (typeof module !== "undefined" && module.exports) module.exports = Measurements;
