/**
 * UR Create — Das Atelier (eigenständige immersive Design-Reise).
 *
 * Ein echtes WebGL-Kleidungsstück (three.js), das der Nutzer Kapitel für
 * Kapitel formt: Silhouette → Stoff → Farbe → Muster → Passform → Finale.
 * Markentreu (Ocean Depths · Lora+Poppins), cineastisch, zweisprachig über
 * das I18N der Haupt-App, datengetrieben über CONFIG.
 *
 * Architektur-Hinweis: einziger ES-Modul-Bereich neben gallery/ und
 * community-sphere.js — three.js + GSAP via Import-Map. Lädt sonst NICHTS
 * aus der Haupt-App außer den klassischen Globals window.CONFIG / window.I18N.
 */
import * as THREE from "three";
import { gsap } from "gsap";

const CONFIG = window.CONFIG;
const I18N = window.I18N;
const T = (key, fallback) => (I18N ? I18N.t(key) : (fallback ?? key));

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Auswahl-Zustand (Defaults) ──────────────────────────────── */

const COLORS = Object.values(CONFIG.COLORS);
const sel = {
  type: CONFIG.GARMENT_TYPES[0],
  material: Object.keys(CONFIG.MATERIALS)[0],
  color: CONFIG.COLORS.white,   // hell auf Midnight-Navy — liest sofort als Couture
  pattern: CONFIG.PATTERNS[0],
  fit: "M",
};

/* ── Kleidungs-Silhouetten (64×64-Raster, wie die Hero-Icons) ─── */
// Nur die geschlossene Hauptkontur je Typ — Details kommen über Stoff/Muster.
const OUTLINES = {
  tshirt: [[16, 16], [24, 8], [40, 8], [48, 16], [56, 22], [48, 30], [48, 56], [16, 56], [16, 30], [8, 22]],
  hoodie: [[20, 14], [32, 6], [44, 14], [52, 22], [58, 28], [50, 34], [50, 58], [14, 58], [14, 34], [6, 28], [12, 22]],
  pants: [[16, 8], [48, 8], [46, 32], [44, 58], [34, 58], [32, 34], [30, 58], [20, 58], [18, 32]],
  jacket: [[16, 14], [24, 8], [40, 8], [48, 14], [56, 22], [50, 28], [50, 58], [14, 58], [14, 28], [8, 22]],
  dress: [[22, 12], [28, 8], [36, 8], [42, 12], [40, 24], [52, 58], [12, 58], [24, 24]],
  shirt: [[18, 14], [28, 8], [36, 8], [46, 14], [54, 22], [48, 28], [48, 56], [16, 56], [16, 28], [10, 22]],
};

const WORLD = 3.0;              // Zielbreite/-höhe des 64er-Rasters in Weltunits
const F = WORLD / 64;

/* ── Three-Setup ─────────────────────────────────────────────── */

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0.1, 6.4);
camera.lookAt(0, 0, 0);

const group = new THREE.Group();      // Rotation (Auto-Spin + Drag)
scene.add(group);

