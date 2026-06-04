/**
 * Urban Revolution — Design Engine · Parametric garment silhouette (brief §7)
 *
 * Draws the piece as a vector silhouette that MORPHS from the DesignDNA, so it
 * visibly changes with every form decision — fit, volume, structure, length,
 * collar, sleeve, closure, pockets, cuffs, hem — plus colour/gradient, pattern
 * and material sheen. This is the primary, evolving preview during the journey;
 * the curated hero photo is the calm realism layer behind it, the AI render is
 * on demand.
 *
 *   GarmentSVG.build(category, params) → inline SVG markup (string)
 *
 * `params` (all optional, sensible defaults):
 *   fit 0..1 · structure 0..1 · volume low|mid|high · length cropped|regular|long
 *   collar stand|notched|hood|crew|none · sleeve set-in|raglan|drop
 *   closure zip|button|none · pockets none|side|flap|cargo
 *   cuffs plain|ribbed|button · hem straight|drawcord|ribbed
 *   pattern none|stripe|check|camo|graphic|abstract
 *   scheme mono|duo-gradient|multi · stops [hex…] · material <key>
 */
const GarmentSVG = (() => {
  const VB = 240, CX = 120;
  let uid = 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const lerp = (a, b, t) => a + (b - a) * t;
  const r = (n) => Math.round(n * 10) / 10;

  function fillDefs(id, p) {
    const stops = Array.isArray(p.stops) && p.stops.length ? p.stops : ["#8b8f96"];
    const base = stops[0];
    let fill = base;
    let defs = "";
    if (p.scheme === "duo-gradient" && stops.length >= 2) {
      defs += `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient>`;
      fill = `url(#${id}g)`;
    }
    // material sheen → soft diagonal highlight; matte → faint
    const sheen = ({ silk: 0.5, polyester: 0.34, fleece: 0.14, denim: 0.16, wool: 0.12, cotton: 0.12, linen: 0.1 })[p.material] != null
      ? ({ silk: 0.5, polyester: 0.34, fleece: 0.14, denim: 0.16, wool: 0.12, cotton: 0.12, linen: 0.1 })[p.material] : 0.18;
    defs += `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${sheen}"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>`;
    if (p.pattern && p.pattern !== "none") defs += patternDef(id + "p", p.pattern);
    return { defs, fill, hasPattern: !!(p.pattern && p.pattern !== "none") };
  }

  function patternDef(id, type) {
    const ink = "rgba(0,0,0,0.28)";
    const lite = "rgba(255,255,255,0.22)";
    if (type === "stripe") return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(8)"><rect width="6" height="12" fill="${ink}"/></pattern>`;
    if (type === "check") return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${ink}"/><rect x="8" y="8" width="8" height="8" fill="${ink}"/></pattern>`;
    if (type === "camo") return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="${ink}"/><ellipse cx="10" cy="12" rx="11" ry="8" fill="${lite}"/><ellipse cx="30" cy="28" rx="13" ry="9" fill="${lite}"/><ellipse cx="24" cy="6" rx="7" ry="5" fill="${lite}"/></pattern>`;
    if (type === "graphic") return `<pattern id="${id}" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="24" cy="24" r="9" fill="none" stroke="${lite}" stroke-width="4"/><circle cx="0" cy="0" r="6" fill="${ink}"/><circle cx="48" cy="48" r="6" fill="${ink}"/></pattern>`;
    return `<pattern id="${id}" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="M0 17 Q8 4 17 17 T34 17" fill="none" stroke="${lite}" stroke-width="3"/></pattern>`;
  }

  function jacket(p) {
    const fit = clamp(num(p.fit, 0.5), 0, 1);
    const structure = clamp(num(p.structure, 0.5), 0, 1);
    const vol = p.volume === "high" ? 1 : p.volume === "low" ? -1 : 0;

    const neckY = 58;
    const shoulderY = 78 - structure * 6;
    const shoulderHalf = 52 + structure * 16 + vol * 9;
    const armpitY = shoulderY + 50;
    const chestHalf = lerp(38, 82, fit) + vol * 8;
    const hemY = { cropped: 218, regular: 270, long: 312 }[p.length] || 270;
    const waistY = (armpitY + hemY) / 2;
    // slim nips the waist; oversized/high-vol keeps it straight/boxy
    const waistHalf = lerp(chestHalf * 0.82, chestHalf * 1.04, fit) + vol * 5;
    const hemHalf = chestHalf + (fit > 0.6 ? 8 : 1) + (vol > 0 ? 8 : 0);
    const neckHalf = p.collar === "crew" ? 26 : p.collar === "notched" ? 22 : p.collar === "hood" ? 22 : p.collar === "none" ? 18 : 17;
    const neckDip = p.collar === "crew" ? 18 : p.collar === "none" ? 8 : 5;

    const L = (x) => r(CX - x), R = (x) => r(CX + x), Y = (y) => r(y);

    // Torso outline (one closed path), shoulders → armpit → waist → hem.
    const body =
      `M ${L(neckHalf)} ${Y(neckY + neckDip)} ` +
      `L ${L(shoulderHalf)} ${Y(shoulderY)} ` +
      `C ${L(shoulderHalf + 2)} ${Y(shoulderY + 18)} ${L(chestHalf + 4)} ${Y(armpitY - 12)} ${L(chestHalf)} ${Y(armpitY)} ` +
      `C ${L(waistHalf + 2)} ${Y(waistY - 8)} ${L(waistHalf)} ${Y(waistY)} ${L(hemHalf)} ${Y(hemY - 6)} ` +
      `L ${L(hemHalf)} ${Y(hemY)} L ${R(hemHalf)} ${Y(hemY)} L ${R(hemHalf)} ${Y(hemY - 6)} ` +
      `C ${R(waistHalf)} ${Y(waistY)} ${R(waistHalf + 2)} ${Y(waistY - 8)} ${R(chestHalf)} ${Y(armpitY)} ` +
      `C ${R(chestHalf + 4)} ${Y(armpitY - 12)} ${R(shoulderHalf + 2)} ${Y(shoulderY + 18)} ${R(shoulderHalf)} ${Y(shoulderY)} ` +
      `L ${R(neckHalf)} ${Y(neckY + neckDip)} ` +
      neckline(p, neckHalf, neckY, neckDip) + " Z";

    // Sleeves hang from the shoulder; drop-shoulder sits wider/lower.
    const drop = p.sleeve === "drop";
    const sTop = shoulderHalf + (drop ? 4 : 0);
    const sTopY = shoulderY + (drop ? 10 : 0);
    const sleeveW = 22 + (drop ? 10 : 0) + vol * 4;
    const wristY = hemY - (p.length === "cropped" ? 2 : 10);
    const wristIn = sTop - sleeveW + (p.cuffs === "ribbed" ? 4 : 0);
    const arm = (side) => {
      const o = side < 0 ? L : R;
      return `M ${o(sTop)} ${Y(sTopY)} L ${o(sTop + 2)} ${Y(wristY)} L ${o(wristIn)} ${Y(wristY)} L ${o(chestHalf - 2)} ${Y(armpitY + 2)} Z`;
    };

    return { defs: "", body, arms: arm(-1) + arm(1), meta: { hemY, wristY, sTop, wristIn, neckHalf, neckY, neckDip, chestHalf, armpitY, shoulderHalf, shoulderY } };
  }

  function neckline(p, neckHalf, neckY, neckDip) {
    if (p.collar === "crew") return `Q ${CX} ${neckY + neckDip + 14} ${CX - neckHalf} ${neckY + neckDip}`;
    if (p.collar === "notched") return `L ${CX} ${neckY + 30} L ${CX - neckHalf} ${neckY + neckDip}`;
    return `L ${CX - neckHalf} ${neckY + neckDip}`;
  }

  function details(p, m, fill) {
    const parts = [];
    const cy0 = m.neckY + m.neckDip;
    // Collar overlays
    if (p.collar === "stand") parts.push(`<path d="M ${m.neckLeft = CX - m.neckHalf} ${cy0} L ${CX - m.neckHalf - 3} ${cy0 - 12} L ${CX + m.neckHalf + 3} ${cy0 - 12} L ${CX + m.neckHalf} ${cy0} Z" fill="${fill}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>`);
    if (p.collar === "notched") parts.push(`<path d="M ${CX - m.neckHalf} ${cy0} L ${CX - 6} ${m.neckY + 30} L ${CX - m.neckHalf - 10} ${cy0 + 26} Z M ${CX + m.neckHalf} ${cy0} L ${CX + 6} ${m.neckY + 30} L ${CX + m.neckHalf + 10} ${cy0 + 26} Z" fill="rgba(0,0,0,0.14)"/>`);
    if (p.collar === "hood") parts.push(`<path d="M ${CX - m.neckHalf - 6} ${cy0 + 2} Q ${CX} ${m.neckY - 34} ${CX + m.neckHalf + 6} ${cy0 + 2}" fill="rgba(0,0,0,0.18)" stroke="rgba(0,0,0,0.22)" stroke-width="1.5"/>`);
    // Closure (centre front)
    if (p.closure === "zip") parts.push(`<line x1="${CX}" y1="${cy0 + 4}" x2="${CX}" y2="${m.hemY - 4}" stroke="rgba(0,0,0,0.4)" stroke-width="2.5" stroke-dasharray="3 2"/>`);
    else if (p.closure === "button") {
      const n = 5; for (let i = 0; i < n; i++) { const y = cy0 + 14 + (i * (m.hemY - cy0 - 20)) / (n - 1); parts.push(`<circle cx="${CX}" cy="${r(y)}" r="2.6" fill="rgba(0,0,0,0.42)"/>`); }
    } else if (p.closure === "none") {
      parts.push(`<path d="M ${CX} ${cy0 + 2} L ${CX - 10} ${m.hemY} M ${CX} ${cy0 + 2} L ${CX + 10} ${m.hemY}" stroke="rgba(0,0,0,0.22)" stroke-width="1.5" fill="none"/>`);
    }
    // Pockets
    const py = m.hemY - 46;
    if (p.pockets === "side") parts.push(`<line x1="${CX - m.chestHalf + 8}" y1="${py}" x2="${CX - m.chestHalf + 30}" y2="${py + 6}" stroke="rgba(0,0,0,0.3)" stroke-width="2"/><line x1="${CX + m.chestHalf - 8}" y1="${py}" x2="${CX + m.chestHalf - 30}" y2="${py + 6}" stroke="rgba(0,0,0,0.3)" stroke-width="2"/>`);
    if (p.pockets === "flap") parts.push(`<rect x="${CX - m.chestHalf + 6}" y="${py}" width="26" height="14" rx="2" fill="rgba(0,0,0,0.16)" stroke="rgba(0,0,0,0.3)" stroke-width="1"/><rect x="${CX + m.chestHalf - 32}" y="${py}" width="26" height="14" rx="2" fill="rgba(0,0,0,0.16)" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>`);
    if (p.pockets === "cargo") parts.push(`<rect x="${CX - m.chestHalf + 4}" y="${py - 4}" width="30" height="26" rx="2" fill="rgba(0,0,0,0.14)" stroke="rgba(0,0,0,0.32)" stroke-width="1.5"/><rect x="${CX + m.chestHalf - 34}" y="${py - 4}" width="30" height="26" rx="2" fill="rgba(0,0,0,0.14)" stroke="rgba(0,0,0,0.32)" stroke-width="1.5"/>`);
    // Cuffs
    if (p.cuffs === "ribbed") parts.push(cuffRib(m, -1) + cuffRib(m, 1));
    else if (p.cuffs === "button") parts.push(`<circle cx="${CX - (m.sTop + m.wristIn) / 2}" cy="${m.wristY - 6}" r="1.8" fill="rgba(0,0,0,0.4)"/><circle cx="${CX + (m.sTop + m.wristIn) / 2}" cy="${m.wristY - 6}" r="1.8" fill="rgba(0,0,0,0.4)"/>`);
    // Hem
    if (p.hem === "ribbed") parts.push(`<rect x="${CX - m.chestHalf}" y="${m.hemY - 10}" width="${m.chestHalf * 2}" height="10" fill="rgba(0,0,0,0.12)"/>`);
    else if (p.hem === "drawcord") parts.push(`<line x1="${CX - m.chestHalf}" y1="${m.hemY - 5}" x2="${CX + m.chestHalf}" y2="${m.hemY - 5}" stroke="rgba(0,0,0,0.26)" stroke-width="1.5" stroke-dasharray="5 3"/><circle cx="${CX - 6}" cy="${m.hemY - 5}" r="2" fill="rgba(0,0,0,0.34)"/><circle cx="${CX + 6}" cy="${m.hemY - 5}" r="2" fill="rgba(0,0,0,0.34)"/>`);
    return parts.join("");
  }

  function cuffRib(m, side) {
    const a = side < 0 ? CX - m.sTop : CX + (m.wristIn);
    const b = side < 0 ? CX - m.wristIn : CX + m.sTop;
    const x = Math.min(a, b);
    return `<rect x="${r(x)}" y="${m.wristY - 12}" width="${r(Math.abs(b - a))}" height="12" fill="rgba(0,0,0,0.14)"/>`;
  }

  function jacketSvg(p) {
    const id = "g" + (++uid);
    const f = fillDefs(id, p);
    const j = jacket(p);
    const fillRef = f.fill;
    const shapes =
      `<path d="${j.arms}" fill="${fillRef}"/>` +
      `<path d="${j.body}" fill="${fillRef}"/>` +
      (f.hasPattern ? `<path d="${j.body}" fill="url(#${id}p)"/><path d="${j.arms}" fill="url(#${id}p)"/>` : "") +
      `<path d="${j.body}" fill="url(#${id}s)"/>` +
      details(p, j.meta, fillRef);
    return `<svg class="de-garment" viewBox="0 0 ${VB} 340" aria-hidden="true"><defs>${f.defs}</defs>${shapes}</svg>`;
  }

  function build(category, params) {
    const p = params || {};
    // Jacket is fully parametric; other categories reuse the studio fallback.
    if ((category || "").toLowerCase() === "jacket") return jacketSvg(p);
    if (window.PreviewFallback && typeof window.PreviewFallback.svg === "function") {
      return window.PreviewFallback.svg({ type: category, color: (p.stops && p.stops[0]) || "#8b8f96", material: p.material, pattern: p.scheme === "duo-gradient" ? "gradient" : (p.pattern && p.pattern !== "none" ? p.pattern : "solid") });
    }
    return jacketSvg(p);
  }

  return { build, jacketSvg };
})();

if (typeof window !== "undefined") window.GarmentSVG = GarmentSVG;
if (typeof module !== "undefined" && module.exports) module.exports = GarmentSVG;
