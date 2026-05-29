/**
 * Urban Revolution — Visual Scroll Story (WebGL stage)
 *
 * One GPU particle system (a single BufferGeometry of points) morphs
 * through three target formations as the user scrolls the pinned story
 * section. This makes the brand's "alchemical transformation" literal:
 *
 *   Act I  — a dull heap of clothing waste + PET bottles  (formation A)
 *   Act II — bottles dissolve into flowing silk threads    (formation B)
 *   Act III— threads weave into a tailored figure + jacket (formation C)
 *
 * Scroll progress (0→1) is read passively from the section's track and
 * eased toward each frame, so the morph scrubs buttery-smooth regardless
 * of how the scroll events fire. Visuals (positions + colors) are the
 * only thing driven; the text acts are toggled via `.is-active` classes.
 *
 * Self-contained ES module — imports `three` from the import map (shared
 * with js/3d/controller.js). Mounts after DOMContentLoaded into
 * #story-canvas. Degrades gracefully:
 *   - prefers-reduced-motion → skipped entirely (CSS shows static acts)
 *   - no WebGL                → `.no-webgl` class, CSS shows static acts
 */

import * as THREE from "three";

const COUNT = 7000;          // particle count — mobile-safe, dense enough
const THREADS = 52;          // silk threads in formation B
const EASE = 0.075;          // scroll-progress smoothing per frame

// Brand gradient stops (the editorial palette).
const C_PINK = new THREE.Color("#EC4899");
const C_PURPLE = new THREE.Color("#A855F7");
const C_BLUE = new THREE.Color("#3B82F6");
// Dull, desaturated waste tones for Act I.
const C_WASTE_LO = new THREE.Color("#2c2c30");
const C_WASTE_HI = new THREE.Color("#5b554c");
const C_DIM = new THREE.Color("#8a8f99"); // non-jacket body in Act III

let renderer = null;
let scene = null;
let camera = null;
let points = null;
let halo = null;
let group = null;

let posA, posB, posC;        // Float32Array(COUNT*3) target positions
let colA, colB, colC;        // Float32Array(COUNT*3) target colors
let jacket;                  // Uint8Array(COUNT) — 1 if jacket particle (Act III)
let posAttr, colAttr;        // live BufferAttributes

let track = null;            // the .story-track element
let acts = [];               // .story-act elements
let actNumEl = null;         // [data-act-num] page number

let targetProgress = 0;
let easedProgress = 0;
let currentAct = -1;
let inView = true;
let rafId = 0;
let intersectionObserver = null; // IntersectionObserver for cleanup
let scrollListener = null;
let resizeListener = null;

const tmp = new THREE.Color();

/* ---------- helpers ---------- */

function rand(min, max) {
    return min + Math.random() * (max - min);
}

// Color sampled along the brand gradient (t: 0=pink → 0.52=purple → 1=blue).
function gradientColor(t, out) {
    if (t < 0.52) {
        out.copy(C_PINK).lerp(C_PURPLE, t / 0.52);
    } else {
        out.copy(C_PURPLE).lerp(C_BLUE, (t - 0.52) / 0.48);
    }
    return out;
}

/* ---------- formation builders ---------- */

// Formation A — a chaotic, dramatically-lit waste mound emerging from black.
function buildWaste() {
    posA = new Float32Array(COUNT * 3);
    colA = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
        const a = rand(0, Math.PI * 2);
        const rad = Math.sqrt(Math.random()) * 2.7;     // denser core
        const mound = 1 - rad / 2.7;                    // peak in the middle
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad * 0.6;              // flattened depth
        const y = -2.3 + mound * 2.6 * Math.random() + rand(-0.28, 0.28);

        posA[i * 3] = x;
        posA[i * 3 + 1] = y;
        posA[i * 3 + 2] = z;

        // Mostly dull waste; a faint few hint at PET-bottle blue/green.
        if (Math.random() < 0.06) {
            tmp.copy(C_BLUE).lerp(C_WASTE_HI, 0.55).multiplyScalar(0.5);
        } else {
            tmp.copy(C_WASTE_LO).lerp(C_WASTE_HI, Math.random());
            tmp.multiplyScalar(rand(0.55, 1.0)); // dramatic light falloff
        }
        colA[i * 3] = tmp.r;
        colA[i * 3 + 1] = tmp.g;
        colA[i * 3 + 2] = tmp.b;
    }
}

