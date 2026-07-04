/**
 * Urban Revolution — Flair: pointer micro-interactions.
 *
 * Side-effect module (no global export), in the spirit of animations.js.
 * Pure progressive enhancement: the card spotlight runs ONLY on a fine
 * pointer (desktop), never on touch and never when prefers-reduced-motion
 * is set.
 */
(function () {
  "use strict";

  const mq = (q) => window.matchMedia && window.matchMedia(q).matches;
  const reduced = mq("(prefers-reduced-motion: reduce)");
  const finePointer = mq("(hover: hover) and (pointer: fine)");
  const isTouch = document.documentElement.classList.contains("is-touch");

  // Card spotlight — a soft sheen tracks the cursor across the dark cards
  // (glass-under-light). Desktop / motion only.
  function initCardSpotlight() {
    if (reduced || isTouch || !finePointer) return;
    const cards = document.querySelectorAll(
      ".prompt-panel, .photo-upload-card, .body-diagram"
    );
    cards.forEach((card) => {
      card.classList.add("spotlight");
      const glow = document.createElement("span");
      glow.className = "card-glow";
      glow.setAttribute("aria-hidden", "true");
      card.appendChild(glow);
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  function init() {
    initCardSpotlight();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
