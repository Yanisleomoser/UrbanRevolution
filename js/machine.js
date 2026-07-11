/**
 * Urban Revolution — Die Maschine (Akt II: der Kreis als Bauplan)
 *
 * Treiber der Ingenieur-Simulation in #machine (SVG #mSvg): Kleidungs-Items
 * werden aufs Band gehoben, an der NIR-Brücke gelesen (Analyse-Chip), vom
 * Verteiler in drei Ströme gelenkt; die Remake-Zelle schneidet eine Silhouette
 * (Zustandsmaschine CUT → SEW → FIN → LAB → HANG → RST), das fertige Stück
 * wandert an die Ausgangs-Schiene. Vier Stations-Karten zoomen die Kamera
 * (viewBox-Interpolation, Desktop) bzw. scrollen die Zeichnung (Mobil).
 *
 * Die Linie zeigt IMMER den ganzen Prozess: ohne Studio-Datei fertigt die
 * Zelle Demo-Stücke (Typ rotiert durch alle sechs, Farbe = das Remake-Item,
 * das den Zyklus ausgelöst hat) und hängt sie reihum an die vier anonymen
 * Bügel — nur der „DEINS"-Bügel bleibt reserviert, seine Nummer gestrichelt.
 *
 * Studio-Brücke: existiert ein Entwurf (StateManager.currentDesign), schneidet
 * die Zelle stattdessen die Silhouette SEINES Kleidungstyps in SEINER Farbe,
 * mit deterministischer Datei-Nummer, und übergibt an den „DEINS"-Bügel.
 *
 * Progressive Enhancement (Konvention wie facts-mass.js/faden.js):
 * Ruhezustand = vollständiges Standbild (Markup); volle Bewegung nur mit
 * Motion-Zusage (html.fx, keine reduzierte Bewegung) — reduced-motion malt
 * EIN ehrliches, komplettes Standbild inkl. Items und Chip. rAF pausiert
 * offscreen und bei verstecktem Tab. Alle Texte laufen über I18N (DE/EN),
 * Sprachwechsel rendert Status/Tag/Chip live neu.
 *
 * Classic IIFE side-effect module (kein Global), wie faden.js.
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urMachine) return;
    window.__urMachine = true;

    const NS = "http://www.w3.org/2000/svg";

    function init() {
        const svg = document.getElementById("mSvg");
        if (!svg) return;
        const band = svg.closest(".lp-machine-band");
        const scroller = band ? band.querySelector(".lp-machine-scroll") : null;
        const items = document.getElementById("mItems");
        const beam = document.getElementById("mBeam");
        const chipG = document.getElementById("mChipG");
        const chipT = document.getElementById("mChipT");
        const head = document.getElementById("mHead");
        const cone = document.getElementById("mCone");
        const divert = document.getElementById("mDivert");
        const gar = document.getElementById("mGar");
        const garF = document.getElementById("mGarFill");
        const garD = document.getElementById("mGarDet");
        const garH = document.getElementById("mGarHalo");
        const cutHead = document.getElementById("mCutHead");
        const needle = document.getElementById("mSewNeedle");
        const labelChip = document.getElementById("mLabelChip");
        const tagT = document.getElementById("mTagT");
        const statusT = document.getElementById("mStatus");
        const hangG = document.getElementById("mHangYours");
        const hangGar = document.getElementById("mHangGar");
        const hangFill = document.getElementById("mHangGarFill");
        const hangNo = document.getElementById("mHangNo");
        const fileCap = document.getElementById("mFileCap");
        // Anonyme Bügel: Ziele der Demo-Stücke; [1] und [3] sind der gefüllte
        // Markup-Ruhezustand (Farben dort = Remake-Qualitäten Baumwolle/Leinen).
        const HANG_DEFAULTS = [null, "#7c4a45", null, "#8a8168"];
        const demoHangs = [0, 1, 2, 3].map((i) => {
            const g = document.getElementById("mHang" + i);
            return g
                ? {
                    g: g,
                    line: g.querySelector(".hang-line"),
                    fill: g.querySelector(".hang-fill"),
                    cx: 1064 + i * 28,
                    def: HANG_DEFAULTS[i],
                }
                : null;
        }).filter(Boolean);
        function resetDemoHangs() {
            demoHangs.forEach((h) => {
                h.g.setAttribute("transform", "");
                if (h.def) h.fill.setAttribute("fill", h.def);
                h.fill.style.opacity = h.def ? "1" : "0";
                h.line.style.opacity = h.def ? "1" : "0";
            });
        }
        const bales = [
            document.getElementById("mBale0"),
            document.getElementById("mBale1"),
            document.getElementById("mBale2"),
        ];
        if (!items || !gar || !statusT || !tagT) return;

        let reduce = false;
        try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_e) { reduce = false; }
        // Volle Bewegung nur mit Motion-Zusage (html.fx wird im <head> gesetzt,
        // wenn keine reduzierte Bewegung gewünscht ist) — Konvention der Seite.
        const RM = reduce || !document.documentElement.classList.contains("fx");

        function tr(key, vars) {
            try {
                if (window.I18N && window.I18N.t) return window.I18N.t(key, vars);
            } catch (_e) { /* Fallback unten */ }
            return key;
        }

        /* Eine Silhouette je Kleidungstyp, im lokalen Raum von #mGar —
           der Cutter fährt DEINEN Typ nach (Schlüssel = CONFIG.GARMENT_TYPES). */
        const MPATHS = {
            tshirt: "M958,214 L982,200 Q1005,193 1028,200 L1052,214 L1043,232 L1033,226 L1033,290 Q1005,299 977,290 L977,226 L967,232 Z",
            hoodie: "M958,214 L982,200 Q986,189 1005,188 Q1024,189 1028,200 L1052,214 L1043,232 L1033,226 L1033,290 Q1005,299 977,290 L977,226 L967,232 Z",
            shirt: "M958,215 L984,201 L1001,205 L1005,198 L1009,205 L1026,201 L1052,215 L1043,232 L1033,226 L1033,290 Q1005,298 977,290 L977,226 L967,232 Z",
            jacket: "M956,212 L982,198 Q1005,192 1028,198 L1054,212 L1045,231 L1035,225 L1035,292 L975,292 L975,225 L965,231 Z",
            dress: "M975,201 L989,194 Q1005,190 1021,194 L1035,201 L1030,215 L1023,211 L1040,295 Q1005,304 970,295 L987,211 L980,215 Z",
            pants: "M974,196 L1036,196 L1039,215 L1031,214 L1027,296 L1010,296 L1006,232 L1004,232 L1000,296 L983,296 L979,214 L971,215 Z",
        };
        const LANE_Y = [212, 302, 392];
        const BELT_Y = 288;
        const SCAN_X = 375;
        const DIV_X = 520;
        const FADE_X = 744;
        // Items auf dem Band: gedeckte Kleidungs-Silhouetten; chipKey = die
        // Analyse-Zeile der NIR-Brücke (i18n, live beim Scan aufgelöst).
        const TYPES = [
            { p: "M-15,-9 L-6,-14 L6,-14 L15,-9 L10,-2 L6,-5 L6,13 L-6,13 L-6,-5 L-10,-2 Z", c: "#7c4a45", lane: 0, chipKey: "machine.chip1" },
            { p: "M-9,-13 L9,-13 L9,-3 L5,13 L1.5,13 L0,-1 L-1.5,13 L-5,13 L-9,-3 Z", c: "#3e5a78", lane: 1, chipKey: "machine.chip2" },
            { p: "M-13,-9 L-5,-13 L0,-9 L5,-13 L13,-9 L9,-2 L5,-4 L5,13 L-5,13 L-5,-4 L-9,-2 Z", c: "#8a8168", lane: 0, chipKey: "machine.chip3" },
            { p: "M-16,-8 L-6,-13 L6,-13 L16,-8 L11,0 L7,-3 L7,12 L-7,12 L-7,-3 L-11,0 Z", c: "#6e6a63", lane: 2, chipKey: "machine.chip4" },
            { p: "M-15,-9 L-6,-14 L6,-14 L15,-9 L10,-2 L6,-5 L6,13 L-6,13 L-6,-5 L-10,-2 Z", c: "#476457", lane: 2, chipKey: "machine.chip5" },
        ];
        const T_LIFT = 0.9, T_BELT = 2.0, T_SCAN = 1.4, T_ROUTE = 0.6, T_LANE = 1.8, T_FADE = 0.54;
        const SPAWN = 2.4;

        const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
        const easeOut = (t) => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - c, 3); };

        /* ── Status (i18n-fähig: Schlüssel + Variablen, Sprachwechsel-sicher) ── */
        let lastStatusKey = "";
        let lastStatusVars = null;
        function setStatus(key, vars) {
            lastStatusKey = key;
            lastStatusVars = vars || null;
            statusT.textContent = tr(key, lastStatusVars);
        }

        /* ── Die Datei aus dem Studio: nur an Zyklus-Grenzen übernommen ── */
        let fileApplied = null;
        let filePending = null;
        let hasPending = false;
        let L = 400;
        let PTS = null;
        function measurePath() {
            try { L = gar.getTotalLength(); } catch (_e) { L = 400; }
            PTS = null;
            try {
                const N = 160;
                const a = [];
                for (let i = 0; i <= N; i++) {
                    const pt = gar.getPointAtLength((L * i) / N);
                    a.push(pt.x, pt.y);
                }
                PTS = a;
            } catch (_e) { /* headAt wird übersprungen */ }
            gar.style.strokeDasharray = L;
        }
        function headAt(prog) {
            if (!PTS) return;
            const n = PTS.length / 2 - 1;
            const f = Math.max(0, Math.min(1, prog)) * n;
            let i = Math.floor(f);
            let r = f - i;
            if (i >= n) { i = n - 1; r = 1; }
            const x = PTS[i * 2] + (PTS[(i + 1) * 2] - PTS[i * 2]) * r;
            const y = PTS[i * 2 + 1] + (PTS[(i + 1) * 2 + 1] - PTS[i * 2 + 1]) * r;
            cutHead.setAttribute("transform", "translate(" + (x - 958).toFixed(1) + " " + (y - 214).toFixed(1) + ") translate(958 214)");
        }
        // Das Stück, das die Zelle gerade fährt: die Besucher-Datei ODER ein
        // Demo-Stück des laufenden Betriebs (Typ rotiert, Farbe vom Remake-Item).
        let cellPiece = { type: "tshirt", hex: "#1c2c3b" };
        const DEMO_TYPES = ["tshirt", "hoodie", "shirt", "jacket", "dress", "pants"];
        let demoTypeIdx = 0;
        let demoHangIdx = 0;
        function setCellPiece(type, hex) {
            cellPiece = { type: type, hex: hex };
            const d = MPATHS[type] || MPATHS.tshirt;
            gar.setAttribute("d", d);
            garF.setAttribute("d", d);
            garH.setAttribute("d", d);
            garF.setAttribute("fill", hex);
            measurePath();
        }
        // Kragen-/Ärmel-Details passen nur auf Oberteile
        function garDOK() { return cellPiece.type !== "dress" && cellPiece.type !== "pants"; }
        function applyFileNow(f) {
            fileApplied = f;
            setCellPiece(f ? f.type : "tshirt", f ? f.hex : "#1c2c3b");
            tagT.textContent = f ? tr("machine.tag_no", { no: f.no }) : tr("machine.tag_empty");
            if (hangNo) {
                hangNo.textContent = f ? tr("machine.no", { no: f.no }) : tr("machine.no_none");
                hangNo.setAttribute("fill", f ? "#7ee0cf" : "rgba(238,244,248,.62)");
            }
            if (hangFill) hangFill.setAttribute("fill", f ? f.hex : "#1c2c3b");
            if (hangGar) hangGar.style.opacity = 0;
            if (hangFill) hangFill.style.opacity = 0;
            if (hangG) hangG.setAttribute("transform", "");
            if (fileCap) {
                fileCap.textContent = f ? tr("machine.file", { no: f.no }) : tr("machine.file_none");
            }
        }

        /* ── Item-Pool ── */
        const pool = [];
        function mkPool(n) {
            for (let i = 0; i < n; i++) {
                const g = document.createElementNS(NS, "g");
                const pth = document.createElementNS(NS, "path");
                pth.setAttribute("stroke", "rgba(8,16,24,.5)");
                pth.setAttribute("stroke-width", "1");
                g.appendChild(pth);
                g.setAttribute("opacity", "0");
                items.appendChild(g);
                pool.push({ g: g, p: pth, born: -1, ti: 0, landed: false });
            }
        }
        function place(el, x, y, r) {
            el.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + (r || 0).toFixed(1) + ")");
        }
        function poolPaint(slot, type, x, y, r) {
            const it = pool[slot];
            it.p.setAttribute("d", type.p);
            it.p.setAttribute("fill", type.c);
            place(it.g, x, y, r);
        }
        /* Reduced motion: EIN vollständiges, ehrliches Standbild der laufenden
           Linie — Items auf Band und Bahn, Chip liest, ein fertiges Stück in
           der Zelle, zwei Demo-Stücke auf der Schiene. Der DEINS-Bügel bleibt
           leer, bis der Besucher entworfen hat. */
        function paintRM() {
            poolPaint(0, TYPES[0], 190, BELT_Y, -6);
            poolPaint(1, TYPES[1], SCAN_X, BELT_Y, 0);
            poolPaint(2, TYPES[3], 650, LANE_Y[2] - 14, 4);
            pool[0].g.setAttribute("opacity", ".9");
            pool[1].g.setAttribute("opacity", ".9");
            pool[2].g.setAttribute("opacity", ".9");
            if (beam) beam.style.opacity = ".85";
            if (cone) cone.style.opacity = ".6";
            if (chipT) chipT.textContent = tr(TYPES[1].chipKey);
            if (chipG) chipG.style.opacity = "1";
            divert.setAttribute("transform", "rotate(-50 504 302)");
            cutHead.style.opacity = "0";
            gar.style.strokeDashoffset = 0;
            resetDemoHangs();
            if (!fileApplied) setCellPiece("tshirt", "#7c4a45");
            garF.style.opacity = "1";
            garD.style.opacity = garDOK() ? "1" : "0";
            garH.style.opacity = ".9";
            if (hangGar) hangGar.style.opacity = fileApplied ? "1" : "0";
            if (hangFill) hangFill.style.opacity = fileApplied ? "1" : "0";
            setStatus("machine.st_one");
        }

        /* ── Zellen-Zustandsmaschine: JEDER Zyklus läuft komplett durch
           (CUT → SEW → FIN → LAB → HANG → RST) — mit Besucher-Datei ans
           DEINS-Bügel, ohne als Demo-Stück reihum an die anonymen Bügel. ── */
        let cellState = "IDLE";
        let cellT = 0;
        let hangSel = null; // Ziel-Bügel des laufenden Stücks (beim LAB→HANG-Übergang gewählt)
        const D_CUT = 3.2, D_SEW = 3.0, D_FIN = 0.8, D_LAB = 1.0, D_HANG = 1.4, D_RST = 0.6;
        function takePending() {
            if (hasPending) {
                applyFileNow(filePending);
                hasPending = false;
            }
        }
        function resetCell(toIdle) {
            gar.style.strokeDashoffset = L;
            garF.style.opacity = "0";
            garD.style.opacity = "0";
            garH.style.opacity = "0";
            cutHead.style.opacity = "0";
            needle.classList.remove("sewing");
            labelChip.setAttribute("transform", "");
            if (toIdle) {
                cellState = "IDLE";
                cellT = 0;
                setStatus("machine.st_ready");
            }
        }
        function startCycle(itemHex) {
            if (cellState !== "IDLE") return;
            takePending();
            // Ohne Datei fertigt die Linie ein Demo-Stück: aus dem Material,
            // das den Zyklus ausgelöst hat, der Typ rotiert durch alle sechs.
            if (!fileApplied) {
                setCellPiece(DEMO_TYPES[demoTypeIdx % DEMO_TYPES.length], itemHex || "#7c4a45");
                demoTypeIdx++;
            }
            resetCell(false);
            cellState = "CUT";
            cellT = 0;
        }
        // Maschinen fahren rampen: linear mit Smoothstep-Enden
        function ramp(p) {
            if (p < 0.09) return ease(p / 0.09) * 0.09;
            if (p > 0.91) return 0.91 + ease((p - 0.91) / 0.09) * 0.09;
            return p;
        }
        function cellTick(dt) {
            if (cellState === "IDLE") return;
            cellT += dt;
            if (cellState === "CUT") {
                const p = Math.min(1, cellT / D_CUT);
                const pr = ramp(p);
                gar.style.strokeDashoffset = L * (1 - pr);
                cutHead.style.opacity = "1";
                headAt(pr);
                if (fileApplied) setStatus("machine.st_cut_no", { no: fileApplied.no });
                else setStatus("machine.st_cut");
                if (p >= 1) {
                    cutHead.style.opacity = "0";
                    cellState = "SEW"; cellT = 0;
                    setStatus("machine.st_sew");
                    needle.classList.add("sewing");
                }
            } else if (cellState === "SEW") {
                if (cellT >= D_SEW) {
                    needle.classList.remove("sewing");
                    cellState = "FIN"; cellT = 0;
                    setStatus("machine.st_fin");
                }
            } else if (cellState === "FIN") {
                const fp = Math.min(1, cellT / D_FIN);
                garF.style.opacity = fp;
                garD.style.opacity = garDOK() ? fp : 0;
                garH.style.opacity = fp * 0.9;
                if (fp >= 1) {
                    cellState = "LAB"; cellT = 0;
                    if (fileApplied) setStatus("machine.st_label", { no: fileApplied.no });
                    else setStatus("machine.st_label0");
                }
            } else if (cellState === "LAB") {
                const lp = easeOut(cellT / D_LAB);
                labelChip.setAttribute("transform", "translate(" + (16 * lp).toFixed(1) + " " + (-34 * lp).toFixed(1) + ")");
                if (cellT >= D_LAB) {
                    cellState = "HANG"; cellT = 0;
                    // Ziel-Bügel wählen: Besucher-Datei → DEINS; Demo-Stück →
                    // reihum der nächste anonyme Bügel, in der Stück-Farbe.
                    if (fileApplied) {
                        hangSel = { g: hangG, line: hangGar, fill: hangFill, cx: 1176 };
                        setStatus("machine.st_rail", { no: fileApplied.no });
                    } else {
                        hangSel = demoHangs.length ? demoHangs[demoHangIdx % demoHangs.length] : null;
                        demoHangIdx++;
                        if (hangSel) {
                            hangSel.fill.setAttribute("fill", cellPiece.hex);
                            hangSel.fill.style.opacity = "0";
                            hangSel.line.style.opacity = "0";
                        }
                        setStatus("machine.st_rail0");
                    }
                }
            } else if (cellState === "HANG") {
                const gp = Math.min(1, cellT / D_HANG);
                const fd = ease(gp);
                garF.style.opacity = 1 - fd;
                garD.style.opacity = "0";
                garH.style.opacity = (1 - fd) * 0.9;
                gar.style.strokeDashoffset = L * fd;
                if (hangSel) {
                    hangSel.line.style.opacity = fd;
                    hangSel.fill.style.opacity = fd;
                    const sw = Math.exp(-3 * gp) * Math.cos(gp * 9) * 4;
                    hangSel.g.setAttribute("transform", "rotate(" + sw.toFixed(2) + " " + hangSel.cx + " 372)");
                }
                if (gp >= 1) {
                    if (hangSel) hangSel.g.setAttribute("transform", "");
                    labelChip.setAttribute("transform", "");
                    cellState = "RST"; cellT = 0;
                    setStatus("machine.st_reset");
                }
            } else if (cellState === "RST") {
                if (cellT >= D_RST) { takePending(); resetCell(true); }
            }
        }

        /* ── Studio-Brücke: der Entwurf des Besuchers wird zur Schnittdatei ──
           StateManager: currentDesign (Objekt) + currentType (Typ-Schlüssel) +
           currentColor (Hex). Übernahme nur an Zyklus-Grenzen — die Zelle
           bricht nie mitten im Schnitt ab. */
        function fileNo(seed) {
            let h = 0;
            for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
            return String(1000 + (h % 9000));
        }
        function fileFromState() {
            const S = window.StateManager;
            if (!S || typeof S.get !== "function") return null;
            const d = S.get("currentDesign");
            if (!d) return null;
            const type = S.get("currentType") || "tshirt";
            const hex = S.get("currentColor") || "#1a1a1a";
            return { type: type, hex: hex, no: fileNo(type + "|" + hex + "|" + (d.name || "")) };
        }
        function syncFile() {
            const f = fileFromState();
            const same = (!f && !fileApplied && !hasPending) ||
                (f && fileApplied && !hasPending && f.type === fileApplied.type && f.hex === fileApplied.hex && f.no === fileApplied.no);
            if (same) return;
            filePending = f;
            hasPending = true;
            if (RM) { takePending(); paintRM(); return; }
            if (cellState === "IDLE") { takePending(); resetCell(true); }
        }
        if (window.StateManager && typeof window.StateManager.subscribe === "function") {
            ["currentDesign:change", "currentType:change", "currentColor:change", "state:reset"].forEach((ev) => {
                window.StateManager.subscribe(ev, syncFile);
            });
        }

        /* ── Kamera (Desktop: viewBox-Zoom; Mobil: Scroll zur Stufe) ── */
        const FR = [
            [0, 0, 1200, 560],        // Gesamtbild
            [0, 150, 520, 243],       // 01 Eingang
            [260, 90, 600, 280],      // 02 Sortierung + Ströme
            [700, 60, 500, 233],      // 03 Remake-Zelle
            [790, 245, 410, 191.3],   // 04 Nähmodul + Ausgang
        ];
        const cam = { cur: FR[0].slice(), tgt: FR[0].slice(), live: false };
        let camActive = 0;
        let camTimer = null;
        const mqDesk = window.matchMedia ? window.matchMedia("(min-width: 990px)") : { matches: true };
        const cards = Array.prototype.slice.call(document.querySelectorAll("button.lp-m-st"));
        function setVB(v) {
            svg.setAttribute("viewBox", v[0].toFixed(1) + " " + v[1].toFixed(1) + " " + v[2].toFixed(1) + " " + v[3].toFixed(1));
        }
        function camTo(i) {
            camActive = i;
            cam.tgt = FR[i].slice();
            if (RM) {
                cam.cur = FR[i].slice();
                cam.live = false;
                setVB(cam.cur);
            } else {
                cam.live = true;
            }
            if (band) band.classList.toggle("zoomed", i !== 0);
            cards.forEach((c, k) => c.setAttribute("aria-pressed", (k + 1) === i ? "true" : "false"));
            if (camTimer) { clearTimeout(camTimer); camTimer = null; }
            if (i !== 0) camTimer = setTimeout(() => camTo(0), 6000);
        }
        function camTick(dt) {
            if (!cam.live) return;
            const k = 1 - Math.exp(-6 * dt);
            let d = 0;
            for (let i = 0; i < 4; i++) {
                cam.cur[i] += (cam.tgt[i] - cam.cur[i]) * k;
                d += Math.abs(cam.tgt[i] - cam.cur[i]);
            }
            if (d < 0.5) { cam.cur = cam.tgt.slice(); cam.live = false; }
            setVB(cam.cur);
        }
        let cardsOn = false;
        cards.forEach((c, k) => {
            c.addEventListener("click", () => {
                if (mqDesk.matches) {
                    if (!cardsOn && !RM) return; // erst nach dem Boot der Zeichnung
                    camTo(camActive === (k + 1) ? 0 : (k + 1));
                } else if (scroller) {
                    const center = (FR[k + 1][0] + FR[k + 1][2] / 2) / 1200;
                    scroller.scrollTo({
                        left: center * scroller.scrollWidth - scroller.clientWidth / 2,
                        behavior: RM ? "auto" : "smooth",
                    });
                }
            });
        });

        /* ── Sprachwechsel: JS-gesetzte Texte live neu rendern ── */
        window.addEventListener("language:change", () => {
            if (lastStatusKey) statusT.textContent = tr(lastStatusKey, lastStatusVars);
            tagT.textContent = fileApplied ? tr("machine.tag_no", { no: fileApplied.no }) : tr("machine.tag_empty");
            if (hangNo) hangNo.textContent = fileApplied ? tr("machine.no", { no: fileApplied.no }) : tr("machine.no_none");
            if (fileCap) {
                fileCap.textContent = fileApplied ? tr("machine.file", { no: fileApplied.no }) : tr("machine.file_none");
            }
            if (RM && chipT) chipT.textContent = tr(TYPES[1].chipKey);
        });

        /* ── Reduced-Motion-Pfad: Standbild, sofortige Kamera ── */
        if (RM) {
            mkPool(3);
            applyFileNow(fileFromState());
            paintRM();
            return;
        }

        /* ── Items, Scanner-Kopf, Verteiler ── */
        mkPool(6);
        applyFileNow(fileFromState());
        let spawned = 0;
        let paddleCur = 0;
        let paddleTgt = 0;
        let headX = SCAN_X;
        let coneBase = 0;
        function itemPos(t, type) {
            if (t < T_LIFT) {
                const p1 = ease(t / T_LIFT);
                return { x: 100 + 24 * p1, y: 300 - 12 * Math.sin(p1 * Math.PI * 0.5), rot: -4 * p1, a: Math.min(1, t / 0.3) };
            }
            t -= T_LIFT;
            if (t < T_BELT) {
                const p2 = ease(t / T_BELT);
                return { x: 124 + (SCAN_X - 124) * p2, y: BELT_Y + Math.sin(t * 5) * 2, rot: Math.sin(t * 4) * 4, a: 1 };
            }
            t -= T_BELT;
            if (t < T_SCAN) {
                return { x: SCAN_X, y: BELT_Y, rot: 0, a: 1, scan: true, scanT: t / T_SCAN };
            }
            t -= T_SCAN;
            if (t < T_ROUTE) {
                const p3 = ease(t / T_ROUTE);
                if (p3 > 0.5) paddleTgt = [-50, 0, 50][type.lane];
                return { x: SCAN_X + (DIV_X - SCAN_X) * p3, y: BELT_Y, rot: 0, a: 1 };
            }
            t -= T_ROUTE;
            if (t < T_LANE) {
                const p4 = t / T_LANE;
                const x = DIV_X + (FADE_X - DIV_X) * ease(p4);
                const yb = ease(Math.min(1, p4 / 0.4));
                const y = BELT_Y + (LANE_Y[type.lane] - 14 - BELT_Y) * yb;
                return { x: x, y: y, rot: Math.sin(t * 4) * 3, a: 1 };
            }
            t -= T_LANE;
            if (t < T_FADE) {
                return { x: FADE_X, y: LANE_Y[type.lane] - 14, rot: 0, a: 1 - t / T_FADE, land: true };
            }
            return { done: true };
        }
        function itemsTick(el) {
            if (el < 0) return null;
            const want = Math.min(spawned + 1, Math.floor(el / SPAWN) + 1);
            while (spawned < want) {
                let slot = null;
                for (let s = 0; s < pool.length; s++) {
                    if (pool[s].born < 0) { slot = pool[s]; break; }
                }
                if (!slot) break;
                slot.born = spawned * SPAWN;
                slot.ti = spawned % TYPES.length;
                slot.landed = false;
                const ty = TYPES[slot.ti];
                slot.p.setAttribute("d", ty.p);
                slot.p.setAttribute("fill", ty.c);
                spawned++;
            }
            let scanning = null;
            let scanT = 0;
            pool.forEach((it) => {
                if (it.born < 0) return;
                const t = el - it.born;
                if (t < 0) return;
                const ty = TYPES[it.ti];
                const pos = itemPos(t, ty);
                if (pos.done) {
                    it.g.setAttribute("opacity", "0");
                    it.born = -1;
                    return;
                }
                it.g.setAttribute("opacity", (pos.a == null ? 1 : pos.a).toFixed(2));
                place(it.g, pos.x, pos.y, pos.rot || 0);
                if (pos.scan) { scanning = ty; scanT = pos.scanT; }
                if (pos.land && !it.landed) {
                    it.landed = true;
                    const b = bales[ty.lane];
                    if (b) {
                        b.classList.add("pulse");
                        setTimeout(() => b.classList.remove("pulse"), 240);
                    }
                    // Remake-Material gelandet → die Zelle beginnt einen Zyklus
                    // (ohne Datei wird genau dieses Material zum Demo-Stück)
                    if (ty.lane === 0 && cellState === "IDLE") startCycle(ty.c);
                }
            });
            return scanning ? { type: scanning, t: scanT } : null;
        }
        function headTick(dt, scan, el) {
            if (scan) {
                headX = 340 + 70 * ease(scan.t);
                coneBase = 0.65;
            } else {
                headX = headX + (SCAN_X - headX) * Math.min(1, dt * 4);
                coneBase = 0.3 + 0.14 * Math.sin(el * 2.4);
            }
            head.setAttribute("transform", "translate(" + headX.toFixed(1) + " 0)");
            if (cone) cone.style.opacity = coneBase.toFixed(2);
            if (scan) {
                if (beam) beam.style.opacity = ".85";
                const chip = tr(scan.type.chipKey);
                if (chipT && chipT.textContent !== chip) chipT.textContent = chip;
                if (chipG) { chipG.style.opacity = "1"; chipG.classList.add("on"); }
            } else {
                if (beam) beam.style.opacity = ".35";
                if (chipG) { chipG.style.opacity = "0"; chipG.classList.remove("on"); }
            }
        }
        function paddleTick(dt) {
            paddleCur += (paddleTgt - paddleCur) * Math.min(1, dt * 10);
            divert.setAttribute("transform", "rotate(" + paddleCur.toFixed(1) + " 504 302)");
        }

        /* ── Boot: Rails zeichnen sich, Beschriftung blendet ein ── */
        function bootRails() {
            let i = 0;
            Array.prototype.forEach.call(svg.querySelectorAll(".m-rail"), (r) => {
                let Lr;
                try { Lr = r.getTotalLength(); } catch (_e) { Lr = 600; }
                r.style.strokeDasharray = Lr;
                r.style.strokeDashoffset = Lr;
                r.getBoundingClientRect();
                r.style.transition = "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1) " + (i * 0.12) + "s";
                r.style.strokeDashoffset = "0";
                i++;
            });
            Array.prototype.forEach.call(svg.querySelectorAll(".m-ignite"), (g, k) => {
                g.style.opacity = "0";
                g.getBoundingClientRect();
                g.style.transition = "opacity .5s ease " + (0.7 + k * 0.18) + "s";
                g.style.opacity = "1";
            });
        }

        /* ── Hauptschleife: nur sichtbar + Tab aktiv ── */
        let rafId = null;
        let onScreen = true;
        let booted = false;
        let bootDelay = 0;
        let t0 = null;
        let lastTs = null;
        function running() { return onScreen && !document.hidden; }
        function loop(ts) {
            rafId = null;
            if (!running()) return;
            if (t0 == null) { t0 = ts + bootDelay; lastTs = ts; }
            const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
            lastTs = ts;
            const el = (ts - t0) / 1000;
            if (!cardsOn && el > 0) cardsOn = true;
            const scan = itemsTick(el);
            if (el > 0) cellTick(dt);
            headTick(dt, scan, Math.max(0, el));
            paddleTick(dt);
            camTick(dt);
            rafId = requestAnimationFrame(loop);
        }
        function kick() {
            if (rafId == null && running()) {
                t0 = null;
                lastTs = null;
                spawned = 0;
                pool.forEach((it) => {
                    it.born = -1;
                    it.g.setAttribute("opacity", "0");
                });
                if (camTimer) { clearTimeout(camTimer); camTimer = null; }
                camActive = 0;
                cam.cur = FR[0].slice();
                cam.tgt = FR[0].slice();
                cam.live = false;
                setVB(cam.cur);
                if (band) band.classList.remove("zoomed");
                cards.forEach((c) => c.setAttribute("aria-pressed", "false"));
                takePending();
                resetDemoHangs();
                demoHangIdx = 0;
                resetCell(true);
                if (!booted) {
                    booted = true;
                    bootDelay = 3000; // erst zeichnet sich die Anlage, dann läuft sie an
                    bootRails();
                } else {
                    bootDelay = 0;
                }
                rafId = requestAnimationFrame(loop);
            }
        }
        document.addEventListener("visibilitychange", kick);
        if ("IntersectionObserver" in window) {
            // Immer den LETZTEN Eintrag lesen: ScrollTrigger-Pin-Refresh +
            // Chrome-Fragment-Re-Snap liefern Verlassen/Betreten gebatcht in
            // EINEM Callback — es[0] wäre der veraltete Zustand und friere
            // die Simulation dauerhaft ein.
            new IntersectionObserver((es) => {
                onScreen = es[es.length - 1].isIntersecting;
                kick();
            }, { threshold: 0.05 }).observe(svg);
        }
        kick();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
