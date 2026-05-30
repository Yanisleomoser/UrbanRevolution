/**
 * Urban Revolution — Visual Scroll Story (continuous single-object morph)
 *
 * One hero object, made of a single GPU particle system, never dissolves —
 * it transforms continuously as you scroll, so the whole story speaks ONE
 * visual language (no photo↔particle break). The same ~7k particles are,
 * in turn:
 *
 *   I   a PET bottle            "this bottle outlives your great-grandkids"
 *   II  → a heap of waste       "your old shirt becomes this mountain"
 *   III → dispersing drift      "it travels on — to places you never see"
 *   IV  → dust inside a body    "it comes back. in the blood of 4 in 5 of us"
 *   V   → a glowing thread      "but the same fibre can become something else"
 *   VI  → a tailored figure     "made for one. your next piece."
 *
 * Documentary photos sit far behind as dim, blurred atmosphere (CSS) so the
 * particle object always reads as the hero. A scroll/time-driven counter
 * (acts I–IV) makes the scale personal and present. Degrades gracefully:
 * reduced-motion / no-WebGL → CSS shows static, readable acts.
 */

import * as THREE from "three";

const MOBILE = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(max-width: 768px)").matches;
const COUNT = MOBILE ? 4600 : 7600;
const THREADS = 56;
const EASE = 0.075;

// Brand gradient (the hopeful turn).
const C_PINK = new THREE.Color("#EC4899");
const C_PURPLE = new THREE.Color("#A855F7");
const C_BLUE = new THREE.Color("#3B82F6");
// Mood palette (the dark acts) — lifted enough to read on near-black.
const C_PET = new THREE.Color("#6fb6c9");   // translucent PET blue-green
const C_PET_DIM = new THREE.Color("#3c6b74");
const C_WASTE_LO = new THREE.Color("#54565c");
const C_WASTE_HI = new THREE.Color("#8a8170");
const C_TOXIC = new THREE.Color("#57c0aa");  // microplastic teal
const C_SKIN = new THREE.Color("#c79f86");   // warm human tone
const C_DIM = new THREE.Color("#9aa0aa");

// Global throughput, for the live counter (sourced, see CREDITS.md):
//   >100bn garments/yr ÷ 31.536e6 s ≈ 3,170 produced per second;
//   ~1 rubbish-truck of textiles dumped/burned per second.
const GARMENTS_PER_SEC = 3170;
const TRUCKS_PER_SEC = 1;

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
let photos = [];
let actNumEl = null;
let counterWrap = null;
let counterGarments = null;
let counterTrucks = null;

let targetProgress = 0;
let easedProgress = 0;
let currentAct = -1;
let inView = true;
let rafId = 0;
let viewSeconds = 0;        // accumulated in-view time (drives the counter)
let lastTs = 0;
let intersectionObserver = null;
let scrollListener = null;
let resizeListener = null;

const tmp = new THREE.Color();
const vec = new THREE.Vector3();

/* ---------- helpers ---------- */

function rand(min, max) { return min + Math.random() * (max - min); }

function smoothstep(x) {
    x = THREE.MathUtils.clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
}

function gradientColor(t, out) {
    if (t < 0.52) out.copy(C_PINK).lerp(C_PURPLE, t / 0.52);
    else out.copy(C_PURPLE).lerp(C_BLUE, (t - 0.52) / 0.48);
    return out;
}

