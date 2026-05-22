import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const AVATAR_PRESETS = {
    athletic_m: {
        label: 'Athletisch',
        sublabel: 'Männlich',
        skinTone: 0xc89878,
        hairColor: 0x2a1810,
        chestMod: 1.08,
        waistMod: 0.92,
        hipsMod: 0.95,
        shoulderMod: 1.08,
        muscleMod: 1.15,
        bust: 0
    },
    slim_m: {
        label: 'Schlank',
        sublabel: 'Männlich',
        skinTone: 0xe8c9a8,
        hairColor: 0x4a2c1a,
        chestMod: 0.95,
        waistMod: 0.88,
        hipsMod: 0.92,
        shoulderMod: 0.96,
        muscleMod: 0.85,
        bust: 0
    },
    average_m: {
        label: 'Durchschnitt',
        sublabel: 'Männlich',
        skinTone: 0xd4a37a,
        hairColor: 0x1a1108,
        chestMod: 1.0,
        waistMod: 1.0,
        hipsMod: 0.96,
        shoulderMod: 1.0,
        muscleMod: 1.0,
        bust: 0
    },
    average_f: {
        label: 'Durchschnitt',
        sublabel: 'Weiblich',
        skinTone: 0xe6c4a1,
        hairColor: 0x3a2010,
        chestMod: 0.92,
        waistMod: 0.85,
        hipsMod: 1.05,
        shoulderMod: 0.88,
        muscleMod: 0.85,
        bust: 0.04
    },
    curvy_f: {
        label: 'Kurvig',
        sublabel: 'Weiblich',
        skinTone: 0xa07556,
        hairColor: 0x0d0805,
        chestMod: 1.0,
        waistMod: 0.92,
        hipsMod: 1.15,
        shoulderMod: 0.92,
        muscleMod: 0.92,
        bust: 0.05
    },
    mannequin: {
        label: 'Mannequin',
        sublabel: 'Neutral',
        skinTone: 0xebe5dc,
        hairColor: 0xebe5dc,
        chestMod: 1.0,
        waistMod: 1.0,
        hipsMod: 1.0,
        shoulderMod: 1.0,
        muscleMod: 1.0,
        bust: 0
    }
};

