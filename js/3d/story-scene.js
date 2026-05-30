/**
 * Urban Revolution — Visual Scroll Story (hybrid stage)
 *
 * The story is a hybrid:
 *   Acts I–IV (the dark reality) are real documentary PHOTOGRAPHS
 *     (CC-licensed, see assets/story/CREDITS.md) — crossfaded with a slow
 *     Ken Burns push. The photos are plain DOM; this module just toggles
 *     which one is shown as the active act changes.
 *   Acts V–VI (the hopeful turn) are this WebGL particle system: chaos
 *     resolving into flowing silk threads, then weaving them into a
 *     tailored jacket — a real, recognisable garment, not a blob. Two
 *     particle layers do the work:
 *       · a matte "fabric" layer forms the jacket shell (structured
 *         shoulders, notched-lapel collar, tapered body with a centre
 *         closure, real tapering sleeves) plus a dim, worn figure;
 *       · an additive "seam" layer draws the glowing couture lines —
 *         front placket + buttons, lapel edges, shoulder/princess/armhole
 *         seams, cuffs and hem — that read the silhouette as couture.
 *     The canvas is invisible (and its work skipped) during the photo
 *     acts, then fades in for the transformation.
 *
 * Scroll progress is read passively and eased per frame. Degrades
 * gracefully (reduced-motion / no-WebGL → CSS shows static readable acts).
 */

import * as THREE from "three";

const MOBILE = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(max-width: 768px)").matches;
const COUNT = MOBILE ? 4200 : 7200;       // matte fabric + dim body
const ACCENT = MOBILE ? 850 : 1600;       // glowing couture seams
const THREADS = 56;
const EASE = 0.07;
// Where the WebGL transformation takes over from the photos (scroll 0–1).
const CANVAS_FROM = 0.6;

const C_PINK = new THREE.Color("#EC4899");
const C_PURPLE = new THREE.Color("#A855F7");
const C_BLUE = new THREE.Color("#3B82F6");
const C_DIM = new THREE.Color("#9aa0aa");
const C_WHITE = new THREE.Color("#ffffff");

// Jacket silhouette, in the same world units as the figure (y up, +z front).
const SHOULDER_Y = 1.52, SHOULDER_HALF = 0.82;
const CHEST_Y = 0.98;
const WAIST_Y = 0.34, WAIST_HALF = 0.5;
const HEM_Y = -0.3, HEM_HALF = 0.62;
const NECK_HALF = 0.17;     // half-width of the collar opening at the shoulders
const FRONT_DEPTH = 0.34;   // z bulge of the front shell at centre
const CLOSURE_GAP = 0.05;   // half-gap at centre front (the closure line)

let renderer = null;
let scene = null;
let camera = null;
let group = null;
let halo = null;

let fabric = null;   // { count, posThreads, colThreads, posFigure, colFigure, mask, posAttr, colAttr, points }
let accent = null;   // same shape, mask=null (every accent particle glows)

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

// Brand gradient mapped to the jacket's vertical span — hem→pink, collar→blue.
function heightTone(y, out) {
    const h = THREE.MathUtils.clamp((y - HEM_Y) / (SHOULDER_Y + 0.3 - HEM_Y), 0, 1);
    return gradientColor(h, out);
}

// Quadratic Bézier through (p0 → control p1 → p2); writes the point into `out`.
function bezier3(p0, p1, p2, t, out) {
    const mt = 1 - t;
    out.set(
        mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
        mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
        mt * mt * p0[2] + 2 * mt * t * p1[2] + t * t * p2[2],
    );
}

/* ---------- jacket silhouette ---------- */

// Outer half-width of the jacket body at height y: shoulders → nipped waist
// → softly flared hem. This single curve is what makes it read "tailored".
function jacketHalf(y) {
    if (y >= WAIST_Y) {
        const t = smoothstep((y - WAIST_Y) / (SHOULDER_Y - WAIST_Y));
        return WAIST_HALF + (SHOULDER_HALF - WAIST_HALF) * t;
    }
    const t = THREE.MathUtils.clamp((WAIST_Y - y) / (WAIST_Y - HEM_Y), 0, 1);
    return WAIST_HALF + (HEM_HALF - WAIST_HALF) * t;
}

// Inner edge of a front panel: a centre closure low down, opening into the
// V of the neckline above the chest.
function jacketInner(y) {
    if (y > CHEST_Y) {
        const t = (y - CHEST_Y) / (SHOULDER_Y - CHEST_Y);
        return CLOSURE_GAP + (NECK_HALF - CLOSURE_GAP) * t;
    }
    return CLOSURE_GAP;
}

