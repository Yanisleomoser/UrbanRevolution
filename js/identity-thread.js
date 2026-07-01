/**
 * Urban Revolution — #your-style identity thread ("Der Ständer")
 *
 * The identity beat's single --accent-warm moment: a rank of identical COOL
 * threads hangs from a rail; exactly ONE WARM thread swings out of the uniform
 * line and falls in its own curve — "Deinen Stil gab es nie von der Stange."
 *
 * Progressive enhancement (mirrors facts-instruments.js, load-bearing):
 *   - The field is decorative + aria-hidden. The meaning lives in the real
 *     headline + body, so screen readers lose nothing and there are no new
 *     i18n strings or contrast obligations for the graphic itself.
 *   - Default (CSS) = the final drawn resting state. The self-draw entrance is
 *     opt-IN: this module adds html.fx-go, and only html.fx-go rules hide the
 *     start-state. So if this script — or the observer — never runs, the threads
 *     stay VISIBLE, never stuck hidden. prefers-reduced-motion => no fx-go.
 *   - .it-field:empty hides the box when JS is absent (headline still carries it).
 *   - Inline SVG is sized to its container (viewBox = px box, preserveAspectRatio
 *     none) and rebuilt only on a real WIDTH change — never on the mobile
 *     toolbar's height-only resize — matching the page's --svh philosophy.
 *
 * Classic IIFE side-effect module (no global), mirrors ambient-ticker.js /
 * facts-instruments.js.
 */
(function () {
    "use strict";
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urIdentityThread) return;
    window.__urIdentityThread = true;

    const NS = "http://www.w3.org/2000/svg";
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const el = (name, attrs) => {
        const e = document.createElementNS(NS, name);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        return e;
    };
    const pathFn = (fn, n) => {
        let d = "";
        for (let i = 0; i <= n; i++) {
            const p = fn(i / n);
            d += (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1);
        }
        return d;
    };
    // Deterministic PRNG so the rack looks identical on every (re)build.
    const rng = (seed) => {
        let s = seed >>> 0;
        return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    };

    function build() {
        const host = document.getElementById("it-field");
        if (!host) return;
        // Measure the SECTION, not the field: the field starts :empty →
        // display:none (the no-JS guard), so its own box is 0×0 until we fill it.
        // The field is inset:0 of the section, so the section's padding box is
        // exactly the field's rendered size.
        const box = host.parentElement || host;
        const W = box.clientWidth;
        const H = box.clientHeight;
        if (W < 40 || H < 40) return; // not laid out yet — retried after fonts load
        host.setAttribute("viewBox", "0 0 " + W + " " + H);
        host.setAttribute("preserveAspectRatio", "none");
        while (host.firstChild) host.removeChild(host.firstChild);

        const g = el("g", {});
        host.appendChild(g);

        const r = rng(11);
        const railY = H * 0.16;
        const x0 = W * 0.10;
        const x1 = W * 0.90;
        const cx = W * 0.5;

        // The rail the threads hang from.
        g.appendChild(el("line", { class: "it-rail", x1: x0, y1: railY, x2: x1, y2: railY, "stroke-width": 2, "stroke-opacity": 0.42 }));

        // The uniform rank of cool threads (count scales with width).
        const n = clamp(Math.round(W / 34), 12, 44);
        for (let i = 0; i < n; i++) {
            const x = x0 + (x1 - x0) * (i / (n - 1));
            if (Math.abs(x - cx) < W * 0.012) continue; // leave the centre for the warm one
            const len = H * 0.60 * (0.9 + 0.12 * r());
            const sway = (r() - 0.5) * W * 0.006;
            const d = pathFn((t) => [x + sway * Math.sin(t * 3), railY + len * t], 20);
            const line = el("path", { class: r() < 0.22 ? "it-cool it-cool--tint" : "it-cool", d, "stroke-width": 1.4, "stroke-opacity": (0.12 + 0.06 * r()).toFixed(3) });
            line.style.setProperty("--d", (i * 14) + "ms"); // left→right reveal stagger
            g.appendChild(line);
            g.appendChild(el("circle", { class: "it-node", cx, cy: railY, r: 2.2, "fill-opacity": 0.4 }));
        }

        // The ONE warm thread: hangs, then bends out of the rank and falls in an S.
        const warmFn = (t) => {
            const y = railY + H * 0.70 * t;
            const bend = t < 0.26 ? 0 : (t - 0.26) / 0.74;
            const x = cx + W * 0.155 * Math.sin(bend * Math.PI * 0.92) * (0.55 + 0.45 * bend);
            return [x, y];
        };
        const warm = el("path", { class: "it-warm", d: pathFn(warmFn, 90), "stroke-width": 2.7 });
        // After a rebuild that happens AFTER the reveal, draw instantly (no re-draw
        // flicker on rotation / language toggle); the first reveal still animates.
        if (host.classList.contains("is-in")) warm.style.transition = "none";
        g.appendChild(warm);
        const len = warm.getTotalLength ? warm.getTotalLength() : (H * 0.9);
        warm.style.setProperty("--len", String(Math.ceil(len)));
        const tip = warmFn(1);
        g.appendChild(el("circle", { class: "it-warm-dot", cx: tip[0].toFixed(1), cy: tip[1].toFixed(1), r: 5 }));
        g.appendChild(el("circle", { class: "it-warm-dot", cx, cy: railY, r: 3.4 })); // where it leaves the rail
    }

    function reveal() {
        const host = document.getElementById("it-field");
        if (!host) return;
        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) return; // defaults already show everything drawn & calm
        // Opt-in: only now does the hidden start-state apply (see CSS).
        document.documentElement.classList.add("fx-go");
        const mark = () => host.classList.add("is-in");
        if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((e) => { if (e.isIntersecting) { mark(); io.disconnect(); } });
            }, { rootMargin: "0px 0px -12% 0px", threshold: 0.2 });
            io.observe(host);
        }
        // Fail-safe: reveal regardless after a beat (covers engines where the
        // observer doesn't fire reliably for already-visible elements).
        window.setTimeout(mark, 1600);
    }

    let lastWinW = typeof window !== "undefined" ? window.innerWidth : 0;

    function start() {
        build();
        reveal();
        // Re-fit once the web fonts settle the section height (pre-scroll).
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
        // Rebuild only on a real WIDTH change (rotation/resize) — ignore the
        // mobile toolbar's height-only resizes.
        let rt = 0;
        window.addEventListener("resize", () => {
            if (window.innerWidth === lastWinW) return;
            lastWinW = window.innerWidth;
            window.clearTimeout(rt);
            rt = window.setTimeout(build, 150);
        }, { passive: true });
        // German/English swap changes text length → section height; re-fit.
        window.addEventListener("language:change", build);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
