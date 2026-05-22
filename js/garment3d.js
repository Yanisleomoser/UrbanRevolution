import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class GarmentScene {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.garmentMesh = null;
        this.bodyMesh = null;
        this.measurementLabels = [];
        this.currentType = 'tshirt';
        this.currentColor = 0x1a1a1a;
        this.currentMaterial = 'cotton';
        this.currentFit = 0.5;
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
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);
    }

    initCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
        this.camera.position.set(0, 1.4, 4.5);
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(ambient);

        const key = new THREE.DirectionalLight(0xfff5e8, 1.2);
        key.position.set(3, 5, 4);
        key.castShadow = true;
        key.shadow.mapSize.width = 2048;
        key.shadow.mapSize.height = 2048;
        key.shadow.camera.left = -3;
        key.shadow.camera.right = 3;
        key.shadow.camera.top = 3;
        key.shadow.camera.bottom = -3;
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0xec4899, 0.4);
        fill.position.set(-4, 2, 2);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0x8b5cf6, 0.6);
        rim.position.set(0, 3, -4);
        this.scene.add(rim);
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1.2, 0);
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

        const grid = new THREE.GridHelper(6, 30, 0x2a2a2f, 0x1a1a1f);
        grid.position.y = 0.001;
        this.scene.add(grid);
    }

    getMaterialProps(materialType) {
        const props = {
            cotton: { roughness: 0.85, metalness: 0.0 },
            linen: { roughness: 0.95, metalness: 0.0 },
            denim: { roughness: 0.75, metalness: 0.05 },
            wool: { roughness: 0.9, metalness: 0.0 },
            fleece: { roughness: 0.95, metalness: 0.0 },
            silk: { roughness: 0.25, metalness: 0.15 },
            polyester: { roughness: 0.55, metalness: 0.1 }
        };
        return props[materialType] || props.cotton;
    }

    buildGarment() {
        if (this.garmentMesh) {
            this.scene.remove(this.garmentMesh);
            this.garmentMesh.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
        }

        const m = this.measurements || {
            height: 175, chest: 96, waist: 82, hips: 98,
            shoulder: 44, arm: 62, inseam: 82, neck: 38
        };

        const matProps = this.getMaterialProps(this.currentMaterial);
        const material = new THREE.MeshStandardMaterial({
            color: this.currentColor,
            roughness: matProps.roughness,
            metalness: matProps.metalness,
            side: THREE.DoubleSide,
            wireframe: this.wireframe
        });

        const group = new THREE.Group();

        const heightScale = m.height / 175;
        const chestScale = m.chest / 96;
        const waistScale = m.waist / 82;
        const hipsScale = m.hips / 98;
        const shoulderScale = m.shoulder / 44;
        const armScale = m.arm / 62;
        const inseamScale = m.inseam / 82;
        const neckScale = m.neck / 38;
        const fitFactor = 0.85 + this.currentFit * 0.5;

        switch (this.currentType) {
            case 'tshirt':
                this.buildTshirt(group, material, { chestScale, waistScale, shoulderScale, armScale, fitFactor });
                break;
            case 'hoodie':
                this.buildHoodie(group, material, { chestScale, waistScale, shoulderScale, armScale, fitFactor });
                break;
            case 'shirt':
                this.buildShirt(group, material, { chestScale, waistScale, shoulderScale, armScale, fitFactor });
                break;
            case 'pants':
                this.buildPants(group, material, { waistScale, hipsScale, inseamScale, fitFactor });
                break;
            case 'jacket':
                this.buildJacket(group, material, { chestScale, waistScale, shoulderScale, armScale, fitFactor });
                break;
            case 'dress':
                this.buildDress(group, material, { chestScale, waistScale, hipsScale, shoulderScale, fitFactor });
                break;
        }

        group.scale.y = heightScale;
        group.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });

        this.garmentMesh = group;
        this.scene.add(group);

        this.updateMeasurementLabels();
    }

    buildTshirt(group, material, p) {
        const torsoTop = 0.5 * p.shoulderScale * p.fitFactor;
        const torsoMid = 0.42 * p.chestScale * p.fitFactor;
        const torsoBottom = 0.40 * p.waistScale * p.fitFactor;

        const torsoGeo = new THREE.LatheGeometry(
            this.buildLathePoints([
                [torsoTop, 1.7],
                [torsoTop, 1.65],
                [torsoMid, 1.45],
                [torsoMid * 0.98, 1.25],
                [torsoBottom, 1.05],
                [torsoBottom * 1.02, 0.95]
            ]), 24
        );
        const torso = new THREE.Mesh(torsoGeo, material);
        group.add(torso);

        const neckHole = new THREE.Mesh(
            new THREE.TorusGeometry(0.12, 0.018, 8, 24),
            new THREE.MeshStandardMaterial({ color: this.currentColor, roughness: 0.5 })
        );
        neckHole.position.y = 1.69;
        neckHole.rotation.x = Math.PI / 2;
        group.add(neckHole);

        this.addSleeve(group, material, torsoTop, 1.65, 0.42 * p.armScale, p.fitFactor, 'left');
        this.addSleeve(group, material, torsoTop, 1.65, 0.42 * p.armScale, p.fitFactor, 'right');

        const hemGeo = new THREE.TorusGeometry(torsoBottom * 1.02, 0.012, 6, 32);
        const hem = new THREE.Mesh(hemGeo, material);
        hem.position.y = 0.95;
        hem.rotation.x = Math.PI / 2;
        group.add(hem);
    }

    buildHoodie(group, material, p) {
        const torsoTop = 0.55 * p.shoulderScale * p.fitFactor;
        const torsoMid = 0.50 * p.chestScale * p.fitFactor;
        const torsoBottom = 0.46 * p.waistScale * p.fitFactor;

        const torsoGeo = new THREE.LatheGeometry(
            this.buildLathePoints([
                [torsoTop, 1.72],
                [torsoTop, 1.65],
                [torsoMid, 1.45],
                [torsoMid, 1.25],
                [torsoBottom, 1.0],
                [torsoBottom * 1.05, 0.85]
            ]), 24
        );
        const torso = new THREE.Mesh(torsoGeo, material);
        group.add(torso);

        const hoodGeo = new THREE.SphereGeometry(0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6);
        const hood = new THREE.Mesh(hoodGeo, material);
        hood.position.set(0, 1.85, -0.05);
        hood.rotation.x = -0.3;
        group.add(hood);

        this.addSleeve(group, material, torsoTop, 1.65, 0.46 * p.armScale, p.fitFactor, 'left', 'long');
        this.addSleeve(group, material, torsoTop, 1.65, 0.46 * p.armScale, p.fitFactor, 'right', 'long');

        const pocketGeo = new THREE.BoxGeometry(0.5, 0.22, 0.05);
        const pocket = new THREE.Mesh(pocketGeo, material);
        pocket.position.set(0, 1.1, torsoMid * 0.95);
        group.add(pocket);

        const drawCordL = new THREE.Mesh(
            new THREE.CylinderGeometry(0.005, 0.005, 0.2),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 })
        );
        drawCordL.position.set(-0.1, 1.55, 0.18);
        group.add(drawCordL);

        const drawCordR = drawCordL.clone();
        drawCordR.position.x = 0.1;
        group.add(drawCordR);
    }

    buildShirt(group, material, p) {
        const torsoTop = 0.48 * p.shoulderScale * p.fitFactor;
        const torsoMid = 0.40 * p.chestScale * p.fitFactor;
        const torsoBottom = 0.38 * p.waistScale * p.fitFactor;

        const torsoGeo = new THREE.LatheGeometry(
            this.buildLathePoints([
                [torsoTop, 1.7],
                [torsoTop, 1.65],
                [torsoMid, 1.45],
                [torsoMid * 0.95, 1.25],
                [torsoBottom, 1.0],
                [torsoBottom, 0.85]
            ]), 24
        );
        const torso = new THREE.Mesh(torsoGeo, material);
        group.add(torso);

        const collarGeo = new THREE.TorusGeometry(0.13, 0.025, 8, 24, Math.PI * 1.6);
        const collar = new THREE.Mesh(collarGeo, material);
        collar.position.y = 1.7;
        collar.rotation.x = Math.PI / 2;
        collar.rotation.z = Math.PI / 2;
        group.add(collar);

        this.addSleeve(group, material, torsoTop, 1.65, 0.38 * p.armScale, p.fitFactor, 'left', 'long');
        this.addSleeve(group, material, torsoTop, 1.65, 0.38 * p.armScale, p.fitFactor, 'right', 'long');

        for (let i = 0; i < 5; i++) {
            const button = new THREE.Mesh(
                new THREE.CylinderGeometry(0.018, 0.018, 0.005, 12),
                new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.3 })
            );
            button.rotation.x = Math.PI / 2;
            button.position.set(0, 1.55 - i * 0.13, torsoMid * 0.97);
            group.add(button);
        }
    }

    buildPants(group, material, p) {
        const waistR = 0.42 * p.waistScale * p.fitFactor;
        const hipsR = 0.44 * p.hipsScale * p.fitFactor;
        const thighR = 0.18 * p.fitFactor;
        const ankleR = 0.12 * p.fitFactor;

        const waistTop = 1.05;
        const hipsY = 0.85;
        const crotchY = 0.65;
        const ankleY = 0.05;
        const legGap = 0.13;

        const waistGeo = new THREE.LatheGeometry(
            this.buildLathePoints([
                [waistR, waistTop],
                [waistR * 1.02, hipsY + 0.05],
                [hipsR, hipsY],
                [hipsR * 0.95, crotchY + 0.05]
            ]), 20
        );
        const waist = new THREE.Mesh(waistGeo, material);
        group.add(waist);

        const buildLeg = (xOffset) => {
            const points = [
                [thighR, crotchY],
                [thighR * 0.95, (crotchY + ankleY) / 2 + 0.1],
                [ankleR * 1.1, (crotchY + ankleY) / 2 - 0.1],
                [ankleR, ankleY]
            ];
            const legGeo = new THREE.LatheGeometry(this.buildLathePoints(points), 16);
            const leg = new THREE.Mesh(legGeo, material);
            leg.position.x = xOffset;
            group.add(leg);
        };

        buildLeg(-legGap);
        buildLeg(legGap);

        const beltGeo = new THREE.TorusGeometry(waistR * 1.01, 0.02, 8, 24);
        const belt = new THREE.Mesh(beltGeo, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
        belt.position.y = waistTop;
        belt.rotation.x = Math.PI / 2;
        group.add(belt);
    }

    buildJacket(group, material, p) {
        const torsoTop = 0.56 * p.shoulderScale * p.fitFactor;
        const torsoMid = 0.50 * p.chestScale * p.fitFactor;
        const torsoBottom = 0.48 * p.waistScale * p.fitFactor;

        const halfPoints = this.buildLathePoints([
            [torsoTop, 1.72],
            [torsoTop, 1.65],
            [torsoMid, 1.45],
            [torsoMid * 0.97, 1.25],
            [torsoBottom, 1.0],
            [torsoBottom * 1.05, 0.85]
        ]);

        const leftGeo = new THREE.LatheGeometry(halfPoints, 24, 0, Math.PI);
        const left = new THREE.Mesh(leftGeo, material);
        left.rotation.y = -Math.PI / 2;
        group.add(left);

        const rightGeo = new THREE.LatheGeometry(halfPoints, 24, Math.PI, Math.PI);
        const right = new THREE.Mesh(rightGeo, material);
        right.rotation.y = -Math.PI / 2;
        group.add(right);

        const lapelGeo = new THREE.PlaneGeometry(0.15, 0.5);
        const lapelL = new THREE.Mesh(lapelGeo, material);
        lapelL.position.set(-0.08, 1.5, torsoMid * 0.97);
        lapelL.rotation.y = 0.2;
        group.add(lapelL);

        const lapelR = lapelL.clone();
        lapelR.position.x = 0.08;
        lapelR.rotation.y = -0.2;
        group.add(lapelR);

        this.addSleeve(group, material, torsoTop, 1.65, 0.42 * p.armScale, p.fitFactor, 'left', 'long');
        this.addSleeve(group, material, torsoTop, 1.65, 0.42 * p.armScale, p.fitFactor, 'right', 'long');

        for (let i = 0; i < 3; i++) {
            const button = new THREE.Mesh(
                new THREE.CylinderGeometry(0.022, 0.022, 0.005, 12),
                new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.3 })
            );
            button.rotation.x = Math.PI / 2;
            button.position.set(0, 1.4 - i * 0.18, torsoMid * 0.97);
            group.add(button);
        }
    }

    buildDress(group, material, p) {
        const torsoTop = 0.42 * p.shoulderScale * p.fitFactor;
        const torsoMid = 0.36 * p.chestScale * p.fitFactor;
        const torsoBottom = 0.34 * p.waistScale * p.fitFactor;
        const hemR = 0.7 * p.hipsScale;

        const dressGeo = new THREE.LatheGeometry(
            this.buildLathePoints([
                [torsoTop, 1.7],
                [torsoTop, 1.65],
                [torsoMid, 1.45],
                [torsoMid * 0.92, 1.25],
                [torsoBottom, 1.1],
                [torsoBottom * 1.05, 0.95],
                [torsoBottom * 1.2, 0.75],
                [hemR * 0.7, 0.4],
                [hemR, 0.1]
            ]), 32
        );
        const dress = new THREE.Mesh(dressGeo, material);
        group.add(dress);
    }

    addSleeve(group, material, shoulderR, shoulderY, sleeveR, fitFactor, side, length = 'short') {
        const sideMul = side === 'left' ? -1 : 1;
        const sleeveLength = length === 'long' ? 0.7 : 0.32;
        const cuffR = length === 'long' ? sleeveR * 0.7 : sleeveR;

        const points = [
            [sleeveR * 1.15, 0],
            [sleeveR, sleeveLength * 0.3],
            [sleeveR * 0.95, sleeveLength * 0.7],
            [cuffR, sleeveLength]
        ];

        const sleeveGeo = new THREE.LatheGeometry(this.buildLathePoints(points), 16);
        const sleeve = new THREE.Mesh(sleeveGeo, material);
        sleeve.rotation.z = sideMul * Math.PI / 2.3;
        sleeve.position.set(sideMul * (shoulderR * 0.95), shoulderY, 0);
        group.add(sleeve);
    }

    buildLathePoints(coords) {
        return coords.map(([x, y]) => new THREE.Vector2(x, y));
    }

    updateMeasurementLabels() {
        this.measurementLabels.forEach(l => this.scene.remove(l));
        this.measurementLabels = [];

        if (!this.showMeasurements || !this.measurements) return;

        const m = this.measurements;
        const labels = [
            { text: `Brust ${m.chest}cm`, pos: [0.7, 1.45, 0], color: 0xec4899 },
            { text: `Taille ${m.waist}cm`, pos: [0.7, 1.15, 0], color: 0x8b5cf6 },
            { text: `Hüfte ${m.hips}cm`, pos: [0.7, 0.95, 0], color: 0x06b6d4 },
            { text: `Schulter ${m.shoulder}cm`, pos: [0, 1.78, 0], color: 0xec4899 }
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
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.45, 0.12, 1);
        return sprite;
    }

    setType(type) {
        this.currentType = type;
        this.buildGarment();
    }

    setColor(hexColor) {
        this.currentColor = parseInt(hexColor.replace('#', ''), 16);
        this.buildGarment();
    }

    setMaterial(materialType) {
        this.currentMaterial = materialType;
        this.buildGarment();
    }

    setFit(fitValue) {
        this.currentFit = fitValue;
        this.buildGarment();
    }

    setMeasurements(measurements) {
        this.measurements = measurements;
        this.buildGarment();
    }

    setShowMeasurements(show) {
        this.showMeasurements = show;
        this.updateMeasurementLabels();
    }

    setWireframe(wireframe) {
        this.wireframe = wireframe;
        this.buildGarment();
    }

    setView(view) {
        const tween = (target) => {
            const start = {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            };
            const startTime = Date.now();
            const duration = 600;
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
            case 'front': tween({ x: 0, y: 1.4, z: 4.5 }); break;
            case 'back': tween({ x: 0, y: 1.4, z: -4.5 }); break;
            case 'side': tween({ x: 4.5, y: 1.4, z: 0 }); break;
            case 'rotate':
                this.autoRotate = true;
                break;
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
        if (this.autoRotate && this.garmentMesh) {
            this.garmentMesh.rotation.y += 0.008;
        }
        this.renderer.render(this.scene, this.camera);
    }
}

window.GarmentScene = GarmentScene;

window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('three-canvas');
    if (container) {
        const scene = new GarmentScene(container);
        scene.buildGarment();
        window.garmentScene = scene;

        window.dispatchEvent(new Event('garment-scene-ready'));
    }
});
