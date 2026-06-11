/**
 * Urban Revolution — Design Engine · Modality "cards"
 * A grid of tappable choice tiles. Category choices show a garment silhouette;
 * every other pick shows a precise technical flat of ITSELF — the current
 * design with this one option applied (same pipeline as the live preview), so
 * no pick is ever a blank gradient. Real photos fade in via lazyImage when the
 * JSON `image` is present.
 *
 * Single-select (default): a tap commits the choice id.
 * Multi-select (`"multi": true`): taps toggle selection, a confirm commits the
 * array of selected ids (brief §5 — "Einzel- oder Mehrfachauswahl").
 */
(function () {
  const V = window.DEVisuals;

  // A tile that is never a flat colour field: the category pivot → a line-art
  // silhouette; every other pick → a parametric GarmentSVG of the CURRENT
  // garment with this choice's effects applied (cloned DNA → real params →
  // flat, identical to the live preview / refine tiles, so the option reads as
  // a precise flat in the right category instead of a gradient placeholder).
  function tileFallback(node, choice, ctx) {
    if (node.id === "category_select") {
      const w = V.el("div", { class: "de-visual" });
      w.appendChild(V.silhouette(choice.id));
      return w;
    }
    if (window.GarmentSVG && window.DesignPreview && window.DesignDNA && ctx && ctx.dna) {
      try {
        const clone = JSON.parse(JSON.stringify(ctx.dna));
        const set = (choice.effects && choice.effects.set) || {};
        Object.entries(set).forEach(([path, val]) => window.DesignDNA.set(clone, path, val, 1));
        const p = window.DesignPreview.params(clone);
        if (p.category) {
          const w = V.el("div", { class: "de-visual de-visual-garment" });
          w.innerHTML = window.GarmentSVG.build(p.category, p);
          return w;
        }
      } catch (_e) { /* fall through to the gradient tile */ }
    }
    return V.swatch("var(--gradient)", "de-swatch-soft");
  }

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const multi = !!node.multi;
    const selected = new Set();

    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    let confirm = null;
    const grid = V.el("div", { class: "de-cards", role: multi ? "group" : "group" });
    (node.choices || []).forEach((choice) => {
      const btn = V.el("button", { type: "button", class: "de-card" });
      if (multi) btn.setAttribute("aria-pressed", "false");
      btn.appendChild(V.lazyImage(choice.image, (choice.label && choice.label[lang]) || "", tileFallback(node, choice, ctx)));
      const label = V.el("span", { class: "de-card-label" });
      label.textContent = (choice.label && choice.label[lang]) || choice.id;
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        if (!multi) { ctx.commit(choice.id); return; }
        if (selected.has(choice.id)) { selected.delete(choice.id); btn.classList.remove("is-selected"); btn.setAttribute("aria-pressed", "false"); }
        else { selected.add(choice.id); btn.classList.add("is-selected"); btn.setAttribute("aria-pressed", "true"); }
        if (confirm) confirm.disabled = selected.size === 0;
      });
      grid.appendChild(btn);
    });
    host.appendChild(grid);

    if (multi) {
      confirm = V.el("button", { type: "button", class: "de-confirm" });
      confirm.textContent = ctx.t("engine.confirm");
      confirm.disabled = true;
      confirm.addEventListener("click", () => ctx.commit([...selected]));
      host.appendChild(confirm);
    }
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.cards = render;
})();
