# CLAUDE.md

Guidance for AI assistants working on the Urban Revolution repository.

## Project

Urban Revolution is a single-page web app — an "AI couture atelier." The
user writes a free-text prompt describing a garment, the app turns it into
a structured design concept, captures the user's measurements, and
produces a printable production spec sheet for a tailor.

**Stack:** vanilla HTML / CSS / JS. No bundler, no transpiler. The
`package.json` only exists so Vercel runs `npm install` to pull
`@vercel/speed-insights`; the app itself has no build step. MediaPipe
and Vercel analytics load from CDNs at runtime. UI copy is German
(`lang="de"`, `toLocaleDateString('de-DE')`).

> **3D preview status:** the previous `garment3d.js` implementation was
> removed (monolith, full rebuild on every state change, duplicate GLBs
> across presets, three sources of truth). A new architecture is being
> planned. Until then the preview section shows a placeholder card.

## Layout

```
index.html              # Single page; sections + script tags
css/styles.css          # Single stylesheet; dark theme, CSS vars in :root
js/
  config.js             # Source of truth — constants, presets, validators (window.CONFIG)
  ai.js                 # Prompt → design JSON. Local fallback + optional Claude API
  measurements.js       # Body measurement state, presets, size/fabric/seam math
  pose.js               # MediaPipe Pose Landmarker — measure from a photo
  state-manager.js      # Generic event-driven store (window.StateManager) — unused, kept for 3D rebuild
  export.js             # Builds spec data, downloads JSON/HTML, simulates orders
  analytics.js          # Vercel Web Analytics inject (ES module, npm dep)
  app.js                # Main controller — wires DOM events to other modules
vercel.json             # Hosting config — no build
.github/workflows/      # deno.yml (lint), deploy.yml (Pages); the others are stubs
```

No tests. Only linter is `deno lint` in CI, configured via `deno.json`
(browser-incompatible rules excluded).

## Module conventions

JS files use the **IIFE-with-global** pattern, loaded as classic scripts.
Each exposes exactly one global:

```js
const Foo = (() => { /* … */ return { publicApi }; })();
window.Foo = Foo;
```

| File              | Global                  | Loaded as       |
| ----------------- | ----------------------- | --------------- |
| `config.js`       | `window.CONFIG`         | classic         |
| `ai.js`           | `window.AI`             | classic         |
| `measurements.js` | `window.Measurements`   | classic         |
| `pose.js`         | `window.Pose`           | classic         |
| `state-manager.js`| `window.StateManager`   | classic         |
| `export.js`       | `window.Export`         | classic         |
| `app.js`          | (none — controller)     | classic         |
| `analytics.js`    | (none — side effect)    | `type="module"` |

**Load order in `index.html` matters** — every module except
`analytics.js` reads `window.CONFIG` at IIFE evaluation time, so
`config.js` must load first. Verify the order if you add new dependents.

`state-manager.js` exposes `window.StateManager` (validation,
subscribe/emit, history) but `app.js` does **not** use it — `app.js`
still owns a local `state` object. The 3D rewrite is expected to wire
StateManager in as the single source of truth.

Follow the IIFE-with-global pattern for new code; don't introduce a
bundler or new module system without surfacing it as a question first.

## Running locally

```bash
python3 -m http.server 8080
# or
npm run dev          # → npx serve .
```

`npm install` is **only** needed to make `js/analytics.js` resolve its
local `@vercel/analytics` import; the app works without it.

## Deployment

- **Vercel** (`vercel.json`) — no build, root is output. `npm install`
  runs so analytics resolves. Speed Insights + Web Analytics inject
  from `index.html`.
- **GitHub Pages** (`.github/workflows/deploy.yml`) — uploads repo root
  on pushes to `main` (and one named claude branch). No build.

Other workflows in `.github/workflows/` (`webpack.yml`, `jekyll-*.yml`,
`npm-publish*.yml`) are GitHub-generated stubs that don't apply. Leave
them unless asked to clean up.

## Claude API integration (optional)

`ai.js` calls `https://api.anthropic.com/v1/messages` directly from the
browser when `window.URBAN_REVOLUTION_API_KEY` is set, otherwise it falls
back to the local keyword-based generator. Current model id is
`claude-sonnet-4-6` (in `generateWithClaude`). The fetch sends
`anthropic-dangerous-direct-browser-access: true` — demo-only; do **not**
present browser-side keys as a production pattern.

