# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Urban Revolution (revolveurban.com) — Projekt-Regeln (Kurzfassung, zuerst lesen)

> Diese Kurzfassung ist die verbindliche Regel-Ebene. Darunter folgt die
> ausführliche Architektur-/Modul-Referenz — bei Konflikt gilt diese Kurzfassung.

## Arbeitsweise (Grundhaltung — gilt für JEDE Codierung, höchste Priorität)
Präzision und Durchdachtheit vor Schnelligkeit. Eine sorgfältige Lösung
ermöglicht mehr als eine schnelle, oberflächliche — Hast erzeugt Nacharbeit,
Sorgfalt erzeugt Tempo. Konkret, verbindlich:
- **Erst verstehen, dann ändern.** Ursache am echten Artefakt prüfen (Code
  lesen, rendern, Daten/DOM ansehen) — nie raten, nie auf Annahmen patchen.
- **Verifizieren, bevor etwas „fertig" heißt.** Tests, Lint UND echtes
  Rendern/E2E. „Müsste passen" zählt nicht; nur belegt zählt.
- **Bilder/Assets konkret prüfen — nie nur den Code-String.** Ein korrekter
  `url(...)`/`src` im Markup beweist NICHTS. Belegen, dass (a) die Ressource
  lädt (HTTP 200, kein 404 — z. B. via Response-Status im Headless-Browser oder
  `fetch`) UND (b) sie sichtbar gerendert wird (Screenshot). Achtung-Falle:
  relative `url()` in einer CSS-Variable wird relativ zum **Stylesheet** (css/)
  aufgelöst, nicht zum Dokument → root-absolute Pfade (`/js/...`) nutzen.
