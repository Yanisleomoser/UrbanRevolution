/**
 * Urban Revolution — Design Engine · Modality "gallery"
 * Die STARTPUNKT-Galerie (Roadmap B4): direkt nach der Kategorie zeigt die
 * Engine mehrere vollständig aufgelöste Stücke — je eine Archetyp-Richtung,
 * gereiht nach dem Stilvektor des Nutzers.
 *
 * Zwei Dinge, die diese Modalität NICHT ist, und die den Ton bestimmen:
 * — Sie ist kein Katalog. Jede Kachel ist eine Auflösung DEINER bisherigen
 *   Entscheidungen, kein fertiges Produkt. Die Kopfzeile sagt das, und der
 *   „von null"-Weg steht gleichberechtigt daneben.
 * — Sie spart keine Fragen. Der Tipp übernimmt bei conf 0.55 (siehe
 *   resolveEffects) — knapp über der Entscheidungs-Schwelle, weit unter
 *   protectExplicit: die Reise stellt danach dieselben echten Fragen, und
 *   jede Antwort überschreibt den Startpunkt.
 *
 * Die Flats kommen aus derselben Pipeline wie die Refine-Kacheln
 * (DesignPreview.params → GarmentSVG.build) — kein zweiter Renderweg.
 */
(function () {
  const V = window.DEVisuals;

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;

    const q = V.el("h2", { class: "de-question", id: "de-gallery-q" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const hint = V.el("p", { class: "de-gallery-hint" });
    hint.textContent = ctx.t("engine.gallery_hint");
    host.appendChild(hint);

    const points = typeof ctx.startingPoints === "function" ? ctx.startingPoints(6) : [];
    // Ohne auflösbare Richtungen (kein Archetyp-Content) hat die Galerie nichts
    // zu zeigen — dann ist der stille Weg der einzige, und das ist ehrlicher
    // als ein leeres Raster.
    if (!points.length) {
      const only = V.el("button", { type: "button", class: "de-gallery-skip" });
      only.textContent = ctx.t("engine.gallery_scratch");
      only.addEventListener("click", () => ctx.commit(null));
      host.appendChild(only);
      return;
    }

    const grid = V.el("div", { class: "de-gallery", role: "group", "aria-labelledby": "de-gallery-q" });
    points.forEach((p) => {
      const tile = V.el("button", {
        type: "button",
        class: "de-gallery-tile",
        // A11y: der Name der Kachel ist die Richtung, nicht „Bild".
        "aria-label": ctx.t("engine.gallery_pick_aria", { name: p.label }),
      });
      const stage = V.el("span", { class: "de-gallery-stage", "aria-hidden": "true" });
      if (window.GarmentSVG && window.DesignPreview) {
        const params = window.DesignPreview.params(p.dna);
        stage.innerHTML = window.GarmentSVG.build(params.category || "tshirt", params);
      }
      const name = V.el("span", { class: "de-gallery-name", "aria-hidden": "true" });
      name.textContent = p.label;
      tile.appendChild(stage);
      tile.appendChild(name);
      // Live-Vorschau auf der Bühne, solange der Zeiger/Fokus auf der Kachel
      // liegt: dieselbe Geste wie beim Stoff — sehen, bevor man wählt.
      const preview = () => ctx.live && ctx.live(p.payload);
      tile.addEventListener("focus", preview);
      tile.addEventListener("click", () => ctx.commit(p.payload));
      grid.appendChild(tile);
    });
    host.appendChild(grid);

    // „Von null" bleibt ein gleichwertiger Weg, kein Kleingedrucktes.
    const skip = V.el("button", { type: "button", class: "de-gallery-skip" });
    skip.textContent = ctx.t("engine.gallery_scratch");
    skip.addEventListener("click", () => ctx.commit(null));
    host.appendChild(skip);
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.gallery = render;
})();
