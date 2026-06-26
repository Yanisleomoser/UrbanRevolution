/**
 * Urban Revolution — Centralized Configuration
 * Single source of truth for all constants, validations, and defaults
 */

const CONFIG = (() => {
    const GARMENT_TYPES = ['tshirt', 'hoodie', 'shirt', 'pants', 'jacket', 'dress'];
    
    const MATERIALS = {
        cotton: 'Bio-Baumwolle',
        linen: 'Leinen',
        denim: 'Denim',
        wool: 'Wolle',
        fleece: 'Fleece',
        silk: 'Seide',
        polyester: 'Recycled Polyester'
    };

    const COLORS = {
        black: '#1a1a1a',
        white: '#ffffff',
        brown: '#7c2d12',
        blue: '#1e3a8a',
        green: '#365314',
        gold: '#a16207',
        burgundy: '#831843',
        purple: '#6b21a8',
        amber: '#f59e0b',
        red: '#dc2626'
    };

    const PATTERNS = ['solid', 'stripes_h', 'stripes_v', 'dots', 'plaid', 'camo', 'gradient', 'heather', 'floral'];

    // Garment length presets. Keys are stable identifiers; visible labels
    // come from i18n (`length.*`). Geometry impact lives in 3d/garments.js,
    // fabric impact in PRODUCTION_ESTIMATES.lengthFabricFactor below.
    const LENGTHS = ['cropped', 'regular', 'long'];

    // Safe, coded errors the render Edge Functions (api/try-on.js,
    // preview-design.js) return → the i18n key app.js (codedErrorMessage) shows
    // the user. The raw upstream reason (billing/credit/auth) stays server-side;
    // the browser only ever sees one of these neutral messages. Keep in sync
    // with the `err.*` keys in i18n.js (the coded-error test pins this).
    const ERROR_CODE_KEYS = {
        service_unavailable: 'err.service_unavailable',
        rate_limited: 'err.rate_limited',
        failed: 'err.failed'
    };

    // Max characters for a custom garment print/Aufschrift.
    const PRINT_MAX_LENGTH = 24;

    const MEASUREMENT_PRESETS = {
        S: { height: 168, weight: 60, chest: 90, waist: 74, hips: 90, shoulder: 41, arm: 58, inseam: 76, neck: 36 },
        M: { height: 175, weight: 70, chest: 96, waist: 82, hips: 98, shoulder: 44, arm: 62, inseam: 82, neck: 38 },
        L: { height: 182, weight: 80, chest: 104, waist: 90, hips: 106, shoulder: 47, arm: 66, inseam: 86, neck: 40 },
        XL: { height: 188, weight: 90, chest: 112, waist: 98, hips: 114, shoulder: 50, arm: 70, inseam: 90, neck: 42 }
    };

    const MEASUREMENT_CONSTRAINTS = {
        height: { min: 140, max: 220, label: 'Körpergrösse' },
        weight: { min: 40, max: 150, label: 'Gewicht' },
        chest: { min: 60, max: 160, label: 'Brustumfang' },
        waist: { min: 50, max: 150, label: 'Taillenumfang' },
        hips: { min: 60, max: 160, label: 'Hüftumfang' },
        shoulder: { min: 30, max: 70, label: 'Schulterbreite' },
        arm: { min: 40, max: 90, label: 'Armlänge' },
        inseam: { min: 50, max: 100, label: 'Schrittlänge' },
        neck: { min: 28, max: 55, label: 'Halsumfang' }
    };

    const PRODUCTION_ESTIMATES = {
        fabric: {
            tshirt: 1.2,
            hoodie: 2.1,
            shirt: 1.8,
            pants: 1.6,
            jacket: 2.4,
            dress: 2.2
        },
        seams: {
            tshirt: (m) => 2 * m.chest + 2 * 30 + 4 * 25,
            hoodie: (m) => 2 * m.chest + 4 * m.arm + 2 * 50 + 80,
            shirt: (m) => 2 * m.chest + 4 * m.arm + 2 * 60 + 50,
            pants: (m) => 4 * m.inseam + 2 * m.waist + 80,
            jacket: (m) => 2 * m.chest + 4 * m.arm + 2 * 65 + 100,
            dress: (m) => 2 * m.chest + 2 * m.hips + 2 * 90 + 60
        },
        days: 14,
        priceRange: { min: 145, max: 220, currency: 'CHF' },
        // Length scales the fabric estimate — a cropped piece uses less
        // cloth, a long one more. Applied in export.buildSpecData.
        lengthFabricFactor: { cropped: 0.82, regular: 1, long: 1.22 }
    };

    // Validation functions
    function validateMeasurement(field, value) {
        if (!MEASUREMENT_CONSTRAINTS[field]) {
            throw new Error(`Unknown measurement field: ${field}`);
        }
        const { min, max, label } = MEASUREMENT_CONSTRAINTS[field];
        const num = parseInt(value, 10);
        
        if (isNaN(num)) {
            throw new Error(`${label}: Muss eine Zahl sein`);
        }
        if (num < min || num > max) {
            throw new Error(`${label}: Muss zwischen ${min} und ${max} sein (erhalten: ${num})`);
        }
        return num;
    }

    function validateGarmentType(type) {
        if (!GARMENT_TYPES.includes(type)) {
            throw new Error(`Invalid garment type: ${type}. Allowed: ${GARMENT_TYPES.join(', ')}`);
        }
        return type;
    }

    function validateMaterial(material) {
        if (!MATERIALS[material]) {
            throw new Error(`Invalid material: ${material}`);
        }
        return material;
    }

    function validateColor(hexColor) {
        if (!/^#[0-9A-F]{6}$/i.test(hexColor)) {
            throw new Error(`Invalid color format: ${hexColor}. Expected: #RRGGBB`);
        }
        return hexColor;
    }

    function validateLength(length) {
        if (!LENGTHS.includes(length)) {
            throw new Error(`Invalid length: ${length}. Allowed: ${LENGTHS.join(', ')}`);
        }
        return length;
    }

    // Custom print/Aufschrift: free text, trimmed, capped, no markup. Empty
    // is valid (no print). Returns the sanitised string.
    function validatePrint(text) {
        if (text === null || text === undefined) return '';
        const str = String(text).replace(/[<>]/g, '').trim();
        if (str.length > PRINT_MAX_LENGTH) {
            return str.slice(0, PRINT_MAX_LENGTH);
        }
        return str;
    }

    // Map an Edge-Function error `code` to its i18n message key, or null when
    // the code is unknown (caller then shows a generic raw-reason fallback).
    function errorMessageKey(code) {
        return Object.prototype.hasOwnProperty.call(ERROR_CODE_KEYS, code)
            ? ERROR_CODE_KEYS[code]
            : null;
    }

    return {
        GARMENT_TYPES,
        MATERIALS,
        COLORS,
        PATTERNS,
        LENGTHS,
        PRINT_MAX_LENGTH,
        ERROR_CODE_KEYS,
        MEASUREMENT_PRESETS,
        MEASUREMENT_CONSTRAINTS,
        PRODUCTION_ESTIMATES,
        validateMeasurement,
        validateGarmentType,
        validateMaterial,
        validateColor,
        validateLength,
        validatePrint,
        errorMessageKey
    };
})();

if (typeof window !== "undefined") window.CONFIG = CONFIG;
if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
