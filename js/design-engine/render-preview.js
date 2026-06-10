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

  // --- silhouette morph ----------------------------------------------------
  // The flat doesn't just swap on each decision — it ANIMATES from the previous
  // shape to the new one (GarmentSVG.lerpModel), so the user SEES the garment
  // reshape (shoulder widening, hem dropping, waist nipping). This is the fix
  // for "the morph works but is so minimal it feels like nothing happens".
  const MORPH_MS = 380; // per-answer reshape: snappy but still legibly animated
  const lastModel = new WeakMap(); // preview el → last GarmentSVG model
  const tweenId = new WeakMap();   // preview el → running rAF id
  const wasGenesis = new WeakMap(); // preview el → last render was the nebula
  // easeInOutCubic — accelerates out of the old shape and settles softly into
  // the new one, so the morph reads as one deliberate motion (not a linear slide).
  const easeOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduceMotion = () =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  function morph(el, wrap, fromM, toM) {
    const prev = tweenId.get(el);
    if (prev) cancelAnimationFrame(prev);
    // Start painted at t=0 (the previous shape) so there's no flash of the
    // target before the animation runs.
    wrap.innerHTML = window.GarmentSVG.paint(window.GarmentSVG.lerpModel(fromM, toM, 0));
    const start = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const step = (now) => {
      const t = Math.min(1, (now - start) / MORPH_MS);
      wrap.innerHTML = window.GarmentSVG.paint(window.GarmentSVG.lerpModel(fromM, toM, easeOut(t)));
      if (t < 1) {
        tweenId.set(el, requestAnimationFrame(step));
      } else {
        tweenId.delete(el);
        wrap.innerHTML = window.GarmentSVG.paint(toM); // clean final frame
      }
    };
    tweenId.set(el, requestAnimationFrame(step));
  }

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
      sleeveLength: g("construction.sleeveLength"),
      closure: g("construction.closure"),
      pockets: g("construction.pockets"),
      cuffs: g("construction.cuffs"),
      hem: g("construction.hem"),
      waistband: g("construction.waistband"),
      waist: g("construction.waist"),
      // Subarchetype reshapes the live flat (puffer voluminous, bomber cropped…),
      // not just the tile. Hardware finish tints the closure; signature draws an
      // extra detail — so the Phase-E choices also visibly land on the flat.
      subArchetype: g("subArchetype"),
      hardware: g("hardware.finish"),
      signature: g("signature"),
      pattern: g("pattern.type"),
      patternScale: g("pattern.scale"),
      scheme: g("color.scheme"),
      stops: g("color.stops"),
      material: g("fabric.material"),
      // Honour the numeric finishWeight; fall back to the string finish
      // ("matte"/"sheen") that archetype inference sets, so an inferred finish
      // still shows on the flat (the two were previously disconnected).
      finish: typeof g("fabric.finishWeight") === "number"
        ? g("fabric.finishWeight")
        : ({ sheen: 0.8, glossy: 0.85, matte: 0.15 })[g("fabric.finish")],
      // Soft signals so EVERY decision shows on the flat: energy (calm↔bold)
      // tints/saturates the fill, and the winning archetype (driven by mood /
      // inspo / occasion / season) sets the neutral tone.
      energy: g("intent.energy"),
      archetype: (typeof DesignDNA !== "undefined" && DesignDNA.topArchetype) ? DesignDNA.topArchetype(dna) : null,
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

    // ── Genesis stage (before the user has chosen a category) ──────────────
    // No garment exists yet, so none is shown: an abstract thread-flow reacts
    // to the mood answers and gains material with every choice. The first
    // category decision then WEAVES the threads into the silhouette (CSS
    // draw-in via .is-weave) — the piece visibly comes into being.
    if (opts && opts.genesis && window.GarmentSVG && window.GarmentSVG.nebula) {
      const badgeG = window.I18N ? window.I18N.t("dpreview.genesis_badge") : "ES ENTSTEHT …";
      el.innerHTML = `
        <div class="de-garment-wrap is-genesis">${window.GarmentSVG.nebula({
          energy: p.energy, structure: p.structure, archetype: p.archetype, seed: (opts.seed || 0),
        })}</div>
        <span class="de-preview-badge">${badgeG}</span>`;
      lastModel.delete(el);
      wasGenesis.set(el, true);
      return;
    }

    const badge = window.I18N ? window.I18N.t("dpreview.fallback_badge") : "STILVORSCHAU";
    const schemeChosen = DesignDNA.confidence(dna, "color.scheme") > SCHEME_THRESHOLD;

    // Materialisation progress (0..1): the flat develops from faint sketch to
    // fully dressed as the journey matures (GarmentSVG honours p.reveal).
    if (opts && typeof opts.progress === "number") p.reveal = Math.max(0.25, Math.min(1, opts.progress));

    // Resolve the new silhouette as a morph model when GarmentSVG is present so
    // we can animate from the previous shape; fall back to the static studio SVG.
    const toModel = window.GarmentSVG ? window.GarmentSVG.model(p.category || "tshirt", p) : null;
    const targetSvg = toModel ? window.GarmentSVG.paint(toModel) : silhouette(p);

    // Fresh out of genesis → the silhouette draws itself in (weave moment).
    const weaveIn = wasGenesis.get(el) === true && !reduceMotion();
    wasGenesis.delete(el);

    el.innerHTML = `
      <div class="de-preview-photo${schemeChosen ? " is-duo" : ""}" hidden><img alt="" /><div class="de-preview-duo"></div></div>
      <div class="de-garment-wrap${weaveIn ? " is-weave" : ""}">${targetSvg}</div>
      <span class="de-preview-badge">${badge}</span>`;

    const duo = el.querySelector(".de-preview-duo");
    if (duo) duo.style.background = schemeChosen ? duoBackground(dna) : "transparent";

    // Animate the reshape when we have a previous model of the SAME category
    // (cross-category switches snap — the shapes aren't comparable). First
    // render and reduced-motion users get the target immediately.
    if (toModel) {
      const fromModel = lastModel.get(el);
      const wrap = el.querySelector(".de-garment-wrap");
      if (wrap && fromModel && fromModel.cat === toModel.cat && !reduceMotion()) {
        morph(el, wrap, fromModel, toModel);
      }
      lastModel.set(el, toModel);
    }

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
