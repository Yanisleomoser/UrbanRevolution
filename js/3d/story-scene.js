/**
 * Urban Revolution — Visual Scroll Story (WebGL stage)
 *
 * One GPU particle system (a single BufferGeometry of points) morphs
 * through SIX target formations as the user scrolls the pinned story
 * section — each formation visualises its act's text 1:1:
 *
 *   I   Overproduction → a chaotic heap of discarded garments
 *   II  Injustice      → waves washing waste onto a foreign shore
 *   III Ecosystem      → pervasive microplastic rain filling the field
 *   IV  The human      → a lone figure dwarfed by a looming waste mound
 *   V   Belief         → chaos resolves into flowing silk threads
 *   VI  Vision         → threads weave a tailored figure; the jacket glows
 *
 * Scroll progress (0→1) is read passively and eased per frame, so the
 * morph scrubs smoothly. Each act's centre shows its pure formation;
 * transitions happen across act boundaries. Text acts are toggled via
 * `.is-active`. Self-contained ES module (imports `three` from the import
 * map). Degrades gracefully: prefers-reduced-motion / no-WebGL → CSS
 * shows static, readable acts.
 */

import * as THREE from "three";

const COUNT = 7000;          // particle count — mobile-safe, dense enough
const THREADS = 52;          // silk threads in the "belief" formation
const EASE = 0.07;           // scroll-progress smoothing per frame

// Brand gradient stops (the editorial palette).
const C_PINK = new THREE.Color("#EC4899");
const C_PURPLE = new THREE.Color("#A855F7");
const C_BLUE = new THREE.Color("#3B82F6");
// Mood palette for the dark acts.
const C_WASTE_LO = new THREE.Color("#2c2c30");
const C_WASTE_HI = new THREE.Color("#5b554c");
const C_SEA = new THREE.Color("#22323d");   // cold, desaturated water
const C_TOXIC = new THREE.Color("#2f6b5f"); // sickly microplastic teal
const C_SKIN = new THREE.Color("#7a6253");  // dim, human warmth
const C_DIM = new THREE.Color("#8a8f99");   // quiet (non-jacket) body

let renderer = null;
let scene = null;
let camera = null;
let points = null;
let halo = null;
let group = null;

let formations = [];         // [{ pos:Float32Array, col:Float32Array }, …]
let jacketMask = null;       // Uint8Array(COUNT) — 1 for jacket particles (act VI)
let posAttr, colAttr;        // live BufferAttributes

let track = null;
let acts = [];
let actNumEl = null;

let targetProgress = 0;
let easedProgress = 0;
let currentAct = -1;
let inView = true;
let rafId = 0;
let intersectionObserver = null;
let scrollListener = null;
let resizeListener = null;

const tmp = new THREE.Color();
const vec = new THREE.Vector3();

/* ---------- helpers ---------- */

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function smoothstep(x) {
    x = THREE.MathUtils.clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
}

// Color along the brand gradient (t: 0=pink → 0.52=purple → 1=blue).
function gradientColor(t, out) {
    if (t < 0.52) out.copy(C_PINK).lerp(C_PURPLE, t / 0.52);
    else out.copy(C_PURPLE).lerp(C_BLUE, (t - 0.52) / 0.48);
    return out;
}

function alloc() {
    return { pos: new Float32Array(COUNT * 3), col: new Float32Array(COUNT * 3) };
}

function set(f, i, x, y, z, c) {
    f.pos[i * 3] = x; f.pos[i * 3 + 1] = y; f.pos[i * 3 + 2] = z;
    f.col[i * 3] = c.r; f.col[i * 3 + 1] = c.g; f.col[i * 3 + 2] = c.b;
}

// A point near a line segment (a limb capsule) with radial jitter.
function pointOnSegment(ax, ay, az, bx, by, bz, radius, out) {
    const t = Math.random();
    out.set(
        ax + (bx - ax) * t + rand(-radius, radius),
        ay + (by - ay) * t + rand(-radius, radius),
        az + (bz - az) * t + rand(-radius, radius),
    );
}

