/**
 * Urban Revolution — Design Engine · Parametric technical fashion flats
 *
 * A clean technical fashion DRAWING that morphs from the DesignDNA — light
 * stroke on the dark stage, precise proportions, subtle seam/fold lines. This
 * is the primary, evolving preview during the journey; the recoloured hero
 * photo / AI render is the realism layer that only appears at convergence.
 *
 * Architecture (brief §3): per category an authored base flat whose proportions
 * are fixed, morphed through PARAMETERS — shoulder width, length, waist
 * suppression, volume — with sleeves / collar / closure as swappable components.
 * The correct base shape is authored once and never re-derived from raw path
 * maths, so it can't collapse into blobs / cones / leg-stumps.
 *
 * Geometry invariants (brief §2) enforced for every top:
 *   1. Shoulder is the widest point; chest = shoulder · lerp(0.80,0.99,fit),
 *      never wider than the shoulder.
 *   2. slim → waist < chest, hem ≈ chest; oversized → straight boxy column,
 *      hem never wider than chest (no bell).
 *   3. Sleeves are their own ALWAYS-VISIBLE limbs anchored at the shoulder,
 *      length from the sleeve attribute (NOT the hem), tapering to the wrist.
 *   4. Drop-shoulder widens the shoulder line and lowers the armscye.
 *   5. Collar / lapel / hood are integrated shapes on the neckline.
 *
 *   GarmentSVG.build(category, params) → inline SVG markup (string)
 */
