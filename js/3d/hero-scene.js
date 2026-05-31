/**
 * Urban Revolution — Hero 3D Figure (turntable)
 *
 * Mounts a slowly rotating, tailored 3D figure as the hero visual and
 * recolours / re-dresses it live in response to the self-typing prompt
 * console (js/hero.js dispatches `hero:look` with { stops, color, garment }).
 *
 * Design goals:
 *   - Reuse the existing avatar + garment factories (no duplicated geometry)
 *     so the hero figure and the preview figure stay visually consistent.
 *   - Be a *progressive enhancement*: the hero SVG (#hero-asset-svg) is the
 *     baseline. This module only takes over when WebGL is available AND the
 *     user hasn't asked for reduced motion. On any failure it bails silently
 *     and the SVG remains.
 *   - Own a private renderer + gentle turntable loop (the shared Scene
 *     singleton in scene.js belongs to the preview section and must not be
 *     co-opted here).
 *
 * Loaded as a deferred ES module after the classic scripts, like the other
 * 3D entry points. Three.js arrives via the page import map.
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Avatars } from "./avatars.js";
import { Garments } from "./garments.js";

const HOST_ID = "hero-3d";          // container the canvas mounts into
const SVG_SELECTOR = ".hero-asset-svg";

// Slim, confident default proportions for the hero figure (cm). Independent
// of the user's real measurements — this is brand imagery, not their fit.
const HERO_MEASUREMENTS = {
    height: 178, chest: 92, waist: 76, hips: 94,
    shoulder: 45, arm: 63, inseam: 84, neck: 37,
};
const HERO_APPEARANCE = { skinTone: "#b8a898", hairColor: "#2a2018" };

let renderer = null;
let scene = null;
let camera = null;
let figure = null;          // outer group we spin
let mannequin = null;
let garment = null;
let host = null;
let raf = null;
let pmrem = null;
let io = null;
let inView = true;          // false once the hero scrolls out of view

let currentType = "hoodie";
// Colours are mutated in place (set/lerp/copy), never rebound → const.
const currentColor = new THREE.Color("#8b5cf6");
const targetColor = new THREE.Color("#8b5cf6");
let pendingType = null;     // set when a look wants a different garment
let morphFlash = 0;         // 0..1 brief emissive pulse on change

function prefersReduced() {
    return !!(window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function isWebGLAvailable() {
    try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (_e) {
        return false;
    }
}

function mount() {
    host = document.getElementById(HOST_ID);
    if (!host) return;

    const width = host.clientWidth || 380;
    const height = host.clientHeight || 480;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = null;

    pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 1.12, 4.3);
    camera.lookAt(0, 0.92, 0);

    initLights();
    initGround();

    figure = new THREE.Group();
    scene.add(figure);

    mannequin = Avatars.buildMannequin(HERO_MEASUREMENTS, HERO_APPEARANCE);
    figure.add(mannequin);
    rebuildGarment(currentType, currentColor.getStyle());

    // Hand over from the SVG to the live 3D figure.
    const svg = document.querySelector(SVG_SELECTOR);
    if (svg) svg.style.opacity = "0";
    host.classList.add("is-live");

    window.addEventListener("hero:look", onLook);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    // Pause the turntable RAF loop whenever the hero scrolls out of view.
    // Without this it renders WebGL 60fps the whole time the user is down in
    // the tool sections, which on iOS Safari competes with scroll compositing
    // and makes every section jump/stutter. Resume when it returns.
    if ("IntersectionObserver" in window) {
        io = new IntersectionObserver((entries) => {
            inView = entries[0].isIntersecting;
            if (inView && !raf && renderer && !document.hidden) {
                loop();
            } else if (!inView && raf) {
                cancelAnimationFrame(raf);
                raf = null;
            }
        }, { threshold: 0.01 });
        io.observe(host);
    }

    loop();
}

function initLights() {
    const key = new THREE.DirectionalLight(0xfff5e6, 1.0);
    key.position.set(2.2, 3.4, 2.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.6;
    key.shadow.camera.right = 1.6;
    key.shadow.camera.top = 2.6;
    key.shadow.camera.bottom = -0.4;
    key.shadow.bias = -0.0001;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 6;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xff6ab8, 0.4);
    fill.position.set(-2.2, 1.6, 1.4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x8b5cf6, 0.8);
    rim.position.set(0.4, 2.0, -2.6);
    scene.add(rim);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a0a2e, 0.28));
}

function initGround() {
    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(2.2, 48),
        new THREE.ShadowMaterial({ opacity: 0.4 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
}

function rebuildGarment(type, colorHex) {
    if (garment) {
        figure.remove(garment);
        disposeGroup(garment);
        garment = null;
    }
    Avatars.setBaseLayerForGarment(mannequin, type);
    garment = Garments.buildGarment(type, {
        color: colorHex,
        material: "cotton",
        measurements: HERO_MEASUREMENTS,
        fit: 0.5,
    });
    figure.add(garment);
    currentType = type;
}

function onLook(e) {
    const look = e && e.detail && e.detail.look;
    if (!look) return;
    if (look.color) targetColor.set(look.color);
    if (look.garment && look.garment !== currentType) {
        pendingType = look.garment;
    }
    morphFlash = 1;
}

// Apply a pending garment swap at the "back" of the turntable so the change
// isn't jarringly face-on.
function maybeSwapGarment() {
    if (!pendingType) return;
    rebuildGarment(pendingType, currentColor.getStyle());
    pendingType = null;
}

function disposeGroup(group) {
    group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => m.dispose());
        }
    });
}

function onResize() {
    if (!renderer || !host) return;
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function onVisibility() {
    if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = null;
    } else if (!raf && renderer && inView) {
        loop();
    }
}

let t = 0;
function loop() {
    raf = requestAnimationFrame(loop);
    t += 0.0045;

    // Gentle turntable + a touch of breathing bob.
    if (figure) {
        figure.rotation.y = Math.sin(t * 0.6) * 0.5; // sway between -28°..+28°
        figure.position.y = Math.sin(t * 1.6) * 0.012;
    }

    // Swap garment when the figure faces away (rotation near the extremes),
    // so the rebuild pop is hidden.
    if (pendingType && Math.abs(figure.rotation.y) > 0.42) {
        maybeSwapGarment();
    }

    // Ease the garment colour toward the target.
    currentColor.lerp(targetColor, 0.06);
    morphFlash *= 0.92;
    if (garment) {
        garment.traverse((o) => {
            if (o.isMesh && o.material) {
                o.material.color.copy(currentColor);
                if ("emissive" in o.material) {
                    o.material.emissive.copy(currentColor).multiplyScalar(morphFlash * 0.4);
                }
            }
        });
    }

    renderer.render(scene, camera);
}

function start() {
    if (prefersReduced() || !isWebGLAvailable()) return; // SVG stays
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => safeMount());
    } else {
        safeMount();
    }
}

function safeMount() {
    try {
        mount();
    } catch (err) {
        console.warn("[hero-3d] mount failed, keeping SVG:", err && err.message);
        const svg = document.querySelector(SVG_SELECTOR);
        if (svg) svg.style.opacity = "";
        if (host) host.classList.remove("is-live");
    }
}

start();
