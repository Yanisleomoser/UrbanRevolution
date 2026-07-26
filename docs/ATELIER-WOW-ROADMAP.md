# Atelier-Wow-Roadmap — „Das Stück ist die Bühne"

> Handoff-Dokument für die nächste Atelier-Generation. Entstanden aus dem
> Owner-Brief (2026-07-24, nach Merge von #448/Runde 3): *„Ziel ist ein
> Atelier wie Nike Football — High-End-Visuals, klares Layout, etliche
> Variationen, ein User-Flow auf dem Niveau von Apple & Co; vielleicht
> Liquid Glass."* Lesen zusammen mit `CLAUDE.md` und
> `docs/STUDIO-UX-ROADMAP.md` (§11 Guardrails + §12 Pitfalls gelten hier
> unverändert).

---

## 1. Die Lesart des Briefs

Vier Referenzen, eine gemeinsame Diagnose:

| Referenz | Was sie wirklich bedeutet |
| --- | --- |
| **Nike By You / Nike Football** | Das Produkt IST die Bühne (~70 % des Screens). Controls schweben klein daneben; jede Interaktion verändert sofort das Objekt. |
| **Apple (Watch Studio)** | Selbstverständlichkeit: wenige Entscheidungen pro Screen, Produkt gross in der Mitte, Optionen als horizontale Karussells darunter — nie ein Formular-Gefühl. |
| **„Etliche Variationen"** | Breite muss *sichtbar* sein: eine Galerie fertiger Stücke (Colorway-Grid), nicht ein Versprechen im Fragenbaum. |
| **„Liquid Glass"** | Material-Tiefe der Controls — Bedienelemente als physisches Material, nicht als flache Karten. |

**Die Diagnose:** Was das heutige Atelier vom Referenz-Niveau trennt, sind
keine fehlenden Features — es ist **Inszenierung**. Die Engine (adaptive
Reise, morphender Flat, Detail-Atelier, Archetyp-Refine, Stapel-Signaturen,
Session-Variation) ist nach Runde 3 inhaltlich da. Vier Lücken bleiben:

1. **Bühnen-Dominanz:** Die Bühne misst im Cockpit 30 svh; das Blatt
   dominiert. Nike/Apple invertieren das Verhältnis.
2. **Objekt der Begierde:** Der Flat wird *angezeigt* (flache Fläche,
   Radial-Glow) statt *fotografiert* (Podium, Licht, Schatten, Spiegelung).
3. **Optionen als Formular:** Auswahlkacheln statt fertiger Stücke.
4. **Control-Materialität:** Flache Karten auf dunklem Grund — kein
   fühlbares Material.

## 2. Die Identitäts-Entscheidung (load-bearing)

**Wir kopieren Nikes Fotorealismus NICHT.** Drei tragende Regeln stehen dem
entgegen und bleiben stehen: *kein fabrizierter Beweis* (pre-launch keine
Fake-Produktfotos), *kein WebGL in der Journey* (Performance-Vertrag,
§11), *der Flat nie über dem Foto mitten in der Reise*. Ein pseudo-3D-Fake
wäre exakt die Unehrlichkeit, gegen die die Marke antritt.

Stattdessen: **Der Blueprint ist die Identität.** Nike zeigt ein Produkt aus
dem Regal — wir zeigen *deine Konstruktion, während die Maschine sie liest*.
Die Lücke ist nicht das Konzept, sondern dass der Blueprint wie ein Diagramm
behandelt wird statt wie ein Objekt der Begierde. Ziel: **Studio-Fotografie
für einen Blueprint.**

Zum Liquid-Glass-Wunsch: 1:1 übernommen wäre es ein Apple-Imitat und kostet
auf Mobile real Compositor-Budget (`backdrop-filter`-Ebenen; die
Jank-Kämpfe in §12 waren real). Als **eigener Dialekt** passt es aber
präzise: Die Maschine in Akt II hat bereits eine *gläserne Remake-Zelle* —
Controls als **Instrumenten-Glas** (schwebende, leicht refraktive Panels in
Thermal-Palette mit Korn und Lichtkante) sind Cockpit-HUD, kein iOS-Zitat.
Budget: höchstens 1–2 Glasebenen gleichzeitig, `backdrop-filter` nur auf dem
Dock/Sheet, nie pro Kachel.

## 3. Die fünf Bausteine (je ein PR-fähiger Schnitt)

### B1 · Bühne zuerst (Cockpit v4) — `layout/`
Das Stück bekommt ~65–70 % des Rahmens, permanent. Frage + Optionen wandern
in ein kompaktes **Glas-Dock** am unteren Rand (Frage als stille Zeile im
Dock-Kopf, Optionen darunter, Aktionen im Daumenbereich wie bisher).
- Mechanik: bestehender Cockpit-Fixed-Frame bleibt (100svh−24), nur die
  Flex-Anteile drehen sich; `data-de-mod`-Regie erweitert (Regions-Board und
  Describe behalten ihre Sonderlayouts).
- Risiko: Grosssets (6 Karten) und Ranking brauchen im kleineren Dock ein
  Karussell (→ B5) oder ein temporäres „Dock hebt sich"-Verhalten (Sheet
  expandiert über die Bühne, Bühne dimmt — wie ein Bottom-Sheet).
