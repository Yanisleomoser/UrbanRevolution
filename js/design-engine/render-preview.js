/**
 * Urban Revolution — Design Engine · Live preview proxy (brief §7)
 *
 * The persistent, instant 2D proxy that updates with every decision — silhouette
 * + colour/gradient + material sheen + pattern — so the user watches their piece
 * converge. Reuses the existing $0 PreviewFallback studio SVG; degrades to a
 * plain silhouette if that module isn't present. The expensive AI render stays
 * on-demand (handoff at the end).
 *
 *   DesignPreview.descriptor(dna) → { type, color, material, pattern, name }
 *   DesignPreview.renderInto(el, dna)
 */
const DesignPreview = (() => {
  function descriptor(dna) {
    const g = (p) => DesignDNA.get(dna, p);
    const stops = g("color.stops") || [];
    const scheme = g("color.scheme");
    let pattern = "solid";
    if (scheme === "duo-gradient" && stops.length >= 2) pattern = "gradient";
    else if (g("pattern.type") && g("pattern.type") !== "none") pattern = g("pattern.type");
    return {
      type: g("category") || "tshirt",
      color: stops[0] || "#9aa0a8",
      material: g("fabric.material") || "cotton",
      pattern,
      name: "",
    };
  }

  function renderInto(el, dna) {
    if (!el) return;
    const d = descriptor(dna);
    if (window.PreviewFallback && typeof window.PreviewFallback.svg === "function") {
      el.innerHTML = window.PreviewFallback.svg(d);
    } else if (window.DEVisuals) {
      el.innerHTML = "";
      el.appendChild(window.DEVisuals.silhouette(d.type, "de-glyph"));
    }
  }

  return { descriptor, renderInto };
})();

if (typeof window !== "undefined") window.DesignPreview = DesignPreview;
if (typeof module !== "undefined" && module.exports) module.exports = DesignPreview;