// Formation B — fine, flowing vertical silk threads in the brand gradient.
function buildThreads() {
    posB = new Float32Array(COUNT * 3);
    colB = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
        const thread = i % THREADS;
        const baseX = ((thread / (THREADS - 1)) - 0.5) * 5.4;   // spread across width
        const phase = thread * 1.7;
        const p = Math.random();                                // 0..1 up the thread
        const y = -2.8 + p * 5.6;
        const wave = Math.sin(p * Math.PI * 2.2 + phase);
        const x = baseX + wave * 0.32 + rand(-0.04, 0.04);
        const z = Math.cos(p * Math.PI * 1.8 + phase) * 0.5 + rand(-0.04, 0.04);

        posB[i * 3] = x;
        posB[i * 3 + 1] = y;
        posB[i * 3 + 2] = z;

        gradientColor(p, tmp);
        colB[i * 3] = tmp.r;
        colB[i * 3 + 1] = tmp.g;
        colB[i * 3 + 2] = tmp.b;
    }
}

// Sample a point near a line segment (a "limb" capsule) with radial jitter.
function pointOnSegment(ax, ay, az, bx, by, bz, radius, out) {
    const t = Math.random();
    out.x = ax + (bx - ax) * t + rand(-radius, radius);
    out.y = ay + (by - ay) * t + rand(-radius, radius);
    out.z = az + (bz - az) * t + rand(-radius, radius);
}

// Formation C — a floating tailored figure; the jacket region glows.
function buildFigure() {
    posC = new Float32Array(COUNT * 3);
    colC = new Float32Array(COUNT * 3);
    jacket = new Uint8Array(COUNT);

    // Cumulative distribution of body parts.
    const parts = [
        { name: "head", frac: 0.08, jacket: 0 },
        { name: "torso", frac: 0.34, jacket: 1 },
        { name: "arms", frac: 0.18, jacket: 1 },
        { name: "legs", frac: 0.28, jacket: 0 },
        { name: "halo", frac: 0.12, jacket: 1 }, // floating motes around the jacket
    ];

    const v = new THREE.Vector3();
    let idx = 0;
    for (const part of parts) {
        const n = Math.round(part.frac * COUNT);
        for (let k = 0; k < n && idx < COUNT; k++, idx++) {
            switch (part.name) {
                case "head": {
                    const a = rand(0, Math.PI * 2);
                    const b = Math.acos(rand(-1, 1));
                    const r = 0.33 * Math.cbrt(Math.random());
                    v.set(
                        Math.sin(b) * Math.cos(a) * r,
                        1.78 + Math.cos(b) * r,
                        Math.sin(b) * Math.sin(a) * r,
                    );
                    break;
                }
                case "torso": {
                    // tapered jacket body: wider shoulders, nipped waist
                    const ty = rand(0.45, 1.5);
                    const taper = 0.5 + (ty - 0.45) / (1.5 - 0.45) * 0.18;
                    v.set(rand(-taper, taper), ty, rand(-0.28, 0.28));
                    break;
                }
                case "arms": {
                    const side = Math.random() < 0.5 ? -1 : 1;
                    pointOnSegment(
                        side * 0.58, 1.42, 0,
                        side * 0.82, 0.45, 0.05,
                        0.12, v,
                    );
                    break;
                }
                case "legs": {
                    const side = Math.random() < 0.5 ? -1 : 1;
                    pointOnSegment(
                        side * 0.2, 0.42, 0,
                        side * 0.26, -2.25, 0,
                        0.14, v,
                    );
                    break;
                }
                default: { // halo motes drifting around the jacket
                    const a = rand(0, Math.PI * 2);
                    const r = rand(0.9, 1.7);
                    v.set(Math.cos(a) * r, rand(0.6, 1.6), Math.sin(a) * r - 0.1);
                }
            }

            posC[idx * 3] = v.x;
            posC[idx * 3 + 1] = v.y;
            posC[idx * 3 + 2] = v.z;
            jacket[idx] = part.jacket;

            if (part.jacket) {
                // Gradient by height across the figure → the couture jacket.
                const t = THREE.MathUtils.clamp((v.y + 2.3) / 4.3, 0, 1);
                gradientColor(t, tmp);
                if (part.name === "halo") tmp.multiplyScalar(0.6);
            } else {
                tmp.copy(C_DIM).multiplyScalar(rand(0.35, 0.6)); // quiet body
            }
            colC[idx * 3] = tmp.r;
            colC[idx * 3 + 1] = tmp.g;
            colC[idx * 3 + 2] = tmp.b;
        }
    }
    // Fill any rounding remainder by repeating the last point.
    for (; idx < COUNT; idx++) {
        posC[idx * 3] = posC[(idx - 1) * 3];
        posC[idx * 3 + 1] = posC[(idx - 1) * 3 + 1];
        posC[idx * 3 + 2] = posC[(idx - 1) * 3 + 2];
        colC[idx * 3] = colC[(idx - 1) * 3];
        colC[idx * 3 + 1] = colC[(idx - 1) * 3 + 1];
        colC[idx * 3 + 2] = colC[(idx - 1) * 3 + 2];
        jacket[idx] = jacket[idx - 1];
    }
}

