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

    // Effective DNA for the board: the live DNA plus the picks made so far
    // (optionally with one region overridden — ghost try-ons and the picker's
    // close-up thumbnails both build on this). SAME pipeline as the main
    // preview, so the board IS the garment, not an icon of it.
    const effectiveDna = (overrides) => {
      const clone = JSON.parse(JSON.stringify(ctx.dna));
      regions.forEach((rg) => {
        const cid = overrides && overrides[rg.id] !== undefined ? overrides[rg.id] : picks[rg.id];
        const c = cid && (rg.choices || []).find((x) => x.id === cid);
        if (c && c.effects && c.effects.set) {
          Object.entries(c.effects.set).forEach(([p, v]) => window.DesignDNA.set(clone, p, v, 1));
        }
      });
      return clone;
    };
    const boardParams = () => window.DesignPreview.params(effectiveDna());
    // A choice is "current" when EVERY value it would set already equals the
    // effective DNA — decided earlier (subarchetype side-effects), inferred
    // upstream, or picked here. The picker marks it so the user sees what the
    // piece already carries before changing it.
    const isCurrentChoice = (c) => {
      const set = c.effects && c.effects.set;
      if (!set) return false;
      const dna = effectiveDna();
      return Object.entries(set).every(([p, v]) => JSON.stringify(window.DesignDNA.get(dna, p)) === JSON.stringify(v));
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
    // the flat behind them reshapes. They enter staggered, like pins being
    // set into the piece (CSS deSpotIn, fx-gated via the html.fx selector).
    const spots = new Map();
    regions.forEach((rg, i) => {
      const label = (rg.label && rg.label[lang]) || rg.id;
      const spot = V.el("button", { type: "button", class: "de-hotspot", "aria-expanded": "false" });
      spot.style.animationDelay = (140 + i * 50) + "ms";
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

    const anchorOf = (anchors, rg) => anchors[rg.anchor || rg.id] || { x: VB / 2, y: VH * 0.4 };
    // Positions ride EVERY morph frame (cheap: left/top only); the decoration
    // (label side, chosen word, ARIA) updates once per state change with the
    // TARGET anchors so labels never flip sides mid-tween.
    function positionSpots(anchors) {
      spots.forEach(({ rg, spot }) => {
        const a = anchorOf(anchors, rg);
        spot.style.left = (a.x / VB * 100).toFixed(1) + "%";
        spot.style.top = (a.y / VH * 100).toFixed(1) + "%";
      });
    }
    function decorateSpots(anchors) {
      spots.forEach(({ rg, spot, val, label }) => {
        const a = anchorOf(anchors, rg);
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

    // ── Living board: picks (and hover try-ons) MORPH the flat ──────────────
    // Same lerpModel tween as the main preview — the surface the user touches
    // reshapes fluidly, and the hotspots ride the moving geometry. fx-gated;
    // reduced-motion / cross-category snap instantly. 240 ms keeps the
    // project's transition ceiling.
    const fx = () => document.documentElement.classList.contains("fx") &&
      !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let lastA = null, raf = 0; // lastA: target anchors (picker position, glow)
    // What is PAINTED right now — an interrupted tween (hover-ghost → click)
    // retargets from here, so the garment glides through, never jump-cuts.
    let shownM = null, shownA = null;
    const lerpAnchors = (a, b, k) => {
      const out = {};
      Object.keys(b).forEach((key) => {
        const av = a && a[key];
        out[key] = av ? { x: av.x + (b[key].x - av.x) * k, y: av.y + (b[key].y - av.y) * k } : b[key];
      });
      return out;
    };
    function paintParams(p) {
      const G = window.GarmentSVG;
      const toM = G.model(p.category, p);
      const toA = G.regionAnchors(p.category, p);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      decorateSpots(toA);
      if (!fx() || !shownM || shownM.cat !== toM.cat || !G.lerpModel) {
        stage.innerHTML = G.paint ? G.paint(toM) : G.build(p.category, p);
        positionSpots(toA);
        shownM = toM;
        shownA = toA;
      } else {
        const fromM = shownM, fromA = shownA || toA;
        const t0 = performance.now(), D = 240;
        const ease = (x) => 1 - Math.pow(1 - x, 3);
        const step = (now) => {
          if (!stage.isConnected) { raf = 0; return; } // question swapped away
          const k = Math.min(1, (now - t0) / D);
          const m = G.lerpModel(fromM, toM, ease(k));
          const a = lerpAnchors(fromA, toA, ease(k));
          stage.innerHTML = G.paint(m);
          positionSpots(a);
          shownM = m;
          shownA = a;
          raf = k < 1 ? requestAnimationFrame(step) : 0;
        };
        raf = requestAnimationFrame(step);
      }
      lastA = toA;
    }
    // Ghost try-on: hovering/focusing a picker option previews it ON THE BOARD
    // only — no DNA write, no commitment; leaving reverts to the picked state.
    function paintPicked() { paintParams(boardParams()); }
    function paintGhost(rg, choice) {
      paintParams(window.DesignPreview.params(effectiveDna({ [rg.id]: choice.id })));
    }
    // §6 preview reaction: a brief glow blooms on the part a pick just changed.
    function flashRegion(rg) {
      if (!fx() || !lastA) return;
      const a = anchorOf(lastA, rg);
      const glow = V.el("span", { class: "de-region-glow", "aria-hidden": "true" });
      glow.style.left = (a.x / VB * 100).toFixed(1) + "%";
      glow.style.top = (a.y / VH * 100).toFixed(1) + "%";
      board.appendChild(glow);
      setTimeout(() => glow.remove(), 700);
    }
    function repaint() { paintPicked(); }

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
        const optLabel = (c.label && c.label[lang]) || c.id;
        // Atelier-Lupe: every option is a REAL close-up of this detail with
        // the option applied (cropped viewBox around the region's anchor) —
        // touch users see what they choose without hover.
        if (window.GarmentSVG.detailCrop) {
          const tp = window.DesignPreview.params(effectiveDna({ [rg.id]: c.id }));
          const thumb = V.el("span", { class: "de-region-opt-thumb", "aria-hidden": "true" });
          thumb.innerHTML = window.GarmentSVG.detailCrop(tp.category, tp, rg.anchor || rg.id);
          b.appendChild(thumb);
        }
        const lbl = V.el("span", { class: "de-region-opt-label" });
        lbl.textContent = optLabel;
        b.appendChild(lbl);
        // Mark what the piece ALREADY carries (decided upstream or picked):
        // a calm mono chip, announced to AT via the accessible name.
        if (isCurrentChoice(c)) {
          b.classList.add("is-current");
          const cur = V.el("span", { class: "de-region-opt-cur", "aria-hidden": "true" });
          cur.textContent = t("engine.region_current");
          b.appendChild(cur);
          b.setAttribute("aria-label", optLabel + " — " + t("engine.region_current"));
        }
        // Try-on before choosing: pointer-over or keyboard focus previews the
        // option on the board (ghost — nothing committed), leaving reverts.
        // :focus-visible keeps the programmatic focus after a TAP from
        // ghosting option 1 uninvited on touch — only real keyboard focus
        // tries on; hover covers the pointer.
        b.addEventListener("mouseenter", () => paintGhost(rg, c));
        b.addEventListener("focus", () => { try { if (b.matches(":focus-visible")) paintGhost(rg, c); } catch (_e) { /* old engines: no ghost */ } });
        b.addEventListener("mouseleave", paintPicked);
        b.addEventListener("blur", paintPicked);
        b.addEventListener("click", () => {
          picks[rg.id] = c.id;
          ctx.live(Object.assign({}, picks));
          repaint();
          flashRegion(rg);
          const entrySpot = spots.get(rg.id);
          if (entrySpot) {
            entrySpot.spot.classList.remove("is-just-set");
            void entrySpot.spot.offsetWidth;
            entrySpot.spot.classList.add("is-just-set");
          }
          syncConfirmLabel();
          closePicker(true);
        });
        picker.appendChild(b);
      });
      // Anchor the panel to the part: open toward the free side/edge so it
      // stays inside the board (no position:fixed — hijacked in the studio).
      const a = anchorOf(lastA || {}, rg);
      const xPct = a.x / VB * 100, yPct = a.y / VH * 100;
      picker.style.left = xPct < 50 ? Math.max(0, xPct - 8) + "%" : "auto";
      picker.style.right = xPct >= 50 ? Math.max(0, 100 - xPct - 8) + "%" : "auto";
      picker.style.top = yPct < 62 ? (yPct + 8) + "%" : "auto";
      picker.style.bottom = yPct >= 62 ? Math.min(92, 100 - yPct + 6) + "%" : "auto";
      picker.hidden = false;
      picker.classList.remove("is-open");
      void picker.offsetWidth;
      picker.classList.add("is-open");
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
