/**
 * Urban Revolution — Visual Scroll Story (WebGL stage)
 *
 * One GPU particle system morphs through SIX formations — each one a
 * legible picture of its act's text:
 *
 *   I   Overproduction → a tall heap of discarded clothes (garment colours)
 *   II  Injustice      → a sea with a waste pile beached on a foreign shore
 *   III Ecosystem      → falling vertical streaks of microplastic rain
 *   IV  The human      → a small lone figure dwarfed by a looming waste mound
 *   V   Belief         → chaos resolves into flowing silk threads (gradient)
 *   VI  Vision         → a tailored figure; the jacket glows
 *
 * Each scene HOLDS for most of its act (so it reads), then morphs to the
 * next in the act's final stretch. Colours are lifted well clear of the
 * void so the dark acts are actually visible. Scroll progress is read
 * passively and eased per frame. Degrades gracefully (reduced-motion /
 * no-WebGL → CSS shows static, readable acts).
 */

import * as THREE from "three";

// Fewer particles on phones — two WebGL contexts share the page.
const MOBILE = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(max-width: 768px)").matches;
const COUNT = MOBILE ? 4200 : 7200;
const THREADS = 56;
const RAIN_COLS = 150;
const EASE = 0.07;

// Brand gradient stops.
const C_PINK = new THREE.Color("#EC4899");
const C_PURPLE = new THREE.Color("#A855F7");
const C_BLUE = new THREE.Color("#3B82F6");
// Lifted "mood" palette — bright enough to read against the void.
const C_CLOTH_A = new THREE.Color("#6f7176");
const C_CLOTH_B = new THREE.Color("#8c7f6d");
const C_SEA = new THREE.Color("#3f5a6b");
const C_FOAM = new THREE.Color("#a9c2cd");
const C_TOXIC = new THREE.Color("#4fb6a3");
const C_SKIN = new THREE.Color("#bd9f85");
const C_MOUND = new THREE.Color("#4a4a51");
const C_DIM = new THREE.Color("#9aa0aa");
// Faded garment colours so a heap reads as clothing, not gravel.
const GARMENT = ["#7d4f4f", "#4f5f7d", "#5a6b54", "#8a7d4f", "#6d4f6b", "#b9b3a8"]
    .map((h) => new THREE.Color(h));

let renderer = null;
let scene = null;
let camera = null;
let points = null;
let halo = null;
let group = null;

let formations = [];
let jacketMask = null;
let posAttr, colAttr;

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

function gradientColor(t, out) {
    if (t < 0.52) out.copy(C_PINK).lerp(C_PURPLE, t / 0.52);
    else out.copy(C_PURPLE).lerp(C_BLUE, (t - 0.52) / 0.48);
    return out;
}

// Muted clothing colour — base fabric tones with occasional garment hues.
function clothColor(out) {
    if (Math.random() < 0.34) {
        out.copy(GARMENT[(Math.random() * GARMENT.length) | 0]).multiplyScalar(rand(0.7, 1));
    } else {
        out.copy(C_CLOTH_A).lerp(C_CLOTH_B, Math.random()).multiplyScalar(rand(0.65, 1.1));
    }
    return out;
}

function alloc() {
    return { pos: new Float32Array(COUNT * 3), col: new Float32Array(COUNT * 3) };
}

function set(f, i, x, y, z, c) {
    f.pos[i * 3] = x; f.pos[i * 3 + 1] = y; f.pos[i * 3 + 2] = z;
    f.col[i * 3] = c.r; f.col[i * 3 + 1] = c.g; f.col[i * 3 + 2] = c.b;
}

function pointOnSegment(ax, ay, az, bx, by, bz, radius, out) {
    const t = Math.random();
    out.set(
        ax + (bx - ax) * t + rand(-radius, radius),
        ay + (by - ay) * t + rand(-radius, radius),
        az + (bz - az) * t + rand(-radius, radius),
    );
}

