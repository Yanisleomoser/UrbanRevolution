/**
 * Urban Revolution — 3D Controller
 *
 * Orchestrates scene + avatars + garments. Subscribes to StateManager
 * for measurement / appearance / garment-state changes.
 *
 * Lifecycle rules:
 *   - Mannequin rebuilds on measurements / skinTone / hairColor changes
 *   - Garment rebuilds on type / fit / length / measurements changes
 *   - Garment color, material props and print update in-place (no rebuild)
 *
 * Graceful degradation: any failure during mount is caught here. The
 * rest of the app (design generation, measurements, spec export) keeps
 * working — none of it depends on the 3D module.
 */

// Dynamic imports — these only fire when mount() actually runs, which
// means Three.js (~600 KB), the avatar builder, and the garment library
// don't enter the network or parse pipeline until the user scrolls
// near the preview section. Significant LCP improvement for visitors
// who never reach the 3D step.
let Scene = null;
let Avatars = null;
let Garments = null;

async function loadModules() {
    if (Scene && Avatars && Garments) return;
    const [sceneMod, avatarsMod, garmentsMod] = await Promise.all([
        import("./scene.js"),
        import("./avatars.js"),
        import("./garments.js"),
    ]);
    Scene = sceneMod.Scene;
    Avatars = avatarsMod.Avatars;
    Garments = garmentsMod.Garments;
}

const CONTAINER_ID = "three-canvas";

let currentMannequin = null;
let currentGarment = null;
let mounted = false;
let mountInFlight = false;

async function mount() {
    if (mounted || mountInFlight) return;
    mountInFlight = true;

    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
        console.warn("[3d] container not found, skipping mount");
        mountInFlight = false;
        return;
    }

    try {
        if (!isWebGLAvailable()) {
            throw new Error("WebGL nicht verfügbar");
        }

        await loadModules();

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
    } finally {
        mountInFlight = false;
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
    // Hide the mannequin's base-layer shorts for leg-covering garments so
    // they can't clip through a narrower waistband.
    Avatars.setBaseLayerForGarment(currentMannequin, type);
    currentGarment = Garments.buildGarment(type, {
        color: readState("currentColor"),
        material: readState("currentMaterial"),
        measurements: readState("measurements"),
        fit: readState("currentFit"),
        length: readState("currentLength"),
        print: readState("currentPrint"),
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

function patchGarmentPrint() {
    if (!currentGarment) return;
    Garments.setPrint(currentGarment, readState("currentPrint"));
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
    const onPrint = () => safeRun(patchGarmentPrint, "garment print");
    const onMeasurements = () => {
        safeRun(rebuildMannequin, "mannequin rebuild");
        safeRun(rebuildGarment, "garment rebuild");
    };

    sm.subscribe("measurements:change", onMeasurements);
    sm.subscribe("skinTone:change", onMannequinChange);
    sm.subscribe("hairColor:change", onMannequinChange);
    sm.subscribe("currentType:change", onGarmentRebuild);
    sm.subscribe("currentFit:change", onGarmentRebuild);
    sm.subscribe("currentLength:change", onGarmentRebuild);
    sm.subscribe("currentColor:change", onColor);
    sm.subscribe("currentMaterial:change", onMaterial);
    sm.subscribe("currentPrint:change", onPrint);
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

// Lazy-mount: defer Three.js initialisation (avatars, garments, scene
// graph, render loop) until the preview section enters the viewport.
// Without this, every page load pays the full Three.js cost even
// though most visitors never scroll past the hero/design step.
function scheduleMount() {
    const container = document.getElementById("three-canvas");
    if (!container) return;

    if (!("IntersectionObserver" in window)) {
        mount();
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                observer.disconnect();
                mount();
                break;
            }
        }
    }, {
        // Begin mounting one viewport before the section actually shows,
        // so the scene is warm by the time the user arrives.
        rootMargin: "100% 0px 0px 0px",
        threshold: 0.01,
    });

    observer.observe(container);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleMount);
} else {
    scheduleMount();
}
