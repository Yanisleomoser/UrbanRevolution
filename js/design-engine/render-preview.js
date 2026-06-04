/**
 * Urban Revolution — Design Engine · Live preview proxy (brief §7 + §3.1)
 *
 * The persistent preview that updates with every decision. Picks a curated hero
 * photo by topArchetype × category (× subArchetype) and **recolours it live**
 * from color.stops via a duotone overlay — so every colour choice looks
 * different without re-rendering per colour. Carries a "Stilvorschau" badge.
 * Degrades to the on-brand PreviewFallback studio SVG when no hero photo exists.
 * The expensive AI render stays on-demand (handoff at the end).
 *
 *   DesignPreview.descriptor(dna) → { type, color, material, pattern, name }
 *   DesignPreview.heroCandidates(dna) → [src…]   (sub-variant first)
 *   DesignPreview.renderInto(el, dna)
 */
const DesignPreview = (() => {
  const PREVIEW_DIR = "js/design-engine/content/img/preview/";

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

  function heroCandidates(dna) {
    const cat = DesignDNA.get(dna, "category");
    const arch = window.DesignDNA ? DesignDNA.topArchetype(dna) : null;
    if (!cat || !arch) return [];
    const sub = DesignDNA.get(dna, "subArchetype");
    const list = [];
    if (sub) list.push(`${PREVIEW_DIR}${cat}-${arch}-${sub}.jpg`);
    list.push(`${PREVIEW_DIR}${cat}-${arch}.jpg`);
    return list;
  }

  function duoBackground(dna) {
    const stops = DesignDNA.get(dna, "color.stops") || [];
    const scheme = DesignDNA.get(dna, "color.scheme");
    if (scheme === "duo-gradient" && stops.length >= 2) return `linear-gradient(155deg, ${stops[0]}, ${stops[1]})`;
    return stops[0] || "#9aa0a8";
  }

  function renderInto(el, dna) {
    if (!el) return;
    const d = descriptor(dna);
    const proxy = (window.PreviewFallback && typeof window.PreviewFallback.svg === "function")
      ? window.PreviewFallback.svg(d)
      : "";
    const badge = window.I18N ? window.I18N.t("dpreview.fallback_badge") : "STILVORSCHAU";
    el.innerHTML = `
      <div class="de-preview-proxy">${proxy}</div>
      <div class="de-preview-photo" hidden><img alt="" /><div class="de-preview-duo"></div></div>
      <span class="de-preview-badge">${badge}</span>`;

    const duo = el.querySelector(".de-preview-duo");
    if (duo) duo.style.background = duoBackground(dna);

    // Try the curated hero photo (sub-variant first); recolour replaces nothing
    // structurally — the duotone overlay tints the grayscale photo. 404 → proxy.
    const cands = heroCandidates(dna);
    if (cands.length) {
      const photoWrap = el.querySelector(".de-preview-photo");
      const img = el.querySelector(".de-preview-photo img");
      let i = 0;
      const tryNext = () => {
        if (i >= cands.length || !photoWrap || !img) return;
        const src = cands[i++];
        const probe = new Image();
        probe.onload = () => { img.src = src; photoWrap.hidden = false; };
        probe.onerror = tryNext;
        probe.src = src;
      };
      tryNext();
    }
  }

  return { descriptor, heroCandidates, duoBackground, renderInto };
})();

if (typeof window !== "undefined") window.DesignPreview = DesignPreview;
if (typeof module !== "undefined" && module.exports) module.exports = DesignPreview;
