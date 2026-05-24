# CLAUDE.md

Guidance for AI assistants working on the Urban Revolution repository.

## Project

Urban Revolution is a single-page web app — an "AI couture atelier." The user
writes a free-text prompt describing a garment, the app turns it into a
structured design concept, renders a parametric 3D preview scaled to the
user's body measurements, and produces a printable production spec sheet for
a tailor.

**Stack:** vanilla HTML/CSS/JS. No build step, no package.json, no
dependencies installed locally. Three.js is loaded from a CDN at runtime via
an import map in `index.html`. UI copy is German (`lang="de"`,
`toLocaleDateString('de-DE')`).

## Layout

```
index.html              # Single page; all sections + import map + script tags
css/styles.css          # Single stylesheet; dark theme, CSS variables in :root
js/
  app.js                # Main controller — wires DOM events to the other modules
  ai.js                 # Prompt -> design JSON. Local fallback + optional Claude API
  garment3d.js          # Three.js scene + parametric garment builders (ES module)
  measurements.js       # Body measurement state, presets, size/fabric/seam math
  export.js             # Builds spec data, downloads JSON/HTML, simulates orders
README.md               # User-facing German overview
```

There are no tests, no linter config, and no CI.

## Module conventions

Four of the five JS files use the **IIFE-with-global** pattern and are loaded
as classic scripts. Each exposes exactly one global:

```js
const Foo = (() => { /* … */ return { publicApi }; })();
window.Foo = Foo;
```

Used: `window.AI`, `window.Measurements`, `window.Export`, plus the
controller-only `app.js` (no export).

`garment3d.js` is the **only ES module** — it `import`s `three` via the
import map. It loads with `<script type="module">`, exposes
`window.GarmentScene` (the class) and `window.garmentScene` (the live
instance), and fires a `garment-scene-ready` event on `window` once
constructed. Both `app.js` and `garment3d.js` register their own
`DOMContentLoaded` listeners; the custom event is what keeps them
ordered — `app.js` waits for `garment-scene-ready` before pushing the
initial measurements into the scene.

Cross-module communication is via these window globals. When adding code,
follow the existing pattern instead of introducing a bundler or new module
system.

## Running locally

Serve the directory statically — opening `index.html` via `file://` breaks
the ES module / import map:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080`. There is nothing to build or install.

## Claude API integration (optional)

`ai.js` calls `https://api.anthropic.com/v1/messages` directly from the
browser when `window.URBAN_REVOLUTION_API_KEY` is set, otherwise it falls
back to the local keyword-based generator. The current model id is
`claude-sonnet-4-6` (in `js/ai.js`, `generateWithClaude`). The fetch sends
`anthropic-dangerous-direct-browser-access: true` — this is acknowledged as
demo-only; do **not** present browser-side keys as a production pattern.

The Claude prompt expects a JSON response with this exact shape (do not
change it without also updating the consumer in `generateDesign`):

```
{ name, description, color, material, fit, tags, constructionNotes }
```

The local fallback fills the same shape via the `*_DICT` keyword maps
(`COLOR_DICT`, `MATERIAL_DICT`, `TYPE_DICT`, `FIT_DICT`) and the per-type
`generateName` / `generateConstructionNotes` tables.

## Garment types

Six types flow through every layer: `tshirt`, `hoodie`, `shirt`, `pants`,
`jacket`, `dress`. Adding or renaming one requires coordinated edits:

- `index.html` — add a `.type-btn[data-type="…"]` in the type grid.
- `js/ai.js` — add aliases to `TYPE_DICT`, a name list in `generateName`'s
  `adjectives` + `typeNames`, and an entry in `generateConstructionNotes`.
- `js/garment3d.js` — add a `case` in `buildGarment`'s switch and a
  `build<Type>` method (use `LatheGeometry` + `buildLathePoints` like the
  existing ones; sleeves go through `addSleeve`).
- `js/measurements.js` — add factors in `estimateFabric.factors` and a
  formula in `estimateSeams.formulas`.

Missing any one of these causes silent fallbacks (`'tshirt'` default,
default fabric factor of `1.5`, default seam length `200`).

## Materials and measurements

Seven materials flow through the app: `cotton`, `linen`, `denim`, `wool`,
`fleece`, `silk`, `polyester`. They must stay in lock-step across three
places — the `<select id="material-select">` in `index.html`, the
`MATERIAL_DICT` aliases in `js/ai.js`, and `getMaterialProps` (roughness /
metalness for the PBR material) in `js/garment3d.js`. Unknown materials
fall back to cotton in the 3D scene.

Nine body measurements are tracked: `height`, `weight`, `chest`, `waist`,
`hips`, `shoulder`, `arm`, `inseam`, `neck`. The canonical list is
`Measurements.FIELDS`; the display strings are in `Measurements.LABELS`
(German). Adding a field means: a numeric `<input>` in `index.html`, the
key in `FIELDS` + `LABELS` + every `PRESETS` entry (`S` / `M` / `L` /
`XL`), and — if the value should affect geometry — a `*Scale` in
`buildGarment` of `js/garment3d.js`.

## State flow

`app.js` owns a single `state` object: `{ currentDesign, currentType,
currentColor, currentMaterial, currentFit, measurements }`. Every user
interaction mutates `state` and then pushes the change into the 3D scene
(via `window.garmentScene.set*`) and re-renders the spec sheet (via
`updateProductionPreview`). The spec sheet is rebuilt from scratch each
time — there is no diffing layer. Keep `updateProductionPreview` as the
single funnel for spec-sheet DOM writes.

## Styling

All styles live in `css/styles.css`. The design system is defined as CSS
variables on `:root` (colors `--bg*`, `--text*`, `--accent*`, the
`--gradient` accent, `--radius*`, `--shadow*`). Reuse the variables instead
of hardcoding hex values. The pink→purple→cyan gradient (`--gradient`) is a
core brand element used on hero text, primary buttons, and accents in the
3D lights (`initLights` in `garment3d.js` mirrors it with pink fill and
purple rim lights).

The `@media print` block at the bottom of `styles.css` hides everything
except `.spec-sheet` — `Export.print()` (which calls `window.print()`)
relies on that. If you wrap the spec sheet in a new container, update the
print selector accordingly.

## Conventions worth keeping

- **German user-facing copy.** Code identifiers are English; all visible
  strings, comments in HTML, and date formatting are German. Match this when
  adding UI.
- **No frameworks.** Keep DOM access direct (`document.getElementById`,
  `querySelectorAll`). No jQuery, no virtual DOM.
- **No build pipeline.** Anything that requires compilation (TypeScript,
  JSX, SCSS, bundling) breaks the "static site, drop it on any host" model.
  If you genuinely need one, surface it as a question first.
- **Toast feedback.** User-visible success / error / info goes through
  `showToast(message, type)` in `app.js`, not `alert`.
- **Money formatting.** Prices are CHF (Swiss Francs); see
  `estimatedPriceRange` in `export.js`.

## Git

Development happens on feature branches; CLAUDE-driven work on this branch
uses `claude/claude-md-docs-hSvai` per the session instructions. The default
branch is `main`. Do not push directly to `main`. Don't create PRs unless
explicitly asked.
