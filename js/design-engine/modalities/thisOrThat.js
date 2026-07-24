/**
 * Urban Revolution — Design Engine · Modality "thisOrThat"
 * Two large tappable panels — preference learning. Emits the chosen side id.
 * Tone fallbacks give each side an on-brand mood gradient until real mood
 * photos land. Soft signal: nudges archetype weights (resolved in the flow).
 * Each panel carries a derived "zieht zu …" mono line naming the archetypes
 * its effects actually pull toward — the machine says what a tap means, and
 * the line can never drift from the data because it IS the data.
 */
(function () {
  const V = window.DEVisuals;
  const TONE = {
    calm: "linear-gradient(160deg,#15151d,#0b0b0d)",
    soft: "linear-gradient(160deg,#1b1b26,#101016)",
    bold: "linear-gradient(160deg,#6a71d6,#12a37a 55%,#7edc2e)",
    sharp: "linear-gradient(160deg,#232338,#0b0b0d)",
  };

  // Top-2 archetype labels a side's weights pull toward, strongest first.
  // Pure data → text; returns "" when the side carries no weights.
  function pullLine(side, archetypes, lang) {
    const w = side.effects && side.effects.weight;
    if (!w) return "";
    const names = Object.entries(w)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => {
        const a = (archetypes || []).find((x) => x.id === id);
        return a && a.label ? a.label[lang] || a.label.de : null;
      })
      .filter(Boolean);
    return names.length ? "→ " + names.join(" · ") : "";
  }

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const archetypes = typeof ctx.archetypes === "function" ? ctx.archetypes() : [];
    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const row = V.el("div", { class: "de-tot", role: "group" });
    (node.pair || []).forEach((side) => {
      const btn = V.el("button", { type: "button", class: "de-tot-panel" });
      const fallback = V.swatch(TONE[side.id] || "var(--gradient)", "de-swatch-fill");
      btn.appendChild(V.lazyImage(side.image, (side.label && side.label[lang]) || "", fallback));
      const copy = V.el("span", { class: "de-tot-copy" });
      const label = V.el("span", { class: "de-tot-label" });
      label.textContent = (side.label && side.label[lang]) || side.id;
      copy.appendChild(label);
      const pull = pullLine(side, archetypes, lang);
      if (pull) {
        const hint = V.el("span", { class: "de-tot-hint" });
        hint.textContent = pull;
        copy.appendChild(hint);
      }
      btn.appendChild(copy);
      btn.addEventListener("click", () => ctx.commit(side.id));
      row.appendChild(btn);
    });
    host.appendChild(row);
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.thisOrThat = render;
})();