- Verify: `verify-describe`-Cockpit-Vertrag erweitern (Bühne ≥ 60 % Höhe auf
  jedem Frage-Screen), voller `shoot-journey` beide Viewports.

### B2 · Studio-Licht für den Blueprint — `visual/`
Render-Pass auf der Bühne, ohne den Flat selbst zu verfälschen:
- Podiums-Lichtkegel von oben (CSS-Gradient, kein Filter), weicher
  elliptischer Bodenschatten unter dem Saum (der `ground`-Layer existiert in
  `renderFlat` bereits), dezente vertikale Spiegelung (CSS `transform:
  scaleY(-1)` + Masken-Fade, statisch, kein Live-Klon nötig — die Bühne
  repaintet ohnehin pro Morph-Frame; Budget messen).
- Tieferes Material-Licht: die bestehende `MATERIAL_OPTICS`-Tabelle um eine
  Bühnen-Lichtrichtung ergänzen (ein zweiter, schwächerer Specular-Stop) —
  rein datengetrieben im bestehenden Verlaufssystem.
- Verify: Frame-Serie der Bühne je Kategorie (Kontaktbogen), kein
  zusätzlicher rAF-Loop (13-fps-Falle, §12.1).

### B3 · Material-Realität — `visual/`
Beim Stoff-Moment blutet das Makro-Foto des fokussierten Materials
vollflächig in die Bühne (Assets existieren: `content/img/material/*.jpg`,
alle 7). Der Flat schwebt davor; beim Commit zieht sich das Foto in die
Kachel zurück.
- Hover/Fokus auf einer Material-Kachel = Backdrop-Wechsel (Crossfade
  ≤ 250 ms, `html.fx`-gated; reduced-motion: statischer Wechsel).
- Ehrlichkeits-Grenze: Das Foto ist MATERIAL-Beweis (Stoff existiert), nie
  Produkt-Beweis — es bleibt Hintergrund, der Flat bleibt das Stück.
- Erweiterbar auf andere Momente (Farbwelt = Bühne nimmt den Verlauf an —
  existiert in Ansätzen über `archTint`).

### B4 · Startpunkt-Galerie — `engine/`
Nach Gefühl + Kategorie zeigt die Engine **6–8 komplett aufgelöste Stücke**
als Colorway-Grid — der Nike-Moment, sofort sichtbare Vielfalt:
- Gratis generierbar: pro Archetyp `completeFrom` auf die aktuelle DNA
  (Kategorie + Mood-Gewichte) → `GarmentSVG.build` — dieselbe Pipeline wie
  Refine-Tiles; plus 1–2 Jitter-Varianten (`mutateDna` mit Archetyp, wie in
  Runde 3 gebaut).
