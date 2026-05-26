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
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let container = null;
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
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = null;

    camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 1.1, 4.2);
    camera.lookAt(0, 1.0, 0);

    initLights();
    initGround();

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
    const key = new THREE.DirectionalLight(0xfff5e6, 1.6);
    key.position.set(2.5, 3.5, 2.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -0.5;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xff6ab8, 0.45);
    fill.position.set(-2.0, 1.8, 1.5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x8b5cf6, 0.55);
    rim.position.set(0.5, 2.0, -2.5);
    scene.add(rim);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
}

function initGround() {
    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(2.4, 48),
        new THREE.ShadowMaterial({ opacity: 0.35 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
}

function handleResize() {
    if (!renderer || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
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
        renderer.render(scene, camera);
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