// Sample a random point on a standing humanoid; returns the body part so
// callers can colour the jacket region. Figure spans y ≈ -2.25 … 2.1.
function sampleHuman(out) {
    const r = Math.random();
    if (r < 0.1) {
        const a = rand(0, Math.PI * 2);
        const b = Math.acos(rand(-1, 1));
        const rr = 0.32 * Math.cbrt(Math.random());
        out.set(Math.sin(b) * Math.cos(a) * rr, 1.78 + Math.cos(b) * rr, Math.sin(b) * Math.sin(a) * rr);
        return "head";
    }
    if (r < 0.5) {
        const ty = rand(0.45, 1.55);
        const taper = 0.5 + (ty - 0.45) / 1.1 * 0.18; // wider shoulders, nipped waist
        out.set(rand(-taper, taper), ty, rand(-0.28, 0.28));
        return "torso";
    }
    if (r < 0.72) {
        const side = Math.random() < 0.5 ? -1 : 1;
        pointOnSegment(side * 0.58, 1.45, 0, side * 0.82, 0.45, 0.05, 0.12, out);
        return "arms";
    }
    const side = Math.random() < 0.5 ? -1 : 1;
    pointOnSegment(side * 0.2, 0.45, 0, side * 0.26, -2.25, 0, 0.14, out);
    return "legs";
}

/* ---------- the six formations ---------- */

// I — Overproduction: a chaotic mound of discarded garments.
function buildHeap() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const a = rand(0, Math.PI * 2);
        const rad = Math.sqrt(Math.random()) * 2.7;
        const mound = 1 - rad / 2.7;
        const y = -2.3 + mound * 2.6 * Math.random() + rand(-0.28, 0.28);
        if (Math.random() < 0.06) tmp.copy(C_BLUE).lerp(C_WASTE_HI, 0.55).multiplyScalar(0.5);
        else tmp.copy(C_WASTE_LO).lerp(C_WASTE_HI, Math.random()).multiplyScalar(rand(0.55, 1));
        set(f, i, Math.cos(a) * rad, y, Math.sin(a) * rad * 0.6, tmp);
    }
    return f;
}

// II — Injustice: a cold sea, and our cast-offs washed up on a foreign shore.
function buildShore() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        if (Math.random() < 0.58) {
            // undulating sea surface, spread wide to the horizon
            const x = rand(-3.6, 3.6);
            const z = rand(-1.8, 1.8);
            const y = -1.9 + Math.sin(x * 1.2) * 0.22 + Math.sin(z * 1.7 + x) * 0.14 + rand(-0.07, 0.07);
            tmp.copy(C_SEA).multiplyScalar(rand(0.5, 1));
            set(f, i, x, y, z, tmp);
        } else {
            // a heap of waste beached on the right — someone else's coast
            const a = rand(0, Math.PI * 2);
            const rad = Math.sqrt(Math.random()) * 1.5;
            const y = -1.7 + (1 - rad / 1.5) * 1.5 * Math.random() + rand(-0.14, 0.14);
            tmp.copy(C_WASTE_LO).lerp(C_WASTE_HI, Math.random()).multiplyScalar(rand(0.5, 0.95));
            set(f, i, 2.1 + Math.cos(a) * rad, y, Math.sin(a) * rad * 0.7, tmp);
        }
    }
    return f;
}

// III — Ecosystem: pervasive microplastic, everywhere — rain, fish, blood.
function buildRain() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const x = rand(-3.6, 3.6);
        const y = rand(-3, 3);
        const z = rand(-2, 2);
        tmp.copy(C_TOXIC).multiplyScalar(rand(0.3, 0.9));
        set(f, i, x, y, z, tmp);
    }
    return f;
}

// IV — The human: a lone figure on the left, dwarfed by a looming mound.
function buildLoneHuman() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        if (Math.random() < 0.4) {
            sampleHuman(vec);
            vec.multiplyScalar(0.62);      // small, vulnerable
            vec.x -= 1.8; vec.y -= 0.25;
            tmp.copy(C_SKIN).multiplyScalar(rand(0.4, 0.72));
            set(f, i, vec.x, vec.y, vec.z, tmp);
        } else {
            const a = rand(0, Math.PI * 2);
            const rad = Math.sqrt(Math.random()) * 2.1;
            const y = -2.2 + (1 - rad / 2.1) * 3.4 * Math.random() + rand(-0.2, 0.2);
            tmp.copy(C_WASTE_LO).lerp(C_WASTE_HI, Math.random() * 0.6).multiplyScalar(rand(0.4, 0.8));
            set(f, i, 1.7 + Math.cos(a) * rad, y, Math.sin(a) * rad * 0.6, tmp);
        }
    }
    return f;
}

