/**
 * Urban Revolution — Measurements
 * Verwaltet die Körpermaße des Kunden und stellt Voreinstellungen bereit.
 */

const Measurements = (() => {
    const PRESETS = {
        S: { height: 168, weight: 60, chest: 88, waist: 74, hips: 90, shoulder: 41, arm: 58, inseam: 76, neck: 36 },
        M: { height: 175, weight: 70, chest: 96, waist: 82, hips: 98, shoulder: 44, arm: 62, inseam: 82, neck: 38 },
        L: { height: 182, weight: 80, chest: 104, waist: 90, hips: 106, shoulder: 47, arm: 66, inseam: 86, neck: 40 },
        XL: { height: 188, weight: 90, chest: 112, waist: 98, hips: 114, shoulder: 50, arm: 70, inseam: 90, neck: 42 }
    };

    const FIELDS = ['height', 'weight', 'chest', 'waist', 'hips', 'shoulder', 'arm', 'inseam', 'neck'];

    const LABELS = {
        height: 'Körpergröße',
        weight: 'Gewicht',
        chest: 'Brustumfang',
        waist: 'Taillenumfang',
        hips: 'Hüftumfang',
        shoulder: 'Schulterbreite',
        arm: 'Armlänge',
        inseam: 'Schrittlänge',
        neck: 'Halsumfang'
    };

    function read() {
        const result = {};
        FIELDS.forEach(field => {
            const input = document.getElementById(field);
            result[field] = input ? parseInt(input.value, 10) : PRESETS.M[field];
        });
        return result;
    }

    function write(data) {
        FIELDS.forEach(field => {
            const input = document.getElementById(field);
            if (input && data[field] !== undefined) {
                input.value = data[field];
            }
        });
    }

    function applyPreset(presetName) {
        const preset = PRESETS[presetName];
        if (preset) write(preset);
        return preset;
    }

    /**
     * Berechnet die Konfektionsgröße aus den gemessenen Daten
     */
    function calculateSize(measurements) {
        const c = measurements.chest;
        if (c < 90) return 'XS';
        if (c < 96) return 'S';
        if (c < 102) return 'M';
        if (c < 110) return 'L';
        if (c < 118) return 'XL';
        return 'XXL';
    }

    /**
     * Schätzt benötigte Stoffmenge in m² basierend auf Maßen und Kleidungstyp
     */
    function estimateFabric(measurements, garmentType) {
        const m = measurements;
        const factors = {
            tshirt: 1.2,
            hoodie: 2.1,
            shirt: 1.8,
            pants: 1.6,
            jacket: 2.4,
            dress: 2.2
        };

        const baseArea = (m.chest * m.height) / 10000;
        const factor = factors[garmentType] || 1.5;
        return (baseArea * factor).toFixed(2);
    }

    /**
     * Berechnet die geschätzte Nahtlänge
     */
    function estimateSeams(measurements, garmentType) {
        const m = measurements;
        const formulas = {
            tshirt: 2 * m.chest + 2 * 30 + 4 * 25,
            hoodie: 2 * m.chest + 4 * m.arm + 2 * 50 + 80,
            shirt: 2 * m.chest + 4 * m.arm + 2 * 60 + 50,
            pants: 4 * m.inseam + 2 * m.waist + 80,
            jacket: 2 * m.chest + 4 * m.arm + 2 * 65 + 100,
            dress: 2 * m.chest + 2 * m.hips + 2 * 90 + 60
        };
        return formulas[garmentType] || 200;
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
        estimateSeams
    };
})();

window.Measurements = Measurements;
