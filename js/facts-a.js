/**
 * Urban Revolution — #facts Variante A „Das Protokoll" (Controller)
 *
 * Editoriales Beweis-Register: drei registerbreite Zeilen, jede mit einem
 * Instrument in voller Breite. Dieses Skript inszeniert die Choreografie:
 *   01 PRODUZIEREN — 100er-Massstab; nach Lineal + Referenzbändern fegt das
 *      Modeband (≤8) ein, die Mono-Anmerkung tippt sich selbst.
 *   02 WEGWERFEN — Sekundenstreifen: jede echte Sekunde zündet ein Strich
 *      (Metronom); daneben wiegt der Live-Odometer (ambient-ticker.js) mit.
 *   03 ZURÜCK — 100 Punkte; eine Scan-Linie sucht, verlöscht die 99 und
 *      rastet auf dem EINEN glühenden Punkt ein.
 *
 * Progressive Enhancement (tragend):
 *   - Ruhezustand = CSS-Default: ohne JS/GSAP/Motion ist alles sichtbar und
 *     fertig (Bänder auf Endbreite, Anmerkung als Volltext, :empty-Fallbacks
 *     für Streifen/Punkte). Bewegung ist Opt-in via html.fxa-go — gesetzt
 *     nur, wenn der Slot sichtbar ist, Motion erlaubt und IO vorhanden.
 *   - Instrumente sind aria-hidden; die Bedeutung trägt der echte Text.
 *   - rAF-Schleifen (Scan, Tippen) pausieren offscreen/bei verstecktem Tab
 *     (dt-Kappung + Sichtbarkeits-Gate); das Metronom stoppt sein Intervall.
 *
 * Kein GSAP nötig: IO + CSS-Transitions + zwei kleine rAF-Timelines — läuft
 * identisch, ob das CDN lädt oder nicht. Classic IIFE, kein Global.
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFactsA) return;
    window.__urFactsA = true;

    // ── Timing-Karte (ab .is-in der jeweiligen Zeile, in ms) ──
    var TYPE_START = 3200;   // Zeile 01: Tipp-Anmerkung (nach Band-Sweep bei 2150+1150)
    var TYPE_CHAR = 24;      // ms pro Zeichen (Mono-Protokoll-Tempo)
    var METRO_START = 1700;  // Zeile 02: erster Strich (nach Stagger der Striche)
    var SCAN_START = 1400;   // Zeile 03: Scan-Beginn (nach Punkte-Stagger)
    var SCAN_OUT = 1550;     // Scan Phase 1: links → rechts (suchend)
    var SCAN_HOLD = 250;     // kurzes Verharren am rechten Rand
    var SCAN_BACK = 1600;    // Phase 2: zurück, ausrollend bis zum Einrasten

    var easeInOutCubic = function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
    var easeOutQuint = function (p) { return 1 - Math.pow(1 - p, 5); };

    // Geteilter Sichtbarkeits-Zustand: Sektion im Viewport UND Tab sichtbar.
    // Bei JEDEM Wechsel werden alle Beobachter benachrichtigt — Timelines
    // frieren ein bzw. tauen auf, das Metronom stoppt/startet sein Intervall.
    var vis = { host: true, watchers: [] };
    function pageActive() { return vis.host && !document.hidden; }
    function onVisChange(fn) { vis.watchers.push(fn); }
    function syncAll() { vis.watchers.forEach(function (fn) { fn(); }); }

    // rAF-Timeline: ruft step(elapsedMs) bis es true (fertig) liefert.
    // dt-Kappung: gedrosselte Frames (Tab-Wechsel) springen nicht; offscreen
    // wird der Frame ausgesetzt und über onVisChange wieder angestossen.
    function rafTimeline(step) {
        var t = 0;
        var last = 0;
        var waiting = false;
        function frame(now) {
            if (!pageActive()) { waiting = true; last = 0; return; }
            if (last) t += Math.min(64, now - last);
            last = now;
            if (!step(t)) requestAnimationFrame(frame);
        }
        onVisChange(function () {
            if (waiting && pageActive()) { waiting = false; requestAnimationFrame(frame); }
        });
        requestAnimationFrame(frame);
    }

    // ── Zeile 02 · Sekundenstreifen bauen (Dichte folgt der Breite) ──
    function buildSeconds(el) {
        if (!el) return;
        var w = el.clientWidth || 640;
        var n = Math.max(40, Math.min(96, Math.floor(w / 9)));
        if (el.childElementCount === n) return;
        el.textContent = "";
        var frag = document.createDocumentFragment();
        for (var i = 0; i < n; i++) {
            var tick = document.createElement("span");
            tick.className = "fxa-sec-tick";
            tick.style.setProperty("--fxa-d", (500 + i * 9) + "ms");
            frag.appendChild(tick);
        }
        el.appendChild(frag);
    }

    // Metronom: Strich k zündet in Sekunde k seit Start (Wanduhr-basiert —
    // Wegsehen hält die Linie nicht an). Voller Streifen → leeren, weiter.
    function makeMetronome(el) {
        var t0 = 0;
        var timer = 0;
        var lastLit = 0;
        var lastCycle = 0;
        function paint() {
            var ticks = el.children;
            var n = ticks.length;
            if (!n) return;
            var sec = Math.floor((Date.now() - t0) / 1000) + 1; // Strich 1 sofort
            var cycle = Math.floor(sec / n);
            var lit = sec % n;
            if (cycle !== lastCycle) { // Streifen voll → Protokollseite umblättern
                for (var j = 0; j < n; j++) ticks[j].classList.remove("is-lit", "no-flare");
                lastCycle = cycle;
                lastLit = 0;
            }
            for (var i = 0; i < lit && i < n; i++) {
                if (!ticks[i].classList.contains("is-lit")) {
                    ticks[i].classList.add("is-lit");
                    // Nachholer (Tab war weg / Re-Raster) zünden ohne Blitz —
                    // nur der jüngste Strich flammt auf.
                    if (i < lit - 1 || lit - lastLit > 1) ticks[i].classList.add("no-flare");
                }
            }
            lastLit = lit;
        }
        function sync() {
            var should = t0 && pageActive();
            if (should && !timer) { paint(); timer = window.setInterval(paint, 500); }
            if (!should && timer) { window.clearInterval(timer); timer = 0; }
        }
        onVisChange(sync);
        return {
            start: function () { if (!t0) { t0 = Date.now(); sync(); } },
            repaint: paint,
        };
    }

    // ── Zeile 03 · Punktfeld bauen: 100 Punkte, EINER ist der Rückkehrer ──
    function buildDots(el, isMobile) {
        if (!el) return null;
        // Der gefundene Punkt liegt ~2/3 der Breite: Desktop (1 Reihe à 100)
        // Index 65; mobil (2 Reihen à 50) Index 82 = Reihe 2, Spalte 33.
        var found = isMobile ? 82 : 65;
        el.textContent = "";
        var frag = document.createDocumentFragment();
        for (var i = 0; i < 100; i++) {
            var d = document.createElement("span");
            d.className = "fxa-dot" + (i === found ? " is-on" : "");
            d.style.setProperty("--fxa-d", (450 + i * 4) + "ms");
            frag.appendChild(d);
        }
        var line = document.createElement("span");
        line.className = "fxa-scanline";
        frag.appendChild(line);
        el.appendChild(frag);
        return { el: el, line: line, found: found, started: false };
    }

    // Scan: Phase 1 fegt suchend nach rechts (überstrichene Punkte flackern
    // auf und verlöschen), kurzes Verharren, Phase 2 rollt zurück und rastet
    // auf dem EINEN Punkt ein → Bloom + Puls (CSS übernimmt ab .is-found).
    function runScan(scan) {
        if (!scan || scan.started) return;
        scan.started = true;
        var el = scan.el;
        var line = scan.line;
        var w = el.clientWidth || 640;
        var dots = el.querySelectorAll(".fxa-dot");
        var centers = [];
        for (var i = 0; i < dots.length; i++) centers.push(dots[i].offsetLeft + dots[i].offsetWidth / 2);
        var lockX = centers[scan.found] || w * 0.655;
        var flared = 0;
        el.classList.add("is-scanning");
        rafTimeline(function (t) {
            var x;
            if (t < SCAN_OUT) {
                x = easeInOutCubic(t / SCAN_OUT) * w;
                while (flared < dots.length && centers[flared] <= x) {
                    dots[flared].classList.add("is-scan");
                    flared++;
                }
            } else if (t < SCAN_OUT + SCAN_HOLD) {
                x = w;
            } else if (t < SCAN_OUT + SCAN_HOLD + SCAN_BACK) {
                x = w + (lockX - w) * easeOutQuint((t - SCAN_OUT - SCAN_HOLD) / SCAN_BACK);
            } else { // Einrasten: der Eine leuchtet auf, die Linie verlischt
                line.style.transform = "translateX(" + lockX + "px)";
                dots[scan.found].classList.remove("is-scan");
                el.classList.remove("is-scanning");
                el.classList.add("is-found");
                return true;
            }
            line.style.transform = "translateX(" + x + "px)";
            return false;
        });
    }

    // ── Zeile 01 · Mono-Anmerkung tippt sich selbst ──
    // Ghost (echter data-i18n-Text) reserviert Layout + trägt die Bedeutung;
    // getippt wird in die dekorative Overlay-Ebene. Sprachwechsel: Ghost wird
    // von I18N.apply() aktualisiert — wir ziehen die Tipp-Ebene nach.
    function makeTyper(annot) {
        if (!annot) return null;
        var ghost = annot.querySelector(".fxa-annot-ghost");
        var typed = annot.querySelector(".fxa-annot-type");
        if (!ghost || !typed) return null;
        var state = { started: false, done: false };
        window.addEventListener("language:change", function () {
            if (state.done) typed.textContent = ghost.textContent;
        });
        return function () {
            if (state.started) return;
            state.started = true;
            typed.classList.add("is-typing");
            rafTimeline(function (t) {
                var full = ghost.textContent; // live lesen → Sprachwechsel mitten im Tippen
                var chars = Math.min(full.length, Math.floor(t / TYPE_CHAR));
                typed.textContent = full.slice(0, chars);
                if (chars < full.length) return false;
                state.done = true;
                // Cursor kurz stehen lassen, dann ruhig ausblenden
                window.setTimeout(function () { typed.classList.remove("is-typing"); }, 1400);
                return true;
            });
        };
    }

    function init() {
        var host = document.getElementById("facts-a");
        if (!host || host.hidden) return; // Labor: anderer Slot aktiv → no-op

        var mobileMq = window.matchMedia ? window.matchMedia("(max-width: 700px)") : null;
        var seconds = host.querySelector(".fxa-seconds");
        var dotsEl = host.querySelector(".fxa-dots");

        // Instrumente IMMER bauen — auch reduziert/ohne Motion zeigt der
        // Ruhezustand die fertige Form (Punktfeld mit dem Einen, Streifen).
        buildSeconds(seconds);
        var scan = buildDots(dotsEl, mobileMq ? mobileMq.matches : false);
        var metronome = seconds ? makeMetronome(seconds) : null;

        // Re-Raster nur für den breitenabhängigen Streifen (entprellt);
        // der laufende Metronom-Stand wird aus der Wanduhr neu gemalt.
        var resizeT = 0;
        window.addEventListener("resize", function () {
            window.clearTimeout(resizeT);
            resizeT = window.setTimeout(function () {
                var before = seconds ? seconds.childElementCount : 0;
                buildSeconds(seconds);
                if (metronome && seconds && seconds.childElementCount !== before) metronome.repaint();
            }, 180);
        }, { passive: true });

        var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || !("IntersectionObserver" in window)) {
            // Ruhezustand steht komplett (CSS-Default) — statisch = fertig.
            // Der gefundene Punkt trägt .is-on und glüht ohne .is-found-Gate.
            return;
        }

        // Ab hier: Bewegung ist zugesagt → Startzustände scharf schalten.
        document.documentElement.classList.add("fxa-go");

        // Sichtbarkeits-Gate für alle Lauf-Schleifen (Sektion + Tab).
        var hostIo = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { vis.host = e.isIntersecting; });
            syncAll();
        }, { threshold: 0 });
        hostIo.observe(host);
        document.addEventListener("visibilitychange", syncAll);

        var startTyping = makeTyper(host.querySelector(".fxa-annot"));

        // Zeilen-Einsätze: jede Zeile zündet beim eigenen Viewport-Eintritt;
        // die innere Kaskade fährt CSS (Delays), die Lauf-Schichten fahren
        // hier per Timeout auf der Timing-Karte oben.
        function enterRow(row) {
            row.classList.add("is-in");
            var kind = row.getAttribute("data-fxa-row");
            if (kind === "produce" && startTyping) window.setTimeout(startTyping, TYPE_START);
            if (kind === "discard" && metronome) window.setTimeout(metronome.start, METRO_START);
            if (kind === "return" && scan) window.setTimeout(function () { runScan(scan); }, SCAN_START);
        }
        var io = new IntersectionObserver(function (entries) {
            // Treten mehrere Zeilen im selben Schwung ein (hoher Viewport /
            // Deep-Link mitten in die Sektion), setzen sie gestaffelt ein —
            // das Register schreibt sich Zeile für Zeile, nie alles auf einmal.
            var rows = [];
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                io.unobserve(e.target);
                if (e.target.classList.contains("fxa-row")) rows.push(e.target);
                else e.target.classList.add("is-in");
            });
            rows.forEach(function (row, i) {
                if (i === 0) enterRow(row);
                else window.setTimeout(function () { enterRow(row); }, i * 500);
            });
        }, { rootMargin: "0px 0px -10% 0px", threshold: 0.18 });
        var beats = host.querySelectorAll(".fxa-head, .fxa-row, .fxa-tail");
        beats.forEach(function (el) { io.observe(el); });
    }

    // Defer-Falle: beim Auswerten ist readyState bereits "interactive", GSAP
    // (spätere defer-Skripte) aber noch nicht da → IMMER auf DOMContentLoaded
    // registrieren; complete-Fall (dynamische Einbindung) als Sicherheitsnetz.
    var booted = false;
    function boot() { if (booted) return; booted = true; init(); }
    document.addEventListener("DOMContentLoaded", boot);
    if (document.readyState === "complete") boot();
})();
