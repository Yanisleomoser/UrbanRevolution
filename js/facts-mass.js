/**
 * Urban Revolution — #facts „Die Masse" (Controller)
 *
 * Prozente lügen über Masse. Drei bühnenhohe Beats zeigen die physische
 * Masse hinter den drei Zahlen — eine gemeinsame Partikelsprache: fein,
 * kühl, langsam, unerbittlich (Asche, nicht Konfetti).
 *   1 · PRODUZIEREN — eine nie endende Fahne feiner Partikel steigt von
 *       einer schmalen Quelllinie auf (≈ 1,2 Mrd. t CO₂/Jahr, EMF 2017);
 *       dazu ein Live-Zähler ≈ +38 t/s (immer mit „≈" ausgewiesen).
 *   2 · WEGWERFEN — jede echte Sekunde fällt eine Ladung Partikel und
 *       setzt sich auf eine wachsende Halde (deterministisch, kein
 *       Physik-Zirkus; Wachstum flacht asymptotisch ab).
 *   3 · ZURÜCK — alle ~4,6 s starten 100 Tracer von der Halde; 99 fallen
 *       matt zurück, genau EINER steigt weiter, hellt zu Aqua auf und
 *       verlässt die Bühne oben. Leise, fast traurig.
 *
 * Progressive Enhancement (tragend): CSS-Default = fertiger Ruhezustand
 * (Vignetten, statische Silhouetten, alle Texte). Bewegung ist Opt-in:
 * erst dieser Controller setzt html.fxb-go (Entrance-Choreografie) und
 * .is-live pro Beat (Canvas übernimmt die Statik). prefers-reduced-motion
 * → keine Bewegung; nur der sekündliche CO₂-Text-Ticker läuft (gleiche
 * Konvention wie ambient-ticker.js). rAF pausiert offscreen
 * (IntersectionObserver) und bei verstecktem Tab. DPR ≤ 2.
 *
 * Classic IIFE side-effect module (kein Global), wie ambient-ticker.js.
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFactsMass) return;
    window.__urFactsMass = true;

    const doc = document;

    // ≈ 38 t CO₂ pro Sekunde: 1,2e9 t/Jahr (EMF 2017) ÷ 31,536e6 s/Jahr —
    // bewusst gerundet, im UI immer mit „≈" markiert.
    const CO2_T_PER_S = 38;
    const DPR_MAX = 2;
    const WINNER = 63;      // der EINE von 100 Tracern — deterministisch
    const BURST_EVERY = 4.6; // s zwischen den Rückkehr-Versuchen

    // Design-Tokens als rgb-Basen (Canvas kann keine CSS-Variablen lesen):
    // --text #EEF4F8 · --accent-3 #64D6C4 · --accent #2A9D8F · --bg-card #14283B
    const C_WHITE = "238,244,248";
    const C_AQUA = "100,214,196";
    const C_TEAL = "42,157,143";
    const C_MOUND = "20,40,59";
    const C_DEEP = "15,30,46";

    // Schweizer Tausender-Gruppierung (wie ambient-ticker.js)
    const swiss = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    const clamp01 = (v) => (v < 0 ? 0 : (v > 1 ? 1 : v));

    // Deterministischer PRNG (mulberry32) — dieselbe Bühne bei jedem Besuch.
    function prng(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* ── Beat 1 · PRODUZIEREN — die CO₂-Fahne ───────────────── */
    function makePlume(b) {
        const rnd = prng(11);
        const n = b.mobile ? 230 : 620;
        const ps = [];
        const spawn = (pre) => ({
            x0: 0.5 + (rnd() - 0.5) * 0.16,          // Quellband, Anteil der Breite
            p: pre ? rnd() : 0,                       // Steig-Fortschritt 0..1
            v: (26 + rnd() * 36) / (b.h * 1.05),      // Fortschritt pro Sekunde
            amp: 6 + rnd() * (b.mobile ? 12 : 22),    // Drift-Amplitude (px)
            ph: rnd() * Math.PI * 2,
            fr: (0.16 + rnd() * 0.42) * Math.PI * 2,  // Drift-Frequenz (rad/s)
            s: 0.7 + rnd() * 1.6,
            a: 0.07 + rnd() * 0.19,
            c: rnd() < 0.62 ? C_WHITE : (rnd() < 0.6 ? C_AQUA : C_TEAL),
        });
        // Vorwärmen: die Fahne steht schon, wenn der Beat einblendet —
        // der Punkt ist Unerbittlichkeit, nicht Aufbau-Spektakel.
        for (let i = 0; i < n; i++) ps.push(spawn(true));

        b.step = (dt) => {
            for (let i = 0; i < ps.length; i++) {
                const p = ps[i];
                p.p += p.v * dt; // v ist bereits auf die Steighöhe normiert
                if (p.p >= 1) ps[i] = spawn(false);
            }
        };
        b.draw = (t) => {
            const ctx = b.ctx;
            ctx.clearRect(0, 0, b.w, b.h);
            // Additiv: feine Partikel akkumulieren zu Dunst statt zu Rauschen
            ctx.globalCompositeOperation = "lighter";
            // Quell-Glimmen: weicher Lichtpool am Boden, ruhig atmend
            ctx.globalAlpha = 0.66 + Math.sin(t * 0.8) * 0.2;
            ctx.fillStyle = b.glow;
            ctx.fillRect(0, b.h - b.glowR, b.w, b.glowR);
            ctx.globalAlpha = 1;
            for (let i = 0; i < ps.length; i++) {
                const p = ps[i];
                const y = b.h - p.p * b.h * 1.05;
                const x = p.x0 * b.w + Math.sin(p.ph + t * p.fr) * p.amp * (0.2 + p.p * 1.4);
                const env = clamp01(p.p / 0.06) * (1 - clamp01((p.p - 0.55) / 0.45));
                if (env <= 0.01) continue;
                ctx.fillStyle = "rgba(" + p.c + "," + (p.a * env).toFixed(3) + ")";
                const s = p.s * (1.35 - p.p * 0.7); // unten körnig, oben fein
                ctx.fillRect(x, y, s, s);
            }
            ctx.globalCompositeOperation = "source-over";
            // Quelllinie: schmal, definiert — der Ursprung der Fahne
            ctx.fillStyle = "rgba(" + C_AQUA + ",0.33)";
            ctx.fillRect(b.w * 0.39, b.h - 1.5, b.w * 0.22, 1.5);
        };
        b.onSize = () => {
            // Radialer Lichtpool (weiche Ränder statt Gradient-Box)
            b.glowR = Math.min(b.h * 0.4, 300);
            const g = b.ctx.createRadialGradient(b.w / 2, b.h, 0, b.w / 2, b.h, b.w * 0.3);
            g.addColorStop(0, "rgba(" + C_AQUA + ",0.12)");
            g.addColorStop(0.55, "rgba(" + C_AQUA + ",0.045)");
            g.addColorStop(1, "rgba(" + C_AQUA + ",0)");
            b.glow = g;
        };
        b.onSize();
    }

    /* ── Halden-Geometrie (Beat 2 + 3 teilen sich die Sprache) ── */
    const COLS = 96;
    function baseProfile(center, spread) {
        const hm = new Array(COLS);
        for (let i = 0; i < COLS; i++) {
            const u = i / (COLS - 1);
            hm[i] = center + spread * Math.exp(-Math.pow((u - 0.5) / 0.18, 2));
        }
        return hm;
    }
    function surfaceY(b, hm, x) {
        const u = clamp01(x / b.w) * (COLS - 1);
        const i = Math.floor(u);
        const f = u - i;
        const hNorm = hm[i] + (hm[Math.min(COLS - 1, i + 1)] - hm[i]) * f;
        return b.h - hNorm * b.h;
    }
    function crestPath(b, hm) {
        const ctx = b.ctx;
        const step = b.w / (COLS - 1);
        ctx.moveTo(-2, b.h - hm[0] * b.h);
        for (let i = 0; i < COLS - 1; i++) {
            // Quadratisch durch die Mittelpunkte → weiche Silhouette
            const x0 = i * step, x1 = (i + 1) * step;
            const y0 = b.h - hm[i] * b.h, y1 = b.h - hm[i + 1] * b.h;
            ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        }
        ctx.lineTo(b.w + 2, b.h - hm[COLS - 1] * b.h);
    }
    function drawMound(b, hm, rim, fill) {
        const ctx = b.ctx;
        ctx.beginPath();
        crestPath(b, hm);
        ctx.lineTo(b.w + 2, b.h + 2);
        ctx.lineTo(-2, b.h + 2);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (rim) {
            // Nur der Kamm bekommt Licht — kein Rahmen an den Kanten
            ctx.beginPath();
            crestPath(b, hm);
            ctx.strokeStyle = "rgba(" + C_AQUA + ",0.14)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    // Halden-Füllung: Kamm fängt Licht (--surface), Körper versinkt im
    // Seiten-Hintergrund (--bg) — so gibt es keine Naht am Beat-Boden.
    function moundGradient(b, maxH) {
        const g = b.ctx.createLinearGradient(0, b.h * (1 - maxH) - 40, 0, b.h);
        g.addColorStop(0, "rgba(27,51,73,0.98)");   // --surface #1B3349
        g.addColorStop(0.55, "rgba(" + C_MOUND + ",0.97)");
        g.addColorStop(1, "rgba(10,22,34,1)");      // --bg #0A1622
        return g;
    }

    /* ── Beat 2 · WEGWERFEN — die wachsende Halde ───────────── */
    function makeDump(b) {
        const rnd = prng(22);
        // Normierte Halden-Höhen bleiben über Resizes erhalten (b.hm)
        const hm = b.hm || (b.hm = baseProfile(0.05, 0.06));
        const MAXH = 0.34;
        const SEQ = [0, -0.16, 0.12, -0.27, 0.2, 0.05, -0.08, 0.26, -0.21, 0.15];
        const falling = [];
        const puffs = [];
        const dust = [];
        const nDust = b.mobile ? 26 : 56;
        for (let i = 0; i < nDust; i++) {
            dust.push({ x: rnd(), y: rnd() * 0.7, vx: (rnd() - 0.5) * 4, s: 0.6 + rnd(), a: 0.03 + rnd() * 0.07, ph: rnd() * 6.28 });
        }
        let seqI = 0;
        let acc = 0.96; // die erste Ladung fällt fast sofort
        const perClump = b.mobile ? 9 : 16;
        const inc = b.mobile ? 0.0008 : 0.00045;
        b.moundFill = moundGradient(b, MAXH);

        const grow = (idx, headroomInc) => {
            const spreadTo = (j, f) => {
                if (j >= 0 && j < COLS) hm[j] = Math.min(MAXH, hm[j] + headroomInc * f);
            };
            spreadTo(idx, 1);
            spreadTo(idx - 1, 0.55); spreadTo(idx + 1, 0.55);
            spreadTo(idx - 2, 0.22); spreadTo(idx + 2, 0.22);
        };
        const clump = () => {
            const off = SEQ[seqI % SEQ.length];
            seqI++;
            const cx = b.w * (0.5 + off * 0.42);
            for (let i = 0; i < perClump; i++) {
                falling.push({
                    x: cx + (rnd() - 0.5) * 24,
                    y: -12 - rnd() * 30,
                    vx: (rnd() - 0.5) * 10,
                    vy: 40 + rnd() * 70,
                    s: 1.6 + rnd() * 1.4,
                });
            }
        };

        b.step = (dt) => {
            acc += dt;
            if (acc >= 1) { acc -= 1; clump(); }
            for (let i = falling.length - 1; i >= 0; i--) {
                const p = falling[i];
                p.vy = Math.min(560, p.vy + 620 * dt);
                p.y += p.vy * dt;
                p.x += p.vx * dt;
                if (p.y >= surfaceY(b, hm, p.x) - 1) {
                    const idx = Math.round(clamp01(p.x / b.w) * (COLS - 1));
                    grow(idx, inc * ((MAXH - hm[idx]) / MAXH));
                    // Aufprall-Hauch: drei kleine, kurzlebige Stäubchen
                    for (let k = 0; k < 3; k++) {
                        puffs.push({ x: p.x + (rnd() - 0.5) * 8, y: p.y - 2, vx: (rnd() - 0.5) * 26, vy: -(8 + rnd() * 18), life: 0.5 });
                    }
                    falling.splice(i, 1);
                }
            }
            for (let i = puffs.length - 1; i >= 0; i--) {
                const p = puffs[i];
                p.life -= dt;
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.life <= 0) puffs.splice(i, 1);
            }
            for (let i = 0; i < dust.length; i++) {
                const d = dust[i];
                d.x += d.vx * dt / b.w;
                if (d.x > 1.02) d.x = -0.02; else if (d.x < -0.02) d.x = 1.02;
            }
        };
        b.draw = (t) => {
            const ctx = b.ctx;
            ctx.clearRect(0, 0, b.w, b.h);
            for (let i = 0; i < dust.length; i++) {
                const d = dust[i];
                const a = d.a * (0.7 + Math.sin(t * 0.5 + d.ph) * 0.3);
                ctx.fillStyle = "rgba(" + C_WHITE + "," + a.toFixed(3) + ")";
                ctx.fillRect(d.x * b.w, d.y * b.h, d.s, d.s);
            }
            ctx.fillStyle = "rgba(" + C_WHITE + ",0.42)";
            for (let i = 0; i < falling.length; i++) {
                const p = falling[i];
                ctx.fillRect(p.x, p.y - p.s * 2.4, p.s * 0.8, p.s * 3); // Fallschliere
            }
            for (let i = 0; i < puffs.length; i++) {
                const p = puffs[i];
                ctx.fillStyle = "rgba(" + C_WHITE + "," + (0.3 * p.life * 2).toFixed(3) + ")";
                ctx.fillRect(p.x, p.y, 1.4, 1.4);
            }
            drawMound(b, hm, true, b.moundFill);
        };
    }

    /* ── Beat 3 · ZURÜCK — 99 fallen, einer steigt ──────────── */
    function makeReturn(b) {
        const rnd = prng(33);
        const hm = baseProfile(0.06, 0.075);
        const far = baseProfile(0.08, 0.075); // fernere Halde — Tiefenebene
        b.moundFill = moundGradient(b, 0.15);
        const tracers = [];
        const dust = [];
        const nDust = b.mobile ? 18 : 36;
        for (let i = 0; i < nDust; i++) {
            dust.push({ x: rnd(), y: rnd() * 0.8, s: 0.6 + rnd(), a: 0.03 + rnd() * 0.06, ph: rnd() * 6.28 });
        }
        let burstT = BURST_EVERY - 0.9; // erster Versuch kurz nach dem Eintritt

        const burst = () => {
            for (let i = 0; i < 100; i++) {
                const win = i === WINNER;
                const x = win
                    ? b.w * (0.5 + (rnd() - 0.5) * 0.04)
                    : b.w * (0.5 + (rnd() - 0.5) * 0.36);
                const ang = -Math.PI / 2 + (win ? 0.02 : (rnd() - 0.5) * 0.62);
                const sp = win ? 175 : 190 + rnd() * 110;
                tracers.push({
                    x, y: surfaceY(b, hm, x) - 2,
                    px: x, py: surfaceY(b, hm, x) - 2,
                    vx: Math.cos(ang) * sp,
                    vy: Math.sin(ang) * sp,
                    win,
                });
            }
        };

        b.step = (dt) => {
            burstT += dt;
            if (burstT >= BURST_EVERY) { burstT = 0; burst(); }
            for (let i = tracers.length - 1; i >= 0; i--) {
                const tr = tracers[i];
                tr.px = tr.x; tr.py = tr.y;
                if (tr.win) {
                    tr.vy -= 60 * dt; // der Eine: zieht ruhig weiter nach oben
                } else {
                    tr.vy += 140 * dt; // die 99: Bogen, dann matt zurück
                }
                tr.x += tr.vx * dt;
                tr.y += tr.vy * dt;
                const gone = tr.win
                    ? tr.y < -24
                    : (tr.vy > 0 && tr.y >= surfaceY(b, hm, tr.x) + 4);
                if (gone) tracers.splice(i, 1);
            }
        };
        b.draw = (t) => {
            const ctx = b.ctx;
            ctx.clearRect(0, 0, b.w, b.h);
            for (let i = 0; i < dust.length; i++) {
                const d = dust[i];
                const a = d.a * (0.7 + Math.sin(t * 0.4 + d.ph) * 0.3);
                ctx.fillStyle = "rgba(" + C_WHITE + "," + a.toFixed(3) + ")";
                ctx.fillRect(d.x * b.w, d.y * b.h, d.s, d.s);
            }
            drawMound(b, far, false, "rgba(" + C_DEEP + ",0.9)");
            drawMound(b, hm, true, b.moundFill);
            ctx.lineWidth = 1;
            let winner = null;
            for (let i = 0; i < tracers.length; i++) {
                const tr = tracers[i];
                if (tr.win) { winner = tr; continue; }
                // steigend: hell-matt · fallend: dunkelt ab — das Scheitern
                const a = tr.vy < 0 ? 0.34 : Math.max(0.06, 0.18 - tr.vy * 0.0003);
                ctx.strokeStyle = "rgba(" + C_WHITE + "," + a.toFixed(3) + ")";
                ctx.beginPath();
                ctx.moveTo(tr.px, tr.py);
                ctx.lineTo(tr.x, tr.y);
                ctx.stroke();
            }
            if (winner) {
                const q = clamp01(1 - winner.y / b.h); // Aufhellen mit der Höhe
                ctx.strokeStyle = "rgba(" + C_AQUA + "," + (0.3 + q * 0.55).toFixed(3) + ")";
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(winner.px, winner.py);
                ctx.lineTo(winner.x, winner.y);
                ctx.stroke();
                const r = 9 + q * 8;
                const g = ctx.createRadialGradient(winner.x, winner.y, 0, winner.x, winner.y, r);
                g.addColorStop(0, "rgba(" + C_AQUA + "," + (0.4 + q * 0.4).toFixed(3) + ")");
                g.addColorStop(1, "rgba(" + C_AQUA + ",0)");
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(winner.x, winner.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "rgba(" + C_WHITE + "," + (0.55 + q * 0.45).toFixed(3) + ")";
                ctx.fillRect(winner.x - 1.2, winner.y - 1.2, 2.4, 2.4);
            }
        };
    }

    /* ── Bühnen-Verwaltung: Grösse, Sichtbarkeit, rAF-Loop ──── */
    const beats = [];
    let rafId = 0;
    let lastT = 0;

    function anyActive() {
        for (let i = 0; i < beats.length; i++) if (beats[i].active) return true;
        return false;
    }
    function frame(now) {
        rafId = 0;
        if (doc.hidden) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
        lastT = now;
        for (let i = 0; i < beats.length; i++) {
            const b = beats[i];
            if (b.active && b.ctx) { b.step(dt); b.draw(now / 1000); }
        }
        if (anyActive()) rafId = requestAnimationFrame(frame);
    }
    function wake() {
        if (!rafId && anyActive() && !doc.hidden) {
            lastT = performance.now();
            rafId = requestAnimationFrame(frame);
        }
    }

    function sizeBeat(b) {
        const w = b.el.clientWidth;
        const h = b.el.clientHeight;
        if (!w || !h || !b.canvas) return;
        const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
        b.w = w; b.h = h;
        b.mobile = w < 640;
        b.canvas.width = Math.round(w * dpr);
        b.canvas.height = Math.round(h * dpr);
        b.ctx = b.canvas.getContext("2d");
        if (b.ctx) b.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const MAKERS = { produce: makePlume, dump: makeDump, return: makeReturn };

    function buildBeat(b, canvasOk) {
        if (!canvasOk) return;
        sizeBeat(b);
        if (!b.ctx) return;
        const make = MAKERS[b.kind];
        if (make) make(b);
    }

    function setupBeats(host, canvasOk) {
        host.querySelectorAll("[data-fxb-beat]").forEach((el) => {
            const b = {
                el,
                kind: el.getAttribute("data-fxb-beat"),
                canvas: el.querySelector(".fxb-canvas"),
                active: false,
                entered: false,
                ctx: null,
                w: 0, h: 0, mobile: false,
                step: () => {}, draw: () => {},
            };
            buildBeat(b, canvasOk);
            beats.push(b);
        });

        if (!("IntersectionObserver" in window)) {
            // Sehr alte Engines: ohne Sichtbarkeits-Gate keine rAF-Schleife —
            // Entrance sofort fertig, die statische Ruheform bleibt stehen.
            beats.forEach((b) => { b.entered = true; b.el.classList.add("is-in"); });
            return;
        }
        // Aktivität (rAF nur, wenn ein Beat im Anschnitt sichtbar ist)
        const ioActive = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                const b = beats.find((x) => x.el === en.target);
                if (b) b.active = en.isIntersecting;
            });
            wake();
        }, { rootMargin: "80px 0px 80px 0px", threshold: 0 });
        // Eintritt (Entrance-Choreografie + Canvas-Überblendung, einmalig)
        const ioEnter = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                const b = beats.find((x) => x.el === en.target);
                if (b && !b.entered) {
                    b.entered = true;
                    b.el.classList.add("is-in");
                    if (b.ctx) b.el.classList.add("is-live");
                }
                ioEnter.unobserve(en.target);
            });
        }, { threshold: 0.3 });
        beats.forEach((b) => { ioActive.observe(b.el); ioEnter.observe(b.el); });

        doc.addEventListener("visibilitychange", wake);
        let rt = 0;
        window.addEventListener("resize", () => {
            clearTimeout(rt);
            rt = setTimeout(() => {
                // Neu vermessen + Systeme frisch aufbauen (Halden-Höhen
                // bleiben über b.hm normiert erhalten).
                beats.forEach((b) => buildBeat(b, canvasOk));
                wake();
            }, 160);
        }, { passive: true });
    }

    /* ── CO₂-Live-Zähler (läuft auch bei reduced-motion — Text) ── */
    function startCo2(host) {
        const el = host.querySelector("[data-fxb-co2]");
        if (!el) return;
        doc.documentElement.classList.add("fxb-tick");
        const t0 = Date.now();
        const tick = () => {
            const t = Math.floor(Math.max(0, Date.now() - t0) / 1000) * CO2_T_PER_S;
            el.textContent = "≈ +" + swiss(t);
        };
        tick();
        window.setInterval(tick, 1000);
    }

    /* ── Init — defer läuft VOR GSAP-CDN; DOMContentLoaded abwarten ── */
    let started = false;
    function init() {
        if (started) return;
        started = true;
        const host = doc.getElementById("facts");
        if (!host) return;

        startCo2(host);

        let reduce = false;
        try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_e) { reduce = false; }
        if (reduce) return; // Ruhezustand ist der CSS-Default

        let canvasOk = false;
        try { canvasOk = !!doc.createElement("canvas").getContext("2d"); } catch (_e) { canvasOk = false; }

        doc.documentElement.classList.add("fxb-go");
        setupBeats(host, canvasOk);
    }

    document.addEventListener("DOMContentLoaded", init);
})();
