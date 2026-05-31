/**
 * Urban Revolution — 3D Scene Foundation
 *
 * Owns the Three.js renderer, camera, lights and orbit controls. Built
 * once per mount; not torn down on state changes. The scene's children
 * (avatar, garment) are managed by other modules and added/removed
 * via add()/remove() — never trigger a re-mount of the scene itself.
 *
 * Rendering is on-demand: requestRender() schedules a single frame on
 * the next animation tick. There is no continuous 60 fps loop. Camera
 * movement triggers re-render via the orbit-controls 'change' event.
 *
 * Pipeline:
 *   - PMREM-generated RoomEnvironment for free PBR-quality IBL (no
 *     external HDR download — runs procedurally on init).
 *   - EffectComposer with RenderPass → UnrealBloomPass → OutputPass.
 *   - ACES Filmic tone mapping + sRGB output for cinematic, accurate
 *     color reproduction.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let composer = null;
let container = null;
let pmrem = null;
let renderScheduled = false;

function mount(targetContainer) {
    if (renderer) {
        throw new Error("Scene already mounted — call unmount() first");
    }
    container = targetContainer;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES Filmic — cinematic tone curve, the de facto Pixar/Hollywood standard
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = null;

    // Procedural environment map for image-based lighting (IBL).
    // RoomEnvironment ist ein Studio-Setup mit subtilen Highlights —
    // sehr smeichelhaft für Stoffe, kostet ~1-2ms beim Init.
    pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    scene.environment = pmrem.fromScene(envScene, 0.06).texture;

    camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 1.1, 4.2);
    camera.lookAt(0, 1.0, 0);

    initLights();
    initGround();
    initComposer(width, height);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.0, 0);
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.addEventListener("change", requestRender);

    window.addEventListener("resize", handleResize);

    requestRender();
}

function initLights() {
    // Key light — warm tungsten, primary illumination.
    // Kept moderate (1.0) so bright skin/light fabrics don't clip into
    // the bloom threshold and turn into glowing tubes — the env map
    // (RoomEnvironment IBL) carries the rest of the base illumination.
    const key = new THREE.DirectionalLight(0xfff5e6, 1.0);
    key.position.set(2.5, 3.5, 2.0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -0.5;
    key.shadow.bias = -0.0001;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 6;
    scene.add(key);

    // Fill light — magenta from camera-left, brand color hint. Lifted so the
    // shadow side isn't crushed black (reads more like a studio softbox).
    const fill = new THREE.DirectionalLight(0xff6ab8, 0.55);
    fill.position.set(-2.0, 1.8, 1.5);
    scene.add(fill);

    // Rim light — cyan/purple from behind, separates subject from background
    const rim = new THREE.DirectionalLight(0x8b5cf6, 0.65);
    rim.position.set(0.5, 2.0, -2.5);
    scene.add(rim);

    // Subtle bottom bounce — softens shadow undersides
    const bounce = new THREE.HemisphereLight(0xffffff, 0x1a0a2e, 0.25);
    scene.add(bounce);
}

function initGround() {
    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(2.4, 48),
        new THREE.ShadowMaterial({ opacity: 0.45 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
}

function initComposer(width, height) {
    composer = new EffectComposer(renderer);
    composer.setSize(width, height);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    composer.addPass(new RenderPass(scene, camera));

    // Bloom — soft glow on hot highlights (Stoff-Glanz, Schmuck, Pattern)
    // strength, radius, threshold
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.28,   // strength — subtle, fashion-grade not anime-grade
        0.85,   // radius
        0.90    // threshold — only genuine highlights (silk sheen, jewelry)
                // bloom; skin and light fabrics stay below the cutoff so
                // they no longer glow.
    );
    composer.addPass(bloom);

    // OutputPass handles final tone mapping + colorspace conversion
    composer.addPass(new OutputPass());
}

function handleResize() {
    if (!renderer || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    if (composer) composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
}

function requestRender() {
    if (renderScheduled || !renderer) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
        renderScheduled = false;
        if (!renderer) return;
        controls.update();
        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    });
}

function add(object3d) {
    if (!scene) throw new Error("Scene not mounted");
    scene.add(object3d);
    requestRender();
}

function remove(object3d) {
    if (!scene || !object3d) return;
    scene.remove(object3d);
    disposeGroup(object3d);
    requestRender();
}

function disposeGroup(group) {
    group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
                if (m.map) m.map.dispose();
                m.dispose();
            });
        }
    });
}

function unmount() {
    if (!renderer) return;
    window.removeEventListener("resize", handleResize);
    controls.dispose();
    scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
        }
    });
    if (composer) {
        composer.dispose?.();
        composer = null;
    }
    if (pmrem) {
        pmrem.dispose();
        pmrem = null;
    }
    if (scene.environment) {
        scene.environment.dispose();
        scene.environment = null;
    }
    renderer.dispose();
    if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer = null;
    scene = null;
    camera = null;
    controls = null;
    container = null;
}

export const Scene = { mount, unmount, add, remove, requestRender };
