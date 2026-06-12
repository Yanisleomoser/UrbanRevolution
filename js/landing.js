/**
 * Urban Revolution — Landing-Experience-Controller (index.html)
 *
 * Steuert die Marken-Landing oberhalb des UR-Create-Studios:
 * Preloader-Logo-Draw, Hero-Intro + Faden-Partikelfeld, Manifest-Wort-Scrub,
 * gepinnte Kreislauf-Sektion, Zahlen-Count-up, magnetischer Kreis-CTA —
 * und den STUDIO-REVEAL: das Studio (#studio) ist verborgen, bis ein CTA
 * (Anker auf #design/#measure/#production) oder ein Share-/Deep-Link es öffnet.
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

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const fx = hasGsap && !reduceMotion;
  if (fx) {
    document.documentElement.classList.add("fx");
    window.gsap.registerPlugin(window.ScrollTrigger);
  }
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  /* ── Studio-Reveal ───────────────────────────────────────── */

  // Anker, die ins Studio führen (Maße/Produktion liegen im #make-real,
  // das ur-create.js seinerseits aufklappt — hier nur den Wrapper öffnen).
  const STUDIO_ANCHORS = ["design", "ownership", "measure", "production"];

  function revealStudio() {
    const studio = document.getElementById("studio");
    if (!studio || !studio.hidden) return;
    studio.hidden = false;
    // Engine & Co. haben im display:none-Zustand mit 0-Maßen initialisiert —
    // einmal nachmessen lassen, dann die Scroll-Trigger neu rechnen.
    window.dispatchEvent(new Event("resize"));
    if (fx) ScrollTrigger.refresh();
  }

  function initStudioReveal() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      if (STUDIO_ANCHORS.includes((a.getAttribute("href") || "").slice(1))) revealStudio();
    });
    const check = () => {
      const h = location.hash || "";
      // Share-Links (#dna=…) und Studio-Anker öffnen das Studio direkt.
      if (/[#&]dna=/.test(h) || STUDIO_ANCHORS.includes(h.slice(1))) revealStudio();
    };
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

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
        };
      });
    }

    function step(dt) {
      const cx = w / 2, cy = h / 2;
      for (const p of particles) {
        p.angle += p.speed * dt;
        p.wobble += 0.0008 * dt;
        const r = p.baseRadius + Math.sin(p.wobble) * 14;
        p.x = cx + Math.cos(p.angle) * r * 1.25; // leicht elliptisch (Breitbild)
        p.y = cy + Math.sin(p.angle) * r * 0.85;
        if (pointer.active) {
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
      // Verbindungslinien — das „Gewebe"
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
      for (const p of particles) {
        ctx.globalAlpha = 0.7;
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