- Ein Tap = Startpunkt übernehmen (DNA-Merge bei conf ~0.55 — unter der
  Entscheidungs-Schwelle, damit die Reise danach ECHTE Fragen stellt und
  jede Antwort den Startpunkt überschreiben kann); „Von null" bleibt als
  stiller Weg (Skip).
- Journey-Länge: Der Startpunkt beantwortet nichts hart → keine Kollision
  mit dem ≤16-Screens-Spine; er macht Inferenz sichtbar statt Fragen
  einzusparen. (Wer will, dass er Fragen SPART, muss §7-Trade-offs neu
  verhandeln — bewusst nicht Teil dieses Schnitts.)
- Positionierung im Fluss: als eigener Node nach `category_select`
  (Modalität `gallery`, neue Modalität nach dem `regions`-Vorbild — engine.js
  braucht dank `targetPaths`-Erweiterungspunkt voraussichtlich null Änderung).

### B5 · Instrumenten-Glas + Karussells — `visual/`
- **Glas-Material** (ein Token-Set): `--glass-bg` (rgba-Fläche),
  `--glass-edge` (1px-Lichtkante oben), `--glass-blur` (backdrop-filter),
  Korn-Overlay aus `--grain`. Angewandt auf: das Dock (B1), den
  Region-Picker, den Understood-Block, die Refine-Aktionsleiste. NICHT auf
  einzelne Kacheln (Budget).
- **Horizontale Karussells** mobil für Karten-Sets (scroll-snap,
  daumen-wischbar, Apple-Watch-Studio-Muster): `de-cards` bekommt im Dock
  eine `is-rail`-Variante (scroll-snap-x, Kachel ~44 vw, Peek der nächsten).
  A11y: Tab-Reihenfolge bleibt DOM-Reihenfolge, `scroll-snap` stört
  Screenreader nicht; Fokus scrollt die Rail (`scroll-margin-inline`).
- Fallbacks: kein `backdrop-filter`-Support → opake `--bg-elevated`-Fläche
  (Feature-Query), reduced-motion unverändert statisch.

## 4. Reihenfolge-Empfehlung

**B1 + B5 zuerst** (ein PR oder zwei eng gekoppelte): Sie definieren das
Layout, in dem B2–B4 spielen — jeder andere Startpunkt würde doppelt
gebaut. Danach B2 (reine Visual-Tiefe, kein Strukturrisiko), dann B3,
dann B4 (grösster Engine-Anteil, profitiert von der fertigen Bühne).
Jeder Baustein ist High-Risk-Visuell → PR + Vercel-Preview + iPhone-Gate.

## 5. Nicht verhandelbar (aus CLAUDE.md/§11, hier nur verankert)

- Kein WebGL in der Journey, kein Framework, kein Build-Step.
- Kein fabrizierter Beweis: Fotos nur als Material-/Mood-Beweis oder beim
  generierten Ownership-Render — nie als Pseudo-Produktfoto mitten in der
  Reise.
- `html.fx`-Gate + reduced-motion vollständig statisch; Übergänge ≤ 250 ms
  (Ausnahmen nur die sanktionierten Hero-Beats).
- i18n DE+EN für jede neue Zeile; neue Inhalte in JSON, nicht in Code.
- A11y-Vertrag (Fokus, ARIA, Tastatur-Pfade) — axe-Gate bleibt grün.
- Performance-Budget: max. 1–2 `backdrop-filter`-Ebenen, kein zusätzlicher
  Dauer-rAF, Bühnen-Repaints bleiben im bestehenden Morph-Loop.

## 6. Status

