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
├── models/                 # CC-BY 4.0 GLB-Avatare (siehe unten)
│   ├── CesiumMan.glb       # ~480 KB · männliche Avatare
│   ├── BrainStem.glb       # ~3.0 MB · weibliche Avatare
│   └── RiggedFigure.glb    # ~49 KB · Backup-Mannequin
└── js/
    ├── app.js              # Haupt-Controller, verbindet alle Module
    ├── ai.js               # Prompt-Analyse + optional Claude API
    ├── garment3d.js        # Three.js Szene + GLB-Avatar-Loader + parametrische
    │                       # Garment Builder
    ├── measurements.js     # Maße-Management + Presets + Berechnungen
    └── export.js           # JSON/HTML/Print/Order-Export
```

## 3D Avatar Models

Die 3D-Vorschau verwendet vorgerigte, realistische Menschen-Modelle aus
dem **Khronos glTF-Sample-Models** Repository:
<https://github.com/KhronosGroup/glTF-Sample-Models>

| Datei              | Lizenz       | Verwendung                  |
|--------------------|--------------|------------------------------|
| `CesiumMan.glb`    | CC-BY 4.0    | Männliche Avatar-Presets    |
| `BrainStem.glb`    | CC-BY 4.0    | Weibliche Avatar-Presets    |
| `RiggedFigure.glb` | Apache 2.0   | Fallback wenn andere fehlen |

Pro Geschlecht gibt es 3 Körperbau-Varianten (Schlank/Durchschnitt/Athletisch
bzw. Schlank/Durchschnitt/Kurvig). Die Variation entsteht durch unterschiedliche
xz-Skalierung des gleichen Basis-Modells. Die eingebaute Default-Kleidung der
Modelle (T-Shirt, Hose) wird zur Laufzeit anhand der Mesh-Namen ausgeblendet,
damit das parametrische Design ohne Überlagerung sichtbar wird.

Falls die GLB-Dateien fehlen oder das Laden fehlschlägt, fällt die App auf
ein prozedurales Schaufensterpuppen-Modell zurück (Toast benachrichtigt
darüber).

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
