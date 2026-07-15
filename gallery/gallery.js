/* ============================================================
   The Gallery — sphärische WebGL-Galerie (phantom.land-Studie)

   Kamera sitzt im Zentrum einer Kugel, die Arbeiten hängen als
   Bild-Karten an deren Innenwand. Ziehen dreht den Blick mit
   Lenis-artigem Easing (Lerp + Trägheit), Klick auf eine Karte
   fährt die Kamera heran und blendet eine Detailseite ein.
   Eigenständiges Modul — nutzt nichts aus der Haupt-App.
   ============================================================ */

import * as THREE from "three";
import gsap from "gsap";

/* ---------- Daten ---------- */

const A = (p) => `/assets/${p}`;

// story/ ships pre-generated .avif + -sm JPEG/AVIF variants that used to sit
// unused (the gallery always fetched the full 1600px .jpg). AVIF support is
// feature-tested once (web.dev's canonical single-pixel test image, no network
// request) so unsupported browsers (e.g. Safari < 16.4) fall through to JPEG.
const isStoryPath = (src) => src.includes("/assets/story/");
const toSmJpg = (src) => src.replace(/\.jpg$/, "-sm.jpg");
const toAvif = (src) => src.replace(/\.jpg$/, ".avif");

function checkAvifSupport() {
    return new Promise((resolve) => {
        const avif = new Image();
        avif.onload = () => resolve(avif.width === 1);
        avif.onerror = () => resolve(false);
        avif.src =
            "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=";
    });
}
const avifReady = checkAvifSupport();

// Best URL for a given SOURCES jpg path. `small` picks the -sm variant (the
// wall texture is downsampled to <=560px anyway, see makeCardTexture — the
// full 1600px original was pure waste there). Non-story sources (no
// pre-generated variants) pass through unchanged.
async function bestSrc(jpgSrc, { small = false } = {}) {
    if (!isStoryPath(jpgSrc)) return jpgSrc;
    const jpg = small ? toSmJpg(jpgSrc) : jpgSrc;
    return (await avifReady) ? toAvif(jpg) : jpg;
}

// 36 Karten aus 18 Bildern — die zweite Verwendung bekommt einen
// engeren Bildausschnitt (crop) und liest sich als eigenes Motiv.
const SOURCES = [
    [A("hero-1.jpg"), "Tidal Coat", "Outerwear"],
    [A("hero-2.jpg"), "Halcyon Blazer", "Construction"],
    [A("hero-3.jpg"), "Meridian Dress", "Reclaimed"],
    [A("hero-4.jpg"), "Undertow Parka", "Outerwear"],
    [A("hero-5.jpg"), "Riptide Shirt", "Studio"],
    [A("hero-6.jpg"), "Sound & Salt", "Editorial"],
    [A("hero-wide.jpg"), "The Factory Floor", "Archive"],
    [A("vto-example.jpg"), "Second Skin", "Fittings"],
    [A("presets/f-1.jpg"), "Fitting No. 01", "Fittings"],
    [A("presets/f-2.jpg"), "Fitting No. 02", "Fittings"],
    [A("presets/f-3.jpg"), "Fitting No. 03", "Fittings"],
    [A("presets/m-1.jpg"), "Fitting No. 04", "Fittings"],
    [A("presets/m-2.jpg"), "Fitting No. 05", "Fittings"],
    [A("presets/m-3.jpg"), "Fitting No. 06", "Fittings"],
    [A("story/act1.jpg"), "Act I — Excess", "Editorial"],
    [A("story/act2.jpg"), "Act II — Descent", "Editorial"],
    [A("story/act3.jpg"), "Act III — Return", "Editorial"],
    [A("story/act4.jpg"), "Act IV — Renewal", "Editorial"],
];

// Varianten 2 + 3 jeder Quelle: engere Ausschnitte mit eigenem Titel.
const THIRD_TITLES = [
    ["Tidal — First Toile", "Toile"],
    ["Halcyon — Lining", "Process"],
    ["Meridian — Drape", "Toile"],
    ["Undertow — Shell", "Process"],
    ["Riptide — Collar", "Detail"],
    ["Salt Air", "Editorial"],
    ["Cutting Table", "Archive"],
    ["Second Skin II", "Fittings"],
    ["Portrait Study 01", "Editorial"],
    ["Portrait Study 02", "Editorial"],
    ["Portrait Study 03", "Editorial"],
    ["Portrait Study 04", "Editorial"],
    ["Portrait Study 05", "Editorial"],
    ["Portrait Study 06", "Editorial"],
    ["Excess — Texture", "Texture"],
    ["Descent — Texture", "Texture"],
    ["Return — Texture", "Texture"],
    ["Renewal — Texture", "Texture"],
];

