/**
 * Urban Revolution — 3D Controller
 *
 * Orchestrates scene + avatars + (later) garments. Subscribes to
 * StateManager for measurement changes and rebuilds the mannequin
 * in-place.
 *
 * Graceful degradation: any failure during mount (no WebGL, scene
 * exception, missing container) is caught here, logged, and the
 * placeholder content is left in place. The rest of the app keeps
 * working — design generation, measurements, and spec export do not
 * depend on the 3D module.
 */

import { Scene } from "./scene.js";
import { Avatars } from "./avatars.js";

const CONTAINER_ID = "three-canvas";

let currentMannequin = null;
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
        subscribeToMeasurements();
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

function readState(key) {
    if (typeof window.StateManager === "undefined") return null;
    try {
        return window.StateManager.get(key);
    } catch (_err) {
        return null;
    }
}

function subscribeToMeasurements() {
    if (typeof window.StateManager === "undefined") return;
    const rebuildOnChange = () => {
        if (!mounted) return;
        try {
            rebuildMannequin();
        } catch (err) {
            console.error("[3d] rebuild failed:", err);
        }
    };
    window.StateManager.subscribe("measurements:change", rebuildOnChange);
    window.StateManager.subscribe("skinTone:change", rebuildOnChange);
    window.StateManager.subscribe("hairColor:change", rebuildOnChange);
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
