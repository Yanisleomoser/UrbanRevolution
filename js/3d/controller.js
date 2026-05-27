/**
 * Urban Revolution — 3D Controller
 *
 * Orchestrates scene + avatars + garments. Subscribes to StateManager
 * for measurement / appearance / garment-state changes.
 *
 * Lifecycle rules:
 *   - Mannequin rebuilds on measurements / skinTone / hairColor changes
 *   - Garment rebuilds on type / fit / measurements changes
 *   - Garment color and material props update in-place (no rebuild)
 *
 * Graceful degradation: any failure during mount is caught here. The
 * rest of the app (design generation, measurements, spec export) keeps
 * working — none of it depends on the 3D module.
 */

import { Scene } from "./scene.js";
import { Avatars } from "./avatars.js";
import { Garments } from "./garments.js";

const CONTAINER_ID = "three-canvas";

let currentMannequin = null;
let currentGarment = null;
let mounted = false;

function mount() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
        console.warn("[3d] container not found, skipping mount");
        return;
    }

    try {
        if (!isWebGLAvailable()) {
            throw new Error("WebGL nicht verfügbar");
        }

        container.classList.remove("preview-placeholder");
        container.innerHTML = "";

        Scene.mount(container);
        rebuildMannequin();
        rebuildGarment();
        subscribeToState();
        mounted = true;
        console.info("[3d] mounted");
    } catch (err) {
        console.error("[3d] mount failed:", err);
        showMountFailure(container, err.message);
    }
}

function rebuildMannequin() {
    if (currentMannequin) {
        Scene.remove(currentMannequin);
        currentMannequin = null;
    }
    const measurements = readState("measurements");
    const appearance = {
        skinTone: readState("skinTone"),
        hairColor: readState("hairColor"),
    };
    currentMannequin = Avatars.buildMannequin(measurements, appearance);
    Scene.add(currentMannequin);
}

function rebuildGarment() {
    if (currentGarment) {
        Scene.remove(currentGarment);
        currentGarment = null;
    }
    const type = readState("currentType");
    if (!type) return;
    currentGarment = Garments.buildGarment(type, {
        color: readState("currentColor"),
        material: readState("currentMaterial"),
        measurements: readState("measurements"),
        fit: readState("currentFit"),
    });
    Scene.add(currentGarment);
}

function patchGarmentColor() {
    if (!currentGarment) return;
    Garments.setColor(currentGarment, readState("currentColor"));
    Scene.requestRender();
}

function patchGarmentMaterial() {
    if (!currentGarment) return;
    Garments.setMaterialProps(currentGarment, readState("currentMaterial"));
    Scene.requestRender();
}

function readState(key) {
    if (typeof window.StateManager === "undefined") return null;
    try {
        return window.StateManager.get(key);
    } catch (_err) {
        return null;
    }
}

function subscribeToState() {
    const sm = window.StateManager;
    if (typeof sm === "undefined") return;

    const onMannequinChange = () => safeRun(rebuildMannequin, "mannequin rebuild");
    const onGarmentRebuild = () => safeRun(rebuildGarment, "garment rebuild");
    const onColor = () => safeRun(patchGarmentColor, "garment color");
    const onMaterial = () => safeRun(patchGarmentMaterial, "garment material");
    const onMeasurements = () => {
        safeRun(rebuildMannequin, "mannequin rebuild");
        safeRun(rebuildGarment, "garment rebuild");
    };

    sm.subscribe("measurements:change", onMeasurements);
    sm.subscribe("skinTone:change", onMannequinChange);
    sm.subscribe("hairColor:change", onMannequinChange);
    sm.subscribe("currentType:change", onGarmentRebuild);
    sm.subscribe("currentFit:change", onGarmentRebuild);
    sm.subscribe("currentColor:change", onColor);
    sm.subscribe("currentMaterial:change", onMaterial);
}

function safeRun(fn, label) {
    if (!mounted) return;
    try {
        fn();
    } catch (err) {
        console.error(`[3d] ${label} failed:`, err);
    }
}

function isWebGLAvailable() {
    try {
        const canvas = document.createElement("canvas");
        return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch (_err) {
        return false;
    }
}

function showMountFailure(container, reason) {
    container.classList.add("preview-placeholder");
    container.innerHTML = `
        <div class="placeholder-content">
            <h3>3D-Vorschau nicht verfügbar</h3>
            <p>${reason}. Design-Generierung, Maße und Spec-Export funktionieren weiterhin.</p>
        </div>
    `;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
} else {
    mount();
}
