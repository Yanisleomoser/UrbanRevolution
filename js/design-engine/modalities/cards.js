/**
 * Urban Revolution — Design Engine · Modality "cards"
 * A grid of tappable choice tiles. Category choices show a garment silhouette;
 * others show an on-brand gradient tile. Real photos fade in via lazyImage when
 * the JSON `image` is present. Emits choice.id to the flow.
 */
(function () {
  const V = window.DEVisuals;

  function tileFallback(node, choice) {
    if (node.id === "category_select") {
      const w = V.el("div", { class: "de-visual" });
      w.appendChild(V.silhouette(choice.id));
      return w;
    }
    return V.swatch("var(--gradient)", "de-swatch-soft");
  }

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const grid = V.el("div", { class: "de-cards", role: "group" });
    (node.choices || []).forEach((choice) => {
      const btn = V.el("button", { type: "button", class: "de-card" });
      btn.appendChild(V.lazyImage(choice.image, (choice.label && choice.label[lang]) || "", tileFallback(node, choice)));
      const label = V.el("span", { class: "de-card-label" });
      label.textContent = (choice.label && choice.label[lang]) || choice.id;
      btn.appendChild(label);
      btn.addEventListener("click", () => ctx.commit(choice.id));
      grid.appendChild(btn);
    });
    host.appendChild(grid);
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.cards = render;
})();
