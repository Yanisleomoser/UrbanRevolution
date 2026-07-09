/**
 * Urban Revolution — #facts „Die Masse" (Controller)
 *
 * Prozente lügen über Masse. Drei bühnenhohe Beats zeigen die physische
 * Masse hinter den drei Zahlen — eine gemeinsame Partikelsprache: fein,
 * langsam, unerbittlich (Asche, nicht Konfetti). Farb-Dramaturgie der
 * Slides: Beat 1 + 2 glimmen warm (Kupfer — das Chaos des Abfalls ist
 * menschlich), erst Beat 3 antwortet in Aqua.
 *   1 · PRODUZIEREN — eine nie endende Fahne feiner Partikel steigt von
 *       einer schmalen Quelllinie auf (≈ 1,2 Mrd. t CO₂/Jahr, EMF 2017);
 *       dazu ein Live-Zähler ≈ +38 t/s (immer mit „≈" ausgewiesen).
 *   2 · WEGWERFEN — jede echte Sekunde fällt EIN Kleidungsstück
 *       (Flach-Silhouette: T-Shirt/Hoodie/Hose/Kleid) und stapelt sich
 *       geschichtet auf die wachsende Halde: ein Berg aus Kleidern.
 *       Der GANZE Berg besteht sichtbar aus Kleidern: eine Offscreen-
 *       Textur (das „Gewebe") webt deterministisch viele Silhouetten in
 *       Schichten — tief = dunkler und gepresster, nahe der Oberfläche
 *       eine Spur heller; pro Frame kostet sie EIN geclipptes drawImage.
 *       Die Halde wächst, bis ihr Kamm die Oberkante des Beats — die
 *       Grenze zum CO₂-Beat darüber — berührt (~75 s), und ruht dann.
 *   3 · ZURÜCK — alle ~4,6 s starten 100 Tracer von der Halde; 99 fallen
 *       matt zurück. Der Eine ist ein ganzes KLEIDUNGSSTÜCK: die Rettung
 *       läuft als inszenierte Bergung in vier Phasen — FINDEN (Spotlight
 *       atmet auf der Halde, das Stück löst sich) → DER FADEN (eine
 *       haarfeine Aqua-Linie senkt sich von oben und dockt an) → HEBEN
 *       (gedämpftes Pendel, wachsendes Glühen, Fünkchen rieseln nach) →
 *       AUSTRITT (Nachglühen an der Oberkante). Leise, fast feierlich.
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
    // --text #EEF4F8 · --accent-3 #7EE0CF · --warm-thread #C9906F ·
    // --warm-deep #8A5F4C. Farb-Dramaturgie der Slides: Beat 1 + 2 (das
    // Chaos des Abfalls) sind KUPFER/warm; Aqua wird erst in Beat 3
    // ausgegeben — die haarfeine Linie, die den Einen birgt.
    const C_WHITE = "238,244,248";
    const C_AQUA = "126,224,207";
    const C_COPPER = "201,144,111";
    const C_COPPER_DEEP = "138,95,76";
    const C_MOUND = "45,32,27";
    const C_DEEP = "38,28,24";

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
            c: rnd() < 0.62 ? C_WHITE : (rnd() < 0.6 ? C_COPPER : C_COPPER_DEEP),
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
            // Quelllinie: schmal, definiert — der Ursprung der Fahne (Kupfer:
            // die Glut der Produktion, kein Aqua vor der Wende)
            ctx.fillStyle = "rgba(" + C_COPPER + ",0.38)";
            ctx.fillRect(b.w * 0.39, b.h - 1.5, b.w * 0.22, 1.5);
        };
        b.onSize = () => {
            // Radialer Lichtpool (weiche Ränder statt Gradient-Box)
            b.glowR = Math.min(b.h * 0.4, 300);
            const g = b.ctx.createRadialGradient(b.w / 2, b.h, 0, b.w / 2, b.h, b.w * 0.3);
            g.addColorStop(0, "rgba(" + C_COPPER + ",0.13)");
            g.addColorStop(0.55, "rgba(" + C_COPPER + ",0.05)");
            g.addColorStop(1, "rgba(" + C_COPPER + ",0)");
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
    function drawMound(b, hm, rim, fill, rimAlpha) {
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
            ctx.strokeStyle = "rgba(" + C_AQUA + "," + (rimAlpha || 0.14) + ")";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    // Halden-Füllung: Kamm fängt warmes Licht (Kupfer-Strata), Körper
    // versinkt im Seiten-Hintergrund (--bg) — keine Naht am Beat-Boden.
    function moundGradient(b, maxH) {
        const g = b.ctx.createLinearGradient(0, b.h * (1 - maxH) - 40, 0, b.h);
        g.addColorStop(0, "rgba(64,45,38,0.98)");   // warmer Kamm
        g.addColorStop(0.55, "rgba(" + C_MOUND + ",0.97)");
        g.addColorStop(1, "rgba(10,22,34,1)");      // --bg #0A1622
        return g;
    }

    /* ── Kleidungs-Silhouetten (Beat 2 + 3) ──────────────────
       „Echte Kleidung" in der Asche-Ästhetik: gefüllte Flach-Silhouetten
       (T-Shirt, Hoodie, Hose, Kleid) in einer 100×100-Box, via Path2D —
       erkennbar ab ~26 px, keine neuen Assets, kein Stilbruch. Beat 2
       lässt sie fallen und stapeln; Beat 3 hebt genau EIN Stück heraus. */
    const GARMENTS = [
        new Path2D("M32 20 L44 12 Q50 17 56 12 L68 20 L82 34 L69 43 L66 35 L66 88 L34 88 L34 35 L31 43 L18 34 Z"),
        new Path2D("M32 24 L40 13 Q50 3 60 13 L68 24 L84 40 L70 48 L66 38 L66 90 L34 90 L34 38 L30 48 L16 40 Z"),
        new Path2D("M34 12 L66 12 L70 38 L60 90 L52 90 L50 48 L48 90 L36 90 L30 38 Z"),
        new Path2D("M40 12 L60 12 L63 26 L58 34 L74 86 L26 86 L42 34 L37 26 Z"),
    ];
    /* Warme Strata (Slide-Kupferwelt): drei Kupfer-Braun-Töne + ein
       seltener Mauve-Ton — der Berg besteht aus weggeworfener Wärme. */
    const GARMENT_TONES = ["82,55,44", "66,46,38", "51,36,31", "84,61,66"];
    function drawGarment(ctx, gi, x, y, size, rot, fill, strokeA) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        const s = size / 100;
        ctx.scale(s, s);
        ctx.translate(-50, -50);
        ctx.fillStyle = fill;
        ctx.fill(GARMENTS[gi]);
        if (strokeA) {
            ctx.strokeStyle = "rgba(230,237,243," + strokeA + ")";
            ctx.lineWidth = 1.1 / s;
            ctx.stroke(GARMENTS[gi]);
        }
        ctx.restore();
    }

    /* ── Das Gewebe — das Innere der Halde besteht aus Kleidern ──
       Eine Offscreen-Textur pro Beat, deterministisch (prng) in
       horizontalen Schichtbändern gewoben: viele Silhouetten, Ton in Ton
       (Strata, kein Konfetti). Tiefe Bänder liegen flacher (weniger
       Rotation, vertikal gestaucht) und sinken tonal Richtung --bg;
       obere Bänder bleiben eine Spur heller. Pro Frame kostet die Textur
       EIN drawImage, geclippt auf die aktuelle Halden-Silhouette — dazu
       legt ein „Press-Schleier" (Verlauf ab dem aktuellen Kamm) die
       Tiefe dynamisch nach: was die wachsende Halde freilegt, ist nahe
       der Oberfläche frisch, weiter unten begraben. Gewoben wird lazy in
       Bändern (nie pro Frame neu): grosszügig über den aktuellen Kamm
       hinaus vorgewärmt; wächst der Berg darüber hinaus, werden weitere
       Bänder nachgewoben (und bei Resize alles frisch). */
    const BG_RGB = [10, 22, 34]; // --bg #0A1622
    const TONE_RGB = GARMENT_TONES.map((s) => s.split(",").map(Number));
    function sinkTone(rgb, f) {
        // Ton Richtung Hintergrund absenken (f: 0 = Ton, 1 = --bg)
        const r = Math.round(rgb[0] + (BG_RGB[0] - rgb[0]) * f);
        const g = Math.round(rgb[1] + (BG_RGB[1] - rgb[1]) * f);
        const bl = Math.round(rgb[2] + (BG_RGB[2] - rgb[2]) * f);
        return r + "," + g + "," + bl;
    }
    function makeWeave(b, seed, dim) {
        const rnd = prng(seed);
        const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
        const off = doc.createElement("canvas");
        off.width = Math.max(1, Math.round(b.w * dpr));
        off.height = Math.max(1, Math.round(b.h * dpr));
        const octx = off.getContext("2d");
        if (!octx) return null;
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const bandH = b.mobile ? 24 : 28;
        const baseSize = b.mobile ? 38 : 42; // mobil: weniger, grössere Teile
        const weaveBand = (yc) => {
            const sink = clamp01(yc / b.h);        // 1 = Boden (alt, gepresst)
            const tilt = (rnd() - 0.5) * 0.14;     // leichte Schicht-Neigung
            const step = baseSize * 0.58;
            let x = -baseSize * 0.4 + rnd() * step;
            while (x < b.w + baseSize * 0.4) {
                const gi = (rnd() * GARMENTS.length) | 0;
                const s = baseSize * (0.78 + rnd() * 0.5);
                const y = yc + (rnd() - 0.5) * bandH * 0.8;
                // tief = ruhiger (kleinere Rotations-Varianz) + gestaucht
                const rot = tilt + (rnd() - 0.5) * (0.2 + (1 - sink) * 0.5);
                const squash = 1 - 0.32 * sink;
                // Der Mauve-Ton bleibt selten (Strata, kein Konfetti)
                const ti = rnd() < 0.85 ? (rnd() * 3) | 0 : 3;
                const mixF = clamp01(0.24 + sink * 0.3 + dim + (ti === 3 ? 0.1 : 0) + (rnd() - 0.5) * 0.16);
                octx.save();
                octx.translate(x, y);
                octx.scale(1, squash);
                // Schattenkante darunter trennt die Silhouetten tonwertig
                drawGarment(octx, gi, 0, 2.5, s, rot,
                    "rgba(" + sinkTone(TONE_RGB[2], 0.75) + ",0.5)", 0);
                drawGarment(octx, gi, 0, 0, s, rot,
                    "rgba(" + sinkTone(TONE_RGB[ti], mixF) + ",0.92)",
                    sink < 0.4 ? 0.05 : 0);
                octx.restore();
                x += step * (0.82 + rnd() * 0.5);
            }
        };
        let frontier = b.h; // bis hier (von unten) ist gewoben
        const ensure = (yTo) => {
            let guard = 0;
            while (frontier > Math.max(yTo, -bandH) && guard++ < 240) {
                frontier -= bandH;
                weaveBand(frontier + bandH * 0.5);
            }
        };
        return { canvas: off, ensure };
    }
    // Press-Schleier: dunkelt das Gewebe unterhalb des aktuellen Kamms ab —
    // die Tiefen-Graduierung wandert mit der wachsenden Oberfläche mit.
    function makeVeil(b, peak) {
        const g = b.ctx.createLinearGradient(0, b.h * (1 - peak), 0, b.h);
        g.addColorStop(0, "rgba(10,22,34,0)");
        g.addColorStop(0.45, "rgba(10,22,34,0.34)");
        g.addColorStop(1, "rgba(10,22,34,0.64)");
        return g;
    }
    // Gewebe + Schleier in die aktuelle Halden-Silhouette clippen —
    // die eine Composite-Operation pro Frame, die den Berg zu Kleidern
    // macht. yTop begrenzt sie auf das Band ab Kamm (alles darüber wäre
    // ohnehin weggeclippt — gespartes Rastern).
    function drawWeave(b, hm, weave, veil, alpha, yTop) {
        if (!weave) return;
        const ctx = b.ctx;
        const y0 = Math.max(0, yTop || 0);
        const bandH2 = b.h - y0;
        if (bandH2 <= 0) return;
        const dpr = weave.canvas.width / Math.max(1, b.w);
        ctx.save();
        ctx.beginPath();
        crestPath(b, hm);
        ctx.lineTo(b.w + 2, b.h + 2);
        ctx.lineTo(-2, b.h + 2);
        ctx.closePath();
        ctx.clip();
        ctx.globalAlpha = alpha;
        ctx.drawImage(weave.canvas,
            0, y0 * dpr, weave.canvas.width, bandH2 * dpr,
            0, y0, b.w, bandH2);
        ctx.globalAlpha = 1;
        if (veil) {
            ctx.fillStyle = veil;
            ctx.fillRect(0, y0, b.w, bandH2);
        }
        ctx.restore();
    }

    /* ── Beat 2 · WEGWERFEN — die wachsende Halde ───────────── */
    function makeDump(b) {
        const rnd = prng(22);
        // Normierte Halden-Höhen bleiben über Resizes erhalten (b.hm)
        const hm = b.hm || (b.hm = baseProfile(0.05, 0.06));
        // Der Berg wächst, bis sein Kamm die Oberkante des Beats berührt —
        // die Grenze zum CO₂-Beat (Produzieren) direkt darüber. Der Abfall
        // reicht bis an die Emissionen heran; erst kurz davor läuft das
        // Wachstum weich aus (Soft-Landing statt hartem Anschlag).
        const MAXH = 0.985;
        const RISE = 0.0125;  // Kamm-Steigung/s → Oberkante nach ~75 s Verweilzeit
        const EASE_ZONE = 0.08;
        const SEQ = [0, -0.16, 0.12, -0.27, 0.2, 0.05, -0.08, 0.26, -0.21, 0.15];
        const falling = [];
        const ash = [];
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
        // Das Gewebe: der Berg ist schon bei Ankunft aus Kleidern —
        // grosszügig über den Start-Kamm hinaus vorwärmen, damit das
        // Wachstum bereits gewobene Masse freilegt.
        const weave = makeWeave(b, 44, 0);
        let peak0 = 0;
        for (let i = 0; i < COLS; i++) if (hm[i] > peak0) peak0 = hm[i];
        if (weave) weave.ensure(b.h * (1 - peak0) - 200);
        let veil = makeVeil(b, peak0);
        let weaveTop = b.h * (1 - peak0) - 6;

        const grow = (idx, headroomInc) => {
            const spreadTo = (j, f) => {
                if (j >= 0 && j < COLS) hm[j] = Math.min(MAXH, hm[j] + headroomInc * f);
            };
            spreadTo(idx, 1);
            spreadTo(idx - 1, 0.55); spreadTo(idx + 1, 0.55);
            spreadTo(idx - 2, 0.22); spreadTo(idx + 2, 0.22);
        };
        // Jede Sekunde fällt EIN Kleidungsstück (statt abstrakter Klumpen) —
        // die Halde wird sichtbar ein Berg aus Kleidern. Dazu ein paar
        // Asche-Schlieren als Begleitstaub (die Sprache bleibt).
        const landed = [];
        const clump = () => {
            const off = SEQ[seqI % SEQ.length];
            const cx = b.w * (0.5 + off * 0.42);
            falling.push({
                gi: (seqI + ((rnd() * 2) | 0)) % GARMENTS.length,
                x: cx,
                y: -30 - rnd() * 24,
                vx: (rnd() - 0.5) * 14,
                vy: 46 + rnd() * 50,
                rot: (rnd() - 0.5) * 0.9,
                spin: (rnd() - 0.5) * 1.5,
                size: (b.mobile ? 22 : 30) + rnd() * (b.mobile ? 12 : 18),
                tone: GARMENT_TONES[(rnd() * GARMENT_TONES.length) | 0],
            });
            seqI++;
            for (let i = 0; i < 4; i++) {
                ash.push({ x: cx + (rnd() - 0.5) * 26, y: -10 - rnd() * 24, vx: (rnd() - 0.5) * 10, vy: 60 + rnd() * 60, s: 1.2 + rnd() });
            }
        };

        b.step = (dt) => {
            acc += dt;
            if (acc >= 1) {
                acc -= 1;
                clump();
                // Verlauf + Schleier folgen dem wachsenden Berg (1×/s reicht,
                // kein Flackern); das Gewebe webt lazy Bänder nach, bevor der
                // Kamm sie freilegen kann.
                const pk = Math.max.apply(null, hm);
                b.moundFill = moundGradient(b, pk);
                veil = makeVeil(b, pk);
                weaveTop = b.h * (1 - pk) - 6;
                if (weave) weave.ensure(b.h * (1 - pk) - 180);
            }
            // Unerbittliches Anwachsen der ganzen Halde: proportional zur
            // eigenen Silhouette (die Form bleibt, der Berg reckt sich),
            // zeitbasiert (aufl.-unabhängig), weich auslaufend vor der Kante.
            let peak = 0;
            for (let i = 0; i < COLS; i++) if (hm[i] > peak) peak = hm[i];
            if (peak > 0 && peak < MAXH) {
                const ease = Math.min(1, (MAXH - peak) / EASE_ZONE);
                const gain = dt * RISE * ease;
                for (let i = 0; i < COLS; i++) {
                    hm[i] = Math.min(MAXH, hm[i] + gain * (hm[i] / peak));
                }
            }
            b.atTop = peak >= MAXH - 0.02;
            for (let i = falling.length - 1; i >= 0; i--) {
                const p = falling[i];
                p.vy = Math.min(430, p.vy + 480 * dt);
                p.y += p.vy * dt;
                p.x += p.vx * dt;
                p.rot += p.spin * dt;
                if (p.y + p.size * 0.32 >= surfaceY(b, hm, p.x) - 1) {
                    const idx = Math.round(clamp01(p.x / b.w) * (COLS - 1));
                    // Ein Stück ≙ eine Ladung: Wachstum wie zuvor 16 Partikel
                    grow(idx, inc * perClump * 0.7 * ((MAXH - hm[idx]) / MAXH));
                    landed.push({ gi: p.gi, xN: clamp01(p.x / b.w), size: p.size, rot: p.rot * 0.5, tone: p.tone });
                    if (landed.length > 240) landed.shift();
                    for (let k = 0; k < 5; k++) {
                        puffs.push({ x: p.x + (rnd() - 0.5) * p.size, y: p.y + p.size * 0.2, vx: (rnd() - 0.5) * 30, vy: -(8 + rnd() * 20), life: 0.5 });
                    }
                    falling.splice(i, 1);
                }
            }
            for (let i = ash.length - 1; i >= 0; i--) {
                const p = ash[i];
                p.vy = Math.min(560, p.vy + 620 * dt);
                p.y += p.vy * dt;
                p.x += p.vx * dt;
                if (p.y >= surfaceY(b, hm, p.x) - 1) ash.splice(i, 1);
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
            for (let i = 0; i < ash.length; i++) {
                const p = ash[i];
                ctx.fillRect(p.x, p.y - p.s * 2.4, p.s * 0.8, p.s * 3); // Fallschliere
            }
            for (let i = 0; i < puffs.length; i++) {
                const p = puffs[i];
                ctx.fillStyle = "rgba(" + C_WHITE + "," + (0.3 * p.life * 2).toFixed(3) + ")";
                ctx.fillRect(p.x, p.y, 1.4, 1.4);
            }
            // Reihenfolge trägt die Erzählung: Masse-Füllung → das Gewebe
            // (der GANZE Berg aus Kleidern, geclippt + Press-Schleier) →
            // gestapelte Kleider (die frischste Schicht obenauf) → das
            // fallende Stück → zuletzt das Kamm-Licht.
            drawMound(b, hm, false, b.moundFill);
            drawWeave(b, hm, weave, veil, 0.9, weaveTop);
            const lastVisible = 26;
            for (let i = Math.max(0, landed.length - lastVisible); i < landed.length; i++) {
                const g = landed[i];
                const depth = (landed.length - 1 - i) * 3;
                const a = Math.max(0, 0.85 - depth / 60);
                if (a <= 0.04) continue;
                const gx = g.xN * b.w;
                drawGarment(ctx, g.gi, gx, surfaceY(b, hm, gx) + depth + g.size * 0.16, g.size, g.rot,
                    "rgba(" + g.tone + "," + a.toFixed(3) + ")", i >= landed.length - 3 ? 0.10 : 0);
            }
            for (let i = 0; i < falling.length; i++) {
                const p = falling[i];
                drawGarment(ctx, p.gi, p.x, p.y, p.size, p.rot, "rgba(" + p.tone + ",0.95)", 0.12);
            }
            ctx.beginPath();
            crestPath(b, hm);
            // Kamm-Licht in Kupfer — Beat 2 gehört dem Chaos, kein Aqua
            ctx.strokeStyle = "rgba(" + C_COPPER + "," + (b.atTop ? 0.30 : 0.16) + ")";
            ctx.lineWidth = 1;
            ctx.stroke();
        };
    }

    /* ── Beat 3 · ZURÜCK — 99 fallen, EINES wird geborgen ─────
       Der Ultra-Lift: die Rettung des Einen als inszenierte Bergung in
       vier Phasen innerhalb des 4,6-s-Takts (BURST_EVERY):
         1 FINDEN  (0,55 s) — ein Spotlight atmet auf einem Punkt der
           Halde, das Stück löst sich ein paar Pixel von der Oberfläche.
         2 FADEN   (0,65 s) — eine haarfeine Aqua-Linie (1 px, die
           „Der Faden"-Sprache der Seite) senkt sich weich von der
           Oberkante herab und dockt an.
         3 HEBEN   (2,5 s)  — Faden + Stück steigen: sanftes Ease-in,
           dann gleichmässig; gedämpftes Pendel (T ≈ 1,6 s, Winkel
           klingt ab), Glüh-Bloom wächst mit der Höhe, 3 Fünkchen
           rieseln nach.
         4 AUSTRITT (0,45 s) — beide verlassen die Bühne oben, ein
           Nachglühen am Austrittspunkt verklingt.
       Gesamt ≈ 4,15 s, danach kurze Stille bis zum nächsten Versuch.
       Die 99 bleiben unverändert abstrakte Fasern; der Umgebungsstaub
       dimmt während der Bergung ~20 %, damit das Auge beim Einen ist. */
    const T_FIND = 0.55, T_THREAD = 0.65, T_RISE = 2.5, T_GLOW = 0.45;
    const T_LIFT = T_FIND + T_THREAD + T_RISE + T_GLOW;
    const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    // Hub-Profil: weiches Anfahren (Anteil a), dann konstante Geschwindigkeit —
    // gehoben, nie geschossen.
    function riseS(u) {
        const a = 0.4;
        const s = u <= a ? (u * u) / (2 * a) : a / 2 + (u - a);
        return s / (1 - a / 2);
    }
    function makeReturn(b) {
        const rnd = prng(33);
        const hm = baseProfile(0.06, 0.075);
        const far = baseProfile(0.08, 0.075); // fernere Halde — Tiefenebene
        b.moundFill = moundGradient(b, 0.15);
        // Auch diese Halde ist aus Kleidern gewoben — gedämpfter, weiter
        // weg (dim), statisch: einmal bis knapp über den Kamm weben.
        const weave = makeWeave(b, 55, 0.3);
        const hmTop = Math.max.apply(null, hm);
        if (weave) weave.ensure(b.h * (1 - hmTop) - 60);
        const veil = makeVeil(b, hmTop);
        const tracers = [];
        const dust = [];
        const nDust = b.mobile ? 18 : 36;
        for (let i = 0; i < nDust; i++) {
            dust.push({ x: rnd(), y: rnd() * 0.8, s: 0.6 + rnd(), a: 0.03 + rnd() * 0.06, ph: rnd() * 6.28 });
        }
        let burstT = BURST_EVERY - 0.9; // erster Versuch kurz nach dem Eintritt

        // Zustand der Bergung (der Eine) — pro Takt neu angestossen.
        const size = b.mobile ? 24 : 32;
        const swayL = b.mobile ? 26 : 42;
        const L = { on: false, t: 0, x: 0, y0: 0, shed: 0 };
        const sparks = [];
        const SHED_AT = [0.18, 0.48, 0.76]; // Hub-Fortschritt der 3 Fünkchen

        const burst = () => {
            // Die 99 Fasern (der Eine wird separat inszeniert — WINNER
            // bleibt ausgespart, damit es ehrlich 99 sind).
            for (let i = 0; i < 100; i++) {
                if (i === WINNER) continue;
                const x = b.w * (0.5 + (rnd() - 0.5) * 0.36);
                const ang = -Math.PI / 2 + (rnd() - 0.5) * 0.62;
                const sp = 190 + rnd() * 110;
                tracers.push({
                    x, y: surfaceY(b, hm, x) - 2,
                    px: x, py: surfaceY(b, hm, x) - 2,
                    vx: Math.cos(ang) * sp,
                    vy: Math.sin(ang) * sp,
                });
            }
            L.on = true;
            L.t = 0;
            L.shed = 0;
            L.x = b.w * (0.5 + (rnd() - 0.5) * 0.16);
            L.y0 = surfaceY(b, hm, L.x);
        };

        // Pose des Einen als reine Funktion der Phasenzeit: Ort, Faden-
        // Spitze, Glüh-Anteil, Pendelwinkel.
        const liftPose = () => {
            const restY = L.y0 - size * 0.3; // im Kamm eingebettet
            if (L.t < T_FIND) {
                const u = easeIO(clamp01(L.t / T_FIND));
                return { ph: 1, u, px: L.x, py: restY - u * 7, rot: 0, glow: u * 0.3, tipY: null };
            }
            const py1 = restY - 7;
            if (L.t < T_FIND + T_THREAD) {
                const u = easeIO(clamp01((L.t - T_FIND) / T_THREAD));
                return {
                    ph: 2, u, px: L.x, py: py1, rot: 0,
                    glow: 0.3 + u * 0.3,
                    tipY: -8 + (py1 - size * 0.45 + 8) * u,
                };
            }
            if (L.t < T_FIND + T_THREAD + T_RISE) {
                const u = clamp01((L.t - T_FIND - T_THREAD) / T_RISE);
                const tt = u * T_RISE;
                // Gedämpftes Pendel: Winkel klingt ab, Periode ~1,6 s;
                // die Auslenkung blendet nach dem Andocken weich ein.
                const th = 0.23 * Math.exp(-tt / 1.3) * Math.cos((Math.PI * 2 * tt) / 1.6);
                const ramp = Math.min(1, tt / 0.5);
                const py = py1 + (-size - py1) * riseS(u);
                return {
                    ph: 3, u, px: L.x + Math.sin(th) * swayL * ramp, py,
                    rot: th * 0.85, glow: 0.6 + u * 0.4,
                    tipY: null, thread: true,
                };
            }
            const u = clamp01((L.t - T_FIND - T_THREAD - T_RISE) / T_GLOW);
            return { ph: 4, u, px: L.x, py: -size, rot: 0, glow: 0, tipY: null };
        };

        b.step = (dt) => {
            burstT += dt;
            if (burstT >= BURST_EVERY) { burstT = 0; burst(); }
            if (L.on) {
                L.t += dt;
                if (L.t >= T_LIFT) L.on = false;
                // Fünkchen: beim Heben lösen sich 3 winzige Reste und
                // rieseln hinter dem Stück nach unten.
                const uR = (L.t - T_FIND - T_THREAD) / T_RISE;
                while (L.shed < SHED_AT.length && uR >= SHED_AT[L.shed]) {
                    const p = liftPose();
                    sparks.push({
                        x: p.px + (rnd() - 0.5) * size * 0.5,
                        y: p.py + size * 0.3,
                        vx: (rnd() - 0.5) * 10,
                        vy: 22 + rnd() * 22,
                        life: 1.1,
                    });
                    L.shed++;
                }
            }
            for (let i = sparks.length - 1; i >= 0; i--) {
                const s = sparks[i];
                s.life -= dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                if (s.life <= 0) sparks.splice(i, 1);
            }
            for (let i = tracers.length - 1; i >= 0; i--) {
                const tr = tracers[i];
                tr.px = tr.x; tr.py = tr.y;
                tr.vy += 140 * dt; // die 99: Bogen, dann matt zurück
                tr.x += tr.vx * dt;
                tr.y += tr.vy * dt;
                if (tr.vy > 0 && tr.y >= surfaceY(b, hm, tr.x) + 4) tracers.splice(i, 1);
            }
        };
        b.draw = (t) => {
            const ctx = b.ctx;
            ctx.clearRect(0, 0, b.w, b.h);
            // Staub dimmt während der Bergung ~20 % — Fokus auf den Einen.
            const dustF = L.on && L.t < T_FIND + T_THREAD + T_RISE ? 0.8 : 1;
            for (let i = 0; i < dust.length; i++) {
                const d = dust[i];
                const a = d.a * dustF * (0.7 + Math.sin(t * 0.4 + d.ph) * 0.3);
                ctx.fillStyle = "rgba(" + C_WHITE + "," + a.toFixed(3) + ")";
                ctx.fillRect(d.x * b.w, d.y * b.h, d.s, d.s);
            }
            drawMound(b, far, false, "rgba(" + C_DEEP + ",0.9)");
            drawMound(b, hm, false, b.moundFill);
            drawWeave(b, hm, weave, veil, 0.62, b.h * (1 - hmTop) - 6);
            ctx.beginPath();
            crestPath(b, hm);
            ctx.strokeStyle = "rgba(" + C_AQUA + ",0.14)";
            ctx.lineWidth = 1;
            ctx.stroke();
            for (let i = 0; i < tracers.length; i++) {
                const tr = tracers[i];
                // steigend: hell-matt · fallend: dunkelt ab — das Scheitern
                const a = tr.vy < 0 ? 0.34 : Math.max(0.06, 0.18 - tr.vy * 0.0003);
                ctx.strokeStyle = "rgba(" + C_WHITE + "," + a.toFixed(3) + ")";
                ctx.beginPath();
                ctx.moveTo(tr.px, tr.py);
                ctx.lineTo(tr.x, tr.y);
                ctx.stroke();
            }
            for (let i = 0; i < sparks.length; i++) {
                const s = sparks[i];
                ctx.fillStyle = "rgba(" + C_AQUA + "," + (0.42 * clamp01(s.life)).toFixed(3) + ")";
                ctx.fillRect(s.x, s.y, 1.4, 1.4);
            }
            if (!L.on) return;
            const p = liftPose();
            const q = clamp01(1 - p.py / b.h); // Aufhellen mit der Höhe
            // Phase 1+2 · Spotlight auf dem Fundpunkt: atmet einmal auf,
            // trägt leise weiter und verklingt weich, sobald das Heben trägt.
            if (p.ph <= 2 || (p.ph === 3 && p.u < 0.22)) {
                const breathe = p.ph === 1
                    ? Math.sin(p.u * Math.PI) * 0.14 + p.u * 0.12
                    : (p.ph === 2 ? 0.12 + 0.03 * Math.sin(t * 6) : 0.13 * (1 - p.u / 0.22));
                const sr = size * 1.6;
                const sg = ctx.createRadialGradient(L.x, L.y0, 0, L.x, L.y0, sr);
                sg.addColorStop(0, "rgba(" + C_AQUA + "," + breathe.toFixed(3) + ")");
                sg.addColorStop(1, "rgba(" + C_AQUA + ",0)");
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.arc(L.x, L.y0, sr, 0, Math.PI * 2);
                ctx.fill();
            }
            // Phase 2 · Der Faden senkt sich: 1 px, nach oben verblassend.
            if (p.tipY !== null) {
                const tg = ctx.createLinearGradient(0, -8, 0, p.tipY);
                tg.addColorStop(0, "rgba(" + C_AQUA + ",0)");
                tg.addColorStop(0.55, "rgba(" + C_AQUA + ",0.3)");
                tg.addColorStop(1, "rgba(" + C_AQUA + ",0.8)");
                ctx.strokeStyle = tg;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(L.x, -8);
                ctx.lineTo(L.x, p.tipY);
                ctx.stroke();
                // Andocken: ein kurzer, kleiner Lichtpunkt an der Spitze
                if (p.u > 0.92) {
                    ctx.fillStyle = "rgba(" + C_WHITE + "," + ((p.u - 0.92) * 6).toFixed(3) + ")";
                    ctx.fillRect(L.x - 1, p.tipY - 1, 2, 2);
                }
            }
            // Phase 3 · Heben: Faden folgt dem Pendel als weiche Kurve.
            if (p.thread) {
                const topA = p.py - size * 0.45;
                const tg = ctx.createLinearGradient(0, -8, 0, topA);
                tg.addColorStop(0, "rgba(" + C_AQUA + ",0)");
                tg.addColorStop(0.5, "rgba(" + C_AQUA + "," + (0.26 + q * 0.2).toFixed(3) + ")");
                tg.addColorStop(1, "rgba(" + C_AQUA + "," + (0.6 + q * 0.3).toFixed(3) + ")");
                ctx.strokeStyle = tg;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(L.x, -8);
                ctx.quadraticCurveTo(L.x, topA * 0.45, p.px, topA);
                ctx.stroke();
            }
            // Phase 4 · Austritt: ein Nachglühen verklingt an der Oberkante.
            if (p.ph === 4) {
                const ga = (1 - p.u) * 0.4;
                const gr = 9 + p.u * 10;
                const eg = ctx.createRadialGradient(L.x, 3, 0, L.x, 3, gr);
                eg.addColorStop(0, "rgba(" + C_AQUA + "," + ga.toFixed(3) + ")");
                eg.addColorStop(1, "rgba(" + C_AQUA + ",0)");
                ctx.fillStyle = eg;
                ctx.beginPath();
                ctx.arc(L.x, 3, gr, 0, Math.PI * 2);
                ctx.fill();
                return;
            }
            // Das Stück: Ton-Unterlage (noch Halde) blendet in Aqua um,
            // der Bloom wächst mit der Höhe — gehoben, nie geschossen.
            const r = 14 + p.glow * 10 + q * 12;
            const g = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, r);
            g.addColorStop(0, "rgba(" + C_AQUA + "," + (p.glow * (0.16 + q * 0.2) + 0.05).toFixed(3) + ")");
            g.addColorStop(1, "rgba(" + C_AQUA + ",0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
            ctx.fill();
            if (p.glow < 1) {
                drawGarment(ctx, 0, p.px, p.py, size, p.rot,
                    "rgba(" + GARMENT_TONES[0] + "," + ((1 - p.glow) * 0.9).toFixed(3) + ")", 0);
            }
            drawGarment(ctx, 0, p.px, p.py, size, p.rot,
                "rgba(" + C_AQUA + "," + (p.glow * (0.5 + q * 0.4)).toFixed(3) + ")", 0);
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