function alloc() {
    return { pos: new Float32Array(COUNT * 3), col: new Float32Array(COUNT * 3) };
}
function put(f, i, x, y, z, c) {
    f.pos[i * 3] = x; f.pos[i * 3 + 1] = y; f.pos[i * 3 + 2] = z;
    f.col[i * 3] = c.r; f.col[i * 3 + 1] = c.g; f.col[i * 3 + 2] = c.b;
}
function pointOnSegment(ax, ay, az, bx, by, bz, radius, out) {
    const t = Math.random();
    out.set(ax + (bx - ax) * t + rand(-radius, radius),
            ay + (by - ay) * t + rand(-radius, radius),
            az + (bz - az) * t + rand(-radius, radius));
}
function sampleHuman(out) {
    const r = Math.random();
    if (r < 0.1) {
        const a = rand(0, Math.PI * 2), b = Math.acos(rand(-1, 1)), rr = 0.32 * Math.cbrt(Math.random());
        out.set(Math.sin(b) * Math.cos(a) * rr, 1.78 + Math.cos(b) * rr, Math.sin(b) * Math.sin(a) * rr);
        return "head";
    }
    if (r < 0.52) {
        const ty = rand(0.45, 1.55), taper = 0.5 + (ty - 0.45) / 1.1 * 0.18;
        out.set(rand(-taper, taper), ty, rand(-0.26, 0.26)); return "torso";
    }
    if (r < 0.74) {
        const s = Math.random() < 0.5 ? -1 : 1;
        pointOnSegment(s * 0.56, 1.45, 0, s * 0.82, 0.45, 0.05, 0.1, out); return "arms";
    }
    const s = Math.random() < 0.5 ? -1 : 1;
    pointOnSegment(s * 0.2, 0.45, 0, s * 0.26, -2.25, 0, 0.12, out); return "legs";
}

/* ---------- the six keyframes of the hero object ---------- */

// I — a single PET bottle (body + shoulder + neck + cap).
function buildBottle() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const u = Math.random();
        let y, radius;
        if (u < 0.66) {            // body
            y = rand(-1.7, 0.9); radius = 0.62;
        } else if (u < 0.8) {      // shoulder taper
            const t = Math.random(); y = 0.9 + t * 0.5; radius = 0.62 - t * 0.42;
        } else if (u < 0.94) {     // neck
            y = rand(1.4, 1.9); radius = 0.2;
        } else {                   // cap
            y = rand(1.9, 2.1); radius = 0.26;
        }
        const a = rand(0, Math.PI * 2);
        const shell = radius * (0.9 + Math.random() * 0.1);
        put(f, i, Math.cos(a) * shell, y, Math.sin(a) * shell,
            tmp.copy(Math.random() < 0.5 ? C_PET : C_PET_DIM).multiplyScalar(rand(0.7, 1.1)));
    }
    return f;
}

// II — the bottle becomes a heap (one shirt → this mountain).
function buildHeap() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const a = rand(0, Math.PI * 2), radius = Math.sqrt(Math.random()) * 2.7;
        const mound = 1 - radius / 2.7;
        const y = -2.2 + mound * 3.0 * Math.random() + rand(-0.22, 0.22);
        if (Math.random() < 0.12) tmp.copy(C_PET_DIM).multiplyScalar(rand(0.5, 0.9));
        else tmp.copy(C_WASTE_LO).lerp(C_WASTE_HI, Math.random()).multiplyScalar(rand(0.6, 1.05));
        put(f, i, Math.cos(a) * radius, y, Math.sin(a) * radius * 0.6, tmp);
    }
    return f;
}

// III — it travels: the heap disperses into a wide drifting field.
function buildDrift() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const x = rand(-4.2, 4.2), y = rand(-2.6, 2.6), z = rand(-2.2, 2.2);
        const d = 1 - Math.min(1, Math.hypot(x, y) / 4.5);
        tmp.copy(C_WASTE_LO).lerp(C_WASTE_HI, Math.random()).multiplyScalar(0.4 + d * 0.6);
        put(f, i, x, y, z, tmp);
    }
    return f;
}

// IV — it comes back: dust settles INTO a human silhouette.
function buildBodyDust() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        if (Math.random() < 0.62) {            // inside the body
            sampleHuman(vec);
            vec.multiplyScalar(0.92);
            tmp.copy(Math.random() < 0.4 ? C_TOXIC : C_SKIN).multiplyScalar(rand(0.55, 0.95));
        } else {                               // ambient drifting dust
            vec.set(rand(-3, 3), rand(-2.6, 2.6), rand(-1.6, 1.6));
            tmp.copy(C_TOXIC).multiplyScalar(rand(0.25, 0.6));
        }
        put(f, i, vec.x, vec.y, vec.z, tmp);
    }
    return f;
}

// V — the turn: the same matter draws into flowing silk threads.
function buildThreads() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const th = i % THREADS, baseX = ((th / (THREADS - 1)) - 0.5) * 5.0, phase = th * 1.7;
        const p = Math.random(), y = -2.8 + p * 5.6;
        const x = baseX + Math.sin(p * Math.PI * 2.2 + phase) * 0.3 + rand(-0.04, 0.04);
        const z = Math.cos(p * Math.PI * 1.8 + phase) * 0.5 + rand(-0.04, 0.04);
        gradientColor(p, tmp);
        put(f, i, x, y, z, tmp);
    }
    return f;
}

