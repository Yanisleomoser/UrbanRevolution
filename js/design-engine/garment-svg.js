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

  // Material → baseline sheen (silk glossy, denim/wool matte). finish (matt↔
  // glänzend) scales on top. Makes the "Stoff" + "Matt/Glänzend" choices visible.
  const MATERIAL_SHEEN = { silk: 0.85, polyester: 0.55, cotton: 0.22, denim: 0.12, wool: 0.18, fleece: 0.10, linen: 0.14 };
  // Neutral-fill tone per winning archetype (used when no colour is chosen yet)
  // → mood / inspo / occasion / season shift the flat's tone because they shift
  // the archetype. Cool tech ↔ warm couture/utility ↔ playful street.
  const ARCH_TINT = { quietMinimal: "#9a9aa2", softCouture: "#b9a79b", utility: "#9ca08c", techAvant: "#8c99ab", y2kStreet: "#b48cac", sport: "#8caaa2" };

  // ---- recolour + material/finish/energy/archetype -------------------------
  // Light stroke always; chosen colour fills as a SOFT tonal wash (energy =
  // calm↔bold drives how present it is). No colour yet → tone from the
  // archetype. A sheen overlay (material × finish) gives the fabric a feel.
  function fillSpec(id, p) {
    const stops = Array.isArray(p.stops) && p.stops.length ? p.stops : null;
    const energy = clamp(num(p.energy, 0.5), 0, 1);
    const finish = clamp(num(p.finish, 0.5), 0, 1);
    const sheen = clamp((MATERIAL_SHEEN[p.material] != null ? MATERIAL_SHEEN[p.material] : 0.2) + finish * 0.4, 0.04, 0.95);
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
      fill = ARCH_TINT[p.archetype] || "#8b8f96";
      opacity = lerp(0.05, 0.17, energy); // calm wash → bolder neutral
    }
    // Sheen overlay: bright diagonal highlight + soft shadow side.
    defs += `<linearGradient id="${id}s" x1="0" y1="0" x2="0.65" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${r(sheen * 0.5)}"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${r(sheen * 0.16)}"/></linearGradient>`;
    let pat = "";
    if (p.pattern && p.pattern !== "none") { defs += patternDef(id + "p", p.pattern, clamp(num(p.patternScale, 0.5), 0.12, 1)); pat = `url(#${id}p)`; }
    return { defs, fill, opacity, pat, sheen: `url(#${id}s)` };
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
    // Shoulder is the widest point. The fit/structure/volume influence is wide
    // on purpose (was a near-flat 58 ± ~11 → now ~42..82) so slim ↔ oversized
    // is unmistakable rather than a few pixels nobody notices.
    const shoulderHalf = 50 + structure * 9 + vol * 8 + fit * 13 + (drop ? 12 : 0);
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
    const splay = sleeveless ? 0 : (cfg.splay + (w.drop ? 5 : 0)) * lerp(0.55, 1, lenT);
    const coX = sleeveless ? w.chestHalf : w.shoulderHalf + splay;   // outer cuff edge
    const ciX = sleeveless ? w.chestHalf : Math.max(w.chestHalf + 1, coX - cfg.cuffW * lerp(0.7, 1, lenT)); // inner cuff edge
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

  function paintTop(p, cfg, g) {
    return renderFlat(p, [outline(g)], seams(g, p, cfg));
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
    // reshapes the leg frame by frame: skinny clearly tapers, wide-leg is full.
    const thighHalf = lerp(14, 33, fit) + vol * 6;
    const ankleHalf = clamp(lerp(7, thighHalf * 0.96, fit), 6, thighHalf);
    const crotchY = topY + 96;
    return { fit, vol, topY, hemY, hipHalf, legTop, thighHalf, ankleHalf, crotchY };
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
    return renderFlat(p, [path], seam.join(""));
  }

  // ---- dress (bodice → skirt) ---------------------------------------------
  const DRESS_CFG = { sleeveLen: 58, hem: { cropped: 250, regular: 300, long: 322 }, defCollar: "vneck", closure: "none", splay: 14, cuffW: 22, armDepth: 50, neckHalf: 18 };
  function dressGeom(p) {
    const cfg = DRESS_CFG;
    const w = topWidths(p, cfg);
    const neckY = 60, shoulderY = 66;
    const armpitY = shoulderY + cfg.armDepth;
    const waistY = armpitY + 34;
    const hemY = cfg.hem[p.length] != null ? cfg.hem[p.length] : 300;
    // Waist emphasis: "fitted" nips the waist hard, "relaxed" barely shapes it.
    const waistHalf = w.chestHalf * (p.waist === "fitted" ? 0.72 : p.waist === "relaxed" ? 0.95 : 0.84);
    // CONTINUOUS A-line ↔ column morph: low fit = strong flare from the waist,
    // high fit = the hem stays at waist width (true straight sheath) — the
    // silhouette slider visibly sweeps the skirt instead of snapping.
    const skirtHalf = lerp(w.chestHalf * 1.85, waistHalf * 1.06, w.fit);
    const sleeveLen = sleeveLenFor(p, cfg);
    const sleeveless = sleeveLen <= 2;
    const lenT = clamp(sleeveLen / 170, 0, 1);
    const coX = sleeveless ? w.chestHalf : w.shoulderHalf + cfg.splay * lerp(0.55, 1, lenT);
    const ciX = sleeveless ? w.chestHalf : Math.max(w.chestHalf + 1, coX - cfg.cuffW * lerp(0.7, 1, lenT));
    const wristY = sleeveless ? armpitY : shoulderY + sleeveLen;
    const collar = p.collar || cfg.defCollar;
    const neckHalf = neckHalfFor(collar, cfg);
    // Sleeveless dress: narrow the shoulder to a strap line (slip silhouette).
    const shoulderHalf = sleeveless ? Math.max(neckHalf + 7, w.chestHalf * 0.62) : w.shoulderHalf;
    return { neckHalf, neckY, shoulderHalf, shoulderY, coX: sleeveless ? w.chestHalf : coX, ciX: sleeveless ? w.chestHalf : ciX, wristY, chestHalf: w.chestHalf, armpitY, waistHalf, waistY, hemHalf: skirtHalf, hemY, collar, sleeveless };
  }
  function paintDress(p, g) {
    const d =
      `M ${L(g.neckHalf)} ${Y(g.neckY)} ` +
      `L ${L(g.shoulderHalf)} ${Y(g.shoulderY)} L ${L(g.coX)} ${Y(g.wristY)} L ${L(g.ciX)} ${Y(g.wristY)} L ${L(g.chestHalf)} ${Y(g.armpitY)} ` +
      `L ${L(g.waistHalf)} ${Y(g.waistY)} L ${L(g.hemHalf)} ${Y(g.hemY)} L ${R(g.hemHalf)} ${Y(g.hemY)} L ${R(g.waistHalf)} ${Y(g.waistY)} ` +
      `L ${R(g.chestHalf)} ${Y(g.armpitY)} L ${R(g.ciX)} ${Y(g.wristY)} L ${R(g.coX)} ${Y(g.wristY)} L ${R(g.shoulderHalf)} ${Y(g.shoulderY)} L ${R(g.neckHalf)} ${Y(g.neckY)} ` +
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
    return renderFlat(p, [d], seam.join(""));
  }

  // ---- assemble the SVG ----------------------------------------------------
  // p.reveal (0..1, default 1) stages the MATERIALISATION of the flat as the
  // journey matures: early answers show a faint sketch (light wash, dim seams),
  // later answers develop fill, sheen, pattern and details — the garment
  // visibly "entsteht" instead of appearing finished at the first question.
  function renderFlat(p, paths, seamMarkup) {
    const id = "g" + (++uid);
    const f = fillSpec(id, p);
    const reveal = clamp(num(p.reveal, 1), 0, 1);
    const fillOp = r(f.opacity * lerp(0.3, 1, reveal));
    const layerOp = r(lerp(0.12, 1, reveal));
    const seamOp = r(lerp(0.4, 1, reveal));
    const body = paths.map((d) =>
      `<path d="${d}" fill="${f.fill}" fill-opacity="${fillOp}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>` +
      (f.pat ? `<path d="${d}" fill="${f.pat}" stroke="none" opacity="${layerOp}"/>` : "") +
      (f.sheen ? `<path d="${d}" fill="${f.sheen}" stroke="none" opacity="${layerOp}"/>` : "")
    ).join("");
    const seams = seamMarkup ? `<g opacity="${seamOp}">${seamMarkup}</g>` : "";
    // pathLength=1 normalises every path so CSS can draw the flat in with one
    // stroke-dasharray animation (the genesis "weave-in" moment).
    return `<svg class="de-garment" viewBox="0 0 ${VB} ${VH}" aria-hidden="true"><defs>${f.defs}</defs>${body}${seams}</svg>`
      .replace(/<path /g, '<path pathLength="1" ');
  }

  // ---- genesis nebula -------------------------------------------------------
  // The pre-category stage of the journey: no garment yet — an abstract flow of
  // fabric threads that reacts to the mood answers (energy excites the strokes,
  // structure straightens them, the leading archetype tints them) and gains
  // threads with every answer (seed). Deterministic per (seed,i) so re-renders
  // are stable and answering only ADDS material — the cloth is being spun
  // before it is woven into a silhouette.
  function nebula(p) {
    const energy = clamp(num(p && p.energy, 0.5), 0, 1);
    const structure = clamp(num(p && p.structure, 0.5), 0, 1);
    const seed = Math.max(0, Math.floor(num(p && p.seed, 0)));
    const tint = (p && ARCH_TINT[p.archetype]) || "#8b96a4";
    // Second, brighter ocean accent so the threads read as luminous fibre, not
    // grey scribble — aqua by default, warmed toward the archetype tint.
    const accentCol = (p && ARCH_TINT[p.archetype]) ? "#64d6c4" : "#76c7c0";
    const cx = CX, cy = 158;
    const hash = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7 + 13.37) * 43758.5453; return s - Math.floor(s); };
    const count = Math.min(34, 14 + seed * 2);
    const amp = lerp(22, 82, energy);
    const threads = [];
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + hash(i, 1) * 0.9;
      const rad = 54 + hash(i, 2) * 56;
      const x0 = r(cx + Math.cos(a) * rad), y0 = r(cy + Math.sin(a) * rad * 1.25);
      const x1 = r(cx - Math.cos(a) * rad * (0.7 + hash(i, 3) * 0.5)), y1 = r(cy - Math.sin(a) * rad * 1.15);
      const px = -Math.sin(a), py = Math.cos(a);
      const w1 = (hash(i, 4) - 0.5) * 2 * amp, w2 = (hash(i, 5) - 0.5) * 2 * amp * lerp(1, 0.32, structure);
      const c1x = r(cx + px * w1), c1y = r(cy + py * w1 - 24);
      const c2x = r(cx + px * w2), c2y = r(cy + py * w2 + 24);
      const accent = hash(i, 6) > 0.62;
      const col = accent ? accentCol : tint;
      const op = r(0.18 + hash(i, 7) * (accent ? 0.5 : 0.3));
      const sw = r(1.1 + hash(i, 8) * (accent ? 1.9 : 1.1));
      const d = `M ${x0} ${y0} C ${c1x} ${c1y} ${c2x} ${c2y} ${x1} ${y1}`;
      // Bloom: a wide, very faint stroke under a crisp bright one (cheap glow,
      // no SVG filter so it stays fast on mobile).
      threads.push(`<path pathLength="1" d="${d}" fill="none" stroke="${col}" stroke-width="${r(sw * 3)}" stroke-linecap="round" opacity="${r(op * 0.16)}"/>`);
      threads.push(`<path pathLength="1" d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`);
      // A few bright fibre nodes where threads originate — they pulse in CSS.
      if (accent && hash(i, 9) > 0.5) nodes.push(`<circle class="de-neb-node" cx="${x0}" cy="${y0}" r="${r(1.4 + hash(i, 10) * 1.8)}" fill="${accentCol}" opacity="${r(0.4 + hash(i, 11) * 0.4)}"/>`);
    }
    const glowOp = r(0.06 + energy * 0.09);
    return `<svg class="de-garment de-nebula" viewBox="0 0 ${VB} ${VH}" aria-hidden="true">` +
      `<defs><radialGradient id="nbGlow${seed}" cx="0.5" cy="0.46" r="0.6"><stop offset="0" stop-color="${tint}" stop-opacity="${glowOp}"/><stop offset="1" stop-color="${tint}" stop-opacity="0"/></radialGradient></defs>` +
      `<rect x="0" y="0" width="${VB}" height="${VH}" fill="url(#nbGlow${seed})"/>${threads.join("")}${nodes.join("")}</svg>`;
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

  return { build, model, paint, lerpModel, nebula, jacketSvg: (p) => topFlat("jacket", p || {}) };
})();

if (typeof window !== "undefined") window.GarmentSVG = GarmentSVG;
if (typeof module !== "undefined" && module.exports) module.exports = GarmentSVG;
