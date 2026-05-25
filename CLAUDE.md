# CLAUDE.md

Guidance for AI assistants working on the Urban Revolution repository.

## Project

Urban Revolution is a single-page web app — an "AI couture atelier." The
user writes a free-text prompt describing a garment, the app turns it into
a structured design concept, renders a parametric 3D preview on a body
avatar scaled to the user's measurements, and produces a printable
production spec sheet for a tailor.

**Stack:** vanilla HTML / CSS / JS. There is no bundler and no transpiler.
A `package.json` exists, but only because Vercel needs `npm install` to
pull `@vercel/speed-insights`; the app itself does not require a build
step. Three.js, MediaPipe, and the Vercel analytics scripts are pulled
from CDNs at runtime. UI copy is German (`lang="de"`,
`toLocaleDateString('de-DE')`).

## Layout

```
index.html              # Single page; all sections + import map + script tags
css/styles.css          # Single stylesheet; dark theme, CSS variables in :root
js/
  config.js             # Single source of truth — constants, presets, validators (window.CONFIG)
  ai.js                 # Prompt → design JSON. Local fallback + optional Claude API
  measurements.js       # Body measurement state, presets, size/fabric/seam math
  pose.js               # MediaPipe Pose Landmarker — measure from a photo
  state-manager.js      # Generic event-driven store (window.StateManager) — currently unused by app.js
  export.js             # Builds spec data, downloads JSON/HTML, simulates orders
  garment3d.js          # Three.js scene, GLB avatar loader, parametric garments (ES module)
  analytics.js          # Vercel Web Analytics inject (ES module, npm dep)
  app.js                # Main controller — wires DOM events to the other modules
models/                 # CC0/Apache-2.0 GLB human models (Soldier, Michelle, CesiumMan, RiggedFigure)
package.json            # Only needed for Vercel's npm install (speed-insights dep)
vercel.json             # Vercel hosting config — no build, long-cache for /models/*.glb
.github/workflows/      # deno.yml (lint), deploy.yml (GitHub Pages); the others are stubs
```

There are no tests. The only linter is `deno lint` in CI
(`.github/workflows/deno.yml`).

## Module conventions

Most JS files use the **IIFE-with-global** pattern and are loaded as
classic scripts. Each exposes exactly one global:

```js
const Foo = (() => { /* … */ return { publicApi }; })();
window.Foo = Foo;
```

| File              | Global               | Loaded as       |
| ----------------- | -------------------- | --------------- |
| `config.js`       | `window.CONFIG`      | classic         |
| `ai.js`           | `window.AI`          | classic         |
| `measurements.js` | `window.Measurements`| classic         |
| `pose.js`         | `window.Pose`        | classic         |
| `state-manager.js`| `window.StateManager`| classic         |
| `export.js`       | `window.Export`      | classic         |
| `app.js`          | (none — controller)  | classic         |
| `analytics.js`    | (none — side effect) | `type="module"` |
| `garment3d.js`    | `window.GarmentScene`, `window.garmentScene`, `window.AVATAR_PRESETS` | `type="module"` |

`garment3d.js` is an ES module because it `import`s `three` and three
addons via the import map in `index.html`. It fires a
`garment-scene-ready` event on `window` once the scene is constructed,
and an `avatar-load-result` event after the GLB models finish loading.
`app.js` listens for both — `garment-scene-ready` is what synchronises
the initial measurements push, and `avatar-load-result` drives the
"models loaded" / "using fallback mannequin" toast.

Cross-module communication is via these window globals. **Load order in
`index.html` matters** because every module except `analytics.js` and
`garment3d.js` reads `window.CONFIG` at IIFE evaluation time. `config.js`
must be loaded before any module that calls `CONFIG.*`. Verify the order
if you add new dependents.

`state-manager.js` exists and exposes `window.StateManager` with
validation + subscribe/emit, but `app.js` does **not** use it — `app.js`
still owns a local `state` object. Treat `StateManager` as a planned
refactor target, not as load-bearing infrastructure. If you wire it in,
do it as one coordinated change rather than mixing the two stores.

When adding code, follow the existing IIFE-with-global pattern instead
of introducing a bundler or new module system.

## Running locally

Serve the directory statically — opening `index.html` via `file://`
breaks the ES module / import map:

```bash
python3 -m http.server 8080
# or
npm run dev          # → npx serve .
```

Then open `http://localhost:8080`. `npm install` is **only** needed if
you want `js/analytics.js` to resolve its
`../node_modules/@vercel/analytics/...` import locally; the app works
without it (the analytics module just fails to load).

## Deployment

Two deploy targets are wired up:

- **Vercel** (`vercel.json`) — no build, root is the output. `npm install`
  runs so the analytics module resolves. Long-cache + correct MIME type
  for `/models/*.glb`. Speed Insights and Web Analytics scripts are
  injected from `index.html`.