- 2026-07-24: Dokument angelegt (nach Merge von #448/Runde 3). Noch kein
  Baustein begonnen. Owner-Priorisierung offen — Empfehlung: B1+B5.
- 2026-07-24 (später): **B1 + B5 umgesetzt** (ein PR, Branch
  `claude/wow-roadmap-implementation-o7w15g`) — wie in §4 empfohlen als
  gekoppelter erster Schnitt:
  - **B1:** Cockpit v4 — die Bühne trägt ~63–68 % des Rahmens auf jedem
    Standard-Frage-Screen (flex-Inversion; Dock-Cap 36 %), Frage als stille
    Zeile im Dock-Kopf, Chips als Bühnen-Overlay, Kapitel-Stempel auf der
    Bühne. Sonderlayouts (describe/regions/refine) unverändert. Für hohe
    Inhalte (Farb-Atelier, Ranking) wurde die im B1-Risiko benannte
    Alternative **„Dock hebt sich"** gebaut (flow.js `syncDockLift`,
    Bottom-Sheet-Cap 58 %, Bühne dimmt auf 0.6) — zusätzlich zu den
    B5-Rails, nicht statt ihnen.
  - **B5:** Token-Set `--glass-bg`/`--glass-edge`/`--glass-blur` (+ Korn via
    `--grain`); Glas auf Dock, Region-Picker, Verstanden-Block,
    Refine-Aktionsleiste; backdrop-filter NUR Dock + Picker (Budget),
    Feature-Query-Fallback auf `--bg-elevated`. Karten-Sets und
    Farb-Swatches laufen im Dock als scroll-snap-Rail (Peek, Fokus zieht
    die Rail nach, Tab-Folge = DOM-Folge).
  - Vertrag ausgebaut: `scripts/verify-describe.mjs` Abschnitt 3 walkt den
    Jacken-Branch und prüft pro Screen Bühne ≥ 60 % (bzw. Lift-Regel),
    Rail, Daumenzone, Overflow, Glas-Material.
  - Offen: B2 (Studio-Licht), B3 (Material-Realität), B4
    (Startpunkt-Galerie) — Reihenfolge per §4: B2 als nächstes.
