/**
 * Urban Revolution — Der Faden (die durchgehende Naht der Erzählung)
 *
 * Sechs Nähte (.fil-seam, statisches Markup) verbinden die Sektionen
 * unterhalb von #facts zu EINER Linie: der Besucher zieht den Faden beim
 * Scrollen selbst (Scrub auf stroke-dashoffset). Dramaturgie:
 *   Naht 1 (facts → pivot)  — die alte Linie, aschfahl, gerade, tot.
 *   Naht 2–6 (nach der Wende) — der Faden lebt: Teal/Aqua, und ein
 *   Glint-Signal wandert ihn periodisch entlang (versetzt je Naht, wie
 *   ein Impuls, der die Seite hinunterläuft).
 *
 * Progressive Enhancement: Ruhezustand = fertig gezeichnete Naht
 * (CSS-Default). Erst dieses Skript setzt html.fil-go (Startzustände)
 * und scrubbt — nur wenn GSAP/ScrollTrigger da sind, html.fx steht und
 * keine reduzierte Bewegung gewünscht ist. Glints laufen per rAF, nur
 * für Nähte im Viewport, pausieren bei verstecktem Tab.
 *
 * Classic IIFE side-effect module (kein Global), wie facts-mass.js.
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFaden) return;
    window.__urFaden = true;

    const GLINT_PERIOD = 7000;  // ms pro Wanderung
    const GLINT_STAGGER = 1300; // Versatz je Naht → Impuls-Kaskade

    function init() {
        const seams = Array.prototype.slice.call(document.querySelectorAll(".fil-seam"));
        if (!seams.length) return;
        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const fx = document.documentElement.classList.contains("fx");
        const gs = window.gsap;
        const ST = window.ScrollTrigger;
        // Ohne Motion-Zusage bleibt der CSS-Ruhezustand (gezeichnete Naht) stehen.
        if (reduce || !fx || !gs || !ST) return;
        document.documentElement.classList.add("fil-go");

        const glints = [];
        seams.forEach(function (seam, i) {
            const paths = Array.prototype.slice.call(seam.querySelectorAll(".fil-path"));
            if (!paths.length) return;
            // Beide Breakpoint-Varianten scrubben (die verborgene ist harmlos) —
            // so überlebt ein Resize über den 860px-Umbruch ohne Re-Init.
            gs.fromTo(paths, { strokeDashoffset: 1 }, {
                strokeDashoffset: 0,
                ease: "none",
                scrollTrigger: { trigger: seam, start: "top 88%", end: "bottom 52%", scrub: 0.5 },
            });
            const dot = seam.querySelector(".fil-glint");
            if (dot) {
                glints.push({ seam: seam, paths: paths, dot: dot, t0: i * GLINT_STAGGER, seen: false, len: 0, path: null });
            }
        });

        if (!glints.length) return;

        // Sichtbarkeit je Naht (rAF läuft nur für Nähte im Viewport).
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                const g = glints.find(function (x) { return x.seam === e.target; });
                if (g) g.seen = e.isIntersecting;
            });
        }, { rootMargin: "10% 0px" });
        glints.forEach(function (g) { io.observe(g.seam); });

        // Sichtbare Pfad-Variante wählen (S6 hat Desktop-/Mobil-Weg) — nur bei
        // Resize neu bestimmen, nicht pro Frame.
        function pickPaths() {
            glints.forEach(function (g) {
                g.path = g.paths.find(function (p) { return p.getClientRects().length > 0; }) || g.paths[0];
                g.len = g.path.getTotalLength();
            });
        }
        pickPaths();
        let resizeT = 0;
        window.addEventListener("resize", function () {
            window.clearTimeout(resizeT);
            resizeT = window.setTimeout(pickPaths, 200);
        }, { passive: true });

        // Glint-Wanderung: weiches Ein-/Ausblenden an den Enden, Ease über die Mitte.
        function frame(now) {
            if (!document.hidden) {
                glints.forEach(function (g) {
                    if (!g.seen || !g.path || !g.len) { g.dot.style.opacity = "0"; return; }
                    const u = ((now + g.t0) % GLINT_PERIOD) / GLINT_PERIOD;
                    if (u > 0.62) { g.dot.style.opacity = "0"; return; } // Pause zwischen Impulsen
                    const t = u / 0.62;
                    const eased = t * t * (3 - 2 * t); // smoothstep
                    const pt = g.path.getPointAtLength(eased * g.len);
                    // viewBox-Koordinaten (100×240, gestreckt) → Pixel der Naht
                    const w = g.seam.clientWidth;
                    const hh = g.seam.clientHeight;
                    const fade = Math.min(1, Math.min(t, 1 - t) * 6);
                    g.dot.style.transform = "translate(" + (pt.x / 100 * w - 1.5) + "px," + (pt.y / 240 * hh - 1.5) + "px)";
                    g.dot.style.opacity = String(0.9 * fade);
                });
            }
            window.requestAnimationFrame(frame);
        }
        window.requestAnimationFrame(frame);
    }

    document.addEventListener("DOMContentLoaded", init);
})();
