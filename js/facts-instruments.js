/**
 * Urban Revolution — #facts interactive data-instruments
 *
 * Turns the three cited fast-fashion statistics into premium, tactile
 * instruments instead of static numbers (or a wallpaper photo):
 *   1. "1-in-100" matrix — 100 cells, exactly ONE glows = the <1 % recycled.
 *      A pointer spotlight (fine pointer only) sweeps the grid so you feel how
 *      vanishingly small that fraction is.
 *   2. Live accumulation bars — the rising "pile" beside the live kg odometer
 *      (driven by ambient-ticker.js, [data-ticker-kg]): the waste stacks up
 *      while you read.
 *   3. Radial gauge — an 8 % arc sweeping in = fashion's slice of global CO₂.
 *
 * Progressive enhancement, load-bearing:
 *   - Instruments are aria-hidden — the meaning lives in the adjacent big
 *     number + caption (real text), so screen readers lose nothing.
 *   - Default CSS = final resting state. Entrance/sweep/pulse are gated under
 *     html.fx; the pointer spotlight under (pointer: fine). So no-JS and
 *     prefers-reduced-motion show everything calm and complete.
 *   - The matrix cells are built here; .fx-matrix:empty hides the box when JS
 *     is absent (number + caption still carry the fact).
 *
 * Classic IIFE side-effect module (no global), mirrors ambient-ticker.js.
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFactsInstruments) return;
    window.__urFactsInstruments = true;

    const ON_CELL = 47; // which of 0..99 lights up — deterministic, visually central

    function build() {
        // 1 · Matrix cells (only once; idempotent)
        const matrix = document.getElementById("fx-matrix");
        if (matrix && !matrix.childElementCount) {
            const frag = document.createDocumentFragment();
            for (let i = 0; i < 100; i++) {
                const cell = document.createElement("span");
                cell.className = "fx-cell" + (i === ON_CELL ? " is-on" : "");
                cell.style.setProperty("--d", (i * 6) + "ms"); // sweep-in stagger
                frag.appendChild(cell);
            }
            matrix.appendChild(frag);
        }

        // 2 · Accumulation bars — left→right rise stagger
        const bars = document.querySelectorAll(".fx-acc .fx-acc-bar");
        bars.forEach((bar, i) => bar.style.setProperty("--d", (i * 45) + "ms"));

        // Reveal: add .is-in when each instrument scrolls into view (triggers the
        // html.fx-gated entrance). No-IO fallback shows them immediately.
        const instruments = document.querySelectorAll(".fx-matrix, .fx-acc, .fx-gauge");
        if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
                });
            }, { threshold: 0.4 });
            instruments.forEach((el) => io.observe(el));
        } else {
            instruments.forEach((el) => el.classList.add("is-in"));
        }

        // Pointer spotlight on the matrix — fine pointer only, purely decorative.
        if (matrix && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
            let cachedRect = null;
            const invalidateRect = () => { cachedRect = null; };
            window.addEventListener("resize", invalidateRect, { passive: true });
            window.addEventListener("scroll", invalidateRect, { passive: true, capture: true });
            matrix.addEventListener("pointermove", (e) => {
                if (!cachedRect) cachedRect = matrix.getBoundingClientRect();
                matrix.style.setProperty("--mx", ((e.clientX - cachedRect.left) / cachedRect.width * 100) + "%");
                matrix.style.setProperty("--my", ((e.clientY - cachedRect.top) / cachedRect.height * 100) + "%");
            });
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
    else build();
})();
