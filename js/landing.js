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

  // Pure Bogen-Mathematik für #pivot („Die Wende"): eine Gerade der Länge L
  // rollt sich zum Kreis auf. Bei Fortschritt p ∈ [0,1] wird sie zum Kreis-
  // bogen mit Öffnungswinkel θ = 2π·p und Radius L/θ — die Bogenlänge bleibt
  // konstant (die Linie wird gebogen, nicht skaliert). Die Figur wird auf
  // (cx, cy) zentriert. p ≤ EPS ⇒ Gerade (Radius → ∞ wird geklemmt, nie NaN).
  // DOM-frei + oberhalb des window-Guards → headless unit-testbar.
  function pivotBendPath(p, L, cx, cy, samples) {
    const n = Math.max(8, Math.floor(samples) || 64);
    const num = Number(p);
    const prog = num > 1 ? 1 : num > 0 ? num : 0; // NaN/negativ → 0
    const pts = [];
    if (prog < 0.004) {
      for (let i = 0; i <= n; i++) pts.push([0, -L / 2 + (i / n) * L]);
    } else {
      const theta = 2 * Math.PI * prog;
      const R = L / theta;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * theta;
        pts.push([R * (1 - Math.cos(t)), -R * Math.sin(t)]);
      }
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pt of pts) {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    }
    const ox = cx - (minX + maxX) / 2;
    const oy = cy - (minY + maxY) / 2;
    return "M" + pts.map((pt) => (pt[0] + ox).toFixed(2) + " " + (pt[1] + oy).toFixed(2)).join(" L");
  }

  // §5.1 Threshold-Portal — pure Geometrie: der Kreis, der vom angeklickten
  // CTA in den Viewport wächst. Die Scheibe muss den GANZEN Viewport von einem
  // beliebigen Ursprung aus decken, also ist ihr Radius die Distanz zur
  // fernsten Viewport-Ecke (+6 % Luft für iOS-Toolbar-Shifts); sie startet
  // exakt auf dem Kreis des Ursprungs-Elements — der Orb IST das Portal.
  // DOM-frei → headless unit-testbar.
  function portalGeometry(rect, vw, vh) {
    const r = rect || {};
    const w = Number(r.width) || 0, h = Number(r.height) || 0;
    const cx = (Number(r.left) || 0) + w / 2;
    const cy = (Number(r.top) || 0) + h / 2;
    const W = Math.max(1, Number(vw) || 1), H = Math.max(1, Number(vh) || 1);
    const fx2 = Math.max(cx, W - cx), fy2 = Math.max(cy, H - cy);
    const D = Math.ceil(Math.sqrt(fx2 * fx2 + fy2 * fy2) * 2 * 1.06);
    const d0 = Math.max(24, Math.min(w, h)); // Text-Links bekommen einen kleinen, aber sichtbaren Start-Kreis
    return { cx, cy, D, scale0: Math.min(1, d0 / D) };
  }

  // Wann wird ein Studio-Anker-Klick zum Portal? Nur mit voller Bewegung
  // (html.fx UND live erlaubter Motion — reduced-motion kann sich NACH dem
  // Laden ändern, während das fx-Snapshot stehen bleibt; der CSS-Belt würde
  // das Portal dann unsichtbar machen und der Klick wäre tot), noch
  // verborgenem Studio, keinem laufenden Portal und einem einfachen
  // Haupttasten-Klick (Modifier-Klicks behalten die native Anker-Semantik).
  // Pure Truth-Table → unit-testbar.
  function shouldPortal(o) {
    const s = o || {};
    return !!s.fx && !s.reduce && !!s.hidden && !s.active && !s.modified;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { shouldRevealForHash, STUDIO_ANCHORS, pivotBendPath, portalGeometry, shouldPortal };
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

  // CSS scroll-behavior:smooth + Hash-Fragment + initiale ScrollTrigger-Messung
  // vertragen sich nicht: Chrome animiert den Fragment-Sprung rund um DCL, und
  // Trigger, die währenddessen entstehen/vermessen werden, rechnen die Sprung-
  // Zielposition in ihre starts ein — gepinnte Sektionen wirken dann
  // „durchgespielt", bevor man sie erreicht (deterministisch reproduzierbar
  // unter #pivot-/#how-Deep-Links, headless UND real). Während des Ladens auf
  // instant schalten — ein Deep-Link soll ohnehin nicht 3000 px „anreisen" —
  // und erst wieder freigeben, wenn Sprung + Layout gesetzt sind.
  if (fx && location.hash) {
    document.documentElement.style.scrollBehavior = "auto";
    window.addEventListener("load", () => {
      setTimeout(() => { document.documentElement.style.scrollBehavior = ""; }, 500);
    }, { once: true });
  }

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

  // §5.1 — die Schwelle: der Kreis, mit dem die Landing endet, öffnet sich
  // wörtlich ins Studio. Eine REINE Scheibe (Midnight-Fläche + Ocean-Ring,
  // bewusst ohne Inhalt: jede eingebettete Grafik würde beim Skalieren zum
  // aufgeblasenen Bild) wächst lesbar vom angeklickten CTA über den Viewport;
  // darunter passieren Reveal + Fragment-Sprung INSTANT, dann öffnet sich die
  // Scheibe auf die Studio-Oberfläche — deren echte, feine Genesis-Fäden sind
  // der Payoff. Nur transform/opacity (Compositor, iOS-tauglich).
  // Reduced-Motion, fehlendes GSAP und Deep-Links behalten den Instant-Reveal
  // — das Portal läuft dann nie. Gibt true zurück, wenn es den Klick übernahm.
  let portalActive = false;
  function portalReveal(origin, href, modified) {
    const studio = document.getElementById("studio");
    const reduceNow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!shouldPortal({ fx, reduce: reduceNow, hidden: !!(studio && studio.hidden), active: portalActive, modified })) return false;
    if (!origin || !origin.getBoundingClientRect) return false;
    portalActive = true;
    // Layout-Viewport-Maße (nicht nur innerWidth/-Height): iOS-Safari meldet
    // unter Pinch-Zoom die VISUELLEN Maße, während getBoundingClientRect in
    // Layout-Koordinaten liefert — die Scheibe würde einen gezoomten, weit
    // gepannten Ausschnitt sonst nicht sicher decken.
    const vw = Math.max(window.innerWidth, (document.documentElement && document.documentElement.clientWidth) || 0);
    const vh = Math.max(window.innerHeight, (document.documentElement && document.documentElement.clientHeight) || 0);
    const g = portalGeometry(origin.getBoundingClientRect(), vw, vh);
    const portal = document.createElement("div");
    portal.className = "lp-portal";
    portal.setAttribute("aria-hidden", "true");
    const disc = document.createElement("div");
    disc.className = "lp-portal-disc";
    disc.style.width = g.D + "px";
    disc.style.height = g.D + "px";
    disc.style.left = (g.cx - g.D / 2) + "px";
    disc.style.top = (g.cy - g.D / 2) + "px";
    disc.style.transform = "scale(" + g.scale0 + ")";
    portal.appendChild(disc);
    document.body.appendChild(portal);
    // A11y: das Portal selbst ist aria-hidden — Screenreader hörten während
    // der ~0,8 s Abdeckung sonst NICHTS auf ihre Aktivierung (liest sich wie
    // ein toter Button). Eine höfliche Status-Region sagt an, was passiert;
    // der Fokus zieht wie bisher in revealStudio() ins Studio.
    const srStatus = document.createElement("span");
    srStatus.className = "visually-hidden";
    srStatus.setAttribute("role", "status");
    document.body.appendChild(srStatus);
    setTimeout(() => {
      srStatus.textContent = window.I18N ? window.I18N.t("landing.portal_opening") : "Studio öffnet …";
    }, 0);
    const cleanup = () => { portal.remove(); srStatus.remove(); portalActive = false; };
    // Phase 2 synchronisiert auf das ECHTE Transition-Ende (transitionend),
    // nicht auf eine Wanduhr-Schätzung: auf langsamen Geräten startet die
    // Transition verspätet (erste Rasterisierung der großen Scheibe), und ein
    // fixer Timer würde das Studio enthüllen, bevor die Scheibe deckt. Der
    // Timeout-Fallback (~3× Nominaldauer) fängt verschluckte Events ab.
    let covered = false;
    const phase2 = () => {
      if (covered || !portal.isConnected) return;
      covered = true;
      // Kommt phase2 über den Fallback-Timer (Transition auf einem sehr
      // langsamen Gerät noch mitten im Wachsen), erst die Scheibe in EINEM
      // Frame auf volle Deckung schnappen — ein Sprung der Abdeckung ist
      // unauffällig, der Studio-Umbau in offener Sicht nicht.
      disc.style.transition = "none";
      disc.style.transform = "scale(1)";
      void disc.offsetWidth;
      disc.style.transition = "";
      // Unter der Abdeckung: Fragment setzen (History-Eintrag wie beim
      // nativen Klick), Reveal + Fokus — alles mit Instant-Scroll.
      const html = document.documentElement;
      const prevSB = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      try {
        if (href && location.hash !== href) location.hash = href;
        revealStudio();
      } finally {
        html.style.scrollBehavior = prevSB;
      }
      portal.classList.add("is-out");
      disc.style.opacity = "0";
      disc.style.transform = "scale(1.05)";
      setTimeout(cleanup, 340);
    };
    disc.addEventListener("transitionend", (e) => { if (e.propertyName === "transform") phase2(); }, { once: true });
    setTimeout(phase2, 1300);
    // Den Start-Frame GARANTIERT malen lassen (Doppel-rAF): Safari koalesziert
    // Append + Umstylen im selben Frame sonst gern zu einem Sprung OHNE
    // Transition — statt Wachstum stünde ein eingefrorenes Vollbild, bis der
    // Fallback-Timer greift. Ein reiner Reflow (offsetWidth) reicht dort nicht.
    void disc.offsetWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { disc.style.transform = "scale(1)"; });
    });
    // Sicherheitsnetz: die Seite bleibt NIE hinter einem Overlay gefangen.
    setTimeout(() => { if (portal.isConnected) cleanup(); }, 2600);
    return true;
  }

  function initStudioReveal() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!STUDIO_ANCHORS.includes(href.slice(1))) return;
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
      // Läuft das Portal bereits (Doppelklick auf den Orb), gehört ihm die
      // Transition: den zweiten Klick schlucken statt instant zu enthüllen
      // und einen nativen Smooth-Scroll gegen die wachsende Scheibe rennen
      // zu lassen. Modifier-Klicks bleiben unangetastet (neuer Tab etc.).
      if (portalActive && !modified) { e.preventDefault(); return; }
      // §5.1: mit erlaubter Bewegung und noch geschlossenem Studio wird der
      // Klick zur Schwelle — der Kreis wächst aus dem berührten Element.
      if (portalReveal(a, href, modified)) { e.preventDefault(); return; }
      revealStudio();
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

  /* ── Die Wende (#pivot): die Linie biegt sich zum Kreis ──── */

  // Gepinnter Scrub (gleiches Muster wie initLoop): pro Frame wird EIN
  // <path d> neu gerechnet (pivotBendPath, reine viewBox-Koordinaten —
  // resize-immun) und auf beide Pfade geschrieben: die Mono-Linie blendet
  // aus, der Ozean-Verlauf ein — die Linie WIRD der Kreis. Text-Choreo:
  // die grosse Frage weicht dem Scharniersatz + Mission.
  // Ohne fx bleibt der statische Default aus dem Markup (fertiger Kreis,
  // Frage + Antwort untereinander) unangetastet.
  function initPivot() {
    if (!fx) return;
    const pin = document.getElementById("pivot-pin");
    const line = document.getElementById("pivot-line");
    const arc = document.getElementById("pivot-arc");
    const q = document.getElementById("pivot-q");
    const answer = document.getElementById("pivot-answer");
    if (!pin || !line || !arc || !q || !answer) return;

    // Endkreis r = 120 im 560×620-viewBox (Umfang 2π·120 ≈ 754) — muss zum
    // statischen d-Attribut im Markup passen.
    const L = 754, CX = 280, CY = 310;
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    let lastD = "";
    function setPivot(p) {
      const bend = easeInOut(p);
      const d = pivotBendPath(bend, L, CX, CY, 72);
      if (d !== lastD) {
        line.setAttribute("d", d);
        arc.setAttribute("d", d);
        lastD = d;
      }
      line.style.opacity = String(1 - bend);
      arc.style.opacity = String(bend);
      // Frage raus 0.30–0.42, Antwort rein ab 0.44 — nur ein kurzer Atemzug
      // ohne Text (~4 % des Pins), kein leeres Loch in der Mitte.
      const qOut = clamp01((p - 0.30) / 0.12);
      q.style.opacity = String(1 - qOut);
      q.style.transform = "translateY(" + (-24 * qOut).toFixed(1) + "px)";
      const aIn = clamp01((p - 0.44) / 0.20);
      answer.style.opacity = String(aIn);
      answer.style.transform = "translateY(" + (28 * (1 - aIn)).toFixed(1) + "px)";
    }
    setPivot(0);

    ScrollTrigger.create({
      trigger: pin,
      start: "top top",
      // kurz und entschieden — kein zweiter Marathon-Pin vor #loop
      end: () => (window.matchMedia("(max-width: 700px)").matches ? "+=110%" : "+=130%"),
      pin: true,
      scrub: true,
      onUpdate: (self) => setPivot(self.progress),
    });
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
    const TAU = Math.PI * 2;
    const LINK_DIST = 84;
    const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
    const NB = 5;                            // Alpha-Stufen der Web-Fäden (Distanz × Maske)
    const BUCKET_ALPHA = [0.025, 0.045, 0.07, 0.095, 0.115];
    const LINK_STROKE = BUCKET_ALPHA.map((a) => `rgba(100, 214, 196, ${a})`);
    const DOT_ALPHA = 0.5;                   // Grund-Deckkraft der Web-Punkte
    const FORM_DIM = 0.45;                   // Web tritt beim Formen zurück (nicht aus)
    const MASK_CELL = 22, FEATHER = 84;      // Headline-Schutzmaske: Auflösung + weiche Kante
    let mobile = false;
    // Spatial-Hash-Gitter für O(n)-Nachbarsuche (Arrays werden wiederverwendet).
    let gCols = 1, gRows = 1, cellHead = null, cellNext = null;
    let buckets = null, bucketCap = 0, bucketLen = null;
    // Headline-Maske als vorberechnetes Low-Res-Feld (O(1)-Lookup).
    let maskGrid = null, mCols = 1, mRows = 1;
    // FPS-Wächter — stuft die Felddichte herunter, BEVOR Frames fallen.
    let emaDt = 16, slowFrames = 0, degradeLvl = 0, linksOn = true;
    let w = 0, h = 0, dpr = 1;
    let particles = [];
    let raf = 0;
    let running = false;
    const pointer = { x: -9999, y: -9999, active: false };
    // Canvas-Rect fürs Pointer-Mapping gecacht (Muster wie facts-instruments.js) —
    // sonst zwingt jede Mausbewegung ein synchrones Layout-Read.
    let canvasRect = null;

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
    const CONVERGE = 110;        // ms kurzes Sammeln, bevor die Nadel zu nähen beginnt
    const DRAW_MS = 900;         // ms Nadel-Lauf: das Stück wird Punkt für Punkt genäht
    const HOLD_MS = 460;         // ms Halten des fertigen Stücks
    const FADE_MS = 300;         // ms schnelles Auflösen zurück zu den Punkten
    const FORM_HOLD = CONVERGE + DRAW_MS + HOLD_MS + FADE_MS; // ~1770 ms gesamt (vorher 4200)
    const POP_DIST = 34;         // px-Fenster, in dem ein Knoten beim Nähen aufleuchtet
    const LEAD_FRAC = 0.22;      // Anteil der Naht, um den die „Stich-Welle" vor der Nadel einfliegt

    // Geteilter Form-Zustand: einmal pro Frame in der loop berechnet, von step()
    // (Stich-Welle) UND frame() (Naht/Nadel) gelesen.
    let fReveal = 0, fNeedle = -1, fSeamA = 0, fFade = 0, fE = 0;

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

    // Platzierung: GENAU am Tap, nur an die Canvas-Ränder geklemmt. Die
    // Silhouette darf bewusst HINTER der Schrift liegen — getippt wird überall,
    // geformt wird genau dort, wo der Finger sitzt.
    function placeGarment(tapX, tapY) {
      const s = Math.max(180, Math.min(0.5 * Math.min(w, h), 420));
      const cx = Math.min(Math.max(tapX, s / 2 + 16), w - s / 2 - 16);
      const cy = Math.min(Math.max(tapY, s / 2 + 16), h - s / 2 - 16);
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
          p.tx = tx; p.ty = ty; p.forming = true; p.placed = false; p.build = 0; p.seamDist = startDist + k * step;
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
      free.forEach((p) => { p.forming = false; p.placed = false; p.build = 0; });
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
      // Stich-Punkte kehren ins Web zurück: frische, langsame Drift + Phase,
      // dann übernimmt der torus-Wrap nahtlos (kein Sprung).
      for (const p of particles) {
        if (!p.forming) continue;
        p.forming = false;
        p.placed = false;
        p.build = 0;
        p.vx = driftVel();
        p.vy = driftVel();
        p.phase = Math.random() * TAU;
      }
      formChains = [];
      formButtons = [];
      mode = "drift";
    }

    function resize() {
      canvasRect = null;
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
      // A resize/rotation is a natural checkpoint to re-try full quality: a
      // permanent CPU spike right after load (GC pause, throttled tab) would
      // otherwise degrade the field once and never recover for the rest of
      // the session, since these only ever move one way in degradeField().
      emaDt = 16;
      slowFrames = 0;
      degradeLvl = 0;
      linksOn = true;
      seed();
      allocGrid();
      computeMask();
      if (reduceMotion) {
        // Standbild: Positionen einmalig berechnen, genau einmal zeichnen.
        step(400);
        frame();
      }
    }

    const driftVel = () => (0.008 + Math.random() * 0.018) * (Math.random() < 0.5 ? 1 : -1);

    function seed() {
      mobile = Math.min(w, h) <= 480;
      // Tausende Punkte füllen die ganze Fläche; nach Fläche/Gerät skaliert.
      const count = mobile
        ? Math.min(720, Math.max(340, Math.round((w * h) / 1700)))
        : Math.min(2000, Math.max(500, Math.round((w * h) / 1200)));
      // Aus jittered grobem Raster säen → gleichmäßige Abdeckung ab Frame 1
      // (kein „Einschwing"-Ring, keine leeren Ecken).
      const aspect = Math.max(0.2, w / Math.max(1, h));
      const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
      const rows = Math.max(1, Math.ceil(count / cols));
      const cellW = w / cols, cellH = h / rows;
      particles = Array.from({ length: count }, (_, i) => {
        const ci = (Math.random() * COLORS.length) | 0;
        return {
          x: ((i % cols) + Math.random()) * cellW,
          y: (((i / cols) | 0) + Math.random()) * cellH,
          vx: driftVel(), vy: driftVel(),
          phase: Math.random() * TAU,
          size: (mobile ? 0.7 : 0.8) + Math.random() * (mobile ? 0.6 : 0.9),
          colorIdx: ci,
          color: COLORS[ci],
          tx: 0,
          ty: 0,
          forming: false,
          placed: false,   // schon eingenäht?
          build: 0,        // 0→1 Einflug-Fortschritt der Stich-Welle
          seamDist: 0,     // Position entlang der Naht
        };
      });
    }

    // Gitter-/Bucket-/Masken-Arrays (re)allozieren — nur wenn sie wachsen müssen.
    function allocGrid() {
      gCols = Math.max(1, ((w / LINK_DIST) | 0) + 1);
      gRows = Math.max(1, ((h / LINK_DIST) | 0) + 1);
      const nCells = gCols * gRows;
      if (!cellHead || cellHead.length < nCells) cellHead = new Int32Array(nCells);
      if (!cellNext || cellNext.length < particles.length) cellNext = new Int32Array(particles.length);
      const cap = mobile ? 1600 : 2600; // max Faden-Paare je Bucket
      if (!buckets || bucketCap < cap) {
        buckets = Array.from({ length: NB }, () => new Float32Array(cap * 4));
        bucketCap = cap;
      }
      if (!bucketLen) bucketLen = new Int32Array(NB);
    }

    // Headline-Schutzmaske: dünnt das Web rund um die SICHTBARE Schrift auf ~0
    // (Low-Res-Feld, 0 = aus … 1 = volles Web). Lesbarkeit per Konstruktion.
    function computeMask() {
      const cr = canvas.getBoundingClientRect();
      const heroEl = canvas.closest(".lp-hero");
      const boxes = [];
      const add = (rc, pad) => { if (rc && rc.width > 1 && rc.height > 1) boxes.push([rc.left - cr.left - pad, rc.top - cr.top - pad, rc.right - cr.left + pad, rc.bottom - cr.top + pad]); };
      const tight = (el, pad) => { try { const rg = document.createRange(); rg.selectNodeContents(el); add(rg.getBoundingClientRect(), pad); } catch (_) { add(el.getBoundingClientRect(), pad); } };
      const PAD = 0.5 * LINK_DIST;
      if (heroEl) {
        heroEl.querySelectorAll(".lp-hero-eyebrow, .lp-hero-line, .lp-hero-sub, .lp-hero-hint").forEach((el) => tight(el, PAD));
        const cta = heroEl.querySelector(".lp-hero-ctas"); if (cta) add(cta.getBoundingClientRect(), PAD);
        const cue = heroEl.querySelector(".lp-scroll-cue"); if (cue) add(cue.getBoundingClientRect(), PAD * 0.4);
      }
      // .nav-shell, nicht .lp-nav: die sticky Bar selbst ist 0px hoch (layout-
      // neutral); die sichtbare Leiste — die die Maske freihalten muss — ist die Shell.
      const nav = document.querySelector(".lp-nav .nav-shell"); if (nav) add(nav.getBoundingClientRect(), 8);
      mCols = Math.max(1, Math.ceil(w / MASK_CELL));
      mRows = Math.max(1, Math.ceil(h / MASK_CELL));
      if (!maskGrid || maskGrid.length < mCols * mRows) maskGrid = new Float32Array(mCols * mRows);
      for (let gy = 0; gy < mRows; gy++) {
        const py = gy * MASK_CELL + MASK_CELL * 0.5;
        for (let gx = 0; gx < mCols; gx++) {
          const px = gx * MASK_CELL + MASK_CELL * 0.5;
          let best = 1;
          for (let bi = 0; bi < boxes.length; bi++) {
            const b = boxes[bi];
            const ddx = Math.max(b[0] - px, 0, px - b[2]);
            const ddy = Math.max(b[1] - py, 0, py - b[3]);
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            let m;
            if (d <= 0) m = 0; else if (d >= FEATHER) m = 1; else { const t = d / FEATHER; m = t * t * (3 - 2 * t); }
            if (m < best) { best = m; if (best === 0) break; }
          }
          maskGrid[gy * mCols + gx] = best;
        }
      }
    }
    function maskAt(x, y) {
      let gx = (x / MASK_CELL) | 0, gy = (y / MASK_CELL) | 0;
      if (gx < 0) gx = 0; else if (gx >= mCols) gx = mCols - 1;
      if (gy < 0) gy = 0; else if (gy >= mRows) gy = mRows - 1;
      return maskGrid[gy * mCols + gx];
    }

    // Einen Faden ggf. in seinen Distanz/Masken-Bucket legen (O(1)).
    function addLink(ax, ay, b, cap4) {
      const dx = ax - b.x, dy = ay - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= LINK_DIST_SQ) return;
      const eff = (1 - d2 / LINK_DIST_SQ) * maskAt((ax + b.x) * 0.5, (ay + b.y) * 0.5);
      if (eff < 0.04) return;
      let bi = (eff * NB) | 0; if (bi >= NB) bi = NB - 1;
      const len = bucketLen[bi];
      if (len + 4 > cap4) return;
      const arr = buckets[bi];
      arr[len] = ax; arr[len + 1] = ay; arr[len + 2] = b.x; arr[len + 3] = b.y;
      bucketLen[bi] = len + 4;
    }

    // Das Ambient-Web zeichnen: O(n)-Gitter, ≤5 gebündelte Faden-Strokes +
    // 3 gebündelte Punkt-Fills. dimm < 1 lässt das Web beim Formen zurücktreten.
    function drawField(dimm) {
      const n = particles.length;
      cellHead.fill(-1);
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        if (p.forming) continue; // forming-Punkte sind das Stück, nicht das Web
        let cx = (p.x / LINK_DIST) | 0; if (cx < 0) cx = 0; else if (cx >= gCols) cx = gCols - 1;
        let cy = (p.y / LINK_DIST) | 0; if (cy < 0) cy = 0; else if (cy >= gRows) cy = gRows - 1;
        const c = cx + cy * gCols;
        cellNext[i] = cellHead[c];
        cellHead[c] = i;
      }
      if (linksOn) {
        for (let b = 0; b < NB; b++) bucketLen[b] = 0;
        const cap4 = bucketCap * 4;
        for (let cy = 0; cy < gRows; cy++) {
          for (let cx = 0; cx < gCols; cx++) {
            for (let i = cellHead[cx + cy * gCols]; i !== -1; i = cellNext[i]) {
              const a = particles[i], ax = a.x, ay = a.y;
              for (let j = cellNext[i]; j !== -1; j = cellNext[j]) addLink(ax, ay, particles[j], cap4);
              // nur 4 VORWÄRTS-Nachbarn → jedes Paar genau einmal (Dedup gratis)
              if (cx + 1 < gCols) for (let j = cellHead[(cx + 1) + cy * gCols]; j !== -1; j = cellNext[j]) addLink(ax, ay, particles[j], cap4);
              if (cy + 1 < gRows) {
                if (cx > 0) for (let j = cellHead[(cx - 1) + (cy + 1) * gCols]; j !== -1; j = cellNext[j]) addLink(ax, ay, particles[j], cap4);
                for (let j = cellHead[cx + (cy + 1) * gCols]; j !== -1; j = cellNext[j]) addLink(ax, ay, particles[j], cap4);
                if (cx + 1 < gCols) for (let j = cellHead[(cx + 1) + (cy + 1) * gCols]; j !== -1; j = cellNext[j]) addLink(ax, ay, particles[j], cap4);
              }
            }
          }
        }
        ctx.lineWidth = mobile ? 0.6 : 0.7;
        ctx.lineCap = "butt";
        ctx.globalAlpha = dimm;
        for (let b = 0; b < NB; b++) {
          const len = bucketLen[b];
          if (!len) continue;
          const arr = buckets[b];
          const path = new Path2D();
          for (let k = 0; k < len; k += 4) { path.moveTo(arr[k], arr[k + 1]); path.lineTo(arr[k + 2], arr[k + 3]); }
          ctx.strokeStyle = LINK_STROKE[b];
          ctx.stroke(path);
        }
      }
      // Punkte gebündelt (3 Farb-Fills), Headline-Zone ausgespart.
      const paths = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        if (p.forming || maskAt(p.x, p.y) < 0.5) continue;
        const r = p.size;
        paths[p.colorIdx].rect(p.x - r, p.y - r, r + r, r + r);
      }
      ctx.globalAlpha = DOT_ALPHA * dimm;
      for (let c = 0; c < 3; c++) { ctx.fillStyle = COLORS[c]; ctx.fill(paths[c]); }
      ctx.globalAlpha = 1;
    }

    // Geteilten Form-Zustand pro Frame berechnen (loop ruft das vor step/frame).
    function computeForm() {
      fE = performance.now() - formStart;
      fReveal = easeInOut(clamp01((fE - CONVERGE) / DRAW_MS));
      fFade = clamp01((FORM_HOLD - fE) / FADE_MS);
      fNeedle = fReveal * totalDist;
      fSeamA = fFade * (0.82 + 0.13 * fReveal);
    }

    // Ambient-Punkt bewegen: gleichmäßige Drift über die GANZE Fläche (kein
    // Mittelpunkt-Orbit → keine leeren Ecken/Ring), mit weicher Geschwindigkeits-
    // Wobble + torus-Wrap, plus Pointer-Magnet.
    function driftStep(p, dt) {
      p.phase += 0.0006 * dt;
      p.x += p.vx * dt;
      p.y += (p.vy + Math.sin(p.phase) * 0.006) * dt;
      const M = LINK_DIST;
      if (p.x < -M) p.x += w + 2 * M; else if (p.x > w + M) p.x -= w + 2 * M;
      if (p.y < -M) p.y += h + 2 * M; else if (p.y > h + M) p.y -= h + 2 * M;
      if (pointer.active && mode === "drift") {
        const dx = pointer.x - p.x, dy = pointer.y - p.y;
        const d2 = dx * dx + dy * dy;
        const reach = 200;
        if (d2 < reach * reach) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / reach) * 22;
          p.x += (dx / d) * f;
          p.y += (dy / d) * f;
        }
      }
    }

    function step(dt) {
      const lead = totalDist * LEAD_FRAC;
      for (const p of particles) {
        if (p.forming) {
          if (p.placed) { p.x = p.tx; p.y = p.ty; p.build = 1; continue; }
          // Stich-Welle: das Partikel fliegt erst ein, wenn die Nadel naht —
          // so wird das Stück sichtbar Punkt für Punkt zusammengenäht.
          const pp = lead > 0 ? clamp01((fNeedle - (p.seamDist - lead)) / lead) : 1;
          p.build = pp;
          if (pp <= 0) continue; // ruht als „Rohpunkt", bis die Welle es erfasst
          const f = Math.min(1, (1 - Math.exp(-dt / 80)) + 0.5 * pp * pp);
          p.x += (p.tx - p.x) * f;
          p.y += (p.ty - p.y) * f;
          if (pp >= 1) { p.x = p.tx; p.y = p.ty; p.placed = true; }
          continue;
        }
        driftStep(p, dt);
      }
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);

      // Ambient-Web („Spinnennetz" aus tausenden Punkten) füllt die ganze Fläche.
      // Beim Formen tritt es gedimmt zurück (statt zu verschwinden), sodass die
      // Naht sichtbar AUS dem Web heraus entsteht.
      drawField(mode === "form" ? FORM_DIM : 1);

      // Formen: eine leuchtende Nadel zieht eine Ozean-Verlaufs-Naht über die
      // Kontur — „die Fäden formen dein nächstes Stück".
      let needleDist = -1, needleActive = false, seamA = 0, reveal = 0, fade = 0;
      if (mode === "form" && formChains.length) {
        reveal = fReveal; fade = fFade; seamA = fSeamA; needleDist = fNeedle;
        needleActive = fE > CONVERGE - 30 && reveal < 1 && fade > 0.5;

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

      // 3) Stiche/Knoten DES STÜCKS — Rohpunkt schwach → eingenäht hell; beim
      //    Nadeldurchgang kurz aufleuchten (Naht-Pop). Beim Auflösen bleiben die
      //    Punkte stehen, während der Faden verschwindet → „zurück zu den Punkten".
      //    (Die Web-Punkte selbst zeichnet drawField gebündelt.)
      for (const p of particles) {
        if (!p.forming) continue;
        const b = p.placed ? 1 : p.build;
        let r = 1.7, a = 0.2 + 0.7 * b;
        if (needleDist >= 0) {
          const age = needleDist - p.seamDist;
          if (age >= 0 && age <= POP_DIST) { r = 1.7 * (1 + 1.6 * (1 - age / POP_DIST)); a = 0.95; }
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
        ctx.fillText(formLabel.toUpperCase(), formCenter.x, Math.min(formCenter.y + formCenter.s / 2 + 26, h - 12));
      }
    }

    let last = 0;
    function loop(t) {
      if (!running) return;
      const dt = Math.min(50, t - last || 16);
      last = t;
      if (mode === "form" && t - formStart > FORM_HOLD) releaseForm();
      if (mode === "form") computeForm(); else fNeedle = -1;
      const t0 = performance.now();
      step(dt);
      frame();
      // FPS-Wächter: stuft die Felddichte herunter, falls Frames zu lang werden.
      emaDt = emaDt * 0.9 + (performance.now() - t0) * 0.1;
      if (emaDt > 15) { if (++slowFrames > 12) { degradeField(); slowFrames = 0; } }
      else slowFrames = 0;
      raf = requestAnimationFrame(loop);
    }

    function degradeField() {
      if (degradeLvl === 0) { particles.length = Math.max(120, Math.floor(particles.length * 0.75)); degradeLvl = 1; }
      else if (degradeLvl === 1) { linksOn = false; degradeLvl = 2; }
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
      if (!canvasRect) canvasRect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - canvasRect.left;
      pointer.y = e.clientY - canvasRect.top;
      pointer.active = true;
    }, { passive: true });
    hero.addEventListener("pointerleave", () => { pointer.active = false; });

    // Tap/Klick irgendwo im Hero (außer auf Links/Buttons): die Punkte
    // verbinden sich zur Silhouette des nächsten Kleidungsstücks.
    hero.addEventListener("pointerdown", (e) => {
      if (e.target.closest && e.target.closest("a, button")) return;
      if (!canvasRect) canvasRect = canvas.getBoundingClientRect();
      formGarment(e.clientX - canvasRect.left, e.clientY - canvasRect.top);
    }, { passive: true });

    window.addEventListener("resize", resize, { passive: true });
    // Scroll verschiebt das Canvas relativ zum Viewport → Rect-Cache verwerfen.
    window.addEventListener("scroll", () => { canvasRect = null; }, { passive: true, capture: true });
    // Sprachwechsel und spät ladende Web-Fonts verschieben die Headline-Box —
    // sonst bleibt die Schutzmaske bis zum nächsten Resize auf der alten Position.
    // (Bei reduced-motion das Standbild einmal neu zeichnen; die Maske wirkt
    // nur als Alpha-Feld in frame(), Positionen bleiben unberührt.)
    const remask = () => { computeMask(); if (reduceMotion) frame(); };
    window.addEventListener("language:change", remask);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remask);
    resize();
  }

  /* ── Start ───────────────────────────────────────────────── */

  function init() {
    initStudioReveal();
    initLoader();
    buildManifesto();
    initPivot();
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
    // Hash-Deep-Links (#pivot/#how/#dna=…): Chrome „re-snappt" auf das Fragment,
    // sobald die Pin-Spacer MITTEN im initialen Refresh eingefügt werden (Layout-
    // Shift oberhalb des Ziels). Trigger, die nach dem Snap gemessen werden,
    // rechnen mit veralteter Scroll-Kompensation — ihre starts sind um scrollY
    // verschoben (empirisch: gepinnte Sektion „fertig", bevor man sie erreicht).
    // Ein nachgelagerter Refresh, wenn Sprung + Layout gesetzt sind, misst sauber.
    if (fx && location.hash) {
      const settleRefresh = () => setTimeout(() => ScrollTrigger.refresh(), 300);
      if (document.readyState === "complete") settleRefresh();
      else window.addEventListener("load", settleRefresh, { once: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
