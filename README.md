username.github.io

AI-gestütztes Mode-Atelier: Kunden beschreiben ihr Wunschkleidungsstück per
Text-Prompt, die KI generiert ein Designkonzept, ein parametrisches
3D-Modell zeigt das Kleidungsstück in den eigenen Körpermaßen, und ein
produktionsfertiges Spec-Sheet kann direkt an die Schneiderei gesendet
werden.

## Features

- **AI Design-Generator** — Freie Text-Prompts werden zu strukturierten
  Designkonzepten (Name, Farbe, Material, Passform, Tags, Schneider-Notizen).
- **6 parametrische 3D-Modelle** — T-Shirt, Hoodie, Hemd, Hose, Jacke, Kleid.
  Passen sich live an die eingegebenen Körpermaße an (Brust, Taille, Hüfte,
  Schulter, Arme, Schritt).
- **Material-Realismus** — Roughness/Metalness pro Materialtyp (Baumwolle,
  Leinen, Denim, Wolle, Fleece, Seide, Polyester).
- **Live-3D-Vorschau** — Three.js Szene mit Orbit-Controls, Wireframe-Modus,
  einblendbare Maßlabels, mehrere Kameraperspektiven.
- **Produktions-Spec-Sheet** — Automatisch berechnete Konfektionsgröße,
  Stoffmenge, Nahtlänge, Preisspanne. Export als JSON oder druckbares HTML.

## Architektur

```
/
├── index.html              # Single-Page-Webapp
├── css/styles.css          # Komplettes Styling (Dark Theme, Gradient Accents)
└── js/
    ├── app.js              # Haupt-Controller, verbindet alle Module
    ├── ai.js               # Prompt-Analyse + optional Claude API
    ├── garment3d.js        # Three.js Szene + parametrische Garment Builder
    ├── measurements.js     # Maße-Management + Presets + Berechnungen
    └── export.js           # JSON/HTML/Print/Order-Export
```

Keine Build-Schritte — alles läuft als statische Site mit ES-Modulen über
Import Map (Three.js via CDN).

## Lokal ausführen

```bash
python3 -m http.server 8080
# oder
npx serve .
```

Dann `http://localhost:8080` im Browser öffnen.

## Optional: Claude API anbinden

Ohne API-Key generiert ein lokaler, semantischer Fallback die Designs
(funktioniert komplett offline). Mit Key fragt die App die Anthropic
Claude API für reichere, kontextsensitive Designkonzepte:

```html
<script>
  window.URBAN_REVOLUTION_API_KEY = 'sk-ant-...';
</script>
```

In Produktion sollte der Key serverseitig gehalten und über einen Proxy
geroutet werden — der direkte Browser-Aufruf ist nur für die Demo gedacht.

## User Flow

1. **Design**: Prompt eingeben (oder eine Inspiration wählen), Kleidungstyp
   bestimmen, generieren. Farbe/Material/Fit nachjustieren.
2. **Maße**: Körpermaße eingeben oder ein Preset (S/M/L/XL) laden.
3. **3D-Vorschau**: Das 3D-Modell aktualisiert sich live. Drehen, zoomen,
   Maße einblenden.
4. **Produktion**: Spec-Sheet prüfen und herunterladen, drucken, oder
   simuliert an die Produktion senden.
