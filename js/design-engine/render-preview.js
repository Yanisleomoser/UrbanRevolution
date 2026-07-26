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
  const PREVIEW_DIR = "/js/design-engine/content/img/preview/";
  const SCHEME_THRESHOLD = 0.6; // above the inferred 0.5 → user actively chose
  const PATTERN_THRESHOLD = 0.5; // above the inferred soft-fill (0.4) → user actively picked a pattern

  // --- silhouette morph ----------------------------------------------------
  // The flat doesn't just swap on each decision — it ANIMATES from the previous
  // shape to the new one (GarmentSVG.lerpModel), so the user SEES the garment
  // reshape (shoulder widening, hem dropping, waist nipping). This is the fix
  // for "the morph works but is so minimal it feels like nothing happens".
  // lerpModel also cross-fades the fill colour (roadmap C4), so a same-scheme
  // recolour blends hue over MORPH_MS instead of snapping; reduced-motion and
  // cross-category switches still take the target instantly (morph isn't run).
  const MORPH_MS = 380; // per-answer reshape: snappy but still legibly animated
  const RETENSION_MS = 620; // genesis re-tension per answer (§5.2): calm but visible
  const lastModel = new WeakMap(); // preview el → last GarmentSVG model
  const tweenId = new WeakMap();   // preview el → running rAF id (morph OR re-tension)
  const wasGenesis = new WeakMap(); // preview el → last render was the nebula
  const lastNebula = new WeakMap(); // preview el → last nebula model (re-tension tween)
  // preview el → current render's generation. A realism render's photo probe
  // resolves asynchronously (network image load); if renderInto is called again
  // on the same el before it lands (e.g. the user hits "back" right after
  // convergence), the stale probe must not re-add .is-realism / show its photo
  // over the render that superseded it — that would reintroduce the exact
  // "stale dimmed preview" bug the .is-realism cleanup above already fixes.
  const renderGen = new WeakMap();
  // easeInOutCubic — accelerates out of the old shape and settles softly into
  // the new one, so the morph reads as one deliberate motion (not a linear slide).
  const easeOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduceMotion = () =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // `mirror` (optional): a second, smaller element that receives every frame
  // paint too — the mobile dock mini-preview morphs in sync with the stage.
  function morph(el, wrap, fromM, toM, mirror) {
    const prev = tweenId.get(el);
    if (prev) cancelAnimationFrame(prev);
    const paintBoth = (html) => {
      wrap.innerHTML = html;
      if (mirror) mirror.innerHTML = html;
    };
    // Start painted at t=0 (the previous shape) so there's no flash of the
    // target before the animation runs.
    paintBoth(window.GarmentSVG.paint(window.GarmentSVG.lerpModel(fromM, toM, 0)));
    const start = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const step = (now) => {
      const t = Math.min(1, (now - start) / MORPH_MS);
      paintBoth(window.GarmentSVG.paint(window.GarmentSVG.lerpModel(fromM, toM, easeOut(t))));
      if (t < 1) {
        tweenId.set(el, requestAnimationFrame(step));
      } else {
        tweenId.delete(el);
        paintBoth(window.GarmentSVG.paint(toM)); // clean final frame
      }
    };
    tweenId.set(el, requestAnimationFrame(step));
  }

  // §5.2 — the nebula's idle tempo follows the mood: calm = long slow breaths,
  // bold = quick tight pulses. CSS custom properties so the keyframes stay in
  // the stylesheet (deBreath / deNodePulse read --neb-breath / --neb-pulse).
  function nebulaTempo(energy) {
    const e = Math.max(0, Math.min(1, typeof energy === "number" ? energy : 0.5));
    return `--neb-breath:${(9.5 - e * 5.5).toFixed(2)}s;--neb-pulse:${(4.6 - e * 2.4).toFixed(2)}s`;
  }

  // §5.2 — genesis re-tension: rAF-tween the previous thread cloud into the
  // new one (same pattern as the garment morph) so a mood answer visibly
  // re-tensions the threads instead of redrawing them from scratch. The wrap
  // keeps .is-retension from the first tween on: the per-frame repaints would
  // otherwise restart the one-time CSS draw-in every frame and pin every path
  // at dashoffset 1 (invisible). Freshly added threads fade in via the lerped
  // opacity instead.
  function retension(el, wrap, fromN, toN, mirror) {
    const prev = tweenId.get(el);
    if (prev) cancelAnimationFrame(prev);
    wrap.classList.add("is-retension");
    // .is-tweening pauses the infinite breath/pulse animations for the tween's
    // duration: the per-frame repaints would restart them at t=0 every frame,
    // pinning nodes at their dimmest keyframe and overriding the lerped
    // fade-in opacity of freshly added threads. Removed at tween end, so the
    // idle life resumes with ONE clean restart instead of ~40.
    wrap.classList.add("is-tweening");
    wrap.style.cssText = nebulaTempo(toN.energy);
    const paintBoth = (html) => {
      wrap.innerHTML = html;
      if (mirror) mirror.innerHTML = html;
    };
    paintBoth(window.GarmentSVG.nebulaPaint(window.GarmentSVG.lerpNebulaModel(fromN, toN, 0)));
    const start = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const step = (now) => {
      const t = Math.min(1, (now - start) / RETENSION_MS);
      paintBoth(window.GarmentSVG.nebulaPaint(window.GarmentSVG.lerpNebulaModel(fromN, toN, easeOut(t))));
      if (t < 1) tweenId.set(el, requestAnimationFrame(step));
      else { tweenId.delete(el); wrap.classList.remove("is-tweening"); }
    };
    tweenId.set(el, requestAnimationFrame(step));
  }

  function params(dna) {
    const g = (p) => DesignDNA.get(dna, p);
    // Verschluss nur, wenn die Kategorie ihn zeichnen kann (Whitelist im
    // Renderer): ein inferiertes/geteiltes closure:"button" darf auf einem
    // T-Shirt/Kleid keine Knopfleiste mehr erzeugen (Atelier-Analyse U1).
    const cat = g("category");
    const rawClosure = g("construction.closure");
    const G = typeof window !== "undefined" ? window.GarmentSVG : (typeof GarmentSVG !== "undefined" ? GarmentSVG : null);
    const closure = (G && G.closureAllowed && !G.closureAllowed(cat, rawClosure)) ? "none" : rawClosure;
    return {
      category: cat,
      fit: g("silhouette.fit"),
      structure: g("silhouette.structure"),
      volume: g("silhouette.volume"),
      length: g("length"),
      collar: g("construction.collar"),
      sleeve: g("construction.sleeve"),
      sleeveLength: g("construction.sleeveLength"),
      closure: closure,
      pockets: g("construction.pockets"),
      cuffs: g("construction.cuffs"),
      hem: g("construction.hem"),
      waistband: g("construction.waistband"),
      waist: g("construction.waist"),
      // Subarchetype is passed through, but only some categories' painters read
      // it directly (jacket collar/quilting, dress bodice). For hoodie/shirt/
      // tshirt/pants the sub-archetype reshapes the flat through the concrete
      // paths its card CO-SETS (fit / length / volume / pockets / structure),
      // not through this value alone. Hardware finish tints the closure;
      // signature draws an extra detail — so Phase-E choices also land on the flat.
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

  // ── Honesty gate (roadmap §3.5) ──────────────────────────────────────────
  // The curated photos were generated from archetype MOOD prompts — their
  // concrete construction (closure, collar, length …) was never controlled.
  // A photo may only crossfade over the flat when nothing it visibly shows
  // contradicts the design: for every DNA path in its manifest entry, a
  // DECIDED dna value must equal the photo's value. Undecided values don't
  // gate (the photo makes no claim the user hasn't made). The flat is always
  // correct — a wrong photo at the decisive moment is worse than no photo.
  function photoMatches(dna, entry) {
    if (!entry || entry.unusable) return false;
    for (const [path, want] of Object.entries(entry)) {
      if (path === "unusable" || path.charAt(0) === "_") continue;
      const have = DesignDNA.get(dna, path);
      if (have != null && have !== want) return false;
    }
    return true;
  }

  // heroCandidates filtered by the manifest. Fail-closed: no manifest, or a
  // photo without an entry, → no photo (never "probe and hope").
  function matchingCandidates(dna, manifest) {
    const photos = manifest && manifest.photos;
    if (!photos) return [];
    return heroCandidates(dna).filter((src) => {
      const base = src.slice(src.lastIndexOf("/") + 1).replace(/\.jpg$/, "");
      return photoMatches(dna, photos[base]);
    });
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
    const gen = (renderGen.get(el) || 0) + 1;
    renderGen.set(el, gen);
    // A still-running tween (morph or re-tension) would keep painting into the
    // wrap it captured — detached after the innerHTML swap below, but its
    // MIRROR (the live dock) is not. Every path below either repaints wholesale
    // or starts its own tween, so stop the old one first.
    const running = tweenId.get(el);
    if (running) { cancelAnimationFrame(running); tweenId.delete(el); }
    const realism = !!(opts && opts.realism);
    // A converged design leaves .de-preview in its realism state (the dimmed
    // flat under the crossfaded photo — .is-realism stays on the container even
    // after innerHTML is replaced). Every NON-realism render — the live journey,
    // a restart, a category switch — must start from the full-opacity flat, or
    // it renders dimmed (opacity 0.1) until a hard refresh. The realism branch
    // below re-adds .is-realism only once a curated photo actually loads.
    if (!realism) el.classList.remove("is-realism");
    const p = params(dna);
    // "Made for one" (roadmap §9): the caller may pass gentle body multipliers
    // (flow.js bodyFactors from the user's measurements) — GarmentSVG clamps
    // them, and the morph tween carries them like any other geometry change.
    if (opts && opts.body) p.body = opts.body;
    // B3b · Der Stoff scheint durch die Silhouette: nur die grosse Bühne
    // reicht das Bild durch (Kacheln, Galerie und Sphäre nicht) — dort ist
    // der Flat ein Symbol, hier ein Stück.
    if (opts && opts.cloth) p.cloth = opts.cloth;

    // ── Genesis stage (before the user has chosen a category) ──────────────
    // No garment exists yet, so none is shown: an abstract thread-flow reacts
    // to the mood answers and gains material with every choice. The first
    // category decision then WEAVES the threads into the silhouette (CSS
    // draw-in via .is-weave) — the piece visibly comes into being.
    if (opts && opts.genesis && window.GarmentSVG && window.GarmentSVG.nebula) {
      const G = window.GarmentSVG;
      const nebParams = { energy: p.energy, structure: p.structure, archetype: p.archetype, seed: (opts.seed || 0) };
      lastModel.delete(el);
      wasGenesis.set(el, true);
      const toN = G.nebulaModel ? G.nebulaModel(nebParams) : null;
      const fromN = toN ? lastNebula.get(el) : null;
      if (toN) lastNebula.set(el, toN);
      // Re-tension (§5.2): an answer during genesis doesn't redraw the cloud —
      // the existing threads TWEEN to their new tension (energy bows them
      // wider, structure straightens them, a fresh answer fades new threads
      // in), so the user feels the engine listening. Fresh paint only on the
      // first genesis render, when the cloud SHRANK (back/restart = an honest
      // reset), and under reduced motion.
      const wrap = el.querySelector ? el.querySelector(".de-garment-wrap.is-genesis") : null;
      if (toN && fromN && wrap && fromN.threads.length <= toN.threads.length && !reduceMotion()) {
        // The badge lives outside the wrap and would otherwise keep the
        // language it was first painted with (the fresh-paint path below
        // rebuilds it; this path must not skip that).
        const badgeEl = el.querySelector(".de-preview-badge");
        if (badgeEl && window.I18N) badgeEl.textContent = window.I18N.t("dpreview.genesis_badge");
        retension(el, wrap, fromN, toN, opts.mirror);
        return;
      }
      const badgeG = window.I18N ? window.I18N.t("dpreview.genesis_badge") : "ES ENTSTEHT …";
      const nebula = toN ? G.nebulaPaint(toN) : G.nebula(nebParams);
      el.innerHTML = `
        <div class="de-garment-wrap is-genesis" style="${nebulaTempo(p.energy)}">${nebula}</div>
        <span class="de-preview-badge">${badgeG}</span>`;
      if (opts.mirror) opts.mirror.innerHTML = nebula;
      return;
    }

    const badge = window.I18N ? window.I18N.t("dpreview.fallback_badge") : "STILVORSCHAU";
    const schemeChosen = DesignDNA.confidence(dna, "color.scheme") > SCHEME_THRESHOLD;
    // ── Honesty gate on SURFACE decisions (colour + decorative pattern) ──────
    // The live flat must not commit to a colour or a print the user hasn't
    // reached yet. params() reads the finalized clone, so an archetype-inferred
    // colour (color.stops filled from the top archetype) and an inferred pattern
    // would otherwise paint the flat long before their own steps — the reported
    // "eine Farbe wird zu früh angezeigt". Suppress both until actively chosen:
    // with no stops, fillSpec falls back to its neutral archetype tint ("no
    // colour chosen yet"), and the pattern stays off. Silhouette (fit/length/
    // volume) still takes shape early on purpose — only surface decisions wait.
    if (!schemeChosen) { p.stops = null; p.scheme = null; }
    if (DesignDNA.confidence(dna, "pattern.type") <= PATTERN_THRESHOLD) p.pattern = "none";

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
    lastNebula.delete(el);

    // Hero beat, phase 1 (§5.3): the genesis threads don't vanish on a hard
    // cut — a ghost copy of the nebula converges into the piece (CSS
    // deGhostConverge) while the outline is drawn out of it. A running
    // re-tension tween dies with the innerHTML swap below; the ghost is a
    // static copy, removed once its exit animation is over.
    let ghost = "";
    if (weaveIn && el.querySelector) {
      const neb = el.querySelector(".de-nebula");
      if (neb && neb.outerHTML) ghost = `<div class="de-weave-ghost" aria-hidden="true">${neb.outerHTML}</div>`;
    }

    el.innerHTML = `
      <div class="de-preview-photo${schemeChosen ? " is-duo" : ""}" hidden><img alt="" /><div class="de-preview-duo"></div></div>
      <div class="de-garment-wrap${weaveIn ? " is-weave" : ""}">${ghost}${targetSvg}</div>
      <span class="de-preview-badge">${badge}</span>`;
    if (ghost) {
      // gen-guarded like the photo probe below: a stale timer from THIS weave
      // must not delete the ghost of a LATER weave (fast back → re-pick).
      setTimeout(() => {
        if (renderGen.get(el) !== gen) return;
        const g = el.querySelector && el.querySelector(".de-weave-ghost");
        if (g) g.remove();
      }, 700);
    }
    if (weaveIn) {
      // Drop .is-weave once the beat is over (sweep ends ~2.15 s): its
      // stroke-dasharray:1 declaration would otherwise keep overriding the
      // ATTRIBUTE dashes of zip/stitch seams (pathLength=1 → dasharray 1 =
      // solid) until the next re-render, and will-change would linger.
      // Removing the class lands exactly on the resting state the animations'
      // fill:both already shows.
      setTimeout(() => {
        if (renderGen.get(el) !== gen) return;
        const w = el.querySelector && el.querySelector(".de-garment-wrap.is-weave");
        if (w) w.classList.remove("is-weave");
      }, 2400);
    }
    // Mobile dock mini-preview: mirrors the flat (and, below, every morph
    // frame) so the "choose → see it change" loop survives the preview
    // scrolling out of view on small screens. Photo/badge are NOT mirrored —
    // the dock is always the honest flat.
    if (opts && opts.mirror) opts.mirror.innerHTML = targetSvg;

    const duo = el.querySelector(".de-preview-duo");
    if (duo) duo.style.background = schemeChosen ? duoBackground(dna) : "transparent";

    // Animate the reshape when we have a previous model of the SAME category
    // (cross-category switches snap — the shapes aren't comparable). First
    // render and reduced-motion users get the target immediately.
    if (toModel) {
      const fromModel = lastModel.get(el);
      const wrap = el.querySelector(".de-garment-wrap");
      if (wrap && fromModel && fromModel.cat === toModel.cat && !reduceMotion()) {
        morph(el, wrap, fromModel, toModel, opts && opts.mirror);
      }
      lastModel.set(el, toModel);
    }

    // Realism layer (brief §1): the curated hero photo only appears at
    // convergence / on generate — it crossfades OVER the flat, never sits
    // dimmed behind it during the journey. No photo is even loaded mid-journey.
    if (!realism) return;
    // Honesty gate: only photos whose manifest entry doesn't contradict the
    // DNA are even considered (opts.photoManifest from content/preview-photos
    // .json). No matching photo → the always-correct flat stays.
    const cands = matchingCandidates(dna, opts && opts.photoManifest);
    // Realism requested but no honest photo for this design → keep the flat
    // (clear any stale realism dim from a previous, photo-backed design).
    if (!cands.length) { el.classList.remove("is-realism"); return; }
    const photoWrap = el.querySelector(".de-preview-photo");
    const img = el.querySelector(".de-preview-photo img");
    let i = 0;
    const tryNext = () => {
      if (i >= cands.length || !photoWrap || !img) return;
      const src = cands[i++];
      const probe = new Image();
      probe.onload = () => {
        if (renderGen.get(el) !== gen) return; // superseded by a later render — don't resurrect the dim
        img.src = src;
        photoWrap.hidden = false;
        // next frame → transition kicks in; flat fades under the photo
        requestAnimationFrame(() => {
          if (renderGen.get(el) !== gen) return;
          photoWrap.classList.add("is-shown"); el.classList.add("is-realism");
        });
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

  return { params, heroCandidates, photoMatches, matchingCandidates, duoBackground, descriptor, renderInto, nebulaTempo };
})();

if (typeof window !== "undefined") window.DesignPreview = DesignPreview;
if (typeof module !== "undefined" && module.exports) module.exports = DesignPreview;