- **JEDE neue/geänderte Visualisierung, Sektion ODER Animation visuell selbst
  prüfen — bevor sie „fertig" heißt.** Klassen-/State-Checks und zwei Standbilder
  genügen NICHT (damit wurde schon eine kaputte „Animation" für fertig erklärt).
  Pflicht: am echten Render (headless, `scripts/shoot.mjs` bzw. eigenes
  Playwright-Skript) anschauen — und zwar:
  • Statische Sektion → Screenshot Desktop + Mobil (≤ 480 px) ansehen.
  • Bewegung/Übergang → die BEWEGUNG selbst prüfen, nicht den Endzustand:
    dichte Frame-Serie über die volle Dauer (z. B. alle 80–120 ms) ODER den
    animierten Wert in-page samplen (z. B. `clip-path`/`opacity`/`transform`
    alle 100 ms loggen) und die Kurve ansehen. Mehrere Zwischenframes wirklich
    öffnen und beurteilen, ob es flüssig wirkt — nicht nur, ob es „läuft".
  • Ehrlich beurteilen: wirkt es billig/ruckelig/wie ein Sprung → ist es NICHT
    fertig. Erst wenn das Auge (am Frame-Beleg) zustimmt, gilt es als erledigt.
- **Auf Ideen des Users kritisch reagieren — nicht reflexhaft bejahen.** Den
  Vorschlag ernst prüfen, Schwächen/Risiken/Trade-offs offen benennen, bei
  Bedarf begründet widersprechen UND eine eigene, ggf. bessere Alternative
  vorschlagen. Der User will einen mitdenkenden Engineer, kein Ja-Sagen.
- **Eine Sache sauber zu Ende** statt mehrere halb. Scope klein halten,
  Bestehendes nicht brechen.
- **Im Muster des Codes bleiben** (bestehende Systeme/Tokens/Konventionen
  nutzen, statt parallele Mechanismen danebenzusetzen).
- **Nach jedem sinnvollen Schritt committen** (Web-Sessions können neu starten
  und Uncommittetes verwerfen).
- **Bei Unklarheit fragen** statt annehmen (siehe Konventionen unten).
- **Ehrlich berichten:** was geprüft wurde, was offen ist — keine geschönten
  „grün"-Meldungen.

## Was das ist
Statische Marken-Website (HTML + Vanilla-JS-Module + CSS, KEIN Framework).
Die Vision: eine vollautonome Kreislauf-Fabrik. Weggeworfene Fast-Fashion wird automatisch
sortiert, und autonome Roboter fertigen daraus das vom Kunden auf der Website entworfene
Einzelstück nach Maß — gegen Fast Fashion, für echtes Textil-Recycling. Vom Menschen entworfen,
autonom gefertigt, ein Stück für einen Menschen, ohne Überproduktion.
Tagline „Made for one. Not for all." · AI · AUTONOM · KREISLAUF. Deploy: Vercel. Sprachen: DE + EN.

## Architektur (nicht umbauen)
- Kein Build-Framework. Klassische `<script>`-Module im `window.X = …`-Muster, in index.html eingebunden. **Zwei Ausnahmen** (ES-Module, bewusst): `js/community-sphere.js` und die eigenständige Galerie-Seite `gallery/` — beide nutzen three.js (nur als ESM ausgeliefert) über die Import-Map + dynamisches `import()` (Lazy-Load). Sonst KEINE Module/Bundler einführen, ohne zu fragen.
- **Landing-Experience** (`js/landing.js`, GSAP via CDN) ist die Startseite: Manifest → Kreislauf-Sektion → Zahlen → magnetischer Kreis-CTA. Das eigentliche **UR-Create-Studio** (`#studio`) ist `hidden`, bis ein CTA/Anker (`#design`/`#ownership`/`#measure`/`#production`/`#faq`) oder ein Share-/Deep-Link es per `revealStudio()` aufklappt. Progressive Enhancement: ohne JS/GSAP alles sichtbar; mit `prefers-reduced-motion` keine Bewegung; nur `html.fx` bekommt die volle Animation.
- **UR-Create-Verdrahtung** (`js/ur-create.js`, Side-Effect, rein additiv) verbindet Hero-Showcase, Ownership-Moment, Community-Hub (`/api/gallery`), Problem-Karten, Join (Formspree) und `make-real` mit der Engine — ohne app.js/flow.js zu ändern.
- Design-Engine unter `js/design-engine/` (engine, dna, condition, inference, render-preview, summary, flow, garment-svg, share, telemetry, modalities/, content/*.json). Datengetrieben: Nodes/Archetypen/Attribute/Bilder liegen in JSON.
- State: `state-manager.js` (localStorage, Wiederaufnahme). KI: `ai.js` → Replicate (FLUX) / Anthropic-Proxy. Maße: `measurements.js` (9 Körpermaße). i18n: `i18n.js`. Telemetrie: `js/design-engine/telemetry.js` → `/api/track` (+ Admin-Dashboard `insights.html`). Fehler: Sentry (Loader im `<head>`).

## Design-System — NUR bestehende :root-Tokens
- Hintergrund Midnight-Navy `#0A1622`; Akzent-Verlauf Ozean-Blau `#2F86B3` → Teal `#2FAE9E` → Aqua `#7EE0CF` (`--gradient`, „Ocean Depths v2 / Reclaimed Light" — die helleren Stops der Instagram-Slides, Drive → Slide Design System).
- Fonts (drei Register): Fraunces (Display-Serif/Headlines, variabel mit optischer Grösse, Lora als Fallback) + Poppins (Body) + JetBrains Mono (Eyebrows/Labels/Einheiten/Marquee — die „Maschinen"-Stimme neben dem „Handwerks"-Serif). Selbst gehostet in `/assets/fonts/` (DSGVO, kein Google-CDN); neue Faces via `scripts/fetch-fonts-extra.mjs`. KEINE weiteren Fonts (kein Inter, kein Playfair).
- **Kupfer-Dramaturgie (Slides → Site):** Akt I (Preloader → Hero-Weave → Manifest → #facts Beat 1+2) trägt die warme Kupfer-Familie — `--warm-thread` #C9906F (Akt-I-Faden, fil-seam[1], #pivot-line), `--warm-deep` #8A5F4C, `--warm-bright` #ECC39F, `--gradient-warm` (Protokoll-Zahlen). Das Chaos des Abfalls ist warm/menschlich; Teal/Aqua wird ERST nach der Wende ausgegeben (#facts Beat 3 Bergungs-Faden / #pivot-Arc). Canvas-rgb-Basen: Kupfer 201,144,111 · Kupfer-tief 138,95,76 · Aqua 126,224,207.
- Akzent-Wärme in Akt II: keine. Der Identitäts-Beat (`#your-style`), der als einziger `--accent-warm` trug, wurde entfernt — Akt II bleibt vollständig „Ocean Depths". Das Token `--accent-warm` (#D99B78, Text-tauglich 7.7:1) bleibt als reservierte Stufe der Kupfer-Familie in `:root` definiert, ist aber derzeit ungenutzt.
- Gefühl: ruhig, cineastisch, eine Frage groß, viel Negativraum; Übergänge ≤ 250 ms; kein Layout-Sprung.

## Harte Regeln (immer)
- Mobile-first. Höhen in `svh`/`dvh` bzw. dem gepinnten `--svh`, NICHT roh `vh`. Safe-Area via `env(safe-area-inset-*)`. Auf iPhone-Breite (≤ 480 px) testen.
- Barrierefrei: Tastatur, Fokus-States, ARIA, `prefers-reduced-motion`.
- ALLE sichtbaren Strings über `i18n.js`, DE + EN.
- Datengetrieben bleiben: neue Fragen/Optionen/Archetypen über JSON, nicht hartkodieren.
- Design-Engine-Vorschau: saubere technische Silhouette (Fashion-Flat). Den Flat NIE über das Hero-Foto legen; Foto/KI-Render erst bei Konvergenz/„Generieren". Silhouetten aus Basis-Flats über Transforms morphen, NICHT Geometrie aus Formeln. Schulter = breitester Punkt, Ärmel immer sichtbar.
- Bestehende Flows (Maße, KI, i18n, State) nicht brechen. Keine Console-Fehler.

## Secrets
- Replicate-/Anthropic-Token NIE committen, NIE in den Chat — nur via gitignored `.env` oder Vercel-Env. `.env` steht in `.gitignore`.
- Sentry-DSN ist öffentlich/clientseitig und darf im Code stehen.

## Workflow
- Erst kurzer Plan, dann inkrementell. Nach jeder Stufe auf Mobilbreite prüfen, keine Console-Fehler.
- Jede Änderung über einen PR mit Vercel-Preview-Deployment; nicht direkt auf `main` pushen. Visuelle Änderungen IMMER selbst am Render prüfen (Headless Desktop + Mobil ≤ 480 px). Merge-Gate ist risikobasiert: Niedrigrisiko-Visuell → autonom mergen, sobald CI grün + Screenshots stimmen; Hochrisiko-Visuell (Animation, Scroll/Sticky/`svh`, iOS-Safari-Layout, große Redesigns) → vor dem Merge auf echtem iPhone prüfen lassen. (Details: Auto-merge policy weiter unten.)
- Lokal: `python3 -m http.server 8080` (statisch) oder `npm run dev` (→ `npx serve .`). Die `/api/*`-Edge-Functions laufen nur via `vercel dev` / auf Vercel. Sentry (Loader im `<head>`) + Fehler-Tags (`area:ai|engine|preview|vto|measure|3d`) sind ohne lokalen Aufwand aktiv; Session-Replay bewusst aus.
- CI (Pflicht, grün vor Merge): `deno lint` (`test`), `npm run build` + `npm test` (`validate`, Workflow „Tests"), `validate-css`, `validate-html`, `validate-assets` (Bild-Budget), `e2e` (Headless-Browser-Smoke + axe-a11y) und `coverage` (c8-Floor) — siehe „Deployment" unten.

---


## Project

Urban Revolution is a single-page web app for the vision of a **fully
autonomous circular factory**: discarded fast fashion is sorted automatically,
and autonomous robots craft each customer's design from the reclaimed materials.
The user writes a free-text prompt describing a garment, the app turns it into
a structured design concept, captures the user's measurements, renders a
live 2D technical-flat preview (the data-driven Design Engine), and produces
a printable production spec sheet that drives the autonomous factory.

> **AI's role (load-bearing — do not drift):** The **user designs** every
> piece; the design and style are theirs. AI does **only** two things:
> autonomously **sorts/reclaims** discarded textile, and autonomously
> **manufactures** the piece. Copy must never say or imply that AI designs,
> shapes, or reimagines the garment. (A future AI assistant may *help the
> user articulate their own idea*, but never authors it.)

> **Stage (load-bearing):** Pre-launch vision — nothing is manufactured yet.
> Copy may describe the future vision but must not assert current production,
> partners, wages/traceability, prices, or delivery times as live facts, and
> must not present a working purchase. CTAs convert to "join / be first," not
> "buy / order," until production and checkout actually exist.

> **No fabricated proof (pre-launch — load-bearing):** Never add testimonials,
> customer quotes, finished-garment or before/after photos, delivery countries,
> returns/alteration processes, or firm price/lead-time claims — no production,
> commerce, or accounts exist yet. Trust is built only from real assets: the
> live studio, the cited fast-fashion evidence (`#facts`), the client-side
> privacy guarantee, and the forward-looking vision. Frame what *will be*, never
> what *is*. (This is why `export.js` emits planned strings, not concrete
> CHF/lead-time numbers, and why `CONFIG.PRODUCTION_ESTIMATES` stays internal.)

The **landing experience** (`js/landing.js`, GSAP) is the front door, told as
a **two-act dramaturgy ("Die Linie und der Kreis")**: preloader logo-draw →
hero with a **warp thread-field** (`initWeave`, `#weave-canvas`) that responds
to the cursor like **plucked strings** (nearby threads pin to the pointer and
damp-oscillate back on release) → **Act I THE LINE** (manifesto word-scrub
thesis + mono verbs band → counted-up stats as the line's protocol, kickers
Produzieren/Wegwerfen/Zurück + coda). A **single continuous machine thread**
(`initActOneThread`, the `.lp-linie` rail) is born in the preloader and
physically carries the eye through Preloader → Hero → Manifesto → `#facts`,
handing over with a clip-drawn seam + knot (`.lp-linie-seam*`) → the pinned
**`#pivot` turn** (the one
big question; a straight line scroll-scrubs into a circle via `initPivot` /
exported `pivotBendPath`, hinge sentence + mission statement) → **Act II THE
MACHINE** (`#machine`, `js/machine.js`): ONE section merges the former
loop/AI/how beats around a running **engineering simulation of the planned
autonomous line** (SVG `#mSvg`: bale intake → NIR scanner bridge with live
analysis chip → diverter into remake/panel/fibre streams → glass remake cell
that cuts the visitor's own studio design → outbound hanger rail). Honesty is
drawn in: the unsolved sewing module is dashed, a SIMULATION stamp rides every
zoom, the `[STATUS: VISION]` meta line stays. Four station cards (Getragen →
Zurückgewonnen → Entworfen → Wiedergeboren, with the Alle/KI/Du/KI tags) zoom
the drawing's camera (viewBox interpolation, desktop) or scroll it (mobile);
below follow the AI-role contrast (line vs. circle, "Die KI entwirft nie") and
the user's 4 steps as a compact protocol rail (`how.*` keys). A StateManager
bridge makes the cell cut the visitor's garment type + colour with a
deterministic file number once a design exists → the mono handoff line → a
magnetic circle CTA (the page's geometric conclusion). (The former
`#your-style` identity beat between machine and finale was removed; its
"the design stays yours" message lives on inside `#machine`'s AI-role
contrast and the four user steps.)
The **UR-Create studio**
(`#studio`) stays `hidden` until a CTA/anchor or a share/deep-link reveals it —
an orb/CTA click opens it through a **threshold portal** (`portalReveal`),
deep-links and no-fx stay instant.
The page closes with a
**community sphere** — a WebGL globe (`js/community-sphere.js`) whose inner
wall holds floating creations.

**Stack:** vanilla HTML / CSS / JS. No bundler, no transpiler. The
`package.json` only exists so Vercel runs `npm install` to pull
`@vercel/speed-insights` (+ `css-tree`/`htmlhint` dev deps for CI); the app
itself has no build step. MediaPipe, GSAP, three.js and Vercel analytics
load from CDNs at runtime (three.js + GSAP via an `importmap`). Seven Vercel
Edge Functions (`api/`) proxy the AI/storage calls.
UI copy is **bilingual German/English** (`I18N`; language resolves at load as
`?lang=` URL param (persisted) → saved choice → `navigator.language` → `de`;
`toLocaleDateString` follows the active locale).

## Layout

```
index.html              # The main app; landing + studio + sections, import map + script tags
impressum.html          # German legal page (Impressum)
datenschutz.html        # German privacy policy (DSGVO + Swiss)
insights.html           # Design-Engine telemetry dashboard (admin, behind ?key=, noindex)
404.html                # Branded bilingual not-found page (self-contained, Vercel serves on 404)
gallery/                # Standalone WebGL sphere gallery study (own index.html/js/css, ES module)
css/styles.css          # Single stylesheet; dark theme, CSS vars in :root
manifest.webmanifest    # PWA manifest · icon.svg · robots.txt · sitemap.xml
api/
  generate-design.js    # Edge Function — Anthropic proxy for design JSON
  preview-design.js     # Edge Function — Replicate (FLUX 1.1 Pro) garment render
  try-on.js             # Edge Function — Replicate proxy for photoreal VTO
  gen-image.js          # Edge Function — KEY-gated raw FLUX text→image (build the image library)
  gallery.js            # Edge Function — community creations (DNA strings) → Upstash Redis
  track.js              # Edge Function — aggregate-only journey telemetry → Upstash Redis
  waitlist.js           # Edge Function — waitlist signups → Upstash Redis (frontend retired)
js/
  config.js             # Source of truth — constants, presets, validators (window.CONFIG)
  i18n.js               # Bilingual DE/EN dictionary + DOM hydration (window.I18N)
  state-manager.js      # Event-driven store (window.StateManager) — single source of truth
  ai.js                 # Prompt → design JSON. Edge proxy + local fallback (window.AI)
  measurements.js       # Body measurement state, presets, size/fabric/seam math
  pose.js               # MediaPipe Pose Landmarker + skin/hair sampling
  export.js             # Builds spec data, downloads JSON/HTML, simulates orders
  preferences.js        # localStorage usage history → personalised suggestions
  library.js            # localStorage saved designs (max 20, + optional VTO url)
  preview-fallback.js   # Client-side $0 studio SVG when the paid render is down
  focus-trap.js         # Accessible focus containment for overlays (window.FocusTrap)
  animations.js         # IntersectionObserver scroll-reveal (side effect)
  spec-view.js          # DOM-safe spec-sheet fragment renderer (window.SpecView, no innerHTML)
  app.js                # Main controller — wires DOM events to StateManager
  flair.js              # Pointer/scroll micro-interactions + easter egg (side effect)
  landing.js            # Landing-experience controller + studio reveal (GSAP, side effect)
  ur-create.js          # Wires UR-Create sections (hero/ownership/community/join) to the engine
  ambient-ticker.js     # Live cited textile-waste counter (kg/sec, side effect)
  facts-mass.js         # #facts „Die Masse": 3 Canvas-Partikel-Beats + Live-CO₂-Zähler (side effect)
  faden.js              # „Der Faden": 4 scroll-gezeichnete Nähte verbinden die Akt-II-Sektionen (side effect)
  machine.js            # #machine: Ingenieur-Simulation der autonomen Linie (side effect)
  community-sphere.js   # WebGL community globe (ES module — three.js + GSAP, lazy)
  design-engine/        # Data-driven adaptive journey + 2D technical-flat preview
assets/
  og-image.png          # Social share image · logo.png · hero-*.jpg · vto-*.jpg · presets/
  story/                # Documentary photos (Acts I–IV) — see assets/story/CREDITS.md
vercel.json             # Hosting config — no build, /api/ edge functions, headers (security + caching)
docs/
  VISUAL-ROADMAP.md     # Landing visual roadmap & diagnosis (handoff note, read with CLAUDE.md)
  STUDIO-UX-ROADMAP.md  # Studio-journey UX roadmap — all 10 slices shipped; §12
                        # (status + hard-won pitfalls) is REQUIRED reading before studio work
SECURITY.md             # GitHub starter template, never filled in (placeholder versions/text)
scripts/                # CI: validate-css.mjs · e2e.mjs (headless-browser smoke) ·
                        # build/QA: shoot* (incl. shoot-journey.mjs, the studio walkthrough),
                        # build-image-library, gen-presets, strip-hero-bg, audit*,
                        # verify-* (permanent per-beat regression checks), check-* (headless)
.github/workflows/      # CI: deno(test), test.yml(validate = build-no-op + npm test),
                        # validate-css, validate-html, validate-assets, e2e, coverage
                        # — see Deployment
```

Unit tests: 22 offline suites in `test/` (DNA roundtrip, seam formulas, AI
fallback + assembled-design contract, export scaling, i18n parity + t()
interpolation, coded API-error → message, state, persistence, share-link
encode/decode, pose math, garment-flat builder, DOM-safe spec-view renderer,
journey-flow helpers, render-preview mappers, $0 preview fallback, client
telemetry/DNT, waste-ticker math, landing studio-reveal predicate, API error
mapping + input validation),
run via `npm test` in CI (test.yml). No network needed. A separate `npm run e2e`
(`e2e.yml`) drives the **real site in headless Chromium** end-to-end (see the CI
table below). CI additionally runs
`deno lint` (configured via `deno.json`, with browser-incompatible rules
excluded) plus structural HTML/CSS validators.

## Section & animation map (where each surface lives + how to verify it)

Page order top→bottom, with the file/function that drives each surface and the
`npm run shoot` name that frames it (desktop + mobile). Use this to jump
straight to the right file instead of grepping. Animation rules are global:
`html.fx` gets the full motion, `prefers-reduced-motion` shows everything
static, and without JS/GSAP all content is still visible (progressive
enhancement). Verify any motion by **sampling frames over the whole duration**,
not two stills (project rule).

| Anchor / id            | What it is                                   | Driven by                                                        | Motion                                  | `shoot`     |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- | ----------- |
| `#loader` `.lp-loader` | Preloader logo-draw                          | `landing.js` `initLoader` (`.lp-mark-arc/-dashes/-needle`)        | GSAP stroke-draw (transient)            | —           |
| `#top` `.lp-hero`      | Hero: warp thread-field + headline (plucked-string cursor) | `landing.js` `heroIntro` + `initWeave` (`#weave-canvas`); Act I rail via `initActOneThread` (`.lp-linie`) | GSAP intro + canvas warp weave (cursor pins/plucks threads) | `hero`      |
| `#manifesto`           | Manifesto word-scrub                         | `landing.js` `buildManifesto` (`.w` spans)                       | GSAP ScrollTrigger scrub                | —           |
| `#facts` `.lp-stats`   | Cited fast-fashion evidence — „Die Masse": 3 full-height canvas-particle beats | `landing.js` `initCounters` (`[data-count]`) + `ambient-ticker.js` + `facts-mass.js` (`html.fxb-go`, `.is-live` je Beat) | count-up + live kg/CO₂ odometer + particle plume/mound/tracer (canvas, offscreen-paused) | `facts`     |
| `#pivot` `.lp-pivot`   | Pinned "Die Wende" — line bends into circle  | `landing.js` `initPivot` / `pivotBendPath` (`#pivot-pin/-line/-arc`) | GSAP ScrollTrigger pin + path-morph scrub | `pivot`     |
| `#machine` `.lp-machine` | Act II machine: engineering simulation of the autonomous line + station cards + AI-role + user steps (merged former loop/aidr/how beats) | `js/machine.js` (side effect; SVG `#mSvg`, station cards `.lp-m-st`, StateManager bridge) + `landing.js` `initReveals` | boot rail-draw → item flow → NIR chip → cell cycle (CUT→SEW→FIN→LAB→HANG); camera viewBox zoom per station; reduced-motion = complete static frame. Verify: `scripts/verify-machine.mjs` | `machine`   |
| `.fil-seam` ×3         | „Der Faden" — Nähte zwischen den Akt-II-Sektionen | `js/faden.js` (Clip-Reveal-Scrub, `html.fil-go`)                | scroll-gezeichnete Naht + wanderndes Glint (rAF, IO-gegatet)   | —           |
| CTA orb                | Magnetic circle CTA → reveals studio         | `landing.js` `initOrb` (`#cta-orb`)                              | pointer-magnet; click opens the studio through the threshold portal | —           |
| `#studio` → `#design`  | UR-Create studio (hidden until revealed)     | reveal: `landing.js` `revealStudio`/`shouldRevealForHash` + threshold portal `portalReveal`/`shouldPortal`; journey: `design-engine/flow.js` (`#engine-host`) + `ur-create.js`; live 2D flat: `design-engine/garment-svg.js` + `render-preview.js` | portal reveal → weave draw-in → choreographed question swaps (see Design-Engine section) | `studio`    |
| `#ownership`           | Ownership moment (save/share/publish, VTO)   | `ur-create.js`; VTO via `api/try-on.js`                          | appears once a design exists            | —           |
| `#measure`             | 9 body measurements + pose photo             | `measurements.js`, `pose.js` (MediaPipe, client-side)            | diagram lines per field                 | —           |
| `#production` `.spec-sheet` | Printable production spec                | `app.js` `updateProductionPreview` → `spec-view.js`              | rebuilt on every state change           | —           |
| `#faq`                 | FAQ accordion                                | static markup + `app.js`                                         | —                                       | —           |
| `#community` `.community-sphere` | WebGL community globe              | `community-sphere.js` (**ES module**, three.js/GSAP, lazy)       | drag/inertia rotate, lazy on scroll-in  | `community` |

The `shoot` column lists what `npm run shoot -- <name>` captures; surfaces
marked `—` aren't dedicated shoot targets (mid-scroll/transient or only live in
a flow) — capture them ad-hoc with `node scripts/shoot.mjs <url> <prefix>`
against a running server, or add the section to `SECTIONS` in
`scripts/shoot-sections.mjs`.

**Two reveal systems, don't confuse them:** the landing beats use
`[data-lp-reveal]`, swept in by `landing.js` `initReveals` (the cinematic
landing timeline). Everything else uses the generic `[data-reveal]` /
`[data-reveal-stagger]` IntersectionObserver in `animations.js`. Same idea,
different attribute and owner — match the surrounding section's attribute when
adding a revealed element.

## Design Engine & studio journey (`js/design-engine/`)

The studio's decision journey is **data-driven, not a hard-coded wizard**:
`engine.js` picks the next question node by priority × information gain from
the per-category JSON (`content/nodes/*.json` — `intent` + the six garment
types); `dna.js` holds the growing, confidence-weighted design DNA;
`inference.js` derives archetypes; `condition.js` evaluates `when` gates on
nodes/regions; `flow.js` renders the journey into `#engine-host` and owns the
experience choreography; `garment-svg.js` + `render-preview.js` draw the live
parametric flat. Question surfaces are **modalities** (`modalities/`): cards,
thisOrThat, slider, ranking, colorGradient, visuals, and `regions` — the
"Detail-Atelier" hotspot board (anchors from `GarmentSVG.regionAnchors()`,
per-option close-up thumbnails via `GarmentSVG.detailCrop()`, the value the
piece already carries marked "aktuell"; ONE confirm commits the merged picks,
untouched regions stay open for inference). New questions/choices/regions go
into the JSON, never into code — `engine.js` needed zero changes for the
`regions` modality.

The **experience layer is staged, not form-like** (all motion `html.fx`-gated;
`prefers-reduced-motion` gets a complete static experience): the CTA-orb click
opens the studio through a **threshold portal** (`landing.js`
`portalReveal`/`shouldPortal`, transitionend-synced disc); the first flat
materialises via the **weave beat** (genesis nebula → outline draw → seams →
panel fills; `gs-*` layer classes in `renderFlat`); question swaps are
two-phase choreographed (`deStepOut`/`deStepIn`, commits blocked mid-swap,
350 ms `isGuardedTap` double-tap guard); on ≤ 480 px a **docked mini-preview**
mirrors every render/morph frame (hoisted to `<body>` — `position: fixed` is
hijacked inside the revealed `#design`, see pitfalls); the refine screen is
the crescendo (typed-on sentence, mutation directions named by their delta via
`conceptDeltas`, one EVOLVE); the generate wait plays the **sewing handoff**
(thread field returns as running stitches, name plate types on, Ownership
slides in ~750 ms after). Measurements personalise the flat via
`bodyFactors(measurements)` (±8 % shoulder/waist/hip multipliers through
`renderInto` `opts.body`).

**Verify studio changes at the real render:** `scripts/shoot-journey.mjs
[viewport] [category]` walks any branch deterministically (every question
screen + weave frames → `screenshots/journey/`, fails on page errors) — use
it for every studio change, and walk **all six categories** for data-driven
surfaces (chips/photos/flats/anchors are per-branch; "it's category-agnostic
code" is a hypothesis, not a verification). The permanent
`scripts/verify-*.mjs` checks (weave, threshold, refine, sewing, atelier,
a11y-studio, …) guard the shipped beats — run the relevant one and extend it
when you change its feature. Before touching the studio, read
`docs/STUDIO-UX-ROADMAP.md`: all ten roadmap slices are shipped (§12 status
table maps each beat to its PR), and its **hard-won pitfalls (§12)** — the
~13-fps headless container (sample rAF curves, don't screenshot sub-300 ms
motion), the hijacked `position: fixed`, tap-guard traps, deno-CDN CI flakes —
cost real debugging time to rediscover.

## Module conventions

Classic-script JS files use the **IIFE-with-global** pattern. Each exposes
exactly one global:

```js
const Foo = (() => { /* … */ return { publicApi }; })();
window.Foo = Foo;
```

| File              | Global                  | Loaded as       |
| ----------------- | ----------------------- | --------------- |
| `config.js`       | `window.CONFIG`         | classic         |
| `i18n.js`         | `window.I18N`           | classic         |
| `state-manager.js`| `window.StateManager`   | classic         |
| `ai.js`           | `window.AI`             | classic         |
| `measurements.js` | `window.Measurements`   | classic         |
| `pose.js`         | `window.Pose`           | classic         |
| `export.js`       | `window.Export`         | classic         |
| `preferences.js`  | `window.Preferences`    | classic         |
| `library.js`      | `window.Library`        | classic         |
| `preview-fallback.js`| `window.PreviewFallback` | classic      |
| `focus-trap.js`   | `window.FocusTrap`      | classic         |
| `animations.js`   | (none — side effect)    | classic         |
| `spec-view.js`    | `window.SpecView`       | classic         |
| `app.js`          | (none — controller)     | classic         |
| `flair.js`        | (none — side effect)    | classic         |
| `landing.js`      | (none — side effect)    | classic         |
| `ur-create.js`    | (none — side effect)    | classic         |
| `ambient-ticker.js`| (none — side effect)   | classic         |
| `facts-mass.js`   | (none — side effect)    | classic         |
| `faden.js`        | (none — side effect)    | classic         |
| `machine.js`      | (none — side effect)    | classic         |
| `community-sphere.js`| (none — side effect) | **ES module** (`type="module"`) |

The **live garment preview** (inside the studio) is a **data-driven 2D
technical flat** built by the `js/design-engine/` modules (classic scripts,
see below) — no WebGL there. WebGL/three.js is used only for the marketing
**community sphere** (`community-sphere.js`) and the standalone **gallery
study** (`gallery/`), both lazy-loaded ES modules. Those two are the *only*
ES modules in the project — everything else stays classic IIFE-with-global.

**Load order in `index.html` matters** — every classic module reads
`window.CONFIG` at IIFE evaluation time, so `config.js` must load first.
`i18n.js` must load before `app.js` / `export.js` (they call `I18N.t()`).
`state-manager.js` must precede `app.js` and the design-engine modules (they
subscribe to its events). The bottom-of-body order is:

```
config → i18n → state-manager → ai → measurements →
pose → export → preferences → library → preview-fallback → focus-trap → animations →
design-engine/* (dna … flow) → spec-view → app → flair → ur-create → ambient-ticker →
facts-mass → faden → machine → [importmap] → gsap + ScrollTrigger (CDN) → landing →
community-sphere (module)
```

Follow the IIFE-with-global pattern for new classic code; don't introduce a
bundler or new module system without surfacing it as a question first.

## Internationalisation (`i18n.js`)

The whole UI is **DE/EN bilingual**. `window.I18N` (loaded right after
`config.js`) holds a dictionary for both languages and hydrates the DOM:

- Static markup carries `data-i18n` / `data-i18n-html` /
  `data-i18n-placeholder` / `data-i18n-aria-label` attributes; `I18N.apply()`
  walks the DOM and swaps text/HTML/placeholder/aria-label by key.
- Dynamic strings (toasts, spec sheet, suggestions) call `I18N.t(key, vars)`
  directly — never hardcode user-facing copy.
- `I18N.setLang(lang)` persists to `localStorage` (`urev_lang`), updates
  `<html lang>`, re-applies the DOM, and fires a `language:change` event.
  `app.js` listens and re-renders dynamic UI.

When you add user-facing copy, add a key to **both** `de` and `en` in
`i18n.js` and reference it via `data-i18n*` or `I18N.t()`.

## The true cost (fast-fashion evidence band)

The landing stats section `<section class="lp-stats" id="facts">` is the
**hard, cited evidence** behind the emotional film: three sourced numbers
(Ellen MacArthur Foundation / UNEP — < 1 % of clothing recycled into new
clothing, a truckload of textiles dumped/burned every second, ≤ 8 % of
global CO₂), counted up on reveal (`data-count`), closing with a linked
sources line (`landing.stats_src_html`). Static markup, bilingual
(`landing.stat*` / `landing.stats_*` i18n keys, plus legacy `cost.*` keys
still referenced elsewhere), entrance via the landing `[data-lp-reveal]`
pattern (reduced-motion shows everything immediately). Keep the numbers
honest and the sources line intact.

The figures are reinforced live by **`js/ambient-ticker.js`** — a side-effect
module that turns the "1 truckload every second" fact into a running
odometer: textile waste at ~2'918 kg/sec (92 Mio. t/year ÷ seconds/year)
stepping up since page load, in one dramatic counter (`.cost-ticker`) plus
compact "Live … kg" badges beside other section numbers. Swiss thousands
grouping (`1'234'567`), bilingual via `ticker.*` i18n keys.

**`js/facts-mass.js`** stages the three numbers as „Die Masse" — three
full-height canvas-particle beats (one shared ash-like particle language;
beats 1–2 glow copper per the slide dramaturgy, aqua answers only in
beat 3's rescue thread):
a never-ending CO₂ plume behind the ≤8 % with a live "≈ +38 t seit du hier
bist" counter (1.2 Gt/yr ÷ seconds, always marked ≈), a waste mound onto
which one garment silhouette falls and stacks per real second (a mountain
of clothes) beside the kg odometer, and 100 tracers of which exactly one
— a single glowing piece of clothing, lifted out — escapes (= the <1 %). Classic IIFE
side-effect module (no global), mirrors ambient-ticker.js. Progressive
enhancement is load-bearing: canvases are `aria-hidden` (the meaning lives
in the adjacent real-text number + caption), the default CSS/SVG state is
the final resting scene, and all motion is opt-in under `html.fxb-go` /
per-beat `.is-live` — no-JS and reduced-motion show everything calm and
complete (only the textual CO₂ ticker keeps counting, like the kg ticker).
rAF pauses offscreen and on hidden tabs; canvas DPR is capped at 2.

## AI design generation (`ai.js` + `api/generate-design.js`)

`AI.generateDesign(prompt, type)` resolves a design concept in this order:

1. **Server proxy (production):** POST `{ prompt, type }` to
   `/api/generate-design` (Vercel Edge Function). The function calls
   Anthropic's Messages API (`claude-opus-4-8`) with the
   `ANTHROPIC_API_KEY` env var — the key **never reaches the browser**.
   Without the key it returns a 500 with a setup message.
2. **Browser-direct (demo only):** if `window.URBAN_REVOLUTION_API_KEY` is
   set, `generateWithClaude` calls `https://api.anthropic.com/v1/messages`
   directly with `anthropic-dangerous-direct-browser-access: true`. Do
   **not** present browser-side keys as a production pattern.
3. **Local fallback:** a keyword-based generator (`*_DICT` maps —
   `COLOR_DICT`, `MATERIAL_DICT`, `TYPE_DICT`, `FIT_DICT`,
   `PATTERN_KEYWORDS` — plus per-type `generateName` /
   `generateConstructionNotes`). `COLOR_DICT` maps German colour words
   (`schwarz`, `weiß`, `rot`, …) to the palette.

On a failed remote call, `ai.js` dispatches an `ai-fallback` `CustomEvent`
on `window` so `app.js` can toast the reason. Both the edge function and
`generateWithClaude` expect/return this exact JSON shape (don't change one
side without the other, and without `generateDesign`'s consumer):

```
{ name, description, color, material, fit, tags, constructionNotes }
```

**Setup:** set `ANTHROPIC_API_KEY` in Vercel → Project Settings →
Environment Variables.

## Photorealistic Try-On (`api/try-on.js`)

After generating a design and uploading a pose photo, the user can click
"Fotorealistische Vorschau" which calls the `/api/try-on` Edge Function.
It forwards `{ userPhoto, designPrompt }` to Replicate's
`flux-kontext-pro` (instruction-following image editor) and returns the
generated image URL.

- **Setup:** set `REPLICATE_API_TOKEN` in Vercel env vars. Without it (or on
  any upstream failure) the function logs the real reason server-side and
  returns a **neutral, coded** error to the browser (never leaks
  billing/credit/auth state); the rest of the app keeps working.
- **Safe errors:** upstream Replicate failures (402 insufficient credit,
  401/403 auth, 429, 5xx, generation failure) are mapped to a `code`
  (`service_unavailable` / `rate_limited` / `failed`) which `app.js`
  (`codedErrorMessage`) turns into a friendly localised message via the
  shared `err.*` i18n keys. The raw upstream text only goes to
  `console.error` (Vercel runtime logs). Same for `preview-design.js`.
- **Privacy:** unlike measurement extraction (100 % client-side), VTO sends
  the photo to Replicate's US servers. The disclaimer below the button
  states this; the user opts in by clicking. The photo lives only in memory
  (`StateManager.userPhoto`), never persisted.
- **Cost:** ~$0.04 per generation; only on explicit click.

## Design Preview / garment render (`api/preview-design.js`)

The cheap "do I like it?" gate **before** the photo-based try-on. Inside
the design card (`#design-preview-slot`, wired in `app.js`) the user can
click "Entwurf visualisieren"; `app.js` `generateDesignPreview()` POSTs
`{ designPrompt }` (the same garment description `buildVtoPrompt` builds,
no user photo) to `/api/preview-design`. The Edge Function wraps it in a
**ghost-mannequin studio brief** and calls Replicate's **FLUX 1.1 Pro**
text-to-image (swap the single `MODEL_ENDPOINT` const to change engines,
e.g. Recraft V3). Same success/`pending`/`error` response shape and
`Prefer: wait=20` polling fallback as `try-on.js`.

- **Why:** most users can judge a design from a no-photo studio render and
  only reach for the (more expensive, photo-based) `/api/try-on` once the
  piece appeals — saving wasted try-on runs and the privacy cost of sending
  their photo.
- **Setup:** reuses `REPLICATE_API_TOKEN` (no new env var).
- **Rate limit:** client-side `urev_preview_count` in localStorage,
  `PREVIEW_LIMIT = 30`/browser, charged only on a billable success (mirrors
  the VTO limit). **Cost** ~$0.04/render, only on explicit click.
- **Caching:** the render URL is stored on the in-memory design object and,
  if the design is saved, on its `Library` entry (`previewImageUrl`,
  `Library.setPreviewImage`); library tiles fall back to it when there's no
  VTO image. Restored on recall so re-views are free.
- **$0 fallback (`preview-fallback.js`):** if the paid render is unavailable
  (no token/credit, rate-limited, network down, pending timeout), the slot
  never dead-ends — `app.js` calls `PreviewFallback.svg({type, color,
  material, pattern, name})` to draw a fully client-side **studio
  illustration** of the garment (the six type silhouettes, filled with the
  chosen colour + a volume gradient, material sheen and woven pattern
  overlay). Free, instant, offline; carries a neutral "Stilvorschau" badge
  and a retry button to re-attempt the photoreal render. No billable count is
  charged for it.

## Waitlist backend (`api/waitlist.js`) — frontend retired

The standalone pre-launch page (`waitlist.html`) was **removed**; the backend
Edge Function + Upstash store are **kept** for a possible relaunch (re-add a
frontend that POSTs to it). `POST /api/waitlist { email, consent }`
stores the (lowercased) email in an **Upstash Redis** set (`urev:waitlist`,
auto-dedupes) plus a timestamp hash, and returns `{ ok, status:
"joined" | "already", count }`. `GET /api/waitlist` returns the live
`{ count }` (SCARD); the page only shows a number once it crosses
`COUNT_THRESHOLD` (50), otherwise "Be among the first".

- **Setup:** add the Upstash Redis integration in Vercel (Marketplace →
  Upstash, free tier, **EU region** for DSGVO residency — the privacy page
  states EU). It auto-injects `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN`. Talked to over its REST API with `fetch` (no
  npm package, edge-native).
- **Graceful:** without the env vars `GET` returns `{ count: null }` (page
  hides the number) and `POST` returns the neutral coded error
  (`service_unavailable`) — same code pattern as the Replicate functions.
- **DSGVO:** consent checkbox is required (server rejects
  `consent !== true` with `consent_required`); only email + timestamp are
  stored; covered in `datenschutz.html` §7.

## Community gallery (`api/gallery.js` + `js/ur-create.js` + `js/community-sphere.js`)

The community surface shares **published creations as compact DNA share
strings** — the same URL-safe base64 format as `js/design-engine/share.js`,
**no images, no PII** (the optional name is a free-chosen pseudonym).

- **Backend (`api/gallery.js`):** Upstash Redis over REST (edge-native, like
  `waitlist.js`), a `urev:gallery` ring buffer (max 60, 24 per GET).
  `GET /api/gallery → { ok, items: [{ d, name, by, ts }] }` (newest first);
  `POST /api/gallery { d, name?, by? }`. `validateDna` (exported, pure,
  unit-testable) rejects empty / over-long / non-base64 strings. Graceful:
  without Upstash env, GET returns `{ ok, items: null }` (client shows the
  **curated fallback** `content/gallery-curated.json`) and POST returns the
  neutral coded error.
- **Publish (`js/ur-create.js`):** Save · Share · Publish live in the
  Ownership-Moment (appears once `StateManager.currentDesign` exists).
  Publish POSTs the DNA string to `/api/gallery` and fires a
  `urev:published` CustomEvent — the sphere picks the piece up immediately
  (the old tile-grid hub was retired; the sphere IS the community surface).
- **Community sphere (`js/community-sphere.js`, ES module):** the WebGL globe
  in `#community`. Creations float on the inner wall; drag/arrow
  keys rotate with Lenis-style easing; tap opens a detail overlay; the join
  flow is a CTA + overlay. Lazy-loads three.js/GSAP and images only when the
  section scrolls into view. Data sources: `/api/gallery` items with an
  `img` field first, then **published DNA pieces rendered by the real engine
  (`GarmentSVG` via the classic globals) as technical flats on dark
  stage cards** — the studio's stage language inside the globe; without any
  live DNA entries the **curated fallback** `content/gallery-curated.json`
  steps in; topped up with `content/community-showcase.json` (36
  engine renders). The detail overlay of a DNA piece shows the rendered
  stage card and offers **REMIX** (share URL + full reload — the load-time
  `DesignShare.read()` path, same as opening a shared link; the generic
  create-CTA steps back). A piece published **after** the sphere booted
  enters the wall where the viewer is looking, slightly in front of the
  existing cards (own slot — slot recycling would hide it exactly behind
  card 0 at full occupancy); published **before** boot it is queued and
  mixed in at boot. Guarded by `scripts/verify-sphere-remix.mjs`.
  Scroll stays free (no wheel hijack; `touch-action: pan-y`).
  Reduced-motion + coarse-pointer aware.

## Community join (Formspree) — `js/ur-create.js`

The "join the community" email signup posts to **Formspree**
(`FORMSPREE_ENDPOINT`), not the retired waitlist backend — no own server, no
Upstash config. The endpoint is a **public client-side URL (not a secret)**
and lives in the code; while the placeholder is set the button reports
neutrally that signup isn't live yet (console hint only). Email + consent +
interests.

## Build-time image generator (`api/gen-image.js`)

A one-off, **KEY-gated** raw text→image route used to build the Design-Engine
image library (hero / mood / material / preview tiles) without exposing the
Replicate token. Calls FLUX 1.1 Pro with the same server-side
`REPLICATE_API_TOKEN`, but passes the prompt **verbatim** (no ghost-mannequin
wrapper) so atmospheric/macro prompts render. Gated by `IMAGE_GEN_KEY`; if
unset the route is **disabled (403)** — it never reveals whether Replicate is
configured. Driven by `scripts/build-image-library.mjs` against
`content/img-library.json`. Safe to remove once the library is built.

## Telemetry & insights (`js/design-engine/telemetry.js` + `api/track.js` + `insights.html`)

`DesignTelemetry.track(event, props)` emits **aggregate-only** journey signals
(no PII, no photo/measurement data), respects Do-Not-Track, and sends to
Vercel Web Analytics (`window.va`) **and** best-effort beacons to
`/api/track`. The edge function increments **whitelisted** event counters
(`ALLOWED` set) + sanitised node ids in Upstash (`urev:tel:*`);
`buildCommands` / `sanitiseId` are exported and pure (unit-testable).
`POST` is best-effort (204, never errors to the client); without Upstash it's
silently swallowed. `GET ?key=<TELEMETRY_KEY>` returns the aggregates for the
**admin `insights.html`** dashboard (noindex, on-brand via `styles.css`). The
question logic does **not** learn across users on its own — these aggregates
are the basis for *manual* node tuning.

## Persistence (`preferences.js`, `library.js`)

Both are thin `localStorage` wrappers, validated through `CONFIG`:

- `Preferences` tracks the user's garment-type / colour / material choices
  and recent prompts to personalise suggestions.
- `Library` saves up to 20 generated designs (optionally with a VTO image
  URL) for recall/reorder.

## State flow

`window.StateManager` (`js/state-manager.js`) is the single source of
truth. Keys: `currentDesign`, `currentType`, `currentColor`,
`currentMaterial`, `currentFit`, `measurements`, `avatar`, `skinTone`,
`hairColor`, `userPhoto`. `set(key, value)` validates via `CONFIG.validate*`
(throws on invalid), tracks a 50-entry history, and emits both
`${key}:change` and `state:change` events.

`app.js` is a thin controller — it reads/writes only through the
`S.get`/`S.set` helper (which wraps `StateManager` and swallows validation
errors with a console warning). DOM events mutate state;
`updateProductionPreview` is the single funnel that rebuilds the spec sheet
from scratch on every change (no diffing); it renders the spec fragments via
`window.SpecView` (`js/spec-view.js`), a **DOM-safe** renderer that builds
nodes with `createElement`/`textContent` instead of `innerHTML` (no string
interpolation of user/AI values → no spec-sheet XSS; locale-aware quoting).
The 3D controller subscribes to
specific `${key}:change` events and never reads from `app.js`.

## Centralized configuration (`config.js`)

Single source of truth:

- `GARMENT_TYPES` — 6 supported types (`tshirt`, `hoodie`, `shirt`,
  `pants`, `jacket`, `dress`)
- `MATERIALS` — material key → German label (7 entries)
- `COLORS` — brand palette (key → hex, 10 entries)
- `PATTERNS` — 9 fabric patterns
- `MEASUREMENT_PRESETS` — `S` / `M` / `L` / `XL`
- `MEASUREMENT_CONSTRAINTS` — per-field `{ min, max, label }`, used by
  `validateMeasurement`
- `PRODUCTION_ESTIMATES` — fabric factors, seam formulas per garment type,
  default lead time, CHF price range
- Validators: `validateMeasurement`, `validateGarmentType`,
  `validateMaterial`, `validateColor` (throw on invalid input)

`Measurements.PRESETS` / `FIELDS` / `LABELS` derive from `CONFIG`; the
seam/fabric math reads `CONFIG.PRODUCTION_ESTIMATES`. **Edit `config.js`
first** — other modules pick up the change.

## Materials and measurements

Seven materials: `cotton`, `linen`, `denim`, `wool`, `fleece`, `silk`,
`polyester` — used in `<select id="material-select">`, as `MATERIAL_DICT`
keys in `ai.js`, and mapped to sheen/finish in the Design Engine flat
(`design-engine/garment-svg.js`).

Nine body measurements: `height`, `weight`, `chest`, `waist`, `hips`,
`shoulder`, `arm`, `inseam`, `neck`. Defined as keys of
`CONFIG.MEASUREMENT_CONSTRAINTS`; `Measurements.FIELDS` / `LABELS` derive
from that. Adding a field: numeric `<input>` in `index.html` with `id`
matching the field name; the key in `MEASUREMENT_CONSTRAINTS` and every
`MEASUREMENT_PRESETS` entry.

## Pose detection

`pose.js` lazy-loads MediaPipe's Pose Landmarker (Google, GPU delegate)
from a jsDelivr CDN on first use, detects 33 body landmarks in a full-body
photo, and estimates the 9 measurements using the user's height as the
reference scale. Processing is **100 % client-side** — the photo never
leaves the device. The DSGVO claim in `pose.js` is load-bearing; preserve
it if you modify the flow.

## Styling

All styles in `css/styles.css`. Design system uses CSS variables on
`:root` (`--bg*`, `--text*`, `--accent*`, `--warm*`, `--gradient*`,
`--radius*`, `--shadow*`). Reuse variables instead of hardcoding hex. The
Ocean Depths v2 `--gradient` (#2F86B3 → #2FAE9E → #7EE0CF on `--bg`
#0A1622) is core brand; the copper family (`--warm-thread` #C9906F,
`--warm-deep` #8A5F4C, `--warm-bright` #ECC39F, `--gradient-warm`) carries
Act I — waste/chaos is warm, aqua is only spent after the Wende (see
Design-System section above).
A global `prefers-reduced-motion`
reset, a `:focus-visible` ring, and a skip-link target (`#main-content`)
are in place.

The `@media print` block at the bottom hides everything except
`.spec-sheet` — `Export.print()` depends on it. Update the print selector
if you wrap the spec sheet in a new container.

## Conventions

- **Ask before assuming (standing instruction from the user).** When a request
  is ambiguous — scope, target value, which file/feature, delete vs. keep —
  ask a focused multiple-choice question (`AskUserQuestion`) *before* acting,
  instead of guessing and proceeding. The user prefers a quick clarifying
  question over a wrong assumption. (Doesn't apply to obvious defaults you can
  verify in the code yourself.)
- **Bilingual user-facing copy.** Code identifiers English; visible strings
  go through `i18n.js` (DE + EN keys); HTML comments and legal pages German.
- **No frameworks.** Direct DOM (`document.getElementById`,
  `querySelectorAll`). No jQuery, no virtual DOM.
- **No build pipeline for app code.** Anything requiring compilation (TS,
  JSX, SCSS, bundling) breaks the "static site, drop on any host" model —
  surface as a question first.
- **Validate at the boundary.** Route user input and AI fields through
  `CONFIG.validate*` so bad values can't poison the spec sheet.
- **Toast feedback** via `showToast(message, type)` in `app.js`, not
  `alert`.
- **Money** is CHF (Swiss Francs); see
  `CONFIG.PRODUCTION_ESTIMATES.priceRange`.

## Running locally

```bash
python3 -m http.server 8080
# or
npm run dev          # → npx serve .
```

`npm install` is not needed to run the app locally. Vercel Web Analytics and
Speed Insights load at runtime from Vercel's own `/_vercel/insights/script.js`
and `/_vercel/speed-insights/script.js` endpoints (served only on Vercel, via
script tags in `index.html` — no npm import). The `/api/*` edge functions only
run on Vercel (or `vercel dev`).

## Deployment

- **Vercel** (`vercel.json`) — no build, root is output. Speed Insights +
  Web Analytics load from Vercel's `/_vercel/*` script endpoints (script tags
  in `index.html`). The seven `/api/` functions run as Edge Functions. **This is the
  only deploy target** (live at `revolveurban.com`). GitHub Pages was dropped
  — the repo no longer has a Pages workflow.
- **Security headers** (`vercel.json` `headers`, applied to `/(.*)`):
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` locking unused
  powerful features (`camera`/`microphone`/`geolocation`/`browsing-topics` — the
  app uses none) and a **frame-ancestors-only** CSP (`'self' https://vercel.live`
  — clickjacking protection that still lets the Vercel preview-feedback tool
  frame previews). Deliberately **no** script/style/connect CSP: the app pulls
  GSAP/three.js/MediaPipe/Sentry/Vercel from CDNs, so a strict CSP would need a
  full allowlist — out of scope here. HSTS is already set by Vercel.
- **Caching headers** (`vercel.json`): HTML and `/` are `no-store` — browsers
  never serve a stale page after a deploy. CSS/JS referenced **with a `?v=`
  query** (e.g. `ur-create.js?v=…`, `facts-mass.js?v=…`) are
  `immutable` for a year — **bump the `?v=` value in `index.html` whenever you
  change such a file**, or returning visitors keep the old one. CSS/JS without
  `?v=` are `must-revalidate` (cheap 304s).

The functional PR checks (check name = job id):

| PR check       | File               | Workflow name | What it runs                                        |
| -------------- | ------------------ | ------------- | --------------------------------------------------- |
| `test`         | `deno.yml`         | "Deno"        | `deno lint` (Deno 2.x)                               |
| `validate`     | `test.yml`         | "Tests"       | `npm run build` (no-op) + `npm test` (22 offline suites) |
| `validate-css` | `validate-css.yml` |               | css-tree check                                       |
| `validate-html`| `validate-html.yml`|               | htmlhint (index, impressum, datenschutz, insights, 404)   |
| `validate-assets`| `validate-assets.yml`|           | image-weight budget (`scripts/check-asset-budget.mjs`) — anti-bloat ceilings per path |
| `e2e`          | `e2e.yml`          | "E2E"         | `npm run e2e` — headless-Chromium browser smoke test (`scripts/e2e.mjs`) |
| `coverage`     | `coverage.yml`     | "Coverage"    | `npm run coverage` — c8 over the unit suites, fails below the `.c8rc.json` floor |

The `coverage` job runs `c8 npm test` and enforces a floor (lines/statements
73 %, branches 77 %, functions 72 % — a few points below the current ~76 %
baseline, so it ratchets up, never down). Scope lives in `.c8rc.json`: `js/**` +
`api/**`, **excluding** the DOM/WebGL/animation controllers (`app.js`,
`ur-create.js`, `community-sphere.js`, `flair.js`, `animations.js`, `landing.js`,
`design-engine/modalities/**`) — those are e2e-covered, not unit-covered, so
counting them would mislead. c8 is a normal devDependency (no browser, no
network); `coverage/` is gitignored. Raise the floor as coverage improves.

These seven are the **entire** `.github/workflows/` set. The `e2e` job installs
playwright-core + Chromium **+ `@axe-core/playwright`** at job time (`npm install
--no-save playwright-core @axe-core/playwright axe-core` + `npx playwright install
chromium`, mirroring the SessionStart hook) so the Vercel deploy stays lean —
nothing browser-related lands in `package.json`. It boots the real site on a
self-contained Node static server and asserts the flows the offline suites can't
reach (clean boot, studio reveal via CTA **and** `#dna` deep-link, the
data-driven journey mounting + rendering a question, DE/EN toggle, mobile
no-overflow, zero uncaught app errors) **plus an axe-core a11y gate** — no
serious/critical WCAG 2 A/AA violations on the landing + revealed studio (desktop
+ mobile); moderate/minor are reported, not blocking (axe covers ~30-40% of WCAG,
so it's the floor, not the ceiling). Desktop + mobile screenshots are
uploaded as a CI artifact. Removed template
clutter: `deploy.yml` + `jekyll-gh-pages.yml` (redundant Pages deploys),
`npm-publish*.yml` (never ran), `copilot-setup-steps.yml` (broken scan), and
`jekyll-docker.yml` (GitHub starter; built a `_site` that was never deployed —
Vercel serves the repo root). `webpack.yml` was renamed to `test.yml` (it never
ran webpack; it is the test runner).

### Checking deploy / CI status yourself (standing instruction from the user)

Before asking the user to verify something you can verify yourself, check it.
The tools are available — use them instead of delegating the lookup back:

- **Always surface the Vercel preview link directly (standing instruction).**
  Whenever you push a branch / open or update a PR, put the branch's preview
  URL right in your reply — don't make the user dig for it. **Don't hand-build
  the URL from the branch name:** Vercel truncates + hashes long slugs (e.g.
  branch `claude/docs-preview-link` → `…-git-claude-do-75851c-…`). Get the exact
  alias from Vercel `list_deployments` → the deployment's `meta.branchAlias`
  (or copy it from the Vercel bot's PR comment), and verify HTTP 200 before
  quoting it.
- **Deploy status / live URL:** the Vercel MCP tools (`list_deployments`,
  `get_deployment`, `get_deployment_build_logs`, `get_runtime_logs`). Team
  `jack's projects` (`team_6vAACRftikFNNglCvAGxBRku`), project
  `urban-revolution-3ugz` (`prj_nByd8AePhWuduPtx0HQCTiIyxX7N`). The live
  production domains are **`revolveurban.com`** (+ `www.`) and the alias
  `urban-revolution-3ugz-jack-s-projectsfutur.vercel.app` — note the bare
  `urban-revolution-3ugz.vercel.app` is **not** aliased (404). Confirm a commit
  is live by matching `meta.githubCommitSha` + `state: READY`.
- **CI / PR / review status:** the GitHub MCP tools (`pull_request_read`
  with `get_check_runs` / `get` / `get_diff`, etc.).
- **Visual rendering:** the SessionStart hook installs headless Chromium.
  Fastest loop — **`npm run shoot`** boots its own static server and writes
  desktop + mobile PNGs of every key section (`hero`, `machine`, `facts`, `pivot`,
  `studio`, `community`) to `screenshots/` (gitignored) in one
  command; it reveals the studio via the `#design` deep-link and CDN-routes
  GSAP/three.js so animations and the WebGL globe actually render. Scope it with
  `npm run shoot -- hero,studio`. For the studio journey itself use
  `node scripts/shoot-journey.mjs [viewport] [category]` (walks every question
  screen, fails on page errors). For an ad-hoc single URL against a server you
  already run, `node scripts/shoot.mjs <url> <prefix>` still works. Use these to
  self-check layout instead of asking for a screenshot.

Only ask the user for things that genuinely require their hardware or eyes —
e.g. confirming an **iOS-Safari-specific scroll/toolbar bug on a real
device**, which headless Chromium cannot reproduce.

## Git

Default branch is `main`; don't push directly. Development happens on
feature branches. Don't open PRs unless explicitly asked.

### Branch naming (standing instruction from the user)

Keep the **one-task → one-branch → one-PR → squash-to-main** flow — each PR
gets its own Vercel preview, so work goes to `main` directly per task. Do **not**
create long-lived "integration" branches (e.g. a `visuals/` branch that collects
several PRs before main): that breaks per-PR previews, bundles unrelated changes
into one squash, and adds needless merge overhead on a continuously-deployed
static site.

Instead, **categorise via a naming prefix** on the normal per-task branch so
`git branch | sort` clusters by intent for free. Use this small fixed set:

| Prefix    | For                                                            |
| --------- | -------------------------------------------------------------- |
| `visual/` | look & feel: colours, spacing, imagery, animation             |
| `layout/` | structure/responsive: sections, grids, mobile/`svh`, overflow |
| `copy/`   | user-facing text & i18n (DE/EN), legal copy                   |
| `engine/` | design-engine logic, DNA, flats, journey/flow                 |
| `api/`    | edge functions (`api/*`), proxies, storage                    |
| `fix/`    | bug fixes (any area)                                           |
| `chore/`  | CI, docs, deps, tooling, refactors                            |

Pick the **dominant** intent when a change spans areas (most do) — one prefix,
not a stack. Keep a short kebab-case slug after it (`visual/hero-reframe`,
`copy/manifesto-headline`, `fix/scroll-jump`).

**Branch cleanup is automatic — do not try to delete branches from a session.**
Merged branches are removed server-side by GitHub's repo setting *Settings →
General → Pull Requests → "Automatically delete head branches"* (enabled for
this repo). Keep that toggle on; it's what stops the remote list from filling
with dead branches, and it works on merge with no push involved. Claude Code
**web/agent sessions cannot delete remote branches** — the git relay returns
`403` on delete-pushes (`git push --delete` / `:refs/heads/…`), the raw
`GITHUB_TOKEN` isn't enabled for repo ops, and the GitHub MCP has no
delete-branch tool. So never promise to delete a branch from a session; rely on
the auto-delete setting. A one-off backlog (branches merged before the toggle
was on) must be pruned from a local clone with push rights:
`git push origin --delete <branch> …` (verify each branch's PR was *merged*
first — squash-merge means git's own `--merged` check is unreliable, and a
reused branch name may carry later unmerged commits).

### Auto-merge policy (standing instruction from the user)

> **Aktualisiert (risikobasiertes Gate, siehe Projekt-Regeln · Workflow oben):**
> Maßgeblich ist das *Risiko* der Änderung, nicht „ist es UI". JEDE visuelle
> Änderung wird vorher selbst am echten Render geprüft (Headless Desktop **+
> Mobil ≤ 480 px**; bei Bewegung die Animation samplen, nicht nur Endzustände).
> - **Niedrigrisiko-Visuell** (Copy, ein Label, Farben/Abstände, statisches
>   Element) → autonom mergen, sobald CI grün ist und die eigenen Screenshots
>   stimmen. Kein Warten.
> - **Hochrisiko-Visuell** — was Headless-Chromium nicht belegen kann:
>   Animations-/Übergangs-Feel, Scroll-/Sticky-/`svh`-Toolbar-Verhalten,
>   iOS-Safari-spezifisches Layout, große strukturelle Redesigns → PR öffnen,
>   Vercel-Preview verlinken und VOR dem Merge auf dem echten iPhone prüfen lassen.
>
> Rein nicht-visuelle Änderungen (Docs, CI, `api/`-Logik, Tests) mergen wie unten
> beschrieben autonom ohne Rückfrage.

**Default: Claude merges its own PRs autonomously — do NOT ask, do NOT wait
for confirmation, do NOT just report "CI is green" and stop.** The user has
said this repeatedly and emphatically. The moment a PR Claude opened has all
functional CI green (see below), squash-merge it. This applies to **every**
change type — CSS, copy, docs, JS logic, `api/` functions, build/CI — unless
the user explicitly says "don't merge / let me review this one" for a
specific PR. When you open a PR, the job isn't done until it's merged (or CI
is red and you're fixing it). Subscribing to a PR means driving it to merge,
not narrating that you're waiting.

A PR is mergeable when **all functional CI checks are green** — `test`,
`validate`, `validate-css`, `validate-html`, `validate-assets`, `e2e`,
`coverage` (all seven run on every PR) — and no review comment
requests a change. The advisory **"Vercel Agent Review"** is non-blocking;
address its points if valid, but it need not be green to merge. If any
functional check is red, fix it first; never merge red CI.
