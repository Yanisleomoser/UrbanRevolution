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
    // Hydrate deferred studio images (e.g. the 245 KB measurement figure): they
    // live in the hidden studio but an SVG <image>/<img> still downloads eagerly
    // on first paint. Carrying the src on data-href keeps them off the landing's
    // critical path; load them now that the studio is open — well ahead of the
    // step that shows them.
    studio.querySelectorAll("[data-href]").forEach((el) => {
      el.setAttribute("href", el.getAttribute("data-href"));
      el.removeAttribute("data-href");
    });
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
    const GARMENTS = [
      { key: "tshirt", chains: [{ closed: true, pts: [[16, 16], [24, 8], [40, 8], [48, 16], [56, 22], [48, 30], [48, 56], [16, 56], [16, 30], [8, 22]] }] },
      { key: "hoodie", chains: [{ closed: true, pts: [[20, 14], [32, 6], [44, 14], [52, 22], [58, 28], [50, 34], [50, 58], [14, 58], [14, 34], [6, 28], [12, 22]] }] },
      { key: "pants", chains: [{ closed: true, pts: [[16, 8], [48, 8], [46, 32], [44, 58], [34, 58], [32, 34], [30, 58], [20, 58], [18, 32]] }] },
      {
        key: "jacket",
        chains: [
          { closed: true, pts: [[16, 14], [24, 8], [40, 8], [48, 14], [56, 22], [50, 28], [50, 58], [14, 58], [14, 28], [8, 22]] },
          { closed: false, pts: [[32, 10], [32, 58]] },
        ],
      },
      { key: "dress", chains: [{ closed: true, pts: [[22, 12], [28, 8], [36, 8], [42, 12], [40, 24], [52, 58], [12, 58], [24, 24]] }] },
      {
        key: "shirt",
        chains: [
          { closed: true, pts: [[18, 14], [28, 8], [36, 8], [46, 14], [54, 22], [48, 28], [48, 56], [16, 56], [16, 28], [10, 22]] },
          { closed: false, pts: [[28, 8], [32, 16], [36, 8]] },
        ],
      },
    ];
    let mode = "drift";          // "drift" | "form"
    let garmentIdx = -1;         // zykliert pro Tap durchs Sortiment
    let formStart = 0;
    let formChains = [];         // [[Partikel, …], …] in Kontur-Reihenfolge
    let formLabel = "";
    let formCenter = { x: 0, y: 0, s: 0 };
    const FORM_HOLD = 4200;      // ms bis zur Auflösung

    // Polylinie gleichmäßig in n Punkte zerlegen (für die Punkt-Kontur).
    function resample(pts, closed, n) {
      const P = closed ? pts.concat([pts[0]]) : pts;
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

    function formGarment(tapX, tapY) {
      if (reduceMotion || !particles.length) return;
      garmentIdx = (garmentIdx + 1) % GARMENTS.length;
      const g = GARMENTS[garmentIdx];

      // Größe + Position: am Tap zentriert, aber vollständig im Canvas.
      const s = Math.max(170, Math.min(0.52 * Math.min(w, h), 380));
      const cx = Math.min(Math.max(tapX, s / 2 + 24), w - s / 2 - 24);
      const cy = Math.min(Math.max(tapY, s / 2 + 24), h - s / 2 - 24);
      formCenter = { x: cx, y: cy, s };
      formLabel = window.I18N ? window.I18N.t("type." + g.key) : g.key;

      // Punkte-Budget proportional zur Konturlänge auf die Ketten verteilen.
      const budget = Math.min(particles.length - 4, 96);
      const lens = g.chains.map((c) => {
        const P = c.closed ? c.pts.concat([c.pts[0]]) : c.pts;
        let L = 0;
        for (let i = 0; i < P.length - 1; i++) L += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
        return L;
      });
      const totalLen = lens.reduce((a, b) => a + b, 0);

      const free = particles.slice();
      formChains = g.chains.map((chain, ci) => {
        const n = Math.max(chain.closed ? 12 : 4, Math.round(budget * (lens[ci] / totalLen)));
        const targets = resample(chain.pts, chain.closed, n);
        const assigned = [];
        for (const [gx, gy] of targets) {
          if (!free.length) break;
          const tx = cx + (gx - 32) * (s / 64);
          const ty = cy + (gy - 32) * (s / 64);
          // Greedy: nächstes freies Partikel — kurze, ruhige Flugwege.
          let best = 0, bestD = Infinity;
          for (let i = 0; i < free.length; i++) {
            const d = (free[i].x - tx) ** 2 + (free[i].y - ty) ** 2;
            if (d < bestD) { bestD = d; best = i; }
          }
          const p = free.splice(best, 1)[0];
          p.tx = tx;
          p.ty = ty;
          p.forming = true;
          assigned.push(p);
        }
        return { closed: chain.closed, parts: assigned };
      });
      free.forEach((p) => { p.forming = false; });
      mode = "form";
      formStart = performance.now();
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
          size: 1 + Math.random() * 1.8,
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
      // Verbindungslinien — das ambient „Gewebe"
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
      // Kontur: die Punkte der Reihe nach verbinden — „die Fäden nähen"
      if (mode === "form" && formChains.length) {
        const e = performance.now() - formStart;
        const reveal = Math.min(1, Math.max(0, (e - 260) / 700)); // Naht zieht sich zu
        const fade = Math.min(1, Math.max(0, (FORM_HOLD - e) / 350));
        const alpha = reveal * fade;
        if (alpha > 0.01) {
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = `rgba(100, 214, 196, ${(0.55 * alpha).toFixed(3)})`;
          for (const chain of formChains) {
            const pts = chain.parts;
            const upto = Math.max(2, Math.ceil(pts.length * reveal));
            ctx.beginPath();
            for (let i = 0; i < upto && i < pts.length; i++) {
              if (i === 0) ctx.moveTo(pts[0].x, pts[0].y);
              else ctx.lineTo(pts[i].x, pts[i].y);
            }
            if (chain.closed && reveal >= 1) ctx.closePath();
            ctx.stroke();
          }
          // Name des Stücks unter der Silhouette
          ctx.font = "500 12px Poppins, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(159, 182, 198, ${(0.9 * alpha).toFixed(3)})`;
          ctx.fillText(formLabel.toUpperCase(), formCenter.x, formCenter.y + formCenter.s / 2 + 26);
        }
      }
      for (const p of particles) {
        ctx.globalAlpha = p.forming ? 0.95 : 0.7;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
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
