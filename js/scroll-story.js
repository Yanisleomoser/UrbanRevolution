/**
 * Urban Revolution — Scroll-driven pinned story ("Mission/Vision")
 *
 * Drives the Apple-style pinned section: while the tall `.mission-track`
 * scrolls past, the sticky `.mission-stage` stays pinned and the beats
 * crossfade. JS does the minimum: read the track's position once per
 * frame, write a single `--progress` custom property (0→1) and toggle
 * `.is-active` on exactly one beat + matching dot when the active beat
 * changes. All visuals live in CSS (opacity/transform only).
 *
 * Honors prefers-reduced-motion: when set, the script no-ops — the CSS
 * flattens the section into a normal, fully-visible stacked block, so
 * the content stays readable without any pinning.
 *
 * No cleanup: single-page app, one load. Listener is passive +
 * rAF-throttled to keep scrolling smooth (mirrors initNavScroll in
 * js/animations.js).
 */
(function() {
    function prefersReduced() {
        return window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function init() {
        const track = document.querySelector("[data-scroll-story]");
        if (!track) return;

        // Reduced motion: CSS already shows every beat statically.
        if (prefersReduced()) return;

        const beats = Array.from(track.querySelectorAll(".mission-beat"));
        const dots = Array.from(track.querySelectorAll(".mission-dot"));
        if (beats.length < 2) return;

        let current = 0;
        let ticking = false;

        function setActive(idx) {
            beats.forEach((b, i) => b.classList.toggle("is-active", i === idx));
            dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
        }

        function update() {
            ticking = false;
            const rect = track.getBoundingClientRect();
            const scrollable = rect.height - window.innerHeight;
            if (scrollable <= 0) return;

            // 0 when the track top reaches the viewport top, 1 at the end.
            let p = -rect.top / scrollable;
            p = Math.max(0, Math.min(1, p));
            track.style.setProperty("--progress", p.toFixed(4));

            const idx = Math.min(beats.length - 1, Math.floor(p * beats.length));
            if (idx !== current) {
                setActive(idx);
                current = idx;
            }
        }

        function onScroll() {
            if (!ticking) {
                requestAnimationFrame(update);
                ticking = true;
            }
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        update();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