Claude prompt expects a JSON response with this exact shape (don't change
without updating the consumer in `generateDesign`):

```
{ name, description, color, material, fit, tags, constructionNotes }
```

Local fallback fills the same shape via `*_DICT` keyword maps
(`COLOR_DICT`, `MATERIAL_DICT`, `TYPE_DICT`, `FIT_DICT`, `PATTERN_KEYWORDS`)
and the per-type `generateName` / `generateConstructionNotes` tables.
`COLOR_DICT` also maps German color words (`schwarz`, `weiß`, `rot`, …)
to the palette.

On Claude API failure, `generateWithClaude` dispatches an `ai-fallback`
`CustomEvent` on `window` so `app.js` can toast the reason — silent
fallback on the "no API key" branch.

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
- `PRODUCTION_ESTIMATES` — fabric factors, seam formulas per garment
  type, default lead time, CHF price range
- Validators: `validateMeasurement`, `validateGarmentType`,
  `validateMaterial`, `validateColor` (throw on invalid input)

`Measurements.PRESETS` / `FIELDS` / `LABELS` derive from `CONFIG`; the
seam/fabric math reads `CONFIG.PRODUCTION_ESTIMATES`. **Edit `config.js`
first** — other modules pick up the change.

## Materials and measurements

Seven materials: `cotton`, `linen`, `denim`, `wool`, `fleece`, `silk`,
`polyester`. Currently used in `<select id="material-select">` and as
keys in `MATERIAL_DICT` in `js/ai.js`. The new 3D module will need to
re-introduce material-to-PBR mapping.

Nine body measurements: `height`, `weight`, `chest`, `waist`, `hips`,
`shoulder`, `arm`, `inseam`, `neck`. Defined as keys of
`CONFIG.MEASUREMENT_CONSTRAINTS`; `Measurements.FIELDS` / `LABELS`
derive from that. Adding a field: numeric `<input>` in `index.html`
with `id` matching the field name; the key in `MEASUREMENT_CONSTRAINTS`
and every `MEASUREMENT_PRESETS` entry.

## Pose detection

`pose.js` lazy-loads MediaPipe's Pose Landmarker (Google, GPU delegate)
from a jsDelivr CDN on first use, detects 33 body landmarks in a
full-body photo, and estimates the 9 measurements using the user's
height as the reference scale. Processing is **100% client-side** — the
photo never leaves the device. The DSGVO claim in `pose.js` is
load-bearing; preserve it if you modify the flow.

## State flow

`app.js` owns a single `state`: `{ currentDesign, currentType,
currentColor, currentMaterial, currentFit, measurements }`. Every user
interaction mutates `state` and re-renders the spec sheet via
`updateProductionPreview` (the single funnel for spec-sheet DOM writes,
rebuilds from scratch each time, no diffing).

`window.StateManager` exists as a richer alternative but is not currently
wired in — see **Module conventions**.

## Styling

All styles in `css/styles.css`. Design system uses CSS variables on
`:root` (`--bg*`, `--text*`, `--accent*`, `--gradient`, `--radius*`,
`--shadow*`). Reuse variables instead of hardcoding hex. The pink →
purple → cyan `--gradient` is core brand.

The `@media print` block at the bottom hides everything except
`.spec-sheet` — `Export.print()` depends on it. Update the print
selector if you wrap the spec sheet in a new container.

## Conventions

- **German user-facing copy.** Code identifiers English; visible
  strings, HTML comments, dates German.
- **No frameworks.** Direct DOM (`document.getElementById`,
  `querySelectorAll`). No jQuery, no virtual DOM.
- **No build pipeline for app code.** Anything requiring compilation
  (TS, JSX, SCSS, bundling) breaks the "static site, drop on any host"
  model — surface as a question first.
- **Validate at the boundary.** Route user input and Claude API fields
  through `CONFIG.validate*` so bad values can't poison the spec sheet.
- **Toast feedback** via `showToast(message, type)` in `app.js`, not
  `alert`.
- **Money** is CHF (Swiss Francs); see
  `CONFIG.PRODUCTION_ESTIMATES.priceRange`.

## Git

Default branch is `main`; don't push directly. Development happens on
feature branches. Don't open PRs unless explicitly asked.