// Licht: weiches Studio mit Ocean-Depths-Akzenten.
scene.add(new THREE.HemisphereLight(0x2a3f55, 0x050c14, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(-2.6, 3.2, 4.0);
scene.add(key);
const rim = new THREE.DirectionalLight(0x64d6c4, 0.85);   // Aqua-Saum hinten
rim.position.set(3.0, 1.4, -3.2);
scene.add(rim);
const fill = new THREE.DirectionalLight(0x2779a8, 0.4);   // kühler Fill
fill.position.set(2.2, -2.4, 2.0);
scene.add(fill);

let maxAniso = renderer.capabilities.getMaxAnisotropy();

/* ── Stoff-/Muster-Textur (CanvasTexture) ────────────────────── */

const TEX = 512;
const texCanvas = document.createElement("canvas");
texCanvas.width = texCanvas.height = TEX;
const tctx = texCanvas.getContext("2d");
const texture = new THREE.CanvasTexture(texCanvas);
texture.colorSpace = THREE.SRGBColorSpace;
texture.anisotropy = maxAniso;
texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function luminance(hex) {
  const c = hexToRgb(hex);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}
function mix(hex, target, amt) {
  const c = hexToRgb(hex);
  const r = Math.round(c.r + (target - c.r) * amt);
  const g = Math.round(c.g + (target - c.g) * amt);
  const b = Math.round(c.b + (target - c.b) * amt);
  return `rgb(${r},${g},${b})`;
}
// Kontrastton fürs Muster: helle Stoffe dunkler bedrucken, dunkle heller.
function markTone(hex, amt = 0.26) {
  return luminance(hex) > 0.55 ? mix(hex, 0, amt) : mix(hex, 255, amt + 0.06);
}

function drawPattern(ctx, S, hex, pattern) {
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, S, S);
  const mk = markTone(hex);
  const mk2 = luminance(hex) > 0.55 ? mix(hex, 0, 0.14) : mix(hex, 255, 0.18);
  ctx.save();
  switch (pattern) {
    case "stripes_h":
      ctx.fillStyle = mk;
      for (let y = 0; y < S; y += S / 8) ctx.fillRect(0, y, S, S / 16);
      break;
    case "stripes_v":
      ctx.fillStyle = mk;
      for (let x = 0; x < S; x += S / 8) ctx.fillRect(x, 0, S / 16, S);
      break;
    case "dots":
      ctx.fillStyle = mk;
      for (let y = S / 12; y < S; y += S / 6)
        for (let x = S / 12; x < S; x += S / 6) {
          ctx.beginPath(); ctx.arc(x, y, S / 28, 0, Math.PI * 2); ctx.fill();
        }
      break;
    case "plaid":
      ctx.globalAlpha = 0.5; ctx.fillStyle = mk;
      for (let y = 0; y < S; y += S / 6) ctx.fillRect(0, y, S, S / 22);
      for (let x = 0; x < S; x += S / 6) ctx.fillRect(x, 0, S / 22, S);
      ctx.globalAlpha = 1;
      break;
    case "camo": {
      const tones = [mk, mk2, mix(hex, luminance(hex) > 0.5 ? 0 : 255, 0.4)];
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = tones[i % tones.length];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(Math.random() * S, Math.random() * S, 30 + Math.random() * 50, 24 + Math.random() * 40, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "gradient": {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, mix(hex, 255, 0.18));
      g.addColorStop(1, mix(hex, 0, 0.28));
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      break;
    }
    case "heather":
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? mk : mk2;
        ctx.globalAlpha = 0.25 + Math.random() * 0.3;
        ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
      }
      ctx.globalAlpha = 1;
      break;
    case "floral":
      ctx.fillStyle = mk;
      for (let y = S / 8; y < S; y += S / 4)
        for (let x = S / 8; x < S; x += S / 4) {
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 7, 12, a, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = mk2;
          ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = mk;
        }
      break;
    default: /* solid: nur die Grundfarbe */ break;
  }
  ctx.restore();
}

function refreshTexture() {
  drawPattern(tctx, TEX, sel.color, sel.pattern);
  texture.needsUpdate = true;
}

/* ── Material je Stoff ───────────────────────────────────────── */

const FABRIC = {
  cotton: { roughness: 0.92, clearcoat: 0.0, sheen: 0.0 },
  linen: { roughness: 0.96, clearcoat: 0.0, sheen: 0.1 },
  denim: { roughness: 0.86, clearcoat: 0.05, sheen: 0.0 },
  wool: { roughness: 0.98, clearcoat: 0.0, sheen: 0.4 },
  fleece: { roughness: 1.0, clearcoat: 0.0, sheen: 0.5 },
  silk: { roughness: 0.26, clearcoat: 0.45, sheen: 0.7 },
  polyester: { roughness: 0.55, clearcoat: 0.25, sheen: 0.15 },
};

const material = new THREE.MeshPhysicalMaterial({
  map: texture,
  color: 0xffffff,
  roughness: 0.92,
  metalness: 0.0,
  clearcoat: 0.0,
  clearcoatRoughness: 0.5,
  sheen: 0.0,
  sheenColor: new THREE.Color(0xffffff),
  emissive: new THREE.Color(0x64d6c4),
  emissiveIntensity: 0.0,
  side: THREE.DoubleSide,
});

function applyFabric(animate = true) {
  const f = FABRIC[sel.material] || FABRIC.cotton;
  if (reduceMotion || !animate) {
    material.roughness = f.roughness; material.clearcoat = f.clearcoat; material.sheen = f.sheen;
  } else {
    gsap.to(material, { roughness: f.roughness, clearcoat: f.clearcoat, sheen: f.sheen, duration: 0.5, ease: "power2.out" });
  }
}

// Kurzes Akzent-Schimmern bei Farb-/Muster-/Stoffwechsel.
function shimmer() {
  if (reduceMotion) return;
  gsap.fromTo(material, { emissiveIntensity: 0.16 }, { emissiveIntensity: 0, duration: 0.55, ease: "power2.out" });
}

/* ── Geometrie: Silhouette → aufgepolsterte 3D-Form ──────────── */

function outlineToShape(pts) {
  const v = pts.map(([x, y]) => new THREE.Vector3((x - 32) * F, (32 - y) * F, 0));
  const curve = new THREE.CatmullRomCurve3(v, true, "catmullrom", 0.5);
  const smooth = curve.getPoints(128);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const shape = new THREE.Shape();
  smooth.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x, p.y); else shape.lineTo(p.x, p.y);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  shape.closePath();
  return { shape, bb: { minX, maxX, minY, maxY } };
}