- 2026-07-25: **Owner-Runde am Preview** (fünf Befunde) + adversarielle
  Gegenprüfung. Was dabei gelernt wurde, gehört in dieses Dokument, weil es
  die Annahmen von B1/B2/B5 korrigiert:
  - **„Das Glas ist kaum Glas" war exakt richtig — und der Grund war
    strukturell:** gemessen 0 px Überlappung zwischen Dock und Bühne. Ein
    `backdrop-filter` auf einem Flex-GESCHWISTER hat nichts hinter sich als
    flachen Seitenhintergrund; die Brechung war ein No-Op. **Regel für jede
    weitere Glasfläche:** Glas braucht (a) echtes Überlappen und (b) etwas
    Leuchtendes dahinter. Die Maschine in Akt II macht es vor — ihre
    „gläserne" Remake-Zelle liest sich als Glas wegen `mCellGlow` (grüner
    Radial hinter der Zelle), nicht wegen Blur. Umgesetzt: Dock liegt 24 px
    auf der Bühne, deren Boden einen Lichtpool trägt.
  - **Der Lichtpool ist faktisch B2-Vorarbeit** (Podest/Bodenlicht aus §3
    B2) — B2 kann darauf aufbauen statt bei null anzufangen.
  - **„Die Bühne ist der Held" erhöht den Anspruch an den Helden.** Der
    Kleid-Rock war seit je das einzige Polygon im Flat-Vokabular (harte
    Taillenecke, gerader Saum, keine Saumkante). Bei 30 % Bühnenhöhe fiel
    das nicht auf, bei ~65 % las es sich als Papiertüte. Erwartung für
    B2–B4: **weitere solche Altlasten werden durch die grössere Bühne
    sichtbar** — sie sind Teil der Kosten von B1, nicht Zufall.
  - **Kachel-Vielfalt kostet Blur-Budget.** Das Foto-Duell trug pro Panel
    zwei gefüllte `backdrop-filter`-Pillen; zusammen mit Dock und Navbar
    lagen real 5–7 Blur-Ebenen auf einem Screen. Unterschriften-Band statt
    Pillen. **Regel:** Lesbarkeit über Fotos kommt aus einem Verlaufs-Band,
    nicht aus Blur-Pillen (Budget UND Premium-Anmutung).
  - **B2 geliefert** (2026-07-25, eigener PR): Podest-Kegel + Bodenpool +
    **Hohlkehle** (der Cyclorama-Übergang — der entscheidende Griff: ohne
    Bodenebene steht das Stück auf nichts, egal wie stark der Pool ist) +
    Vignette, alles als `--stage-*`-Token, damit Basis und Cockpit EINE
    Definition teilen. Kontaktschatten zweistufig (enger Kern + weiter
    Halbschatten) — er war vorher dunkel auf dunkel und praktisch unsichtbar.
    Der Flat ANTWORTET über einen vertikalen Bühnen-Stop (`sl`) aus derselben
    `(spec, rough)`-Optik: Überkopf-Fang auf der Schulter, matter Bounce am
    Saum, Seide stärker als Fleece. Kein neuer rAF, kein Filter — reine
    Verläufe, der Morph-Loop bleibt unberührt.
    - **B2c (Spiegelung) bewusst NICHT umgesetzt.** Am Render getestet, nicht
      wegargumentiert: `-webkit-box-reflect` spiegelt die SVG-BOX, nicht das
      Stück — die Box reicht weit unter den Saum, die Spiegelung landete
      ausserhalb der sichtbaren Bühne (Repaint-Messung identisch im Rauschen,
      weil gar nichts gezeichnet wurde). Zudem widerspräche sie der matten
      Hohlkehle, die B2 gerade aufgebaut hat — glänzender Boden + Cyclorama
      ist genau der billige Look. Wer sie doch will, braucht eine Box, die
      den Saum umschliesst.
    - Permanenter Guard: `scripts/verify-stage-light.mjs` (21 Checks, beide
      Viewports) — Kegel/Hohlkehle/Vignette liegen auf JEDER Breite, das
      Cockpit hebt den Pool an (sonst verliert das Glas-Dock still das, was
      es brechen soll), kein filter/backdrop-filter auf der Bühne (Budget),
      der Bühnen-Stop ist vertikal + materialabhängig + untergeordnet, der
      Kontaktschatten ist zweistufig und wandert mit dem Saum, Schwarz trägt
      sein Rim-Light. Gegengeprüft: bricht man die Token-Kaskade, schlägt der
      Guard an (kein vakuumer Lauf).
    - Gelernt: der Bodenpool darf NICHT stark auf fixer Höhe stehen — bei
      kurzen Stücken liest er als ZWEITER Boden, über dem das Teil schwebt.
      Das Stück steht auf seinem eigenen, mitwandernden Kontaktschatten; die
      CSS-Lage ist nur Umgebungslicht (Ausnahme Cockpit, wo das Glas-Dock
      etwas zum Brechen braucht).
  - **Fallstrick für B4 (Startpunkt-Galerie), teuer gelernt:**
    `ALLOWED_CLOSURES` in `garment-svg.js` ist NICHT nur die Zeichen-Liste —
    sie ist auch das Gate, mit dem `flow.js scrubImpossibleFills`
    Archetyp-Füllungen verwirft. Eine Kategorie etwas Neues zeichnen zu
    lehren macht denselben Wert automatisch ERRATBAR: das Kleid trug prompt
    eine Knopfleiste, die niemand gewählt hatte. Seither getrennt
    (`INFERABLE_CLOSURES`). **B4 fasst genau diese Inferenz-Maschinerie an
    (`completeFrom` auf die aktuelle DNA) — vor dem Bauen diesen Absatz
    lesen.** Und: der zugehörige Test stubte `closureAllowed` von Hand und
    konnte das Auseinanderlaufen prinzipiell nicht sehen; Gates immer gegen
    das ECHTE Modul testen.
