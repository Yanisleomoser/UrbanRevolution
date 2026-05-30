/**
 * Urban Revolution — Visual Scroll Story (continuous single-object morph)
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
 * Rendering: the thread→jacket morph runs entirely on the GPU (a custom
 * points ShaderMaterial mixes two position/colour sets by a uniform), so
 * the CPU only nudges a handful of uniforms per frame — that buys us a
 * far denser particle budget. The seams are lifted by a bloom pass
 * (EffectComposer → UnrealBloomPass) for a soft couture glow.
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
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const MOBILE = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(max-width: 768px)").matches;
// GPU morph lets us run far more particles than the old CPU loop.
const COUNT = MOBILE ? 5200 : 12000;      // matte fabric + dim body
const ACCENT = MOBILE ? 1100 : 2600;      // glowing couture seams
const THREADS = 64;
const EASE = 0.07;
// Where the WebGL transformation takes over from the photos (scroll 0–1).
const CANVAS_FROM = 0.6;
const VOID = 0x0a0a0c;
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
const C_WHITE = new THREE.Color("#ffffff");

// Jacket silhouette, in the same world units as the figure (y up, +z front).
const SHOULDER_Y = 1.52, SHOULDER_HALF = 0.82;
const CHEST_Y = 0.98;
const WAIST_Y = 0.34, WAIST_HALF = 0.5;
const HEM_Y = -0.3, HEM_HALF = 0.62;
const NECK_HALF = 0.17;     // half-width of the collar opening at the shoulders
const FRONT_DEPTH = 0.34;   // z bulge of the front shell at centre
const CLOSURE_GAP = 0.05;   // half-gap at centre front (the closure line)

/* ---------- GPU morph shaders ---------- */
// Each particle carries its thread origin (position), its jacket target
// (aFigure) and both colours; the vertex shader mixes them by uLocal and
// applies the settle-jitter, couture glow pulse and seam shimmer.
const VERT = /* glsl */`
    attribute vec3 aFigure;
    attribute vec3 aColA;
    attribute vec3 aColB;
    attribute float aMask;
    attribute float aSeed;
    uniform float uLocal, uTime, uGlow, uShimmerY, uShimmerAmt, uMaskAll, uSize, uScale;
    uniform vec3 uFog;
    varying vec3 vColor;
    void main() {
        float calm = 1.0 - 0.7 * uLocal;
        vec3 p = mix(position, aFigure, uLocal);
        p.x += sin(uTime * 0.7 + aSeed) * 0.012 * calm;
        p.y += cos(uTime * 0.6 + aSeed * 1.3) * 0.012 * calm;

        vec3 col = mix(aColA, aColB, uLocal);
        float glow = mix(1.0, uGlow, max(aMask, uMaskAll));
        if (uShimmerAmt > 0.001) {
            float dy = aFigure.y - uShimmerY;
            glow *= 1.0 + uShimmerAmt * exp(-dy * dy * 7.0);
        }
        col *= glow;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // FogExp2 toward the void so distant particles melt into the dark.
        float fog = 1.0 - exp(-pow(0.055 * length(mv.xyz), 2.0));
        vColor = mix(col, uFog, fog);

        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (uScale / -mv.z);
    }
`;
const FRAG = /* glsl */`
    uniform sampler2D uMap;
    uniform float uOpacity;
    varying vec3 vColor;
    void main() {
        float a = texture2D(uMap, gl_PointCoord).a;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColor, a * uOpacity);
    }
`;

// Global throughput, for the live counter (sourced, see CREDITS.md):
//   >100bn garments/yr ÷ 31.536e6 s ≈ 3,170 produced per second;
//   ~1 rubbish-truck of textiles dumped/burned per second.
const GARMENTS_PER_SEC = 3170;
const TRUCKS_PER_SEC = 1;

let renderer = null;
let scene = null;
let camera = null;
let group = null;
let halo = null;
let composer = null;
let bloom = null;
let sprite = null;

let fabric = null;   // { uniforms, points }  — matte garment + dim body
let accent = null;   // { uniforms, points }  — glowing couture seams
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
let needsProgress = true;
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
        if (r < 0.12) {
            // Centre front placket + buttons.
            const y = rand(HEM_Y, CHEST_Y);
            vec.set(rand(-0.012, 0.012), y, FRONT_DEPTH + 0.01);
            if (Math.random() < 0.16) bright = 1.3;   // button nodes
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
            if (t > 0.92) bright = 1.25;              // cuff edge
        } else {
            // Hem edge across the flare.
            const x = rand(-HEM_HALF, HEM_HALF);
            const hw = jacketHalf(HEM_Y);
            vec.set(x, HEM_Y, frontZ(Math.min(Math.abs(x), hw), hw) + 0.02);
        }
        heightTone(vec.y, tmp);
        // lerp toward white but leave brightness headroom for the bloom pass
        // so the additive seams glow rather than clip to a hot white core.
        tmp.lerp(C_WHITE, 0.42).multiplyScalar(bright);
        pos[i * 3] = vec.x; pos[i * 3 + 1] = vec.y; pos[i * 3 + 2] = vec.z;
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    return null;
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
    const s2 = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
    }));
    s2.scale.set(6, 6, 1);
    s2.position.set(0, 0.7, -0.5);
    return s2;
}

/* ---------- layer construction ---------- */

