/**
 * Urban Revolution — Hero „Lebender Prompt" (Konzept A)
 *
 * Macht die Hero-Sektion zum Hook: eine Prompt-Konsole tippt sich
 * selbst durch Beispiel-Prompts. Tippt der Nutzer selbst (oder klickt
 * „Designen"), wird der Text in den echten Editor (#ai-prompt / #design)
 * übernommen.
 *
 * Progressive enhancement: ohne JS bleibt ein normales Eingabefeld
 * mit Submit-Button. Honoriert prefers-reduced-motion (kein Tippen —
 * nur ein statisches Beispiel als Starthilfe).
 *
 * Side-effect-Modul im Stil von animations.js (kein globaler Export).
 * Die Beispiel-Texte kommen aus i18n (`hero.examples`).
 */
(function() {
    "use strict";

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

        let examples = getExamples();
        let currentExample = examples[0] || "";

        // ── Reduced motion: kein Tippen, nur ein statisches Beispiel ──
        if (prefersReduced()) {
            typed.textContent = currentExample;
            const caret = ghost.querySelector(".hero-prompt-caret");
            if (caret) caret.style.display = "none";
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