const SECOND_TITLES = [
    ["Tidal Coat — Detail", "Archive"],
    ["Cut & Resolve", "Process"],
    ["Meridian, Recut", "Re-Cut"],
    ["North Passage", "Outerwear"],
    ["Riptide — Back", "Studio"],
    ["Stillwater", "Editorial"],
    ["Floor Plan 02", "Archive"],
    ["Skin Study", "Process"],
    ["Muse No. 01", "Identity"],
    ["Muse No. 02", "Identity"],
    ["Muse No. 03", "Identity"],
    ["Muse No. 04", "Identity"],
    ["Muse No. 05", "Identity"],
    ["Muse No. 06", "Identity"],
    ["Excess — Close", "Archive"],
    ["Descent — Close", "Archive"],
    ["Return — Close", "Archive"],
    ["Renewal — Close", "Archive"],
];

/* ---------- Konstanten / Helfer ---------- */

const RADIUS = 16;
const FOV = 70;
const PITCH_LIMIT = 0.6;
const REDUCED = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE_POINTER = globalThis.matchMedia("(pointer: fine)").matches;

// Deterministische Zufallsquelle → Layout bleibt über Reloads stabil.
function mulberry32(seed) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rng = mulberry32(20260611);
const rand = (min, max) => min + rng() * (max - min);
const wrapPi = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const dur = (s) => (REDUCED ? 0.01 : s);

/* ---------- DOM ---------- */

const canvas = document.getElementById("scene");
const veil = document.getElementById("veil");
const veilCount = document.getElementById("veil-count");
const hint = document.getElementById("hint");
const cursorEl = document.getElementById("cursor");
const labelEl = document.getElementById("hover-label");
const labelTitle = document.getElementById("hl-title");
const labelTag = document.getElementById("hl-tag");
const detail = document.getElementById("detail");
const detailImg = document.getElementById("detail-img");
const detailTag = document.getElementById("detail-tag");
const detailYear = document.getElementById("detail-year");
const detailTitle = document.getElementById("detail-title");
const detailBack = document.getElementById("detail-back");
canvas.tabIndex = -1;

/* ---------- Three.js Grundgerüst ---------- */

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (_err) {
    veilCount.textContent = ":(";
    veil.querySelector(".veil-sub").textContent = "WebGL is required for this experience";
    throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0e11);

const camera = new THREE.PerspectiveCamera(FOV, globalThis.innerWidth / globalThis.innerHeight, 0.1, 120);
camera.rotation.order = "YXZ";

// Staubpartikel — leise Tiefen-Referenz beim Drehen.
const dust = (() => {
    const count = 220;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r = rand(5, 13.5);
        const theta = rand(0, Math.PI * 2);
        const y = rand(-0.85, 0.85);
        const ring = Math.sqrt(1 - y * y);
        pos[i * 3] = Math.cos(theta) * ring * r;
        pos[i * 3 + 1] = y * r;
        pos[i * 3 + 2] = Math.sin(theta) * ring * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.045,
        color: 0x97a2b0,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return points;
})();

/* ---------- Karten an der Kugel-Innenwand ---------- */

// 3 Breitengrad-Bänder × 18 Längengrade, mit Jitter — wirkt wie ein
// organisches Raster (so hängt auch das phantom.land-Original).
const slots = [];
{
    const bands = [-0.5, 0, 0.5];
    const offsets = [0, Math.PI / 18, Math.PI / 36];
    for (let b = 0; b < bands.length; b++) {
        for (let i = 0; i < 18; i++) {
            slots.push({
                yaw: i * (Math.PI / 9) + offsets[b] + rand(-0.07, 0.07),
                pitch: bands[b] + rand(-0.09, 0.09),
                radius: RADIUS + rand(-1.4, 0.9),
                scale: rand(0.72, 1.38),
            });
        }
    }
    // Slots mischen, damit Bild-Varianten nicht nebeneinander hängen.
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }
}

const manager = new THREE.LoadingManager();
const imageLoader = new THREE.ImageLoader(manager);
const geometry = new THREE.PlaneGeometry(1, 1);
const cards = [];

