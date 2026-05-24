import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/* Lokale GLB-Modelle aus Three.js Examples (CC0/Apache 2.0, in models/ commited) */
const HUMAN_MODELS = {
    male_slim:      'models/CesiumMan.glb',
    male_regular:   'models/CesiumMan.glb',
    male_athletic:  'models/CesiumMan.glb',
    female_slim:    'models/Michelle.glb',
    female_regular: 'models/Michelle.glb',
    female_curvy:   'models/Michelle.glb'
};

/* Mesh-Namen / Material-Tokens die als eingebaute Kleidung gelten */
const CLOTHING_NAME_HINTS = /shirt|pants|cloth|uniform|jeans|shoe|dress|jacket|skirt|hat/i;

/* ============================================================
   AVATAR PRESETS — 4 männlich + 4 weiblich + 1 neutral
   ============================================================ */

/* 6 Avatar-Presets: 3 Körperbauten × 2 Geschlechter.
 * xzScale wirkt auf das geladene GLB-Modell, die Mods skalieren das prozedurale
 * Fallback-Mannequin und die Maße-Berechnung für die parametrische Kleidung. */
const AVATAR_PRESETS = {
    male_slim: {
        label: 'Männlich · Schlank', gender: 'male',
        skinTone: 0xe6c4a1, hairColor: 0x3a2010, hair: 'short',
        xzScale: 0.88,
        shoulderMod: 0.92, chestMod: 0.90, waistMod: 0.82, hipsMod: 0.90,
        muscleMod: 0.82, bust: 0,
        defaults: { height: 178, chest: 90, waist: 74, hips: 90, shoulder: 42, arm: 62, inseam: 82, neck: 36 }
    },
    male_regular: {
        label: 'Männlich · Durchschnitt', gender: 'male',
        skinTone: 0xd4a37a, hairColor: 0x1a1108, hair: 'short',
        xzScale: 1.0,
        shoulderMod: 1.0, chestMod: 1.0, waistMod: 0.98, hipsMod: 0.95,
        muscleMod: 1.0, bust: 0,
        defaults: { height: 180, chest: 100, waist: 84, hips: 98, shoulder: 45, arm: 64, inseam: 84, neck: 38 }
    },
    male_athletic: {
        label: 'Männlich · Athletisch', gender: 'male',
        skinTone: 0xc89878, hairColor: 0x2a1810, hair: 'fade',
        xzScale: 1.12,
        shoulderMod: 1.18, chestMod: 1.12, waistMod: 0.94, hipsMod: 0.97,
        muscleMod: 1.20, bust: 0,
        defaults: { height: 184, chest: 108, waist: 86, hips: 102, shoulder: 50, arm: 66, inseam: 86, neck: 40 }
    },
    female_slim: {
        label: 'Weiblich · Schlank', gender: 'female',
        skinTone: 0xf2d4b8, hairColor: 0x5a2c10, hair: 'long_wavy',
        xzScale: 0.86,
        shoulderMod: 0.84, chestMod: 0.85, waistMod: 0.78, hipsMod: 0.92,
        muscleMod: 0.80, bust: 0.028,
        defaults: { height: 168, chest: 84, waist: 66, hips: 90, shoulder: 38, arm: 58, inseam: 78, neck: 33 }
    },
    female_regular: {
        label: 'Weiblich · Durchschnitt', gender: 'female',
        skinTone: 0xe6c4a1, hairColor: 0x3a2010, hair: 'bob',
        xzScale: 0.96,
        shoulderMod: 0.90, chestMod: 0.94, waistMod: 0.86, hipsMod: 1.05,
        muscleMod: 0.88, bust: 0.038,
        defaults: { height: 170, chest: 92, waist: 72, hips: 98, shoulder: 41, arm: 60, inseam: 80, neck: 35 }
    },
    female_curvy: {
        label: 'Weiblich · Kurvig', gender: 'female',
        skinTone: 0xa07556, hairColor: 0x0d0805, hair: 'long_straight',
        xzScale: 1.08,
        shoulderMod: 0.95, chestMod: 1.05, waistMod: 0.95, hipsMod: 1.20,
        muscleMod: 0.95, bust: 0.052,
        defaults: { height: 170, chest: 102, waist: 80, hips: 112, shoulder: 42, arm: 60, inseam: 80, neck: 36 }
    }
};

/* ============================================================
   PATTERN-TEXTUR-GENERATOR — Stoffmuster aus Canvas
   ============================================================ */

