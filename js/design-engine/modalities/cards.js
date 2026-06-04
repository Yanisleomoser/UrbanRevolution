/**
 * Urban Revolution — Design Engine · Modality "cards"
 * A grid of tappable choice tiles. Category choices show a garment silhouette;
 * others show an on-brand gradient tile. Real photos fade in via lazyImage when
 * the JSON `image` is present.
 *
 * Single-select (default): a tap commits the choice id.
 * Multi-select (`"multi": true`): taps toggle selection, a confirm commits the
 * array of selected ids (brief §5 — "Einzel- oder Mehrfachauswahl").
 */
(function () {
  const V = window.DEVisuals;

  // Subarchetype → distinguishing silhouette hints so each jacket type reads
  // differently in its tile (puffer is voluminous, trench long, blazer notched…).
  const SUBARCH = {
    puffer: { volume: "high", collar: "stand", cuffs: "ribbed", hem: "ribbed" },
    bomber: { length: "cropped", collar: "stand", cuffs: "ribbed", hem: "ribbed" },
    trench: { length: "long", collar: "notched", closure: "button" },
    blazer: { collar: "notched", closure: "button", structure: 0.85 },
    work: { collar: "stand", pockets: "cargo", material: "cotton" },
  };
  // DNA paths (set by a choice's effects) → GarmentSVG params.
  const PARAM = {
    "silhouette.fit": "fit", "silhouette.volume": "volume", "silhouette.structure": "structure",
    "length": "length", "construction.collar": "collar", "construction.sleeve": "sleeve",
    "construction.closure": "closure", "construction.pockets": "pockets",
    "construction.cuffs": "cuffs", "construction.hem": "hem",
    "pattern.type": "pattern", "fabric.material": "material",
  };

  // Build GarmentSVG params from a choice's declared effects so the tile shows
  // the ACTUAL option (e.g. the "hood" tile draws a hooded jacket).
  function paramsFromChoice(choice) {
    const set = (choice.effects && choice.effects.set) || {};
    const p = {};
    let touched = false;
    Object.entries(set).forEach(([k, v]) => { if (PARAM[k] !== undefined) { p[PARAM[k]] = v; touched = true; } });
    if (set.subArchetype && SUBARCH[set.subArchetype]) { Object.assign(p, SUBARCH[set.subArchetype]); touched = true; }
    return { p, touched };
  }

  // A tile that is never a flat colour field: category → line-art silhouette;
  // any jacket-shaping node → a parametric GarmentSVG of that exact option;
  // everything else → the on-brand gradient (a real photo fades over it if the
  // JSON `image` loads).
  function tileFallback(node, choice) {
    if (node.id === "category_select") {
      const w = V.el("div", { class: "de-visual" });
      w.appendChild(V.silhouette(choice.id));
      return w;
    }
    const isJacketNode = typeof node.id === "string" && node.id.indexOf("jacket") === 0;
    const { p, touched } = paramsFromChoice(choice);
    if (window.GarmentSVG && (touched || isJacketNode)) {
      const base = { fit: 0.5, structure: 0.5, volume: "mid", length: "regular", collar: "stand", sleeve: "set-in", closure: "zip", stops: ["#9aa0a8"], material: "cotton" };
      const w = V.el("div", { class: "de-visual de-visual-garment" });
      w.innerHTML = window.GarmentSVG.build("jacket", Object.assign(base, p));
      return w;
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
      btn.appendChild(V.lazyImage(choice.image, (choice.label && choice.label[lang]) || "", tileFallback(node, choice)));
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
