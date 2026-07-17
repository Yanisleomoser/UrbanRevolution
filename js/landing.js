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
    // ScrollTrigger re-measures on it and pinned sections visibly jump
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
  // unter #pivot-/#machine-Deep-Links, headless UND real). Während des Ladens auf
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
    if (!studio) return;
    // First reveal only: un-hide + one-time hydrate/relayout. A re-click of a
    // studio CTA when the studio is ALREADY open must skip this block but still
    // fall through to the focus/scroll below — otherwise the button dead-ends
    // (the click handler preventDefault()s the native jump, and the old early
    // `return` here meant a second click took you nowhere; leaving the studio
    // and tapping „UR Create starten" again looked inactive).
    if (studio.hidden) {
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
    }
    // A11y (WCAG 2.4.3) + „bring me (back) to the studio": runs on EVERY call.
    // A keyboard user activating a studio CTA (an <a href="#design"> etc.)
    // triggers native fragment-focus while #studio may still be display:none (or
    // scrolled far off-screen), so focus falls to <body>. Move focus into the
    // section the user asked for so Tab continues logically, SR users hear the
    // region — and, since the click handler suppresses the native jump, this
    // focus is what actually scrolls the studio back into view. Pick the
    // requested anchor when it's the visible one; otherwise fall back to the
    // studio's first section (#design). Guard the selector: the hash may be
    // empty or a share link (#dna=…), which are not valid id selectors.
    const h = location.hash;
    let target = /^#[\w-]+$/.test(h) ? document.getElementById(h.slice(1)) : null;
    if (!target || target.offsetParent === null) target = document.getElementById("design");
    if (target) {
      target.setAttribute("tabindex", "-1");
      // A11y focus (WCAG 2.4.3) — but with preventScroll: WE own the scroll.
      // A focus- or fragment-driven scroll here fires while the just-un-hidden
      // studio's ScrollTrigger pin-spacers are still settling, and lands the
      // section behind the sticky navbar (measured: heading top = −65px, clipped
      // ~154px). scrollIntoView({block:"start"}) honours the section's
      // scroll-margin-top (the navbar offset — a single source in CSS, not a JS
      // magic number); re-asserting on the next frames lets a late pin recalc
      // resolve to the same, correct rest position instead of a clipped one.
      target.focus({ preventScroll: true });
      const align = () => target.scrollIntoView({ block: "start", behavior: "auto" });
      align();
      requestAnimationFrame(() => requestAnimationFrame(align));
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
      // No portal (reduced-motion / no GSAP / already open): revealStudio()
      // reads location.hash synchronously to pick its focus target, but the
      // native fragment navigation for this click hasn't happened yet — it
      // only runs after this handler returns. Set the hash ourselves first
      // (mirrors portalReveal's phase2) so the correct anchor gets focus
      // instead of always falling back to #design (WCAG 2.4.3).
      if (!modified) {
        e.preventDefault();
        if (href && location.hash !== href) location.hash = href;
      }
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
      // Die Faden-Spitze (aus dem Preloader übergeben) setzt sich als Ruhe-Knoten.
      .from(".lp-linie-tip", { opacity: 0, duration: 0.9 }, 0.2)
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
    const thread = loader.querySelector(".lp-loader-thread");
    const len = arc.getTotalLength();
    gsap.set(arc, { strokeDasharray: len, strokeDashoffset: len });
    if (thread) gsap.set(thread, { scaleY: 0 });
    const tl = gsap.timeline({ onComplete: done });
    tl.to(arc, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" }, 0)
      .from(needle, { opacity: 0, y: -14, duration: 0.5, ease: "power2.out" }, 0.25)
      .from(dashes, { opacity: 0, duration: 0.4 }, 0.55);
    // Die Nadel zieht die eine Linie: der Faden wird nach unten gezeichnet
    // (scaleY 0→1) — er überlebt den Loader und wird an den Hero übergeben.
    if (thread) tl.to(thread, { scaleY: 1, duration: 0.6, ease: "power2.inOut" }, 0.72);
    // Die Marke tritt zurück; der gezogene Faden bleibt (verblasst erst mit dem Loader).
    tl.to(loader.querySelector(".lp-mark"), { scale: 0.92, opacity: 0, duration: 0.4, ease: "power2.in" }, 1.3);
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
      // A11y floor (R5): a real (non-reduced-motion) reader must never see the
      // thesis dim below WCAG-AA contrast. The words are #eef4f8 on the midnight
      // bg at ≥26px (large text → 3:1 threshold); opacity 0.42 keeps the dimmest,
      // just-entered word at ≈3.6:1. The old 0.13 looked filmic but composited to
      // 1.41:1 — 27 serious axe nodes, the thesis literally unreadable mid-scrub.
      // 0.42 → 1 still reads as a clear "words light up as you read" reveal.
      { opacity: 0.42 },
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

  /* ── Verben-Band: drei Stationen auf der Linie ────────────── */

  // Fädelt den i18n-String „Produzieren — Tragen — Wegwerfen" (DE/EN, beide mit
  // „ — ") zu drei Knoten-Stationen auf dem Gossen-Faden auf. Rein additiv,
  // datengetrieben aus EINEM Key. Nach jedem I18N.apply() steht wieder der reine
  // String → neu auffädeln (wie buildManifesto). Ohne diese Funktion bleibt die
  // Mono-Zeile als vollständiger Ruhezustand stehen (Progressive Enhancement).
  function buildVerbs() {
    const el = document.getElementById("manifesto-verbs");
    if (!el) return;
    const parts = el.textContent.split(/\s*—\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) { el.classList.remove("is-stationed"); return; }
    el.textContent = "";
    parts.forEach((label, i) => {
      const item = document.createElement("span");
      item.className = "lp-verb";
      const knot = document.createElement("span");
      knot.className = "lp-verb-knot";
      knot.setAttribute("aria-hidden", "true");
      const idx = document.createElement("span");
      idx.className = "lp-verb-index";
      idx.setAttribute("aria-hidden", "true");
      idx.textContent = "0" + (i + 1);
      const lab = document.createElement("span");
      lab.className = "lp-verb-label";
      lab.textContent = label;
      item.append(knot, idx, lab);
      el.appendChild(item);
    });
    el.classList.add("is-stationed");
  }

  /* ── Akt I: die eine Linie zeichnet sich ein (fx) ─────────── */

  // Manifest-Faden + Übergabe-Naht scrubben beim Scrollen von oben nach unten
  // (scaleY 0→1, transform-origin top). Ruhezustand (kein fx) = CSS-Default
  // (fertig gezeichnet). Muster wie initPivot: !fx → sofort raus.
  function initActOneThread() {
    if (!fx) return;
    const mani = document.querySelector(".lp-linie--mani .lp-linie-rail");
    if (mani) {
      gsap.fromTo(mani, { scaleY: 0 }, {
        scaleY: 1, ease: "none",
        scrollTrigger: { trigger: "#manifesto", start: "top 82%", end: "bottom 55%", scrub: 0.5 },
      });
    }
    // Übergabe-Naht: Clip-Reveal von oben nach unten (wie fil-seam — dash-offset
    // bricht bei nicht-uniformer SVG-Streckung; ein inset-Clip zeichnet sauber).
    const seamSvg = document.querySelector(".lp-linie-seam-svg");
    const seamKnot = document.querySelector(".lp-linie-seam-knot");
    const seamEl = document.querySelector(".lp-linie-seam");
    if (seamSvg && seamEl) {
      gsap.fromTo(seamSvg, { clipPath: "inset(0% 0% 100% 0%)" }, {
        clipPath: "inset(0% 0% 0% 0%)", ease: "none",
        scrollTrigger: { trigger: seamEl, start: "top 96%", end: "bottom 80%", scrub: 0.5 },
      });
      if (seamKnot) {
        gsap.fromTo(seamKnot, { opacity: 0, scale: 0.4 }, {
          opacity: 1, scale: 1, ease: "power2.out",
          scrollTrigger: { trigger: seamEl, start: "bottom 86%", toggleActions: "play none none reverse" },
        });
      }
    }
  }

  /* ── Die Wende (#pivot): die Linie biegt sich zum Kreis ──── */

  // Gepinnter Scrub: pro Frame wird EIN
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
    // Die eine Faser aus #facts (der entkommene Tracer): ein Kometenkopf,
    // der auf der Spitze des sich biegenden Pfads reitet — SIE biegt die
    // Linie zum Kreis. Optional (fehlt das Element, läuft der Scrub wie zuvor).
    const comet = document.getElementById("pivot-comet");
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
        if (comet) {
          // Pfad-Ende = die wandernde Spitze: sie startet oben (wo die Faser
          // aus #facts ankommt), zieht die Linie einmal im Uhrzeigersinn
          // herum und ruht am Ende an der Naht, wo sich der Kreis schliesst.
          const tip = arc.getPointAtLength(arc.getTotalLength());
          comet.setAttribute("transform", "translate(" + tip.x.toFixed(1) + " " + tip.y.toFixed(1) + ")");
        }
      }
      line.style.opacity = String(1 - bend);
      arc.style.opacity = String(bend);
      // Die Faser blendet früh ein: seit die Bühnen-SVG overflow:visible
      // trägt (Ein-/Auslauffäden), rendert die Pfad-Spitze auch OBERHALB der
      // viewBox — die Faser erscheint in der Naht-Zone über der Bühne (aus
      // Richtung #facts) und zieht von dort die Linie krumm. Auf ROHEM
      // Pin-Fortschritt p gekeyt (bend ist kubisch geeast → bend-Schwellen
      // liegen spät); Start 0.13: darunter springt die Pfad-Spitze noch
      // diskontinuierlich von unten nach oben (gemessen p 0.08 → 0.12).
      // Vorher: Fade ab bend 0.14 ≈ p 0.33 — die Faser fehlte im ersten
      // Drittel des Pins.
      if (comet) comet.style.opacity = String(clamp01((p - 0.13) / 0.10));
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
      // kurz und entschieden — kein zweiter Marathon-Pin vor der Maschine
      end: () => (window.matchMedia("(max-width: 700px)").matches ? "+=110%" : "+=130%"),
      pin: true,
      scrub: true,
      onUpdate: (self) => setPivot(self.progress),
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

  /* ── Start ───────────────────────────────────────────────── */

  function init() {
    initStudioReveal();
    initLoader();
    buildManifesto();
    buildVerbs();
    initActOneThread();
    initPivot();
    initReveals();
    initCounters();
    initOrb();
    // Sprachwechsel (app.js bedient den Toggle): Manifest-Spans + Verben-Stationen neu aufbauen.
    window.addEventListener("language:change", () => {
      buildManifesto();
      buildVerbs();
      if (fx) ScrollTrigger.refresh();
    });
    // Nach dem Font-Swap verschieben sich Layout-Höhen — Trigger neu messen.
    if (fx && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    // Hash-Deep-Links (#pivot/#machine/#dna=…): Chrome „re-snappt" auf das Fragment,
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
