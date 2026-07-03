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
    const TYPE_START = 3200;   // Zeile 01: Tipp-Anmerkung (nach Band-Sweep bei 2150+1150)
    const TYPE_CHAR = 24;      // ms pro Zeichen (Mono-Protokoll-Tempo)
    const METRO_START = 1700;  // Zeile 02: erster Strich (nach Stagger der Striche)
    const SCAN_START = 1400;   // Zeile 03: Scan-Beginn (nach Punkte-Stagger)
    const SCAN_OUT = 1550;     // Scan Phase 1: links → rechts (suchend)
    const SCAN_HOLD = 250;     // kurzes Verharren am rechten Rand
    const SCAN_BACK = 1600;    // Phase 2: zurück, ausrollend bis zum Einrasten

    const easeInOutCubic = function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
    const easeOutQuint = function (p) { return 1 - Math.pow(1 - p, 5); };

    // Geteilter Sichtbarkeits-Zustand: Sektion im Viewport UND Tab sichtbar.
    // Bei JEDEM Wechsel werden alle Beobachter benachrichtigt — Timelines
    // frieren ein bzw. tauen auf, das Metronom stoppt/startet sein Intervall.
    const vis = { host: true, watchers: [] };
    function pageActive() { return vis.host && !document.hidden; }
    function onVisChange(fn) { vis.watchers.push(fn); }
    function syncAll() { vis.watchers.forEach(function (fn) { fn(); }); }

    // rAF-Timeline: ruft step(elapsedMs) bis es true (fertig) liefert.
    // dt-Kappung: gedrosselte Frames (Tab-Wechsel) springen nicht; offscreen
    // wird der Frame ausgesetzt und über onVisChange wieder angestossen.
    function rafTimeline(step) {
        let t = 0;
        let last = 0;
        let waiting = false;
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
        const w = el.clientWidth || 640;
        const n = Math.max(40, Math.min(96, Math.floor(w / 9)));
        if (el.childElementCount === n) return;
        el.textContent = "";
        const frag = document.createDocumentFragment();
        for (let i = 0; i < n; i++) {
            const tick = document.createElement("span");
            tick.className = "fxa-sec-tick";
            tick.style.setProperty("--fxa-d", (500 + i * 9) + "ms");
            frag.appendChild(tick);
        }
        el.appendChild(frag);
    }

    // Metronom: Strich k zündet in Sekunde k seit Start (Wanduhr-basiert —
    // Wegsehen hält die Linie nicht an). Voller Streifen → leeren, weiter.
    function makeMetronome(el) {
        let t0 = 0;
        let timer = 0;
        let lastLit = 0;
        let lastCycle = 0;
        function paint() {
            const ticks = el.children;
            const n = ticks.length;
            if (!n) return;
            const sec = Math.floor((Date.now() - t0) / 1000) + 1; // Strich 1 sofort
            const cycle = Math.floor(sec / n);
            const lit = sec % n;
            if (cycle !== lastCycle) { // Streifen voll → Protokollseite umblättern
                for (let j = 0; j < n; j++) ticks[j].classList.remove("is-lit", "no-flare");
                lastCycle = cycle;
                lastLit = 0;
            }
            for (let i = 0; i < lit && i < n; i++) {
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
            const should = t0 && pageActive();
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
        const found = isMobile ? 82 : 65;
        el.textContent = "";
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 100; i++) {
            const d = document.createElement("span");
            d.className = "fxa-dot" + (i === found ? " is-on" : "");
            d.style.setProperty("--fxa-d", (450 + i * 4) + "ms");
            frag.appendChild(d);
        }
        const line = document.createElement("span");
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
        const el = scan.el;
        const line = scan.line;
        const w = el.clientWidth || 640;
        const dots = el.querySelectorAll(".fxa-dot");
        const centers = [];
        for (let i = 0; i < dots.length; i++) centers.push(dots[i].offsetLeft + dots[i].offsetWidth / 2);
        const lockX = centers[scan.found] || w * 0.655;
        let flared = 0;
        el.classList.add("is-scanning");
        rafTimeline(function (t) {
            let x;
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
        const ghost = annot.querySelector(".fxa-annot-ghost");
        const typed = annot.querySelector(".fxa-annot-type");
        if (!ghost || !typed) return null;
        const state = { started: false, done: false };
        window.addEventListener("language:change", function () {
            if (state.done) typed.textContent = ghost.textContent;
        });
        return function () {
            if (state.started) return;
            state.started = true;
            typed.classList.add("is-typing");
            rafTimeline(function (t) {
                const full = ghost.textContent; // live lesen → Sprachwechsel mitten im Tippen
                const chars = Math.min(full.length, Math.floor(t / TYPE_CHAR));
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
        const host = document.getElementById("facts-a");
        if (!host || host.hidden) return; // Labor: anderer Slot aktiv → no-op

        const mobileMq = window.matchMedia ? window.matchMedia("(max-width: 700px)") : null;
        const seconds = host.querySelector(".fxa-seconds");
        const dotsEl = host.querySelector(".fxa-dots");

        // Instrumente IMMER bauen — auch reduziert/ohne Motion zeigt der
        // Ruhezustand die fertige Form (Punktfeld mit dem Einen, Streifen).
        buildSeconds(seconds);
        const scan = buildDots(dotsEl, mobileMq ? mobileMq.matches : false);
        const metronome = seconds ? makeMetronome(seconds) : null;

        // Re-Raster nur für den breitenabhängigen Streifen (entprellt);
        // der laufende Metronom-Stand wird aus der Wanduhr neu gemalt.
        let resizeT = 0;
        window.addEventListener("resize", function () {
            window.clearTimeout(resizeT);
            resizeT = window.setTimeout(function () {
                const before = seconds ? seconds.childElementCount : 0;
                buildSeconds(seconds);
                if (metronome && seconds && seconds.childElementCount !== before) metronome.repaint();
            }, 180);
        }, { passive: true });

        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || !("IntersectionObserver" in window)) {
            // Ruhezustand steht komplett (CSS-Default) — statisch = fertig.
            // Der gefundene Punkt trägt .is-on und glüht ohne .is-found-Gate.
            return;
        }

        // Ab hier: Bewegung ist zugesagt → Startzustände scharf schalten.
        document.documentElement.classList.add("fxa-go");

        // Sichtbarkeits-Gate für alle Lauf-Schleifen (Sektion + Tab).
        const hostIo = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { vis.host = e.isIntersecting; });
            syncAll();
        }, { threshold: 0 });
        hostIo.observe(host);
        document.addEventListener("visibilitychange", syncAll);

        const startTyping = makeTyper(host.querySelector(".fxa-annot"));

        // Zeilen-Einsätze: jede Zeile zündet beim eigenen Viewport-Eintritt;
        // die innere Kaskade fährt CSS (Delays), die Lauf-Schichten fahren
        // hier per Timeout auf der Timing-Karte oben.
        function enterRow(row) {
            row.classList.add("is-in");
            const kind = row.getAttribute("data-fxa-row");
            if (kind === "produce" && startTyping) window.setTimeout(startTyping, TYPE_START);
            if (kind === "discard" && metronome) window.setTimeout(metronome.start, METRO_START);
            if (kind === "return" && scan) window.setTimeout(function () { runScan(scan); }, SCAN_START);
        }
        const io = new IntersectionObserver(function (entries) {
            // Treten mehrere Zeilen im selben Schwung ein (hoher Viewport /
            // Deep-Link mitten in die Sektion), setzen sie gestaffelt ein —
            // das Register schreibt sich Zeile für Zeile, nie alles auf einmal.
            const rows = [];
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
        const beats = host.querySelectorAll(".fxa-head, .fxa-row, .fxa-tail");
        beats.forEach(function (el) { io.observe(el); });
    }

    // Defer-Falle: beim Auswerten ist readyState bereits "interactive", GSAP
    // (spätere defer-Skripte) aber noch nicht da → IMMER auf DOMContentLoaded
    // registrieren; complete-Fall (dynamische Einbindung) als Sicherheitsnetz.
    let booted = false;
    function boot() { if (booted) return; booted = true; init(); }
    document.addEventListener("DOMContentLoaded", boot);
    if (document.readyState === "complete") boot();
})();