class GarmentScene {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.garmentMesh = null;
        this.avatarMesh = null;
        this.measurementLabels = [];
        this.currentType = 'tshirt';
        this.currentColor = 0x1a1a1a;
        this.currentMaterial = 'cotton';
        this.currentFit = 0.5;
        this.currentAvatar = 'average_m';
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
        this.camera.position.set(0, 1.3, 4.2);
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambient);

        const key = new THREE.DirectionalLight(0xfff5e8, 1.4);
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

        const fill = new THREE.DirectionalLight(0xec4899, 0.35);
        fill.position.set(-4, 2, 2);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0x8b5cf6, 0.55);
        rim.position.set(0, 3, -4);
        this.scene.add(rim);
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1.1, 0);
        this.controls.minDistance = 2;
        this.controls.maxDistance = 8;
        this.controls.minPolarAngle = Math.PI / 6;
        this.controls.maxPolarAngle = Math.PI - Math.PI / 6;
        this.autoRotate = false;
    }

    initFloor() {
        const floorGeo = new THREE.CircleGeometry(3, 64);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x111114,
            roughness: 0.7,
            metalness: 0.1,
            transparent: true,
            opacity: 0.5
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const grid = new THREE.GridHelper(6, 24, 0x222227, 0x16161a);
        grid.position.y = 0.001;
        this.scene.add(grid);
    }

    /** Wandelt Umfang (cm) in Lathe-Radius (Meter) für eine elliptische Kontur. */
    circToRadius(circCm, sidewaysScale = 1.0) {
        const r = circCm / (2 * Math.PI * 100);
        return r * sidewaysScale;
    }

    getMaterialProps(materialType) {
        const props = {
            cotton:    { roughness: 0.85, metalness: 0.0 },
            linen:     { roughness: 0.95, metalness: 0.0 },
            denim:     { roughness: 0.75, metalness: 0.05 },
            wool:      { roughness: 0.90, metalness: 0.0 },
            fleece:    { roughness: 0.95, metalness: 0.0 },
            silk:      { roughness: 0.25, metalness: 0.15 },
            polyester: { roughness: 0.55, metalness: 0.10 }
        };
        return props[materialType] || props.cotton;
    }

    getMeasurements() {
        return this.measurements || {
            height: 175, weight: 70, chest: 96, waist: 82, hips: 98,
            shoulder: 44, arm: 62, inseam: 82, neck: 38
        };
    }

    getBodyDimensions() {
        const m = this.getMeasurements();
        const preset = AVATAR_PRESETS[this.currentAvatar];
        const sideScale = 1.0;
        const depthScale = 0.68;

        return {
            // Längen
            heightScale: m.height / 175,
            chestY: 1.42,
            shoulderY: 1.62,
            waistY: 1.10,
            hipsY: 0.92,
            kneeY: 0.50,
            ankleY: 0.04,
            crotchY: 0.85,
            headY: 1.78,
            neckY: 1.66,
            // Radii (X-Richtung, Y-Achsen-Lathes)
            shoulderHalfWidth: (m.shoulder / 2 / 100) * preset.shoulderMod,
            chestR: this.circToRadius(m.chest * preset.chestMod),
            waistR: this.circToRadius(m.waist * preset.waistMod),
            hipsR: this.circToRadius(m.hips * preset.hipsMod),
            neckR: this.circToRadius(m.neck),
            armR: 0.042 * preset.muscleMod,
            legR: 0.078 * preset.muscleMod,
            ankleR: 0.045,
            // Skalierung für elliptische Körperform (X = side, Z = depth)
            sideScale,
            depthScale,
            // Bust
            bust: preset.bust,
            preset
        };
    }

    /** Berechnet die Mehrweite (Ease) für Kleidungsstücke. */
    getEase() {
        // Slim ~ 1.10, Regular ~ 1.28, Oversized ~ 1.65
        return 1.08 + this.currentFit * 0.6;
    }

    buildGarment() {
        if (this.garmentMesh) {
            this.scene.remove(this.garmentMesh);
            this.disposeGroup(this.garmentMesh);
        }
        if (this.avatarMesh) {
            this.scene.remove(this.avatarMesh);
            this.disposeGroup(this.avatarMesh);
        }

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

        const group = new THREE.Group();
        group.name = 'garment';

        switch (this.currentType) {
            case 'tshirt': this.buildTshirt(group, fabricMat, dims); break;
            case 'hoodie': this.buildHoodie(group, fabricMat, dims); break;
            case 'shirt':  this.buildShirt(group, fabricMat, dims); break;
            case 'pants':  this.buildPants(group, fabricMat, dims); break;
            case 'jacket': this.buildJacket(group, fabricMat, dims); break;
            case 'dress':  this.buildDress(group, fabricMat, dims); break;
        }

        group.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });

        group.scale.y = dims.heightScale;
        this.garmentMesh = group;
        this.scene.add(group);

        this.updateMeasurementLabels();
    }

    disposeGroup(group) {
        group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
    }

    /* ====================== AVATAR ====================== */

    buildAvatar(dims) {
        const group = new THREE.Group();
        group.name = 'avatar';

        const preset = dims.preset;
        const skinMat = new THREE.MeshStandardMaterial({
            color: preset.skinTone,
            roughness: 0.78,
            metalness: 0.02
        });
        const hairMat = new THREE.MeshStandardMaterial({
            color: preset.hairColor,
            roughness: 0.6,
            metalness: 0.0
        });

        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.105, 32, 24),
            skinMat
        );
        head.scale.set(0.92, 1.15, 1.0);
        head.position.set(0, dims.headY, 0);
        group.add(head);

        // Hair cap (subtle)
        if (this.currentAvatar !== 'mannequin') {
            const hair = new THREE.Mesh(
                new THREE.SphereGeometry(0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.7),
                hairMat
            );
            hair.scale.set(0.95, 1.0, 1.0);
            hair.position.set(0, dims.headY + 0.025, 0);
            group.add(hair);
        }

        // Neck
        const neckGeo = new THREE.LatheGeometry(
            this.lathePoints([
                [dims.neckR * 0.85, dims.headY - 0.085],
                [dims.neckR, dims.neckY],
                [dims.neckR * 1.25, dims.neckY - 0.07]
            ]), 20
        );
        const neck = new THREE.Mesh(neckGeo, skinMat);
        group.add(neck);

        // Torso lathe
        const torsoLathePoints = this.lathePoints([
            [dims.neckR * 1.3, dims.shoulderY + 0.04],
            [dims.shoulderHalfWidth * 0.9, dims.shoulderY],
            [dims.chestR * 1.05, dims.chestY + 0.06 + dims.bust],
            [dims.chestR, dims.chestY - 0.04],
            [dims.waistR, dims.waistY],
            [dims.hipsR, dims.hipsY],
            [dims.hipsR * 0.92, dims.crotchY]
        ]);
        const torsoGeo = new THREE.LatheGeometry(torsoLathePoints, 32);
        const torso = new THREE.Mesh(torsoGeo, skinMat);
        torso.scale.z = dims.depthScale;
        group.add(torso);

        // Bust (subtle, only for female presets with bust > 0)
        if (dims.bust > 0.01) {
            const bustGeo = new THREE.SphereGeometry(dims.bust + 0.04, 16, 12);
            [-1, 1].forEach(side => {
                const b = new THREE.Mesh(bustGeo, skinMat);
                b.position.set(side * dims.chestR * 0.5, dims.chestY + 0.04, dims.chestR * dims.depthScale * 0.6);
                b.scale.set(1, 0.9, 0.7);
                group.add(b);
            });
        }

        // Shoulders (round caps where arms connect)
        [-1, 1].forEach(side => {
            const cap = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 1.55, 16, 12),
                skinMat
            );
            cap.position.set(side * (dims.shoulderHalfWidth * 0.92), dims.shoulderY - 0.01, 0);
            group.add(cap);
        });

        // Arms (A-pose, slightly out from body)
        const armAngle = 0.16;
        const armLengthM = this.getMeasurements().arm / 100;

        [-1, 1].forEach(side => {
            const armPts = this.lathePoints([
                [dims.armR * 1.15, 0],
                [dims.armR * 1.05, armLengthM * 0.35],
                [dims.armR * 0.92, armLengthM * 0.55],
                [dims.armR * 0.85, armLengthM * 0.78],
                [dims.armR * 0.78, armLengthM]
            ]);
            const armGeo = new THREE.LatheGeometry(armPts, 20);
            const arm = new THREE.Mesh(armGeo, skinMat);
            arm.position.set(side * dims.shoulderHalfWidth * 0.9, dims.shoulderY - 0.02, 0);
            arm.rotation.z = side * (Math.PI / 2 - armAngle);
            arm.rotation.x = 0.04;
            group.add(arm);

            // Hand
            const handX = side * (dims.shoulderHalfWidth * 0.9 + Math.sin(armAngle + Math.PI/2) * armLengthM);
            const handY = dims.shoulderY - 0.02 - Math.cos(armAngle + Math.PI/2 - Math.PI/2) * armLengthM;
            const handXFinal = side * (dims.shoulderHalfWidth * 0.9 + Math.cos(armAngle) * 0 + Math.sin(armAngle) * armLengthM);
            const handYFinal = dims.shoulderY - 0.02 - Math.cos(armAngle) * armLengthM;

            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(dims.armR * 1.05, 16, 12),
                skinMat
            );
            hand.scale.set(0.65, 1.3, 0.45);
            hand.position.set(handXFinal, handYFinal, 0);
            hand.rotation.z = side * (Math.PI / 2 - armAngle);
            group.add(hand);
        });

        // Legs
        const inseam = this.getMeasurements().inseam / 100;
        const legSpacing = dims.hipsR * 0.55;

        [-1, 1].forEach(side => {
            const legPts = this.lathePoints([
                [dims.legR * 1.15, dims.crotchY - 0.02],
                [dims.legR * 1.05, dims.crotchY - inseam * 0.25],
                [dims.legR * 0.85, dims.kneeY + 0.05],
                [dims.legR * 0.78, dims.kneeY],
                [dims.ankleR * 1.2, dims.ankleY + 0.04],
                [dims.ankleR, dims.ankleY]
            ]);
            const legGeo = new THREE.LatheGeometry(legPts, 20);
            const leg = new THREE.Mesh(legGeo, skinMat);
            leg.position.x = side * legSpacing;
            group.add(leg);

            // Foot
            const foot = new THREE.Mesh(
                new THREE.SphereGeometry(0.075, 18, 12),
                skinMat
            );
            foot.scale.set(0.55, 0.45, 1.5);
            foot.position.set(side * legSpacing, dims.ankleY - 0.005, 0.06);
            group.add(foot);
        });

        group.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });

        return group;
    }

    /* ====================== GARMENTS ====================== */

    buildTshirt(group, material, dims) {
        const ease = this.getEase();
        const topR = dims.shoulderHalfWidth * 1.02;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * (ease * 0.95);
        const hemR = dims.hipsR * (ease * 0.88);

        const torsoPts = this.lathePoints([
            [topR * 0.85, dims.shoulderY + 0.045],
            [topR, dims.shoulderY + 0.02],
            [chestR * 1.02, dims.chestY + 0.05],
            [chestR, dims.chestY - 0.05],
            [waistR, dims.waistY],
            [hemR, dims.waistY - 0.18],
            [hemR * 1.02, dims.waistY - 0.22]
        ]);
        const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 32), material);
        torso.scale.z = dims.depthScale;
        group.add(torso);

        // Neckhole reinforcement
        const neckRing = new THREE.Mesh(
            new THREE.TorusGeometry(dims.neckR * 1.35, 0.012, 8, 28),
            new THREE.MeshStandardMaterial({ color: this.currentColor, roughness: 0.6 })
        );
        neckRing.position.set(0, dims.shoulderY + 0.045, 0);
        neckRing.rotation.x = Math.PI / 2;
        neckRing.scale.z = dims.depthScale;
        group.add(neckRing);

        this.addSleeve(group, material, dims, 'short', 'tshirt');
    }

    buildHoodie(group, material, dims) {
        const ease = this.getEase() * 1.18;
        const topR = dims.shoulderHalfWidth * 1.15;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * ease;
        const hemR = dims.hipsR * ease * 0.96;

        const torsoPts = this.lathePoints([
            [topR * 0.92, dims.shoulderY + 0.07],
            [topR, dims.shoulderY + 0.03],
            [chestR * 1.04, dims.chestY + 0.05],
            [chestR, dims.chestY - 0.06],
            [waistR * 1.02, dims.waistY],
            [hemR * 1.02, dims.waistY - 0.22],
            [hemR * 1.08, dims.waistY - 0.28]
        ]);
        const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 32), material);
        torso.scale.z = dims.depthScale;
        group.add(torso);

        // Hood
        const hood = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.5),
            material
        );
        hood.position.set(0, dims.headY - 0.07, -0.04);
        hood.scale.set(1.05, 1.15, 1.05);
        hood.rotation.x = -0.18;
        group.add(hood);

        // Kangaroo pocket
        const pocketGeo = new THREE.BoxGeometry(chestR * 1.6, 0.18, 0.04);
        const pocket = new THREE.Mesh(pocketGeo, material);
        pocket.position.set(0, dims.waistY + 0.04, chestR * dims.depthScale + 0.01);
        group.add(pocket);

        // Drawstrings
        const cordMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
        [-1, 1].forEach(side => {
            const cord = new THREE.Mesh(
                new THREE.CylinderGeometry(0.005, 0.005, 0.22),
                cordMat
            );
            cord.position.set(side * 0.06, dims.shoulderY - 0.08, dims.neckR * dims.depthScale + 0.02);
            group.add(cord);
        });

        this.addSleeve(group, material, dims, 'long', 'hoodie');
    }

    buildShirt(group, material, dims) {
        const ease = this.getEase() * 0.95;
        const topR = dims.shoulderHalfWidth * 1.04;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * (ease * 0.95);
        const hemR = dims.hipsR * (ease * 0.92);

        // Build two halves separately so we can show buttons in the middle
        const halfPts = this.lathePoints([
            [topR * 0.85, dims.shoulderY + 0.04],
            [topR, dims.shoulderY + 0.02],
            [chestR * 1.02, dims.chestY + 0.05],
            [chestR, dims.chestY - 0.06],
            [waistR * 1.02, dims.waistY],
            [hemR, dims.waistY - 0.24],
            [hemR, dims.waistY - 0.30]
        ]);
        const halfGeo = new THREE.LatheGeometry(halfPts, 32, 0, Math.PI);
        const half1 = new THREE.Mesh(halfGeo, material);
        half1.rotation.y = -Math.PI / 2;
        half1.scale.z = dims.depthScale;
        group.add(half1);

        const half2 = new THREE.Mesh(new THREE.LatheGeometry(halfPts, 32, Math.PI, Math.PI), material);
        half2.rotation.y = -Math.PI / 2;
        half2.scale.z = dims.depthScale;
        group.add(half2);

        // Collar
        const collarGeo = new THREE.TorusGeometry(dims.neckR * 1.45, 0.025, 8, 24, Math.PI * 1.6);
        const collar = new THREE.Mesh(collarGeo, material);
        collar.position.set(0, dims.shoulderY + 0.05, 0);
        collar.rotation.x = Math.PI / 2;
        collar.rotation.z = Math.PI / 2;
        collar.scale.z = dims.depthScale;
        group.add(collar);

        // Buttons
        const buttonMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.3, metalness: 0.15 });
        const buttonCount = 7;
        const buttonStartY = dims.shoulderY - 0.04;
        const buttonEndY = dims.waistY - 0.25;
        for (let i = 0; i < buttonCount; i++) {
            const t = i / (buttonCount - 1);
            const y = buttonStartY - (buttonStartY - buttonEndY) * t;
            const yRatio = (y - dims.waistY + 0.30) / (dims.shoulderY + 0.04 - dims.waistY + 0.30);
            const rAtY = waistR + (chestR - waistR) * Math.min(1, yRatio + 0.2);
            const button = new THREE.Mesh(
                new THREE.CylinderGeometry(0.011, 0.011, 0.004, 14),
                buttonMat
            );
            button.rotation.x = Math.PI / 2;
            button.position.set(0, y, rAtY * dims.depthScale + 0.005);
            group.add(button);
        }

        this.addSleeve(group, material, dims, 'long', 'shirt');
    }

    buildPants(group, material, dims) {
        const ease = 1.0 + this.currentFit * 0.45;
        const waistR = dims.waistR * (ease * 0.95);
        const hipsR = dims.hipsR * ease;
        const thighR = dims.legR * (1.4 + this.currentFit * 0.6);
        const kneeR = dims.legR * (1.2 + this.currentFit * 0.5);
        const ankleR = dims.legR * (0.85 + this.currentFit * 0.7);

        const waistTop = dims.hipsY + 0.08;
        const hipsY = dims.hipsY;
        const crotchY = dims.crotchY;
        const kneeY = dims.kneeY;
        const ankleY = dims.ankleY + 0.02;

        // Waist + hips
        const waistGeo = new THREE.LatheGeometry(
            this.lathePoints([
                [waistR * 0.98, waistTop + 0.03],
                [waistR, waistTop],
                [waistR * 1.03, (waistTop + hipsY) / 2],
                [hipsR, hipsY],
                [hipsR * 0.95, crotchY + 0.02]
            ]), 24
        );
        const waist = new THREE.Mesh(waistGeo, material);
        waist.scale.z = dims.depthScale;
        group.add(waist);

        // Legs
        const legSpacing = dims.hipsR * 0.55;
        [-1, 1].forEach(side => {
            const legPts = this.lathePoints([
                [thighR, crotchY],
                [thighR * 0.95, (crotchY + kneeY) / 2],
                [kneeR, kneeY],
                [kneeR * 0.95, (kneeY + ankleY) * 0.55],
                [ankleR * 1.1, ankleY + 0.04],
                [ankleR, ankleY]
            ]);
            const leg = new THREE.Mesh(new THREE.LatheGeometry(legPts, 18), material);
            leg.position.x = side * legSpacing;
            leg.scale.z = dims.depthScale * 1.1;
            group.add(leg);
        });

        // Belt loops + waistband detail
        const beltMat = new THREE.MeshStandardMaterial({
            color: this.currentColor,
            roughness: 0.5,
            metalness: 0.15
        });
        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(waistR * 1.005, 0.018, 8, 28),
            beltMat
        );
        belt.position.y = waistTop;
        belt.rotation.x = Math.PI / 2;
        belt.scale.z = dims.depthScale;
        group.add(belt);
    }

    buildJacket(group, material, dims) {
        const ease = this.getEase() * 1.12;
        const topR = dims.shoulderHalfWidth * 1.15;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * ease;
        const hemR = dims.hipsR * ease;

        const halfPts = this.lathePoints([
            [topR * 0.9, dims.shoulderY + 0.06],
            [topR, dims.shoulderY + 0.03],
            [chestR * 1.06, dims.chestY + 0.04],
            [chestR, dims.chestY - 0.05],
            [waistR, dims.waistY],
            [hemR, dims.waistY - 0.20],
            [hemR * 1.02, dims.waistY - 0.26]
        ]);

        const half1 = new THREE.Mesh(new THREE.LatheGeometry(halfPts, 32, 0, Math.PI), material);
        half1.rotation.y = -Math.PI / 2;
        half1.scale.z = dims.depthScale;
        group.add(half1);

        const half2 = new THREE.Mesh(new THREE.LatheGeometry(halfPts, 32, Math.PI, Math.PI), material);
        half2.rotation.y = -Math.PI / 2;
        half2.scale.z = dims.depthScale;
        group.add(half2);

        // Lapels
        const lapelGeo = new THREE.PlaneGeometry(0.07, 0.32);
        [-1, 1].forEach(side => {
            const lapel = new THREE.Mesh(lapelGeo, material);
            lapel.position.set(side * 0.04, dims.chestY + 0.05, chestR * dims.depthScale + 0.005);
            lapel.rotation.y = side * 0.18;
            lapel.rotation.x = -0.1;
            group.add(lapel);
        });

        // Buttons
        const buttonMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, metalness: 0.4 });
        for (let i = 0; i < 3; i++) {
            const button = new THREE.Mesh(
                new THREE.CylinderGeometry(0.014, 0.014, 0.005, 14),
                buttonMat
            );
            const y = dims.chestY - 0.05 - i * 0.13;
            button.rotation.x = Math.PI / 2;
            button.position.set(0, y, chestR * dims.depthScale + 0.008);
            group.add(button);
        }

        this.addSleeve(group, material, dims, 'long', 'jacket');
    }

    buildDress(group, material, dims) {
        const ease = this.getEase() * 0.92;
        const topR = dims.shoulderHalfWidth * 0.9;
        const chestR = dims.chestR * ease;
        const waistR = dims.waistR * (ease * 0.92);
        const hipsR = dims.hipsR * ease;
        const hemR = dims.hipsR * (1.8 + this.currentFit * 0.6);

        const dressPts = this.lathePoints([
            [topR * 0.75, dims.shoulderY + 0.02],
            [topR * 0.85, dims.shoulderY],
            [chestR * 1.04, dims.chestY + 0.04 + dims.bust],
            [chestR, dims.chestY - 0.05],
            [waistR, dims.waistY],
            [hipsR * 1.02, dims.hipsY],
            [hipsR * 1.15, (dims.hipsY + dims.kneeY) / 2 + 0.05],
            [hemR * 0.85, dims.kneeY + 0.05],
            [hemR, dims.kneeY - 0.08]
        ]);
        const dress = new THREE.Mesh(new THREE.LatheGeometry(dressPts, 36), material);
        dress.scale.z = Math.max(dims.depthScale, 0.85);
        group.add(dress);
    }

    addSleeve(group, material, dims, length, garmentType) {
        const ease = this.getEase();
        const armLength = this.getMeasurements().arm / 100;
        const sleeveLength = length === 'long' ? armLength * 0.95 : armLength * 0.32;
        const upperR = dims.armR * (ease * 1.15);
        const lowerR = dims.armR * (ease * 0.95);
        const cuffR = length === 'long' ? dims.armR * (ease * 0.85) : dims.armR * (ease * 1.05);

        const armAngle = 0.16;

        [-1, 1].forEach(side => {
            const sleevePts = this.lathePoints([
                [upperR * 1.1, 0],
                [upperR, sleeveLength * 0.25],
                [lowerR, sleeveLength * 0.65],
                [cuffR, sleeveLength * 0.95],
                [cuffR, sleeveLength]
            ]);
            const sleeveGeo = new THREE.LatheGeometry(sleevePts, 18);
            const sleeve = new THREE.Mesh(sleeveGeo, material);
            sleeve.position.set(side * dims.shoulderHalfWidth * 0.9, dims.shoulderY - 0.02, 0);
            sleeve.rotation.z = side * (Math.PI / 2 - armAngle);
            sleeve.rotation.x = 0.04;
            group.add(sleeve);

            // Cuff ring for long sleeves
            if (length === 'long' && (garmentType === 'hoodie' || garmentType === 'shirt')) {
                const cuff = new THREE.Mesh(
                    new THREE.TorusGeometry(cuffR * 1.05, 0.012, 6, 18),
                    material
                );
                const tipX = side * (dims.shoulderHalfWidth * 0.9 + Math.sin(armAngle) * sleeveLength);
                const tipY = dims.shoulderY - 0.02 - Math.cos(armAngle) * sleeveLength;
                cuff.position.set(tipX, tipY, 0);
                cuff.rotation.y = Math.PI / 2;
                cuff.rotation.x = side * (Math.PI / 2 - armAngle);
                group.add(cuff);
            }
        });
    }

    lathePoints(coords) {
        return coords.map(([x, y]) => new THREE.Vector2(x, y));
    }

    /* ====================== MEASUREMENT LABELS ====================== */

    updateMeasurementLabels() {
        this.measurementLabels.forEach(l => this.scene.remove(l));
        this.measurementLabels = [];
        if (!this.showMeasurements || !this.measurements) return;

        const dims = this.getBodyDimensions();
        const m = this.measurements;
        const labels = [
            { text: `${m.chest}cm`, pos: [dims.chestR * 1.8, dims.chestY, 0], color: 0xec4899 },
            { text: `${m.waist}cm`, pos: [dims.waistR * 2.0, dims.waistY, 0], color: 0x8b5cf6 },
            { text: `${m.hips}cm`, pos: [dims.hipsR * 1.9, dims.hipsY, 0], color: 0x06b6d4 },
            { text: `${m.shoulder}cm`, pos: [0, dims.shoulderY + 0.12, 0], color: 0xec4899 }
        ];

        labels.forEach(({ text, pos, color }) => {
            const sprite = this.createTextSprite(text, color);
            sprite.position.set(...pos);
            this.scene.add(sprite);
            this.measurementLabels.push(sprite);
        });
    }

    createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 254, 62);
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.32, 0.08, 1);
        return sprite;
    }

    /* ====================== SETTERS ====================== */

    setType(type)            { this.currentType = type; this.buildGarment(); }
    setColor(hex)            { this.currentColor = parseInt(hex.replace('#',''), 16); this.buildGarment(); }
    setMaterial(mat)         { this.currentMaterial = mat; this.buildGarment(); }
    setFit(fit)              { this.currentFit = fit; this.buildGarment(); }
    setMeasurements(m)       { this.measurements = m; this.buildGarment(); }
    setAvatar(presetKey)     { if (AVATAR_PRESETS[presetKey]) { this.currentAvatar = presetKey; this.buildGarment(); } }
    setShowAvatar(show)      { this.showAvatar = show; this.buildGarment(); }
    setShowMeasurements(show){ this.showMeasurements = show; this.updateMeasurementLabels(); }
    setWireframe(wf)         { this.wireframe = wf; this.buildGarment(); }

    setView(view) {
        const tween = (target) => {
            const start = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
            const startTime = Date.now();
            const duration = 700;
            const animate = () => {
                const t = Math.min((Date.now() - startTime) / duration, 1);
                const ease = 1 - Math.pow(1 - t, 3);
                this.camera.position.x = start.x + (target.x - start.x) * ease;
                this.camera.position.y = start.y + (target.y - start.y) * ease;
                this.camera.position.z = start.z + (target.z - start.z) * ease;
                if (t < 1) requestAnimationFrame(animate);
            };
            animate();
        };
        this.autoRotate = false;
        switch (view) {
            case 'front':  tween({ x: 0,    y: 1.3, z: 4.2 }); break;
            case 'back':   tween({ x: 0,    y: 1.3, z: -4.2 }); break;
            case 'side':   tween({ x: 4.2,  y: 1.3, z: 0 }); break;
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
            if (this.avatarMesh) this.avatarMesh.rotation.y += 0.008;
            this.measurementLabels.forEach(l => {
                const r = Math.sqrt(l.position.x ** 2 + l.position.z ** 2);
                const angle = Math.atan2(l.position.z, l.position.x) + 0.008;
                l.position.x = r * Math.cos(angle);
                l.position.z = r * Math.sin(angle);
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