const GarmentSVG = (() => {
  const VB = 240, VH = 340, CX = 120;
  const INK = "#ECECF0";          // main outline stroke (light)
  const SEAM = "#CFCFD8";         // seam / fold lines (dimmer)
  let uid = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const lerp = (a, b, t) => a + (b - a) * t;
  const r = (n) => Math.round(n * 10) / 10;
  const L = (x) => r(CX - x);
  const R = (x) => r(CX + x);
  const Y = (y) => r(y);

  // Colour values come from the DesignDNA — which on a shared #dna= link is
  // attacker-controlled and JSON-parsed without validation — and are
  // interpolated UNESCAPED into the SVG markup string below. Clamp every colour
  // to a strict hex literal so a value like `#000"><img onerror=…>` can't break
  // out of an attribute and inject markup (XSS). Non-hex → neutral fallback.
  const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const safeHex = (v, fallback) =>
    (typeof v === "string" && HEX_RE.test(v.trim())) ? v.trim() : fallback;

  // Per-category construction constants (brief §4). sleeveLen is the limb's own
  // length so cropped bodies keep full sleeves; hem maps the length attribute.
  const CFG = {
    jacket: { sleeveLen: 176, hem: { cropped: 208, regular: 286, long: 316 }, defCollar: "notched", closure: "zip", splay: 15, cuffW: 18, armDepth: 52, neckHalf: 18 },
    hoodie: { sleeveLen: 172, hem: { cropped: 214, regular: 288, long: 312 }, defCollar: "hood", closure: "none", splay: 17, cuffW: 20, armDepth: 58, drop: true, neckHalf: 19 },
    shirt: { sleeveLen: 174, hem: { cropped: 210, regular: 268, long: 300 }, defCollar: "shirt", closure: "button", splay: 13, cuffW: 16, armDepth: 50, neckHalf: 17 },
    tshirt: { sleeveLen: 56, hem: { cropped: 206, regular: 252, long: 286 }, defCollar: "crew", closure: "none", splay: 16, cuffW: 24, armDepth: 50, neckHalf: 20 },
  };

  // Sleeve-length attribute → the limb's own length (per category, so a "long"
  // tee reads as a longsleeve and a "short" shirt as rolled short sleeves).
  // "sleeveless" collapses the limb entirely (tank / slip silhouette).
  function sleeveLenFor(p, cfg) {
    const sl = p.sleeveLength;
    if (sl === "sleeveless") return 0;
    if (sl === "cap") return 34;
    if (sl === "short") return 58;
    if (sl === "long") return Math.max(cfg.sleeveLen, 168);
    return cfg.sleeveLen;
  }

  // --- Physically-based cloth-optics model (translated to flat shading) -----
  // physicallybased.info lists no textiles, but the same micro-facet reasoning
  // applies: a fabric's specular response is governed by (1) how MUCH light it
  // reflects specularly (spec) and (2) how ROUGH the surface is, which spreads
  // that reflection. On the flat we map:
  //   • spec  → highlight INTENSITY (peak white opacity) + contrast (how dark
  //             the shadow side gets).
  //   • rough → highlight WIDTH: low-roughness satin → a NARROW, sharp specular
  //             band; rough cotton → a BROAD, washed lobe with no clean peak.
  //             It also softens the volume falloff (matte = flatter body).
  // Fuzzy fibres (wool/fleece) are retroreflective — almost no view-dependent
  // specular lobe → spec≈0, very broad. silk/satin: strong spec + very low
  // roughness → bright tight band, the glossiest. This is a tiny data table
  // feeding the existing gradient stops, NOT a real BRDF — subtlety is the bar.
  const MATERIAL_OPTICS = {
    silk:      { spec: 0.86, rough: 0.12 }, // satin: glossiest, narrow sharp band (kept just shy of a hot blob)
    polyester: { spec: 0.60, rough: 0.34 }, // synthetic: moderate, a touch broader/softer than silk
    cotton:    { spec: 0.26, rough: 0.74 }, // matte microfibre: soft, broad, low-contrast
    linen:     { spec: 0.19, rough: 0.84 }, // drier/flatter than cotton
    denim:     { spec: 0.24, rough: 0.70 }, // matte twill: broad + dim, slight directional sheen
    wool:      { spec: 0.10, rough: 0.92 }, // fuzz/retroreflective: almost no highlight
    fleece:    { spec: 0.05, rough: 0.97 }, // fuzziest: essentially no highlight, softest volume
  };
  const DEFAULT_OPTICS = { spec: 0.30, rough: 0.62 };

  // Neutral-fill tone per winning archetype (used when no colour is chosen yet)
  // → mood / inspo / occasion / season shift the flat's tone because they shift
  // the archetype. Cool tech ↔ warm couture/utility ↔ playful street.
  const ARCH_TINT = { quietMinimal: "#9a9aa2", softCouture: "#b9a79b", utility: "#9ca08c", techAvant: "#8c99ab", y2kStreet: "#b48cac", sport: "#8caaa2" };
  // The archetype comes from shared/remixed DNA (attacker-controlled JSON): a
  // prototype key like "constructor" would resolve to a truthy non-string on
  // the bare object above and be stringified into the SVG paint (no markup
  // escape possible, but the render breaks). Only ever hand out real tints.
  const archTint = (a) => { const v = ARCH_TINT[a]; return typeof v === "string" ? v : null; };

  // ---- recolour + material/finish/energy/archetype -------------------------
  // Light stroke always; chosen colour fills as a SOFT tonal wash (energy =
  // calm↔bold drives how present it is). No colour yet → tone from the
  // archetype. A sheen overlay (material × finish) gives the fabric a feel.
  function fillSpec(id, p) {
    // Hard-clamp each stop to a safe hex literal (see safeHex above): stops are
    // written unescaped into the SVG, and a shared DNA can carry hostile values.
    const tint = archTint(p.archetype) || "#8b8f96";
    const stops = Array.isArray(p.stops) && p.stops.length
      ? p.stops.map((s) => safeHex(s, tint)) : null;
    const energy = clamp(num(p.energy, 0.5), 0, 1);
    const finish = clamp(num(p.finish, 0.5), 0, 1);

    // Resolve the cloth-optics for this material, then let the "Matt↔Glänzend"
    // finish slider visibly scale on top: finish>0.5 pushes spec UP and
    // roughness DOWN (glossier), finish<0.5 the reverse (more matte). finish
    // stays the same lever the user already turns — it just now moves a
    // physically-meaningful (spec, rough) pair instead of one opaque scalar.
    const opt = MATERIAL_OPTICS[p.material] || DEFAULT_OPTICS;
    const fAdj = (finish - 0.5) * 2;                              // -1..1
    const spec = clamp(opt.spec + fAdj * 0.30, 0.02, 0.98);      // specular intensity
    const rough = clamp(opt.rough - fAdj * 0.28, 0.04, 0.99);    // surface roughness
    let defs = "";
    let fill, opacity;
    if (stops) {
      if (p.scheme === "duo-gradient" && stops.length >= 2) {
        defs += `<linearGradient id="${id}g" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient>`;
        fill = `url(#${id}g)`;
      } else {
        fill = stops[0];
      }
      opacity = lerp(0.34, 0.62, energy); // bold = more present / saturated-looking
    } else {
      fill = tint;
      opacity = lerp(0.05, 0.17, energy); // calm wash → bolder neutral
    }
    // Sheen overlay — a diagonal SPECULAR BAND across the body. Its physics:
    //   • WIDTH from roughness: a low-roughness satin reflects in a tight lobe
    //     → a narrow bright stripe (peak ≈0.40..0.52, falls to zero fast). A
    //     rough cotton scatters → a wide, low plateau with no clean edge. The
    //     half-width `hw` grows from ~0.12 (silk) to ~0.42 (fleece).
    //   • INTENSITY from spec: peak white opacity tracks spec, so silk flashes
    //     bright and wool barely lifts.
    //   • CONTRAST from spec: only a glossy fabric darkens its shadow side; a
    //     matte fabric has almost no dark counter-stop (light just diffuses).
    // The band sits at the same diagonal (x2=0.65) the flat used before, so the
    // light direction is unchanged — only its sharpness/strength now read the
    // fabric. peak offset 0.40 keeps it off the very edge (a real highlight
    // doesn't hug the seam).
    const peak = 0.40;
    const hw = lerp(0.12, 0.42, rough);                         // band half-width
    const o0 = r(clamp(peak - hw, 0.02, 0.98));                 // band starts (transparent)
    const o2 = r(clamp(peak + hw, 0.02, 0.98));                 // band ends (transparent)
    // Softer than before: the directional key light below now carries most of
    // the form, so the specular band is a finishing sheen — bright on satin,
    // a whisper on matte — not a hard stripe that crosses a narrow garment.
    const hiOp = r(clamp(0.11 + spec * 0.30, 0.05, 0.44));      // peak highlight opacity
    const shOp = r(clamp(spec * 0.24, 0.0, 0.24));              // shadow-side darkening (contrast)
    defs += `<linearGradient id="${id}s" x1="0" y1="0" x2="0.65" y2="1">` +
      `<stop offset="0" stop-color="#fff" stop-opacity="0"/>` +
      `<stop offset="${o0}" stop-color="#fff" stop-opacity="0"/>` +
      `<stop offset="${peak}" stop-color="#fff" stop-opacity="${hiOp}"/>` +
      `<stop offset="${o2}" stop-color="#fff" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="#000" stop-opacity="${shOp}"/></linearGradient>`;
    // Volume/round-body shading: a soft centre highlight falling off to shaded
    // side seams (horizontal), so the flat reads as a garment ON a body with
    // depth instead of a paper cut-out. Roughness flattens this: a matte cotton
    // wraps light gently (low, even volume), a glossy/low-roughness fabric has a
    // tighter, brighter centre lift and deeper edge shade — closer to how the
    // photoreal renders catch light. Driven by spec (lift) + rough (softness).
    const volStr = clamp(0.10 + spec * 0.15, 0.10, 0.27);       // edge-shade depth (key light adds the rest)
    const volHi = r(volStr * lerp(0.95, 0.45, rough));          // centre lift: matte = weaker
    const volEdge = r(volStr * lerp(0.40, 0.30, rough));        // mid shade
    defs += `<linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="${r(volStr)}"/><stop offset="0.22" stop-color="#000" stop-opacity="${volEdge}"/><stop offset="0.5" stop-color="#fff" stop-opacity="${volHi}"/><stop offset="0.78" stop-color="#000" stop-opacity="${volEdge}"/><stop offset="1" stop-color="#000" stop-opacity="${r(volStr)}"/></linearGradient>`;

    // Directional STUDIO KEY LIGHT (the form cue). A single soft light from the
    // upper-left: a white lift across the top-left shoulder/chest falling to a
    // black shade at the lower-right hem — the same diagonal the sheen/light
    // direction already used (x2=0.65). This is what turns a flat fill into a
    // body with a near side and a far side; glossier cloth (high spec, low
    // roughness) catches a brighter, tighter key, matte cloth a gentle wide one.
    // linearGradient (NOT radial) on purpose so matte fabrics emit no
    // radialGradient — the satin streak stays the only radial cue.
    const keyHi = r(clamp(0.12 + spec * 0.20, 0.10, 0.34));     // upper-left lift
    const keyLo = r(clamp(0.14 + spec * 0.16 + (1 - rough) * 0.06, 0.12, 0.34)); // lower-right shade
    const keyMid = r(lerp(0.52, 0.40, rough));                  // glossy = highlight sits higher/tighter
    defs += `<linearGradient id="${id}kl" x1="0.08" y1="0" x2="0.92" y2="1">` +
      `<stop offset="0" stop-color="#fff" stop-opacity="${keyHi}"/>` +
      `<stop offset="${keyMid}" stop-color="#fff" stop-opacity="0"/>` +
      `<stop offset="${r(keyMid + 0.14)}" stop-color="#000" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="#000" stop-opacity="${keyLo}"/></linearGradient>`;
    let pat = "";
    if (p.pattern && p.pattern !== "none") { defs += patternDef(id + "p", p.pattern, clamp(num(p.patternScale, 0.5), 0.12, 1)); pat = `url(#${id}p)`; }

    // Per-material WEAVE grain — the perceptible material cue. The smooth
    // sheen/volume gradients above carry no spatial frequency, so silk/wool/
    // denim read alike (a redistributed gradient is measurable but invisible).
    // The eye names a fabric from its weave FREQUENCY (twill diagonal, linen
    // slub, wool nap), so a fine low-opacity <pattern> per material is what
    // actually makes them distinguishable. Constant-ink, deterministic → XSS-
    // safe exactly like patternDef. silk carries no weave (its cue is the
    // anisotropic streak below).
    let grain = "";
    const weave = weaveDef(id + "w", p.material);
    if (weave) { defs += weave; grain = `url(#${id}w)`; }

    // Silk / satin anisotropic streak: a stretched HORIZONTAL highlight that
    // reads as liquid satin — the glossy-end cue weave can't give. Gated high so
    // only genuinely glossy cloth gets it (silk; or any fabric the finish slider
    // pushes to a satin sheen) — matte/technical fabrics like polyester keep
    // their faint even sheen, no satin pool. White-only (constant) → XSS-safe.
    let streak = "";
    if (spec >= 0.72) {
      // A SOFT, flat satin pool — wide and low, sitting on the upper body, not a
      // bright hot blob. Flattened vertically (scale y 0.26) so it reads as
      // liquid satin catching light along the cloth, never a spotlight cross.
      const stOp = r(clamp(0.07 + spec * 0.16, 0.07, 0.24));
      defs += `<radialGradient id="${id}k" cx="0.5" cy="0.30" r="0.66" gradientTransform="translate(0 0.222) scale(1 0.26)">` +
        `<stop offset="0" stop-color="#fff" stop-opacity="${stOp}"/>` +
        `<stop offset="0.6" stop-color="#fff" stop-opacity="${r(stOp * 0.22)}"/>` +
        `<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
      streak = `url(#${id}k)`;
    }
    return { defs, fill, opacity, pat, grain, streak, sheen: `url(#${id}s)`, vol: `url(#${id}v)`, key: `url(#${id}kl)` };
  }

  // Per-material fabric grain tile (distinct from the decorative p.pattern).
  // Fine, low-opacity, constant-ink (never a DNA value → XSS-safe), fully
  // deterministic geometry. dk = shadow thread (toward the navy stage), lt =
  // lit thread. Tile sizes are small (viewBox units) so it reads as cloth
  // grain, not a motif. silk → "" (no weave; it gets the streak instead).
  function weaveDef(id, material) {
    const dk = (a) => `rgba(10,16,26,${a})`;
    const lt = (a) => `rgba(236,236,240,${a})`;
    switch (material) {
      case "denim": // indigo twill — parallel diagonal ribs
        return `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(63)"><line x1="0" y1="0" x2="0" y2="5" stroke="${dk(0.22)}" stroke-width="1.1"/><line x1="2.4" y1="0" x2="2.4" y2="5" stroke="${lt(0.07)}" stroke-width="0.7"/></pattern>`;
      case "linen": // plain weave with slubs — crossed irregular hairlines
        return `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"><line x1="0" y1="1.5" x2="7" y2="1.5" stroke="${dk(0.13)}" stroke-width="0.8"/><line x1="0" y1="4.5" x2="7" y2="4.5" stroke="${dk(0.1)}" stroke-width="1.3"/><line x1="1.5" y1="0" x2="1.5" y2="7" stroke="${dk(0.1)}" stroke-width="1.1"/><line x1="4.5" y1="0" x2="4.5" y2="7" stroke="${dk(0.13)}" stroke-width="0.7"/></pattern>`;
      case "cotton": // fine even plain weave — faint grid
        return `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse"><line x1="0" y1="2" x2="4" y2="2" stroke="${dk(0.07)}" stroke-width="0.7"/><line x1="2" y1="0" x2="2" y2="4" stroke="${dk(0.07)}" stroke-width="0.7"/></pattern>`;
      case "wool": // matte nap — soft stipple, no lines
        return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="2" r="0.85" fill="${dk(0.16)}"/><circle cx="4.3" cy="4.6" r="0.95" fill="${dk(0.14)}"/><circle cx="4" cy="1.2" r="0.6" fill="${lt(0.06)}"/><circle cx="2.2" cy="5" r="0.6" fill="${dk(0.12)}"/></pattern>`;
      case "fleece": // brushed pile — denser, softer stipple
        return `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.6" r="1" fill="${dk(0.13)}"/><circle cx="3.6" cy="3.8" r="1.15" fill="${dk(0.12)}"/><circle cx="3.8" cy="1" r="0.8" fill="${lt(0.05)}"/><circle cx="1" cy="4" r="0.8" fill="${dk(0.11)}"/></pattern>`;
      case "polyester": // tight technical weave — very faint fine verticals
        return `<pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse"><line x1="1" y1="0" x2="1" y2="3" stroke="${dk(0.06)}" stroke-width="0.6"/></pattern>`;
      default: // silk + unknown → no grain
        return "";
    }
  }

  // scale 0.12..1 → tile factor ~0.6..1.6 so "Mustergröße" visibly resizes.
  function patternDef(id, type, scale) {
    const ink = "rgba(236,236,240,0.22)";
    const f = 0.55 + clamp(num(scale, 0.5), 0, 1);
    const W = (n) => r(n * f);
    if (type === "stripe") return `<pattern id="${id}" width="${W(11)}" height="${W(11)}" patternUnits="userSpaceOnUse" patternTransform="rotate(8)"><rect width="${W(5.5)}" height="${W(11)}" fill="${ink}"/></pattern>`;
    if (type === "check") return `<pattern id="${id}" width="${W(15)}" height="${W(15)}" patternUnits="userSpaceOnUse"><rect width="${W(7.5)}" height="${W(7.5)}" fill="${ink}"/><rect x="${W(7.5)}" y="${W(7.5)}" width="${W(7.5)}" height="${W(7.5)}" fill="${ink}"/></pattern>`;
    if (type === "camo") return `<pattern id="${id}" width="${W(42)}" height="${W(42)}" patternUnits="userSpaceOnUse"><ellipse cx="${W(12)}" cy="${W(13)}" rx="${W(11)}" ry="${W(8)}" fill="${ink}"/><ellipse cx="${W(32)}" cy="${W(30)}" rx="${W(12)}" ry="${W(9)}" fill="${ink}"/><ellipse cx="${W(26)}" cy="${W(6)}" rx="${W(7)}" ry="${W(5)}" fill="${ink}"/></pattern>`;
    if (type === "graphic") return `<pattern id="${id}" width="${W(46)}" height="${W(46)}" patternUnits="userSpaceOnUse"><circle cx="${W(23)}" cy="${W(23)}" r="${W(8)}" fill="none" stroke="${ink}" stroke-width="3"/></pattern>`;
    return `<pattern id="${id}" width="${W(34)}" height="${W(34)}" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="M0 ${W(17)} Q${W(8)} ${W(5)} ${W(17)} ${W(17)} T${W(34)} ${W(17)}" fill="none" stroke="${ink}" stroke-width="2.4"/></pattern>`;
  }

  // ---- shared width model (tops) ------------------------------------------
  function topWidths(p, cfg) {
    const fit = clamp(num(p.fit, 0.5), 0, 1);
    const structure = clamp(num(p.structure, 0.5), 0, 1);
    const vol = p.volume === "high" ? 1 : p.volume === "low" ? -1 : 0;
    const drop = p.sleeve === "drop" || cfg.drop;
    // Shoulder is the widest point. Tuned narrower than before so tops read at
    // garment proportions (~40–60 % of frame, matching the photoreal renders)
    // instead of filling the box like a boxy slab — while keeping a clear
    // slim ↔ oversized spread.
    const shoulderHalf = 44 + structure * 6 + vol * 6 + fit * 12 + (drop ? 8 : 0);
    // Chest derived FROM the shoulder, ALWAYS narrower (capped so the invariant
    // "shoulder is widest" holds). Slim tapers hard from the shoulder line;
    // oversized fills almost to it.
    const chestHalf = Math.min(shoulderHalf - 2, shoulderHalf * lerp(0.74, 0.985, fit) + Math.max(0, vol) * 3);
    // slim nips the waist hard; oversized keeps it straight (boxy column).
    const waistHalf = chestHalf * lerp(0.74, 1.0, fit);
    // hem never wider than the chest (no bell). slim tapers in; oversized = column.
    const hemHalf = Math.min(chestHalf, chestHalf * lerp(0.82, 1.0, fit)) + (vol > 0 ? 4 : 0);
    return { shoulderHalf, chestHalf, waistHalf, hemHalf, fit, vol, drop };
  }

  function geometry(p, cfg) {
    const w = topWidths(p, cfg);
    const structure = clamp(num(p.structure, 0.5), 0, 1);
    const neckY = 60;
    // Soft (low structure) → lower, sloped shoulders; sharp → higher, squarer.
    const shoulderY = 66 - (structure - 0.5) * 9 + (w.drop ? 4 : 0);
    const armpitY = shoulderY + cfg.armDepth + (w.drop ? 12 : 0);
    const length = (cfg.hem[p.length] != null) ? p.length : "regular";
    const hemY = cfg.hem[length];
    const waistY = armpitY + (hemY - armpitY) * 0.42;
    const sleeveLen = sleeveLenFor(p, cfg);
    const sleeveless = sleeveLen <= 2;
    // Sleeveless: the "sleeve" collapses onto the armscye (straight shoulder→
    // armpit edge) instead of drawing limbs; splay/cuff shrink with the length
    // so short sleeves still read as real limbs, not stubs.
    const lenT = clamp(sleeveLen / 170, 0, 1);
    // Sleeves DRAPE down close to the body (how a garment photographs) instead
    // of splaying into a wide T: only a small outward offset at the cuff, and
    // the cuff tapers in from the shoulder so the limb reads as a hanging tube.
    // Splay scales INVERSELY with sleeve length (how garments photograph):
    // short tee sleeves stick out at an angle from the shoulder, long sleeves
    // hang nearly vertical — a constant small splay made short sleeves vanish
    // into the torso (tee read as sleeveless).
    const splay = sleeveless ? 0 : cfg.splay * lerp(0.72, 0.3, lenT) + (w.drop ? 3 : 0);
    const coX = sleeveless ? w.chestHalf : w.shoulderHalf + splay;   // outer cuff edge
    const ciX = sleeveless ? w.chestHalf : Math.max(w.chestHalf + 1, coX - cfg.cuffW * lerp(0.82, 1.15, lenT)); // inner cuff edge
    const wristY = sleeveless ? armpitY : shoulderY + sleeveLen + (w.drop ? 6 : 0);
    const collar = p.collar || cfg.defCollar;
    const neckHalf = neckHalfFor(collar, cfg);
    return Object.assign(w, { neckY, shoulderY, armpitY, hemY, waistY, coX, ciX, wristY, collar, neckHalf, length, sleeveless });
  }

  function neckHalfFor(collar, cfg) {
    if (collar === "crew") return 22;
    if (collar === "vneck") return 20;
    if (collar === "hood") return 19;
    if (collar === "shirt") return 17;
    if (collar === "none") return 18;
    return cfg.neckHalf || 18;
  }

  // Neckline piece: drawn from R(neckHalf),neckY across the top to L(neckHalf),neckY.
  function neckline(g) {
    if (g.collar === "crew") return `Q ${CX} ${Y(g.neckY + 15)} ${L(g.neckHalf)} ${Y(g.neckY)}`;
    if (g.collar === "vneck") return `L ${CX} ${Y(g.neckY + 30)} L ${L(g.neckHalf)} ${Y(g.neckY)}`;
    if (g.collar === "notched") return `L ${CX} ${Y(g.neckY + 22)} L ${L(g.neckHalf)} ${Y(g.neckY)}`;
    return `Q ${CX} ${Y(g.neckY + 7)} ${L(g.neckHalf)} ${Y(g.neckY)}`;
  }

  // Closed outline incl. always-visible sleeves; armpit is a deliberate notch.
  function outline(g) {
    return (
      `M ${L(g.neckHalf)} ${Y(g.neckY)} ` +
      `L ${L(g.shoulderHalf)} ${Y(g.shoulderY)} ` +
      `L ${L(g.coX)} ${Y(g.wristY)} ` +
      `L ${L(g.ciX)} ${Y(g.wristY)} ` +
      `L ${L(g.chestHalf)} ${Y(g.armpitY)} ` +
      `C ${L(g.waistHalf)} ${Y(g.waistY - 8)} ${L(g.waistHalf)} ${Y(g.waistY)} ${L(g.hemHalf)} ${Y(g.hemY - 8)} ` +
      `L ${L(g.hemHalf)} ${Y(g.hemY)} ` +
      `L ${R(g.hemHalf)} ${Y(g.hemY)} ` +
      `L ${R(g.hemHalf)} ${Y(g.hemY - 8)} ` +
      `C ${R(g.waistHalf)} ${Y(g.waistY)} ${R(g.waistHalf)} ${Y(g.waistY - 8)} ${R(g.chestHalf)} ${Y(g.armpitY)} ` +
      `L ${R(g.ciX)} ${Y(g.wristY)} ` +
      `L ${R(g.coX)} ${Y(g.wristY)} ` +
      `L ${R(g.shoulderHalf)} ${Y(g.shoulderY)} ` +
      `L ${R(g.neckHalf)} ${Y(g.neckY)} ` +
      neckline(g) + " Z"
    );
  }

  // Internal seam + component lines (armscye, closure, collar, cuffs, hem…).
  function seams(g, p, cfg) {
    const s = [];
    const line = (d, sw, op) => s.push(`<path d="${d}" fill="none" stroke="${SEAM}" stroke-width="${sw || 2}" stroke-linejoin="round" stroke-linecap="round"${op ? ` opacity="${op}"` : ""}/>`);

    // Armscye seam — sleeve separated from torso (raglan runs to the neck).
    if (p.sleeve === "raglan") {
      line(`M ${L(g.neckHalf + 4)} ${Y(g.neckY + 6)} L ${L(g.chestHalf - 2)} ${Y(g.armpitY)}`, 2);
      line(`M ${R(g.neckHalf + 4)} ${Y(g.neckY + 6)} L ${R(g.chestHalf - 2)} ${Y(g.armpitY)}`, 2);
    } else {
      line(`M ${L(g.shoulderHalf)} ${Y(g.shoulderY)} L ${L(g.chestHalf)} ${Y(g.armpitY)}`, 2);
      line(`M ${R(g.shoulderHalf)} ${Y(g.shoulderY)} L ${R(g.chestHalf)} ${Y(g.armpitY)}`, 2);
    }

    // Collar overlays.
    const cy0 = g.neckY;
    if (g.collar === "stand") s.push(`<path d="M ${L(g.neckHalf)} ${Y(cy0 + 2)} L ${L(g.neckHalf + 3)} ${Y(cy0 - 11)} L ${R(g.neckHalf + 3)} ${Y(cy0 - 11)} L ${R(g.neckHalf)} ${Y(cy0 + 2)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`);
    if (g.collar === "shirt") {
      s.push(`<path d="M ${L(g.neckHalf)} ${Y(cy0 + 1)} L ${L(g.neckHalf + 11)} ${Y(cy0 + 20)} L ${L(2)} ${Y(cy0 + 8)} Z" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`);
      s.push(`<path d="M ${R(g.neckHalf)} ${Y(cy0 + 1)} L ${R(g.neckHalf + 11)} ${Y(cy0 + 20)} L ${R(2)} ${Y(cy0 + 8)} Z" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`);
    }
    if (g.collar === "notched") {
      s.push(`<path d="M ${L(g.neckHalf)} ${Y(cy0 + 1)} L ${L(6)} ${Y(cy0 + 22)} L ${L(g.neckHalf + 13)} ${Y(cy0 + 30)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`);
      s.push(`<path d="M ${R(g.neckHalf)} ${Y(cy0 + 1)} L ${R(6)} ${Y(cy0 + 22)} L ${R(g.neckHalf + 13)} ${Y(cy0 + 30)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`);
    }
    if (g.collar === "hood") {
      s.push(`<path d="M ${L(g.neckHalf + 2)} ${Y(cy0 + 3)} C ${L(g.shoulderHalf - 4)} ${Y(cy0 - 30)} ${R(g.shoulderHalf - 4)} ${Y(cy0 - 30)} ${R(g.neckHalf + 2)} ${Y(cy0 + 3)}" fill="rgba(255,255,255,0.04)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`);
      // drawcord
      line(`M ${L(6)} ${Y(cy0 + 18)} L ${L(5)} ${Y(cy0 + 40)} M ${R(6)} ${Y(cy0 + 18)} L ${R(5)} ${Y(cy0 + 40)}`, 1.8);
    }
    if (g.collar === "crew") line(`M ${L(g.neckHalf - 2)} ${Y(g.neckY + 1)} Q ${CX} ${Y(g.neckY + 19)} ${R(g.neckHalf - 2)} ${Y(g.neckY + 1)}`, 1.6, 0.7);

    // Centre-front closure. Hardware finish tints it: shiny metal = bright stroke
    // + glint, matte/tonal = the dim seam tone (so "Hardware-Finish" lands visibly).
    const top = g.neckY + (g.collar === "crew" || g.collar === "vneck" ? 26 : 12);
    const hw = p.hardware === "metal" ? INK : SEAM;
    const hwW = p.hardware === "metal" ? 2.8 : 2.4;
    if (p.closure === "zip" || (cfg.closure === "zip" && p.closure == null)) {
      s.push(`<path d="M ${CX} ${Y(top)} L ${CX} ${Y(g.hemY - 4)}" fill="none" stroke="${hw}" stroke-width="${hwW}" stroke-dasharray="3 2.4"/>`);
      if (p.hardware === "metal") s.push(`<circle cx="${CX}" cy="${Y(top + 6)}" r="2.6" fill="${INK}"/>`);
    } else if (p.closure === "button" || (cfg.closure === "button" && p.closure == null)) {
      const n = 6; for (let i = 0; i < n; i++) { const y = top + 8 + (i * (g.hemY - top - 16)) / (n - 1); s.push(`<circle cx="${CX}" cy="${Y(y)}" r="2.3" fill="${p.hardware === "metal" ? INK : "none"}" stroke="${hw}" stroke-width="1.8"/>`); }
      line(`M ${CX} ${Y(top)} L ${CX} ${Y(g.hemY - 4)}`, 1.4, 0.5);
    } else if (p.closure === "half") {
      // Half placket (popover / quarter-zip): short centre opening + 3 buttons.
      const phEnd = top + (g.armpitY - top) * 0.9 + 14;
      line(`M ${CX} ${Y(top)} L ${CX} ${Y(phEnd)}`, 1.6, 0.7);
      for (let i = 0; i < 3; i++) { const y = top + 8 + (i * (phEnd - top - 14)) / 2; s.push(`<circle cx="${CX}" cy="${Y(y)}" r="2" fill="${p.hardware === "metal" ? INK : "none"}" stroke="${hw}" stroke-width="1.6"/>`); }
    } else if (p.closure === "none" && cfg.closure !== "none") {
      line(`M ${CX} ${Y(top)} L ${L(8)} ${Y(g.hemY)} M ${CX} ${Y(top)} L ${R(8)} ${Y(g.hemY)}`, 1.6, 0.7);
    }

    // Pockets.
    const py = g.hemY - 50;
    if (p.pockets === "kangaroo" || (g.collar === "hood" && !p.pockets)) line(`M ${L(g.chestHalf - 6)} ${Y(py + 6)} L ${L(g.chestHalf - 6)} ${Y(py + 30)} L ${R(g.chestHalf - 6)} ${Y(py + 30)} L ${R(g.chestHalf - 6)} ${Y(py + 6)}`, 1.8, 0.8);
    if (p.pockets === "flap") { s.push(`<rect x="${L(g.chestHalf - 4)}" y="${Y(py)}" width="26" height="13" rx="2" fill="none" stroke="${SEAM}" stroke-width="1.6"/>`); s.push(`<rect x="${R(g.chestHalf - 4) - 26}" y="${Y(py)}" width="26" height="13" rx="2" fill="none" stroke="${SEAM}" stroke-width="1.6"/>`); }
    if (p.pockets === "cargo") { s.push(`<rect x="${L(g.chestHalf - 2)}" y="${Y(py - 4)}" width="28" height="24" rx="2" fill="none" stroke="${SEAM}" stroke-width="1.8"/>`); s.push(`<rect x="${R(g.chestHalf - 2) - 28}" y="${Y(py - 4)}" width="28" height="24" rx="2" fill="none" stroke="${SEAM}" stroke-width="1.8"/>`); }
    if (p.pockets === "side") line(`M ${L(g.waistHalf - 4)} ${Y(py + 4)} l 18 5 M ${R(g.waistHalf - 4)} ${Y(py + 4)} l -18 5`, 1.8);
    if (p.pockets === "chest") s.push(`<rect x="${L(g.chestHalf - 8)}" y="${Y(g.armpitY + 8)}" width="17" height="15" rx="1.5" fill="none" stroke="${SEAM}" stroke-width="1.8"/>`);

    // Cuffs (only when there are sleeves to cuff).
    if (!g.sleeveless) {
      if (p.cuffs === "ribbed" || (g.collar === "hood" && !p.cuffs)) { line(`M ${L(g.coX)} ${Y(g.wristY - 11)} L ${L(g.ciX)} ${Y(g.wristY - 11)} M ${R(g.coX)} ${Y(g.wristY - 11)} L ${R(g.ciX)} ${Y(g.wristY - 11)}`, 1.6, 0.8); }
      else if (p.cuffs === "button") { s.push(`<circle cx="${L((g.coX + g.ciX) / 2)}" cy="${Y(g.wristY - 7)}" r="1.6" fill="none" stroke="${SEAM}" stroke-width="1.4"/><circle cx="${R((g.coX + g.ciX) / 2)}" cy="${Y(g.wristY - 7)}" r="1.6" fill="none" stroke="${SEAM}" stroke-width="1.4"/>`); }
    }

    // Hem treatment.
    if (p.hem === "ribbed" || (g.collar === "hood" && !p.hem)) line(`M ${L(g.hemHalf)} ${Y(g.hemY - 9)} L ${R(g.hemHalf)} ${Y(g.hemY - 9)}`, 1.6, 0.7);
    else if (p.hem === "drawcord") line(`M ${L(g.hemHalf)} ${Y(g.hemY - 6)} L ${R(g.hemHalf)} ${Y(g.hemY - 6)}`, 1.6, 0.6);
    else if (p.hem === "curved") line(`M ${L(g.hemHalf)} ${Y(g.hemY - 12)} Q ${CX} ${Y(g.hemY - 2)} ${R(g.hemHalf)} ${Y(g.hemY - 12)}`, 1.6, 0.6);
    else line(`M ${L(g.hemHalf)} ${Y(g.hemY - 5)} L ${R(g.hemHalf)} ${Y(g.hemY - 5)}`, 1.2, 0.4);

    // Signature detail (Phase-E choice, now visible on the flat).
    const sig = Array.isArray(p.signature) ? p.signature : [];
    if (sig.includes("contrast-stitch")) {
      s.push(`<path d="M ${L(g.chestHalf - 10)} ${Y(g.armpitY + 6)} L ${L(g.waistHalf - 8)} ${Y(g.hemY - 14)} M ${R(g.chestHalf - 10)} ${Y(g.armpitY + 6)} L ${R(g.waistHalf - 8)} ${Y(g.hemY - 14)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="2 3" opacity="0.9"/>`);
    }
    if (sig.includes("asymmetric-zip")) {
      s.push(`<path d="M ${L(g.neckHalf - 4)} ${Y(g.neckY + 10)} L ${R(g.chestHalf * 0.4)} ${Y(g.hemY - 6)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-dasharray="3 2.4"/>`);
    }
    if (sig.includes("branding-patch")) {
      s.push(`<rect x="${L(g.chestHalf - 6)}" y="${Y(g.armpitY + 10)}" width="14" height="9" rx="1.5" fill="none" stroke="${INK}" stroke-width="1.6"/>`);
    }
    // Puffer subarchetype → horizontal quilting channels make it unmistakable.
    if (p.subArchetype === "puffer") {
      for (let i = 1; i <= 4; i++) { const y = g.armpitY + ((g.hemY - g.armpitY) * i) / 5; line(`M ${L(g.chestHalf - 3)} ${Y(y)} L ${R(g.chestHalf - 3)} ${Y(y)}`, 1.2, 0.5); }
    }

    return s.join("");
  }

  // ---- cloth drape (the "real fabric" cue) ---------------------------------
  // Soft creases + self-shadows derived from the geometry and the fabric's
  // drape. A fold is a wide DIM valley with a thin BRIGHT ridge riding the same
  // curve, so it reads as cloth catching light in a crease — not a drawn line.
  // Drape scales with material softness and INVERSELY with structure (a tailored
  // piece hangs stiff with few breaks; jersey/silk ripples). All ink is
  // constant (#06101c shadow / #fff highlight) → XSS-safe like the seams.
  const DRAPE = { silk: 0.95, fleece: 0.82, wool: 0.70, cotton: 0.55, linen: 0.64, polyester: 0.42, denim: 0.30 };
  function drapeFor(p) {
    const base = DRAPE[p && p.material] != null ? DRAPE[p.material] : 0.5;
    const structure = clamp(num(p && p.structure, 0.5), 0, 1);
    return clamp(base * lerp(1.12, 0.62, structure), 0.16, 1);
  }
  // One crease: a dim valley with a finer highlight ridge along the same path.
  function crease(d, intensity) {
    const k = clamp(intensity, 0, 1);
    const w = r(2.4 * k + 1.4);
    return `<path d="${d}" fill="none" stroke="#06101c" stroke-width="${w}" stroke-opacity="${r(0.08 + 0.07 * k)}" stroke-linecap="round" stroke-linejoin="round"/>` +
           `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="${r(0.045 + 0.06 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // A soft self-shadow: a thick, very dim, round-capped stroke (round caps make
  // the ends fade) — no SVG filter, no extra gradient → fast + XSS-safe.
  function shadeStroke(d, w, op) {
    return `<path d="${d}" fill="none" stroke="#06101c" stroke-width="${r(w)}" stroke-opacity="${r(op)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Torso/sleeve drape for tops + (reused by) dresses' bodice.
  function topFolds(g, p) {
    const dr = drapeFor(p);
    const out = [];
    const top = g.armpitY + 10, bot = g.hemY - 12;
    if (bot > top + 18) {
      // Vertical drape folds across the torso, swaying gently. Skip the dead
      // centre when a placket/zip already lives there.
      const hasCenter = !(p.closure === "zip" || p.closure === "button" || p.closure === "half");
      const n = Math.round(lerp(2, 5, dr));
      for (let i = 0; i < n; i++) {
        const t = n <= 1 ? 0.5 : i / (n - 1);
        const fx = lerp(-g.chestHalf * 0.6, g.chestHalf * 0.6, t);
        if (hasCenter || Math.abs(fx) > g.chestHalf * 0.18) {
          const sway = (i % 2 ? 1 : -1) * lerp(1.4, 4.6, dr);
          const x0 = CX + fx * 0.94, x1 = CX + fx, x2 = CX + fx * 1.03;
          const d = `M ${r(x0)} ${Y(top)} C ${r(x1 + sway)} ${Y(lerp(top, bot, 0.42))} ${r(x1 - sway)} ${Y(lerp(top, bot, 0.72))} ${r(x2)} ${Y(bot)}`;
          out.push(crease(d, dr * (0.62 + 0.5 * (1 - Math.abs(0.5 - t) * 2))));
        }
      }
    }
    // Under-collar cast shadow hugging the neckline.
    out.push(shadeStroke(`M ${L(g.neckHalf - 1)} ${Y(g.neckY + 5)} Q ${CX} ${Y(g.neckY + 19)} ${R(g.neckHalf - 1)} ${Y(g.neckY + 5)}`, 6.5, 0.16));
    // Under-arm drape shadow easing from each armpit toward the waist.
    const ub = lerp(g.armpitY, g.hemY, 0.34);
    out.push(shadeStroke(`M ${L(g.chestHalf - 2)} ${Y(g.armpitY + 3)} Q ${L(g.chestHalf - 12)} ${Y((g.armpitY + ub) / 2)} ${L(g.waistHalf - 1)} ${Y(ub)}`, 8, 0.07 + 0.08 * dr));
    out.push(shadeStroke(`M ${R(g.chestHalf - 2)} ${Y(g.armpitY + 3)} Q ${R(g.chestHalf - 12)} ${Y((g.armpitY + ub) / 2)} ${R(g.waistHalf - 1)} ${Y(ub)}`, 8, 0.07 + 0.08 * dr));
    // Sleeve break folds — sleeves read as tubes of cloth, not flat planks.
    if (!g.sleeveless && g.wristY > g.shoulderY + 30) {
      const sMid = lerp(g.shoulderY, g.wristY, 0.5);
      out.push(crease(`M ${L((g.ciX + g.coX) / 2)} ${Y(sMid)} q ${-4} ${r((g.wristY - sMid) * 0.42)} ${-1} ${r((g.wristY - sMid) * 0.72)}`, dr * 0.75));
      out.push(crease(`M ${R((g.ciX + g.coX) / 2)} ${Y(sMid)} q ${4} ${r((g.wristY - sMid) * 0.42)} ${1} ${r((g.wristY - sMid) * 0.72)}`, dr * 0.75));
    }
    return out.join("");
  }

  function paintTop(p, cfg, g) {
    return renderFlat(p, [outline(g)], seams(g, p, cfg), topFolds(g, p), { y: g.hemY, half: Math.max(g.hemHalf, g.shoulderHalf * 0.66) });
  }
  function topFlat(category, p) {
    const cfg = CFG[category] || CFG.jacket;
    return paintTop(p, cfg, geometry(p, cfg));
  }

  // ---- pants (different topology: waistband + two legs, no torso) ----------
  function pantsGeom(p) {
    const fit = clamp(num(p.fit, 0.5), 0, 1);
    const vol = p.volume === "high" ? 1 : p.volume === "low" ? -1 : 0;
    const topY = 70, hemY = { cropped: 250, regular: 300, long: 318 }[p.length] || 300;
    const hipHalf = 44 + vol * 7;
    const legTop = hipHalf;
    // CONTINUOUS slim↔wide morph (no step jumps) so the fit slider visibly
    // reshapes the leg frame by frame. Wide-leg must stay FULL down to the hem
    // (the photoreal wide trousers fall straight, not taper to sticks), so the
    // ankle width tracks the leg-top width at high fit instead of pinching in.
    const thighHalf = lerp(13, 40, fit) + vol * 6;
    const ankleHalf = clamp(lerp(7, legTop * 0.92, fit) + Math.max(0, vol) * 4, 6, legTop);
    const crotchY = topY + 96;
    return { fit, vol, topY, hemY, hipHalf, legTop, thighHalf, ankleHalf, crotchY };
  }
  // Trouser drape: hip/crotch easing folds + knee break + soft front-thigh
  // shadow. The straight fall lines already drawn in paintPants give the leg
  // structure; these add the way cloth gathers and breaks when worn.
  function pantsFolds(g, p) {
    const dr = drapeFor(p);
    const { hemY, legTop, thighHalf, ankleHalf, crotchY } = g;
    const out = [];
    const ix = thighHalf * 0.05;
    const lc = -(ankleHalf + ix) / 2;        // left leg centre at the hem
    // Crotch radiating folds — short diagonals fanning down from the seat.
    out.push(crease(`M ${CX} ${Y(crotchY - 6)} q ${-10} ${8} ${-14} ${20}`, dr * 0.7));
    out.push(crease(`M ${CX} ${Y(crotchY - 6)} q ${10} ${8} ${14} ${20}`, dr * 0.7));
    // Hip-to-crotch soft shade on each side (where trousers pull across the hip).
    out.push(shadeStroke(`M ${L(legTop - 3)} ${Y(g.topY + 22)} Q ${L(legTop * 0.4)} ${Y(crotchY - 14)} ${L(3)} ${Y(crotchY)}`, 8, 0.06 + 0.06 * dr));
    out.push(shadeStroke(`M ${R(legTop - 3)} ${Y(g.topY + 22)} Q ${R(legTop * 0.4)} ${Y(crotchY - 14)} ${R(3)} ${Y(crotchY)}`, 8, 0.06 + 0.06 * dr));
    // Knee break — a faint crease across each leg, deeper on soft cloth.
    if (dr > 0.4) {
      const ky = lerp(crotchY, hemY, 0.56);
      out.push(crease(`M ${r(CX + lc - thighHalf * 0.5)} ${Y(ky - 3)} q ${r(thighHalf * 0.5)} ${5} ${r(thighHalf)} ${0}`, dr * 0.6));
      out.push(crease(`M ${r(CX - lc - thighHalf * 0.5)} ${Y(ky - 3)} q ${r(thighHalf * 0.5)} ${5} ${r(thighHalf)} ${0}`, dr * 0.6));
    }
    return out.join("");
  }
  function paintPants(p, g) {
    const { topY, hemY, legTop, thighHalf, ankleHalf, crotchY } = g;
    const path =
      `M ${L(legTop)} ${Y(topY)} L ${R(legTop)} ${Y(topY)} ` +
      `L ${R(ankleHalf + thighHalf * 0.0)} ${Y(hemY)} L ${R(thighHalf * 0.05)} ${Y(hemY)} ` +
      `L ${R(2)} ${Y(crotchY)} L ${L(2)} ${Y(crotchY)} ` +
      `L ${L(thighHalf * 0.05)} ${Y(hemY)} L ${L(ankleHalf + thighHalf * 0.0)} ${Y(hemY)} Z`;
    const seam = [];
    const line = (d, sw, op) => seam.push(`<path d="${d}" fill="none" stroke="${SEAM}" stroke-width="${sw || 1.6}" stroke-linejoin="round" stroke-linecap="round"${op ? ` opacity="${op}"` : ""}/>`);
    // Waistband panel + style (belt loops / drawcord / elastic channels).
    seam.push(`<path d="M ${L(legTop)} ${Y(topY)} L ${R(legTop)} ${Y(topY)} L ${R(legTop - 1)} ${Y(topY + 16)} L ${L(legTop - 1)} ${Y(topY + 16)} Z" fill="rgba(255,255,255,0.05)" stroke="${SEAM}" stroke-width="1.8"/>`);
    if (p.waistband === "belt") {
      for (const x of [-legTop + 9, -legTop / 2, legTop / 2 - 4, legTop - 9]) seam.push(`<rect x="${r(CX + x - 2)}" y="${Y(topY + 1.5)}" width="4" height="13" fill="none" stroke="${SEAM}" stroke-width="1.4"/>`);
      seam.push(`<circle cx="${CX}" cy="${Y(topY + 8)}" r="2.4" fill="none" stroke="${p.hardware === "metal" ? INK : SEAM}" stroke-width="1.6"/>`);
    } else if (p.waistband === "drawcord") {
      line(`M ${L(7)} ${Y(topY + 16)} L ${L(5)} ${Y(topY + 34)} M ${R(7)} ${Y(topY + 16)} L ${R(5)} ${Y(topY + 34)}`, 1.6, 0.85);
    } else if (p.waistband === "elastic") {
      for (let i = 0; i < 3; i++) line(`M ${L(legTop - 3)} ${Y(topY + 4 + i * 4.5)} L ${R(legTop - 3)} ${Y(topY + 4 + i * 4.5)}`, 1, 0.55);
    }
    seam.push(`<path d="M ${CX} ${Y(topY + 16)} L ${CX} ${Y(crotchY)}" fill="none" stroke="${SEAM}" stroke-width="1.4" opacity="0.6"/>`);
    // Creases (tailored) or plain inseam fall lines.
    if (p.structure != null && clamp(num(p.structure, 0.5), 0, 1) > 0.66) {
      line(`M ${L((thighHalf + ankleHalf) * 0.32)} ${Y(crotchY + 4)} L ${L(ankleHalf * 0.55)} ${Y(hemY - 4)}`, 1.3, 0.7);
      line(`M ${R((thighHalf + ankleHalf) * 0.32)} ${Y(crotchY + 4)} L ${R(ankleHalf * 0.55)} ${Y(hemY - 4)}`, 1.3, 0.7);
    } else {
      line(`M ${L(thighHalf * 0.5)} ${Y(topY + 22)} L ${L(ankleHalf * 0.7)} ${Y(hemY - 4)}`, 1.1, 0.45);
      line(`M ${R(thighHalf * 0.5)} ${Y(topY + 22)} L ${R(ankleHalf * 0.7)} ${Y(hemY - 4)}`, 1.1, 0.45);
    }
    if (p.pockets === "cargo") {
      // patch cargo pockets on the thighs — clearly different from slash pockets
      const py = crotchY + 14, pw = r(thighHalf * 0.9), ph = 30;
      seam.push(`<rect x="${L(thighHalf - 2)}" y="${Y(py)}" width="${pw}" height="${ph}" rx="2" fill="none" stroke="${SEAM}" stroke-width="1.6"/><rect x="${R(thighHalf - 2) - pw}" y="${Y(py)}" width="${pw}" height="${ph}" rx="2" fill="none" stroke="${SEAM}" stroke-width="1.6"/>`);
    } else if (p.pockets && p.pockets !== "none") {
      // side: slash pockets at the hip
      seam.push(`<path d="M ${L(legTop - 4)} ${Y(topY + 20)} l -10 12 M ${R(legTop - 4)} ${Y(topY + 20)} l 10 12" fill="none" stroke="${SEAM}" stroke-width="1.6"/>`);
    }
    // Leg hem finish: cuffed turn-up band / elastic rib / raw default.
    const hx = ankleHalf, ix = thighHalf * 0.05;
    if (p.hem === "cuffed") {
      line(`M ${L(hx)} ${Y(hemY - 13)} L ${L(ix)} ${Y(hemY - 13)} M ${R(hx)} ${Y(hemY - 13)} L ${R(ix)} ${Y(hemY - 13)}`, 1.8, 0.85);
    } else if (p.hem === "elastic" || p.hem === "ribbed") {
      line(`M ${L(hx)} ${Y(hemY - 9)} L ${L(ix)} ${Y(hemY - 9)} M ${R(hx)} ${Y(hemY - 9)} L ${R(ix)} ${Y(hemY - 9)}`, 1.4, 0.7);
      line(`M ${L(hx)} ${Y(hemY - 4.5)} L ${L(ix)} ${Y(hemY - 4.5)} M ${R(hx)} ${Y(hemY - 4.5)} L ${R(ix)} ${Y(hemY - 4.5)}`, 1, 0.5);
    }
    // Signature details on the trouser frame.
    const sig = Array.isArray(p.signature) ? p.signature : [];
    if (sig.includes("contrast-stitch")) {
      seam.push(`<path d="M ${L(legTop - 2)} ${Y(topY + 18)} L ${L(ankleHalf + 1)} ${Y(hemY - 4)} M ${R(legTop - 2)} ${Y(topY + 18)} L ${R(ankleHalf + 1)} ${Y(hemY - 4)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="2 3" opacity="0.9"/>`);
    }
    if (sig.includes("branding-patch")) {
      seam.push(`<rect x="${R(legTop - 18)}" y="${Y(topY + 3)}" width="14" height="9" rx="1.5" fill="none" stroke="${INK}" stroke-width="1.6"/>`);
    }
    return renderFlat(p, [path], seam.join(""), pantsFolds(g, p), { y: hemY, half: g.legTop * 1.02 });
  }

  // ---- dress (bodice → skirt) ---------------------------------------------
  const DRESS_CFG = { sleeveLen: 58, hem: { cropped: 250, regular: 300, long: 322 }, defCollar: "vneck", closure: "none", splay: 14, cuffW: 22, armDepth: 50, neckHalf: 18 };
  function dressGeom(p) {
    const cfg = DRESS_CFG;
    const w = topWidths(p, cfg);
    const sleeveLen0 = sleeveLenFor(p, cfg);
    const sleevelessTop = sleeveLen0 <= 2;
    const neckY = 60;
    // Sleeveless (slip/tank): the strap sits LOWER and the bust is closer up, so
    // the top reads as short soft straps over a scoop — not tall sharp peaks.
    const shoulderY = sleevelessTop ? 84 : 66;
    const armpitY = shoulderY + (sleevelessTop ? 32 : cfg.armDepth);
    const waistY = armpitY + 34;
    const hemY = cfg.hem[p.length] != null ? cfg.hem[p.length] : 300;
    // Waist emphasis: "fitted" nips the waist hard, "relaxed" barely shapes it.
    const waistHalf = w.chestHalf * (p.waist === "fitted" ? 0.72 : p.waist === "relaxed" ? 0.95 : 0.84);
    // CONTINUOUS A-line ↔ column morph: low fit = strong flare from the waist,
    // high fit = the hem stays at waist width (true straight sheath) — the
    // silhouette slider visibly sweeps the skirt instead of snapping. Slip /
    // column sub-archetypes are slim bias columns (the photoreal slip is a
    // narrow drape, NOT a wide A-line), so their flare cap is much tighter.
    const slim = p.subArchetype === "slip" || p.subArchetype === "column";
    const skirtHalf = lerp(w.chestHalf * (slim ? 1.12 : 1.85), waistHalf * 1.04, w.fit);
    const sleeveLen = sleeveLenFor(p, cfg);
    const sleeveless = sleeveLen <= 2;
    const lenT = clamp(sleeveLen / 170, 0, 1);
    const coX = sleeveless ? w.chestHalf : w.shoulderHalf + cfg.splay * lerp(0.55, 1, lenT);
    const ciX = sleeveless ? w.chestHalf : Math.max(w.chestHalf + 1, coX - cfg.cuffW * lerp(0.7, 1, lenT));
    const wristY = sleeveless ? armpitY : shoulderY + sleeveLen;
    const collar = p.collar || cfg.defCollar;
    const neckHalf = neckHalfFor(collar, cfg);
    // Sleeveless dress: pull the shoulder in to a soft narrow strap line near
    // the neck (slip silhouette) instead of a wide, sharply pointed shoulder.
    const shoulderHalf = sleeveless ? Math.max(neckHalf + 3, w.chestHalf * 0.5) : w.shoulderHalf;
    return { neckHalf, neckY, shoulderHalf, shoulderY, coX: sleeveless ? w.chestHalf : coX, ciX: sleeveless ? w.chestHalf : ciX, wristY, chestHalf: w.chestHalf, armpitY, waistHalf, waistY, hemHalf: skirtHalf, hemY, collar, sleeveless };
  }
  // Dress drape: the skirt is where cloth really moves — a fan of creases from
  // the waist widening to the hem (a silk slip ripples; a structured sheath
  // barely breaks), an under-bust shade, and a soft centre catch on slip/column.
  function dressFolds(g, p) {
    const dr = drapeFor(p);
    const out = [];
    const top = g.waistY + 4, bot = g.hemY - 8;
    const n = Math.round(lerp(3, 6, dr));
    for (let i = 0; i < n; i++) {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const wx = lerp(-g.waistHalf * 0.66, g.waistHalf * 0.66, t);   // at the waist
      const hx = lerp(-g.hemHalf * 0.82, g.hemHalf * 0.82, t);       // fans out at the hem
      const sway = (i % 2 ? 1 : -1) * lerp(1.2, 4, dr);
      const d = `M ${r(CX + wx)} ${Y(top)} C ${r(CX + lerp(wx, hx, 0.4) + sway)} ${Y(lerp(top, bot, 0.45))} ${r(CX + lerp(wx, hx, 0.75) - sway)} ${Y(lerp(top, bot, 0.78))} ${r(CX + hx)} ${Y(bot)}`;
      out.push(crease(d, dr * (0.6 + 0.5 * (1 - Math.abs(0.5 - t) * 2))));
    }
    // Under-bust soft shade just below the bodice seam.
    out.push(shadeStroke(`M ${L(g.chestHalf - 4)} ${Y(g.armpitY + 4)} Q ${CX} ${Y(g.armpitY + 16)} ${R(g.chestHalf - 4)} ${Y(g.armpitY + 4)}`, 7, 0.07 + 0.06 * dr));
    // Centre satin catch on slip/column — a faint vertical highlight ridge.
    if (p.subArchetype === "slip" || p.subArchetype === "column") {
      out.push(`<path d="M ${CX} ${Y(g.waistY + 6)} L ${CX} ${Y(g.hemY - 12)}" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="${r(0.03 + 0.035 * dr)}" stroke-linecap="round"/>`);
    }
    return out.join("");
  }
  function paintDress(p, g) {
    // Sleeveless (slip / tank): a thin strap at the shoulder and a SCOOPED
    // (concave) armhole down to the bust — not a straight diagonal that juts
    // out into sharp "horn" points. Sleeved dresses keep the limb edge.
    const mid = (g.shoulderY + g.armpitY) / 2;
    const armL = g.sleeveless
      ? `L ${L(g.shoulderHalf)} ${Y(g.shoulderY)} Q ${L(g.shoulderHalf - 2)} ${Y(mid)} ${L(g.chestHalf)} ${Y(g.armpitY)} `
      : `L ${L(g.shoulderHalf)} ${Y(g.shoulderY)} L ${L(g.coX)} ${Y(g.wristY)} L ${L(g.ciX)} ${Y(g.wristY)} L ${L(g.chestHalf)} ${Y(g.armpitY)} `;
    const armR = g.sleeveless
      ? `L ${R(g.chestHalf)} ${Y(g.armpitY)} Q ${R(g.shoulderHalf - 2)} ${Y(mid)} ${R(g.shoulderHalf)} ${Y(g.shoulderY)} L ${R(g.neckHalf)} ${Y(g.neckY)} `
      : `L ${R(g.chestHalf)} ${Y(g.armpitY)} L ${R(g.ciX)} ${Y(g.wristY)} L ${R(g.coX)} ${Y(g.wristY)} L ${R(g.shoulderHalf)} ${Y(g.shoulderY)} L ${R(g.neckHalf)} ${Y(g.neckY)} `;
    const d =
      `M ${L(g.neckHalf)} ${Y(g.neckY)} ` + armL +
      `L ${L(g.waistHalf)} ${Y(g.waistY)} L ${L(g.hemHalf)} ${Y(g.hemY)} L ${R(g.hemHalf)} ${Y(g.hemY)} L ${R(g.waistHalf)} ${Y(g.waistY)} ` +
      armR +
      neckline(g) + " Z";
    const seam = [];
    seam.push(`<path d="M ${L(g.shoulderHalf)} ${Y(g.shoulderY)} L ${L(g.chestHalf)} ${Y(g.armpitY)} M ${R(g.shoulderHalf)} ${Y(g.shoulderY)} L ${R(g.chestHalf)} ${Y(g.armpitY)}" fill="none" stroke="${SEAM}" stroke-width="2"/>`);
    seam.push(`<path d="M ${L(g.waistHalf)} ${Y(g.waistY)} L ${R(g.waistHalf)} ${Y(g.waistY)}" fill="none" stroke="${SEAM}" stroke-width="${p.waist === "fitted" ? 1.9 : 1.4}" opacity="${p.waist === "fitted" ? 0.85 : 0.6}"/>`);
    // Wrap dress: diagonal surplice bodice line + waist tie — the wrap choice
    // is visible, not just an invisible collar swap.
    if (p.subArchetype === "wrap") {
      seam.push(`<path d="M ${L(g.neckHalf - 2)} ${Y(g.neckY + 4)} L ${R(g.waistHalf - 4)} ${Y(g.waistY - 2)}" fill="none" stroke="${SEAM}" stroke-width="1.8" opacity="0.85"/>`);
      seam.push(`<path d="M ${R(g.waistHalf - 4)} ${Y(g.waistY + 2)} q 10 7 6 18 M ${R(g.waistHalf - 4)} ${Y(g.waistY + 2)} q 12 3 16 12" fill="none" stroke="${SEAM}" stroke-width="1.6" opacity="0.8"/>`);
    }
    // Slip dress: thin spaghetti straps over the strap shoulder line.
    if (g.sleeveless && (p.subArchetype === "slip" || p.collar === "vneck")) {
      seam.push(`<path d="M ${L(g.neckHalf + 2)} ${Y(g.neckY)} L ${L(g.shoulderHalf - 2)} ${Y(g.shoulderY)} M ${R(g.neckHalf + 2)} ${Y(g.neckY)} L ${R(g.shoulderHalf - 2)} ${Y(g.shoulderY)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.9"/>`);
    }
    // Signature: side slit on the skirt (reads instantly on midi/maxi).
    const sig = Array.isArray(p.signature) ? p.signature : [];
    if (sig.includes("side-slit")) {
      seam.push(`<path d="M ${L(g.hemHalf - 1)} ${Y(g.hemY)} L ${L(g.waistHalf + (g.hemHalf - g.waistHalf) * 0.55)} ${Y(g.waistY + (g.hemY - g.waistY) * 0.45)}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.95"/>`);
    }
    if (sig.includes("contrast-stitch")) {
      seam.push(`<path d="M ${L(g.waistHalf - 2)} ${Y(g.waistY + 6)} L ${L(g.hemHalf - 8)} ${Y(g.hemY - 8)} M ${R(g.waistHalf - 2)} ${Y(g.waistY + 6)} L ${R(g.hemHalf - 8)} ${Y(g.hemY - 8)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="2 3" opacity="0.9"/>`);
    }
    return renderFlat(p, [d], seam.join(""), dressFolds(g, p), { y: g.hemY, half: g.hemHalf });
  }

  // ---- assemble the SVG ----------------------------------------------------
  // p.reveal (0..1, default 1) stages the MATERIALISATION of the flat as the
  // journey matures: early answers show a faint sketch (light wash, dim seams),
  // later answers develop fill, sheen, pattern and details — the garment
  // visibly "entsteht" instead of appearing finished at the first question.
  function renderFlat(p, paths, seamMarkup, foldMarkup, ground) {
    const id = "g" + (++uid);
    const f = fillSpec(id, p);
    const reveal = clamp(num(p.reveal, 1), 0, 1);
    const fillOp = r(f.opacity * lerp(0.3, 1, reveal));
    const layerOp = r(lerp(0.12, 1, reveal));
    const seamOp = r(lerp(0.4, 1, reveal));
    const clipId = id + "clip";
    // Grounded CONTACT SHADOW — a soft pool drawn in-SVG just below the hem so
    // it tracks the garment's real footprint and morphs with it (a fixed CSS
    // shadow can't align to a cropped tee AND a maxi dress). Drawn first, behind
    // everything, so the piece sits IN the scene instead of floating on it.
    let groundDefs = "", groundShadow = "";
    if (ground && reveal > 0.01) {
      const gy = Y(num(ground.y, VH - 18) + 8);
      const grx = r(clamp(num(ground.half, 60) * 1.28, 22, CX - 4));
      const gop = r(0.4 * reveal);
      groundDefs = `<radialGradient id="${id}gs" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#03070c" stop-opacity="${gop}"/><stop offset="0.55" stop-color="#03070c" stop-opacity="${r(gop * 0.46)}"/><stop offset="1" stop-color="#03070c" stop-opacity="0"/></radialGradient>`;
      groundShadow = `<ellipse class="gs-ground" cx="${CX}" cy="${gy}" rx="${grx}" ry="9" fill="url(#${id}gs)"/>`;
    }
    // Clip every soft layer to the silhouette so shading, drape and AO never
    // bleed past the cloth edge.
    // The gs-* layer classes below (gs-ground / gs-int / gs-outline / gs-seams)
    // let CSS stage the one-time weave-in as a SEQUENCE (outline draws first,
    // seams stitch, panels fill last — roadmap §5.3) instead of one blanket
    // path animation. They carry no styling of their own.
    const clip = `<clipPath id="${clipId}">${paths.map((d) => `<path d="${d}"/>`).join("")}</clipPath>`;
    // Interior shading stack (back→front): flat colour → body volume → the
    // directional key light (form) → weave grain → decorative pattern → drape
    // folds → broad sheen → satin streak.
    const inner = paths.map((d) =>
      `<path d="${d}" fill="${f.fill}" fill-opacity="${fillOp}" stroke="none"/>` +
      (f.vol ? `<path d="${d}" fill="${f.vol}" stroke="none" opacity="${layerOp}"/>` : "") +
      (f.key ? `<path d="${d}" fill="${f.key}" stroke="none" opacity="${layerOp}"/>` : "") +
      (f.grain ? `<path d="${d}" fill="${f.grain}" stroke="none" opacity="${layerOp}"/>` : "") +
      (f.pat ? `<path d="${d}" fill="${f.pat}" stroke="none" opacity="${layerOp}"/>` : "") +
      (f.sheen ? `<path d="${d}" fill="${f.sheen}" stroke="none" opacity="${layerOp}"/>` : "") +
      (f.streak ? `<path d="${d}" fill="${f.streak}" stroke="none" opacity="${layerOp}"/>` : "")
    ).join("");
    const folds = foldMarkup ? `<g opacity="${r(lerp(0.0, 1, reveal))}">${foldMarkup}</g>` : "";
    // Edge ambient occlusion: dim strokes clipped to the interior darken every
    // silhouette edge AND concavity (armpit notch, leg gap, neckline) — the form
    // shadow a flat horizontal gradient can't give, the single biggest cue that
    // the cloth turns away from us. Two widths approximate a soft falloff. Kept
    // solid through the weave-in (inline dasharray:none) so it doesn't sweep.
    const aoOp = r(0.16 * reveal);
    const ao = paths.map((d) =>
      `<path d="${d}" fill="none" stroke="#04090f" stroke-width="13" stroke-opacity="${aoOp}" stroke-linejoin="round" style="stroke-dasharray:none"/>` +
      `<path d="${d}" fill="none" stroke="#04090f" stroke-width="5.5" stroke-opacity="${aoOp}" stroke-linejoin="round" style="stroke-dasharray:none"/>`
    ).join("");
    // Edge RIM light — a fine bright stroke riding just inside the silhouette,
    // over the AO turn. It reads as cloth catching the key light along its edge,
    // the cue that finally lifts dark fabrics (a black tee) off the flat plane.
    const rimOp = r(0.13 * reveal);
    const rim = paths.map((d) =>
      `<path d="${d}" fill="none" stroke="#dff1f4" stroke-width="1.6" stroke-opacity="${rimOp}" stroke-linejoin="round" style="stroke-dasharray:none"/>`
    ).join("");
    const interior = `<g class="gs-int" clip-path="url(#${clipId})">${inner}${folds}${ao}${rim}</g>`;
    // Crisp outline on top of all shading (this is the line that "draws in" on
    // the weave moment), then the construction seams.
    const outlineStroke = paths.map((d) =>
      `<path class="gs-outline" d="${d}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`
    ).join("");
    // Outer g takes the weave-in fade (CSS opacity), the inner g keeps the
    // maturity opacity as an ATTRIBUTE — a CSS animation with fill:both would
    // otherwise permanently override seamOp.
    const seams = seamMarkup ? `<g class="gs-seams"><g opacity="${seamOp}">${seamMarkup}</g></g>` : "";
    // pathLength=1 normalises every path so CSS can draw the flat in with one
    // stroke-dasharray animation (the genesis "weave-in" moment).
    return `<svg class="de-garment" viewBox="0 0 ${VB} ${VH}" aria-hidden="true"><defs>${f.defs}${clip}${groundDefs}</defs>${groundShadow}${interior}${outlineStroke}${seams}</svg>`
      .replace(/<path /g, '<path pathLength="1" ');
  }

  // ---- genesis nebula -------------------------------------------------------
  // The pre-category stage of the journey: no garment yet — an abstract flow of
  // fabric threads that reacts to the mood answers (energy excites the strokes,
  // structure straightens them, the leading archetype tints them) and gains
  // threads with every answer (seed). Deterministic per (seed,i) so re-renders
  // are stable and answering only ADDS material — the cloth is being spun
  // before it is woven into a silhouette.
  //
  // Split into model → paint (mirroring the garment flats) so render-preview
  // can TWEEN between two nebula states (roadmap §5.2): the hash-driven values
  // are param-independent, so a mood answer keeps every thread's anchors and
  // only swings its control points — the cloud visibly RE-TENSIONS (calm =
  // long slow arcs, bold = tight fast crossings) instead of redrawing.
  function nebulaModel(p) {
    const energy = clamp(num(p && p.energy, 0.5), 0, 1);
    const structure = clamp(num(p && p.structure, 0.5), 0, 1);
    const seed = Math.max(0, Math.floor(num(p && p.seed, 0)));
    const tint = (p && archTint(p.archetype)) || "#8b96a4";
    // Second, brighter ocean accent so the threads read as luminous fibre, not
    // grey scribble — aqua by default, warmed toward the archetype tint.
    const accentCol = (p && archTint(p.archetype)) ? "#64d6c4" : "#76c7c0";
    const cx = CX, cy = 158;
    const hash = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7 + 13.37) * 43758.5453; return s - Math.floor(s); };
    const count = Math.min(34, 14 + seed * 2);
    const amp = lerp(22, 82, energy);
    const threads = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + hash(i, 1) * 0.9;
      const rad = 54 + hash(i, 2) * 56;
      const px = -Math.sin(a), py = Math.cos(a);
      const w1 = (hash(i, 4) - 0.5) * 2 * amp, w2 = (hash(i, 5) - 0.5) * 2 * amp * lerp(1, 0.32, structure);
      const accent = hash(i, 6) > 0.62;
      threads.push({
        x0: cx + Math.cos(a) * rad, y0: cy + Math.sin(a) * rad * 1.25,
        x1: cx - Math.cos(a) * rad * (0.7 + hash(i, 3) * 0.5), y1: cy - Math.sin(a) * rad * 1.15,
        c1x: cx + px * w1, c1y: cy + py * w1 - 24,
        c2x: cx + px * w2, c2y: cy + py * w2 + 24,
        col: accent ? accentCol : tint,
        op: 0.18 + hash(i, 7) * (accent ? 0.5 : 0.3),
        sw: 1.1 + hash(i, 8) * (accent ? 1.9 : 1.1),
        // A few bright fibre nodes where threads originate — they pulse in CSS.
        node: (accent && hash(i, 9) > 0.5) ? { r: 1.4 + hash(i, 10) * 1.8, op: 0.4 + hash(i, 11) * 0.4 } : null,
      });
    }
    return { seed, energy, tint, accentCol, glowOp: 0.06 + energy * 0.09, threads };
  }

  function nebulaPaint(m) {
    if (!m) return "";
    const threads = [];
    const nodes = [];
    m.threads.forEach((th) => {
      const d = `M ${r(th.x0)} ${r(th.y0)} C ${r(th.c1x)} ${r(th.c1y)} ${r(th.c2x)} ${r(th.c2y)} ${r(th.x1)} ${r(th.y1)}`;
      // Bloom: a wide, very faint stroke under a crisp bright one (cheap glow,
      // no SVG filter so it stays fast on mobile).
      threads.push(`<path pathLength="1" d="${d}" fill="none" stroke="${th.col}" stroke-width="${r(th.sw * 3)}" stroke-linecap="round" opacity="${r(th.op * 0.16)}"/>`);
      threads.push(`<path pathLength="1" d="${d}" fill="none" stroke="${th.col}" stroke-width="${r(th.sw)}" stroke-linecap="round" opacity="${r(th.op)}"/>`);
      if (th.node) nodes.push(`<circle class="de-neb-node" cx="${r(th.x0)}" cy="${r(th.y0)}" r="${r(th.node.r)}" fill="${m.accentCol}" opacity="${r(th.node.op)}"/>`);
    });
    return `<svg class="de-garment de-nebula" viewBox="0 0 ${VB} ${VH}" aria-hidden="true">` +
      `<defs><radialGradient id="nbGlow${m.seed}" cx="0.5" cy="0.46" r="0.6"><stop offset="0" stop-color="${m.tint}" stop-opacity="${r(m.glowOp)}"/><stop offset="1" stop-color="${m.tint}" stop-opacity="0"/></radialGradient></defs>` +
      `<rect x="0" y="0" width="${VB}" height="${VH}" fill="url(#nbGlow${m.seed})"/>${threads.join("")}${nodes.join("")}</svg>`;
  }

  // Numeric geometry tweens a→b; colours snap to the target (archetype shifts
  // are rare and read fine as a cut). Threads only present in b — an answer
  // just ADDED material — fade in with t instead of popping.
  const NEB_LERP_KEYS = ["x0", "y0", "x1", "y1", "c1x", "c1y", "c2x", "c2y", "sw", "op"];
  function lerpNebulaModel(a, b, t) {
    if (!a || !b) return b;
    const threads = b.threads.map((tb, i) => {
      const ta = a.threads[i];
      const th = Object.assign({}, tb);
      if (!ta) {
        th.op = tb.op * t;
        if (tb.node) th.node = { r: tb.node.r, op: tb.node.op * t };
        return th;
      }
      NEB_LERP_KEYS.forEach((k) => { th[k] = lerp(ta[k], tb[k], t); });
      return th;
    });
    return { seed: b.seed, energy: b.energy, tint: b.tint, accentCol: b.accentCol, glowOp: lerp(a.glowOp, b.glowOp, t), threads };
  }

  function nebula(p) {
    return nebulaPaint(nebulaModel(p));
  }

  // ---- morph model -------------------------------------------------------
  // A "model" snapshots the resolved geometry for a category. Because the
  // numeric fields of two models of the SAME category can be interpolated,
  // render-preview can lerp from the previous design to the new one frame by
  // frame, so each decision visibly RESHAPES the garment instead of swapping.
  // Discrete choices (collar/closure/pockets) snap to the target; only the
  // shape (widths, lengths, hems) tweens.
  function model(category, params) {
    const p = params || {};
    const cat = (category || "jacket").toLowerCase();
    if (cat === "pants") return { cat, kind: "pants", p, g: pantsGeom(p) };
    if (cat === "dress") return { cat, kind: "dress", p, g: dressGeom(p) };
    const realCat = CFG[cat] ? cat : "tshirt";
    const cfg = CFG[realCat];
    return { cat: realCat, kind: "top", p, cfg, g: geometry(p, cfg) };
  }

  function paint(m) {
    if (!m) return "";
    if (m.kind === "pants") return paintPants(m.p, m.g);
    if (m.kind === "dress") return paintDress(m.p, m.g);
    return paintTop(m.p, m.cfg, m.g);
  }

  // Interpolated model: numeric geometry fields lerp a→b; everything else
  // (discrete params, collar/length strings, cfg) takes the target b. If the
  // models aren't the same category/kind the shapes aren't comparable, so we
  // just return the target (caller crossfades / snaps).
  function lerpModel(a, b, t) {
    if (!a || !b || a.cat !== b.cat || a.kind !== b.kind) return b;
    const g = {};
    for (const k in b.g) {
      const bv = b.g[k], av = a.g[k];
      g[k] = (typeof bv === "number" && typeof av === "number") ? lerp(av, bv, t) : bv;
    }
    return { cat: b.cat, kind: b.kind, p: b.p, cfg: b.cfg, g };
  }

  function build(category, params) {
    return paint(model(category, params));
  }

  return { build, model, paint, lerpModel, nebula, nebulaModel, nebulaPaint, lerpNebulaModel, jacketSvg: (p) => topFlat("jacket", p || {}) };
})();

if (typeof window !== "undefined") window.GarmentSVG = GarmentSVG;
if (typeof module !== "undefined" && module.exports) module.exports = GarmentSVG;