function makeUVGen(bb) {
  const dx = bb.maxX - bb.minX || 1, dy = bb.maxY - bb.minY || 1;
  const u = (x) => (x - bb.minX) / dx, w = (y) => (y - bb.minY) / dy;
  const V = (verts, i) => new THREE.Vector2(u(verts[i * 3]), w(verts[i * 3 + 1]));
  return {
    generateTopUV: (g, verts, a, b, c) => [V(verts, a), V(verts, b), V(verts, c)],
    generateSideWallUV: (g, verts, a, b, c, d) => [V(verts, a), V(verts, b), V(verts, c), V(verts, d)],
  };
}

function buildGeometry(type) {
  const { shape, bb } = outlineToShape(OUTLINES[type]);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.18,
    bevelSize: 0.1,
    bevelSegments: 5,
    steps: 1,
    curveSegments: 12,
    UVGenerator: makeUVGen(bb),
  });
  geo.center();
  return geo;
}

const mesh = new THREE.Mesh(buildGeometry(sel.type), material);
group.add(mesh);

const FIT_SCALE = { S: 0.92, M: 1.0, L: 1.08, XL: 1.16 };
function fitVec() { const s = FIT_SCALE[sel.fit] || 1; return { x: s, y: 1 + (s - 1) * 0.4, z: 1 }; }
mesh.scale.copy(new THREE.Vector3(fitVec().x, fitVec().y, 1));

function applyFit() {
  const v = fitVec();
  if (reduceMotion) mesh.scale.set(v.x, v.y, 1);
  else gsap.to(mesh.scale, { x: v.x, y: v.y, z: 1, duration: 0.5, ease: "power3.out" });
}

function setType(v) {
  sel.type = v;
  const v2 = fitVec();
  if (reduceMotion) {
    mesh.geometry.dispose();
    mesh.geometry = buildGeometry(v);
    mesh.scale.set(v2.x, v2.y, 1);
    return;
  }
  gsap.timeline()
    .to(mesh.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3, ease: "power2.in" })
    .add(() => { mesh.geometry.dispose(); mesh.geometry = buildGeometry(v); shimmer(); })
    .to(group.rotation, { y: group.rotation.y + Math.PI * 0.7, duration: 0.62, ease: "power2.out" }, "<")
    .to(mesh.scale, { x: v2.x, y: v2.y, z: 1, duration: 0.55, ease: "back.out(1.4)" }, ">-0.02")
    .add(() => { targetY = group.rotation.y; });
}

refreshTexture();
applyFabric(false);

/* ── Interaktion: Drag-Rotation + sanftes Auto-Spin ──────────── */

let rotX = 0.06, rotY = -0.55, targetX = rotX, targetY = rotY;
let dragging = false, lastX = 0, lastY = 0;
let spinning = false;
const dragHint = document.getElementById("drag-hint");
let hintFaded = false;

function fadeHint() { if (!hintFaded) { hintFaded = true; dragHint && dragHint.classList.add("is-faded"); } }

canvas.addEventListener("pointerdown", (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  fadeHint();
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  targetY += (e.clientX - lastX) * 0.008;
  targetX = Math.max(-0.5, Math.min(0.5, targetX + (e.clientY - lastY) * 0.006));
  lastX = e.clientX; lastY = e.clientY;
});
function endDrag() { dragging = false; }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

window.addEventListener("keydown", (e) => {
  if (!spinning) return;
  if (e.key === "ArrowLeft") { targetY -= 0.25; fadeHint(); }
  else if (e.key === "ArrowRight") { targetY += 0.25; fadeHint(); }
  else if (e.key === "ArrowUp") { targetX = Math.max(-0.5, targetX - 0.15); }
  else if (e.key === "ArrowDown") { targetX = Math.min(0.5, targetX + 0.15); }
});