- **GitHub Pages** (`.github/workflows/deploy.yml`) — uploads the repo
  root as the artifact on pushes to `main` (and one named claude branch).
  No build.

The other workflows in `.github/workflows/` (`webpack.yml`,
`jekyll-*.yml`, `npm-publish*.yml`) are GitHub-generated stubs that
don't apply to this project. Leave them unless asked to clean up.

## Claude API integration (optional)

`ai.js` calls `https://api.anthropic.com/v1/messages` directly from the
browser when `window.URBAN_REVOLUTION_API_KEY` is set, otherwise it
falls back to the local keyword-based generator. The current model id
is `claude-sonnet-4-6` (in `js/ai.js`, `generateWithClaude`). The fetch
sends `anthropic-dangerous-direct-browser-access: true` — this is
acknowledged as demo-only; do **not** present browser-side keys as a
production pattern.

The Claude prompt expects a JSON response with this exact shape (do not
change it without also updating the consumer in `generateDesign`):

```
{ name, description, color, material, fit, tags, constructionNotes }
```

The local fallback fills the same shape via the `*_DICT` keyword maps
(`COLOR_DICT`, `MATERIAL_DICT`, `TYPE_DICT`, `FIT_DICT`) and the
per-type `generateName` / `generateConstructionNotes` tables.

`COLOR_DICT` is derived from `CONFIG.COLORS`, so adding a brand colour
means editing `config.js` and (if it should appear in the UI) adding a
`.color-swatch[data-color="…"]` in `index.html`.

## Centralized configuration (`config.js`)

`config.js` is the single source of truth for the things that used to
live in multiple files:

- `CONFIG.GARMENT_TYPES` — the 6 supported types
- `CONFIG.MATERIALS` — material key → German label
- `CONFIG.COLORS` — brand colour palette (key → hex)
- `CONFIG.PATTERNS` — 9 fabric patterns (`solid`, `stripes_h`,
  `stripes_v`, `dots`, `plaid`, `camo`, `gradient`, `heather`, `floral`)
- `CONFIG.MEASUREMENT_PRESETS` — `S` / `M` / `L` / `XL`
- `CONFIG.MEASUREMENT_CONSTRAINTS` — per-field `{ min, max, label }`,
  used by `validateMeasurement`
- `CONFIG.PRODUCTION_ESTIMATES` — fabric factors, seam formulas per
  garment type, default lead time, and the CHF price range
- Validators: `validateMeasurement`, `validateGarmentType`,
  `validateMaterial`, `validateColor` (throw on invalid input)

`Measurements.PRESETS` / `FIELDS` / `LABELS` are derived from `CONFIG`;
the seam/fabric math reads from `CONFIG.PRODUCTION_ESTIMATES`. **Edit
`config.js` first** for anything in those categories — the other modules
will pick up the change.

## Garment types

Six types flow through every layer: `tshirt`, `hoodie`, `shirt`,
`pants`, `jacket`, `dress`. Adding or renaming one is a coordinated
edit:

- `js/config.js` — add to `GARMENT_TYPES`, `PRODUCTION_ESTIMATES.fabric`,
  and `PRODUCTION_ESTIMATES.seams`.
- `index.html` — add a `.type-btn[data-type="…"]` in the type grid.
- `js/ai.js` — add aliases to `TYPE_DICT`, a name list in
  `generateName`'s `adjectives` + `typeNames`, and an entry in
  `generateConstructionNotes`.
- `js/garment3d.js` — add a `case` in `buildGarment`'s switch and a
  `build<Type>` method (use `LatheGeometry` + `buildLathePoints` like
  the existing ones; sleeves go through `addSleeve`).

Missing any one of these causes silent fallbacks (`'tshirt'` default,
fabric factor `1.5`, seam length `200`).

## Materials and measurements

Seven materials flow through the app: `cotton`, `linen`, `denim`,
`wool`, `fleece`, `silk`, `polyester`. They must stay in lock-step
across three places — the `<select id="material-select">` in
`index.html`, the `MATERIAL_DICT` aliases in `js/ai.js`, and
`getMaterialProps` (roughness / metalness for the PBR material) in
`js/garment3d.js`. Unknown materials fall back to cotton in the 3D
scene. The display labels themselves come from `CONFIG.MATERIALS`.

Nine body measurements are tracked: `height`, `weight`, `chest`,
`waist`, `hips`, `shoulder`, `arm`, `inseam`, `neck`. They are defined
as the keys of `CONFIG.MEASUREMENT_CONSTRAINTS`; `Measurements.FIELDS`
and `Measurements.LABELS` are derived from that. Adding a field means:
a numeric `<input>` in `index.html` with `id` matching the field name,
the key in `CONFIG.MEASUREMENT_CONSTRAINTS` and every
`MEASUREMENT_PRESETS` entry, and — if the value should affect geometry
— a `*Scale` in `buildGarment` of `js/garment3d.js`.