// Random point on a standing humanoid; returns the body part.
function sampleHuman(out) {
    const r = Math.random();
    if (r < 0.1) {
        const a = rand(0, Math.PI * 2);
        const b = Math.acos(rand(-1, 1));
        const rr = 0.32 * Math.cbrt(Math.random());
        out.set(Math.sin(b) * Math.cos(a) * rr, 1.78 + Math.cos(b) * rr, Math.sin(b) * Math.sin(a) * rr);
        return "head";
    }
    if (r < 0.52) {
        const ty = rand(0.45, 1.55);
        const taper = 0.5 + (ty - 0.45) / 1.1 * 0.18;
        out.set(rand(-taper, taper), ty, rand(-0.26, 0.26));
        return "torso";
    }
    if (r < 0.74) {
        const side = Math.random() < 0.5 ? -1 : 1;
        pointOnSegment(side * 0.56, 1.45, 0, side * 0.82, 0.45, 0.05, 0.1, out);
        return "arms";
    }
    const side = Math.random() < 0.5 ? -1 : 1;
    pointOnSegment(side * 0.2, 0.45, 0, side * 0.26, -2.25, 0, 0.12, out);
    return "legs";
}

/* ---------- the six formations ---------- */

// I — a tall, dense heap of discarded clothes.
function buildHeap() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const a = rand(0, Math.PI * 2);
        const rad = Math.sqrt(Math.random()) * 2.6;
        const mound = 1 - rad / 2.6;
        const y = -2.2 + mound * 3.0 * Math.random() + rand(-0.22, 0.22);
        set(f, i, Math.cos(a) * rad, y, Math.sin(a) * rad * 0.55, clothColor(tmp));
    }
    return f;
}

// II — a cold sea (with foam crests) and our cast-offs beached to the side.
function buildShore() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        if (Math.random() < 0.56) {
            const x = rand(-3.8, 3.8);
            const z = rand(-1.8, 1.8);
            const wave = Math.sin(x * 1.1 + z * 0.6);
            const y = -1.7 + wave * 0.3 + rand(-0.05, 0.05);
            if (wave > 0.62) tmp.copy(C_FOAM).multiplyScalar(rand(0.75, 1));
            else tmp.copy(C_SEA).multiplyScalar(rand(0.55, 1));
            set(f, i, x, y, z, tmp);
        } else {
            const a = rand(0, Math.PI * 2);
            const rad = Math.sqrt(Math.random()) * 1.5;
            const y = -1.6 + (1 - rad / 1.5) * 1.7 * Math.random() + rand(-0.12, 0.12);
            set(f, i, 2.2 + Math.cos(a) * rad, y, Math.sin(a) * rad * 0.7, clothColor(tmp));
        }
    }
    return f;
}

// III — microplastic as falling vertical streaks across the whole field.
function buildRain() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const colmn = i % RAIN_COLS;
        const x = ((colmn / (RAIN_COLS - 1)) - 0.5) * 7.4 + rand(-0.05, 0.05);
        const y = rand(-3.2, 3.2);
        const z = rand(-1.7, 1.7);
        tmp.copy(C_TOXIC).multiplyScalar(rand(0.5, 1.05));
        set(f, i, x, y, z, tmp);
    }
    return f;
}

// IV — a small lone figure on the left, a looming waste mound on the right.
function buildLoneHuman() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        if (Math.random() < 0.42) {
            sampleHuman(vec);
            vec.multiplyScalar(0.6);
            vec.x -= 1.95; vec.y -= 0.35;
            tmp.copy(C_SKIN).multiplyScalar(rand(0.7, 1.05));
            set(f, i, vec.x, vec.y, vec.z, tmp);
        } else {
            const a = rand(0, Math.PI * 2);
            const rad = Math.sqrt(Math.random()) * 2.2;
            const y = -2.2 + (1 - rad / 2.2) * 3.7 * Math.random() + rand(-0.2, 0.2);
            tmp.copy(C_MOUND).lerp(C_CLOTH_B, Math.random() * 0.5).multiplyScalar(rand(0.6, 1));
            set(f, i, 1.7 + Math.cos(a) * rad, y, Math.sin(a) * rad * 0.55, tmp);
        }
    }
    return f;
}

