/**
 * Urban Revolution — Design Engine · Modality "thisOrThat"
 * Two large tappable panels — preference learning. Emits the chosen side id.
 * Tone fallbacks give each side an on-brand mood gradient until real mood
 * photos land. Soft signal: nudges archetype weights (resolved in the flow).
 */
(function () {
  const V = window.DEVisuals;
  const TONE = {
    calm: "linear-gradient(160deg,#15151d,#0b0b0d)",
    soft: "linear-gradient(160deg,#1b1b26,#101016)",
    bold: "linear-gradient(160deg,#6a71d6,#12a37a 55%,#7edc2e)",
    sharp: "linear-gradient(160deg,#232338,#0b0b0d)",
  };

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const row = V.el("div", { class: "de-tot", role: "group" });
    (node.pair || []).forEach((side) => {
      const btn = V.el("button", { type: "button", class: "de-tot-panel" });
      const fallback = V.swatch(TONE[side.id] || "var(--gradient)", "de-swatch-fill");
      btn.appendChild(V.lazyImage(side.image, (side.label && side.label[lang]) || "", fallback));
      const label = V.el("span", { class: "de-tot-label" });
      label.textContent = (side.label && side.label[lang]) || side.id;
      btn.appendChild(label);
      btn.addEventListener("click", () => ctx.commit(side.id));
      row.appendChild(btn);
    });
    host.appendChild(row);
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.thisOrThat = render;
})();
