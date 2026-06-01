/**
 * Urban Revolution — Flair: pointer/scroll micro-interactions + an easter egg.
 *
 * Side-effect module (no global export), in the spirit of animations.js.
 * Everything here is pure progressive enhancement and degrades cleanly:
 *   - The scroll "thread" runs everywhere (a passive progress line).
 *   - Hero pointer tilt + aura run ONLY on a fine pointer (desktop), never on
 *     touch and never when prefers-reduced-motion is set.
 *   - The easter egg never animates under reduced motion.
 */
(function () {
  "use strict";

  const mq = (q) => window.matchMedia && window.matchMedia(q).matches;
  const reduced = mq("(prefers-reduced-motion: reduce)");
  const finePointer = mq("(hover: hover) and (pointer: fine)");
  const isTouch = document.documentElement.classList.contains("is-touch");

  // ── 1. Scroll "thread" — a thin gradient seam that sews itself shut as you
  //    scroll the page. transform:scaleX is cheap (compositor-only). ──
  function initScrollThread() {
    const thread = document.querySelector(".scroll-thread");
    if (!thread) return;
    let ticking = false;
    function update() {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      thread.style.transform = "scaleX(" + p.toFixed(4) + ")";
      ticking = false;
    }
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  // ── 2 + 3. Hero pointer aura + holographic tilt of the photo card ──
  function initHeroPointer() {
    if (reduced || isTouch || !finePointer) return;
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const card = document.querySelector(".hero-asset-picture");
    let raf = 0, mx = 0.5, my = 0.4;

    function apply() {
      raf = 0;
      hero.style.setProperty("--hero-mx", (mx * 100).toFixed(1) + "%");
      hero.style.setProperty("--hero-my", (my * 100).toFixed(1) + "%");
      if (card) {
        card.style.setProperty("--rx", ((mx - 0.5) * 9).toFixed(2) + "deg");  // yaw
        card.style.setProperty("--ry", ((0.5 - my) * 9).toFixed(2) + "deg");  // pitch
      }
    }
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width;
      my = (e.clientY - r.top) / r.height;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener("pointerleave", () => {
      mx = 0.5; my = 0.4;
      if (card) { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); }
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.classList.add("has-pointer-flair"); // unlocks the CSS aura + tilt
  }

  // ── 4. Easter egg — type a brand word in the hero prompt for a neon burst ──
  function initEasterEgg() {
    const input = document.getElementById("hero-prompt-input");
    if (!input) return;
    const WORDS = ["revolution", "atelier", "couture", "zürich", "zurich"];
    let fired = false;
    input.addEventListener("input", () => {
      if (fired) return;
      const v = input.value.toLowerCase();
      if (WORDS.some((w) => v.includes(w))) { fired = true; burst(input); }
    });
  }

  function burst(anchor) {
    if (reduced) return;
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const colors = ["#ec4899", "#8b5cf6", "#06b6d4", "#f9a8d4"];
    const layer = document.createElement("div");
    layer.className = "egg-burst";
    for (let i = 0; i < 28; i++) {
      const s = document.createElement("span");
      const ang = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 130;
      s.style.left = cx + "px";
      s.style.top = cy + "px";
      s.style.background = colors[i % colors.length];
      s.style.setProperty("--tx", (Math.cos(ang) * dist).toFixed(0) + "px");
      s.style.setProperty("--ty", (Math.sin(ang) * dist - 30).toFixed(0) + "px");
      s.style.animationDelay = (Math.random() * 0.09).toFixed(2) + "s";
      layer.appendChild(s);
    }
    document.body.appendChild(layer);

    const msg = document.createElement("div");
    msg.className = "egg-msg";
    msg.textContent = (window.I18N && window.I18N.t("flair.egg")) || "✦ Revolution.";
    document.body.appendChild(msg);

    window.setTimeout(() => { layer.remove(); msg.remove(); }, 1700);
  }

  function init() {
    initScrollThread();
    initHeroPointer();
    initEasterEgg();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
