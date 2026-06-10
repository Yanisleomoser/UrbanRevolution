# Urban Revolution

**Made for one. Not for all.** — KI-Couture-Atelier für maßgeschneiderte Mode aus geretteter Faser recycelter Alttextilien.

**Live:** [revolveurban.com](https://revolveurban.com)

---

Urban Revolution ist eine Single-Page-Webapp — ein „AI Couture Atelier". Der Nutzer
beschreibt sein Wunschkleidungsstück per Text oder über eine adaptive Design-Reise; die
KI macht daraus ein strukturiertes Designkonzept, eine live morphende 2D-Technik­zeichnung
(Fashion-Flat) zeigt das Stück, neun Körpermaße werden erfasst, und ein produktionsfertiges
Spec-Sheet kann an die Schneiderei gehen. Der Einstieg beginnt mit einem Manifest und einer
zitierten Fakten-Sektion zur Fast-Fashion-Problematik.

Komplett zweisprachig (Deutsch/Englisch). Stack: reines HTML/CSS/JS ohne Bundler oder
Build-Schritt; gehostet auf Vercel, KI-Aufrufe laufen über Edge Functions in `api/`.

## Features

- **AI-Design-Generator** — Freie Text-Prompts werden zu strukturierten Designkonzepten
  (Name, Beschreibung, Farbe, Material, Passform, Tags, Schneider-Notizen). Serverseitig
  über die Anthropic Claude API (`api/generate-design.js`); ohne Key greift ein lokaler,
  semantischer Offline-Fallback.
- **Interaktive Design-Reise** — Eine adaptive, datengetriebene Fragenstrecke (This-or-That,
  Karten, Slider, Ranking, Hotspot, Farbverlauf). Jede Entscheidung verformt **live** eine
  saubere 2D-Technikzeichnung (Fashion-Flat); ein Reife-Ring zeigt den Fortschritt.
- **Maßerfassung** — Neun Körpermaße, manuell oder per MediaPipe-Pose aus einem Ganzkörper­-
  foto geschätzt (100 % client-seitig, DSGVO-konform — das Foto verlässt das Gerät nicht).
- **Fotorealistische Vorschau** — Optionaler Studio-Render des Entwurfs (FLUX 1.1 Pro) und
  fotorealistische Anprobe am eigenen Foto (Replicate), beide über Edge Functions.
- **Produktions-Spec-Sheet** — Automatisch berechnete Konfektionsgröße, Stoffmenge, Naht­-
  länge und Preisspanne (CHF). Export als JSON oder druckbares HTML.
- **Ocean-Depths-Design-System** — Midnight-Navy mit Ozean-Blau/Teal/Aqua-Akzent, Display-
  Serif Lora + Body-Sans Poppins; mobile-first, barrierefrei, `prefers-reduced-motion`.

## Architektur

```
/
├── index.html              # Single-Page-Atelier (Manifest · Fakten · Design · Maße · Vorschau · Produktion · FAQ)
├── impressum.html          # Impressum · datenschutz.html (DSGVO) · insights.html
├── manifest.webmanifest    # PWA-Manifest · icon.svg
├── css/styles.css          # Komplettes Styling (Ocean-Depths-Dark-Theme, :root-Tokens)
├── api/                    # Vercel Edge Functions (laufen nur auf Vercel / `vercel dev`)
│   ├── generate-design.js  # Anthropic-Proxy (claude-opus-4-8) → Design-JSON
│   ├── preview-design.js   # Replicate FLUX 1.1 Pro → Studio-Render
│   ├── try-on.js           # Replicate → fotorealistische Anprobe
│   ├── gen-image.js        # Bild-Generierung für die Design-Engine-Bibliothek
│   ├── waitlist.js         # Warteliste → Upstash Redis
│   └── track.js            # Telemetrie-Endpunkt
└── js/
    ├── config.js           # Single source of truth — Konstanten, Presets, Validatoren
    ├── i18n.js             # Zweisprachiges DE/EN-Wörterbuch + DOM-Hydration
    ├── state-manager.js    # Event-basierter Store (Single source of truth)
    ├── ai.js               # Prompt → Design-JSON (Edge-Proxy + lokaler Fallback)
    ├── measurements.js     # 9 Körpermaße, Presets, Größen-/Stoff-/Naht-Mathematik
    ├── pose.js             # MediaPipe Pose Landmarker — Maße aus Foto (client-seitig)
    ├── export.js           # Spec-Sheet: JSON-/HTML-/Druck-Export
    ├── preferences.js · library.js · preview-fallback.js · animations.js · flair.js
    ├── ambient-ticker.js   # Live-Abfall-Zähler in der Fakten-Sektion
    ├── app.js              # Haupt-Controller — verdrahtet DOM-Events mit dem State
    └── design-engine/      # Datengetriebene Design-Reise + 2D-Flat (kein WebGL/3D)
        ├── flow.js · engine.js · dna.js · condition.js · inference.js
        ├── garment-svg.js  # Parametrische Fashion-Flats
        ├── render-preview.js · summary.js · share.js · telemetry.js
        ├── modalities/     # cards · thisOrThat · slider · ranking · hotspot · colorGradient · visuals
        └── content/        # Nodes/Archetypen/Attribute + Bild-Bibliothek (JSON-getrieben)
```

Kein Build-Schritt — alles läuft als statische Site. (`npm install` zieht nur Vercel
Analytics/Speed-Insights; die App selbst hat keinen Bundler.)

## Lokal ausführen

```bash
python3 -m http.server 8080
# oder
npm run dev          # → npx serve .
```

Dann `http://localhost:8080` öffnen. Die `/api/*`-Edge-Functions laufen nur auf Vercel
bzw. via `vercel dev`; ohne sie greift der lokale Offline-Fallback und die App bleibt
voll bedienbar.

## KI anbinden (Claude API)

In Produktion läuft die Design-Generierung **serverseitig** über die Edge Function
`api/generate-design.js`, die die Anthropic Claude API (`claude-opus-4-8`) mit dem
`ANTHROPIC_API_KEY` aufruft — der Key bleibt auf dem Server und erreicht den Browser nie.

```
Vercel → Project Settings → Environment Variables → ANTHROPIC_API_KEY
```

Ohne Key generiert ein lokaler, semantischer Fallback die Designs (komplett offline).
Die fotorealistischen Renders (`preview-design.js`, `try-on.js`) nutzen
`REPLICATE_API_TOKEN`. Ein direkter Browser-Key (`window.URBAN_REVOLUTION_API_KEY`)
existiert nur für Demos — nicht für Produktion.

## User Flow

1. **Design** — Per adaptiver Design-Reise durchklicken (oder direkt einen Prompt
   eingeben); Kleidungstyp, Farbe, Material und Passform formen sich live im 2D-Flat.
2. **Maße** — Neun Körpermaße eingeben oder ein Preset (S/M/L/XL) laden — alternativ
   per Foto schätzen.
3. **Vorschau** — Der Fashion-Flat aktualisiert sich live; optional ein fotorealistischer
   Studio-Render oder eine Anprobe am eigenen Foto.
4. **Produktion** — Spec-Sheet prüfen und als JSON/HTML herunterladen oder drucken.

## Entwicklung

```bash
npm test              # Engine · Core · AI · Export · i18n · State · Persistence · API
npm run validate:css  # css-tree-Strukturprüfung
npm run validate:html # htmlhint
```

CI (grün vor Merge): `deno lint` (`test`), `npm run build` + `npm test` (`validate`),
`validate-css`, `validate-html`. Einziges Deploy-Ziel ist **Vercel** (revolveurban.com).
