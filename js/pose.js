/**
 * Urban Revolution — Pose-basierte Maßerfassung
 *
 * Nutzt MediaPipe Pose Landmarker (Google) um aus einem Ganzkörperfoto
 * 33 Body-Landmarks zu detektieren und daraus die Körpermaße zu schätzen.
 *
 * DSGVO: Verarbeitung erfolgt zu 100% clientseitig im Browser, das Foto
 * verlässt nie das Gerät. Wird nach Auswertung verworfen.
 */

const Pose = (() => {
    let landmarker = null;
    let loadingPromise = null;

    // MediaPipe Landmark-Indices (Standard 33 Punkte)
    const IDX = {
        NOSE: 0,
        L_SHOULDER: 11, R_SHOULDER: 12,
        L_ELBOW: 13, R_ELBOW: 14,
        L_WRIST: 15, R_WRIST: 16,
        L_HIP: 23, R_HIP: 24,
        L_KNEE: 25, R_KNEE: 26,
        L_ANKLE: 27, R_ANKLE: 28
    };

    function init() {
        if (landmarker) return Promise.resolve(landmarker);
        if (loadingPromise) return loadingPromise;
        loadingPromise = (async () => {
            const mod = await import(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/+esm'
            );
            const vision = await mod.FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
            );
            landmarker = await mod.PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
                    delegate: 'GPU'
                },
                runningMode: 'IMAGE',
                numPoses: 1
            });
            return landmarker;
        })();
        return loadingPromise;
    }

    function loadImageElement(fileOrUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = typeof fileOrUrl === 'string'
                ? fileOrUrl
                : URL.createObjectURL(fileOrUrl);
        });
    }

    async function detect(file) {
        const lm = await init();
        const img = await loadImageElement(file);
        const result = lm.detect(img);
        return { result, img };
    }

    function dist2D(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Schätzt Körpermaße aus 33 Pose-Landmarks.
     * @param {Array} landmarks - MediaPipe NormalizedLandmark[] (x,y in [0,1])
     * @param {number} refHeightCm - Bekannte Nutzergröße in cm (Kalibrierung)
     * @returns {Object} Maße in cm
     */
    function estimateMeasurements(landmarks, refHeightCm) {
        const get = i => landmarks[i];

        // Vertikale Spannweite Nase → Mittelpunkt Knöchel
        const nose = get(IDX.NOSE);
        const midAnkle = {
            x: (get(IDX.L_ANKLE).x + get(IDX.R_ANKLE).x) / 2,
            y: (get(IDX.L_ANKLE).y + get(IDX.R_ANKLE).y) / 2
        };
        const noseToAnkleY = Math.abs(midAnkle.y - nose.y);

        // Nase-zu-Knöchel ≈ 88% der Körpergröße (Kopf-oben bis Nase ≈ 12%)
        // Skalierungsfaktor: 1 normalized unit → wieviele cm in der Realität
        const px2cm = refHeightCm / (noseToAnkleY / 0.88);

        // Direkte 2D-Distanzen
        const shoulderWidth =
            dist2D(get(IDX.L_SHOULDER), get(IDX.R_SHOULDER)) * px2cm;
        const hipWidth =
            dist2D(get(IDX.L_HIP), get(IDX.R_HIP)) * px2cm;
        const armLength = (
            dist2D(get(IDX.L_SHOULDER), get(IDX.L_ELBOW)) +
            dist2D(get(IDX.L_ELBOW), get(IDX.L_WRIST))
        ) * px2cm;
        const inseam = (
            dist2D(get(IDX.L_HIP), get(IDX.L_KNEE)) +
            dist2D(get(IDX.L_KNEE), get(IDX.L_ANKLE))
        ) * px2cm;

        // Umfänge aus anthropometrischen Verhältnissen ableiten — Schulter-
        // breite (biakromiale Spannweite) als Anker, Brust × 2.45, Taille
        // 85% der Brust, Hüfte aus dem max von MediaPipe-Hüft-Distanz × 3.4
        // (deckt weiblich-kurvige Silhouetten ab) und 97% der Brust (deckt
        // männliche Silhouetten ab, wo MediaPipes schmale Hüftgelenk-
        // Distanz den eigentlichen Hüftumfang unterschätzt).
        const chestCirc = shoulderWidth * 2.45;
        const waistCirc = chestCirc * 0.85;
        const hipsCirc = Math.max(hipWidth * 3.4, chestCirc * 0.97);

        // Hals: empirisch ~38cm bei einer 44cm Schulterbreite → Verhältnis 0.86
        const neckCirc = shoulderWidth * 0.86;

        // Gewichts-Schätzung über BMI=22 (durchschnittlich gesund) als Default
        const heightM = refHeightCm / 100;
        const weight = Math.round(22 * heightM * heightM);

        return {
            height: refHeightCm,
            weight,
            chest: Math.round(chestCirc),
            waist: Math.round(waistCirc),
            hips: Math.round(hipsCirc),
            shoulder: Math.round(shoulderWidth),
            arm: Math.round(armLength),
            inseam: Math.round(inseam),
            neck: Math.round(neckCirc)
        };
    }

    /**
     * Samplet Hautfarbe und Haarfarbe aus dem Foto über Face-Landmarks.
     * Verarbeitung weiterhin 100% clientseitig (Canvas im DOM, kein Upload).
     * Liefert null-Werte wenn Landmarks zu schwach sichtbar oder Sample-Punkte
     * außerhalb des Bildes liegen — Caller fällt dann auf Defaults zurück.
     *
     * @param {HTMLImageElement} img - Originalbild
     * @param {Array} landmarks - MediaPipe NormalizedLandmark[]
     * @returns {{skinTone: string|null, hairColor: string|null}}
     */
    function samplePersonalization(img, landmarks) {
        if (!landmarks || landmarks.length < 9) {
            return { skinTone: null, hairColor: null };
        }
        const nose = landmarks[IDX.NOSE];
        const lEye = landmarks[2];
        const rEye = landmarks[5];
        const lEar = landmarks[7];
        const rEar = landmarks[8];

        const required = [nose, lEye, rEye, lEar, rEar];
        if (required.some(l => !l || (l.visibility !== undefined && l.visibility < 0.5))) {
            return { skinTone: null, hairColor: null };
        }

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        // Skin: Nasen-Mitte + beide Wangen (zwischen Nase und Ohr auf Nasen-Höhe)
        const skinSamples = [
            samplePatch(ctx, nose.x, nose.y, canvas, 6),
            samplePatch(ctx, (nose.x + lEar.x) / 2, nose.y, canvas, 5),
            samplePatch(ctx, (nose.x + rEar.x) / 2, nose.y, canvas, 5),
        ].filter(Boolean);

        // Haar: über der Augenlinie. Kopf reicht ca. 2× Nase-Auge-Abstand
        // über die Augen hinaus (anatomische Faustregel)
        const eyeY = (lEye.y + rEye.y) / 2;
        const eyeX = (lEye.x + rEye.x) / 2;
        const hairOffset = Math.max(0.02, (nose.y - eyeY) * 2.2);
        const hairY = Math.max(0.005, eyeY - hairOffset);

        const hairSamples = [
            samplePatch(ctx, eyeX, hairY, canvas, 6),
            samplePatch(ctx, eyeX - 0.04, hairY + 0.01, canvas, 5),
            samplePatch(ctx, eyeX + 0.04, hairY + 0.01, canvas, 5),
        ].filter(Boolean);

        const skinAvgRaw = averageRGB(skinSamples);
        const hairAvg = averageRGB(hairSamples);

        // Skin-Tone-Sättigung kappen: warmes Innenraumlicht erzeugt sonst
        // übersättigtes Orange/Rot. Reale Hautfarben haben max ~40% Saturation.
        const skinAvg = skinAvgRaw ? clampSaturation(skinAvgRaw, 0.42) : null;

        // Wenn Haar-Sample fast wie Haut aussieht → wahrscheinlich kein Haar
        // sichtbar (Glatze, abgeschnittenes Foto). null signalisiert "keine
        // Haare rendern".
        const hairColor = hairAvg && skinAvg && colorDistance(hairAvg, skinAvgRaw) > 30
            ? rgbToHex(hairAvg)
            : null;

        return {
            skinTone: skinAvg ? rgbToHex(skinAvg) : null,
            hairColor,
        };
    }

    function clampSaturation(rgb, maxS) {
        const avg = (rgb.r + rgb.g + rgb.b) / 3;
        const maxDev = Math.max(
            Math.abs(rgb.r - avg),
            Math.abs(rgb.g - avg),
            Math.abs(rgb.b - avg),
        );
        const currentS = maxDev / Math.max(avg, 1);
        if (currentS <= maxS) return rgb;
        const factor = maxS / currentS;
        return {
            r: avg + (rgb.r - avg) * factor,
            g: avg + (rgb.g - avg) * factor,
            b: avg + (rgb.b - avg) * factor,
        };
    }

    function samplePatch(ctx, normX, normY, canvas, radius = 6) {
        const x = Math.round(normX * canvas.width);
        const y = Math.round(normY * canvas.height);
        if (x < radius || x > canvas.width - radius ||
            y < radius || y > canvas.height - radius) {
            return null;
        }
        const data = ctx.getImageData(x - radius, y - radius, radius * 2, radius * 2).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        return { r: r / n, g: g / n, b: b / n };
    }

    function averageRGB(samples) {
        if (!samples.length) return null;
        const sum = samples.reduce((acc, s) => ({
            r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b,
        }), { r: 0, g: 0, b: 0 });
        return {
            r: sum.r / samples.length,
            g: sum.g / samples.length,
            b: sum.b / samples.length,
        };
    }

    function colorDistance(a, b) {
        const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    function rgbToHex(rgb) {
        const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`;
    }

    /**
     * Zeichnet die erkannten Landmarks auf ein Canvas (Skelett-Overlay).
     */
    function drawPoseOverlay(canvas, img, landmarks) {
        const ctx = canvas.getContext('2d');
        const maxW = 320;
        const aspect = img.naturalHeight / img.naturalWidth;
        canvas.width = maxW;
        canvas.height = maxW * aspect;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
            [11, 23], [12, 24], [23, 24],
            [23, 25], [25, 27], [24, 26], [26, 28],
            [0, 11], [0, 12]
        ];

        ctx.strokeStyle = 'rgba(31, 59, 255, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        connections.forEach(([a, b]) => {
            const la = landmarks[a], lb = landmarks[b];
            if (la && lb) {
                ctx.moveTo(la.x * canvas.width, la.y * canvas.height);
                ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height);
            }
        });
        ctx.stroke();

        // Landmark-Punkte
        ctx.fillStyle = '#1f3bff';
        landmarks.forEach((lm) => {
            if ((lm.visibility || 1) < 0.4) return;
            ctx.beginPath();
            ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    return { init, detect, estimateMeasurements, samplePersonalization, drawPoseOverlay };
})();

window.Pose = Pose;