// Pro Karte ein eigener, klein gerechneter Ausschnitt (Canvas) statt der
// vollen JPEGs — 54 GPU-Texturen bleiben so auch auf Phones bezahlbar.
function makeCardTexture(img, zoom, ox, oy) {
    const sw = img.width * zoom;
    const sh = img.height * zoom;
    const sx = (img.width - sw) * ox;
    const sy = (img.height - sh) * oy;
    const long = 560;
    const scale = Math.min(1, long / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(sw * scale));
    canvas.height = Math.max(2, Math.round(sh * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
}

SOURCES.forEach(([src, title, tag], i) => {
    const placeCards = (img, detailSrc) => {
        const variants = [
            { naming: [title, tag], zoom: 1 },
            { naming: SECOND_TITLES[i], zoom: 0.72 },
            { naming: THIRD_TITLES[i], zoom: 0.56 },
        ];
        variants.forEach((v, variant) => {
            const slot = slots[i * 3 + variant];
            const tex = makeCardTexture(img, v.zoom, rand(0.1, 0.9), rand(0.05, 0.45));
            const aspect = Math.min(1.85, Math.max(0.62, tex.image.width / tex.image.height));
            const h = (2.95 / Math.sqrt(aspect)) * slot.scale;
            const w = h * aspect;
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
            const mesh = new THREE.Mesh(geometry, mat);
            const cp = Math.cos(slot.pitch);
            mesh.position.set(
                -Math.sin(slot.yaw) * cp * slot.radius,
                Math.sin(slot.pitch) * slot.radius,
                -Math.cos(slot.yaw) * cp * slot.radius,
            );
            mesh.lookAt(0, 0, 0);
            mesh.scale.set(w, h, 1);
            mesh.userData = {
                title: v.naming[0],
                tag: v.naming[1],
                year: 2024 + Math.floor(rng() * 3),
                src: detailSrc,
                w,
                h,
            };
            scene.add(mesh);
            cards.push(mesh);
        });
    };

    // The wall texture only ever needs <=560px (see makeCardTexture), so story
    // cards fetch the much smaller -sm variant, AVIF-first with a JPEG retry
    // if decoding unexpectedly fails; the detail-view <img> (openCard below)
    // gets the full-resolution AVIF/JPEG instead, since it's shown large and
    // is only ever fetched lazily on click.
    Promise.all([bestSrc(src, { small: true }), bestSrc(src, { small: false })]).then(
        ([textureSrc, detailSrc]) => {
            imageLoader.load(
                textureSrc,
                (img) => placeCards(img, detailSrc),
                undefined,
                () => {
                    const fallback = toSmJpg(src);
                    if (textureSrc !== fallback) imageLoader.load(fallback, (img) => placeCards(img, src));
                },
            );
        },
    );
});

/* ---------- Blicksteuerung — Lenis-artiges Easing ---------- */

// Start-Blick: yaw 1.2 rahmt im seeded Layout die dichteste Kartenwand;
// das Intro gleitet von 0.65 dorthin (Ziel wird erst beim Veil-Lift gesetzt,
// damit die Fahrt sichtbar ist und nicht hinterm Veil passiert).
const rot = { yaw: 0.65, pitch: 0 };           // tatsächliche Kamera-Rotation
const target = { yaw: 0.65, pitch: 0 };        // Zielwert (Drag/Wheel/Tasten)
const vel = { yaw: 0, pitch: 0 };              // Trägheit nach dem Loslassen
const state = {
    dragging: false,
    pointerId: null,
    moved: 0,
    downAt: 0,
    open: false,
    intro: true,
    lastInteract: performance.now(),
    hintShown: true,
};
const pointer = { x: globalThis.innerWidth / 2, y: globalThis.innerHeight / 2, inside: false };
const DRAG_YAW = 0.0036;
const DRAG_PITCH = 0.0024;

const clampPitch = () => {
    target.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, target.pitch));
};

const lastPointer = { x: 0, y: 0 };

function onDown(e) {
    if (state.open || state.intro || state.pointerId !== null) return;
    state.pointerId = e.pointerId;
    state.dragging = true;
    state.moved = 0;
    state.downAt = performance.now();
    vel.yaw = vel.pitch = 0;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    state.lastInteract = performance.now();
    document.body.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
}

