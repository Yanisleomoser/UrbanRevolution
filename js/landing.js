/**
 * Urban Revolution — Landing-Experience-Controller (index.html)
 *
 * Steuert die Marken-Landing oberhalb des UR-Create-Studios:
 * Preloader-Logo-Draw, Hero-Intro + Faden-Partikelfeld, Manifest-Wort-Scrub,
 * gepinnte Kreislauf-Sektion, Zahlen-Count-up, magnetischer Kreis-CTA —
 * und den STUDIO-REVEAL: das Studio (#studio) ist verborgen, bis ein CTA
 * (Anker auf #design/#measure/#production/#faq) oder ein Share-/Deep-Link es öffnet.
 *
 * Progressive Enhancement in drei Stufen:
 *   1. Ohne JS / ohne GSAP: alles sichtbar und benutzbar (reines CSS).
 *   2. Mit GSAP, aber prefers-reduced-motion: keine Bewegung, Inhalte sofort.
 *   3. html.fx (GSAP + Bewegung erlaubt): volle Animationen.
 *
 * Kein Modul-Export nötig — reiner Seiten-Controller (wie app.js Side-Effects).
 */
(() => {
  "use strict";

  // Which URL fragments open the studio: a studio anchor, or a share/deep link
  // carrying an encoded design (#dna=…). Pure + DOM-free, hoisted above any
  // window access so it can be unit-tested headless (the rest is GSAP/canvas).
  const STUDIO_ANCHORS = ["design", "ownership", "measure", "production", "faq"];
  function shouldRevealForHash(hash) {
    const h = String(hash || "");
    return /[#&]dna=/.test(h) || STUDIO_ANCHORS.includes(h.replace(/^#/, ""));
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { shouldRevealForHash, STUDIO_ANCHORS };
  if (typeof window === "undefined") return; // non-DOM (tests/SSR): nothing to mount

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const fx = hasGsap && !reduceMotion;
  if (fx) {
    document.documentElement.classList.add("fx"); // already set in <head>; idempotent
    window.gsap.registerPlugin(window.ScrollTrigger);
    // The mobile URL bar sliding in/out fires a viewport resize; by default
    // ScrollTrigger re-measures on it and the pinned loop section visibly jumps
    // on every toolbar toggle. --svh is already frozen against height-only
    // resizes (see <head>), so tell ScrollTrigger to ignore them too.
    window.ScrollTrigger.config({ ignoreMobileResize: true });
  } else {
    // GSAP missing or reduced motion: undo the <head>'s optimistic html.fx so
    // the CSS-gated loader (html:not(.fx) .lp-loader { display:none }) reveals
    // the page instead of staying covered.
    document.documentElement.classList.remove("fx");
  }
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  /* ── Studio-Reveal ───────────────────────────────────────── */

  // STUDIO_ANCHORS + shouldRevealForHash are declared at the top (pure, hoisted
  // for testability). Anchors lead into the studio; Maße/Produktion live in
  // #make-real, which ur-create.js opens — here we only reveal the wrapper.
  function revealStudio() {
    const studio = document.getElementById("studio");
    if (!studio || !studio.hidden) return;
    studio.hidden = false;
    // Hydrate the deferred measurement figure: this SVG <image> ignores
    // loading="lazy" and would download 245 KB on first paint though it lives in
    // the hidden studio. Load it now (studio open) — off the landing critical
    // path, ready before the measurement step. The src is a hardcoded literal
    // (not read from the DOM) so there is no text-to-href flow.
    const figure = document.getElementById("measure-figure-img");
    if (figure && !figure.getAttribute("href")) {
      figure.setAttribute("href", "assets/measure-figure.jpg");
    }
    // Engine & Co. haben im display:none-Zustand mit 0-Maßen initialisiert —
    // einmal nachmessen lassen, dann die Scroll-Trigger neu rechnen.
    window.dispatchEvent(new Event("resize"));
    if (fx) ScrollTrigger.refresh();
    // A11y (WCAG 2.4.3): a keyboard user activating a studio CTA (an
    // <a href="#design"> etc.) triggers native fragment-focus while #studio is
    // still display:none, so focus falls to <body>. Move focus into the section
    // the user asked for, now that it's visible, so Tab continues logically and
    // SR users hear the revealed region. Pick the requested anchor when it's the
    // visible one; otherwise fall back to the studio's first section (#design).
    // Guard the selector: the hash may be empty or a share link (#dna=…), which
    // are not valid id selectors.
    const h = location.hash;
    let target = /^#[\w-]+$/.test(h) ? document.getElementById(h.slice(1)) : null;
    if (!target || target.offsetParent === null) target = document.getElementById("design");
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: false });
    }
  }

  function initStudioReveal() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      if (STUDIO_ANCHORS.includes((a.getAttribute("href") || "").slice(1))) revealStudio();
    });
    // Share-Links (#dna=…) und Studio-Anker öffnen das Studio direkt.
    const check = () => { if (shouldRevealForHash(location.hash)) revealStudio(); };
    window.addEventListener("hashchange", check);
    check();
  }

  /* ── Preloader + Hero-Intro ──────────────────────────────── */

  function heroIntro() {
    if (!fx) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".lp-hero-line", { yPercent: 115, duration: 1.0, stagger: 0.12 }, 0)
      .from(".lp-hero-eyebrow", { opacity: 0, y: 14, duration: 0.7 }, 0.25)
      .from(".lp-hero-sub", { opacity: 0, y: 18, duration: 0.7 }, 0.55)
      .from(".lp-hero-ctas", { opacity: 0, y: 18, duration: 0.7 }, 0.7)
      .from(".lp-scroll-cue", { opacity: 0, duration: 0.8 }, 1.0);
  }

  function initLoader() {
    const loader = document.getElementById("loader");
    if (!loader) return;
    if (!fx) { heroIntro(); return; } // Loader ist per CSS bereits unsichtbar

    let seen = false;
    try { seen = sessionStorage.getItem("urev_landing_seen") === "1"; } catch { /* egal */ }

    const done = () => {
      loader.classList.add("is-done");
      heroIntro();
    };

    if (seen) { done(); return; }
    try { sessionStorage.setItem("urev_landing_seen", "1"); } catch { /* egal */ }

    const arc = loader.querySelector(".lp-mark-arc");
    const dashes = loader.querySelector(".lp-mark-dashes");
    const needle = loader.querySelector(".lp-mark-needle");
    const len = arc.getTotalLength();
    gsap.set(arc, { strokeDasharray: len, strokeDashoffset: len });
    gsap.timeline({ onComplete: done })
      .to(arc, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" }, 0)
      .from(needle, { opacity: 0, y: -14, duration: 0.5, ease: "power2.out" }, 0.25)
      .from(dashes, { opacity: 0, duration: 0.4 }, 0.55)
      .to(loader.querySelector(".lp-mark"), { scale: 0.92, opacity: 0, duration: 0.35, ease: "power2.in" }, 1.15);
    // Sicherheitsnetz: Loader darf die Seite nie dauerhaft blockieren.
    setTimeout(() => { if (!loader.classList.contains("is-done")) done(); }, 3000);
  }

  /* ── Manifest: Wort-für-Wort-Scrub ───────────────────────── */

  let manifestoTween = null;

  function buildManifesto() {
    const el = document.getElementById("manifesto-text");
    if (!el) return;
    // Nach jedem I18N.apply() steht hier wieder reiner Text — neu zerlegen.
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach((w, i) => {
      if (i) el.appendChild(document.createTextNode(" "));
      const span = document.createElement("span");
      span.className = "w";
      span.textContent = w;
      el.appendChild(span);
    });
    if (!fx) return;
    if (manifestoTween) {
      if (manifestoTween.scrollTrigger) manifestoTween.scrollTrigger.kill();
      manifestoTween.kill();
    }
    manifestoTween = gsap.fromTo(
      el.querySelectorAll(".w"),
      { opacity: 0.13 },
      {
        opacity: 1,
        stagger: 0.04,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top 78%",
          end: "bottom 45%",
          scrub: 0.4,
        },
      },
    );
  }

  /* ── Der Kreislauf: gepinnte Kreis-Reise ─────────────────── */

  function initLoop() {
    if (!fx) return;
    const pin = document.getElementById("loop-pin");
    const progress = document.getElementById("loop-progress");
    const needle = document.getElementById("loop-needle");
    const num = document.getElementById("loop-num");
    const steps = Array.from(document.querySelectorAll(".lp-loop-step"));
    const dots = Array.from(document.querySelectorAll("#loop-dots circle"));
    if (!pin || !progress) return;

    const C = 2 * Math.PI * 130;
    progress.style.strokeDasharray = String(C);
    progress.style.strokeDashoffset = String(C);

    let lastIdx = -1;
    function setProgress(p) {
      progress.style.strokeDashoffset = String(C * (1 - p));
      // Die Nadel dreht einmal um den Kreis — wie der Zeiger einer Uhr.
      needle.setAttribute("transform", `rotate(${16 + p * 360} 160 160)`);
      const idx = Math.min(3, Math.floor(p * 4));
      if (idx !== lastIdx) {
        lastIdx = idx;
        steps.forEach((s, i) => s.classList.toggle("is-active", i === idx));
        dots.forEach((d, i) => d.classList.toggle("is-active", i <= idx));
        if (num) num.textContent = "0" + (idx + 1);
      }
    }
    setProgress(0);

    ScrollTrigger.create({
      trigger: pin,
      start: "top top",
      end: "+=280%",
      pin: true,
      scrub: true,
      onUpdate: (self) => setProgress(self.progress),
    });
  }

  /* ── Sichtbarkeits-Reveals + Zahlen-Count-up ─────────────── */

  function initReveals() {
    if (!fx) return;
    document.querySelectorAll("[data-lp-reveal]").forEach((el) => {
      gsap.from(el, {
        opacity: 0,
        y: 44,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 82%", once: true },
      });
    });
  }

  function initCounters() {
    const nums = document.querySelectorAll(".lp-stat-num[data-count]");
    if (!nums.length) return;
    const run = (el) => {
      const target = parseInt(el.getAttribute("data-count"), 10) || 0;
      if (reduceMotion) { el.textContent = String(target); return; }
      const t0 = performance.now();
      const dur = 1400;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          io.unobserve(e.target);
          run(e.target);
        }
      });
    }, { threshold: 0.6 });
    nums.forEach((el) => io.observe(el));
  }

  /* ── Magnetischer Kreis-CTA ──────────────────────────────── */

  function initOrb() {
    const orb = document.getElementById("cta-orb");
    if (!orb || !fx || !window.matchMedia("(pointer: fine)").matches) return;
    const strength = 0.3;
    orb.addEventListener("pointermove", (e) => {
      const r = orb.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      gsap.to(orb, { x: dx * strength, y: dy * strength, duration: 0.4, ease: "power2.out" });
    });
    orb.addEventListener("pointerleave", () => {
      gsap.to(orb, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.45)" });
    });
  }

  /* ── Hero-Canvas: Faden-Partikelfeld („Weave") ───────────── */

  function initWeave() {
    const canvas = document.getElementById("weave-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const COLORS = ["#2779a8", "#2a9d8f", "#64d6c4"];
    const LINK_DIST = 110;
    let w = 0, h = 0, dpr = 1;
    let particles = [];
    let raf = 0;
    let running = false;
    const pointer = { x: -9999, y: -9999, active: false };

    // ── Kleidungs-Silhouetten (64×64-Raster, wie die Typ-Icons im Studio).
    //    Tap/Klick: die Punkte fliegen auf die Kontur und verbinden sich
    //    der Reihe nach zum Stück; nach kurzem Halten lösen sie sich wieder.
    //    Kontroll-Punkte beschreiben den Charakter (Halsausschnitt, Schulter-
    //    neigung, Ärmel-Taper, A-Linie …); Catmull-Rom verdichtet sie zu weichen
    //    Garment-Kurven — keine kantigen Polygone mehr.
    const GARMENTS = [
      { key: "tshirt", chains: [{ closed: true, pts: [[26, 15], [21, 12], [8, 18], [6, 27], [20, 28], [21, 55], [43, 55], [44, 28], [58, 27], [56, 18], [43, 12], [38, 15], [32, 20]] }] },
      {
        key: "hoodie",
        chains: [
          { closed: true, pts: [[24, 18], [19, 13], [15, 6], [32, 4], [49, 6], [45, 13], [40, 18], [47, 17], [60, 24], [61, 35], [47, 35], [46, 57], [18, 57], [18, 35], [3, 35], [4, 24], [17, 17]] },
          { closed: false, pts: [[24, 18], [32, 13], [40, 18]] },
        ],
      },
      { key: "pants", chains: [{ closed: true, pts: [[21, 9], [43, 9], [45, 30], [44, 57], [36, 57], [32, 42], [28, 57], [20, 57], [19, 30]] }] },
      {
        key: "jacket",
        chains: [
          { closed: true, pts: [[28, 13], [22, 10], [8, 16], [6, 46], [16, 47], [19, 30], [20, 58], [32, 58], [44, 58], [45, 30], [48, 47], [58, 46], [56, 16], [42, 10], [36, 13], [32, 20]] },
          { closed: false, pts: [[32, 20], [32, 58]] },
        ],
      },
      { key: "dress", chains: [{ closed: true, pts: [[27, 13], [23, 10], [20, 15], [18, 26], [23, 33], [11, 57], [14, 59], [50, 59], [53, 57], [41, 33], [46, 26], [44, 15], [41, 10], [37, 13], [32, 18]] }] },
      {
        key: "shirt",
        chains: [
          { closed: true, pts: [[27, 15], [22, 12], [9, 18], [7, 28], [21, 28], [22, 55], [42, 55], [43, 28], [57, 28], [55, 18], [42, 12], [37, 15], [34, 14], [32, 19], [30, 14]] },
          { closed: false, pts: [[32, 19], [32, 55]] },
        ],
        buttons: [[32, 30], [32, 40], [32, 49]],
      },
    ];
    let mode = "drift";          // "drift" | "form"
    let garmentIdx = -1;         // zykliert pro Tap durchs Sortiment
    let formStart = 0;
    let formChains = [];         // [{ parts, cum, len, startDist, grad, closed }, …]
    let formButtons = [];        // [{x,y}] dekorative Knöpfe (Hemd)
    let formLabel = "";
    let formCenter = { x: 0, y: 0, s: 0 };
    let totalDist = 1;           // Gesamtlänge der konkatenierten Naht (Nadel-Bahn)
    const FORM_HOLD = 4200;      // ms bis zur Auflösung
    const CONVERGE = 160;        // ms Anflug/Anticipation, bevor die Nadel startet
    const DRAW_MS = 820;         // ms Nadel-Lauf über die gesamte Kontur
    const FADE_MS = 350;         // ms Ausblenden am Ende
    const POP_DIST = 34;         // px-Fenster, in dem ein Knoten beim Nähen aufleuchtet

    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    // Zentripetales Catmull-Rom (α = 0.5): weiche Kurve durch p1→p2, ohne
    // Überschwingen/Spitzen — macht aus Kontrollpunkten echte Garment-Kanten.
    function catmull(p0, p1, p2, p3, u) {
      const tj = (ti, a, b) => ti + Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-4);
      const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
      const t = t1 + (t2 - t1) * u;
      const A1 = lerp2(p0, p1, (t - t0) / (t1 - t0 || 1e-4));
      const A2 = lerp2(p1, p2, (t - t1) / (t2 - t1 || 1e-4));
      const A3 = lerp2(p2, p3, (t - t2) / (t3 - t2 || 1e-4));
      const B1 = lerp2(A1, A2, (t - t0) / (t2 - t0 || 1e-4));
      const B2 = lerp2(A2, A3, (t - t1) / (t3 - t1 || 1e-4));
      return lerp2(B1, B2, (t - t1) / (t2 - t1 || 1e-4));
    }

    // Kontrollpunkte → dichte, weiche Polylinie (für Kontur + Längenmaß).
    function densify(pts, closed) {
      const m = pts.length;
      if (m < 3) return pts.slice();
      const SUB = 16;
      const out = [];
      const segs = closed ? m : m - 1;
      for (let i = 0; i < segs; i++) {
        const p1 = pts[i % m];
        const p2 = pts[(i + 1) % m];
        const p0 = closed ? pts[(i - 1 + m) % m] : pts[Math.max(0, i - 1)];
        const p3 = closed ? pts[(i + 2) % m] : pts[Math.min(m - 1, i + 2)];
        for (let s = 0; s < SUB; s++) out.push(catmull(p0, p1, p2, p3, s / SUB));
      }
      if (!closed) out.push(pts[m - 1]);
      return out;
    }

    // Konturlänge in 64er-Koordinaten (skaleninvariantes Punktebudget).
    function chainLength(pts, closed) {
      const poly = densify(pts, closed);
      let L = 0;
      for (let i = 0; i < poly.length - 1; i++) L += Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]);
      if (closed && poly.length) L += Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]);
      return L;
    }

    // Polylinie gleichmäßig in n Punkte zerlegen (arc-length, auf der Kurve).
    function resample(pts, closed, n) {
      const dense = densify(pts, closed);
      const P = closed ? dense.concat([dense[0]]) : dense;
      const segs = [];
      let total = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const L = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
        segs.push(L);
        total += L;
      }
      const out = [];
      const stepLen = total / n;
      let seg = 0, acc = 0;
      for (let k = 0; k < n; k++) {
        const target = Math.min(k * stepLen, total - 0.001);
        while (seg < segs.length - 1 && acc + segs[seg] < target) { acc += segs[seg]; seg++; }
        const t = segs[seg] ? (target - acc) / segs[seg] : 0;
        out.push([P[seg][0] + (P[seg + 1][0] - P[seg][0]) * t, P[seg][1] + (P[seg + 1][1] - P[seg][1]) * t]);
      }
      return out;
    }

    // Tatsächliche Text-Bounds (Headline/Sub/CTAs) im Canvas-Raum — via Range,
    // damit nur die SICHTBARE Schrift zählt (nicht der volle Block der <h1>),
    // sonst weicht die Silhouette auf dem Desktop unnötig aus.
    function textRects() {
      const hero = canvas.closest(".lp-hero");
      if (!hero) return [];
      const cr = canvas.getBoundingClientRect();
      const out = [];
      const push = (r) => { if (r && r.width > 1) out.push({ l: r.left - cr.left, t: r.top - cr.top, r: r.right - cr.left, b: r.bottom - cr.top }); };
      hero.querySelectorAll(".lp-hero-eyebrow, .lp-hero-line, .lp-hero-sub, .lp-hero-hint").forEach((el) => {
        try { const rg = document.createRange(); rg.selectNodeContents(el); push(rg.getBoundingClientRect()); }
        catch (_) { push(el.getBoundingClientRect()); }
      });
      const cta = hero.querySelector(".lp-hero-ctas");
      if (cta) push(cta.getBoundingClientRect());
      const cue = hero.querySelector(".lp-scroll-cue");
      if (cue) push(cue.getBoundingClientRect());
      // Fixe Navbar als Hindernis, damit das Stück nicht dahinter verschwindet.
      const nav = document.querySelector(".lp-nav");
      if (nav) push(nav.getBoundingClientRect());
      return out;
    }

    // Platzierung: am Tap, vollständig im Canvas. Die Silhouette (+ Label) wird
    // in die größte freie vertikale Bahn der Tap-Spalte gelegt, die der Text
    // frei lässt — so landet sie NIE auf der Schrift und das Label bleibt sichtbar.
    function placeGarment(tapX, tapY) {
      const LBL = 40, M = 14; // Label-Reserve + Rand
      const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
      let s = Math.max(150, Math.min(0.52 * Math.min(w, h), 360));
      let cx = clamp(tapX, s / 2 + 20, w - s / 2 - 20);

      // Hindernisse in der Tap-Spalte → freie vertikale Intervalle bestimmen.
      const obst = textRects()
        .filter((r) => r.r > cx - s / 2 - 8 && r.l < cx + s / 2 + 8)
        .map((r) => [Math.max(M, r.t - 10), Math.min(h - M, r.b + 10)])
        .sort((a, b) => a[0] - b[0]);
      const free = [];
      let cursor = M;
      for (const [t, b] of obst) { if (t > cursor) free.push([cursor, t]); cursor = Math.max(cursor, b); }
      if (cursor < h - M) free.push([cursor, h - M]);
      if (!free.length) return { cx, cy: clamp(tapY, s / 2 + M, h - M - LBL - s / 2), s };

      // Bevorzugt das Intervall am Tap; sonst das größte.
      const need = s + LBL;
      let band = free.find((iv) => tapY >= iv[0] && tapY <= iv[1] && iv[1] - iv[0] >= Math.min(need, 150));
      if (!band) band = free.reduce((m, iv) => (iv[1] - iv[0] > m[1] - m[0] ? iv : m), free[0]);
      const bandH = band[1] - band[0];
      if (need > bandH) s = Math.max(120, bandH - LBL);
      const top = band[0] + Math.max(0, (bandH - (s + LBL)) / 2);
      cx = clamp(tapX, s / 2 + 20, w - s / 2 - 20);
      const cy = clamp(top + s / 2, s / 2 + M, h - M - LBL - s / 2);
      return { cx, cy, s };
    }

    function formGarment(tapX, tapY) {
      if (reduceMotion || !particles.length) return;
      garmentIdx = (garmentIdx + 1) % GARMENTS.length;
      const g = GARMENTS[garmentIdx];

      const { cx, cy, s } = placeGarment(tapX, tapY);
      formCenter = { x: cx, y: cy, s };
      formLabel = window.I18N ? window.I18N.t("type." + g.key) : g.key;
      const map = (gx, gy) => [cx + (gx - 32) * (s / 64), cy + (gy - 32) * (s / 64)];

      // Punkte-Budget proportional zur (skaleninvarianten) Konturlänge verteilen.
      const budget = Math.min(particles.length - 4, 96);
      const lens = g.chains.map((c) => chainLength(c.pts, c.closed));
      const totalLen = lens.reduce((a, b) => a + b, 0) || 1;

      const free = particles.slice();
      let acc = 0;
      formChains = g.chains.map((chain, ci) => {
        const n = Math.max(chain.closed ? 14 : 5, Math.round(budget * (lens[ci] / totalLen)));
        const targets = resample(chain.pts, chain.closed, n).map(([gx, gy]) => map(gx, gy));
        const parts = [];
        for (const [tx, ty] of targets) {
          if (!free.length) break;
          // Greedy: nächstes freies Partikel — kurze, ruhige Flugwege.
          let best = 0, bestD = Infinity;
          for (let i = 0; i < free.length; i++) {
            const d = (free[i].x - tx) ** 2 + (free[i].y - ty) ** 2;
            if (d < bestD) { bestD = d; best = i; }
          }
          const p = free.splice(best, 1)[0];
          p.tx = tx; p.ty = ty; p.forming = true;
          parts.push(p);
        }
        // Kumulative Bogenlänge entlang der Ziel-Kontur (Nadel + Knoten-Pops).
        const cum = [0];
        for (let i = 1; i < parts.length; i++) cum.push(cum[i - 1] + Math.hypot(parts[i].tx - parts[i - 1].tx, parts[i].ty - parts[i - 1].ty));
        let len = cum[cum.length - 1] || 0;
        if (chain.closed && parts.length > 1) len += Math.hypot(parts[0].tx - parts[parts.length - 1].tx, parts[0].ty - parts[parts.length - 1].ty);
        const startDist = acc;
        acc += len;
        parts.forEach((p, i) => { p.seamDist = startDist + cum[i]; });
        // Ozean-Verlauf entlang der Bounding-Box (einmal cachen, nie pro Frame).
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of parts) { minX = Math.min(minX, p.tx); maxX = Math.max(maxX, p.tx); minY = Math.min(minY, p.ty); maxY = Math.max(maxY, p.ty); }
        const grad = (maxX - minX) >= (maxY - minY)
          ? ctx.createLinearGradient(minX, 0, maxX, 0)
          : ctx.createLinearGradient(0, minY, 0, maxY);
        grad.addColorStop(0, "#2779a8");
        grad.addColorStop(0.5, "#2a9d8f");
        grad.addColorStop(1, "#64d6c4");
        return { closed: chain.closed, parts, cum, len, startDist, grad };
      });
      free.forEach((p) => { p.forming = false; });
      totalDist = acc || 1;
      formButtons = (g.buttons || []).map(([gx, gy]) => { const [x, y] = map(gx, gy); return { x, y }; });
      mode = "form";
      formStart = performance.now();
    }

    // Punkt in Screen-Koordinaten bei Bogenlänge d entlang der gesamten Naht.
    function pointAtDist(d) {
      for (const chain of formChains) {
        const parts = chain.parts;
        if (!parts.length) continue;
        if (d > chain.startDist + chain.len && chain !== formChains[formChains.length - 1]) continue;
        const local = d - chain.startDist;
        if (parts.length < 2) return { x: parts[0].tx, y: parts[0].ty };
        for (let i = 1; i < parts.length; i++) {
          if (chain.cum[i] >= local) {
            const t = (local - chain.cum[i - 1]) / (chain.cum[i] - chain.cum[i - 1] || 1);
            return { x: parts[i - 1].tx + (parts[i].tx - parts[i - 1].tx) * t, y: parts[i - 1].ty + (parts[i].ty - parts[i - 1].ty) * t };
          }
        }
        if (chain.closed) {
          const base = chain.cum[parts.length - 1];
          const t = clamp01((local - base) / (chain.len - base || 1));
          return { x: parts[parts.length - 1].tx + (parts[0].tx - parts[parts.length - 1].tx) * t, y: parts[parts.length - 1].ty + (parts[0].ty - parts[parts.length - 1].ty) * t };
        }
        return { x: parts[parts.length - 1].tx, y: parts[parts.length - 1].ty };
      }
      return null;
    }

    function releaseForm() {
      // Drift-Parameter aus der aktuellen Position zurückrechnen, damit die
      // Punkte ohne Sprung weiterkreisen (Umkehrung der Ellipse in step()).
      const cx = w / 2, cy = h / 2;
      for (const p of particles) {
        if (!p.forming) continue;
        p.forming = false;
        const ex = (p.x - cx) / 1.25, ey = (p.y - cy) / 0.85;
        p.angle = Math.atan2(ey, ex);
        p.baseRadius = Math.max(30, Math.hypot(ex, ey));
        p.wobble = Math.random() * Math.PI * 2;
      }
      formChains = [];
      formButtons = [];
      mode = "drift";
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mode = "drift";
      formChains = [];
      formButtons = [];
      seed();
      if (reduceMotion) {
        // Standbild: Positionen einmalig berechnen, genau einmal zeichnen.
        step(400);
        frame();
      }
    }

    function seed() {
      const count = Math.min(110, Math.max(40, Math.round((w * h) / 16000)));
      particles = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const radius = (0.18 + Math.random() * 0.42) * Math.min(w, h);
        return {
          angle,
          radius,
          baseRadius: radius,
          speed: (0.0006 + Math.random() * 0.0012) * (Math.random() < 0.5 ? 1 : -1),
          wobble: Math.random() * Math.PI * 2,
          size: 1.6 + Math.random() * 1.8,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          x: 0,
          y: 0,
          tx: 0,
          ty: 0,
          forming: false,
        };
      });
    }

    function step(dt) {
      const cx = w / 2, cy = h / 2;
      const pull = 1 - Math.exp(-dt / 150); // sanfter Zuflug zur Kontur
      for (const p of particles) {
        if (p.forming) {
          p.x += (p.tx - p.x) * pull;
          p.y += (p.ty - p.y) * pull;
          continue;
        }
        p.angle += p.speed * dt;
        p.wobble += 0.0008 * dt;
        const r = p.baseRadius + Math.sin(p.wobble) * 14;
        p.x = cx + Math.cos(p.angle) * r * 1.25; // leicht elliptisch (Breitbild)
        p.y = cy + Math.sin(p.angle) * r * 0.85;
        if (pointer.active && mode === "drift") {
          const dx = pointer.x - p.x, dy = pointer.y - p.y;
          const d2 = dx * dx + dy * dy;
          const reach = 200;
          if (d2 < reach * reach) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / reach) * 26;
            p.x += (dx / d) * f;
            p.y += (dy / d) * f;
          }
        }
      }
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);

      // Ambient-Gewebe NUR im Drift — beim Formen kein Konstellations-Rauschen
      // (entkluttert + gibt Frame-Budget für Naht & Nadel frei).
      if (mode !== "form") {
        ctx.lineWidth = 1;
        for (let i = 0; i < particles.length; i++) {
          const a = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const b = particles[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < LINK_DIST * LINK_DIST) {
              const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.16;
              ctx.strokeStyle = `rgba(100, 214, 196, ${alpha.toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      // Formen: eine leuchtende Nadel zieht eine Ozean-Verlaufs-Naht über die
      // Kontur — „die Fäden formen dein nächstes Stück".
      let needleDist = -1, needleActive = false, seamA = 0, reveal = 0, fade = 0;
      if (mode === "form" && formChains.length) {
        const e = performance.now() - formStart;
        reveal = easeInOut(clamp01((e - CONVERGE) / DRAW_MS));
        fade = clamp01((FORM_HOLD - e) / FADE_MS);
        seamA = fade * (0.82 + 0.13 * reveal);
        needleDist = reveal * totalDist;
        needleActive = e > CONVERGE - 30 && reveal < 1 && fade > 0.5;

        // 1) Naht je Kette bis zur Nadel zeichnen (Ziel-Kontur = saubere Kurve).
        //    Pro Kette zweimal stroken: weicher Glow + scharfer Faden — wirkt wie
        //    leuchtender Faden, nicht wie technische Linie.
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const chain of formChains) {
          const parts = chain.parts;
          if (parts.length < 2) continue;
          const localDist = Math.max(0, Math.min(needleDist - chain.startDist, chain.len));
          if (localDist <= 0) continue;
          const path = new Path2D();
          path.moveTo(parts[0].tx, parts[0].ty);
          for (let i = 1; i < parts.length; i++) {
            if (chain.cum[i] <= localDist) {
              path.lineTo(parts[i].tx, parts[i].ty);
            } else {
              const t = (localDist - chain.cum[i - 1]) / (chain.cum[i] - chain.cum[i - 1] || 1);
              path.lineTo(parts[i - 1].tx + (parts[i].tx - parts[i - 1].tx) * t, parts[i - 1].ty + (parts[i].ty - parts[i - 1].ty) * t);
              break;
            }
          }
          if (chain.closed) {
            const base = chain.cum[parts.length - 1];
            if (localDist >= base) {
              const t = clamp01((localDist - base) / (chain.len - base || 1));
              path.lineTo(parts[parts.length - 1].tx + (parts[0].tx - parts[parts.length - 1].tx) * t, parts[parts.length - 1].ty + (parts[0].ty - parts[parts.length - 1].ty) * t);
            }
          }
          ctx.strokeStyle = chain.grad;
          ctx.lineWidth = 7;
          ctx.globalAlpha = seamA * 0.16;
          ctx.stroke(path);
          ctx.lineWidth = 2.4;
          ctx.globalAlpha = seamA;
          ctx.stroke(path);
        }
        ctx.globalAlpha = 1;

        // 2) Dekorative Knöpfe (Hemd) erscheinen mit der Naht
        if (formButtons.length && reveal > 0.6) {
          ctx.fillStyle = `rgba(100, 214, 196, ${(0.85 * fade).toFixed(3)})`;
          for (const b of formButtons) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 3) Partikel-Knoten — beim Nadeldurchgang kurz aufleuchten (Naht-Pop)
      for (const p of particles) {
        let r = p.size;
        let a = p.forming ? 0.95 : (mode === "form" ? 0.28 : 0.7);
        if (mode === "form" && p.forming && needleDist >= 0) {
          const age = needleDist - p.seamDist;
          if (age >= 0 && age <= POP_DIST) {
            const k = 1 - age / POP_DIST;
            r = p.size * (1 + 1.2 * k);
            a = 0.95;
          }
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 4) Die Nadel — das EINE Leuchten der Szene (nur im Näh-Fenster)
      if (needleActive) {
        const np = pointAtDist(needleDist);
        if (np && np.x != null) {
          const tp = pointAtDist(Math.max(0, needleDist - 60));
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          if (tp && tp.x != null) {
            const tg = ctx.createLinearGradient(tp.x, tp.y, np.x, np.y);
            tg.addColorStop(0, "rgba(100, 214, 196, 0)");
            tg.addColorStop(1, "rgba(100, 214, 196, 0.9)");
            ctx.strokeStyle = tg;
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(tp.x, tp.y);
            ctx.lineTo(np.x, np.y);
            ctx.stroke();
          }
          ctx.shadowColor = "#64d6c4";
          ctx.shadowBlur = 16;
          ctx.fillStyle = "#9ff0e2";
          ctx.beginPath();
          ctx.arc(np.x, np.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 5) Label — Maschinen-Stimme (JetBrains Mono), unter dem Stück
      if (mode === "form" && seamA > 0.02 && reveal > 0.35 && formLabel) {
        ctx.font = "600 12px 'JetBrains Mono', ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(232, 238, 243, ${(0.85 * seamA).toFixed(3)})`;
        ctx.fillText(formLabel.toUpperCase(), formCenter.x, formCenter.y + formCenter.s / 2 + 30);
      }
    }

    let last = 0;
    function loop(t) {
      if (!running) return;
      const dt = Math.min(50, t - last || 16);
      last = t;
      if (mode === "form" && t - formStart > FORM_HOLD) releaseForm();
      step(dt);
      frame();
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (running || reduceMotion) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    // Nur animieren, wenn der Hero sichtbar und der Tab aktiv ist.
    const hero = canvas.closest(".lp-hero");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? start() : stop()));
    }, { threshold: 0.05 });
    io.observe(hero);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else if (hero.getBoundingClientRect().bottom > 0) start();
    });

    hero.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    }, { passive: true });
    hero.addEventListener("pointerleave", () => { pointer.active = false; });

    // Tap/Klick irgendwo im Hero (außer auf Links/Buttons): die Punkte
    // verbinden sich zur Silhouette des nächsten Kleidungsstücks.
    hero.addEventListener("pointerdown", (e) => {
      if (e.target.closest && e.target.closest("a, button")) return;
      const rect = canvas.getBoundingClientRect();
      formGarment(e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: true });

    window.addEventListener("resize", resize, { passive: true });
    resize();
  }

  /* ── Start ───────────────────────────────────────────────── */

  function init() {
    initStudioReveal();
    initLoader();
    buildManifesto();
    initLoop();
    initReveals();
    initCounters();
    initOrb();
    initWeave();
    // Sprachwechsel (app.js bedient den Toggle): Manifest-Spans neu aufbauen.
    window.addEventListener("language:change", () => {
      buildManifesto();
      if (fx) ScrollTrigger.refresh();
    });
    // Nach dem Font-Swap verschieben sich Layout-Höhen — Trigger neu messen.
    if (fx && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