// Soft round sprite so particles read as glowing motes, not hard squares.
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

// Large additive halo behind the jacket — the pulsing gradient glow (Act III).
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
    const mat = new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(6, 6, 1);
    sprite.position.set(0, 0.9, -0.5);
    return sprite;
}

/* ---------- per-frame morph ---------- */

function smoothstep(x) {
    x = THREE.MathUtils.clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
}

function updateMorph(time) {
    const p = easedProgress;
    let from, to, fromC, toC, local;
    if (p < 0.5) {
        from = posA; to = posB; fromC = colA; toC = colB;
        local = smoothstep(p / 0.5);
    } else {
        from = posB; to = posC; fromC = colB; toC = colC;
        local = smoothstep((p - 0.5) / 0.5);
    }

    const toFigure = p >= 0.5;
    const pulse = 1 + Math.sin(time * 2.2) * 0.18;
    const pos = posAttr.array;
    const col = colAttr.array;

    for (let i = 0; i < COUNT; i++) {
        const j = i * 3;
        pos[j] = from[j] + (to[j] - from[j]) * local;
        pos[j + 1] = from[j + 1] + (to[j + 1] - from[j + 1]) * local;
        pos[j + 2] = from[j + 2] + (to[j + 2] - from[j + 2]) * local;

        let r = fromC[j] + (toC[j] - fromC[j]) * local;
        let g = fromC[j + 1] + (toC[j + 1] - fromC[j + 1]) * local;
        let b = fromC[j + 2] + (toC[j + 2] - fromC[j + 2]) * local;

        // Jacket particles pulse as the figure resolves (Act III glow).
        if (toFigure && jacket[i]) {
            const amt = 1 + (pulse - 1) * local;
            r *= amt; g *= amt; b *= amt;
        }
        col[j] = r; col[j + 1] = g; col[j + 2] = b;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    // Halo fades/pulses in only for the back half (figure).
    const haloAmt = smoothstep((p - 0.6) / 0.4);
    halo.material.opacity = haloAmt * (0.6 + Math.sin(time * 2.2) * 0.18);

    // Gentle life: slow sway + a touch of progress-driven rotation.
    group.rotation.y = Math.sin(time * 0.12) * 0.16 + p * 0.25;

    // Subtle camera dolly: pull in as the vision resolves.
    camera.position.z = 7.6 - p * 1.7;
    camera.lookAt(0, -0.1 + p * 0.2, 0);
}

/* ---------- scroll + acts ---------- */

function setAct(idx) {
    acts.forEach((el, i) => el.classList.toggle("is-active", i === idx));
    if (actNumEl) actNumEl.textContent = String(idx + 1).padStart(2, "0");
}

function readProgress() {
    const rect = track.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return;
    const p = THREE.MathUtils.clamp(-rect.top / scrollable, 0, 1);
    targetProgress = p;

    // Act thresholds tuned so the copy lands with its matching visual.
    const idx = p < 0.38 ? 0 : p < 0.70 ? 1 : 2;
    if (idx !== currentAct) {
        currentAct = idx;
        setAct(idx);
    }
}

/* ---------- cleanup ---------- */

function cleanup() {
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
    }
    if (scrollListener) {
        window.removeEventListener("scroll", scrollListener, { passive: true });
        scrollListener = null;
    }
    if (resizeListener) {
        window.removeEventListener("resize", resizeListener, { passive: true });
        resizeListener = null;
    }
    if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
    }
}

/* ---------- render loop ---------- */

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

    // Respect reduced-motion: skip WebGL entirely; CSS shows static acts.
    if (window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    track = section.querySelector("[data-story]");
    acts = Array.from(section.querySelectorAll(".story-act"));
    actNumEl = section.querySelector("[data-act-num]");
    if (!track || acts.length < 2) return;

    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
        });
    } catch (err) {
        // No WebGL → fall back to the static, fully-readable layout.
        section.classList.add("no-webgl");
        console.warn("[story-scene] WebGL unavailable:", err && err.message);
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.075);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 7.6);

    buildWaste();
    buildThreads();
    buildFigure();

    const geo = new THREE.BufferGeometry();
    posAttr = new THREE.BufferAttribute(new Float32Array(posA), 3);
    colAttr = new THREE.BufferAttribute(new Float32Array(colA), 3);
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

    // Pause the loop's heavy work when the section is off-screen.
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

// Defensive: stop the loop and remove event listeners if the page is being torn down.
window.addEventListener("pagehide", cleanup);