function onMove(e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    if (!state.dragging || e.pointerId !== state.pointerId) return;
    // Deltas aus clientX/Y: movementX ist auf iOS-Safari für Touch-Pointer
    // unzuverlässig (0/ganzzahlig gerundet) → fühlte sich ruckelig an.
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    state.moved += Math.abs(dx) + Math.abs(dy);
    const s = e.pointerType === "touch" ? 1.3 : 1;
    target.yaw += dx * DRAG_YAW * s;
    target.pitch += dy * DRAG_PITCH * s;
    clampPitch();
    // Geschwindigkeit der letzten Bewegungen mitschreiben → Trägheit.
    vel.yaw = vel.yaw * 0.8 + dx * DRAG_YAW * s * 0.2;
    vel.pitch = vel.pitch * 0.8 + dy * DRAG_PITCH * s * 0.2;
    state.lastInteract = performance.now();
    if (state.moved > 60 && state.hintShown) {
        state.hintShown = false;
        gsap.to(hint, { autoAlpha: 0, duration: dur(0.6), ease: "power2.out" });
    }
}

function onUp(e) {
    if (e.pointerId !== state.pointerId) return;
    state.pointerId = null;
    state.dragging = false;
    document.body.classList.remove("is-dragging");
    state.lastInteract = performance.now();
    const quick = performance.now() - state.downAt < 450;
    if (state.moved < 6 && quick) {
        vel.yaw = vel.pitch = 0;
        tryOpenAt(e.clientX, e.clientY);
    }
}

function onWheel(e) {
    if (state.open || state.intro) return;
    e.preventDefault();
    target.yaw += (e.deltaY + e.deltaX) * 0.00042;
    vel.yaw = vel.pitch = 0;
    state.lastInteract = performance.now();
}

function onKey(e) {
    if (e.key === "Escape" && state.open) { closeCard(); return; }
    if (state.open || state.intro) return;
    const step = { ArrowLeft: [0.22, 0], ArrowRight: [-0.22, 0], ArrowUp: [0, 0.16], ArrowDown: [0, -0.16] }[e.key];
    if (!step) return;
    target.yaw += step[0];
    target.pitch += step[1];
    clampPitch();
    state.lastInteract = performance.now();
}

canvas.addEventListener("pointerdown", onDown);
globalThis.addEventListener("pointermove", onMove);
globalThis.addEventListener("pointerup", onUp);
globalThis.addEventListener("pointercancel", onUp);
canvas.addEventListener("wheel", onWheel, { passive: false });
globalThis.addEventListener("keydown", onKey);
canvas.addEventListener("pointerleave", () => { pointer.inside = false; });

/* ---------- Hover (Raycast) + Cursor + Label ---------- */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
const cursorPos = { x: pointer.x, y: pointer.y, scale: 1 };
const labelPos = { x: pointer.x, y: pointer.y };

