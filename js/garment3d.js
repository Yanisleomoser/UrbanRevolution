import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
   AVATAR PRESETS — 4 männlich + 4 weiblich + 1 neutral
   ============================================================ */

const AVATAR_PRESETS = {
    male_s: {
        label: 'Männlich · S', gender: 'male', size: 'S',
        skinTone: 0xe6c4a1, hairColor: 0x3a2010, hair: 'short',
        shoulderMod: 0.92, chestMod: 0.90, waistMod: 0.85, hipsMod: 0.92,
        muscleMod: 0.82, bust: 0,
        defaults: { height: 172, chest: 88, waist: 74, hips: 90, shoulder: 41, arm: 60, inseam: 80, neck: 36 }
    },
    male_m: {
        label: 'Männlich · M', gender: 'male', size: 'M',
        skinTone: 0xd4a37a, hairColor: 0x1a1108, hair: 'short',
        shoulderMod: 1.0, chestMod: 1.0, waistMod: 0.98, hipsMod: 0.95,
        muscleMod: 1.0, bust: 0,
        defaults: { height: 178, chest: 98, waist: 84, hips: 98, shoulder: 45, arm: 63, inseam: 84, neck: 38 }
    },
    male_l: {
        label: 'Männlich · L', gender: 'male', size: 'L',
        skinTone: 0xc89878, hairColor: 0x2a1810, hair: 'fade',
        shoulderMod: 1.10, chestMod: 1.08, waistMod: 0.96, hipsMod: 0.97,
        muscleMod: 1.18, bust: 0,
        defaults: { height: 184, chest: 106, waist: 90, hips: 104, shoulder: 48, arm: 66, inseam: 88, neck: 40 }
    },
    male_xl: {
        label: 'Männlich · XL', gender: 'male', size: 'XL',
        skinTone: 0x8b5a3c, hairColor: 0x0d0805, hair: 'short',
        shoulderMod: 1.15, chestMod: 1.18, waistMod: 1.15, hipsMod: 1.10,
        muscleMod: 1.15, bust: 0,
        defaults: { height: 186, chest: 116, waist: 102, hips: 112, shoulder: 50, arm: 68, inseam: 88, neck: 42 }
    },
    female_s: {
        label: 'Weiblich · S', gender: 'female', size: 'S',
        skinTone: 0xf2d4b8, hairColor: 0x5a2c10, hair: 'long_wavy',
        shoulderMod: 0.82, chestMod: 0.85, waistMod: 0.80, hipsMod: 0.95,
        muscleMod: 0.80, bust: 0.030,
        defaults: { height: 162, chest: 84, waist: 66, hips: 90, shoulder: 38, arm: 56, inseam: 76, neck: 33 }
    },
    female_m: {
        label: 'Weiblich · M', gender: 'female', size: 'M',
        skinTone: 0xe6c4a1, hairColor: 0x3a2010, hair: 'bob',
        shoulderMod: 0.88, chestMod: 0.92, waistMod: 0.85, hipsMod: 1.05,
        muscleMod: 0.86, bust: 0.038,
        defaults: { height: 168, chest: 92, waist: 72, hips: 98, shoulder: 40, arm: 58, inseam: 78, neck: 35 }
    },
    female_l: {
        label: 'Weiblich · L', gender: 'female', size: 'L',
        skinTone: 0xa07556, hairColor: 0x0d0805, hair: 'long_straight',
        shoulderMod: 0.93, chestMod: 1.0, waistMod: 0.92, hipsMod: 1.12,
        muscleMod: 0.92, bust: 0.045,
        defaults: { height: 172, chest: 100, waist: 80, hips: 108, shoulder: 42, arm: 60, inseam: 80, neck: 36 }
    },
    female_xl: {
        label: 'Weiblich · XL', gender: 'female', size: 'XL',
        skinTone: 0xd4a37a, hairColor: 0x2a1810, hair: 'long_wavy',
        shoulderMod: 0.98, chestMod: 1.10, waistMod: 1.05, hipsMod: 1.18,
        muscleMod: 0.95, bust: 0.05,
        defaults: { height: 174, chest: 110, waist: 92, hips: 118, shoulder: 43, arm: 61, inseam: 80, neck: 37 }
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
        this.currentAvatar = 'male_m';
        this.currentPattern = 'solid';
        this.currentGraphic = null;
        this.currentSleeve = null;
        this.currentLength = 'regular';
        this.currentDetails = {};

        this.showAvatar = true;
        this.showMeasurements = false;
        this.wireframe = false;
        this.measurements = null;

        this.initRenderer();
        this.initCamera();
        this.initLights();
        this.initControls();
        this.initFloor();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
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

        if (this.showAvatar) {
            this.avatarMesh = this.buildAvatar(dims);
            this.avatarMesh.scale.y = dims.heightScale;
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
        const group = new THREE.Group();
        group.name = 'avatar';
        const preset = dims.preset;
        const m = this.getMeasurements();

        const skinMat = new THREE.MeshStandardMaterial({
            color: preset.skinTone, roughness: 0.72, metalness: 0.02
        });
        const hairMat = new THREE.MeshStandardMaterial({
            color: preset.hairColor, roughness: 0.55, metalness: 0.0
        });

        this.buildHead(group, dims, skinMat, hairMat);
        this.buildTorso(group, dims, skinMat);
        this.buildArms(group, dims, skinMat);
        this.buildLegs(group, dims, skinMat);

        group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        return group;
    }

    buildHead(group, dims, skinMat, hairMat) {
        const headR = dims.headR;
        const headY = dims.headY;
        const preset = dims.preset;

        // Skull — eiförmig
        const skull = new THREE.Mesh(
            new THREE.SphereGeometry(headR, 36, 28),
            skinMat
        );
        skull.scale.set(0.92, 1.12, 0.95);
        skull.position.set(0, headY, 0);
        group.add(skull);

        // Hals
        const neckHeight = headY - 0.11 - dims.neckY + 0.02;
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(dims.neckR * 0.85, dims.neckR * 1.1, neckHeight, 20),
            skinMat
        );
        neck.position.y = (headY - 0.11 + dims.neckY) / 2;
        group.add(neck);

        // Trapezius / Schulter-Übergang
        const trap = new THREE.Mesh(
            new THREE.SphereGeometry(dims.shoulderHalfWidth * 0.7, 20, 12),
            skinMat
        );
        trap.scale.set(1.0, 0.4, 0.7);
        trap.position.set(0, dims.shoulderY + 0.02, 0);
        group.add(trap);

        // === Gesichtszüge ===
        this.buildFace(group, dims, skinMat, hairMat);

        // === Haare ===
        this.buildHair(group, dims, hairMat);

        // Ohren
        [-1, 1].forEach(side => {
            const ear = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.18, 14, 12),
                skinMat
            );
            ear.scale.set(0.35, 1.0, 0.7);
            ear.position.set(side * headR * 0.86, headY + 0.0, 0);
            group.add(ear);
            const earInner = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.07, 10, 8),
                new THREE.MeshStandardMaterial({ color: preset.skinTone, roughness: 0.85 })
            );
            earInner.scale.set(0.25, 0.8, 0.5);
            earInner.position.set(side * headR * 0.91, headY, 0);
            group.add(earInner);
        });
    }

    buildFace(group, dims, skinMat, hairMat) {
        const headR = dims.headR;
        const headY = dims.headY;
        const preset = dims.preset;
        const faceDepth = headR * 0.92;
        const isFemale = preset.gender === 'female';

        // Augenpartie — schwach eingezogen für Realismus
        const eyeWhiteMat = new THREE.MeshStandardMaterial({
            color: 0xfaf5e8, roughness: 0.25, metalness: 0.05
        });
        const irisColor = isFemale ? 0x4a6b3a : 0x3a2010;
        const irisMat = new THREE.MeshStandardMaterial({
            color: irisColor, roughness: 0.15, metalness: 0.2
        });
        const pupilMat = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a, roughness: 0.1
        });

        [-1, 1].forEach(side => {
            // Augenhöhle (leicht dunkler)
            const socketMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(preset.skinTone).multiplyScalar(0.88),
                roughness: 0.8
            });
            const socket = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.16, 16, 12),
                socketMat
            );
            socket.position.set(side * headR * 0.38, headY + headR * 0.10, faceDepth * 0.88);
            socket.scale.set(1.0, 0.6, 0.3);
            group.add(socket);

            // Augapfel weiß
            const eyeWhite = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.13, 18, 14),
                eyeWhiteMat
            );
            eyeWhite.position.set(side * headR * 0.38, headY + headR * 0.10, faceDepth * 0.93);
            eyeWhite.scale.set(1, 0.7, 0.6);
            group.add(eyeWhite);

            // Iris
            const iris = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.06, 14, 10),
                irisMat
            );
            iris.position.set(side * headR * 0.38, headY + headR * 0.10, faceDepth * 1.00);
            iris.scale.z = 0.7;
            group.add(iris);

            // Pupille
            const pupil = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.025, 10, 8),
                pupilMat
            );
            pupil.position.set(side * headR * 0.38, headY + headR * 0.10, faceDepth * 1.02);
            group.add(pupil);

            // Oberes Augenlid (subtle)
            const lid = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                skinMat
            );
            lid.position.set(side * headR * 0.38, headY + headR * 0.15, faceDepth * 0.92);
            lid.scale.set(1, 0.45, 0.55);
            lid.rotation.x = -0.05;
            group.add(lid);

            // Augenbraue
            const brow = new THREE.Mesh(
                new THREE.BoxGeometry(headR * 0.32, headR * 0.04, headR * 0.06),
                hairMat
            );
            brow.position.set(side * headR * 0.38, headY + headR * 0.30, faceDepth * 0.94);
            brow.rotation.z = side * -0.08;
            brow.rotation.x = -0.2;
            group.add(brow);
        });

        // Nase — drei Komponenten für mehr Tiefe
        const noseTop = new THREE.Mesh(
            new THREE.SphereGeometry(headR * 0.08, 14, 10),
            skinMat
        );
        noseTop.position.set(0, headY + headR * 0.15, faceDepth * 0.95);
        noseTop.scale.set(0.55, 1.3, 0.7);
        group.add(noseTop);

        const noseBridge = new THREE.Mesh(
            new THREE.SphereGeometry(headR * 0.07, 12, 10),
            skinMat
        );
        noseBridge.position.set(0, headY - headR * 0.05, faceDepth * 1.02);
        noseBridge.scale.set(0.7, 1.6, 1.0);
        group.add(noseBridge);

        const noseTip = new THREE.Mesh(
            new THREE.SphereGeometry(headR * 0.075, 14, 10),
            skinMat
        );
        noseTip.position.set(0, headY - headR * 0.20, faceDepth * 1.05);
        noseTip.scale.set(1.0, 0.85, 0.95);
        group.add(noseTip);

        // Nasenflügel
        [-1, 1].forEach(side => {
            const nostril = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.04, 10, 8),
                skinMat
            );
            nostril.position.set(side * headR * 0.07, headY - headR * 0.22, faceDepth * 1.00);
            nostril.scale.set(0.9, 0.7, 0.8);
            group.add(nostril);
        });

        // Mund — Oberlippe + Unterlippe
        const lipColor = isFemale ? 0xc66b6b : 0x7a4838;
        const lipMat = new THREE.MeshStandardMaterial({
            color: lipColor, roughness: 0.55, metalness: 0.05
        });

        const upperLip = new THREE.Mesh(
            new THREE.SphereGeometry(headR * 0.16, 18, 10),
            lipMat
        );
        upperLip.position.set(0, headY - headR * 0.45, faceDepth * 0.88);
        upperLip.scale.set(0.9, 0.20, 0.3);
        group.add(upperLip);

        const lowerLip = new THREE.Mesh(
            new THREE.SphereGeometry(headR * 0.16, 18, 10),
            lipMat
        );
        lowerLip.position.set(0, headY - headR * 0.52, faceDepth * 0.88);
        lowerLip.scale.set(0.85, 0.25, 0.32);
        group.add(lowerLip);

        // Kinn — leichte Wölbung
        const chin = new THREE.Mesh(
            new THREE.SphereGeometry(headR * 0.3, 18, 14),
            skinMat
        );
        chin.position.set(0, headY - headR * 0.78, faceDepth * 0.55);
        chin.scale.set(0.95, 0.55, 0.7);
        group.add(chin);

        // Wangenknochen
        [-1, 1].forEach(side => {
            const cheek = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 0.16, 14, 12),
                skinMat
            );
            cheek.position.set(side * headR * 0.55, headY - headR * 0.12, faceDepth * 0.65);
            cheek.scale.set(0.7, 0.85, 0.55);
            group.add(cheek);
        });

        // Wimpern (subtil, nur weiblich)
        if (isFemale) {
            [-1, 1].forEach(side => {
                const lash = new THREE.Mesh(
                    new THREE.BoxGeometry(headR * 0.20, headR * 0.012, headR * 0.02),
                    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 })
                );
                lash.position.set(side * headR * 0.38, headY + headR * 0.20, faceDepth * 1.02);
                lash.rotation.z = side * -0.1;
                group.add(lash);
            });
        }
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
        const topR = dims.shoulderHalfWidth * 1.02;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * (ease * 0.96);
        const hemR = dims.hipsR * (ease * 0.92);
        const hemY = dims.waistY - 0.20 * lengthScale;

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
        const ease = this.getEase() * 1.16;
        const lengthScale = this.getLengthScale();
        const topR = dims.shoulderHalfWidth * 1.18;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * ease;
        const hemR = dims.hipsR * ease;
        const hemY = dims.waistY - 0.26 * lengthScale;

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
        const ease = this.getEase() * 0.96;
        const lengthScale = this.getLengthScale();
        const topR = dims.shoulderHalfWidth * 1.04;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * (ease * 0.95);
        const hemR = dims.hipsR * (ease * 0.92);
        const hemY = dims.waistY - 0.28 * lengthScale;

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
        const ease = this.getEase() * 1.10;
        const lengthScale = this.getLengthScale();
        const topR = dims.shoulderHalfWidth * 1.16;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * ease;
        const hemR = dims.hipsR * ease;
        const hemY = dims.waistY - 0.22 * lengthScale;

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
