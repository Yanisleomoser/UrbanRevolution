/**
 * Urban Revolution — Free $0 design preview fallback (window.PreviewFallback)
 *
 * When the paid photoreal render (/api/preview-design → Replicate) is
 * unavailable — no token, no credit, rate-limited, network down — the design
 * preview must never dead-end. This module renders a tasteful, fully
 * client-side **studio illustration** of the garment from the data we already
 * have (type, colour, material, pattern, name): zero cost, instant, offline,
 * no API. It gives a real "do I like this colour / silhouette?" signal.
 *
 * Pure functions, no eval-time globals — `PreviewFallback.svg({...})` returns
 * an inline SVG string the caller injects into the preview slot.
 *
 * IIFE-with-global pattern (classic script, loaded before app.js).
 */
const PreviewFallback = (() => {
    "use strict";

    // The six garment silhouettes (64×64), shared with the type selector in
    // index.html so the fallback speaks the same visual language.
    const SILHOUETTES = {
        tshirt: "M16 16 L24 8 L40 8 L48 16 L56 22 L48 30 L48 56 L16 56 L16 30 L8 22 Z",
        hoodie: "M20 14 Q32 4 44 14 L52 22 L58 28 L50 34 L50 58 L14 58 L14 34 L6 28 L12 22 Z",
        shirt: "M18 14 L28 8 L36 8 L46 14 L54 22 L48 28 L48 56 L16 56 L16 28 L10 22 Z",
        pants: "M16 8 L48 8 L46 32 L44 58 L34 58 L32 34 L30 58 L20 58 L18 32 Z",
        jacket: "M16 14 L24 8 L40 8 L48 14 L56 22 L50 28 L50 58 L32 58 L32 8 L32 58 L14 58 L14 28 L8 22 Z",
        dress: "M22 12 L28 8 L36 8 L42 12 L40 24 L52 58 L12 58 L24 24 Z",
    };
    // Extra detail strokes drawn on top (collars, plackets).
    const DETAILS = {
        shirt: "M28 8 L32 16 L36 8",
        jacket: "M32 8 L32 58",
        tshirt: "M24 8 Q32 16 40 8",
        hoodie: "M22 14 Q32 22 42 14",
    };

    // How reflective each fabric reads — drives the specular highlight.
    const SHEEN = {
        silk: 0.5, polyester: 0.34, cotton: 0.16, linen: 0.12,
        denim: 0.12, wool: 0.08, fleece: 0.06,
    };

    let uid = 0;

    // ── colour helpers ──────────────────────────────────────────────
    function toRgb(hex) {
        const h = String(hex || "#888888").replace("#", "");
        const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
        return {
            r: parseInt(n.slice(0, 2), 16) || 0,
            g: parseInt(n.slice(2, 4), 16) || 0,
            b: parseInt(n.slice(4, 6), 16) || 0,
        };
    }
    function toHex({ r, g, b }) {
        const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
        return `#${c(r)}${c(g)}${c(b)}`;
    }
    // Mix a colour toward a target ("#fff"/"#000") by t (0..1).
    function mix(hex, target, t) {
        const a = toRgb(hex), b = toRgb(target);
        return toHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
    }
    function luminance(hex) {
        const { r, g, b } = toRgb(hex);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0..255
    }
    function esc(s) {
        return String(s == null ? "" : s).replace(/[<>&"']/g, (c) =>
            ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    // ── fabric pattern → an SVG <pattern> woven into the garment ─────
    function patternDef(id, key, base) {
        const light = luminance(base) > 150;
        const ink = light ? mix(base, "#000", 0.45) : mix(base, "#fff", 0.55);
        const op = 0.22;
        const tile = (body, size) =>
            `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${body}</pattern>`;
        switch (key) {
            case "stripes_h":
                return tile(`<rect width="16" height="8" fill="${ink}" opacity="${op}"/>`, 16);
            case "stripes_v":
                return tile(`<rect width="8" height="16" fill="${ink}" opacity="${op}"/>`, 16);
            case "dots":
                return tile(`<circle cx="9" cy="9" r="2.6" fill="${ink}" opacity="${op}"/>`, 18);
            case "plaid":
                return tile(`<rect width="22" height="6" fill="${ink}" opacity="0.16"/><rect width="6" height="22" fill="${ink}" opacity="0.16"/>`, 22);
            case "heather":
                return tile(`<circle cx="3" cy="4" r="1.1" fill="${ink}" opacity="0.18"/><circle cx="8" cy="9" r="1" fill="${ink}" opacity="0.14"/><circle cx="11" cy="3" r="0.9" fill="${ink}" opacity="0.16"/>`, 13);
            case "camo":
                return tile(`<ellipse cx="9" cy="8" rx="7" ry="5" fill="${ink}" opacity="0.14"/><ellipse cx="22" cy="20" rx="6" ry="8" fill="${ink}" opacity="0.12"/><ellipse cx="24" cy="5" rx="4" ry="3" fill="${mix(base, "#000", 0.3)}" opacity="0.12"/>`, 28);
            case "floral":
                return tile(`<g fill="${ink}" opacity="0.18"><circle cx="11" cy="7" r="2"/><circle cx="7" cy="11" r="2"/><circle cx="15" cy="11" r="2"/><circle cx="11" cy="15" r="2"/><circle cx="11" cy="11" r="1.6" fill="${mix(base, "#fff", 0.3)}"/></g>`, 22);
            default:
                return ""; // solid / gradient → no overlay pattern
        }
    }

    /**
     * Build the studio SVG.
     * @param {{type,color,material,pattern,name}} d  color is a #RRGGBB hex.
     * @returns {string} inline SVG markup.
     */
    function svg(d) {
        d = d || {};
        const id = `pf${++uid}`;
        const type = SILHOUETTES[d.type] ? d.type : "tshirt";
        const base = /^#[0-9a-f]{6}$/i.test(d.color || "") ? d.color : "#9aa0a8";
        const path = SILHOUETTES[type];
        const detail = DETAILS[type];
        // Any non-solid pattern key is passed straight to patternDef(), whose
        // switch only ever emits known-safe markup and returns "" for anything
        // it doesn't recognise — so no allow-list is needed here, and inventing
        // one (e.g. only "stripe"/"dot") just drops the real keys
        // (stripes_h/dots/plaid/…) and renders every garment flat.
        const pattern = d.pattern && d.pattern !== "solid" ? d.pattern : null;
        const light = luminance(base) > 200;

        const hi = mix(base, "#ffffff", 0.22);   // lit side
        const lo = mix(base, "#000000", 0.30);   // shadow side
        const edge = light ? "rgba(0,0,0,0.28)" : mix(base, "#ffffff", 0.18);
        const safeMaterial = Object.prototype.hasOwnProperty.call(SHEEN, d.material) ? d.material : "cotton";
        const sheen = SHEEN[safeMaterial] != null ? SHEEN[safeMaterial] : 0.16;
        const pat = pattern ? patternDef(`${id}p`, pattern, base) : "";
        const isGradient = d.pattern === "gradient";

        // Centre the 64-box silhouette in a 360×440 studio frame.
        const T = "translate(40,86) scale(4.0)";

        return (
`<svg class="pf-svg" viewBox="0 0 360 440" role="img" aria-label="${esc(d.name || "")}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="${id}bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#23232b"/><stop offset="60%" stop-color="#141419"/><stop offset="100%" stop-color="#0e0e12"/>
    </radialGradient>
    <linearGradient id="${id}vol" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${isGradient ? mix(base, "#fff", 0.28) : hi}"/>
      <stop offset="52%" stop-color="${base}"/>
      <stop offset="100%" stop-color="${isGradient ? mix(base, "#000", 0.45) : lo}"/>
    </linearGradient>
    <radialGradient id="${id}spec" cx="38%" cy="26%" r="48%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="${sheen}"/>
      <stop offset="70%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="${id}clip"><path d="${path}" transform="${T}"/></clipPath>
    ${pat}
  </defs>
  <rect width="360" height="440" fill="url(#${id}bg)"/>
  <ellipse cx="180" cy="404" rx="120" ry="20" fill="#000" opacity="0.45"/>
  <g clip-path="url(#${id}clip)">
    <rect x="0" y="0" width="360" height="440" fill="url(#${id}vol)"/>
    ${pattern ? `<rect x="0" y="0" width="360" height="440" fill="url(#${id}p)"/>` : ""}
    <rect x="0" y="0" width="360" height="440" fill="url(#${id}spec)"/>
  </g>
  <path d="${path}" transform="${T}" fill="none" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round"/>
  ${detail ? `<path d="${detail}" transform="${T}" fill="none" stroke="${edge}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>` : ""}
</svg>`
        );
    }

    function svgNode(d) {
        const input = d && typeof d === "object" ? d : {};
        const safeData = {
            type: SILHOUETTES[input.type] ? input.type : "tshirt",
            color: /^#[0-9a-f]{6}$/i.test(input.color || "") ? input.color : "#9aa0a8",
            material: Object.prototype.hasOwnProperty.call(SHEEN, input.material) ? input.material : "cotton",
            // Pass any pattern string through — svg()/patternDef() only ever
            // emit known-safe markup for it (real keys: stripes_h, dots, plaid…).
            pattern: typeof input.pattern === "string" ? input.pattern : null,
            name: String(input.name || "").slice(0, 120),
        };

        const markup = svg(safeData);
        const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
        const root = parsed.documentElement;
        if (!root || root.localName !== "svg" || root.namespaceURI !== "http://www.w3.org/2000/svg") {
            return null;
        }

        root.querySelectorAll("script,foreignObject").forEach((n) => n.remove());
        root.querySelectorAll("*").forEach((el) => {
            Array.from(el.attributes).forEach((attr) => {
                const n = attr.name.toLowerCase();
                const v = String(attr.value || "").trim().toLowerCase();
                if (n.startsWith("on")) el.removeAttribute(attr.name);
                if (
                    (n === "href" || n === "xlink:href") &&
                    (v.startsWith("javascript:") || v.startsWith("data:") || v.startsWith("vbscript:"))
                ) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return document.importNode(root, true);
    }

    return { svg, svgNode };
})();
if (typeof window !== "undefined") window.PreviewFallback = PreviewFallback;
if (typeof module !== "undefined" && module.exports) module.exports = PreviewFallback;
