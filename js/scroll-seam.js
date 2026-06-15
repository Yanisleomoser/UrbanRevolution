/**
 * Urban Revolution — The Living Seam.
 *
 * A needle-and-thread that stitches the whole page together as you scroll.
 * A single, continuous gesture down the left gutter: the brand-mark needle
 * leads a gradient stitch that draws itself top→bottom in step with your
 * scroll, lighting a "knot" at each station it passes. It unifies the loader
 * and circular-loop needle motifs into one page-spanning seam — the brand's
 * central metaphor made literal ("Wir biegen die Linie zurück zum Kreis":
 * the thrown-away line, sewn back together).
 *
 * Side-effect module (no global export), in the spirit of animations.js /
 * flair.js. Pure progressive enhancement:
 *   - Without JS: the container stays empty and invisible (CSS opacity:0).
 *   - With JS, prefers-reduced-motion: a calm, fully-stitched static seam,
 *     no needle travel, all knots lit — the aesthetic without the motion.
 *   - Otherwise: the seam draws live with scroll (rAF-throttled, compositor
 *     friendly — only a clip rect, one transform and a few class toggles move).
 */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const reduced = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Stations the seam threads through, top → bottom. Only those present and
  // laid out (the studio is hidden until a CTA opens it) get a knot; the set
  // is recomputed on resize, so opening the studio extends the seam naturally.
  const STATIONS = ["manifesto", "loop", "facts", "community"];

  const root = document.getElementById("scroll-seam");
  if (!root) return;

  let svg, threadEl, clipRect, needle, knots = [];
  let pathTotal = 0;
  let H = 0;
  let stationFractions = [];
  let ticking = false;

  // A gentle serpentine the stitch follows — hand-sewn, not a rigid rule.
  function buildPathD(w, h) {
    const cx = w / 2;
    const amp = w * 0.26;
    const wavelength = 250; // px per full weave
    let d = "";
    for (let y = 0; y <= h; y += 6) {
      const x = cx + Math.sin((y / wavelength) * Math.PI * 2) * amp;
      d += (y === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
    }
    return d.trim();
  }

  function xForY(y, w) {
    return w / 2 + Math.sin((y / 250) * Math.PI * 2) * (w * 0.26);
  }

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // Each station's scroll progress (0..1) at the moment it sits mid-viewport —
  // the same 0..1 the needle rides on, so a knot lights exactly as the seam
  // reaches it. Sections with no layout box (hidden studio) are skipped.
  function computeStationFractions() {
    const docEl = document.documentElement;
    const max = docEl.scrollHeight - docEl.clientHeight;
    const out = [];
    if (max <= 0) return out;
    STATIONS.forEach((id) => {
      const sec = document.getElementById(id);
      if (!sec || !sec.offsetHeight) return;
      const rect = sec.getBoundingClientRect();
      const top = rect.top + docEl.scrollTop;
      const center = top + rect.height / 2 - docEl.clientHeight / 2;
      out.push(Math.min(1, Math.max(0, center / max)));
    });
    return out;
  }

  function build() {
    const rect = root.getBoundingClientRect();
    const w = rect.width;
    H = rect.height;
    if (!w || !H) return;

    root.textContent = "";
    knots = [];

    svg = el("svg", { class: "scroll-seam-svg", viewBox: "0 0 " + w + " " + H });
    svg.setAttribute("preserveAspectRatio", "none");

    // Vertical Ocean-Depths gradient + a clip that reveals the stitch top→down.
    const defs = el("defs", {});
    const grad = el("linearGradient", { id: "seam-grad", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(el("stop", { offset: "0%", "stop-color": "#2779a8" }));
    grad.appendChild(el("stop", { offset: "50%", "stop-color": "#2a9d8f" }));
    grad.appendChild(el("stop", { offset: "100%", "stop-color": "#64d6c4" }));
    defs.appendChild(grad);
    const clip = el("clipPath", { id: "seam-clip" });
    clipRect = el("rect", { x: -10, y: 0, width: w + 20, height: 0 });
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    svg.appendChild(defs);

    const d = buildPathD(w, H);

    // Faint full guide (always visible) + the gradient stitch that gets revealed.
    svg.appendChild(el("path", { class: "scroll-seam-track", d: d }));

    const stitchGroup = el("g", { "clip-path": "url(#seam-clip)" });
    threadEl = el("path", {
      class: "scroll-seam-thread", d: d,
      "stroke-dasharray": "7 6", "pathLength": "1000",
    });
    stitchGroup.appendChild(threadEl);
    svg.appendChild(stitchGroup);
    pathTotal = threadEl.getTotalLength();

    // Knots at each laid-out station.
    stationFractions = computeStationFractions();
    stationFractions.forEach((f) => {
      const y = f * H;
      const knot = el("circle", { class: "scroll-seam-knot", cx: xForY(y, w).toFixed(1), cy: y.toFixed(1), r: 3.4 });
      svg.appendChild(knot);
      knots.push({ node: knot, f: f });
    });

    // The needle — the brand mark, tip at origin so it leads the stitch down.
    needle = el("g", { class: "scroll-seam-needle" });
    needle.appendChild(el("path", { d: "M-1.7 -22 A1.7 1.7 0 0 1 1.7 -22 L0.9 -4 L0 0 L-0.9 -4 Z", fill: "currentColor" }));
    needle.appendChild(el("rect", { class: "seam-eye", x: -0.65, y: -19.5, width: 1.3, height: 7, rx: 0.65 }));
    svg.appendChild(needle);

    root.appendChild(svg);

    if (reduced) {
      // Static, fully stitched, every knot lit — no needle (hidden via CSS).
      clipRect.setAttribute("height", H);
      knots.forEach((k) => k.node.classList.add("is-stitched"));
    } else {
      render();
    }
    root.classList.add("is-ready");
  }

  function render() {
    if (!threadEl) return;
    const docEl = document.documentElement;
    const max = docEl.scrollHeight - docEl.clientHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, docEl.scrollTop / max)) : 0;

    const pt = threadEl.getPointAtLength(p * pathTotal);
    // Tangent (a hair before/after) so the needle follows the weave's curve.
    const back = threadEl.getPointAtLength(Math.max(0, p * pathTotal - 2));
    const fwd = threadEl.getPointAtLength(Math.min(pathTotal, p * pathTotal + 2));
    const angle = Math.atan2(-(fwd.x - back.x), fwd.y - back.y) * (180 / Math.PI);

    clipRect.setAttribute("height", pt.y.toFixed(1));
    needle.setAttribute("transform", "translate(" + pt.x.toFixed(1) + " " + pt.y.toFixed(1) + ") rotate(" + angle.toFixed(2) + ")");
    needle.style.opacity = p > 0.002 && p < 0.999 ? "1" : "0";

    for (let i = 0; i < knots.length; i++) {
      knots[i].node.classList.toggle("is-stitched", p >= knots[i].f - 0.002);
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { render(); ticking = false; });
  }

  // Rebuild when the real geometry shifts: viewport rotation/resize, the studio
  // reveal or a language swap (both change page height → station fractions), a
  // font swap. A height-only toolbar slide (same width + scrollHeight) is
  // ignored so the seam never churns mid-scroll.
  let lastW = -1, lastH = -1, lastSH = -1, rebuildTimer = 0;
  function snapshot() {
    const r = root.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), sh: document.documentElement.scrollHeight };
  }
  function onResize() {
    const s = snapshot();
    if (s.w === lastW && s.h === lastH && s.sh === lastSH) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      const cur = snapshot();
      lastW = cur.w; lastH = cur.h; lastSH = cur.sh;
      build();
    }, 120);
  }

  function init() {
    const s = snapshot();
    lastW = s.w; lastH = s.h; lastSH = s.sh;
    build();
    if (!reduced) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });
    // A language swap re-flows section heights → re-measure the knot positions.
    window.addEventListener("language:change", () => { lastSH = -1; onResize(); });
    // After the font swap, section heights shift → re-measure knot positions.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { lastSH = -1; onResize(); });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