// Wrap a flat panel onto an elliptical front shell so it has real volume.
function frontZ(x, hw) {
    const u = THREE.MathUtils.clamp(Math.abs(x) / Math.max(hw, 0.001), 0, 1);
    return FRONT_DEPTH * Math.sqrt(1 - u * u);
}

function sampleBody(out) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const y = rand(HEM_Y, SHOULDER_Y);
    const hw = jacketHalf(y);
    const inner = Math.min(jacketInner(y), hw - 0.02);
    const x = side * (inner + (hw - inner) * Math.random());
    const z = frontZ(x, hw) + rand(-0.025, 0.025);
    out.set(x, y, z);
}

// Bent, tapering sleeve as a swept tube from shoulder → elbow → cuff.
function sleevePath(side, t, out) {
    const shoulder = [side * (SHOULDER_HALF - 0.06), SHOULDER_Y - 0.04, 0.05];
    const elbow = [side * (SHOULDER_HALF + 0.07), 0.5, 0.24];
    const wrist = [side * 0.66, -0.46, 0.12];
    bezier3(shoulder, elbow, wrist, t, out);
}

function sampleSleeve(out) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const t = Math.random();
    sleevePath(side, t, out);
    const radius = 0.2 * (1 - t) + 0.085 * t;     // tapers toward the cuff
    const a = rand(0, Math.PI * 2);
    const rr = radius * Math.sqrt(Math.random());
    out.x += Math.cos(a) * rr;
    out.y += Math.sin(a) * rr * 0.85;
    // cos (not sin) for depth so the cross-section wraps round the tube
    // instead of collapsing y and z onto one correlated plane.
    out.z += Math.cos(a) * rr * 0.5 + 0.02;
}

// Soft fill across the lapels framing the neckline V.
function sampleCollar(out) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const t = Math.random();
    const x = side * (0.06 + (NECK_HALF - 0.06) * t) + side * rand(0, 0.09);
    const y = CHEST_Y + (SHOULDER_Y - CHEST_Y) * t;
    const hw = jacketHalf(y);
    out.set(x, y, frontZ(Math.min(Math.abs(x), hw), hw) + 0.03);
}

// Dim trouser legs below the hem — present so the jacket reads as worn.
function sampleLegs(out) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const t = Math.random();
    const x = side * 0.22 + side * (0.04 * t);
    const y = (HEM_Y - 0.05) + (-2.35 - (HEM_Y - 0.05)) * t;
    const radius = 0.2 * (1 - t) + 0.12 * t;
    const a = rand(0, Math.PI * 2);
    const rr = radius * Math.sqrt(Math.random());
    out.set(x + Math.cos(a) * rr, y, Math.sin(a) * rr * 0.7);
}

// Dim head + neck above the collar.
function sampleHead(out) {
    if (Math.random() < 0.4) {
        out.set(rand(-0.12, 0.12), rand(SHOULDER_Y, SHOULDER_Y + 0.22), rand(-0.06, 0.1));
        return;
    }
    const a = rand(0, Math.PI * 2);
    const b = Math.acos(rand(-1, 1));
    const rr = 0.21 * Math.cbrt(Math.random());
    out.set(Math.sin(b) * Math.cos(a) * rr, 1.96 + Math.cos(b) * rr, Math.sin(b) * Math.sin(a) * rr);
}

// Faint volumetric aura hugging the jacket — adds glow body around the seams.
function sampleAura(out) {
    const a = rand(0, Math.PI * 2);
    const rr = rand(0.7, 1.7);
    out.set(Math.cos(a) * rr, rand(0.1, 1.6), Math.sin(a) * rr * 0.6 - 0.1);
}

/* ---------- two formations: threads → jacket ---------- */