/* ── Render-Loop ─────────────────────────────────────────────── */

let running = true;
function frame() {
  if (!running) return;
  if (spinning && !dragging && !reduceMotion) targetY += 0.0016;
  rotX += (targetX - rotX) * 0.08;
  rotY += (targetY - rotY) * 0.08;
  group.rotation.set(rotX, rotY, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  document.documentElement.style.setProperty("--svh", h / 100 + "px");
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Auf schmalen Viewports etwas zurückfahren, damit das Stück ganz passt.
  camera.position.z = w < 720 ? 7.2 : 5.8;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize, { passive: true });
resize();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { running = false; }
  else if (!running) { running = true; requestAnimationFrame(frame); }
});

requestAnimationFrame(frame);

/* ── Die Reise (Journey-Controller) ──────────────────────────── */

const CHAPTERS = [
  { id: "type", list: CONFIG.GARMENT_TYPES, get: () => sel.type,
    set: (v) => setType(v), label: "create.ch_type_label", title: "create.ch_type_title", hint: "create.ch_type_hint",
    chip: (v) => ({ text: I18N.typeLabel(v) }) },
  { id: "material", list: Object.keys(CONFIG.MATERIALS), get: () => sel.material,
    set: (v) => { sel.material = v; applyFabric(); shimmer(); }, label: "create.ch_material_label", title: "create.ch_material_title", hint: "create.ch_material_hint",
    chip: (v) => ({ text: I18N.material(v) }) },
  { id: "color", list: COLORS, get: () => sel.color,
    set: (v) => { sel.color = v; refreshTexture(); shimmer(); }, label: "create.ch_color_label", title: "create.ch_color_title", hint: "create.ch_color_hint",
    chip: (v) => ({ text: I18N.colorName(v), swatch: v }) },
  { id: "pattern", list: CONFIG.PATTERNS, get: () => sel.pattern,
    set: (v) => { sel.pattern = v; refreshTexture(); shimmer(); }, label: "create.ch_pattern_label", title: "create.ch_pattern_title", hint: "create.ch_pattern_hint",
    chip: (v) => ({ text: I18N.pattern(v), swatchTex: v }) },
  { id: "fit", list: Object.keys(CONFIG.MEASUREMENT_PRESETS), get: () => sel.fit,
    set: (v) => { sel.fit = v; applyFit(); }, label: "create.ch_fit_label", title: "create.ch_fit_title", hint: "create.ch_fit_hint",
    chip: (v) => ({ text: `${v} · ${CONFIG.MEASUREMENT_PRESETS[v].height} cm` }) },
];

let idx = 0, maxReached = 0;