function pick(x, y) {
    ndc.set((x / globalThis.innerWidth) * 2 - 1, -(y / globalThis.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(cards, false);
    return hits.length ? hits[0].object : null;
}

function setHovered(mesh) {
    if (hovered === mesh) return;
    if (hovered) {
        const u = hovered.userData;
        gsap.to(hovered.scale, { x: u.w, y: u.h, duration: 0.45, ease: "power3.out", overwrite: "auto" });
    }
    hovered = mesh;
    document.body.classList.toggle("has-hover", !!mesh);
    if (mesh) {
        const u = mesh.userData;
        gsap.to(mesh.scale, { x: u.w * 1.07, y: u.h * 1.07, duration: 0.5, ease: "power3.out", overwrite: "auto" });
        labelTitle.textContent = u.title;
        labelTag.textContent = `${u.tag} — ${u.year}`;
        if (FINE_POINTER) gsap.to(labelEl, { autoAlpha: 1, duration: 0.3, overwrite: "auto" });
    } else {
        gsap.to(labelEl, { autoAlpha: 0, duration: 0.25, overwrite: "auto" });
    }
}

/* ---------- Detailseite öffnen / schließen ---------- */

let activeCard = null;

function splitTitle(el, text) {
    el.textContent = "";
    text.split(" ").forEach((word, i) => {
        const outer = document.createElement("span");
        outer.className = "w";
        const inner = document.createElement("span");
        inner.textContent = word;
        outer.appendChild(inner);
        el.appendChild(outer);
        if (i < text.split(" ").length - 1) el.appendChild(document.createTextNode(" "));
    });
    return el.querySelectorAll(".w > span");
}

function tryOpenAt(x, y) {
    const mesh = pick(x, y);
    if (mesh) openCard(mesh);
}

function openCard(mesh) {
    if (state.open) return;
    state.open = true;
    activeCard = mesh;
    setHovered(null);
    document.body.classList.add("is-open");
    const u = mesh.userData;

    // Defensive JPEG retry: the avifReady feature test gates the initial pick,
    // but a still-broken decode (rare, e.g. a buggy intermediary) shouldn't
    // leave the detail hero blank.
    detailImg.onerror = () => {
        detailImg.onerror = null;
        if (u.src.endsWith(".avif")) detailImg.src = u.src.replace(/\.avif$/, ".jpg");
    };
    detailImg.src = u.src;
    detailImg.alt = u.title;
    detailTag.textContent = u.tag;
    detailYear.textContent = u.year;
    const words = splitTitle(detailTitle, u.title);
    detail.setAttribute("aria-hidden", "false");
    detail.style.visibility = "visible";
    detail.scrollTop = 0;

    // Kamera zentriert die Karte (kürzester Yaw-Weg) und fährt heran.
    const n = mesh.position.clone().normalize();
    const yawGoal = target.yaw + wrapPi(Math.atan2(-n.x, -n.z) - target.yaw);
    const pitchGoal = Math.asin(n.y);
    vel.yaw = vel.pitch = 0;

    const tl = gsap.timeline({ defaults: { ease: "power3.inOut" } });
    tl.to(target, { yaw: yawGoal, pitch: pitchGoal, duration: dur(0.85), ease: "power2.inOut" }, 0)
        .to(camera.position, {
            x: n.x * RADIUS * 0.45,
            y: n.y * RADIUS * 0.45,
            z: n.z * RADIUS * 0.45,
            duration: dur(1.05),
            overwrite: "auto",
        }, 0)
        .to(camera, {
            fov: 58,
            duration: dur(1.05),
            overwrite: "auto",
            onUpdate: () => camera.updateProjectionMatrix(),
        }, 0)
        .to([hint, cursorEl], { autoAlpha: 0, duration: dur(0.3) }, 0)
        // y:0 mitsetzen — GSAP übernimmt das CSS-translateY(102%) sonst als
        // Basis-y und das Overlay käme nie oben an.
        .fromTo(detail, { y: 0, yPercent: 102 }, { y: 0, yPercent: 0, duration: dur(0.85), ease: "power3.inOut" }, 0.42)
        .fromTo(detailImg, { scale: 1.18 }, { scale: 1, duration: dur(1.1), ease: "power3.out" }, 0.62)
        .fromTo(words, { yPercent: 112 }, { yPercent: 0, duration: dur(0.7), ease: "power3.out", stagger: 0.055 }, 0.78)
        .fromTo(
            detail.querySelectorAll(".detail-meta, .detail-body p, .detail-esc"),
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: dur(0.6), ease: "power2.out", stagger: 0.07 },
            0.86,
        )
        .add(() => detailBack.focus({ preventScroll: true }), 0.95);
}

function closeCard() {
    if (!state.open) return;
    const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
            state.open = false;
            activeCard = null;
            state.lastInteract = performance.now();
            detail.setAttribute("aria-hidden", "true");
            detail.style.visibility = "hidden";
            document.body.classList.remove("is-open");
            canvas.focus({ preventScroll: true });
        },
    });
    tl.to(detail, { y: 0, yPercent: 102, duration: dur(0.7), ease: "power3.in" }, 0)
        .to(camera.position, { x: 0, y: 0, z: 0, duration: dur(1.0), overwrite: "auto" }, 0.15)
        .to(camera, {
            fov: FOV,
            duration: dur(1.0),
            overwrite: "auto",
            onUpdate: () => camera.updateProjectionMatrix(),
        }, 0.15)
        .to(cursorEl, { autoAlpha: FINE_POINTER ? 1 : 0, duration: dur(0.3) }, 0.6);
}

detailBack.addEventListener("click", closeCard);

/* ---------- Render-Loop ---------- */

const clock = new THREE.Clock();

