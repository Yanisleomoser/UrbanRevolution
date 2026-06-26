/**
 * Urban Revolution — Design Engine · Modality "colorGradient"
 * Scheme toggle (Uni / Verlauf) + palette swatches from CONFIG.COLORS. mono
 * picks one stop, duo-gradient picks two (in tap order). Live gradient bar +
 * ctx.live for instant preview. Commits { scheme, stops, value, saturation }.
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

    const preview = V.el("div", { class: "de-gradient-preview" });
    const paint = () => {
      preview.style.background = stops.length >= 2
        ? `linear-gradient(120deg, ${stops[0]}, ${stops[1]})`
        : stops[0] || "#1a1a1a";
      markSelected();
      ctx.live(payloadFor(scheme, stops));
    };

    // Single-choice between two schemes → a radiogroup (not a tablist: these
    // toggle the palette in place, they don't switch tabpanels).
    const tabs = V.el("div", { class: "de-scheme-tabs", role: "radiogroup", "aria-labelledby": "de-scheme-q" });
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
      const swLabel = (window.I18N && window.I18N.colorName) ? window.I18N.colorName(hex) : hex;
      const sw = V.el("button", { type: "button", class: "de-palette-swatch", "aria-label": swLabel, "aria-pressed": "false" });
      sw.style.background = hex;
      sw.dataset.hex = hex;
      const badge = V.el("span", { class: "de-palette-order", "aria-hidden": "true" });
      sw.appendChild(badge);
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

    host.appendChild(preview);
    host.appendChild(tabs);
    host.appendChild(grid);

    const confirm = V.el("button", { type: "button", class: "de-confirm" });
    confirm.textContent = ctx.t("engine.confirm");
    confirm.addEventListener("click", () => ctx.commit(payloadFor(scheme, stops)));
    host.appendChild(confirm);

    paint();
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.colorGradient = render;
})();
