/**
 * Urban Revolution — Hero „Lebender Prompt" (Konzept A)
 *
 * Macht die Hero-Sektion zum Hook: eine Prompt-Konsole tippt sich
 * selbst durch Beispiel-Prompts, und die SVG-Figur rechts morpht
 * farblich passend zum gerade getippten Look mit. Tippt der Nutzer
 * selbst (oder klickt „Designen"), wird der Text in den echten
 * Editor (#ai-prompt / #design) übernommen.
 *
 * Progressive enhancement: ohne JS bleibt ein normales Eingabefeld
 * mit Submit-Button. Honoriert prefers-reduced-motion (kein Tippen,
 * kein Farb-Morph — nur ein statisches Beispiel als Starthilfe).
 *
 * Side-effect-Modul im Stil von animations.js (kein globaler Export).
 * Die Beispiel-Texte kommen aus i18n (`hero.examples`), die zugehörigen
 * Farb-Looks sind sprachunabhängig hier indexgleich hinterlegt.
 */
(function() {
    "use strict";

    // Farb-Looks indexgleich zu i18n `hero.examples`. Jeder Look färbt die
    // drei Gradient-Stops der Figur + Backdrop-Glow + Partikel.
    const LOOKS = [
        { stops: ["#fb923c", "#ec4899", "#a855f7"], glow: "rgba(249,115,22,0.20)" }, // Sonnenuntergang
        { stops: ["#fde68a", "#fca5a5", "#f9a8d4"], glow: "rgba(252,211,77,0.18)" }, // Leinen / Sommer
        { stops: ["#a855f7", "#8b5cf6", "#22d3ee"], glow: "rgba(168,85,247,0.22)" }, // Cyberpunk-Neon
        { stops: ["#e4e4e7", "#a1a1aa", "#52525b"], glow: "rgba(161,161,170,0.16)" }, // Minimal Schwarz/Grau
        { stops: ["#38bdf8", "#0ea5e9", "#1d4ed8"], glow: "rgba(14,165,233,0.20)" }, // Tiefsee-Blau
        { stops: ["#4ade80", "#22c55e", "#15803d"], glow: "rgba(34,197,94,0.20)" },  // Waldgrün
    ];

    // Ausgangs-Look (entspricht dem Markup-Default der Figur).
    const DEFAULT_LOOK = { stops: ["#ec4899", "#8b5cf6", "#06b6d4"], glow: "rgba(236,72,153,0.18)" };

    const TYPE_MS = 42;     // Tempo beim Tippen
    const ERASE_MS = 20;    // Tempo beim Löschen
    const HOLD_FULL = 1700; // Pause bei vollständigem Beispiel
    const HOLD_EMPTY = 350; // Pause vor dem nächsten Beispiel

    function prefersReduced() {
        return !!(window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function getExamples() {
        const ex = window.I18N && window.I18N.t("hero.examples");
        return Array.isArray(ex) && ex.length ? ex : [];
    }

    function init() {
        const form = document.getElementById("hero-prompt-form");
        const input = document.getElementById("hero-prompt-input");
        const ghost = document.getElementById("hero-prompt-ghost");
        const typed = ghost && ghost.querySelector(".hero-prompt-typed");
        if (!form || !input || !typed) return; // Markup fehlt → still nichts tun

        const svg = document.querySelector(".hero-asset-svg");
        const stopEls = [
            document.getElementById("heroStop1"),
            document.getElementById("heroStop2"),
            document.getElementById("heroStop3"),
        ];
        const backdrop = document.getElementById("heroBackdropStop");
        const particles = svg ? svg.querySelectorAll(".hero-asset-particles circle") : [];

        let examples = getExamples();
        let currentExample = examples[0] || "";

        function applyLook(look) {
            stopEls.forEach((el, i) => {
                if (el && look.stops[i]) el.setAttribute("stop-color", look.stops[i]);
            });
            if (backdrop && look.glow) {
                backdrop.setAttribute("stop-color", look.glow);
            }
            // Partikel zyklisch in die Look-Farben tauchen
            particles.forEach((c, i) => {
                const col = look.stops[i % look.stops.length];
                if (col) c.setAttribute("fill", col);
            });
            // Kurzer „Ping" über filter (kollidiert nicht mit der Float-Animation)
            if (svg) {
                svg.classList.remove("is-morphing");
                // reflow erzwingen, damit der Klassen-Toggle erneut greift
                void svg.offsetWidth;
                svg.classList.add("is-morphing");
                window.setTimeout(() => svg.classList.remove("is-morphing"), 600);
            }
        }

        // ── Reduced motion: kein Tippen, nur ein statisches Beispiel + Look ──
        if (prefersReduced()) {
            typed.textContent = currentExample;
            const caret = ghost.querySelector(".hero-prompt-caret");
            if (caret) caret.style.display = "none";
            applyLook(LOOKS[0] || DEFAULT_LOOK);
            wireSubmit();
            return;
        }

        // ── Typewriter-Zustandsmaschine ──
        let idx = 0;
        let timer = null;
        let paused = false;

        function clearTimer() {
            if (timer) { window.clearTimeout(timer); timer = null; }
        }

        function typeExample() {
            if (paused) return;
            const text = examples[idx % examples.length] || "";
            currentExample = text;
            applyLook(LOOKS[idx % LOOKS.length] || DEFAULT_LOOK);
            let pos = 0;
            (function step() {
                if (paused) return;
                typed.textContent = text.slice(0, pos);
                pos += 1;
                if (pos <= text.length) {
                    timer = window.setTimeout(step, TYPE_MS);
                } else {
                    timer = window.setTimeout(eraseExample, HOLD_FULL);
                }
            })();
        }

        function eraseExample() {
            if (paused) return;
            const text = typed.textContent;
            (function step() {
                if (paused) return;
                if (text.length === 0) { return; }
                typed.textContent = typed.textContent.slice(0, -1);
                if (typed.textContent.length > 0) {
                    timer = window.setTimeout(step, ERASE_MS);
                } else {
                    idx += 1;
                    timer = window.setTimeout(typeExample, HOLD_EMPTY);
                }
            })();
        }

        function start() {
            paused = false;
            clearTimer();
            if (!examples.length) return;
            typeExample();
        }

        function stop() {
            paused = true;
            clearTimer();
        }

        // ── Fokus / Eingabe: Typewriter anhalten, Ghost ausblenden ──
        input.addEventListener("focus", stop);
        input.addEventListener("input", () => {
            form.classList.toggle("is-filled", input.value.trim().length > 0);
        });
        input.addEventListener("blur", () => {
            if (input.value.trim().length === 0) {
                form.classList.remove("is-filled");
                idx = 0;
                start();
            }
        });

        // Pausieren, wenn der Hero nicht sichtbar ist (Akku/Perf schonen)
        if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        if (document.activeElement !== input && input.value.trim() === "") start();
                    } else {
                        stop();
                    }
                });
            }, { threshold: 0.1 });
            io.observe(form);
        } else {
            start();
        }

        wireSubmit();

        // Sprache gewechselt → Beispiele neu laden und Lauf neu starten
        window.addEventListener("language:change", () => {
            examples = getExamples();
            idx = 0;
            if (document.activeElement !== input && input.value.trim() === "") {
                start();
            }
        });

        // ── Submit: Prompt in den echten Editor übernehmen ──
        function wireSubmit() {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const text = input.value.trim() || currentExample;
                handoff(text);
            });
        }
    }

    // Übergabe an den Design-Flow: Text ins echte Textarea, sanft scrollen,
    // fokussieren. Greift nicht in app.js ein — feuert nur ein input-Event,
    // falls dort jemand lauscht.
    function handoff(text) {
        const target = document.getElementById("ai-prompt");
        const section = document.getElementById("design");
        if (target && text) {
            target.value = text;
            target.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const reduce = !!(window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        if (section) {
            section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
        if (target) {
            window.setTimeout(() => target.focus({ preventScroll: true }), reduce ? 0 : 500);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
