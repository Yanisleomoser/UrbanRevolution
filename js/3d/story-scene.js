/**
 * Urban Revolution — Visual Scroll Story (hybrid stage)
 *
 * The story is a hybrid:
 *   Acts I–IV (the dark reality) are real documentary PHOTOGRAPHS
 *     (CC-licensed, see assets/story/CREDITS.md) — crossfaded with a slow
 *     Ken Burns push. The photos are plain DOM; this module just toggles
 *     which one is shown as the active act changes.
 *   Acts V–VI (the hopeful turn) are this WebGL particle system: chaos
 *     resolving into flowing silk threads, then weaving a tailored figure
 *     whose jacket glows. The canvas is invisible (and its work skipped)
 *     during the photo acts, then fades in for the transformation.
 *
 * Scroll progress is read passively and eased per frame. Degrades
 * gracefully (reduced-motion / no-WebGL → CSS shows static readable acts).
 */

import * as THREE from "three";

const MOBILE = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(max-width: 768px)").matches;
const COUNT = MOBILE ? 4200 : 7200;
const THREADS = 56;
const EASE = 0.07;
// Where the WebGL transformation takes over from the photos (scroll 0–1).
const CANVAS_FROM = 0.6;

const C_PINK = new THREE.Color("#EC4899");
const C_PURPLE = new THREE.Color("#A855F7");
const C_BLUE = new THREE.Color("#3B82F6");
const C_DIM = new THREE.Color("#9aa0aa");

let renderer = null;
let scene = null;
let camera = null;
let points = null;
let halo = null;
let group = null;

let posThreads, colThreads, posFigure, colFigure;
let jacketMask = null;
let posAttr, colAttr;

let track = null;
let acts = [];
let photos = [];
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

function pointOnSegment(ax, ay, az, bx, by, bz, radius, out) {
    const t = Math.random();
    out.set(
        ax + (bx - ax) * t + rand(-radius, radius),
        ay + (by - ay) * t + rand(-radius, radius),
        az + (bz - az) * t + rand(-radius, radius),
    );
}

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

/* ---------- two formations: threads → figure ---------- */

function buildThreads() {
    posThreads = new Float32Array(COUNT * 3);
    colThreads = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
        const thread = i % THREADS;
        const baseX = ((thread / (THREADS - 1)) - 0.5) * 5.2;
        const phase = thread * 1.7;
        const p = Math.random();
        const y = -2.8 + p * 5.6;
        const x = baseX + Math.sin(p * Math.PI * 2.2 + phase) * 0.3 + rand(-0.04, 0.04);
        const z = Math.cos(p * Math.PI * 1.8 + phase) * 0.5 + rand(-0.04, 0.04);
        gradientColor(p, tmp);
        posThreads[i * 3] = x; posThreads[i * 3 + 1] = y; posThreads[i * 3 + 2] = z;
        colThreads[i * 3] = tmp.r; colThreads[i * 3 + 1] = tmp.g; colThreads[i * 3 + 2] = tmp.b;
    }
}

function buildFigure() {
    posFigure = new Float32Array(COUNT * 3);
    colFigure = new Float32Array(COUNT * 3);
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
        posFigure[i * 3] = vec.x; posFigure[i * 3 + 1] = vec.y; posFigure[i * 3 + 2] = vec.z;
        colFigure[i * 3] = tmp.r; colFigure[i * 3 + 1] = tmp.g; colFigure[i * 3 + 2] = tmp.b;
    }
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

/* ---------- per-frame morph (only runs for the transformation acts) ---------- */

function updateMorph(time) {
    const p = easedProgress;

    // Map the last stretch of the scroll to threads → figure, holding
    // threads through act V and weaving the figure across act VI.
    const tp = THREE.MathUtils.clamp((p - CANVAS_FROM) / (1 - CANVAS_FROM), 0, 1);
    const local = smoothstep((tp - 0.42) / 0.4);
    const figureAmt = local;
    const pulse = 1 + Math.sin(time * 2.2) * 0.18;

    const pos = posAttr.array;
    const col = colAttr.array;
    for (let k = 0; k < COUNT; k++) {
        const j = k * 3;
        pos[j] = posThreads[j] + (posFigure[j] - posThreads[j]) * local + Math.sin(time * 0.7 + k) * 0.012;
        pos[j + 1] = posThreads[j + 1] + (posFigure[j + 1] - posThreads[j + 1]) * local + Math.cos(time * 0.6 + k * 1.3) * 0.012;
        pos[j + 2] = posThreads[j + 2] + (posFigure[j + 2] - posThreads[j + 2]) * local;

        let r = colThreads[j] + (colFigure[j] - colThreads[j]) * local;
        let g = colThreads[j + 1] + (colFigure[j + 1] - colThreads[j + 1]) * local;
        let b = colThreads[j + 2] + (colFigure[j + 2] - colThreads[j + 2]) * local;
        if (jacketMask[k] && figureAmt > 0) {
            const amt = 1 + (pulse - 1) * figureAmt;
            r *= amt; g *= amt; b *= amt;
        }
        col[j] = r; col[j + 1] = g; col[j + 2] = b;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    halo.material.opacity = (figureAmt * figureAmt) * (0.6 + Math.sin(time * 2.2) * 0.18);
    group.rotation.y = Math.sin(time * 0.1) * 0.12 + tp * 0.25;

    const zBase = camera.aspect < 1 ? 10 : 7.6;
    camera.position.z = zBase - tp * 1.2;
    camera.lookAt(0, -0.1 + tp * 0.15, 0);
}

/* ---------- scroll + acts ---------- */

function setAct(idx) {
    acts.forEach((el, k) => el.classList.toggle("is-active", k === idx));
    // Photos exist only for the dark acts (0–3); none shown for 4–5.
    photos.forEach((el, k) => el.classList.toggle("is-shown", k === idx));
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

    // Canvas only matters for the transformation acts — fade it in and
    // skip the particle work entirely while the photos are on screen.
    const vis = smoothstep((easedProgress - (CANVAS_FROM - 0.005)) / 0.06);
    renderer.domElement.style.opacity = vis.toFixed(3);
    if (vis < 0.01) return;

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
    photos = Array.from(section.querySelectorAll(".story-photo"));
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
    camera.position.set(0, 0, 7.6);

    buildThreads();
    buildFigure();

    const geo = new THREE.BufferGeometry();
    posAttr = new THREE.BufferAttribute(new Float32Array(posThreads), 3);
    colAttr = new THREE.BufferAttribute(new Float32Array(colThreads), 3);
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