## Avatars and pose detection

`garment3d.js` exposes 6 avatar presets via `window.AVATAR_PRESETS`
(3 body types × male/female: `male_slim`, `male_regular`,
`male_athletic`, `female_slim`, `female_regular`, `female_curvy`).
Each preset has body modifiers, skin / hair colour, and a `defaults`
measurement set. Avatar selection is in the 3D Preview section; if
`#toggle-load-defaults` is checked, switching avatar also fills the
measurement inputs from the preset's `defaults`.

The presets reference GLB models in `models/` (committed to the repo,
~6 MB total). Models are CC0 / Apache 2.0 from the Three.js examples
collection (Soldier.glb, Michelle.glb, CesiumMan.glb, RiggedFigure.glb).
`HUMAN_MODELS` maps avatar key → primary URL; `MODEL_FALLBACKS` defines
the next-best URL if a load fails. If every load fails the scene falls
back to a procedural mannequin (`buildProceduralAvatar`) so the page
never breaks.

`pose.js` lazy-loads MediaPipe's Pose Landmarker (Google, GPU delegate)
from a jsDelivr CDN on first use, detects 33 body landmarks in a
user-supplied full-body photo, and estimates the 9 measurements using
the user's height as the reference scale. Processing is **100%
client-side** — the photo never leaves the device. The German comments
in `pose.js` make this DSGVO claim explicit; keep that property if you
modify the flow.

## Garment customization beyond color/material/fit

`GarmentScene.applyDesign(design)` accepts the full design object and
also reads these optional fields (any of which may be `undefined`):

- `secondaryColor` — second hex used by patterns / graphics
- `pattern` — one of `CONFIG.PATTERNS`
- `graphicText` — short text rendered as a chest graphic
- `sleeve` — `'sleeveless' | 'short' | 'long'`
- `length` — `'cropped' | 'regular' | 'long'`
- `details` — bag of booleans, e.g. `{ hasHoodUp, hasZipper }`

The setters (`setPattern`, `setGraphic`, `setSleeve`, `setLength`,
`setDetails`, `setSecondaryColor`) trigger a full `buildGarment()` —
the scene rebuilds from scratch on every change, there is no diffing.

## State flow

`app.js` owns a single `state` object: `{ currentDesign, currentType,
currentColor, currentMaterial, currentFit, measurements }`. Every user
interaction mutates `state` and then pushes the change into the 3D scene
(via `window.garmentScene.set*`) and re-renders the spec sheet (via
`updateProductionPreview`). The spec sheet is rebuilt from scratch each
time — there is no diffing layer. Keep `updateProductionPreview` as the
single funnel for spec-sheet DOM writes.

`window.StateManager` exists as a richer alternative (validation,
subscribe/emit, history) but is not currently wired into the app — see
the note in **Module conventions**.

## Styling

All styles live in `css/styles.css`. The design system is defined as CSS
variables on `:root` (colors `--bg*`, `--text*`, `--accent*`, the
`--gradient` accent, `--radius*`, `--shadow*`). Reuse the variables
instead of hardcoding hex values. The pink → purple → cyan gradient
(`--gradient`) is a core brand element used on hero text, primary
buttons, and accents in the 3D lights (`initLights` in `garment3d.js`
mirrors it with pink fill and purple rim lights).

The `@media print` block at the bottom of `styles.css` hides everything
except `.spec-sheet` — `Export.print()` (which calls `window.print()`)
relies on that. If you wrap the spec sheet in a new container, update
the print selector accordingly.

## Conventions worth keeping

- **German user-facing copy.** Code identifiers are English; all visible
  strings, comments in HTML, and date formatting are German. Match this
  when adding UI.
- **No frameworks.** Keep DOM access direct (`document.getElementById`,
  `querySelectorAll`). No jQuery, no virtual DOM.
- **No build pipeline for app code.** Anything that requires compilation
  of `js/`, `css/`, or `index.html` (TypeScript, JSX, SCSS, bundling)
  breaks the "static site, drop it on any host" model. Surface it as a
  question first. The existing `package.json` is for one Vercel
  dependency — do not extend it into a bundler config.
- **Validate at the boundary.** When you accept user input or fields
  from the Claude API, route them through the `CONFIG.validate*`
  helpers so a bad value can't poison the 3D scene or the spec sheet.
- **Toast feedback.** User-visible success / error / info goes through
  `showToast(message, type)` in `app.js`, not `alert`.
- **Money formatting.** Prices are CHF (Swiss Francs); see
  `CONFIG.PRODUCTION_ESTIMATES.priceRange`.

## Git

Default branch is `main`; do not push directly to `main`. Development
happens on feature branches. Claude-driven work on this branch uses
`claude/claude-md-docs-awqSO` per the session instructions. Don't open
PRs unless explicitly asked.
