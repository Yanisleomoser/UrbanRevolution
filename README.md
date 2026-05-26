username.github.io

AI-gestütztes Mode-Atelier: Kunden beschreiben ihr Wunschkleidungsstück per
Text-Prompt, die KI generiert ein Designkonzept, ein parametrisches
3D-Modell zeigt das Kleidungsstück in den eigenen Körpermaßen, und ein
produktionsfertiges Spec-Sheet kann direkt an die Schneiderei gesendet
werden.

## Features

- **AI Design-Generator** — Freie Text-Prompts werden zu strukturierten
  Designkonzepten (Name, Farbe, Material, Passform, Tags, Schneider-Notizen).
- **Maßerfassung** — manuell eingebbar oder per MediaPipe-Pose aus einem
  Ganzkörperfoto (100% client-seitig, DSGVO-konform).
- **Produktions-Spec-Sheet** — Automatisch berechnete Konfektionsgröße,
  Stoffmenge, Nahtlänge, Preisspanne. Export als JSON oder druckbares HTML.

> **3D-Vorschau:** wird derzeit von Grund auf neu aufgebaut. Die alte
> Implementierung wurde entfernt, da sie strukturelle Probleme hatte
> (Monolith, Rebuild-everything, doppelte GLBs für unterschiedliche Avatare).

## Architektur

```
/
├── index.html              # Single-Page-Webapp
├── css/styles.css          # Komplettes Styling (Dark Theme, Gradient Accents)
└── js/
    ├── app.js              # Haupt-Controller, verbindet alle Module
    ├── ai.js               # Prompt-Analyse + optional Claude API
    ├── config.js           # Single source of truth — Konstanten, Validatoren
    ├── measurements.js     # Maße-Management + Presets + Berechnungen
    ├── pose.js             # MediaPipe Pose Landmarker — Maße aus Foto
    ├── export.js           # JSON/HTML/Print/Order-Export
    └── state-manager.js    # Generischer event-basierter Store (für Neuaufbau)
```

Keine Build-Schritte — alles läuft als statische Site.

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
