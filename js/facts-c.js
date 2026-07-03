/**
 * Urban Revolution — #facts Variante C „Die Linie" (Controller)
 *
 * Eine durchgehende Linie durchläuft drei Stationen: der Fächer aus 100
 * Strängen (8 schwere Kabel = die Mode), die Sekunden-Ratsche (1 Kerbe =
 * 1 Sekunde = 1 Lkw-Ladung) und die Abzweigung (99 fahren weiter, 1 Strang
 * biegt als offener Bogen zurück). Dieses Skript inszeniert NUR die
 * Bewegung — der statische Default (CSS) ist die fertig gezeichnete Szene.
 *
 * Modi:
 *   A) html.fx + GSAP/ScrollTrigger → gescrubbtes Zeichnen über die ganze
 *      Sektion (kein Pinning), Text-Reveals via [data-lp-reveal]/landing.js.
 *   B) Bewegung erlaubt, aber kein GSAP → html.fxc-go + IntersectionObserver,
 *      CSS-Transitions ziehen pro Station in den Grundzustand.
 *   C) prefers-reduced-motion oder kein JS → nichts; Ruhezustand steht.
 * Die Ratsche tickt in A und B (echte Zeit), pausiert offscreen/als
 * Hintergrund-Tab und läuft unter reduced motion gar nicht.
 *
 * Classic IIFE side-effect module (kein Global), wie facts-instruments.js.
 * Läuft nur, wenn Slot #facts-c sichtbar ist (Varianten-Labor).
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFactsC) return;
    window.__urFactsC = true;

    let started = false;

    // Sichtbarkeit eines Elements (Desktop-/Mobil-SVG-Variante) feststellen.
    const isVisible = (el) => !!el && el.getClientRects().length > 0;

    /* ── Sekunden-Ratsche: 1 Kerbe pro echter Sekunde ──────────────────
       Pro Tick: (1) Rebase auf die Ruheform (bildidentisch, da die älteste
       Stufe in der Maskenblende liegt), (2) neue Kerbe hart anhängen
       („Schlag"), (3) Gruppe weich um eine Kerbe zurückgleiten lassen.
       Begrenzt: die Pfadform bleibt konstant gross (Fenster-Prinzip). */
    function initRatchet(scene) {
        const groups = Array.prototype.slice.call(scene.querySelectorAll(".fxc-ratchet-g"));
        if (!groups.length) return;
        let timer = null;
        let inView = false;

        const tick = () => {
            groups.forEach((g) => {
                const rest = g.getAttribute("data-rest");
                const w = parseFloat(g.getAttribute("data-step-w"));
                const h = parseFloat(g.getAttribute("data-step-h"));
                const path = g.querySelector(".fxc-steps");
                if (!rest || !path || !w) return;
                g.style.transition = "none";
                g.style.transform = "translate(0px, 0px)";
                path.setAttribute("d", rest + "h" + w + "v" + h);
                g.getBoundingClientRect(); // Reflow erzwingen: der Schlag steht
                g.style.transition = "transform 0.42s cubic-bezier(0.2, 0.8, 0.3, 1)";
                g.style.transform = "translate(" + (-w) + "px, " + (-h) + "px)";
            });
        };
        const update = () => {
            const run = inView && !document.hidden;
            if (run && timer === null) timer = window.setInterval(tick, 1000);
            else if (!run && timer !== null) { window.clearInterval(timer); timer = null; }
        };
        const stage = scene.querySelector(".fxc-rat-stage");
        if ("IntersectionObserver" in window && stage) {
            new IntersectionObserver((entries) => {
                entries.forEach((e) => { inView = e.isIntersecting; });
                update();
            }).observe(stage);
        } else { inView = true; update(); }
        document.addEventListener("visibilitychange", update);
    }

    /* ── Modus A: GSAP-Scrub über die ganze Sektion (kein Pinning) ───── */
    function initScrub(scene) {
        const gsap = window.gsap;
        gsap.registerPlugin(window.ScrollTrigger);

        // Nur die sichtbare SVG-Variante inszenieren; die versteckte behält
        // ihren gezeichneten Default (robust bei Resize über den Breakpoint).
        const vis = (sel) => Array.prototype.filter.call(scene.querySelectorAll(sel), isVisible);
        const strands = vis(".fxc-strand").sort(
            (a, b) => (+a.getAttribute("data-i") || 0) - (+b.getAttribute("data-i") || 0)
        );
        const conns = Array.prototype.slice.call(scene.querySelectorAll(".fxc-conn"));
        const caps = Array.prototype.slice.call(scene.querySelectorAll(".fxc-cap"));

        const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: scene, start: "top 74%", end: "bottom 92%", scrub: 0.7 },
        });
        const drawConn = (i, at, dur) => {
            if (conns[i]) tl.fromTo(conns[i], { scaleY: 0 }, { scaleY: 1, duration: dur || 0.35 }, at);
        };
        const dash = (targets, at, dur, stagger) => {
            if (targets.length) {
                tl.fromTo(targets, { strokeDashoffset: 1 },
                    { strokeDashoffset: 0, duration: dur, stagger: stagger || 0 }, at);
            }
        };
        const fade = (targets, at, dur, y) => {
            if (targets.length) {
                tl.fromTo(targets, { opacity: 0, y: y || 0 },
                    { opacity: 1, y: 0, duration: dur, ease: "power1.out" }, at);
            }
        };

        // Akt-Bogen: Kopf → Fächer → Ratsche → Abzweigung (Einheiten ≈ Beats)
        const kickers = Array.prototype.slice.call(scene.querySelectorAll(".fxc-kicker"));
        drawConn(0, 0, 0.45);                    // Einstieg (Kopfzeile)
        fade(kickers.slice(0, 1), 0.4, 0.3);     // Stations-Tag „Produzieren"
        drawConn(1, 0.55, 0.35);                 // … zur Station 1
        dash(strands, 0.8, 1.1, 0.018);          // der Fächer: 100 Stränge
        dash(vis(".fxc-bracket"), 3.45, 0.4);    // Klammern auf den 2er-Gruppen
        dash(vis(".fxc-leader"), 3.6, 0.4);
        fade(vis(".fxc-tags .fxc-tag"), 3.7, 0.4, 8);
        fade(caps.slice(0, 1), 3.78, 0.5);
        drawConn(2, 4.1, 0.3);                   // Fächer läuft wieder zusammen
        fade(kickers.slice(1, 2), 4.32, 0.3);    // „Wegwerfen"
        drawConn(3, 4.5, 0.3);
        dash(vis(".fxc-rat-stage .fxc-seg"), 4.72, 0.25, 0.12);
        dash(vis(".fxc-frame"), 4.9, 0.55);      // das Instrumenten-Fenster
        fade(vis(".fxc-steps"), 5.28, 0.4);      // die Treppe (tickt in Echtzeit)
        fade(vis(".fxc-rat-stage .fxc-live"), 5.4, 0.4);
        fade(vis(".fxc-pen"), 5.58, 0.25);
        fade(caps.slice(1, 2), 5.65, 0.5);
        drawConn(4, 5.9, 0.3);                   // … zur Abzweigung
        fade(kickers.slice(2, 3), 6.1, 0.3);     // „Zurück"
        dash(vis(".fxc-s3-stage .fxc-seg"), 6.3, 0.2);
        fade(vis(".fxc-node"), 6.45, 0.2);
        dash(vis(".fxc-ribbon"), 6.5, 1.2);      // 99 giessen sich nach unten
        fade(vis(".fxc-tag99"), 7.45, 0.4, 8);
        dash(vis(".fxc-arcline"), 7.05, 2.05);   // EIN Strang biegt zurück
        fade(vis(".fxc-tip"), 9.15, 0.3);        // die glühende Spitze
    }

    /* ── Modus B: IntersectionObserver + CSS-Transitions ─────────────── */
    function initIo(scene) {
        if (!("IntersectionObserver" in window)) return; // statisch lassen
        // Stagger-Verzögerung pro Strang (Waist-Reihenfolge via data-i).
        scene.querySelectorAll(".fxc-strand").forEach((p) => {
            p.style.setProperty("--d", (200 + (+p.getAttribute("data-i") || 0) * 14) + "ms");
        });
        document.documentElement.classList.add("fxc-go");
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
            });
        }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
        scene.querySelectorAll(".fxc-st").forEach((el) => io.observe(el));
    }

    function init() {
        if (started) return;
        started = true;
        const host = document.getElementById("facts-c");
        if (!host || host.hidden) return; // anderer Slot aktiv → no-op
        const scene = document.getElementById("fxc-scene");
        if (!scene) return;

        const reduce = window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) return; // Ruhezustand: Szene ist per CSS fertig gezeichnet.

        initRatchet(scene);

        const fx = document.documentElement.classList.contains("fx");
        if (fx && window.gsap && window.ScrollTrigger) initScrub(scene);
        else initIo(scene);
    }

    // defer-Skript: readyState ist hier bereits "interactive", GSAP (CDN)
    // lädt aber erst nach uns → IMMER auf DOMContentLoaded warten (dann sind
    // alle defer-Skripte inkl. gsap/landing gelaufen); started schützt doppelt.
    document.addEventListener("DOMContentLoaded", init);
})();
