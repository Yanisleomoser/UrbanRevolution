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