function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();

    // Trägheit: nach dem Loslassen weiterdrehen, sanft ausrollen.
    if (!state.dragging && !state.open && (Math.abs(vel.yaw) > 1e-5 || Math.abs(vel.pitch) > 1e-5)) {
        target.yaw += vel.yaw * dt * 60;
        target.pitch += vel.pitch * dt * 60;
        clampPitch();
        const decay = Math.exp(-dt * 2.6);   // länger ausrollen (flüssiger)
        vel.yaw *= decay;
        vel.pitch *= decay;
    }

    // Leise Eigenrotation, wenn länger nichts passiert.
    if (!REDUCED && !state.open && !state.dragging && now - state.lastInteract > 5000) {
        target.yaw += dt * 0.02;
    }

    // Lenis-Gefühl: exponentielles Nachziehen, framerate-unabhängig.
    const k = 1 - Math.exp(-dt * (state.open ? 7.5 : 4.3));   // weicheres Nachziehen
    rot.yaw += (target.yaw - rot.yaw) * k;
    rot.pitch += (target.pitch - rot.pitch) * k;
    camera.rotation.set(rot.pitch, rot.yaw, 0);

    dust.rotation.y += dt * 0.006;

    // Hover nur im freien Zustand prüfen.
    if (!state.open && !state.intro && !state.dragging && pointer.inside) {
        setHovered(pick(pointer.x, pointer.y));
    } else if (state.dragging && hovered) {
        setHovered(null);
    }

    // Nicht-fokussierte Karten beim Öffnen wegdimmen.
    for (const m of cards) {
        const targetOpacity = state.open ? (m === activeCard ? 1 : 0.05) : 1;
        const o = m.material.opacity;
        if (Math.abs(o - targetOpacity) > 0.001) {
            m.material.opacity = o + (targetOpacity - o) * Math.min(1, dt * 6);
        }
    }

    // Custom-Cursor + Hover-Label nachziehen.
    if (FINE_POINTER) {
        cursorPos.x += (pointer.x - cursorPos.x) * 0.32;
        cursorPos.y += (pointer.y - cursorPos.y) * 0.32;
        const cs = state.dragging ? 0.66 : (hovered ? 3.1 : 1);
        cursorPos.scale += (cs - cursorPos.scale) * 0.2;
        cursorEl.style.transform =
            `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0) scale(${cursorPos.scale.toFixed(3)})`;
        labelPos.x += (pointer.x - labelPos.x) * 0.22;
        labelPos.y += (pointer.y - labelPos.y) * 0.22;
        labelEl.style.transform = `translate3d(${labelPos.x + 22}px, ${labelPos.y + 24}px, 0)`;
    }

    renderer.render(scene, camera);
}

document.addEventListener("visibilitychange", () => {
    renderer.setAnimationLoop(document.hidden ? null : tick);
});

globalThis.addEventListener("resize", () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
});

/* ---------- Laden + Intro ---------- */

const progress = { shown: 0 };
manager.onProgress = (_url, loaded, total) => {
    gsap.to(progress, {
        shown: Math.round((loaded / total) * 100),
        duration: 0.4,
        ease: "power1.out",
        overwrite: "auto",
        onUpdate: () => { veilCount.textContent = String(Math.round(progress.shown)); },
    });
};
manager.onError = (url) => console.warn("[gallery] asset failed to load:", url);

manager.onLoad = () => {
    renderer.setAnimationLoop(tick);
    const tl = gsap.timeline({ onComplete: () => { state.intro = false; } });
    tl.to(progress, {
        shown: 100,
        duration: dur(0.35),
        ease: "power1.out",
        overwrite: "auto",
        onUpdate: () => { veilCount.textContent = String(Math.round(progress.shown)); },
    })
        .add(() => { target.yaw = 1.2; })
        .to(veil, {
            yPercent: -100,
            duration: dur(0.9),
            ease: "power4.inOut",
            onComplete: () => { veil.style.display = "none"; },
        }, "<")
        .add(() => {
            if (REDUCED) {
                rot.yaw = target.yaw;
                rot.pitch = target.pitch;
                return;
            }
            cards.forEach((m) => {
                gsap.fromTo(m.scale,
                    { x: 0.001, y: 0.001 },
                    {
                        x: m.userData.w,
                        y: m.userData.h,
                        duration: 1.15,
                        ease: "back.out(1.35)",
                        delay: Math.random() * 0.7,
                        overwrite: "auto",
                    });
            });
            gsap.fromTo(camera, { fov: 88 }, {
                fov: FOV,
                duration: 1.9,
                ease: "power3.out",
                onUpdate: () => camera.updateProjectionMatrix(),
            });
        }, "-=0.4");
    if (FINE_POINTER) gsap.set(cursorEl, { autoAlpha: 1 });
    else gsap.set(cursorEl, { autoAlpha: 0 });
};

// Mess-Haken für headless-Checks (keine UI-Funktion).
globalThis.__gallery = { rot, target, state, cards, camera };