// VI — the vision: a tailored figure; the jacket carries the glowing gradient.
function buildFigure() {
    const f = alloc();
    jacketMask = new Uint8Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        let part;
        if (Math.random() < 0.08) {
            const a = rand(0, Math.PI * 2), rr = rand(0.9, 1.6);
            vec.set(Math.cos(a) * rr, rand(0.6, 1.6), Math.sin(a) * rr - 0.1); part = "halo";
        } else part = sampleHuman(vec);
        const isJ = part === "torso" || part === "arms" || part === "halo";
        jacketMask[i] = isJ ? 1 : 0;
        if (isJ) {
            gradientColor(THREE.MathUtils.clamp((vec.y + 2.3) / 4.3, 0, 1), tmp);
            if (part === "halo") tmp.multiplyScalar(0.55);
        } else tmp.copy(C_DIM).multiplyScalar(rand(0.5, 0.78));
        put(f, i, vec.x, vec.y, vec.z, tmp);
    }
    return f;
}

/* ---------- sprites ---------- */

function makeSprite() {
    const s = 64, c = document.createElement("canvas"); c.width = c.height = s;
    const ctx = c.getContext("2d"), g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function makeHalo() {
    const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
    const ctx = c.getContext("2d"), g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0, "rgba(168,85,247,0.55)"); g.addColorStop(0.5, "rgba(236,72,153,0.22)");
    g.addColorStop(1, "rgba(59,130,246,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    sp.scale.set(6, 6, 1); sp.position.set(0, 0.9, -0.5); return sp;
}

/* ---------- per-frame morph ---------- */

function updateMorph(time) {
    const p = easedProgress, NF = formations.length;
    // Each act centre shows its pure keyframe; boundaries cross-fade.
    const fp = THREE.MathUtils.clamp(p * acts.length - 0.5, 0, NF - 1);
    const i = Math.floor(fp), local = smoothstep(fp - i);
    const A = formations[i], B = formations[Math.min(i + 1, NF - 1)];
    const figureAmt = THREE.MathUtils.clamp(fp - (NF - 2), 0, 1);
    const pulse = 1 + Math.sin(time * 2.2) * 0.18;

    const pos = posAttr.array, col = colAttr.array;
    for (let k = 0; k < COUNT; k++) {
        const j = k * 3;
        pos[j]     = A.pos[j]     + (B.pos[j]     - A.pos[j])     * local + Math.sin(time * 0.7 + k) * 0.012;
        pos[j + 1] = A.pos[j + 1] + (B.pos[j + 1] - A.pos[j + 1]) * local + Math.cos(time * 0.6 + k * 1.3) * 0.012;
        pos[j + 2] = A.pos[j + 2] + (B.pos[j + 2] - A.pos[j + 2]) * local;
        let r = A.col[j] + (B.col[j] - A.col[j]) * local;
        let g = A.col[j + 1] + (B.col[j + 1] - A.col[j + 1]) * local;
        let b = A.col[j + 2] + (B.col[j + 2] - A.col[j + 2]) * local;
        if (jacketMask[k] && figureAmt > 0) { const a = 1 + (pulse - 1) * figureAmt; r *= a; g *= a; b *= a; }
        col[j] = r; col[j + 1] = g; col[j + 2] = b;
    }
    posAttr.needsUpdate = true; colAttr.needsUpdate = true;

    halo.material.opacity = (figureAmt * figureAmt) * (0.6 + Math.sin(time * 2.2) * 0.18);
    group.rotation.y = Math.sin(time * 0.1) * 0.12 + p * 0.2;
    const zBase = camera.aspect < 1 ? 10.5 : 7.8;
    camera.position.z = zBase - p * 1.3;
    camera.lookAt(0, -0.1 + p * 0.15, 0);
}

/* ---------- counter (acts I–IV) ---------- */

function formatInt(n) {
    // Match the locale i18n actually uses (de-DE / en-US), and follow
    // language switching instead of hardcoding a locale.
    const loc = (window.I18N && window.I18N.locale) ? window.I18N.locale() : "de-DE";
    return Math.floor(n).toLocaleString(loc);
}
function updateCounter() {
    if (!counterWrap) return;
    // Show the counter through the problem acts, retire it at the turn.
    const show = currentAct <= 3;
    counterWrap.classList.toggle("is-on", show);
    if (!show) return;
    if (counterGarments) counterGarments.textContent = formatInt(viewSeconds * GARMENTS_PER_SEC);
    if (counterTrucks) counterTrucks.textContent = formatInt(viewSeconds * TRUCKS_PER_SEC);
}

/* ---------- scroll + acts ---------- */

function setAct(idx) {
    acts.forEach((el, k) => el.classList.toggle("is-active", k === idx));
    photos.forEach((el, k) => el.classList.toggle("is-shown", k === idx));
    if (actNumEl) actNumEl.textContent = String(idx + 1).padStart(2, "0");
}
function readProgress() {
    const rect = track.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return;
    targetProgress = THREE.MathUtils.clamp(-rect.top / scrollable, 0, 1);
    const idx = Math.min(acts.length - 1, Math.floor(targetProgress * acts.length));
    if (idx !== currentAct) { currentAct = idx; setAct(idx); }
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
    const now = performance.now() * 0.001;
    // First frame after (re)entering view: lastTs is 0, so dt is 0 — no
    // bogus delta from the time spent off-screen gets added to the counter.
    const dt = lastTs ? Math.min(0.1, now - lastTs) : 0;
    lastTs = now;
    viewSeconds += dt;
    easedProgress += (targetProgress - easedProgress) * EASE;
    updateMorph(now);
    updateCounter();
    renderer.render(scene, camera);
}
function resize() {
    const canvas = renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
}

/* ---------- mount ---------- */

function mount() {
    const section = document.getElementById("mission");
    const canvas = document.getElementById("story-canvas");
    if (!section || !canvas) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    track = section.querySelector("[data-story]");
    acts = Array.from(section.querySelectorAll(".story-act"));
    photos = Array.from(section.querySelectorAll(".story-photo"));
    actNumEl = section.querySelector("[data-act-num]");
    counterWrap = section.querySelector("[data-counter]");
    counterGarments = section.querySelector("[data-count-garments]");
    counterTrucks = section.querySelector("[data-count-trucks]");
    if (!track || acts.length < 2) return;

    const totalEl = section.querySelector("[data-act-total]");
    if (totalEl) totalEl.textContent = String(acts.length).padStart(2, "0");

    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (err) {
        section.classList.add("no-webgl");
        console.warn("[story-scene] WebGL unavailable:", err && err.message);
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.05);
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 7.8);

    formations = [buildBottle(), buildHeap(), buildDrift(), buildBodyDust(), buildThreads(), buildFigure()];

    const geo = new THREE.BufferGeometry();
    posAttr = new THREE.BufferAttribute(new Float32Array(formations[0].pos), 3);
    colAttr = new THREE.BufferAttribute(new Float32Array(formations[0].col), 3);
    posAttr.setUsage(THREE.DynamicDrawUsage); colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr); geo.setAttribute("color", colAttr);

    const mat = new THREE.PointsMaterial({
        size: MOBILE ? 0.1 : 0.085, sizeAttenuation: true, map: makeSprite(),
        vertexColors: true, transparent: true, depthWrite: false,
        blending: THREE.NormalBlending, opacity: 1,
    });

    group = new THREE.Group();
    points = new THREE.Points(geo, mat);
    halo = makeHalo();
    group.add(halo); group.add(points); scene.add(group);

    resize(); readProgress(); easedProgress = targetProgress;

    scrollListener = readProgress;
    resizeListener = () => { readProgress(); resize(); };
    window.addEventListener("scroll", scrollListener, { passive: true });
    window.addEventListener("resize", resizeListener, { passive: true });

    if ("IntersectionObserver" in window) {
        intersectionObserver = new IntersectionObserver((entries) => {
            inView = entries[0].isIntersecting;
            if (!inView) lastTs = 0; // don't accrue counter time while away
        }, { rootMargin: "200px 0px" });
        intersectionObserver.observe(section);
    }
    loop();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();

window.addEventListener("pagehide", cleanup);
