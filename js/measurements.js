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
    const c = measurements.chest;
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
  function estimateFabric(measurements, garmentType) {
    try {
      CONFIG.validateGarmentType(garmentType);
    } catch (err) {
      console.warn("[Measurements] Invalid garment type:", err.message);
      garmentType = "tshirt";
    }

    const m = measurements;
    const factors = CONFIG.PRODUCTION_ESTIMATES.fabric;
    const baseArea = (m.chest * m.height) / 10000;
    const factor = factors[garmentType] || 1.5;
    return (baseArea * factor).toFixed(2);
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

window.Measurements = Measurements;
