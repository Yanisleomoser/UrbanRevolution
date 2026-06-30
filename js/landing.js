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
    //    100er-Raster (Mitte 50,50). Kontroll-Punkte mit echten Schnitt-
    //    Proportionen (Schulterbreite, Ärmellänge/-winkel, Saum, A-Linie,
    //    Bund/Schritt …); Catmull-Rom verdichtet sie zu einer weichen Naht.
    const GARMENTS = [
      { key: "tshirt", chains: [{ closed: true, pts: [[42, 24], [34, 20], [19, 26], [15, 41], [29, 39], [32, 41], [33, 78], [67, 78], [68, 41], [71, 39], [85, 41], [81, 26], [66, 20], [58, 24], [50, 29]] }] },
      {
        key: "hoodie",
        chains: [
          { closed: true, pts: [[40, 26], [33, 24], [26, 12], [40, 5], [50, 4], [60, 5], [74, 12], [67, 24], [60, 26], [64, 28], [82, 34], [84, 62], [74, 62], [70, 46], [70, 82], [30, 82], [30, 46], [26, 62], [16, 62], [18, 34], [36, 28]] },
          { closed: false, pts: [[40, 26], [50, 20], [60, 26]] },
        ],
      },
      { key: "pants", chains: [{ closed: true, pts: [[30, 14], [70, 14], [70, 22], [64, 52], [60, 86], [52, 86], [51, 54], [50, 40], [49, 54], [48, 86], [40, 86], [36, 52], [30, 22]] }] },
      {
        key: "jacket",
        chains: [
          { closed: true, pts: [[43, 20], [35, 16], [20, 20], [13, 52], [23, 54], [28, 32], [30, 80], [50, 82], [70, 80], [72, 32], [77, 54], [87, 52], [80, 20], [65, 16], [57, 20], [50, 28]] },
          { closed: false, pts: [[50, 28], [50, 81]] },
        ],
      },
      { key: "dress", chains: [{ closed: true, pts: [[43, 22], [36, 18], [31, 24], [29, 38], [34, 48], [20, 84], [24, 86], [76, 86], [80, 84], [66, 48], [71, 38], [69, 24], [64, 18], [57, 22], [50, 28]] }] },
      {
        key: "shirt",
        chains: [
          { closed: true, pts: [[44, 22], [36, 18], [21, 24], [16, 40], [30, 38], [33, 40], [34, 80], [66, 80], [67, 40], [70, 38], [84, 40], [79, 24], [64, 18], [56, 22], [52, 18], [50, 26], [48, 18]] },
          { closed: false, pts: [[50, 26], [50, 80]] },
        ],
        buttons: [[50, 36], [50, 48], [50, 60], [50, 72]],
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

    // Bereits-dichte (Screen-)Polylinie gleichmäßig in n Punkte zerlegen
    // (arc-length) — für die Knoten-Ziele auf der weichen Naht.
    function resamplePoly(poly, closed, n) {
      const P = closed ? poly.concat([poly[0]]) : poly;
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
      const map = (gx, gy) => [cx + (gx - 50) * (s / 100), cy + (gy - 50) * (s / 100)];

      // Stiche/Knoten proportional zur (skaleninvarianten) Konturlänge verteilen.
      const budget = Math.min(particles.length - 4, 110);
      const lens = g.chains.map((c) => chainLength(c.pts, c.closed));
      const totalLen = lens.reduce((a, b) => a + b, 0) || 1;

      const free = particles.slice();
      let acc = 0;
      formChains = g.chains.map((chain, ci) => {
        // Dichte, WEICHE Kontur in Screen-Koordinaten = die Naht-Bahn selbst
        // (entkoppelt von der Partikelzahl → glatt statt polygonal).
        const smooth = densify(chain.pts, chain.closed).map(([gx, gy]) => map(gx, gy));
        const scum = [0];
        for (let i = 1; i < smooth.length; i++) scum.push(scum[i - 1] + Math.hypot(smooth[i][0] - smooth[i - 1][0], smooth[i][1] - smooth[i - 1][1]));
        let slen = scum[scum.length - 1] || 0;
        if (chain.closed && smooth.length > 1) slen += Math.hypot(smooth[0][0] - smooth[smooth.length - 1][0], smooth[0][1] - smooth[smooth.length - 1][1]);
        const startDist = acc;
        acc += slen;

        // Stiche: gleichmäßig auf der Naht; jeweils nächstes freies Partikel.
        const n = Math.max(chain.closed ? 18 : 6, Math.round(budget * (lens[ci] / totalLen)));
        const targets = resamplePoly(smooth, chain.closed, n);
        const step = slen / Math.max(1, targets.length);
        const parts = [];
        for (let k = 0; k < targets.length; k++) {
          if (!free.length) break;
          const tx = targets[k][0], ty = targets[k][1];
          let best = 0, bestD = Infinity;
          for (let i = 0; i < free.length; i++) {
            const d = (free[i].x - tx) ** 2 + (free[i].y - ty) ** 2;
            if (d < bestD) { bestD = d; best = i; }
          }
          const p = free.splice(best, 1)[0];
          p.tx = tx; p.ty = ty; p.forming = true; p.seamDist = startDist + k * step;
          parts.push(p);
        }
        // Ozean-Verlauf entlang der Konturbox (einmal cachen, nie pro Frame).
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const pt of smooth) { minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]); minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1]); }
        const grad = (maxX - minX) >= (maxY - minY)
          ? ctx.createLinearGradient(minX, 0, maxX, 0)
          : ctx.createLinearGradient(0, minY, 0, maxY);
        grad.addColorStop(0, "#2779a8");
        grad.addColorStop(0.5, "#2a9d8f");
        grad.addColorStop(1, "#64d6c4");
        return { closed: chain.closed, smooth, scum, slen, startDist, grad, parts };
      });
      free.forEach((p) => { p.forming = false; });
      totalDist = acc || 1;
      formButtons = (g.buttons || []).map(([gx, gy]) => { const [x, y] = map(gx, gy); return { x, y }; });
      mode = "form";
      formStart = performance.now();
    }

    // Punkt auf der weichen Kontur einer Kette bei lokaler Bogenlänge.
    function chainPtAt(chain, local) {
      const sm = chain.smooth, sc = chain.scum;
      const L = Math.max(0, Math.min(local, chain.slen));
      for (let i = 1; i < sm.length; i++) {
        if (sc[i] >= L) {
          const t = (L - sc[i - 1]) / (sc[i] - sc[i - 1] || 1);
          return [sm[i - 1][0] + (sm[i][0] - sm[i - 1][0]) * t, sm[i - 1][1] + (sm[i][1] - sm[i - 1][1]) * t];
        }
      }
      const last = sm[sm.length - 1], base = sc[sc.length - 1];
      const end = chain.closed ? sm[0] : last;
      const t = clamp01((L - base) / (chain.slen - base || 1));
      return [last[0] + (end[0] - last[0]) * t, last[1] + (end[1] - last[1]) * t];
    }

    // Punkt in Screen-Koordinaten bei Bogenlänge d entlang der gesamten Naht.
    function pointAtDist(d) {
      let chain = null;
      for (const c of formChains) {
        if (d <= c.startDist + c.slen || c === formChains[formChains.length - 1]) { chain = c; break; }
      }
      if (!chain || chain.smooth.length < 2) return null;
      const p = chainPtAt(chain, d - chain.startDist);
      return { x: p[0], y: p[1] };
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
          const sm = chain.smooth, sc = chain.scum;
          if (sm.length < 2) continue;
          const localDist = Math.max(0, Math.min(needleDist - chain.startDist, chain.slen));
          if (localDist <= 0) continue;
          const path = new Path2D();
          path.moveTo(sm[0][0], sm[0][1]);
          let cut = false;
          for (let i = 1; i < sm.length; i++) {
            if (sc[i] <= localDist) {
              path.lineTo(sm[i][0], sm[i][1]);
            } else {
              const t = (localDist - sc[i - 1]) / (sc[i] - sc[i - 1] || 1);
              path.lineTo(sm[i - 1][0] + (sm[i][0] - sm[i - 1][0]) * t, sm[i - 1][1] + (sm[i][1] - sm[i - 1][1]) * t);
              cut = true;
              break;
            }
          }
          // geschlossene Kontur: Schluss-Segment zurück zum Start
          if (!cut && chain.closed) {
            const base = sc[sc.length - 1];
            const t = clamp01((localDist - base) / (chain.slen - base || 1));
            const last = sm[sm.length - 1];
            path.lineTo(last[0] + (sm[0][0] - last[0]) * t, last[1] + (sm[0][1] - last[1]) * t);
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

      // 3) Stiche/Knoten — gleichmäßig klein auf der Naht; beim Nadeldurchgang
      //    kurz aufleuchten (Naht-Pop). Die glatte Naht führt, die Punkte sind
      //    nur feine Stiche darauf.
      for (const p of particles) {
        let r = p.forming ? 1.7 : p.size;
        let a = p.forming ? 0.9 : (mode === "form" ? 0.12 : 0.7);
        if (mode === "form" && p.forming && needleDist >= 0) {
          const age = needleDist - p.seamDist;
          if (age >= 0 && age <= POP_DIST) {
            const k = 1 - age / POP_DIST;
            r = 1.7 * (1 + 1.5 * k);
            a = 1;
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