- 2026-07-25 (Owner-Runde 2, iPhone-Foto): **„Drei Kästen, zu viele Linien"**
  — der Owner wollte ZWEI saubere Flächen, die den ganzen Rahmen füllen: oben
  das Stück, unten die Bedienung. Umgesetzt in zwei Schritten, beide im selben
  Branch:
  - **Ein Rahmen, zwei Flächen.** Der Rahmen trug real vier verschachtelte
    Kantensätze (`.design-journey` + `#de-preview` + `.de-ask-col` + vier
    Passermarken). Jetzt clippt der Rahmen, Bühne und Dock sind randlos und
    füllen ihn ganz; die Passermarken sind ersatzlos entfallen. Gemessen:
    innere Konturen 0 px, Bühne am Oberrand, Dock am Unterrand.
  - **Kanten-Diät im Wahl-Vokabular.** Jede Option war doppelt gerahmt (Karte
    mit Fläche + Rand, darin ein gerahmtes Bild) — bei sechs Kacheln zwölf
    Kanten. Jetzt IST das Bild die Karte, das Label steht frei darunter, der
    Zustand ist ein Ring auf dem Bild. Dasselbe für Farb-Swatches,
    Picker-Zeilen, Rangliste (Haarlinien statt Kartenstapel) und den
    Describe-Nebenweg. Bewusst in den BASISREGELN, nicht im Cockpit-Block:
    das ist Designsprache, keine Platzsparmassnahme — Desktop und Cockpit
    dürfen nicht verschieden sprechen.
  - **Farbe bekommt je EINE Bedeutung.** Der Marken-Verlauf lag gleichzeitig
    auf Bestätigung, Fertig-Pille, Segment-Tab und vier Rang-Scheiben — vier
    „Hauptaktionen" heissen keine. Jetzt: Verlauf = die eine Bestätigung,
    Grün = deine Wahl (Auswahl-Ring, Rang-Ziffer, „Fertig"), Periwinkle =
    Zeiger/Fokus. Der Guard zählt das nach.
  - **Saum-Reserve statt Kollision.** Die Chip-Zeile lag zwangsläufig auf dem
    Rock: das Flat endete ~20 px über der Bühnenkante. Jetzt hat die
    Registratur-Zeile ihren eigenen Boden (`padding-bottom` auf der Bühne,
    Bodenpool wandert mit), gemessen 6 px unter dem Flat und 16 px über dem
    Dock. Auf der KURZEN Bühne (describe/refine) treten Chips und Masse-Zeile
    ganz ab — dort füllt das Stück den Rahmen und jede Beschriftung läge
    darauf.
  - **Nebeneffekt, quantifiziert:** weniger Kästen = weniger Höhe. Auf einem
    kurzen iPhone (375×553) sank der Überhang unter der klebenden Bestätigung
    auf jedem Screen: Rangliste 236 → 0 px, Farb-Atelier 118 → 12 px, vier
    Karten-Screens 31–46 → 0 px, Describe 176 → 83 px.
  - **Zwei Fallen, beide nur auf TOUCH sichtbar** (headless ohne
    `hasTouch` zeigt sie nicht — der Guard läuft deshalb jetzt in einem
    Touch-Kontext):
    1. `:hover` KLEBT nach dem Tippen am zuletzt berührten Element. Der
       Periwinkle-Zeiger-Ring stand dadurch neben dem grünen Auswahl-Ring.
       Alle Hover-Zustände hängen jetzt an `@media (hover: hover)`.
    2. `html.is-touch .de-nav { display: inline-flex }` überstieg das
       UA-`[hidden] { display: none }` — die „Fertig"-Pille wurde auf dem
       ersten Screen gemalt, obwohl sie `hidden` trug. Globaler Riegel
       `[hidden] { display: none !important }` (dieselbe Falle hatte vorher
       schon den Region-Picker erwischt).
  - Guard erweitert (`verify-stage-light.mjs`, jetzt 5 Abschnitte): ein
    Rahmen/zwei Flächen im Touch-Kontext, `[hidden]`-Regression, Saum-Reserve,
    „die Karte zeichnet selbst nichts", und die Verlaufs-Zählung auf einem
    Screen, der wirklich eine Bestätigung trägt (die erste Fassung war mit
    „0 von höchstens 1" vakuum grün). Alle neuen Checks negativ getestet:
    Defekt wieder eingebaut → Guard schlägt an.
- 2026-07-26 (Owner-Runde 3): **Der Fortschrittsregler wirkte „gimmicky und
  unprofessionell"** — und das war richtig gesehen: fünf Punkte + vier
  Verlaufsbalken + fünf Labels ergaben vierzehn Objekte in einem 20px-Streifen,
  optisch ein Skill-Tree. Der Owner schlug eine „Power-up-Bar" vor und liess
  ausdrücklich Alternativen zu.
  - **Vier Entwürfe wurden IM echten Dock gerendert und verglichen** (nicht am
    Schreibtisch entschieden): (a) eine Zeile aus aktuellem Kapitel + voller
    Schiene, (b) Kapitel-Index mit kurzem Unterstrich, (c) reine Typografie
    („03/05 STOFF"), (d) Kapitel-Index über voller Schiene. Gewonnen hat (d):
    (a) verliert die Orientierung und die satte Schiene wirkte selbst wie ein
    Ladebalken, (b) endete die Linie willkürlich mitten im Streifen, (c)
    gamifiziert über die Bruchzahl und nimmt der Reise den Bogen.
  - **Umgesetzt:** die fünf Kapitel als Zeile, darunter EINE Haarlinie, die bis
    zum aktuellen Kapitel leuchtet. Raster mit fünf gleichen Spalten, damit der
    Füllstand exakt auf einer Kapitel-Kante endet statt irgendwo dazwischen;
    aussen bündig, innen zentriert.
  - **Der Füllstand hängt am PHASEN-BUCHSTABEN (`is-at-a` … `is-at-e`), nie an
    einer Zahl.** Die Reise ist adaptiv — eine Prozentangabe wäre ein
    Versprechen, das sie nicht halten kann. Der bestehende Test „stepper carries
    NO number" bleibt damit wörtlich gültig.
  - **Fortschritt spricht TEAL, nicht Grün.** Am Render standen sonst zwei
    grüne Unterstriche übereinander — der Fortschritt und der aktive
    Uni/Verlauf-Tab — und behaupteten dasselbe. Grün heisst im Studio „deine
    Wahl"; Fortschritt ist keine Wahl, sondern die Lesung der Maschine (der
    kühle mittlere Arm der Palette). Fünf Tonwerte wurden dafür am echten Dock
    verglichen.
  - **Der Kapitelwechsel-Beat wurde gebaut und wieder verworfen.** Ein
    Lichtstoss (`box-shadow`-Glühen) auf der Schiene sah in der Frame-Serie aus
    wie grüner Nebel über der Kante, nicht wie Präzision. Der Wechsel spricht
    jetzt doppelt und ohne Ornament: die Schiene WÄCHST (gemessene Kurve
    20 → 23.9 → 33.7 → 36.9 → 39.1 → 39.9 → 40 % über ~480 ms) und der
    Kapitel-Flash sagt das neue Wort auf der Bühne. Damit ist auch die
    `is-crossed`-Klasse ersatzlos entfallen.
  - **Damit die Schiene wachsen KANN**, baut `updateStepper` den Streifen nicht
    mehr bei jeder Frage neu: ein ersetztes `innerHTML` startet jedes Mal auf
    der Endbreite, die Transition liefe nie. Neu gebaut wird nur, wenn sich die
    Beschriftungen ändern (Sprachwechsel, erster Aufbau); sonst wandern nur die
    Zustandsklassen.
  - **Nebeneffekt:** mit den vier Verlaufsbalken verschwindet der letzte
    Marken-Verlauf ausserhalb der Bestätigung. Der Guard zählt jetzt ALLE
    sichtbaren Flächen statt nur Bedienelemente — die frühere Einschränkung war
    eine Ausrede für genau diese Balken.
- 2026-07-26: **B3 geliefert — aber anders, als dieses Dokument es geplant
  hatte.** Zwei Annahmen von §3 B3 hielten der Prüfung nicht stand:
  - **„Das Makro-Foto blutet VOLLFLÄCHIG in die Bühne" stammt aus der Zeit vor
    B2.** Vollflächig gedacht löscht das Foto die Hohlkehle — und damit steht
    das Stück wieder auf nichts, exakt die Lektion, die B2 teuer gelernt hat.
    Dazu läge eine hochfrequente Textur direkt hinter einer dünnen technischen
    Zeichnung. Gebaut ist stattdessen die **Rückwand**: der Stoff hängt als
    Bahn im oberen Bühnenraum und stirbt vor dem Boden; Kegel, Pool, Hohlkehle
    und Vignette malen unverändert darüber. Das Stück steht davor, die Bühne
    bleibt Bühne, das Foto bleibt Material-Beweis.
  - **„Hover/Fokus auf einer Kachel = Backdrop-Wechsel" gibt es auf dem Telefon
    nicht.** Dort existiert kein Hover, und eine Karte committet sofort — der
    Moment wäre auf dem wichtigsten Gerät schlicht nicht vorhanden gewesen.
    Jetzt führen zwei Wege zum selben Bild: Zeiger-Geräte sehen die Bahn beim
    Zeigen (und sie geht mit dem Zeiger), Touch sieht sie beim Wählen, während
    der Flat das Material annimmt — danach zieht sie sich zurück. Die
    Entscheidung darüber steckt in der reinen, getesteten `materialGesture`.
  - Technisch: **Pseudo-Element statt DOM-Knoten** (`.de-preview::before`),
    weil `render-preview.js` das innerHTML der Bühne bei JEDEM Render ersetzt —
    ein eingehängtes Kind wäre nach dem ersten Morph weg. `::after` ist bereits
    das Filmkorn. Kein `filter`, kein `backdrop-filter`: die Dämpfung kommt aus
    Deckkraft (0.26) und einer vertikalen Maske, die oben UND unten ausblendet
    (oben, weil dort Marke und Masse-Zeile stehen und die helle Stelle eines
    Makro-Fotos von Material zu Material woanders liegt).
  - Alle sieben Materialien wurden als Rückwand gerendert und im Kontaktbogen
    verglichen — der Flat bleibt in jedem Fall lesbar, der Boden intakt.
  - Guard: `verify-stage-light.mjs` Abschnitt 6 (Zeiger-Weg, Touch-Weg,
    z-index hinter dem Stück, Maske stirbt vor dem Boden, Bühnenlicht malt
    weiter, kein Filter). Drei Defekte wurden zur Gegenprobe wieder eingebaut —
    der Guard schlägt bei jedem an.
  - Nebenbefund, den der eigene Test fand: `encodeURIComponent` lässt
    ausgerechnet `( ) '` durch — also genau die Zeichen, mit denen man aus einer
    CSS-`url()` ausbricht. Die Escaping-Tabelle ist jetzt explizit.
  - **Coverage-Korrektur:** `js/thermal-waves.js` fehlte in der
    `.c8rc.json`-Ausschlussliste, obwohl es dieselbe Kategorie ist wie
    `machine.js`/`faden.js`/`facts-mass.js` (Side-Effect-WebGL-Modul ohne
    Exporte, e2e- statt unit-gedeckt) — es kam nur später dazu. Mit der
    Korrektur steigt die gemessene Deckung; der Floor wurde entsprechend
    angezogen (78/80/82 → 79.5/82/85), damit die Ratsche nicht locker wird.
- 2026-07-26 (später, geplanter Review): **B4 (Startpunkt-Galerie) hat einen
  offenen Draft-PR (#464)** — sechs vollständig aufgelöste Startpunkte je
  Archetyp-Richtung nach `category_select`, `subArchFor` liest die
  Silhouetten-Zuordnung aus den bestehenden `effects.weight`-Deklarationen
  (keine zweite Tabelle), Übernahme bei conf 0.55 (unter der
  Entscheidungs-Schwelle, jede echte Antwort überschreibt). Der Autor
  flaggt selbst eine offene Entscheidung: die Galerie beantwortet nichts
  hart, kostet aber einen Screen (17 statt der in §7 gesetzten
  ≤16-Screens-Decke) — der PR bleibt bewusst Draft, bis eine der drei in
  seiner Beschreibung genannten Optionen (17 akzeptieren / Galerie spart
  Fragen, §7 neu verhandeln / Galerie fällt weg) entschieden ist. Damit sind
  B1, B2, B3, B5 geliefert und nur diese eine Produktentscheidung trennt
  B4 vom Abschluss der ganzen Roadmap.
