/**
 * Urban Revolution — Design Engine · Modality "regions" (Detail-Atelier)
 *
 * One screen instead of six near-identical card grids (roadmap §7): the flat
 * large in the centre, a tappable hotspot on every construction region
 * (collar, closure, sleeve, pockets, cuffs, hem, waistband …), each opening a
 * small micro-picker anchored to the part. Picks apply LIVE (ctx.live → the
 * main preview + dock morph, conf 0) and accumulate; one confirm commits the
 * merged effects ({ regionId: choiceId } payload → flow.resolveEffects).
 * Untouched regions stay open on purpose — inference fills them, that's the
 * compression. Direct manipulation of the garment, keyboard-first:
 * hotspots are ordinary buttons in JSON order, the picker is inserted right
 * after its hotspot in the DOM (Tab flows hotspot → options → next hotspot),
 * Escape closes and refocuses. Region visibility honours a per-region `when`
 * (same DesignCondition grammar as node gates).
 */
(function () {
  const V = window.DEVisuals;
  const VB = 240, VH = 340; // GarmentSVG viewBox — anchors map to % of the stage

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const t = ctx.t;
    const picks = {};

    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);
    const hint = V.el("p", { class: "de-regions-hint" });
    hint.textContent = t("engine.regions_hint");
    host.appendChild(hint);

    // Only regions whose gate passes (e.g. a blazer never asks for a closure).
    const regions = (node.regions || []).filter((rg) =>
      !window.DesignCondition || window.DesignCondition.evaluate(rg.when, ctx.dna));

    // Current garment params for the board flat: the live DNA plus the picks
    // made so far — the SAME pipeline as the main preview, so the board IS the
    // garment, not an icon of it.
    const boardParams = () => {
      const clone = JSON.parse(JSON.stringify(ctx.dna));
      regions.forEach((rg) => {
        const c = picks[rg.id] && (rg.choices || []).find((x) => x.id === picks[rg.id]);
        if (c && c.effects && c.effects.set) {
          Object.entries(c.effects.set).forEach(([p, v]) => window.DesignDNA.set(clone, p, v, 1));
        }
      });
      return window.DesignPreview.params(clone);
    };

    const canBoard = !!(window.GarmentSVG && window.DesignPreview && window.DesignDNA &&
      window.DesignDNA.get(ctx.dna, "category"));

    // ── Fallback (no renderer / no category): plain grouped pickers ─────────
    // Fully functional without the visual board — every region as a labelled
    // pill group. Same picks/commit path.
    if (!canBoard) {
      const list = V.el("div", { class: "de-regions-list", role: "group" });
      regions.forEach((rg) => {
        const grp = V.el("div", { class: "de-region-group" });
        const h = V.el("p", { class: "de-region-picker-h" });
        h.textContent = (rg.label && rg.label[lang]) || rg.id;
        grp.appendChild(h);
        (rg.choices || []).forEach((c) => {
          const b = V.el("button", { type: "button", class: "de-region-opt", "aria-pressed": "false" });
          b.textContent = (c.label && c.label[lang]) || c.id;
          b.addEventListener("click", () => {
            picks[rg.id] = c.id;
            grp.querySelectorAll(".de-region-opt").forEach((o) => o.setAttribute("aria-pressed", o === b ? "true" : "false"));
            ctx.live(Object.assign({}, picks));
            syncConfirm();
          });
          grp.appendChild(b);
        });
        list.appendChild(grp);
      });
      host.appendChild(list);
      const confirmPlain = V.el("button", { type: "button", class: "de-confirm de-regions-confirm" });
      const syncConfirm = () => { confirmPlain.textContent = Object.keys(picks).length ? t("engine.confirm") : t("engine.regions_accept"); };
      syncConfirm();
      confirmPlain.addEventListener("click", () => ctx.commit(Object.assign({}, picks)));
      host.appendChild(confirmPlain);
      return;
    }

    // ── The board: flat + hotspots + one roaming micro-picker ───────────────
    const board = V.el("div", { class: "de-regions" });
    const stage = V.el("div", { class: "de-regions-stage", "aria-hidden": "true" });
    board.appendChild(stage);

    const picker = V.el("div", { class: "de-region-picker", role: "group" });
    picker.hidden = true;
    let openRegion = null;

    const chosenLabel = (rg) => {
      const c = picks[rg.id] && (rg.choices || []).find((x) => x.id === picks[rg.id]);
      return c && c.label ? c.label[lang] : null;
    };

    // Hotspot buttons are created ONCE and repositioned on every repaint —
    // stable elements keep focus, tap handling and test handles valid while
    // the flat behind them reshapes.
    const spots = new Map();
    regions.forEach((rg) => {
      const label = (rg.label && rg.label[lang]) || rg.id;
      const spot = V.el("button", { type: "button", class: "de-hotspot", "aria-expanded": "false" });
      spot.appendChild(V.el("span", { class: "de-hotspot-dot", "aria-hidden": "true" }));
      const tag = V.el("span", { class: "de-hotspot-tag", "aria-hidden": "true" });
      tag.textContent = label;
      spot.appendChild(tag);
      const val = V.el("span", { class: "de-hotspot-val", "aria-hidden": "true" });
      spot.appendChild(val);
      spot.addEventListener("click", () => {
        if (openRegion === rg) closePicker(false);
        else openPicker(rg);
      });
      spots.set(rg.id, { rg, spot, tag, val, label });
      board.appendChild(spot);
    });

    function syncSpots(anchors) {
      spots.forEach(({ rg, spot, val, label }) => {
        const a = anchors[rg.anchor || rg.id] || { x: VB / 2, y: VH * 0.4 };
        spot.style.left = (a.x / VB * 100).toFixed(1) + "%";
        spot.style.top = (a.y / VH * 100).toFixed(1) + "%";
        // Tags flow away from the garment's centre line (left spot → label
        // left, right spot → label right, centre → below) so neighbouring
        // labels never pile up mid-body.
        spot.dataset.side = a.x < VB / 2 - 12 ? "l" : a.x > VB / 2 + 12 ? "r" : "b";
        const chosen = chosenLabel(rg);
        spot.classList.toggle("is-set", !!chosen);
        val.textContent = chosen || "";
        spot.setAttribute("aria-label", label + ": " + (chosen || t("engine.region_unset")));
      });
    }

    function repaint() {
      const p = boardParams();
      stage.innerHTML = window.GarmentSVG.build(p.category, p);
      syncSpots(window.GarmentSVG.regionAnchors(p.category, p));
    }

    function closePicker(refocus) {
      if (openRegion === null) return;
      const entry = spots.get(openRegion.id);
      picker.hidden = true;
      openRegion = null;
      if (entry) {
        entry.spot.setAttribute("aria-expanded", "false");
        if (refocus) entry.spot.focus();
      }
    }

    function openPicker(rg) {
      closePicker(false);
      openRegion = rg;
      const entry = spots.get(rg.id);
      entry.spot.setAttribute("aria-expanded", "true");
      picker.textContent = "";
      picker.setAttribute("aria-label", entry.label);
      const head = V.el("div", { class: "de-region-picker-head" });
      const h = V.el("p", { class: "de-region-picker-h" });
      h.textContent = entry.label;
      head.appendChild(h);
      const close = V.el("button", { type: "button", class: "de-region-close", "aria-label": t("engine.region_close") });
      close.textContent = "✕";
      close.addEventListener("click", () => closePicker(true));
      head.appendChild(close);
      picker.appendChild(head);
      (rg.choices || []).forEach((c) => {
        const b = V.el("button", { type: "button", class: "de-region-opt" });
        b.setAttribute("aria-pressed", picks[rg.id] === c.id ? "true" : "false");
        b.textContent = (c.label && c.label[lang]) || c.id;
        b.addEventListener("click", () => {
          picks[rg.id] = c.id;
          ctx.live(Object.assign({}, picks));
          repaint();
          syncConfirmLabel();
          closePicker(true);
        });
        picker.appendChild(b);
      });
      // Anchor the panel to the part: open toward the free side/edge so it
      // stays inside the board (no position:fixed — hijacked in the studio).
      const bp = boardParams();
      const a = window.GarmentSVG.regionAnchors(bp.category, bp)[rg.anchor || rg.id] || { x: VB / 2, y: VH * 0.4 };
      const xPct = a.x / VB * 100, yPct = a.y / VH * 100;
      picker.style.left = xPct < 50 ? Math.max(0, xPct - 8) + "%" : "auto";
      picker.style.right = xPct >= 50 ? Math.max(0, 100 - xPct - 8) + "%" : "auto";
      picker.style.top = yPct < 62 ? (yPct + 8) + "%" : "auto";
      picker.style.bottom = yPct >= 62 ? Math.min(92, 100 - yPct + 6) + "%" : "auto";
      picker.hidden = false;
      // DOM position right after the hotspot: Tab order = hotspot → options.
      entry.spot.after(picker);
      const first = picker.querySelector('[aria-pressed="true"]') || picker.querySelector(".de-region-opt");
      if (first) first.focus();
    }

    board.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openRegion) { e.stopPropagation(); closePicker(true); }
    });
    // A tap on the bare stage (not a hotspot, not the picker) closes the panel.
    board.addEventListener("click", (e) => {
      if (openRegion && !picker.contains(e.target) && !e.target.closest(".de-hotspot")) closePicker(false);
    });

    host.appendChild(board);

    const confirm = V.el("button", { type: "button", class: "de-confirm de-regions-confirm" });
    const syncConfirmLabel = () => {
      confirm.textContent = Object.keys(picks).length ? t("engine.confirm") : t("engine.regions_accept");
    };
    syncConfirmLabel();
    confirm.addEventListener("click", () => ctx.commit(Object.assign({}, picks)));
    host.appendChild(confirm);

    repaint();
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.regions = render;
})();
