/**
 * Urban Revolution — Design Engine · Modality "colorGradient"
 * Das Farb-Atelier (roadmap §6): benannte Stoff-Chips statt roher Farbpunkte,
 * Scheme-Toggle (Uni / Verlauf; duo nimmt zwei Stops in Tipp-Reihenfolge).
 * Es gibt KEIN totes Vorschau-Rechteck — das Kleidungsstück auf der Bühne IST
 * die Vorschau: jeder Tap färbt den Flat live über ctx.live. Commits
 * { scheme, stops, value, saturation }.
 */
(function () {
  const V = window.DEVisuals;

  function hexToRgb(hex) {
    const c = String(hex).replace("#", "");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function saturationOf(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  }
  function payloadFor(scheme, stops) {
    return {
      scheme, stops: stops.slice(),
      value: stops.length ? 1 - luminance(stops[0]) : 0.3,
      saturation: stops.length ? saturationOf(stops[0]) : 0.2,
    };
  }

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const palette = Object.values((window.CONFIG && CONFIG.COLORS) || { black: "#1a1a1a", white: "#ffffff" });
    let scheme = "mono";
    let stops = ["#1a1a1a"];

    const q = V.el("h2", { class: "de-question", id: "de-scheme-q" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const paint = () => {
      markSelected();
      ctx.live(payloadFor(scheme, stops));
    };

    // Single-choice between two schemes → a radiogroup (not a tablist: these
    // toggle the palette in place, they don't switch tabpanels).
    const tabs = V.el("div", { class: "de-scheme-tabs", role: "radiogroup", "aria-labelledby": "de-scheme-q" });
    // Der Verlauf braucht eine Zeile Anleitung (zwei Stops, Reihenfolge zählt);
    // im Uni-Modus bleibt die Zeile leer reserviert (kein Layout-Sprung).
    const hint = V.el("p", { class: "de-scheme-hint", "aria-hidden": "true" });
    const syncHint = () => { hint.textContent = scheme === "mono" ? "" : ctx.t("engine.duo_hint"); };
    [["mono", ctx.t("engine.scheme_mono")], ["duo-gradient", ctx.t("engine.scheme_duo")]].forEach(([id, label]) => {
      const tab = V.el("button", { type: "button", class: "de-scheme-tab", role: "radio" });
      tab.textContent = label;
      const on = id === scheme;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-checked", on ? "true" : "false");
      tab.addEventListener("click", () => {
        scheme = id;
        stops = id === "mono" ? stops.slice(0, 1) : stops.slice(0, 2);
        tabs.querySelectorAll(".de-scheme-tab").forEach((t) => {
          const sel = t === tab;
          t.classList.toggle("is-active", sel);
          t.setAttribute("aria-checked", sel ? "true" : "false");
        });
        syncHint();
        paint();
      });
      tabs.appendChild(tab);
    });

    const grid = V.el("div", { class: "de-palette" });
    const swatches = [];
    palette.forEach((hex) => {
      // A11y: name the swatch by its human colour name (bilingual), not the raw
      // hex — a screen reader otherwise announces "number sign one a one a…".
      // Mirrors the Ownership palette (app.js colorAdjective → I18N.colorName).
      // The visible name is aria-hidden so the accessible name isn't doubled.
      const swLabel = (window.I18N && window.I18N.colorName) ? window.I18N.colorName(hex) : hex;
      const sw = V.el("button", { type: "button", class: "de-palette-swatch", "aria-label": swLabel, "aria-pressed": "false" });
      sw.dataset.hex = hex;
      const field = V.el("span", { class: "de-fabric-field", "aria-hidden": "true" });
      field.style.background = hex;
      const badge = V.el("span", { class: "de-palette-order", "aria-hidden": "true" });
      field.appendChild(badge);
      const name = V.el("span", { class: "de-fabric-name", "aria-hidden": "true" });
      name.textContent = swLabel;
      sw.appendChild(field);
      sw.appendChild(name);
      sw.addEventListener("click", () => {
        if (scheme === "mono") stops = [hex];
        else { stops.push(hex); stops = stops.slice(-2); }
        paint();
      });
      swatches.push(sw);
      grid.appendChild(sw);
    });

    // Reflect the current stops on the swatch grid so the chosen colour(s) are
    // visible at a glance — and, in gradient mode, in which order (1 → 2).
    const markSelected = () => {
      swatches.forEach((sw) => {
        const idx = stops.indexOf(sw.dataset.hex);
        const on = idx !== -1;
        sw.classList.toggle("is-selected", on);
        sw.setAttribute("aria-pressed", on ? "true" : "false");
        const badge = sw.querySelector(".de-palette-order");
        if (badge) badge.textContent = (on && scheme !== "mono") ? String(idx + 1) : "";
      });
    };

    host.appendChild(tabs);
    host.appendChild(hint);
    host.appendChild(grid);
    syncHint();

    const confirm = V.el("button", { type: "button", class: "de-confirm" });
    confirm.textContent = ctx.t("engine.confirm");
    confirm.addEventListener("click", () => ctx.commit(payloadFor(scheme, stops)));
    host.appendChild(confirm);

    // No initial ctx.live / no pre-selected swatch: opening the colour atelier
    // must NOT seed a colour into the DNA. That seed made an un-tapped "Fertig"
    // ship black mono as if chosen, and painted the flat before any choice. The
    // flat keeps its neutral archetype tint until the first swatch tap.
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.colorGradient = render;
})();