// The chaotic-but-flowing "silk thread" curtain every particle starts from.
function fillThreads(count, pos, col, whiteMix) {
    for (let i = 0; i < count; i++) {
        const thread = i % THREADS;
        const baseX = ((thread / (THREADS - 1)) - 0.5) * 5.2;
        const phase = thread * 1.7;
        const p = Math.random();
        const y = -2.8 + p * 5.6;
        const x = baseX + Math.sin(p * Math.PI * 2.2 + phase) * 0.3 + rand(-0.04, 0.04);
        const z = Math.cos(p * Math.PI * 1.8 + phase) * 0.5 + rand(-0.04, 0.04);
        gradientColor(p, tmp);
        if (whiteMix > 0) tmp.lerp(C_WHITE, whiteMix);
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
}

// Matte fabric layer: jacket shell + dim worn figure. Returns the jacket mask.
function fillFabric(count, pos, col) {
    const mask = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
        const r = Math.random();
        let isJacket = true;
        let tone = 1;        // 1 = jacket fabric, 0 = dim body, 2 = faint aura
        if (r < 0.5) sampleBody(vec);
        else if (r < 0.7) sampleSleeve(vec);
        else if (r < 0.78) sampleCollar(vec);
        else if (r < 0.92) { sampleLegs(vec); isJacket = false; tone = 0; }
        else if (r < 0.97) { sampleHead(vec); isJacket = false; tone = 0; }
        else { sampleAura(vec); tone = 2; }

        mask[i] = isJacket ? 1 : 0;
        if (tone === 0) {
            tmp.copy(C_DIM).multiplyScalar(rand(0.42, 0.62));
        } else {
            heightTone(vec.y, tmp);
            if (tone === 2) tmp.multiplyScalar(0.32);
            else tmp.multiplyScalar(rand(0.82, 1));   // subtle weave variation
        }
        pos[i * 3] = vec.x; pos[i * 3 + 1] = vec.y; pos[i * 3 + 2] = vec.z;
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    return mask;
}

// Additive seam layer: the crisp couture lines that define the cut.
function fillAccent(count, pos, col) {
    for (let i = 0; i < count; i++) {
        const r = Math.random();
        let bright = 1;
        if (r < 0.18) {
            // Centre front placket + buttons.
            const y = rand(HEM_Y, CHEST_Y);
            vec.set(rand(-0.012, 0.012), y, FRONT_DEPTH + 0.01);
            if (Math.random() < 0.16) bright = 1.6;   // button nodes
        } else if (r < 0.4) {
            // Notched lapel edges (both sides).
            const side = Math.random() < 0.5 ? -1 : 1;
            const t = Math.random();
            const x = side * (0.06 + (NECK_HALF - 0.06) * t);
            const y = CHEST_Y + (SHOULDER_Y - CHEST_Y) * t;
            const hw = jacketHalf(y);
            vec.set(x, y, frontZ(Math.min(Math.abs(x), hw), hw) + 0.04);
            bright = 1.2;
        } else if (r < 0.52) {
            // Shoulder seams, neck → shoulder tip.
            const side = Math.random() < 0.5 ? -1 : 1;
            const t = Math.random();
            const x = side * (NECK_HALF + (SHOULDER_HALF - 0.04 - NECK_HALF) * t);
            vec.set(x, SHOULDER_Y - 0.04 * t, 0.12 * (1 - t) + 0.02);
        } else if (r < 0.68) {
            // Princess seams down each front panel.
            const side = Math.random() < 0.5 ? -1 : 1;
            const t = Math.random();
            const y = HEM_Y + (SHOULDER_Y - 0.12 - HEM_Y) * t;
            const x = side * (0.26 + 0.1 * (1 - t));
            const hw = jacketHalf(y);
            vec.set(x, y, frontZ(Math.min(Math.abs(x), hw), hw) + 0.02);
        } else if (r < 0.86) {
            // Sleeve outer seam + cuff.
            const side = Math.random() < 0.5 ? -1 : 1;
            const t = Math.random();
            sleevePath(side, t, vec);
            const radius = 0.2 * (1 - t) + 0.085 * t;
            vec.x += side * radius * 0.9;
            vec.z += 0.02;
            if (t > 0.92) bright = 1.4;               // cuff edge
        } else {
            // Hem edge across the flare.
            const x = rand(-HEM_HALF, HEM_HALF);
            const hw = jacketHalf(HEM_Y);
            vec.set(x, HEM_Y, frontZ(Math.min(Math.abs(x), hw), hw) + 0.02);
        }
        heightTone(vec.y, tmp);
        tmp.lerp(C_WHITE, 0.5).multiplyScalar(bright);
        pos[i * 3] = vec.x; pos[i * 3 + 1] = vec.y; pos[i * 3 + 2] = vec.z;
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    return null;
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
    sprite.position.set(0, 0.7, -0.5);
    return sprite;
}

/* ---------- layer construction ---------- */

function createLayer(count, fill, threadWhiteMix, material) {
    const posThreads = new Float32Array(count * 3);
    const colThreads = new Float32Array(count * 3);
    fillThreads(count, posThreads, colThreads, threadWhiteMix);

    const posFigure = new Float32Array(count * 3);
    const colFigure = new Float32Array(count * 3);
    const mask = fill(count, posFigure, colFigure);

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(new Float32Array(posThreads), 3);
    const colAttr = new THREE.BufferAttribute(new Float32Array(colThreads), 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("color", colAttr);

    return {
        count, posThreads, colThreads, posFigure, colFigure, mask,
        posAttr, colAttr, points: new THREE.Points(geo, material),
    };
}

/* ---------- per-frame morph (only runs for the transformation acts) ---------- */

// Blend one layer from its thread origin to its jacket target. `glow`
// brightens masked (or, mask===null, all) particles for the couture pulse.
// `shimmerY` / `shimmerAmt` sweep a soft highlight band up the seams.
function morphLayer(L, local, time, glow, shimmerY, shimmerAmt) {
    const pos = L.posAttr.array;
    const col = L.colAttr.array;
    const pt = L.posThreads, pf = L.posFigure;
    const ct = L.colThreads, cf = L.colFigure;
    const mask = L.mask;
    const calm = 1 - 0.7 * local;            // jitter settles as the jacket forms
    const hasShimmer = shimmerAmt > 0.001;

    for (let k = 0; k < L.count; k++) {
        const j = k * 3;
        pos[j] = pt[j] + (pf[j] - pt[j]) * local + Math.sin(time * 0.7 + k) * 0.012 * calm;
        pos[j + 1] = pt[j + 1] + (pf[j + 1] - pt[j + 1]) * local + Math.cos(time * 0.6 + k * 1.3) * 0.012 * calm;
        pos[j + 2] = pt[j + 2] + (pf[j + 2] - pt[j + 2]) * local;

        let r = ct[j] + (cf[j] - ct[j]) * local;
        let g = ct[j + 1] + (cf[j + 1] - ct[j + 1]) * local;
        let b = ct[j + 2] + (cf[j + 2] - ct[j + 2]) * local;

        let mul = (!mask || mask[k]) ? glow : 1;
        if (hasShimmer) {
            const dy = pf[j + 1] - shimmerY;
            mul *= 1 + shimmerAmt * Math.exp(-dy * dy * 7);
        }
        if (mul !== 1) { r *= mul; g *= mul; b *= mul; }
        col[j] = r; col[j + 1] = g; col[j + 2] = b;
    }
    L.posAttr.needsUpdate = true;
    L.colAttr.needsUpdate = true;
}

function updateMorph(time) {
    const p = easedProgress;

    // Map the last stretch of the scroll to threads → jacket, holding the
    // threads through act V and weaving the garment across act VI.
    const tp = THREE.MathUtils.clamp((p - CANVAS_FROM) / (1 - CANVAS_FROM), 0, 1);
    const local = smoothstep((tp - 0.42) / 0.4);
    const figureAmt = local;
    const pulse = 1 + Math.sin(time * 2.2) * 0.16;

    // Fabric: gentle breathing glow on the jacket once it forms.
    morphLayer(fabric, local, time, 1 + (pulse - 1) * figureAmt, 0, 0);

    // Seams: brighter, with a highlight sweeping up the cut.
    const accentGlow = 0.55 + (0.6 + Math.sin(time * 2.6) * 0.22) * figureAmt;
    const shimmerY = HEM_Y + ((time * 0.4) % 1) * (SHOULDER_Y - HEM_Y);
    morphLayer(accent, local, time, accentGlow, shimmerY, 0.9 * figureAmt);

    halo.material.opacity = (figureAmt * figureAmt) * (0.55 + Math.sin(time * 2.2) * 0.16);
    group.rotation.y = Math.sin(time * 0.1) * 0.1 + tp * 0.22;
    group.scale.setScalar(1 + Math.sin(time * 1.1) * 0.012 * figureAmt);

    const zBase = camera.aspect < 1 ? 9.2 : 7;
    camera.position.z = zBase - tp * 1;
    camera.lookAt(0, 0.45 + tp * 0.1, 0);
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
    camera.position.set(0, 0.45, 7);

    const sprite = makeSprite();
    const fabricMat = new THREE.PointsMaterial({
        size: MOBILE ? 0.12 : 0.1,
        sizeAttenuation: true,
        map: sprite,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        opacity: 1,
    });
    const accentMat = new THREE.PointsMaterial({
        size: MOBILE ? 0.085 : 0.07,
        sizeAttenuation: true,
        map: sprite,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
    });

    fabric = createLayer(COUNT, fillFabric, 0, fabricMat);
    accent = createLayer(ACCENT, fillAccent, 0.5, accentMat);

    group = new THREE.Group();
    halo = makeHalo();
    group.add(halo);
    group.add(fabric.points);
    group.add(accent.points);   // additive seams render last → glow on top
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