// V — Belief: chaos resolves into fine, flowing silk threads (the gradient).
function buildThreads() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const thread = i % THREADS;
        const baseX = ((thread / (THREADS - 1)) - 0.5) * 5.4;
        const phase = thread * 1.7;
        const p = Math.random();
        const y = -2.8 + p * 5.6;
        const x = baseX + Math.sin(p * Math.PI * 2.2 + phase) * 0.32 + rand(-0.04, 0.04);
        const z = Math.cos(p * Math.PI * 1.8 + phase) * 0.5 + rand(-0.04, 0.04);
        gradientColor(p, tmp);
        set(f, i, x, y, z, tmp);
    }
    return f;
}

// VI — Vision: a tailored figure; the jacket region carries the glowing gradient.
function buildFigure() {
    const f = alloc();
    jacketMask = new Uint8Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        let part;
        if (Math.random() < 0.12) {
            const a = rand(0, Math.PI * 2);
            const rr = rand(0.9, 1.7);
            vec.set(Math.cos(a) * rr, rand(0.6, 1.6), Math.sin(a) * rr - 0.1);
            part = "halo";
        } else {
            part = sampleHuman(vec);
        }
        const isJacket = part === "torso" || part === "arms" || part === "halo";
        jacketMask[i] = isJacket ? 1 : 0;
        if (isJacket) {
            gradientColor(THREE.MathUtils.clamp((vec.y + 2.3) / 4.3, 0, 1), tmp);
            if (part === "halo") tmp.multiplyScalar(0.6);
        } else {
            tmp.copy(C_DIM).multiplyScalar(rand(0.35, 0.6));
        }
        set(f, i, vec.x, vec.y, vec.z, tmp);
    }
    return f;
}

/* ---------- sprites ---------- */

function makeSprite() {
    const s = 64;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function makeHalo() {
    const s = 256;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(168,85,247,0.55)");
    g.addColorStop(0.5, "rgba(236,72,153,0.22)");
    g.addColorStop(1, "rgba(59,130,246,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
    }));
    sprite.scale.set(6, 6, 1);
    sprite.position.set(0, 0.9, -0.5);
    return sprite;
}

/* ---------- per-frame morph ---------- */

