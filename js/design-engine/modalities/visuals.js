/**
 * Urban Revolution — Design Engine · Shared visuals
 *
 * On-brand, asset-free fallbacks so every modality is fully runnable before
 * any real photo exists. When a JSON `image` path is present, lazyImage()
 * fades the photo in over the SVG once it loads; on 404 the SVG stays. All
 * colour comes from the existing :root tokens via CSS classes.
 */
const DEVisuals = (() => {
  const SVGNS = "http://www.w3.org/2000/svg";

  // Minimal line-art silhouettes per garment category (viewBox 0 0 64 64).
  const SILHOUETTE = {
    tshirt: "M20 14 L8 22 L14 30 L20 26 L20 52 L44 52 L44 26 L50 30 L56 22 L44 14 L38 18 Q32 22 26 18 Z",
    hoodie: "M20 16 L8 24 L14 32 L20 28 L20 54 L44 54 L44 28 L50 32 L56 24 L44 16 Q32 26 20 16 Z M26 14 Q32 8 38 14",
    shirt: "M20 14 L8 22 L14 30 L20 26 L20 54 L44 54 L44 26 L50 30 L56 22 L44 14 L38 16 L32 22 L26 16 Z",
    pants: "M24 10 L40 10 L42 34 L38 56 L32 56 L32 34 L26 56 L22 56 L22 34 Z",
    jacket: "M20 14 L8 22 L14 32 L20 28 L20 54 L31 54 L31 22 L33 22 L33 54 L44 54 L44 28 L50 32 L56 22 L44 14 L38 16 L32 22 L26 16 Z",
    dress: "M24 12 L40 12 L46 24 L40 30 L46 56 L18 56 L24 30 L18 24 Z",
  };

  function el(tag, attrs, children) {
    const node = tag === "svg" || tag === "path" || tag === "circle" || tag === "rect"
      ? document.createElementNS(SVGNS, tag)
      : document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function silhouette(category, className) {
    const svg = el("svg", { viewBox: "0 0 64 64", class: className || "de-glyph", "aria-hidden": "true" });
    svg.appendChild(el("path", {
      d: SILHOUETTE[category] || SILHOUETTE.tshirt,
      fill: "none", stroke: "currentColor", "stroke-width": "2",
      "stroke-linejoin": "round", "stroke-linecap": "round",
    }));
    return svg;
  }

  // A wrapper whose background is the on-brand fallback; if `src` loads, the
  // photo fades in on top. Never blocks render, never dead-ends on 404.
  function lazyImage(src, alt, fallbackNode) {
    const wrap = el("div", { class: "de-visual" });
    if (fallbackNode) wrap.appendChild(fallbackNode);
    if (src) {
      const img = el("img", { alt: alt || "", loading: "lazy", class: "de-visual-img" });
      img.addEventListener("load", () => img.classList.add("is-loaded"));
      img.addEventListener("error", () => img.remove());
      img.src = src;
      wrap.appendChild(img);
    }
    return wrap;
  }

  function swatch(background, className) {
    const d = el("div", { class: "de-swatch " + (className || "") });
    d.style.background = background;
    return d;
  }

  return { el, silhouette, lazyImage, swatch, SILHOUETTE };
})();

if (typeof window !== "undefined") window.DEVisuals = DEVisuals;
if (typeof module !== "undefined" && module.exports) module.exports = DEVisuals;
