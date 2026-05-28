/**
 * Urban Revolution — Scroll-driven reveal animations
 *
 * Lightweight IntersectionObserver wrapper that adds `.is-revealed`
 * to elements marked with `data-reveal` when they enter the viewport.
 * Keeps the actual animation in CSS — JS just toggles the class.
 *
 * Honors prefers-reduced-motion: skipped entirely when user opts out
 * (CSS guardrails neutralise transitions anyway, but skipping the
 * observer avoids the brief opacity-0 flash on first paint).
 *
 * Stagger: containers can declare `data-reveal-stagger` and children
 * automatically get a small CSS transition-delay so they cascade in.
 */
(function() {
    const REVEAL_ATTR = "data-reveal";
    const STAGGER_ATTR = "data-reveal-stagger";
    const REVEALED_CLASS = "is-revealed";

    function prefersReduced() {
        return window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function applyStagger(container) {
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
            children[i].style.setProperty("--reveal-delay", `${i * 60}ms`);
        }
    }

    function init() {
        const targets = document.querySelectorAll(`[${REVEAL_ATTR}]`);
        if (!targets.length) return;

        if (prefersReduced() || !("IntersectionObserver" in window)) {
            // Reveal everything immediately — no animation
            targets.forEach((el) => el.classList.add(REVEALED_CLASS));
            return;
        }

        // Pre-compute stagger delays for any container that wants them
        document.querySelectorAll(`[${STAGGER_ATTR}]`).forEach(applyStagger);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add(REVEALED_CLASS);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            // Fire slightly before the element fully enters — feels more
            // natural than waiting for it to be fully visible.
            rootMargin: "0px 0px -10% 0px",
            threshold: 0.01,
        });

        targets.forEach((el) => observer.observe(el));
    }

    /**
     * Navbar gets a subtle background shift after the user scrolls past
     * the hero. Pure presentational — toggles `.scrolled` on the nav.
     */
    function initNavScroll() {
        const nav = document.querySelector(".navbar");
        if (!nav) return;
        const onScroll = () => {
            nav.classList.toggle("scrolled", window.scrollY > 40);
        };
        onScroll();
        // Passive listener — never blocks scroll
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    function start() {
        init();
        initNavScroll();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