const el = {
  veil: document.getElementById("veil"),
  threshold: document.getElementById("threshold"),
  journey: document.getElementById("journey"),
  finale: document.getElementById("finale"),
  label: document.getElementById("chapter-label"),
  title: document.getElementById("chapter-title"),
  hint: document.getElementById("chapter-hint"),
  options: document.getElementById("options"),
  rail: document.getElementById("rail"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  ccNow: document.getElementById("cc-now"),
  ccTotal: document.getElementById("cc-total"),
  count: document.getElementById("chapter-count"),
  spec: document.getElementById("finale-spec"),
  serial: document.getElementById("finale-serial"),
};

// Kleine Muster-/Farb-Vorschau für die Chips.
function swatchDataURL(pattern) {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  drawPattern(c.getContext("2d"), 32, "#4a6275", pattern);
  return c.toDataURL();
}

function buildRail() {
  el.rail.innerHTML = "";
  CHAPTERS.forEach((_, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rail-dot";
    b.setAttribute("aria-label", `${i + 1}`);
    b.addEventListener("click", () => goTo(i));
    li.appendChild(b);
    el.rail.appendChild(li);
  });
}

function renderChapter() {
  const ch = CHAPTERS[idx];
  el.label.textContent = T(ch.label);
  el.title.textContent = T(ch.title);
  el.hint.textContent = T(ch.hint);
  el.ccNow.textContent = String(idx + 1).padStart(2, "0");

  el.options.innerHTML = "";
  ch.list.forEach((v) => {
    const meta = ch.chip(v);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opt" + (ch.get() === v ? " is-active" : "");
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", ch.get() === v ? "true" : "false");
    if (meta.swatch) {
      const s = document.createElement("span");
      s.className = "opt-sw"; s.style.background = meta.swatch;
      b.appendChild(s);
    } else if (meta.swatchTex) {
      const s = document.createElement("span");
      s.className = "opt-sw"; s.style.backgroundImage = `url(${swatchDataURL(meta.swatchTex)})`;
      b.appendChild(s);
    }
    const t = document.createElement("span");
    t.textContent = meta.text;
    b.appendChild(t);
    b.addEventListener("click", () => {
      ch.set(v);
      el.options.querySelectorAll(".opt").forEach((o) => {
        const on = o === b;
        o.classList.toggle("is-active", on);
        o.setAttribute("aria-selected", on ? "true" : "false");
      });
    });
    el.options.appendChild(b);
  });

  // Rail-Zustand
  el.rail.querySelectorAll(".rail-dot").forEach((d, i) => {
    d.classList.toggle("is-active", i === idx);
    d.classList.toggle("is-done", i <= maxReached);
  });
  el.prev.disabled = idx === 0;
  el.next.textContent = idx === CHAPTERS.length - 1 ? T("create.reveal") : T("create.next");

  // Sanfter Einblendwechsel der Frage.
  if (!reduceMotion) {
    gsap.fromTo(el.label.parentElement,
      { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" });
  }
}

function goTo(i) {
  idx = Math.max(0, Math.min(CHAPTERS.length - 1, i));
  maxReached = Math.max(maxReached, idx);
  renderChapter();
}

el.prev.addEventListener("click", () => { if (idx > 0) goTo(idx - 1); });
el.next.addEventListener("click", () => {
  if (idx < CHAPTERS.length - 1) goTo(idx + 1);
  else showFinale();
});

/* ── Schwelle → Reise → Finale ───────────────────────────────── */

function startJourney() {
  el.threshold.classList.add("is-gone");
  el.journey.hidden = false;
  el.finale.hidden = true;
  el.count.classList.add("is-on");
  spinning = true;
  setTimeout(() => dragHint && dragHint.classList.add("is-on"), 400);
  idx = 0; maxReached = 0;
  renderChapter();
}

function showFinale() {
  el.journey.hidden = true;
  el.finale.hidden = false;
  el.count.classList.remove("is-on");
  // Spec aufbauen
  const rows = [
    ["create.spec_type", I18N.typeLabel(sel.type)],
    ["create.spec_material", I18N.material(sel.material)],
    ["create.spec_color", I18N.colorName(sel.color)],
    ["create.spec_pattern", I18N.pattern(sel.pattern)],
    ["create.spec_fit", `${sel.fit} · ${CONFIG.MEASUREMENT_PRESETS[sel.fit].height} cm`],
  ];
  el.spec.innerHTML = "";
  rows.forEach(([k, val]) => {
    const dt = document.createElement("dt"); dt.textContent = T(k);
    const dd = document.createElement("dd"); dd.textContent = val;
    el.spec.appendChild(dt); el.spec.appendChild(dd);
  });
  const n = String(Math.floor(Math.random() * 9000) + 1000);
  el.serial.textContent = `N° ${n}`;
  // Kamera-Hauch zurück, Stück ruhig drehen lassen.
  if (!reduceMotion) gsap.fromTo(el.finale, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power2.out" });
}

document.getElementById("begin").addEventListener("click", startJourney);
document.getElementById("restart").addEventListener("click", () => {
  Object.assign(sel, { type: CONFIG.GARMENT_TYPES[0], material: Object.keys(CONFIG.MATERIALS)[0], color: COLORS[0], pattern: CONFIG.PATTERNS[0], fit: "M" });
  setType(sel.type); applyFabric(false); refreshTexture(); applyFit();
  startJourney();
});

/* ── i18n: Sprache + Re-Render ───────────────────────────────── */

function syncLang() {
  const lang = I18N ? I18N.getLang() : "de";
  document.querySelectorAll(".lang-opt").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.lang === lang);
  });
  el.ccTotal.textContent = String(CHAPTERS.length).padStart(2, "0");
}
document.querySelectorAll(".lang-opt").forEach((b) => {
  b.addEventListener("click", () => I18N && I18N.setLang(b.dataset.lang));
});
window.addEventListener("language:change", () => {
  syncLang();
  if (!el.journey.hidden) renderChapter();
  if (!el.finale.hidden) showFinale();
});

/* ── Start ───────────────────────────────────────────────────── */

buildRail();
syncLang();
// Schleier heben, sobald der erste Frame steht.
requestAnimationFrame(() => {
  setTimeout(() => el.veil.classList.add("is-gone"), 250);
});