// V — fine, flowing silk threads in the brand gradient.
function buildThreads() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const thread = i % THREADS;
        const baseX = ((thread / (THREADS - 1)) - 0.5) * 5.2;
        const phase = thread * 1.7;
        const p = Math.random();
        const y = -2.8 + p * 5.6;
        const x = baseX + Math.sin(p * Math.PI * 2.2 + phase) * 0.3 + rand(-0.04, 0.04);
        const z = Math.cos(p * Math.PI * 1.8 + phase) * 0.5 + rand(-0.04, 0.04);
        gradientColor(p, tmp);
        set(f, i, x, y, z, tmp);
    }
    return f;
}

// VI — a tailored figure; torso + arms (the jacket) carry the glowing gradient.
function buildFigure() {
    const f = alloc();
    jacketMask = new Uint8Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        let part;
        if (Math.random() < 0.08) {
            const a = rand(0, Math.PI * 2);
            const rr = rand(0.9, 1.6);
            vec.set(Math.cos(a) * rr, rand(0.6, 1.6), Math.sin(a) * rr - 0.1);
            part = "halo";
        } else {
            part = sampleHuman(vec);
        }
        const isJacket = part === "torso" || part === "arms" || part === "halo";
        jacketMask[i] = isJacket ? 1 : 0;
        if (isJacket) {
            gradientColor(THREE.MathUtils.clamp((vec.y + 2.3) / 4.3, 0, 1), tmp);
            if (part === "halo") tmp.multiplyScalar(0.55);
        } else {
            tmp.copy(C_DIM).multiplyScalar(rand(0.5, 0.78));
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
    g.addColorStop(0.35, "rgba(255,255,255,0.6)");
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

const FALL_SPAN = 6.6;

function updateMorph(time) {
    const p = easedProgress;
    const NF = formations.length;

    // Formation i is shown during act i and HOLDS for the first ~60% of
    // the act, then morphs to i+1 — so each scene reads while its copy is
    // on screen instead of perpetually dissolving.
    const a = p * acts.length;
    let i = Math.floor(a);
    if (i > NF - 1) i = NF - 1;
    const frac = a - i;
    const local = smoothstep((frac - 0.6) / 0.34);
    const A = formations[i];
    const B = formations[Math.min(i + 1, NF - 1)];

    const figureAmt = i >= NF - 1 ? 1 : (i === NF - 2 ? local : 0);
    // formation index 2 = rain; how much of it is currently on screen
    const rainAmt = i === 2 ? (1 - local) : (i === 1 ? local : 0);
    const pulse = 1 + Math.sin(time * 2.2) * 0.18;

    const pos = posAttr.array;
    const col = colAttr.array;
    for (let k = 0; k < COUNT; k++) {
        const j = k * 3;
        const x = A.pos[j] + (B.pos[j] - A.pos[j]) * local + Math.sin(time * 0.7 + k) * 0.012;
        let y = A.pos[j + 1] + (B.pos[j + 1] - A.pos[j + 1]) * local + Math.cos(time * 0.6 + k * 1.3) * 0.012;
        const z = A.pos[j + 2] + (B.pos[j + 2] - A.pos[j + 2]) * local;

        // Microplastic rain streams downward and wraps within the field.
        if (rainAmt > 0.002) {
            const off = (k * 0.221 + time * 1.5) % FALL_SPAN;
            y -= off * rainAmt;
            if (y < -3.4) y += FALL_SPAN * rainAmt;
        }
        pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;

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
    group.rotation.y = Math.sin(time * 0.1) * 0.12 + p * 0.18;

    const zBase = camera.aspect < 1 ? 11.5 : 8.4;
    camera.position.z = zBase - p * 1.3;
    camera.lookAt(0, -0.1 + p * 0.15, 0);
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
        return;
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
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.055);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 8.4);

    formations = [
        buildHeap(),
        buildShore(),
        buildRain(),
        buildLoneHuman(),
        buildThreads(),
        buildFigure(),
    ];

    const geo = new THREE.BufferGeometry();
    posAttr = new THREE.BufferAttribute(new Float32Array(formations[0].pos), 3);
    colAttr = new THREE.BufferAttribute(new Float32Array(formations[0].col), 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("color", colAttr);

    const mat = new THREE.PointsMaterial({
        size: MOBILE ? 0.11 : 0.095,
        sizeAttenuation: true,
        map: makeSprite(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        opacity: 1,
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