function createLayer(count, fill, threadWhiteMix, opts) {
    const posA = new Float32Array(count * 3);   // thread origin → "position"
    const colA = new Float32Array(count * 3);
    fillThreads(count, posA, colA, threadWhiteMix);

    const posB = new Float32Array(count * 3);   // jacket target
    const colB = new Float32Array(count * 3);
    const mask = fill(count, posB, colB);

    const aMask = new Float32Array(count);
    const aSeed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        aMask[i] = mask ? mask[i] : 0;
        aSeed[i] = i;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posA, 3));
    geo.setAttribute("aFigure", new THREE.BufferAttribute(posB, 3));
    geo.setAttribute("aColA", new THREE.BufferAttribute(colA, 3));
    geo.setAttribute("aColB", new THREE.BufferAttribute(colB, 3));
    geo.setAttribute("aMask", new THREE.BufferAttribute(aMask, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));

    const uniforms = {
        uLocal: { value: 0 },
        uTime: { value: 0 },
        uGlow: { value: 1 },
        uShimmerY: { value: 0 },
        uShimmerAmt: { value: 0 },
        uMaskAll: { value: opts.maskAll ? 1 : 0 },
        uSize: { value: opts.size },
        uScale: { value: 300 },
        uMap: { value: sprite },
        uOpacity: { value: opts.opacity },
        uFog: { value: new THREE.Color(VOID) },
    };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: opts.blending,
    });

    return { uniforms, points: new THREE.Points(geo, mat) };
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    sp.scale.set(6, 6, 1); sp.position.set(0, 0.9, -0.5); return sp;
}

/* ---------- per-frame morph ---------- */

function setLayer(L, local, time, glow, shimmerY, shimmerAmt) {
    L.uniforms.uLocal.value = local;
    L.uniforms.uTime.value = time;
    L.uniforms.uGlow.value = glow;
    L.uniforms.uShimmerY.value = shimmerY;
    L.uniforms.uShimmerAmt.value = shimmerAmt;
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
    setLayer(fabric, local, time, 1 + (pulse - 1) * figureAmt, 0, 0);

    // Seams: brighter, with a highlight sweeping up the cut. Kept below a
    // hot-white core so the bloom pass does the glowing, not raw clipping.
    const accentGlow = 0.5 + (0.45 + Math.sin(time * 2.6) * 0.18) * figureAmt;
    const shimmerY = HEM_Y + ((time * 0.4) % 1) * (SHOULDER_Y - HEM_Y);
    setLayer(accent, local, time, accentGlow, shimmerY, 0.55 * figureAmt);

    halo.material.opacity = (figureAmt * figureAmt) * (0.55 + Math.sin(time * 2.2) * 0.16);
    group.rotation.y = Math.sin(time * 0.1) * 0.1 + tp * 0.22;
    group.scale.setScalar(1 + Math.sin(time * 1.1) * 0.012 * figureAmt);

    const zBase = camera.aspect < 1 ? 9.2 : 7;
    camera.position.z = zBase - tp * 1;
    camera.lookAt(0, 0.45 + tp * 0.1, 0);
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
    // Read scroll position at most once per frame (flagged by the scroll /
    // resize listeners) so we never force a layout read in the scroll handler.
    if (needsProgress) { readProgress(); needsProgress = false; }
    easedProgress += (targetProgress - easedProgress) * EASE;

    // Canvas only matters for the transformation acts — fade it in and
    // skip the particle work (incl. the bloom passes) while photos show.
    const vis = smoothstep((easedProgress - (CANVAS_FROM - 0.005)) / 0.06);
    renderer.domElement.style.opacity = vis.toFixed(3);
    if (vis < 0.01) return;

    updateMorph(performance.now() * 0.001);
    composer.render();
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
    composer.setSize(w, h);
    if (bloom) bloom.setSize(w, h);
    // Match three's PointsMaterial size attenuation (scale = CSS height / 2).
    fabric.uniforms.uScale.value = h * 0.5;
    accent.uniforms.uScale.value = h * 0.5;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: !MOBILE,
            powerPreference: "high-performance",
        });
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (err) {
        section.classList.add("no-webgl");
        console.warn("[story-scene] WebGL unavailable:", err && err.message);
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Opaque void: during the transformation acts no photo shows behind the
    // canvas, so a solid clear keeps the bloom pass clean (no alpha fringes).
    renderer.setClearColor(VOID, 1);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0.45, 7);

    sprite = makeSprite();
    fabric = createLayer(COUNT, fillFabric, 0, {
        size: MOBILE ? 0.12 : 0.1,
        opacity: 1,
        blending: THREE.NormalBlending,
        maskAll: false,
    });
    accent = createLayer(ACCENT, fillAccent, 0.5, {
        size: MOBILE ? 0.085 : 0.07,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        maskAll: true,
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
    halo = makeHalo();
    group.add(halo);
    group.add(fabric.points);
    group.add(accent.points);   // additive seams render last → glow on top
    scene.add(group);

    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        MOBILE ? 0.3 : 0.4,   // strength — a soft couture glow, not a blowout
        0.5,                  // radius
        0.85,                 // threshold — only the brightest seam cores bloom
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    resize();
    readProgress();
    easedProgress = targetProgress;
    group.add(halo); group.add(points); scene.add(group);

    resize(); readProgress(); easedProgress = targetProgress;

    scrollListener = () => { needsProgress = true; };
    resizeListener = () => { needsProgress = true; resize(); };
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