function updateMorph(time) {
    const p = easedProgress;
    const NF = formations.length;

    // Each act centre shows its pure formation; boundaries cross-fade.
    const fp = THREE.MathUtils.clamp(p * acts.length - 0.5, 0, NF - 1);
    const i = Math.floor(fp);
    const local = smoothstep(fp - i);
    const A = formations[i];
    const B = formations[Math.min(i + 1, NF - 1)];

    // How fully the closing "figure" formation has resolved (for the glow).
    const figureAmt = THREE.MathUtils.clamp(fp - (NF - 2), 0, 1);
    const pulse = 1 + Math.sin(time * 2.2) * 0.18;

    const pos = posAttr.array;
    const col = colAttr.array;
    for (let k = 0; k < COUNT; k++) {
        const j = k * 3;
        // morph position + a faint per-particle shimmer so it always breathes
        pos[j] = A.pos[j] + (B.pos[j] - A.pos[j]) * local + Math.sin(time * 0.7 + k) * 0.015;
        pos[j + 1] = A.pos[j + 1] + (B.pos[j + 1] - A.pos[j + 1]) * local + Math.cos(time * 0.6 + k * 1.3) * 0.015;
        pos[j + 2] = A.pos[j + 2] + (B.pos[j + 2] - A.pos[j + 2]) * local;

        let r = A.col[j] + (B.col[j] - A.col[j]) * local;
        let g = A.col[j + 1] + (B.col[j + 1] - A.col[j + 1]) * local;
        let b = A.col[j + 2] + (B.col[j + 2] - A.col[j + 2]) * local;
        if (jacketMask[k] && figureAmt > 0) {
            const amt = 1 + (pulse - 1) * figureAmt;
            r *= amt; g *= amt; b *= amt;
        }
        col[j] = r; col[j + 1] = g; col[j + 2] = b;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    halo.material.opacity = (figureAmt * figureAmt) * (0.6 + Math.sin(time * 2.2) * 0.18);

    group.rotation.y = Math.sin(time * 0.12) * 0.14 + p * 0.2;

    // Camera: pull in as the vision resolves; back off on narrow viewports
    // so the wide sea/rain formations stay in frame.
    const zBase = camera.aspect < 1 ? 10.5 : 7.8;
    camera.position.z = zBase - p * 1.4;
    camera.lookAt(0, -0.1 + p * 0.2, 0);
}

/* ---------- scroll + acts ---------- */

function setAct(idx) {
    acts.forEach((el, k) => el.classList.toggle("is-active", k === idx));
    if (actNumEl) actNumEl.textContent = String(idx + 1).padStart(2, "0");
}

function readProgress() {
    const rect = track.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return;
    targetProgress = THREE.MathUtils.clamp(-rect.top / scrollable, 0, 1);

    const idx = Math.min(acts.length - 1, Math.floor(targetProgress * acts.length));
    if (idx !== currentAct) {
        currentAct = idx;
        setAct(idx);
    }
}

/* ---------- cleanup / loop / resize ---------- */

function cleanup() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (scrollListener) { window.removeEventListener("scroll", scrollListener, { passive: true }); scrollListener = null; }
    if (resizeListener) { window.removeEventListener("resize", resizeListener, { passive: true }); resizeListener = null; }
    if (intersectionObserver) { intersectionObserver.disconnect(); intersectionObserver = null; }
}

function loop() {
    rafId = requestAnimationFrame(loop);
    if (!inView) return;
    easedProgress += (targetProgress - easedProgress) * EASE;
    updateMorph(performance.now() * 0.001);
    renderer.render(scene, camera);
}

function resize() {
    const canvas = renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

/* ---------- mount ---------- */

function mount() {
    const section = document.getElementById("mission");
    const canvas = document.getElementById("story-canvas");
    if (!section || !canvas) return;

    if (window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return; // CSS shows static acts
    }

    track = section.querySelector("[data-story]");
    acts = Array.from(section.querySelectorAll(".story-act"));
    actNumEl = section.querySelector("[data-act-num]");
    if (!track || acts.length < 2) return;

    const totalEl = section.querySelector("[data-act-total]");
    if (totalEl) totalEl.textContent = String(acts.length).padStart(2, "0");

    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
        });
    } catch (err) {
        section.classList.add("no-webgl");
        console.warn("[story-scene] WebGL unavailable:", err && err.message);
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.07);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 7.8);

    // One formation per act, in narrative order.
    formations = [
        buildHeap(),
        buildShore(),
        buildRain(),
        buildLoneHuman(),
        buildThreads(),
        buildFigure(), // sets jacketMask
    ];

    const geo = new THREE.BufferGeometry();
    posAttr = new THREE.BufferAttribute(new Float32Array(formations[0].pos), 3);
    colAttr = new THREE.BufferAttribute(new Float32Array(formations[0].col), 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("color", colAttr);

    const mat = new THREE.PointsMaterial({
        size: 0.085,
        sizeAttenuation: true,
        map: makeSprite(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        opacity: 0.95,
    });

    group = new THREE.Group();
    points = new THREE.Points(geo, mat);
    halo = makeHalo();
    group.add(halo);
    group.add(points);
    scene.add(group);

    resize();
    readProgress();
    easedProgress = targetProgress;

    scrollListener = readProgress;
    resizeListener = () => { readProgress(); resize(); };
    window.addEventListener("scroll", scrollListener, { passive: true });
    window.addEventListener("resize", resizeListener, { passive: true });

    if ("IntersectionObserver" in window) {
        intersectionObserver = new IntersectionObserver((entries) => {
            inView = entries[0].isIntersecting;
        }, { rootMargin: "200px 0px" });
        intersectionObserver.observe(section);
    }

    loop();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
} else {
    mount();
}

window.addEventListener("pagehide", cleanup);
