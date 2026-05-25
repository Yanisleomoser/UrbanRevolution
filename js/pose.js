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

    function ellipseCirc(a, b) {
        // Ramanujan's approximation
        return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
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

        // Umfänge aus Breiten approximieren (elliptischer Querschnitt,
        // Tiefe ~70% der Breite). Brust/Taille als anatomische Anteile der
        // Schulterbreite.
        const torsoDepthRatio = 0.62;
        const chestWidthEst = shoulderWidth * 0.88;
        const waistWidthEst = shoulderWidth * 0.72;
        const hipWidthEst = hipWidth;

        const chestCirc = ellipseCirc(chestWidthEst / 2, chestWidthEst * torsoDepthRatio / 2) * 2;
        const waistCirc = ellipseCirc(waistWidthEst / 2, waistWidthEst * torsoDepthRatio / 2) * 2;
        const hipsCirc = ellipseCirc(hipWidthEst / 2, hipWidthEst * 0.72 / 2) * 2;

        // Hals: empirisch ~38% der Schulterbreite (typisch beim Erwachsenen)
        const neckCirc = shoulderWidth * 0.95;

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

        ctx.strokeStyle = 'rgba(236, 72, 153, 0.9)';
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
        ctx.fillStyle = '#06b6d4';
        landmarks.forEach((lm) => {
            if ((lm.visibility || 1) < 0.4) return;
            ctx.beginPath();
            ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    return { init, detect, estimateMeasurements, drawPoseOverlay };
})();

window.Pose = Pose;
