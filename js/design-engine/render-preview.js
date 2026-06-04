/**
 * Urban Revolution — Design Engine · Live preview (brief §7 + §3.1)
 *
 * Primary layer during the journey: a clean technical fashion FLAT (GarmentSVG)
 * that morphs from the DNA — it stands ALONE on the dark stage (brief §1: never
 * laid over a blurred photo). The recoloured hero photo / AI render is the
 * REALISM layer that only crossfades in at convergence (Phase F) or on
 * "Generieren" — pass { realism: true }. The hero photo keeps its native colour
 * until the user actively picks a colour scheme (then a duotone follows the
 * chosen stops). Falls back to the studio SVG if GarmentSVG is missing.
 *
 *   DesignPreview.params(dna) · DesignPreview.heroCandidates(dna)
 *   DesignPreview.renderInto(el, dna, opts?)   // opts.realism → show photo
 */
const DesignPreview = (() => {
  const PREVIEW_DIR = "js/design-engine/content/img/preview/";
  const SCHEME_THRESHOLD = 0.6; // above the inferred 0.5 → user actively chose

  function params(dna) {
    const g = (p) => DesignDNA.get(dna, p);
    return {
      category: g("category"),
      fit: g("silhouette.fit"),
      structure: g("silhouette.structure"),
      volume: g("silhouette.volume"),
      length: g("length"),
      collar: g("construction.collar"),
      sleeve: g("construction.sleeve"),
      closure: g("construction.closure"),
      pockets: g("construction.pockets"),
      cuffs: g("construction.cuffs"),
      hem: g("construction.hem"),
      pattern: g("pattern.type"),
      scheme: g("color.scheme"),
      stops: g("color.stops"),
      material: g("fabric.material"),
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

  function silhouette(p) {
    if (window.GarmentSVG) return window.GarmentSVG.build(p.category || "tshirt", p);
    if (window.PreviewFallback) {
      return window.PreviewFallback.svg({
        type: p.category || "tshirt",
        color: (p.stops && p.stops[0]) || "#9aa0a8",
        material: p.material,
        pattern: p.scheme === "duo-gradient" ? "gradient" : (p.pattern && p.pattern !== "none" ? p.pattern : "solid"),
      });
    }
    return "";
  }

  function renderInto(el, dna, opts) {
    if (!el) return;
    const realism = !!(opts && opts.realism);
    const p = params(dna);
    const badge = window.I18N ? window.I18N.t("dpreview.fallback_badge") : "STILVORSCHAU";
    const schemeChosen = DesignDNA.confidence(dna, "color.scheme") > SCHEME_THRESHOLD;

    el.innerHTML = `
      <div class="de-preview-photo${schemeChosen ? " is-duo" : ""}" hidden><img alt="" /><div class="de-preview-duo"></div></div>
      <div class="de-garment-wrap">${silhouette(p)}</div>
      <span class="de-preview-badge">${badge}</span>`;

    const duo = el.querySelector(".de-preview-duo");
    if (duo) duo.style.background = schemeChosen ? duoBackground(dna) : "transparent";

    // Realism layer (brief §1): the curated hero photo only appears at
    // convergence / on generate — it crossfades OVER the flat, never sits
    // dimmed behind it during the journey. No photo is even loaded mid-journey.
    if (!realism) return;
    const cands = heroCandidates(dna);
    if (!cands.length) return;
    const photoWrap = el.querySelector(".de-preview-photo");
    const img = el.querySelector(".de-preview-photo img");
    let i = 0;
    const tryNext = () => {
      if (i >= cands.length || !photoWrap || !img) return;
      const src = cands[i++];
      const probe = new Image();
      probe.onload = () => {
        img.src = src;
        photoWrap.hidden = false;
        // next frame → transition kicks in; flat fades under the photo
        requestAnimationFrame(() => { photoWrap.classList.add("is-shown"); el.classList.add("is-realism"); });
      };
      probe.onerror = tryNext;
      probe.src = src;
    };
    tryNext();
  }

  // Kept for compatibility (descriptor was used by older callers/tests).
  function descriptor(dna) {
    const p = params(dna);
    const stops = p.stops || [];
    let pattern = "solid";
    if (p.scheme === "duo-gradient" && stops.length >= 2) pattern = "gradient";
    else if (p.pattern && p.pattern !== "none") pattern = p.pattern;
    return { type: p.category || "tshirt", color: stops[0] || "#9aa0a8", material: p.material || "cotton", pattern, name: "" };
  }

  return { params, heroCandidates, duoBackground, descriptor, renderInto };
})();

if (typeof window !== "undefined") window.DesignPreview = DesignPreview;
if (typeof module !== "undefined" && module.exports) module.exports = DesignPreview;
