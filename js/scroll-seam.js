/**
 * Urban Revolution — The Living Seam (the scrollbar, morphed into a needle).
 *
 * The page's native scrollbar is hidden cross-browser and replaced by a
 * needle-and-thread that rides the right edge at the true scroll position:
 * the brand-mark needle leads a gradient stitch that draws itself top→bottom
 * in step with scroll, lighting a "knot" at each station it passes. It turns
 * the most utilitarian piece of browser chrome into the brand's central
 * metaphor — the thrown-away line, sewn back into a circle.
 *
 * On a fine pointer the needle is a *real* scrollbar thumb: grab it to scrub,
 * click the thread to jump. Native wheel + keyboard + trackpad scrolling are
 * never touched — only the visual chrome is replaced.
 *
 * Side-effect module (no global export), in the spirit of animations.js /
 * flair.js. Pure progressive enhancement:
 *   - Without JS: the native scrollbar stays; the seam container is invisible.
 *   - prefers-reduced-motion: the native scrollbar stays, the seam shows a
 *     calm, fully-stitched static thread (no needle, no drag).
 *   - Otherwise: the native scrollbar is hidden and the needle takes over —
 *     rAF-throttled, compositor-friendly (a clip rect + a couple of transforms).
 */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const mq = (q) => window.matchMedia && window.matchMedia(q).matches;
  const reduced = mq("(prefers-reduced-motion: reduce)");
  const isTouch = document.documentElement.classList.contains("is-touch");
  const finePointer = mq("(hover: hover) and (pointer: fine)");
  const interactive = finePointer && !isTouch && !reduced;

  // Stations the seam threads through, top → bottom. Only those present and
  // laid out (the studio is hidden until a CTA opens it) get a knot; the set
  // is recomputed on resize, so opening the studio extends the seam naturally.
  const STATIONS = ["manifesto", "loop", "facts", "community"];

  const root = document.getElementById("scroll-seam");
  if (!root) return;
  const docEl = document.documentElement;

  let svg, threadEl, clipRect, needle, hitThumb, knots = [];
  let pathTotal = 0, H = 0, W = 0;
  let ticking = false;
  let dragging = false, dragOffset = 0;

  // Measured once, before the native bar is hidden: 0 → overlay scrollbar
  // (macOS / iOS / mobile), >0 → classic scrollbar that reserves a gutter.
  let scrollbarWidth = 0;

  /* ── Geometry ──────────────────────────────────────────────── */

  // A gentle serpentine the stitch follows — hand-sewn, not a rigid rule. The
  // amplitude is small so it reads as a thread inside the slim scrollbar gutter.
  function xForY(y, w) {
    return w / 2 + Math.sin((y / 230) * Math.PI * 2) * (w * 0.16);
  }
  function buildPathD(w, h) {
    let d = "";
    for (let y = 0; y <= h; y += 6) {
      d += (y === 0 ? "M" : "L") + xForY(y, w).toFixed(1) + " " + y.toFixed(1) + " ";
    }
    return d.trim();
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
    const max = docEl.scrollHeight - docEl.clientHeight;
    const out = [];
    if (max <= 0) return out;
    STATIONS.forEach((id) => {
      const sec = document.getElementById(id);
      if (!sec || !sec.offsetHeight) return;
      const rect = sec.getBoundingClientRect();
      const center = rect.top + docEl.scrollTop + rect.height / 2 - docEl.clientHeight / 2;
      out.push(Math.min(1, Math.max(0, center / max)));
    });
    return out;
  }

  function progress() {
    const max = docEl.scrollHeight - docEl.clientHeight;
    return max > 0 ? Math.min(1, Math.max(0, docEl.scrollTop / max)) : 0;
  }

  /* ── Build ─────────────────────────────────────────────────── */

  function build() {
    const rect = root.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    if (!W || !H) return;

    root.textContent = "";
    knots = [];

    svg = el("svg", { class: "scroll-seam-svg", viewBox: "0 0 " + W + " " + H });
    svg.setAttribute("preserveAspectRatio", "none");

    // Vertical Ocean-Depths gradient + a clip that reveals the stitch top→down.
    const defs = el("defs", {});
    const grad = el("linearGradient", { id: "seam-grad", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(el("stop", { offset: "0%", "stop-color": "#2779a8" }));
    grad.appendChild(el("stop", { offset: "50%", "stop-color": "#2a9d8f" }));
    grad.appendChild(el("stop", { offset: "100%", "stop-color": "#64d6c4" }));
    defs.appendChild(grad);
    const clip = el("clipPath", { id: "seam-clip" });
    clipRect = el("rect", { x: -10, y: 0, width: W + 20, height: 0 });
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    svg.appendChild(defs);

    const d = buildPathD(W, H);
    svg.appendChild(el("path", { class: "scroll-seam-track", d: d }));

    const stitchGroup = el("g", { "clip-path": "url(#seam-clip)" });
    threadEl = el("path", { class: "scroll-seam-thread", d: d, "stroke-dasharray": "7 6" });
    stitchGroup.appendChild(threadEl);
    svg.appendChild(stitchGroup);
    pathTotal = threadEl.getTotalLength();

    // Knots at each laid-out station.
    computeStationFractions().forEach((f) => {
      const y = f * H;
      const knot = el("circle", { class: "scroll-seam-knot", cx: xForY(y, W).toFixed(1), cy: y.toFixed(1), r: 3.2 });
      svg.appendChild(knot);
      knots.push({ node: knot, f: f });
    });

    // The needle — the brand mark, tip at origin so it leads the stitch down.
    needle = el("g", { class: "scroll-seam-needle" });
    needle.appendChild(el("path", { d: "M-1.7 -22 A1.7 1.7 0 0 1 1.7 -22 L0.9 -4 L0 0 L-0.9 -4 Z", fill: "currentColor" }));
    needle.appendChild(el("rect", { class: "seam-eye", x: -0.65, y: -19.5, width: 1.3, height: 7, rx: 0.65 }));
    svg.appendChild(needle);

    if (interactive) {
      // A thin click/jump track along the outer edge + a roomy grab box that
      // travels with the needle. Both are transparent and the only parts of the
      // seam that take pointer events (the container is pointer-events:none).
      const trackW = Math.min(14, W);
      const hitTrack = el("rect", { class: "scroll-seam-hit", x: W - trackW, y: 0, width: trackW, height: H });
      hitTrack.addEventListener("pointerdown", (e) => onDown(e, false));
      svg.appendChild(hitTrack);

      hitThumb = el("rect", { class: "scroll-seam-hit", x: 0, y: 0, width: 22, height: 46, rx: 11 });
      hitThumb.addEventListener("pointerdown", (e) => onDown(e, true));
      svg.appendChild(hitThumb);
    }

    root.appendChild(svg);

    if (reduced) {
      clipRect.setAttribute("height", H);                       // fully stitched
      knots.forEach((k) => k.node.classList.add("is-stitched")); // every knot lit
    } else {
      render();
    }
    root.classList.add("is-ready");
  }

  /* ── Render (scroll → seam) ────────────────────────────────── */

  function render() {
    if (!threadEl) return;
    const p = progress();
    const pt = threadEl.getPointAtLength(p * pathTotal);
    // Tangent (a hair before/after) so the needle follows the weave's curve.
    const back = threadEl.getPointAtLength(Math.max(0, p * pathTotal - 2));
    const fwd = threadEl.getPointAtLength(Math.min(pathTotal, p * pathTotal + 2));
    const angle = Math.atan2(-(fwd.x - back.x), fwd.y - back.y) * (180 / Math.PI);

    clipRect.setAttribute("height", pt.y.toFixed(1));
    needle.setAttribute("transform", "translate(" + pt.x.toFixed(1) + " " + pt.y.toFixed(1) + ") rotate(" + angle.toFixed(2) + ")");
    needle.style.opacity = p > 0.002 && p < 0.999 ? "1" : "0";
    if (hitThumb) {
      hitThumb.setAttribute("x", (pt.x - 11).toFixed(1));
      hitThumb.setAttribute("y", (pt.y - 23).toFixed(1));
    }

    for (let i = 0; i < knots.length; i++) {
      knots[i].node.classList.toggle("is-stitched", p >= knots[i].f - 0.002);
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { render(); ticking = false; });
  }

  /* ── Drag the needle like a scrollbar thumb ────────────────── */

  function clientYToProgress(clientY) {
    const r = root.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientY - r.top) / (H || 1)));
  }
  function applyProgress(p) {
    const max = docEl.scrollHeight - docEl.clientHeight;
    // "instant" (not "auto") so dragging never inherits html{scroll-behavior:smooth}.
    window.scrollTo({ top: Math.min(1, Math.max(0, p)) * max, behavior: "instant" });
  }
  function onDown(e, onThumb) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    root.classList.add("is-dragging");
    docEl.classList.add("seam-dragging");
    needle.classList.add("is-grabbing");
    // Grabbing the thumb keeps the current offset (no jump); pressing the track
    // jumps straight to the press point, then scrubs from there.
    dragOffset = onThumb ? progress() - clientYToProgress(e.clientY) : 0;
    if (!onThumb) applyProgress(clientYToProgress(e.clientY));
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    applyProgress(clientYToProgress(e.clientY) + dragOffset);
    e.preventDefault();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("is-dragging");
    docEl.classList.remove("seam-dragging");
    needle.classList.remove("is-grabbing");
  }

  /* ── Resize / lifecycle ────────────────────────────────────── */

  // Rebuild only on real geometry changes — viewport rotation/resize, the
  // studio reveal or a language swap (both change page height → station
  // fractions), a font swap. A height-only toolbar slide is ignored.
  let lastW = -1, lastH = -1, lastSH = -1, rebuildTimer = 0;
  function snapshot() {
    const r = root.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), sh: docEl.scrollHeight };
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
    // Measure the native scrollbar BEFORE hiding it, and size the needle gutter
    // to match it (so the needle sits where the scrollbar was). Overlay
    // scrollbars report 0 → fall back to a slim, sensible gutter.
    scrollbarWidth = window.innerWidth - docEl.clientWidth;
    const gutter = scrollbarWidth > 0 ? Math.min(28, Math.max(16, scrollbarWidth + 6)) : 18;
    docEl.style.setProperty("--seam-gutter", gutter + "px");

    // Hand the scrollbar over to the needle (kept native under reduced motion).
    if (!reduced) docEl.classList.add("seam-scroll");

    const s = snapshot();
    lastW = s.w; lastH = s.h; lastSH = s.sh;
    build();

    if (!reduced) window.addEventListener("scroll", onScroll, { passive: true });
    if (interactive) {
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp, { passive: true });
      window.addEventListener("pointercancel", onUp, { passive: true });
    }
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });
    // A language swap re-flows section heights → re-measure the knot positions.
    window.addEventListener("language:change", () => { lastSH = -1; onResize(); });
    // After the font swap, section heights shift → re-measure.
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
