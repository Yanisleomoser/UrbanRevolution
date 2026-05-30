/**
 * Urban Revolution — Visual Scroll Story (continuous single-object morph)
 *
 * One hero object, a single GPU particle system, never dissolves — it
 * transforms continuously as you scroll, so the whole story speaks ONE
 * visual language. The same particles are, in turn:
 *
 *   I   a PET bottle            "this bottle outlives your great-grandkids"
 *   II  → a heap of waste       "your old shirt becomes this mountain"
 *   III → dispersing drift      "it travels on — to places you never see"
 *   IV  → dust inside a body    "it comes back. in the blood of 4 in 5 of us"
 *   V   → glowing silk threads  "but the same fibre can become something else"
 *   VI  → a tailored jacket     "made for one. your next piece."
 *
 * Rendering (the combine of the two story branches):
 *   - The morph runs entirely in a points vertex shader: each particle
 *     carries its current keyframe (A = built-in `position`) and the next
 *     (B = aPosB) plus both colours; the shader mixes them by a `uLocal`
 *     uniform every frame. The CPU only swaps the A/B attribute buffers at
 *     act boundaries (~5×/scroll) and nudges a handful of uniforms — so the
 *     per-frame cost is O(1) and the particle budget can be large.
 *   - Act VI is a real tailored jacket (structured shoulders, notched-lapel
 *     collar, tapered body, sleeves) whose couture seams (placket, lapels,
 *     princess/armhole seams, cuffs, hem) are bright particles lifted by a
 *     bloom pass (EffectComposer → UnrealBloomPass) for a soft glow.
 *
 * A scroll/time-driven counter (acts I–IV) makes the scale personal.
 * Degrades gracefully: reduced-motion / no-WebGL → CSS shows static acts.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const MOBILE = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(max-width: 768px)").matches;
const COUNT = MOBILE ? 5200 : 9000;
const THREADS = 56;
const EASE = 0.075;
const VOID = 0x0a0a0c;

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

// Jacket silhouette (act VI), in the same world units as the figure.
const SHOULDER_Y = 1.52, SHOULDER_HALF = 0.82;
const CHEST_Y = 0.98;
const WAIST_Y = 0.34, WAIST_HALF = 0.5;
const HEM_Y = -0.3, HEM_HALF = 0.62;
const NECK_HALF = 0.17;
const FRONT_DEPTH = 0.34;
const CLOSURE_GAP = 0.05;
const SEAM_N = Math.floor(COUNT * 0.2);   // particles that land on couture seams

// Global throughput, for the live counter (sourced, see CREDITS.md):
//   >100bn garments/yr ÷ 31.536e6 s ≈ 3,170 produced per second;
//   ~1 rubbish-truck of textiles dumped/burned per second.
const GARMENTS_PER_SEC = 3170;
const TRUCKS_PER_SEC = 1;

/* ---------- GPU morph shaders ---------- */
const VERT = /* glsl */`
    attribute vec3 aPosB;
    attribute vec3 aColA;
    attribute vec3 aColB;
    attribute float aMask;
    attribute float aSeed;
    uniform float uLocal, uTime, uFigureAmt, uPulse, uSeamGlow, uShimmerY, uShimmerAmt, uSize, uScale;
    uniform vec3 uFog;
    varying vec3 vColor;
    void main() {
        vec3 p = mix(position, aPosB, uLocal);
        p.x += sin(uTime * 0.7 + aSeed) * 0.012;
        p.y += cos(uTime * 0.6 + aSeed * 1.3) * 0.012;

        vec3 col = mix(aColA, aColB, uLocal);
        // The mask encodes each particle's role in the jacket keyframe
        // (0 body, 1 fabric, 2 seam); it only lights up as we reach act VI.
        if (uFigureAmt > 0.001 && aMask > 0.5) {
            float g = (aMask > 1.5) ? uSeamGlow : uPulse;
            if (aMask > 1.5 && uShimmerAmt > 0.001) {
                float dy = aPosB.y - uShimmerY;
                g *= 1.0 + uShimmerAmt * exp(-dy * dy * 7.0);
            }
            col *= mix(1.0, g, uFigureAmt);
        }

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float fog = 1.0 - exp(-pow(0.05 * length(mv.xyz), 2.0));
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

let renderer = null;
let scene = null;
let camera = null;
let points = null;
let halo = null;
let group = null;
let composer = null;
let bloom = null;

let formations = [];
let jacketMask = null;
let posAttr, posBAttr, colAAttr, colBAttr;   // posAttr === the built-in "position"
let uniforms = null;
let lastPair = -1;

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

function heightTone(y, out) {
    const h = THREE.MathUtils.clamp((y - HEM_Y) / (SHOULDER_Y + 0.3 - HEM_Y), 0, 1);
    return gradientColor(h, out);
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

/* ---------- jacket silhouette (act VI) ---------- */

function bezier3(p0, p1, p2, t, out) {
    const mt = 1 - t;
    out.set(
        mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
        mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
        mt * mt * p0[2] + 2 * mt * t * p1[2] + t * t * p2[2],
    );
}
function jacketHalf(y) {
    if (y >= WAIST_Y) {
        const t = smoothstep((y - WAIST_Y) / (SHOULDER_Y - WAIST_Y));
        return WAIST_HALF + (SHOULDER_HALF - WAIST_HALF) * t;
    }
    const t = THREE.MathUtils.clamp((WAIST_Y - y) / (WAIST_Y - HEM_Y), 0, 1);
    return WAIST_HALF + (HEM_HALF - WAIST_HALF) * t;
}
function jacketInner(y) {
    if (y > CHEST_Y) {
        const t = (y - CHEST_Y) / (SHOULDER_Y - CHEST_Y);
        return CLOSURE_GAP + (NECK_HALF - CLOSURE_GAP) * t;
    }
    return CLOSURE_GAP;
}
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
    out.set(x, y, frontZ(x, hw) + rand(-0.025, 0.025));
}
function sleevePath(side, t, out) {
    bezier3([side * (SHOULDER_HALF - 0.06), SHOULDER_Y - 0.04, 0.05],
            [side * (SHOULDER_HALF + 0.07), 0.5, 0.24],
            [side * 0.66, -0.46, 0.12], t, out);
}
function sampleSleeve(out) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const t = Math.random();
    sleevePath(side, t, out);
    const radius = 0.2 * (1 - t) + 0.085 * t;
    const a = rand(0, Math.PI * 2);
    const rr = radius * Math.sqrt(Math.random());
    out.x += Math.cos(a) * rr;
    out.y += Math.sin(a) * rr * 0.85;
    out.z += Math.cos(a) * rr * 0.5 + 0.02;
}
function sampleCollar(out) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const t = Math.random();
    const x = side * (0.06 + (NECK_HALF - 0.06) * t) + side * rand(0, 0.09);
    const y = CHEST_Y + (SHOULDER_Y - CHEST_Y) * t;
    const hw = jacketHalf(y);
    out.set(x, y, frontZ(Math.min(Math.abs(x), hw), hw) + 0.03);
}
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

// A point on one of the couture seams (bright; lifted by the bloom pass).
function sampleSeam(out) {
    const r = Math.random();
    let bright = 1;
    if (r < 0.14) {                                   // centre placket + buttons
        out.set(rand(-0.012, 0.012), rand(HEM_Y, CHEST_Y), FRONT_DEPTH + 0.01);
        if (Math.random() < 0.16) bright = 1.3;
    } else if (r < 0.4) {                             // notched lapel edges
        const side = Math.random() < 0.5 ? -1 : 1, t = Math.random();
        const x = side * (0.06 + (NECK_HALF - 0.06) * t);
        const y = CHEST_Y + (SHOULDER_Y - CHEST_Y) * t, hw = jacketHalf(y);
        out.set(x, y, frontZ(Math.min(Math.abs(x), hw), hw) + 0.04); bright = 1.2;
    } else if (r < 0.52) {                            // shoulder seams
        const side = Math.random() < 0.5 ? -1 : 1, t = Math.random();
        out.set(side * (NECK_HALF + (SHOULDER_HALF - 0.04 - NECK_HALF) * t), SHOULDER_Y - 0.04 * t, 0.12 * (1 - t) + 0.02);
    } else if (r < 0.68) {                            // princess seams
        const side = Math.random() < 0.5 ? -1 : 1, t = Math.random();
        const y = HEM_Y + (SHOULDER_Y - 0.12 - HEM_Y) * t, hw = jacketHalf(y);
        out.set(side * (0.26 + 0.1 * (1 - t)), y, frontZ(Math.min(side * (0.26 + 0.1 * (1 - t)), hw), hw) + 0.02);
    } else if (r < 0.86) {                            // sleeve outer seam + cuff
        const side = Math.random() < 0.5 ? -1 : 1, t = Math.random();
        sleevePath(side, t, out);
        out.x += side * (0.2 * (1 - t) + 0.085 * t) * 0.9; out.z += 0.02;
        if (t > 0.92) bright = 1.25;
    } else {                                          // hem edge
        const x = rand(-HEM_HALF, HEM_HALF), hw = jacketHalf(HEM_Y);
        out.set(x, HEM_Y, frontZ(Math.min(Math.abs(x), hw), hw) + 0.02);
    }
    return bright;
}

/* ---------- the six keyframes of the hero object ---------- */

// I — a single PET bottle (body + shoulder + neck + cap).
function buildBottle() {
    const f = alloc();
    for (let i = 0; i < COUNT; i++) {
        const u = Math.random();
        let y, radius;
        if (u < 0.66) { y = rand(-1.7, 0.9); radius = 0.62; }
        else if (u < 0.8) { const t = Math.random(); y = 0.9 + t * 0.5; radius = 0.62 - t * 0.42; }
        else if (u < 0.94) { y = rand(1.4, 1.9); radius = 0.2; }
        else { y = rand(1.9, 2.1); radius = 0.26; }
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
        if (Math.random() < 0.62) {
            sampleHuman(vec); vec.multiplyScalar(0.92);
            tmp.copy(Math.random() < 0.4 ? C_TOXIC : C_SKIN).multiplyScalar(rand(0.55, 0.95));
        } else {
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

// VI — the vision: a real tailored jacket. The first SEAM_N particles land
// on glowing couture seams; the rest are matte fabric + a dim worn figure.
// jacketMask (0 body / 1 fabric / 2 seam) drives the shader's act-VI glow.
function buildJacket() {
    const f = alloc();
    jacketMask = new Uint8Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        if (i < SEAM_N) {
            const bright = sampleSeam(vec);
            heightTone(vec.y, tmp);
            tmp.lerp(C_WHITE, 0.42).multiplyScalar(bright);
            jacketMask[i] = 2;
        } else {
            const r = Math.random();
            let mask = 1;
            if (r < 0.5) sampleBody(vec);
            else if (r < 0.7) sampleSleeve(vec);
            else if (r < 0.78) sampleCollar(vec);
            else if (r < 0.92) { sampleLegs(vec); mask = 0; }
            else if (r < 0.97) { sampleHead(vec); mask = 0; }
            else {
                const a = rand(0, Math.PI * 2), rr = rand(0.7, 1.7);
                vec.set(Math.cos(a) * rr, rand(0.1, 1.6), Math.sin(a) * rr * 0.6 - 0.1);
            }
            if (mask === 0) tmp.copy(C_DIM).multiplyScalar(rand(0.42, 0.62));
            else {
                heightTone(vec.y, tmp);
                if (r >= 0.97) tmp.multiplyScalar(0.32);          // faint aura
                else tmp.multiplyScalar(rand(0.82, 1));
            }
            jacketMask[i] = mask;
        }
        put(f, i, vec.x, vec.y, vec.z, tmp);
    }
    return f;
}

/* ---------- sprites ---------- */

function makeSprite() {
    const s = 64, c = document.createElement("canvas"); c.width = c.height = s;
    const ctx = c.getContext("2d"), g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function makeHalo() {
    const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
    const ctx = c.getContext("2d"), g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(168,85,247,0.55)"); g.addColorStop(0.5, "rgba(236,72,153,0.22)");
    g.addColorStop(1, "rgba(59,130,246,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    sp.scale.set(6, 6, 1); sp.position.set(0, 0.8, -0.5); return sp;
}

/* ---------- per-frame morph (GPU; CPU only swaps A/B at act boundaries) ---------- */

function updateMorph(time) {
    const p = easedProgress, NF = formations.length;
    // Each act centre shows its pure keyframe; boundaries cross-fade.
    const fp = THREE.MathUtils.clamp(p * acts.length - 0.5, 0, NF - 1);
    const i = Math.floor(fp);
    const local = smoothstep(fp - i);
    const figureAmt = THREE.MathUtils.clamp(fp - (NF - 2), 0, 1);

    // Swap the A/B keyframe buffers only when the active pair changes.
    if (i !== lastPair) {
        lastPair = i;
        const A = formations[i], B = formations[Math.min(i + 1, NF - 1)];
        posAttr.array.set(A.pos); posAttr.needsUpdate = true;
        posBAttr.array.set(B.pos); posBAttr.needsUpdate = true;
        colAAttr.array.set(A.col); colAAttr.needsUpdate = true;
        colBAttr.array.set(B.col); colBAttr.needsUpdate = true;
    }

    uniforms.uLocal.value = local;
    uniforms.uTime.value = time;
    uniforms.uFigureAmt.value = figureAmt;
    uniforms.uPulse.value = 1 + Math.sin(time * 2.2) * 0.16;
    uniforms.uSeamGlow.value = 1.3 + Math.sin(time * 2.6) * 0.18;
    uniforms.uShimmerY.value = HEM_Y + ((time * 0.4) % 1) * (SHOULDER_Y - HEM_Y);
    uniforms.uShimmerAmt.value = 0.55;

    halo.material.opacity = (figureAmt * figureAmt) * (0.55 + Math.sin(time * 2.2) * 0.16);
    group.rotation.y = Math.sin(time * 0.1) * 0.12 + p * 0.2;
    const zBase = camera.aspect < 1 ? 10.5 : 7.8;
    camera.position.z = zBase - p * 1.3;
    camera.lookAt(0, -0.1 + p * 0.15, 0);
}

/* ---------- counter (acts I–IV) ---------- */

function formatInt(n) {
    const loc = (window.I18N && window.I18N.locale) ? window.I18N.locale() : "de-DE";
    return Math.floor(n).toLocaleString(loc);
}
function updateCounter() {
    if (!counterWrap) return;
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
    if (needsProgress) { readProgress(); needsProgress = false; }
    const now = performance.now() * 0.001;
    // First frame after (re)entering view: lastTs is 0, so dt is 0 — no
    // bogus delta from the time spent off-screen gets added to the counter.
    const dt = lastTs ? Math.min(0.1, now - lastTs) : 0;
    lastTs = now;
    viewSeconds += dt;
    easedProgress += (targetProgress - easedProgress) * EASE;
    updateMorph(now);
    updateCounter();
    composer.render();
}
function resize() {
    const canvas = renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (bloom) bloom.setSize(w, h);
    uniforms.uScale.value = h * 0.5;
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
        renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: "high-performance" });
    } catch (err) {
        section.classList.add("no-webgl");
        console.warn("[story-scene] WebGL unavailable:", err && err.message);
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Opaque void so the bloom pass stays clean; the particle object is the
    // hero throughout (documentary photos remain the no-WebGL/CSS fallback).
    renderer.setClearColor(VOID, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 7.8);

    formations = [buildBottle(), buildHeap(), buildDrift(), buildBodyDust(), buildThreads(), buildJacket()];

    const seed = new Float32Array(COUNT);
    const maskF = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) { seed[i] = i; maskF[i] = jacketMask[i]; }

    const geo = new THREE.BufferGeometry();
    posAttr = new THREE.BufferAttribute(new Float32Array(formations[0].pos), 3);
    posBAttr = new THREE.BufferAttribute(new Float32Array(formations[1].pos), 3);
    colAAttr = new THREE.BufferAttribute(new Float32Array(formations[0].col), 3);
    colBAttr = new THREE.BufferAttribute(new Float32Array(formations[1].col), 3);
    [posAttr, posBAttr, colAAttr, colBAttr].forEach((a) => a.setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("position", posAttr);
    geo.setAttribute("aPosB", posBAttr);
    geo.setAttribute("aColA", colAAttr);
    geo.setAttribute("aColB", colBAttr);
    geo.setAttribute("aMask", new THREE.BufferAttribute(maskF, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    // Fixed bounds — the position buffer is swapped per keyframe, so let the
    // hero object never frustum-cull itself out.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 8);

    uniforms = {
        uLocal: { value: 0 }, uTime: { value: 0 }, uFigureAmt: { value: 0 },
        uPulse: { value: 1 }, uSeamGlow: { value: 1.3 },
        uShimmerY: { value: 0 }, uShimmerAmt: { value: 0 },
        uSize: { value: MOBILE ? 0.11 : 0.09 }, uScale: { value: 300 },
        uMap: { value: makeSprite() }, uOpacity: { value: 1 },
        uFog: { value: new THREE.Color(VOID) },
    };
    const mat = new THREE.ShaderMaterial({
        uniforms, vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });

    group = new THREE.Group();
    points = new THREE.Points(geo, mat);
    halo = makeHalo();
    group.add(halo); group.add(points); scene.add(group);

    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        MOBILE ? 0.3 : 0.4,   // strength — soft couture glow on the seams
        0.5,                  // radius
        0.85,                 // threshold — only the bright seam cores bloom
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

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