function generatePatternTexture(pattern, primary, secondary, materialType) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, 512, 512);

    switch (pattern) {
        case 'stripes_h':
            ctx.fillStyle = secondary;
            for (let y = 0; y < 512; y += 64) ctx.fillRect(0, y, 512, 22);
            break;
        case 'stripes_v':
            ctx.fillStyle = secondary;
            for (let x = 0; x < 512; x += 64) ctx.fillRect(x, 0, 22, 512);
            break;
        case 'dots':
            ctx.fillStyle = secondary;
            for (let y = 24; y < 512; y += 48) {
                for (let x = 24; x < 512; x += 48) {
                    ctx.beginPath();
                    ctx.arc(x + (y % 96 ? 24 : 0), y, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            break;
        case 'plaid':
            ctx.fillStyle = secondary;
            for (let i = 0; i < 512; i += 80) {
                ctx.globalAlpha = 0.45;
                ctx.fillRect(i, 0, 14, 512);
                ctx.fillRect(0, i, 512, 14);
            }
            ctx.globalAlpha = 0.8;
            for (let i = 40; i < 512; i += 80) {
                ctx.fillRect(i, 0, 3, 512);
                ctx.fillRect(0, i, 512, 3);
            }
            ctx.globalAlpha = 1;
            break;
        case 'camo': {
            const shades = [secondary, '#3a4d23', '#6b7344', '#2d3517'];
            for (let i = 0; i < 80; i++) {
                ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
                ctx.globalAlpha = 0.65;
                ctx.beginPath();
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const r = 30 + Math.random() * 40;
                ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            break;
        }
        case 'gradient': {
            const grad = ctx.createLinearGradient(0, 0, 0, 512);
            grad.addColorStop(0, primary);
            grad.addColorStop(1, secondary);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);
            break;
        }
        case 'heather': {
            const baseColor = primary;
            for (let i = 0; i < 4000; i++) {
                ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`;
                ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
            }
            for (let i = 0; i < 2000; i++) {
                ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
                ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
            }
            break;
        }
        case 'floral': {
            ctx.fillStyle = secondary;
            for (let y = 40; y < 512; y += 100) {
                for (let x = 40; x < 512; x += 100) {
                    const cx = x + (y % 200 ? 50 : 0);
                    for (let p = 0; p < 6; p++) {
                        const angle = (p / 6) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.ellipse(cx + Math.cos(angle) * 12, y + Math.sin(angle) * 12,
                                    8, 14, angle, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            break;
        }
    }

    // Material grain overlay
    if (materialType === 'denim') {
        ctx.globalAlpha = 0.18;
        for (let i = 0; i < 5000; i++) {
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 3);
        }
        ctx.globalAlpha = 1;
    } else if (materialType === 'wool') {
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 3000; i++) {
            ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`;
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
        }
        ctx.globalAlpha = 1;
    } else if (materialType === 'linen') {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#000';
        for (let y = 0; y < 512; y += 4) ctx.fillRect(0, y, 512, 1);
        for (let x = 0; x < 512; x += 4) ctx.fillRect(x, 0, 1, 512);
        ctx.globalAlpha = 1;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
}

function generateGraphicTexture(text, fgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = fgColor;
    ctx.font = `bold ${text.length > 6 ? 60 : 100}px 'Inter', 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.fillText(text, 256, 256);
    // Subtle border for definition
    ctx.strokeStyle = fgColor === '#fafafa' ? '#000' : '#fff';
    ctx.lineWidth = 2;
    ctx.strokeText(text, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

/* ============================================================
   GARMENT SCENE
   ============================================================ */

class GarmentScene {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.garmentMesh = null;
        this.avatarMesh = null;
        this.graphicMesh = null;
        this.measurementLabels = [];

        this.currentType = 'tshirt';
        this.currentColor = 0x1a1a1a;
        this.currentSecondary = 0xfafafa;
        this.currentMaterial = 'cotton';
        this.currentFit = 0.5;
        this.currentAvatar = 'male_regular';
        this.currentPattern = 'solid';
        this.currentGraphic = null;
        this.currentSleeve = null;
        this.currentLength = 'regular';
        this.currentDetails = {};

        this.showAvatar = true;
        this.showMeasurements = false;
        this.wireframe = false;
        this.measurements = null;

        this.gltfLoader = new GLTFLoader();
        this.humanModelCache = {};
        this.modelsLoaded = false;

        this.initRenderer();
        this.initCamera();
        this.initLights();
        this.initControls();
        this.initFloor();
        this.preloadHumanModels();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
    }

    async preloadHumanModels() {
        const uniqueUrls = [...new Set(Object.values(HUMAN_MODELS))];
        const results = await Promise.allSettled(uniqueUrls.map(url => this.loadHumanModel(url)));
        const loaded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - loaded;
        this.modelsLoaded = loaded > 0;
        if (loaded > 0) this.buildGarment();
        if (failed > 0) {
            console.warn(`[avatar] ${failed}/${results.length} GLB models failed to load`);
        }
        window.dispatchEvent(new CustomEvent('avatar-load-result', {
            detail: { loaded, failed, total: results.length }
        }));
    }

    loadHumanModel(url) {
        if (this.humanModelCache[url]) return Promise.resolve(this.humanModelCache[url]);
        console.info(`[avatar] loading ${url}`);
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    console.info(`[avatar] ✓ loaded ${url} — ${gltf.scene.children.length} root children`);
                    this.humanModelCache[url] = gltf.scene;
                    resolve(gltf.scene);
                },
                (progress) => {
                    if (progress.total) {
                        const pct = Math.round((progress.loaded / progress.total) * 100);
                        if (pct % 25 === 0) console.info(`[avatar] ${url}: ${pct}%`);
                    }
                },
                (err) => {
                    console.error(`[avatar] ✗ failed ${url}:`, err);
                    reject(err);
                }
            );
        });
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.container.appendChild(this.renderer.domElement);
    }

    initCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 1000);
        this.camera.position.set(0, 1.2, 4.2);
    }

    initLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        const key = new THREE.DirectionalLight(0xfff5e8, 1.3);
        key.position.set(3, 5, 4);
        key.castShadow = true;
        key.shadow.mapSize.width = 2048;
        key.shadow.mapSize.height = 2048;
        key.shadow.camera.left = -3;
        key.shadow.camera.right = 3;
        key.shadow.camera.top = 3;
        key.shadow.camera.bottom = -3;
        key.shadow.bias = -0.0002;
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0xec4899, 0.3);
        fill.position.set(-4, 2, 2);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0x8b5cf6, 0.5);
        rim.position.set(0, 3, -4);
        this.scene.add(rim);

        const top = new THREE.HemisphereLight(0xffffff, 0x444466, 0.3);
        this.scene.add(top);
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1.05, 0);
        this.controls.minDistance = 2;
        this.controls.maxDistance = 8;
        this.controls.minPolarAngle = Math.PI / 6;
        this.controls.maxPolarAngle = Math.PI - Math.PI / 6;
        this.autoRotate = false;
    }

    initFloor() {
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(3, 64),
            new THREE.MeshStandardMaterial({
                color: 0x0d0d10, roughness: 0.85, metalness: 0.1,
                transparent: true, opacity: 0.6
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const grid = new THREE.GridHelper(6, 24, 0x222227, 0x16161a);
        grid.position.y = 0.001;
        this.scene.add(grid);
    }

    /* ---------------- Helpers ---------------- */

    circToRadius(circCm) { return circCm / (2 * Math.PI * 100); }

    getMeasurements() {
        return this.measurements || AVATAR_PRESETS[this.currentAvatar].defaults;
    }

    getMaterialProps(t) {
        return {
            cotton:    { roughness: 0.85, metalness: 0.0 },
            linen:     { roughness: 0.95, metalness: 0.0 },
            denim:     { roughness: 0.75, metalness: 0.05 },
            wool:      { roughness: 0.90, metalness: 0.0 },
            fleece:    { roughness: 0.95, metalness: 0.0 },
            silk:      { roughness: 0.30, metalness: 0.15 },
            polyester: { roughness: 0.55, metalness: 0.10 }
        }[t] || { roughness: 0.85, metalness: 0.0 };
    }

    getBodyDimensions() {
        const m = this.getMeasurements();
        const preset = AVATAR_PRESETS[this.currentAvatar];
        return {
            heightScale: m.height / 175,
            headY: 1.62, neckY: 1.50,
            shoulderY: 1.42, chestY: 1.20,
            waistY: 0.92, hipsY: 0.78,
            crotchY: 0.72, kneeY: 0.42, ankleY: 0.04,
            shoulderHalfWidth: (m.shoulder / 2 / 100) * preset.shoulderMod,
            chestR: this.circToRadius(m.chest * preset.chestMod),
            waistR: this.circToRadius(m.waist * preset.waistMod),
            hipsR: this.circToRadius(m.hips * preset.hipsMod),
            neckR: this.circToRadius(m.neck),
            headR: 0.10,
            armR: 0.042 * preset.muscleMod,
            legR: 0.080 * preset.muscleMod,
            ankleR: 0.045,
            depthScale: preset.gender === 'female' ? 0.72 : 0.78,
            bust: preset.bust,
            preset
        };
    }

    getEase() { return 1.06 + this.currentFit * 0.62; }

    buildGarment() {
        if (this.garmentMesh) { this.scene.remove(this.garmentMesh); this.disposeGroup(this.garmentMesh); }
        if (this.avatarMesh)  { this.scene.remove(this.avatarMesh);  this.disposeGroup(this.avatarMesh);  }
        if (this.graphicMesh) { this.scene.remove(this.graphicMesh); this.disposeGroup(this.graphicMesh); }

        const dims = this.getBodyDimensions();
        const usingGlbAvatar = this.showAvatar && this.isGlbAvatarAvailable();

        if (this.showAvatar) {
            this.avatarMesh = this.buildAvatar(dims);
            if (!this.avatarMesh.userData.scaled) {
                this.avatarMesh.scale.y = dims.heightScale;
            }
            // Wenn GLB-Avatar: User-Designfarbe auf die eingebaute Kleidung
            // des Modells anwenden, damit "Try-On" Feeling entsteht
            if (this.avatarMesh.userData.scaled) {
                this.applyDesignToGlbClothing(this.avatarMesh);
            }
            this.scene.add(this.avatarMesh);
        }

        const matProps = this.getMaterialProps(this.currentMaterial);
        const fabricMat = new THREE.MeshStandardMaterial({
            color: this.currentColor,
            roughness: matProps.roughness,
            metalness: matProps.metalness,
            side: THREE.DoubleSide,
            wireframe: this.wireframe
        });

        if (this.currentPattern && this.currentPattern !== 'solid') {
            const primaryHex = '#' + this.currentColor.toString(16).padStart(6, '0');
            const secondaryHex = '#' + this.currentSecondary.toString(16).padStart(6, '0');
            fabricMat.map = generatePatternTexture(
                this.currentPattern, primaryHex, secondaryHex, this.currentMaterial
            );
        }

        const group = new THREE.Group();
        group.name = 'garment';
        // Bei GLB-Avatar parametrische Kleidung ausblenden — sie sitzt nicht
        // auf dem Körper, und der Avatar trägt jetzt unsere Designfarbe.
        group.visible = !usingGlbAvatar;

        const builder = {
            tshirt: this.buildTshirt, hoodie: this.buildHoodie, shirt: this.buildShirt,
            pants: this.buildPants,   jacket: this.buildJacket, dress: this.buildDress
        }[this.currentType];
        builder.call(this, group, fabricMat, dims);

        // Apply graphic decal (front chest)
        if (this.currentGraphic && this.currentType !== 'pants') {
            this.addGraphicDecal(group, dims);
        }

        group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
        group.scale.y = dims.heightScale;
        this.garmentMesh = group;
        this.scene.add(group);

        this.updateMeasurementLabels();
    }

    disposeGroup(g) {
        g.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                const ms = Array.isArray(o.material) ? o.material : [o.material];
                ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
            }
        });
    }

    /* ============================================================
       AVATAR — anatomisch korrekt, mit Gesicht und Haaren
       ============================================================ */

    buildAvatar(dims) {
        const modelUrl = HUMAN_MODELS[this.currentAvatar];
        const sourceModel = modelUrl ? this.humanModelCache[modelUrl] : null;

        if (sourceModel) {
            return this.buildGlbAvatar(sourceModel, dims);
        }
        return this.buildProceduralAvatar(dims);
    }

    isGlbAvatarAvailable() {
        const url = HUMAN_MODELS[this.currentAvatar];
        return !!(url && this.humanModelCache[url]);
    }

    /**
     * Wendet die vom User gewählte Designfarbe + Muster auf die größte
     * Mesh-Komponente des GLB-Avatars an (Heuristik: das größte Mesh ist
     * Body+Outfit, kleinere sind Details wie Augen/Haare).
     */
    applyDesignToGlbClothing(avatarGroup) {
        const designColor = new THREE.Color(this.currentColor);
        const matProps = this.getMaterialProps(this.currentMaterial);

        const meshes = [];
        avatarGroup.traverse(o => {
            if (o.isMesh && o.geometry && o.geometry.attributes.position) {
                meshes.push({ mesh: o, verts: o.geometry.attributes.position.count });
            }
        });
        if (meshes.length === 0) return;

        // Größtes Mesh = Outfit, wird umgefärbt
        meshes.sort((a, b) => b.verts - a.verts);
        const target = meshes[0].mesh;

        const mats = Array.isArray(target.material) ? target.material : [target.material];
        mats.forEach(m => {
            if (!m || !m.color) return;
            m.color.copy(designColor);
            m.roughness = matProps.roughness;
            m.metalness = matProps.metalness;
            if (this.currentPattern && this.currentPattern !== 'solid') {
                const primaryHex = '#' + this.currentColor.toString(16).padStart(6, '0');
                const secondaryHex = '#' + this.currentSecondary.toString(16).padStart(6, '0');
                if (m.map) m.map.dispose();
                m.map = generatePatternTexture(
                    this.currentPattern, primaryHex, secondaryHex, this.currentMaterial
                );
            } else if (m.map) {
                m.map = null;
            }
            m.needsUpdate = true;
        });
    }

    buildGlbAvatar(sourceModel, dims) {
        const group = new THREE.Group();
        group.name = 'avatar';
        group.userData.scaled = true;
        const preset = dims.preset;

        // SkeletonUtils.clone für gerigte Meshes
        let model;
        try {
            model = cloneSkinned(sourceModel);
        } catch (err) {
            console.warn('[avatar] SkeletonUtils.clone failed:', err);
            model = sourceModel.clone(true);
        }

        // Materialien klonen + Frustum-Culling für SkinnedMesh ausschalten
        model.traverse(o => {
            if (!o.isMesh) return;
            if (Array.isArray(o.material)) {
                o.material = o.material.map(m => m.clone());
            } else if (o.material) {
                o.material = o.material.clone();
            }
            if (o.isSkinnedMesh) o.frustumCulled = false;
            o.castShadow = true;
            o.receiveShadow = true;
        });

        // Bbox aus tatsächlichem Welt-Mesh ableiten (mit Bone-Transform)
        model.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(model);
        let modelHeight = bbox.max.y - bbox.min.y;

        // Fallback wenn Bbox kaputt
        if (!isFinite(modelHeight) || modelHeight < 0.05) {
            console.warn(`[avatar] degenerate bbox (${modelHeight}), assuming meter scale`);
            modelHeight = 1.72;
        }

        console.info(`[avatar] ${this.currentAvatar} native: ${modelHeight.toFixed(2)}m`);

        // Auf Ziel-Höhe skalieren (User-Größe in m)
        const targetHeight = 1.72 * dims.heightScale;
        const yScale = targetHeight / modelHeight;
        const xzScale = yScale * (preset.xzScale || 1.0);
        model.scale.set(xzScale, yScale, xzScale);

        // Füße auf Boden (y=0) bringen
        model.updateMatrixWorld(true);
        const scaledBbox = new THREE.Box3().setFromObject(model);
        model.position.y = -scaledBbox.min.y;

        // KEINE Rotation! Mixamo/glTF-Modelle blicken bereits in +Z Richtung
        // (= zum Kamera-Position der bei z=+4.2 steht). Die vorherige
        // Math.PI-Rotation drehte sie weg von der Kamera (User sah Rücken).

        group.add(model);
        return group;
    }

    buildProceduralAvatar(dims) {
        const group = new THREE.Group();
        group.name = 'avatar';
        const preset = dims.preset;

        const skinMat = new THREE.MeshStandardMaterial({
            color: preset.skinTone, roughness: 0.62, metalness: 0.02
        });
        const hairMat = new THREE.MeshStandardMaterial({
            color: preset.hairColor, roughness: 0.5, metalness: 0.0
        });

        // === EIN-PIECE BODY: Kopf + Hals + Torso + Hüfte als eine glatte Lathe ===
        const bodyPoints = [
            // Scheitel
            [0.003, dims.headY + dims.headR * 1.05],
            [dims.headR * 0.35, dims.headY + dims.headR * 0.98],
            [dims.headR * 0.75, dims.headY + dims.headR * 0.75],
            [dims.headR * 0.95, dims.headY + dims.headR * 0.35],
            // Schläfe (breitester Punkt)
            [dims.headR, dims.headY + dims.headR * 0.05],
            [dims.headR * 0.97, dims.headY - dims.headR * 0.30],
            // Kiefer
            [dims.headR * 0.78, dims.headY - dims.headR * 0.65],
            [dims.headR * 0.52, dims.headY - dims.headR * 0.95],
            // Hals (sanft)
            [dims.neckR * 1.0, dims.neckY + 0.02],
            [dims.neckR * 1.05, dims.neckY - 0.04],
            [dims.neckR * 1.25, dims.shoulderY + 0.10],
            // Trapezius — sanfter Hang zur Schulter
            [dims.shoulderHalfWidth * 0.55, dims.shoulderY + 0.05],
            [dims.shoulderHalfWidth * 0.78, dims.shoulderY + 0.005],
            // Brustkorb-Übergang (Schulter zu Brust)
            [dims.chestR * 1.04, dims.chestY + 0.10],
            [dims.chestR * 1.0, dims.chestY - 0.02],
            // Rippenbogen → Taille
            [(dims.chestR + dims.waistR) / 2 + 0.005, (dims.chestY + dims.waistY) / 2],
            [dims.waistR, dims.waistY],
            // Taille → Hüfte
            [(dims.waistR + dims.hipsR) / 2 + 0.008, (dims.waistY + dims.hipsY) / 2],
            [dims.hipsR, dims.hipsY],
            // Hüfte → Schritt
            [dims.hipsR * 0.95, dims.crotchY + 0.06],
            [dims.hipsR * 0.78, dims.crotchY + 0.01]
        ];
        const body = new THREE.Mesh(
            new THREE.LatheGeometry(
                bodyPoints.map(([x, y]) => new THREE.Vector2(x, y)),
                48
            ),
            skinMat
        );
        body.scale.z = dims.depthScale;
        group.add(body);

        // Brust (subtle, für weibliche Presets)
        if (dims.bust > 0.01) {
            [-1, 1].forEach(side => {
                const bust = new THREE.Mesh(
                    new THREE.SphereGeometry(dims.bust + 0.022, 20, 16),
                    skinMat
                );
                bust.position.set(
                    side * dims.chestR * 0.40,
                    dims.chestY + 0.04,
                    dims.chestR * dims.depthScale * 0.6
                );
                bust.scale.set(1, 0.95, 0.65);
                group.add(bust);
            });
        }

        // === ARME: einteilig, sanft tapered, kein sichtbares Gelenk ===
        const armLen = this.getMeasurements().arm / 100;
        const armAngle = 0.14;

        [-1, 1].forEach(side => {
            const sx = side * dims.shoulderHalfWidth * 0.82;
            const sy = dims.shoulderY - 0.02;

            // Schulterkappe (Deltoid) — überlappt sowohl Körper als auch Arm
            const delt = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 1.8, 24, 18),
                skinMat
            );
            delt.position.set(sx, sy + 0.03, 0);
            delt.scale.set(1.0, 0.95, 1.0);
            group.add(delt);

            // Ein durchgehender, getaperter Arm (Oberarm → Hand in einem)
            // Lathe-Geometrie mit subtilem Bizeps und Unterarm-Schwellung
            const armPts = [
                [dims.armR * 1.10, 0],
                [dims.armR * 1.08, armLen * 0.18],   // Bizeps
                [dims.armR * 0.95, armLen * 0.40],
                [dims.armR * 0.92, armLen * 0.50],   // Ellenbogen (kaum sichtbar)
                [dims.armR * 0.98, armLen * 0.62],   // Unterarm
                [dims.armR * 0.85, armLen * 0.80],
                [dims.armR * 0.62, armLen * 0.94],   // Handgelenk
                [dims.armR * 0.55, armLen * 0.99]
            ];
            const arm = new THREE.Mesh(
                new THREE.LatheGeometry(
                    armPts.map(([x, y]) => new THREE.Vector2(x, y)),
                    24
                ),
                skinMat
            );
            arm.position.set(sx, sy + 0.02, 0);
            arm.rotation.z = side * (Math.PI - armAngle);
            arm.rotation.y = Math.PI;
            group.add(arm);

            // Hand — flach abgerundet
            const handX = sx + side * Math.sin(armAngle) * armLen;
            const handY = sy + 0.02 - Math.cos(armAngle) * armLen;
            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 1.0, 20, 14),
                skinMat
            );
            hand.position.set(handX, handY - 0.04, 0);
            hand.scale.set(0.65, 1.5, 0.4);
            hand.rotation.z = side * -armAngle;
            group.add(hand);
        });

        // === BEINE: einteilig, getapert ===
        const inseam = this.getMeasurements().inseam / 100;
        const legSpacing = dims.hipsR * 0.42;

        [-1, 1].forEach(side => {
            const hx = side * legSpacing;

            // Glatter Lathe-Bein (Oberschenkel → Knöchel ohne sichtbares Knie)
            const legPts = [
                [dims.legR * 1.20, dims.crotchY],
                [dims.legR * 1.15, dims.crotchY - inseam * 0.18],
                [dims.legR * 0.95, dims.crotchY - inseam * 0.35],
                [dims.legR * 0.85, dims.crotchY - inseam * 0.48],   // Knie-Bereich
                [dims.legR * 0.78, dims.crotchY - inseam * 0.60],
                [dims.legR * 0.72, dims.crotchY - inseam * 0.78],   // Wade
                [dims.legR * 0.50, dims.crotchY - inseam * 0.95],
                [dims.legR * 0.45, dims.ankleY + 0.02]
            ];
            const leg = new THREE.Mesh(
                new THREE.LatheGeometry(
                    legPts.map(([x, y]) => new THREE.Vector2(x, y)),
                    24
                ),
                skinMat
            );
            leg.position.set(hx, 0, 0);
            group.add(leg);

            // Fuß
            const foot = new THREE.Mesh(
                new THREE.BoxGeometry(dims.legR * 1.30, dims.legR * 0.70, dims.legR * 2.8),
                skinMat
            );
            foot.position.set(hx, dims.ankleY + 0.005, dims.legR * 0.7);
            group.add(foot);

            // Fußspitze
            const toe = new THREE.Mesh(
                new THREE.SphereGeometry(dims.legR * 0.55, 16, 12),
                skinMat
            );
            toe.position.set(hx, dims.ankleY + 0.005, dims.legR * 2.0);
            toe.scale.set(1.3, 1.0, 1.4);
            group.add(toe);
        });

        // === GESICHT (sehr dezent) + HAARE ===
        this.buildFace(group, dims, skinMat, hairMat);
        this.buildHair(group, dims, hairMat);

        // Ohren
        [-1, 1].forEach(side => {
            const ear = new THREE.Mesh(
                new THREE.SphereGeometry(dims.headR * 0.16, 14, 12),
                skinMat
            );
            ear.scale.set(0.32, 1.0, 0.65);
            ear.position.set(side * dims.headR * 0.93, dims.headY + 0.005, 0);
            group.add(ear);
        });

        group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        return group;
    }

    buildHead(group, dims, skinMat, hairMat) {
        // Kept for compatibility — buildAvatar now handles head as part of one-piece body
    }

    buildFace(group, dims, skinMat, hairMat) {
        const headR = dims.headR;
        const headY = dims.headY;
        const preset = dims.preset;
        const faceDepth = headR * dims.depthScale * 1.02;
        const isFemale = preset.gender === 'female';

        // Gesicht im Mannequin-Stil: nur dezente Andeutungen.
        // Subtile dunkle Augen — keine separate Sklera/Iris/Pupille, einfach 2 Punkte.
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0x16110a, roughness: 0.3, metalness: 0.1
        });
        [-1, 1].forEach(side => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.075, 14, 10),
                eyeMat
            );
            eye.position.set(side * headR * 0.32, headY + headR * 0.05, faceDepth * 0.97);
            eye.scale.set(1.0, 0.55, 0.4);
            group.add(eye);
        });

        // Augenbrauen — feine Linien
        [-1, 1].forEach(side => {
            const brow = new THREE.Mesh(
                new THREE.BoxGeometry(headR * 0.26, headR * 0.025, headR * 0.04),
                new THREE.MeshStandardMaterial({
                    color: preset.hairColor, roughness: 0.6
                })
            );
            brow.position.set(side * headR * 0.32, headY + headR * 0.20, faceDepth * 0.95);
            brow.rotation.z = side * -0.08;
            group.add(brow);
        });

        // Nase — eine sanfte Erhebung als Andeutung
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(headR * 0.10, 14, 10),
            skinMat
        );
        nose.position.set(0, headY - headR * 0.10, faceDepth * 1.0);
        nose.scale.set(0.55, 1.3, 0.85);
        group.add(nose);

        // Mund — eine dünne Linie
        const lipColor = isFemale ? 0xa05858 : 0x6b3f30;
        const mouth = new THREE.Mesh(
            new THREE.BoxGeometry(headR * 0.28, headR * 0.04, headR * 0.04),
            new THREE.MeshStandardMaterial({ color: lipColor, roughness: 0.6 })
        );
        mouth.position.set(0, headY - headR * 0.45, faceDepth * 0.95);
        group.add(mouth);
    }

    buildHair(group, dims, hairMat) {
        const preset = dims.preset;
        if (preset.hair === 'none') return;

        const headR = dims.headR;
        const headY = dims.headY;
        const style = preset.hair;

        // Basis: Kappe oben auf dem Kopf
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(headR * 1.05, 28, 20, 0, Math.PI * 2, 0, Math.PI / 1.9),
            hairMat
        );
        cap.scale.set(0.95, 1.15, 1.0);
        cap.position.set(0, headY + headR * 0.05, 0);
        group.add(cap);

        if (style === 'fade') {
            // Sehr kurzer Schnitt — kein extra Volumen
            return;
        }

        if (style === 'short') {
            // Etwas Volumen oben, leichte Seitenpartien
            const top = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.7, 20, 14),
                hairMat
            );
            top.position.set(0, headY + headR * 0.7, headR * 0.1);
            top.scale.set(0.8, 0.5, 0.9);
            group.add(top);
            return;
        }

        if (style === 'bob') {
            // Bob-Schnitt — Haare bis kurz unter Ohr
            const bob = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 1.15, 28, 20),
                hairMat
            );
            bob.scale.set(1.0, 0.95, 1.05);
            bob.position.set(0, headY - headR * 0.05, 0);
            group.add(bob);

            // Pony
            const bangs = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.6, 18, 12),
                hairMat
            );
            bangs.scale.set(1.1, 0.5, 0.6);
            bangs.position.set(0, headY + headR * 0.45, headR * 0.6);
            group.add(bangs);
            return;
        }

        if (style === 'long_straight' || style === 'long_wavy') {
            // Lange Haare — Hauptkappe schon da, jetzt Strähnen nach hinten und Seiten
            const back = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 1.1, 24, 20),
                hairMat
            );
            back.scale.set(1.0, 2.4, 0.9);
            back.position.set(0, headY - headR * 1.5, -headR * 0.25);
            group.add(back);

            // Seitliche Strähnen
            [-1, 1].forEach(side => {
                const strand = new THREE.Mesh(
                    new THREE.CylinderGeometry(headR * 0.18, headR * 0.12, headR * 3.5, 12),
                    hairMat
                );
                strand.position.set(side * headR * 0.65, headY - headR * 1.6, headR * 0.1);
                strand.rotation.z = side * 0.05;
                if (style === 'long_wavy') strand.rotation.x = 0.05;
                group.add(strand);
            });

            // Mittelscheitel
            const part = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.55, 16, 12),
                hairMat
            );
            part.scale.set(0.85, 0.5, 0.8);
            part.position.set(0, headY + headR * 0.45, headR * 0.3);
            group.add(part);
        }
    }

    buildTorso(group, dims, skinMat) {
        const torsoPoints = [
            [dims.neckR * 1.25, dims.shoulderY + 0.06],
            [dims.shoulderHalfWidth * 0.55, dims.shoulderY + 0.03],
            [dims.shoulderHalfWidth * 0.85, dims.shoulderY - 0.03],
            [dims.chestR * 1.02, dims.chestY + 0.05 + dims.bust * 0.5],
            [dims.chestR, dims.chestY - 0.04],
            [(dims.chestR + dims.waistR) / 2 + 0.01, (dims.chestY + dims.waistY) / 2],
            [dims.waistR, dims.waistY],
            [(dims.waistR + dims.hipsR) / 2, (dims.waistY + dims.hipsY) / 2],
            [dims.hipsR, dims.hipsY],
            [dims.hipsR * 0.92, dims.crotchY]
        ];
        const torso = new THREE.Mesh(
            new THREE.LatheGeometry(torsoPoints.map(([x, y]) => new THREE.Vector2(x, y)), 36),
            skinMat
        );
        torso.scale.z = dims.depthScale;
        group.add(torso);

        // Brust (nur weiblich)
        if (dims.bust > 0.01) {
            [-1, 1].forEach(side => {
                const bust = new THREE.Mesh(
                    new THREE.SphereGeometry(dims.bust + 0.025, 20, 16),
                    skinMat
                );
                bust.position.set(
                    side * dims.chestR * 0.42,
                    dims.chestY + 0.045,
                    dims.chestR * dims.depthScale * 0.55
                );
                bust.scale.set(1, 0.95, 0.78);
                group.add(bust);
            });
        }

        // Bauchnabel-Andeutung
        const bellyShadow = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 8, 6),
            new THREE.MeshStandardMaterial({
                color: new THREE.Color(dims.preset.skinTone).multiplyScalar(0.7),
                roughness: 0.9
            })
        );
        bellyShadow.position.set(0, dims.waistY - 0.05, dims.waistR * dims.depthScale + 0.003);
        bellyShadow.scale.set(1, 1.3, 0.4);
        group.add(bellyShadow);

        // Schulterkappen — Deltoid-Form
        [-1, 1].forEach(side => {
            const delt = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 1.65, 20, 16),
                skinMat
            );
            delt.position.set(side * dims.shoulderHalfWidth * 0.92, dims.shoulderY - 0.02, 0);
            delt.scale.set(1.0, 0.95, 1.0);
            group.add(delt);
        });

        // Schlüsselbein-Vertiefung
        [-1, 1].forEach(side => {
            const clav = new THREE.Mesh(
                new THREE.CylinderGeometry(0.008, 0.008, dims.shoulderHalfWidth * 0.55, 8),
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color(dims.preset.skinTone).multiplyScalar(0.92),
                    roughness: 0.85
                })
            );
            clav.position.set(side * dims.shoulderHalfWidth * 0.5, dims.shoulderY + 0.0, dims.chestR * dims.depthScale * 0.55);
            clav.rotation.z = side * -0.4;
            group.add(clav);
        });
    }

    buildArms(group, dims, skinMat) {
        const armLen = this.getMeasurements().arm / 100;
        const armAngle = 0.17;
        const upperLen = armLen * 0.48;
        const lowerLen = armLen * 0.42;
        const handLen = armLen * 0.18;

        [-1, 1].forEach(side => {
            const sx = side * dims.shoulderHalfWidth * 0.92;
            const sy = dims.shoulderY - 0.02;

            // Oberarm (verjüngt)
            const upper = new THREE.Mesh(
                new THREE.CylinderGeometry(dims.armR * 1.1, dims.armR * 0.95, upperLen, 18),
                skinMat
            );
            const upperMidX = sx + side * Math.sin(armAngle) * upperLen / 2;
            const upperMidY = sy - Math.cos(armAngle) * upperLen / 2;
            upper.position.set(upperMidX, upperMidY, 0);
            upper.rotation.z = side * -armAngle;
            group.add(upper);

            // Ellbogen
            const elbowX = sx + side * Math.sin(armAngle) * upperLen;
            const elbowY = sy - Math.cos(armAngle) * upperLen;
            const elbow = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 0.98, 16, 12),
                skinMat
            );
            elbow.position.set(elbowX, elbowY, 0);
            group.add(elbow);

            // Unterarm
            const lower = new THREE.Mesh(
                new THREE.CylinderGeometry(dims.armR * 0.95, dims.armR * 0.78, lowerLen, 18),
                skinMat
            );
            lower.position.set(
                elbowX + side * Math.sin(armAngle) * lowerLen / 2,
                elbowY - Math.cos(armAngle) * lowerLen / 2,
                0
            );
            lower.rotation.z = side * -armAngle;
            group.add(lower);

            // Handgelenk
            const wristX = elbowX + side * Math.sin(armAngle) * lowerLen;
            const wristY = elbowY - Math.cos(armAngle) * lowerLen;
            const wrist = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 0.78, 14, 10),
                skinMat
            );
            wrist.position.set(wristX, wristY, 0);
            group.add(wrist);

            // Hand — Palmenfläche
            const hand = new THREE.Mesh(
                new THREE.BoxGeometry(dims.armR * 1.6, handLen, dims.armR * 0.85),
                skinMat
            );
            hand.position.set(
                wristX + side * Math.sin(armAngle) * handLen / 2,
                wristY - Math.cos(armAngle) * handLen / 2,
                0
            );
            hand.rotation.z = side * -armAngle;
            // Round corners with sphere overlay
            const handRound = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 0.85, 14, 10),
                skinMat
            );
            const handTipX = wristX + side * Math.sin(armAngle) * handLen;
            const handTipY = wristY - Math.cos(armAngle) * handLen;
            handRound.position.set(handTipX, handTipY, 0);
            handRound.scale.set(1.2, 0.5, 0.7);
            group.add(hand);
            group.add(handRound);

            // Daumen
            const thumb = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 0.45, 12, 8),
                skinMat
            );
            thumb.position.set(
                wristX + side * Math.sin(armAngle) * handLen * 0.25,
                wristY - Math.cos(armAngle) * handLen * 0.25,
                side * dims.armR * 0.45
            );
            thumb.scale.set(0.8, 1.4, 0.7);
            group.add(thumb);
        });
    }

    buildLegs(group, dims, skinMat) {
        const inseam = this.getMeasurements().inseam / 100;
        const thighLen = inseam * 0.48;
        const shinLen = inseam * 0.48;
        const legSpacing = dims.hipsR * 0.42;

        [-1, 1].forEach(side => {
            const hx = side * legSpacing;

            // Oberschenkel
            const thigh = new THREE.Mesh(
                new THREE.CylinderGeometry(dims.legR * 1.15, dims.legR * 0.92, thighLen, 20),
                skinMat
            );
            thigh.position.set(hx, dims.crotchY - thighLen / 2, 0);
            group.add(thigh);

            // Knie
            const knee = new THREE.Mesh(
                new THREE.SphereGeometry(dims.legR * 1.0, 16, 12),
                skinMat
            );
            knee.position.set(hx, dims.kneeY + 0.02, 0);
            knee.scale.set(1.05, 0.85, 1.1);
            group.add(knee);

            // Schienbein
            const shin = new THREE.Mesh(
                new THREE.CylinderGeometry(dims.legR * 0.92, dims.legR * 0.62, shinLen, 18),
                skinMat
            );
            shin.position.set(hx, dims.kneeY - shinLen / 2, 0);
            group.add(shin);

            // Fußknöchel
            const ankle = new THREE.Mesh(
                new THREE.SphereGeometry(dims.legR * 0.62, 14, 10),
                skinMat
            );
            ankle.position.set(hx, dims.ankleY + 0.04, 0);
            group.add(ankle);

            // Fuß
            const foot = new THREE.Mesh(
                new THREE.BoxGeometry(dims.legR * 1.4, dims.legR * 0.85, dims.legR * 3.2),
                skinMat
            );
            foot.position.set(hx, dims.ankleY + 0.005, dims.legR * 0.9);
            group.add(foot);

            // Fußspitze (abgerundet)
            const toe = new THREE.Mesh(
                new THREE.SphereGeometry(dims.legR * 0.62, 14, 10),
                skinMat
            );
            toe.position.set(hx, dims.ankleY + 0.005, dims.legR * 2.4);
            toe.scale.set(1.2, 1.1, 1.3);
            group.add(toe);
        });
    }

    /* ============================================================
       GARMENTS — mit Prompt-Features (Pattern, Sleeve, Länge)
       ============================================================ */

    getLengthScale() {
        return {
            cropped: 0.55, mini: 0.6, regular: 1.0,
            midi: 1.25, long: 1.18, maxi: 1.45
        }[this.currentLength] || 1.0;
    }

    buildTshirt(group, material, dims) {
        const ease = this.getEase();
        const lengthScale = this.getLengthScale();
        const topR = dims.shoulderHalfWidth * 1.04;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * (ease * 0.98);
        const hemR = dims.hipsR * (ease * 0.96);
        const hemY = dims.waistY - 0.06 * lengthScale;

        const torsoPts = [
            [topR * 0.78, dims.shoulderY + 0.055],
            [topR, dims.shoulderY + 0.025],
            [chestR * 1.02, dims.chestY + 0.04],
            [chestR, dims.chestY - 0.05],
            [waistR * 1.02, dims.waistY + 0.02],
            [waistR, dims.waistY - 0.05],
            [hemR, hemY],
            [hemR, hemY - 0.025]
        ];
        const torso = new THREE.Mesh(
            new THREE.LatheGeometry(torsoPts.map(([x, y]) => new THREE.Vector2(x, y)), 36),
            material
        );
        torso.scale.z = dims.depthScale * 1.08;
        group.add(torso);

        // Halsblende
        const collar = new THREE.Mesh(
            new THREE.TorusGeometry(dims.neckR * 1.3, 0.014, 8, 32),
            material
        );
        collar.position.set(0, dims.shoulderY + 0.055, 0);
        collar.rotation.x = Math.PI / 2;
        collar.scale.set(1, dims.depthScale * 1.08, 1);
        group.add(collar);

        const sleeve = this.currentSleeve === 'sleeveless' ? null
            : (this.currentSleeve || 'short');
        if (sleeve) this.addSleeve(group, material, dims, sleeve);
    }

    buildHoodie(group, material, dims) {
        const ease = this.getEase() * 1.12;
        const lengthScale = this.getLengthScale();
        const topR = dims.shoulderHalfWidth * 1.14;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * ease;
        const hemR = dims.hipsR * ease * 0.98;
        const hemY = dims.waistY - 0.10 * lengthScale;

        const torsoPts = [
            [topR * 0.88, dims.shoulderY + 0.08],
            [topR, dims.shoulderY + 0.035],
            [chestR * 1.05, dims.chestY + 0.04],
            [chestR, dims.chestY - 0.06],
            [waistR * 1.04, dims.waistY],
            [hemR * 1.05, hemY + 0.04],
            [hemR * 1.08, hemY],
            [hemR * 1.08, hemY - 0.03]
        ];
        const torso = new THREE.Mesh(
            new THREE.LatheGeometry(torsoPts.map(([x, y]) => new THREE.Vector2(x, y)), 36),
            material
        );
        torso.scale.z = dims.depthScale * 1.12;
        group.add(torso);

        // Kapuze
        const hood = new THREE.Mesh(
            new THREE.SphereGeometry(0.20, 28, 20, 0, Math.PI * 2, 0, Math.PI / 1.5),
            material
        );
        const hoodY = this.currentDetails.hasHoodUp ? dims.headY + 0.06 : dims.headY - 0.10;
        const hoodZ = this.currentDetails.hasHoodUp ? -0.02 : -0.07;
        hood.position.set(0, hoodY, hoodZ);
        hood.scale.set(1.1, 1.2, 1.05);
        hood.rotation.x = this.currentDetails.hasHoodUp ? -0.05 : -0.25;
        group.add(hood);

        // Känguru-Tasche
        const pocket = new THREE.Mesh(
            new THREE.BoxGeometry(chestR * 1.5, 0.16, 0.04),
            material
        );
        pocket.position.set(0, dims.waistY - 0.04, chestR * dims.depthScale + 0.012);
        group.add(pocket);

        // Tunnelzug-Kordeln
        [-1, 1].forEach(side => {
            const cord = new THREE.Mesh(
                new THREE.CylinderGeometry(0.005, 0.005, 0.20),
                new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 })
            );
            cord.position.set(side * 0.05, dims.shoulderY - 0.08, dims.neckR * dims.depthScale + 0.02);
            group.add(cord);
        });

        const sleeve = this.currentSleeve === 'sleeveless' ? null
            : (this.currentSleeve || 'long');
        if (sleeve) this.addSleeve(group, material, dims, sleeve);
    }

    buildShirt(group, material, dims) {
        const ease = this.getEase() * 0.95;
        const lengthScale = this.getLengthScale();
        const topR = dims.shoulderHalfWidth * 1.04;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * (ease * 0.95);
        const hemR = dims.hipsR * (ease * 0.94);
        const hemY = dims.waistY - 0.12 * lengthScale;

        const halfPts = [
            [topR * 0.8, dims.shoulderY + 0.045],
            [topR, dims.shoulderY + 0.02],
            [chestR * 1.02, dims.chestY + 0.045],
            [chestR, dims.chestY - 0.06],
            [waistR * 1.02, dims.waistY],
            [hemR, hemY + 0.02],
            [hemR, hemY]
        ];
        const pts = halfPts.map(([x, y]) => new THREE.Vector2(x, y));

        const h1 = new THREE.Mesh(new THREE.LatheGeometry(pts, 32, 0, Math.PI), material);
        h1.rotation.y = -Math.PI / 2;
        h1.scale.z = dims.depthScale;
        group.add(h1);

        const h2 = new THREE.Mesh(new THREE.LatheGeometry(pts, 32, Math.PI, Math.PI), material);
        h2.rotation.y = -Math.PI / 2;
        h2.scale.z = dims.depthScale;
        group.add(h2);

        // Kragen
        const collar = new THREE.Mesh(
            new THREE.TorusGeometry(dims.neckR * 1.5, 0.025, 8, 24, Math.PI * 1.6),
            material
        );
        collar.position.set(0, dims.shoulderY + 0.05, 0);
        collar.rotation.x = Math.PI / 2;
        collar.rotation.z = Math.PI / 2;
        collar.scale.z = dims.depthScale;
        group.add(collar);

        // Knöpfe
        const btnMat = new THREE.MeshStandardMaterial({
            color: 0xfafafa, roughness: 0.3, metalness: 0.2
        });
        const btnStart = dims.shoulderY - 0.04;
        const btnEnd = hemY + 0.02;
        const btnCount = 7;
        for (let i = 0; i < btnCount; i++) {
            const t = i / (btnCount - 1);
            const y = btnStart - (btnStart - btnEnd) * t;
            const yT = (y - hemY) / (dims.shoulderY + 0.045 - hemY);
            const rAtY = waistR + (chestR - waistR) * Math.min(1, Math.max(0, yT));
            const btn = new THREE.Mesh(
                new THREE.CylinderGeometry(0.011, 0.011, 0.004, 14),
                btnMat
            );
            btn.rotation.x = Math.PI / 2;
            btn.position.set(0, y, rAtY * dims.depthScale + 0.006);
            group.add(btn);
        }

        const sleeve = this.currentSleeve === 'sleeveless' ? null
            : (this.currentSleeve || 'long');
        if (sleeve) this.addSleeve(group, material, dims, sleeve);
    }

    buildPants(group, material, dims) {
        const ease = 1.0 + this.currentFit * 0.5;
        const lengthScale = this.currentLength === 'cropped' ? 0.65 : 1.0;
        const waistR = dims.waistR * (ease * 0.95);
        const hipsR = dims.hipsR * ease;
        const thighR = dims.legR * (1.45 + this.currentFit * 0.65);
        const kneeR = dims.legR * (1.25 + this.currentFit * 0.55);
        const ankleR = dims.legR * (0.85 + this.currentFit * 0.75);

        const waistTop = dims.hipsY + 0.10;
        const hipsY = dims.hipsY;
        const crotchY = dims.crotchY;
        const kneeY = dims.kneeY;
        const ankleY = dims.ankleY + 0.02 + (1 - lengthScale) * 0.4;

        const waistGeo = new THREE.LatheGeometry(
            [[waistR * 0.97, waistTop + 0.02], [waistR, waistTop],
             [waistR * 1.02, (waistTop + hipsY) / 2], [hipsR, hipsY],
             [hipsR * 0.95, crotchY + 0.02]
            ].map(([x, y]) => new THREE.Vector2(x, y)),
            24
        );
        const waist = new THREE.Mesh(waistGeo, material);
        waist.scale.z = dims.depthScale;
        group.add(waist);

        const legSpacing = dims.hipsR * 0.42;
        [-1, 1].forEach(side => {
            const legPts = [
                [thighR, crotchY],
                [thighR * 0.95, (crotchY + kneeY) / 2 + 0.05],
                [kneeR, kneeY],
                [kneeR * 0.96, (kneeY + ankleY) * 0.55],
                [ankleR * 1.05, ankleY + 0.04],
                [ankleR, ankleY]
            ].map(([x, y]) => new THREE.Vector2(x, y));
            const leg = new THREE.Mesh(new THREE.LatheGeometry(legPts, 18), material);
            leg.position.x = side * legSpacing;
            leg.scale.z = dims.depthScale * 1.1;
            group.add(leg);
        });

        // Bund
        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(waistR * 1.005, 0.018, 8, 28),
            material
        );
        belt.position.y = waistTop;
        belt.rotation.x = Math.PI / 2;
        belt.scale.z = dims.depthScale;
        group.add(belt);

        // Reissverschluss (sichtbar wenn Detail aktiv)
        if (this.currentDetails.hasZipper !== false) {
            const zip = new THREE.Mesh(
                new THREE.BoxGeometry(0.015, 0.10, 0.002),
                new THREE.MeshStandardMaterial({ color: 0xa8a8a8, roughness: 0.3, metalness: 0.8 })
            );
            zip.position.set(0, (waistTop + crotchY) / 2, hipsR * dims.depthScale + 0.005);
            group.add(zip);
        }
    }

    buildJacket(group, material, dims) {
        const ease = this.getEase() * 1.08;
        const lengthScale = this.getLengthScale();
        const topR = dims.shoulderHalfWidth * 1.14;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * ease;
        const hemR = dims.hipsR * ease;
        const hemY = dims.waistY - 0.09 * lengthScale;

        const halfPts = [
            [topR * 0.9, dims.shoulderY + 0.07],
            [topR, dims.shoulderY + 0.04],
            [chestR * 1.06, dims.chestY + 0.04],
            [chestR, dims.chestY - 0.05],
            [waistR, dims.waistY],
            [hemR, hemY + 0.03],
            [hemR * 1.02, hemY]
        ].map(([x, y]) => new THREE.Vector2(x, y));

        const h1 = new THREE.Mesh(new THREE.LatheGeometry(halfPts, 32, 0, Math.PI), material);
        h1.rotation.y = -Math.PI / 2;
        h1.scale.z = dims.depthScale;
        group.add(h1);

        const h2 = new THREE.Mesh(new THREE.LatheGeometry(halfPts, 32, Math.PI, Math.PI), material);
        h2.rotation.y = -Math.PI / 2;
        h2.scale.z = dims.depthScale;
        group.add(h2);

        // Revers
        [-1, 1].forEach(side => {
            const lapel = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.35), material);
            lapel.position.set(side * 0.05, dims.chestY + 0.05, chestR * dims.depthScale + 0.006);
            lapel.rotation.y = side * 0.18;
            lapel.rotation.x = -0.1;
            group.add(lapel);
        });

        // Knöpfe
        const btnMat = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a, roughness: 0.3, metalness: 0.5
        });
        for (let i = 0; i < 3; i++) {
            const btn = new THREE.Mesh(
                new THREE.CylinderGeometry(0.014, 0.014, 0.005, 14),
                btnMat
            );
            btn.rotation.x = Math.PI / 2;
            btn.position.set(0, dims.chestY - 0.05 - i * 0.13, chestR * dims.depthScale + 0.01);
            group.add(btn);
        }

        const sleeve = this.currentSleeve === 'sleeveless' ? null
            : (this.currentSleeve || 'long');
        if (sleeve) this.addSleeve(group, material, dims, sleeve);
    }

    buildDress(group, material, dims) {
        const ease = this.getEase() * 0.92;
        const lengthScale = {
            mini: 0.7, midi: 1.2, maxi: 1.85, long: 1.7
        }[this.currentLength] || 1.4;
        const topR = dims.shoulderHalfWidth * 0.85;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * (ease * 0.92);
        const hipsR = dims.hipsR * ease;
        const hemR = dims.hipsR * (1.7 + this.currentFit * 0.6);
        const hemY = dims.hipsY - 0.35 * lengthScale;

        const dressPts = [
            [topR * 0.7, dims.shoulderY + 0.02],
            [topR * 0.85, dims.shoulderY],
            [chestR * 1.05, dims.chestY + 0.04 + dims.bust],
            [chestR, dims.chestY - 0.05],
            [waistR, dims.waistY],
            [hipsR * 1.0, dims.hipsY],
            [(hipsR + hemR) / 2, (dims.hipsY + hemY) / 2 + 0.1],
            [hemR * 0.92, hemY + 0.04],
            [hemR, hemY]
        ].map(([x, y]) => new THREE.Vector2(x, y));

        const dress = new THREE.Mesh(new THREE.LatheGeometry(dressPts, 40), material);
        dress.scale.z = Math.max(dims.depthScale, 0.85);
        group.add(dress);

        // Träger oder Ärmel
        const sleeve = this.currentSleeve;
        if (sleeve && sleeve !== 'sleeveless') {
            this.addSleeve(group, material, dims, sleeve);
        }
    }

    addSleeve(group, material, dims, length) {
        const ease = this.getEase();
        const armLen = this.getMeasurements().arm / 100;
        const lenFactor = {
            short: 0.32, three_quarter: 0.70, long: 0.95
        }[length] || 0.32;
        const sleeveLen = armLen * lenFactor;

        const upperR = dims.armR * (ease * 1.20);
        const midR = dims.armR * (ease * 1.05);
        const cuffR = length === 'long' ? dims.armR * (ease * 0.90)
                    : length === 'three_quarter' ? dims.armR * (ease * 1.00)
                    : dims.armR * (ease * 1.18);
        const armAngle = 0.17;

        [-1, 1].forEach(side => {
            const sleevePts = [
                [upperR * 1.15, 0],
                [upperR, sleeveLen * 0.18],
                [midR, sleeveLen * 0.55],
                [cuffR * 1.02, sleeveLen * 0.95],
                [cuffR, sleeveLen]
            ].map(([x, y]) => new THREE.Vector2(x, y));
            const sleeve = new THREE.Mesh(
                new THREE.LatheGeometry(sleevePts, 18),
                material
            );
            sleeve.position.set(side * dims.shoulderHalfWidth * 0.92, dims.shoulderY - 0.02, 0);
            sleeve.rotation.z = side * (Math.PI / 2 - armAngle);
            group.add(sleeve);

            // Bündchen
            if (length === 'long') {
                const cuff = new THREE.Mesh(
                    new THREE.TorusGeometry(cuffR * 1.08, 0.012, 6, 20),
                    material
                );
                const tipX = side * (dims.shoulderHalfWidth * 0.92 + Math.sin(armAngle) * sleeveLen);
                const tipY = dims.shoulderY - 0.02 - Math.cos(armAngle) * sleeveLen;
                cuff.position.set(tipX, tipY, 0);
                cuff.rotation.y = Math.PI / 2;
                cuff.rotation.x = side * (Math.PI / 2 - armAngle);
                group.add(cuff);
            }
        });
    }

    addGraphicDecal(group, dims) {
        if (!this.currentGraphic) return;
        const fgHex = '#' + this.currentSecondary.toString(16).padStart(6, '0');
        const tex = generateGraphicTexture(this.currentGraphic, fgHex);

        const decalMat = new THREE.MeshStandardMaterial({
            map: tex, transparent: true, alphaTest: 0.05,
            roughness: 0.7
        });
        const decal = new THREE.Mesh(
            new THREE.PlaneGeometry(0.16, 0.10),
            decalMat
        );
        decal.position.set(0, dims.chestY - 0.04, dims.chestR * dims.depthScale * this.getEase() + 0.003);
        group.add(decal);
        this.graphicMesh = decal;
    }

    /* ---------------- Measurement Labels ---------------- */

    updateMeasurementLabels() {
        this.measurementLabels.forEach(l => this.scene.remove(l));
        this.measurementLabels = [];
        if (!this.showMeasurements || !this.measurements) return;
        const dims = this.getBodyDimensions();
        const m = this.measurements;
        const labels = [
            { text: `${m.chest}cm`,    pos: [dims.chestR * 1.8, dims.chestY, 0], color: 0xec4899 },
            { text: `${m.waist}cm`,    pos: [dims.waistR * 2.0, dims.waistY, 0], color: 0x8b5cf6 },
            { text: `${m.hips}cm`,     pos: [dims.hipsR * 1.9,  dims.hipsY, 0],  color: 0x06b6d4 },
            { text: `${m.shoulder}cm`, pos: [0, dims.shoulderY + 0.14, 0],       color: 0xec4899 }
        ];
        labels.forEach(({ text, pos, color }) => {
            const s = this.createTextSprite(text, color);
            s.position.set(...pos);
            this.scene.add(s);
            this.measurementLabels.push(s);
        });
    }

    createTextSprite(text, color) {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = `#${color.toString(16).padStart(6,'0')}`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 254, 62);
        ctx.fillStyle = `#${color.toString(16).padStart(6,'0')}`;
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);
        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(0.32, 0.08, 1);
        return sp;
    }

    /* ---------------- Setters ---------------- */

    setType(t)              { this.currentType = t; this.buildGarment(); }
    setColor(hex)           { this.currentColor = parseInt(hex.replace('#',''), 16); this.buildGarment(); }
    setSecondaryColor(hex)  { this.currentSecondary = parseInt(hex.replace('#',''), 16); this.buildGarment(); }
    setMaterial(m)          { this.currentMaterial = m; this.buildGarment(); }
    setFit(f)               { this.currentFit = f; this.buildGarment(); }
    setMeasurements(m)      { this.measurements = m; this.buildGarment(); }
    setAvatar(k)            { if (AVATAR_PRESETS[k]) { this.currentAvatar = k; this.buildGarment(); } }
    setPattern(p)           { this.currentPattern = p; this.buildGarment(); }
    setGraphic(g)           { this.currentGraphic = g; this.buildGarment(); }
    setSleeve(s)            { this.currentSleeve = s; this.buildGarment(); }
    setLength(l)            { this.currentLength = l; this.buildGarment(); }
    setDetails(d)           { this.currentDetails = d || {}; this.buildGarment(); }
    setShowAvatar(s)        { this.showAvatar = s; this.buildGarment(); }
    setShowMeasurements(s)  { this.showMeasurements = s; this.updateMeasurementLabels(); }
    setWireframe(w)         { this.wireframe = w; this.buildGarment(); }

    /** Wendet ein komplettes Design-Objekt aus AI.generateDesign() an. */
    applyDesign(design) {
        if (!design) return;
        if (design.color)         this.currentColor    = parseInt(design.color.replace('#',''), 16);
        if (design.secondaryColor)this.currentSecondary= parseInt(design.secondaryColor.replace('#',''), 16);
        if (design.material)      this.currentMaterial = design.material;
        if (design.fit !== undefined) this.currentFit  = design.fit;
        if (design.type)          this.currentType     = design.type;
        if (design.pattern)       this.currentPattern  = design.pattern;
        this.currentGraphic = design.graphicText || null;
        this.currentSleeve  = design.sleeve || null;
        this.currentLength  = design.length || 'regular';
        this.currentDetails = design.details || {};
        this.buildGarment();
    }

    setView(view) {
        const tween = (target) => {
            const s = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
            const t0 = Date.now();
            const dur = 700;
            const step = () => {
                const t = Math.min((Date.now() - t0) / dur, 1);
                const e = 1 - Math.pow(1 - t, 3);
                this.camera.position.x = s.x + (target.x - s.x) * e;
                this.camera.position.y = s.y + (target.y - s.y) * e;
                this.camera.position.z = s.z + (target.z - s.z) * e;
                if (t < 1) requestAnimationFrame(step);
            };
            step();
        };
        this.autoRotate = false;
        switch (view) {
            case 'front':  tween({ x: 0,   y: 1.2, z: 4.2 }); break;
            case 'back':   tween({ x: 0,   y: 1.2, z: -4.2 }); break;
            case 'side':   tween({ x: 4.2, y: 1.2, z: 0 }); break;
            case 'rotate': this.autoRotate = true; break;
        }
    }

    onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        if (this.autoRotate) {
            if (this.garmentMesh) this.garmentMesh.rotation.y += 0.008;
            if (this.avatarMesh)  this.avatarMesh.rotation.y  += 0.008;
            this.measurementLabels.forEach(l => {
                const r = Math.sqrt(l.position.x ** 2 + l.position.z ** 2);
                const a = Math.atan2(l.position.z, l.position.x) + 0.008;
                l.position.x = r * Math.cos(a);
                l.position.z = r * Math.sin(a);
            });
        }
        this.renderer.render(this.scene, this.camera);
    }
}

window.GarmentScene = GarmentScene;
window.AVATAR_PRESETS = AVATAR_PRESETS;

window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('three-canvas');
    if (container) {
        const scene = new GarmentScene(container);
        scene.buildGarment();
        window.garmentScene = scene;
        window.dispatchEvent(new Event('garment-scene-ready'));
    }
});
