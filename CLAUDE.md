# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Urban Revolution is a single-page web app — an "AI couture atelier." The
user writes a free-text prompt describing a garment, the app turns it into
a structured design concept, captures the user's measurements, renders a
live 3D preview, and produces a printable production spec sheet for a
tailor. The landing experience opens with a **scroll-driven visual story**
(documentary photos → a WebGL particle garment) that frames the brand's
anti-fast-fashion mission.

**Stack:** vanilla HTML / CSS / JS. No bundler, no transpiler. The
`package.json` only exists so Vercel runs `npm install` to pull
`@vercel/speed-insights` / `@vercel/analytics`; the app itself has no build
step. Three.js (via import map), MediaPipe and Vercel analytics load from
CDNs at runtime. Two Vercel Edge Functions (`api/`) proxy the AI calls.
UI copy is **bilingual German/English** (`I18N`, default `de`,
`toLocaleDateString` follows the active locale).

## Layout

```
index.html              # The atelier app; sections + import map + script tags
landing.html            # Marketing/pitch page (pre-launch)
waitlist.html           # Email capture (in-memory counter, no backend)
impressum.html          # German legal page (Impressum)
datenschutz.html        # German privacy policy (DSGVO + Swiss)
css/styles.css          # Single stylesheet; dark theme, CSS vars in :root
api/
  generate-design.js    # Edge Function — Anthropic proxy for design JSON
  try-on.js             # Edge Function — Replicate proxy for photoreal VTO
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
  animations.js         # IntersectionObserver scroll-reveal (side effect)
  analytics.js          # Vercel Web Analytics inject (ES module, npm dep)
  app.js                # Main controller — wires DOM events to StateManager
  3d/
    scene.js            # Three.js renderer, lights, bloom composer (ES module)
    avatars.js          # Procedural mannequin from measurements + skin/hair
    garments.js         # 6 parametric garment builders + PBR material factory
    controller.js       # Lazy-mounts the 3D scene, subscribes to StateManager
    story-scene.js      # WebGL particle scroll story (self-mounts)
assets/
  og-image.png          # Social share image
  story/                # Documentary photos (Acts I–IV) — see CREDITS.md
vercel.json             # Hosting config — no build, /api/ runs as edge functions
scripts/validate-css.mjs# css-tree structural CSS check (CI)
.github/workflows/      # CI only: deno(test), webpack(validate),
                        # jekyll-docker(build), validate-css, validate-html — see Deployment
```

No unit tests. CI runs `deno lint` (configured via `deno.json`, with
browser-incompatible rules excluded), plus structural HTML/CSS validators.

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
| `animations.js`   | (none — side effect)    | classic         |
| `app.js`          | (none — controller)     | classic         |
| `analytics.js`    | (none — side effect)    | `type="module"` |
| `3d/story-scene.js`| (self-mounts)          | `type="module"` |
| `3d/controller.js`| (self-mounts)           | `type="module"` |

The `js/3d/` render modules (`scene.js`, `avatars.js`, `garments.js`) are
ES modules **dynamically imported by `controller.js`** — they're not listed
as `<script>` tags, so Three.js (~600 KB) only loads when the preview
section nears the viewport.

**Load order in `index.html` matters** — every classic module reads
`window.CONFIG` at IIFE evaluation time, so `config.js` must load first.
`i18n.js` must load before `app.js` / `export.js` (they call `I18N.t()`).
`state-manager.js` must precede `app.js` and the deferred 3D modules (they
subscribe to its events). The bottom-of-body order is:

```
analytics.js (module) → config → i18n → state-manager → ai → measurements →
pose → export → preferences → library → animations → app →
3d/story-scene.js (module) → 3d/controller.js (module)
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

## Visual scroll story (`3d/story-scene.js`)

The `#mission` section is a tall, pinned scroll stage (CSS `position:
sticky`) with six acts:

- **Acts I–IV** (the dark reality) are real documentary **photographs**
  (`assets/story/`, CC-licensed — see `assets/story/CREDITS.md`),
  crossfaded with a slow Ken Burns push. Plain DOM; `story-scene.js` just
  toggles which one is shown per active act.
- **Acts V–VI** (the hopeful turn) are a **WebGL particle system**: a
  thread "curtain" that morphs into a tailored **jacket** — a matte
  "fabric" layer (shoulders, notched-lapel collar, tapered body, sleeves,
  dim worn figure) plus an additive "seam" layer (placket, lapels,
  princess/armhole seams, cuffs, hem) lifted by a bloom pass.

The thread→jacket morph (position/colour blend, jitter, pulse, shimmer)
runs **entirely in a points vertex shader** driven by uniforms — the CPU
only nudges a few uniforms per frame, so the particle budget can be large.
Rendering goes through an `EffectComposer` (RenderPass → UnrealBloomPass →
OutputPass) for the seam glow; the canvas clears to the opaque void so
bloom stays free of alpha fringes. The canvas is invisible (and its work
skipped) during the photo acts, then fades in for the transformation.
Degrades gracefully: `prefers-reduced-motion` / no-WebGL → CSS shows
static, readable acts. The reduced-motion and no-WebGL fallbacks are
load-bearing; preserve them.

## 3D preview (`3d/controller.js` + `scene.js` / `avatars.js` / `garments.js`)

`controller.js` lazy-mounts the Three.js scene when `#three-canvas` nears
the viewport (IntersectionObserver, dynamic imports), then subscribes to
StateManager. `scene.js` owns the renderer, studio lights, PMREM
environment and an `EffectComposer` with `UnrealBloomPass` (rendering is
**on-demand** — `requestRender()` schedules one frame; no continuous loop).
Rebuild policy: mannequin rebuilds on `measurements` / `skinTone` /
`hairColor`; garment rebuilds on `currentType` / `currentFit` /
`measurements`; colour and material patch in place (no rebuild). Every 3D
op is guarded by `safeRun` so a failure can't take down the rest of the app.

## AI design generation (`ai.js` + `api/generate-design.js`)

`AI.generateDesign(prompt, type)` resolves a design concept in this order:

1. **Server proxy (production):** POST `{ prompt, type }` to
   `/api/generate-design` (Vercel Edge Function). The function calls
   Anthropic's Messages API (`claude-sonnet-4-6`) with the
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

- **Setup:** set `REPLICATE_API_TOKEN` in Vercel env vars. Without it the
  function returns a 500 with a clear message; the rest of the app keeps
  working (button enabled, generation fails with a toast).
- **Privacy:** unlike measurement extraction (100 % client-side), VTO sends
  the photo to Replicate's US servers. The disclaimer below the button
  states this; the user opts in by clicking. The photo lives only in memory
  (`StateManager.userPhoto`), never persisted.
- **Cost:** ~$0.04 per generation; only on explicit click.

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
from scratch on every change (no diffing). The 3D controller subscribes to
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
keys in `ai.js`, and mapped to PBR props in `3d/garments.js`.

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
`:root` (`--bg*`, `--text*`, `--accent*`, `--gradient`, `--radius*`,
`--shadow*`). Reuse variables instead of hardcoding hex. The pink →
purple → cyan `--gradient` is core brand. A global `prefers-reduced-motion`
reset, a `:focus-visible` ring, and a skip-link target (`#main-content`)
are in place.

The `@media print` block at the bottom hides everything except
`.spec-sheet` — `Export.print()` depends on it. Update the print selector
if you wrap the spec sheet in a new container.

## Conventions

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

`npm install` is **only** needed so `js/analytics.js` resolves its local
`@vercel/analytics` import; the app works without it. The `/api/*` edge
functions only run on Vercel (or `vercel dev`).

## Deployment

- **Vercel** (`vercel.json`) — no build, root is output. `npm install`
  runs so analytics resolves. Speed Insights + Web Analytics inject from
  `index.html`. The two `/api/` functions run as Edge Functions. **This is the
  only deploy target** (live at `revolveurban.com`). GitHub Pages was dropped
  — the repo no longer has a Pages workflow.

The functional PR checks come from files with **misleading GitHub-default
names** — don't delete one assuming it's a stub. The mapping:

| PR check       | File                  | Workflow name        | What it runs              |
| -------------- | --------------------- | -------------------- | ------------------------- |
| `build`        | `jekyll-docker.yml`   | "Jekyll site CI"     | `jekyll build` (trivial)  |
| `test`         | `deno.yml`            | "Deno"               | `deno lint`               |
| `validate`     | `webpack.yml`         | "Validate Static Site" | `npm run build` (no-op) |
| `validate-css` | `validate-css.yml`    |                      | css-tree check            |
| `validate-html`| `validate-html.yml`   |                      | htmlhint                  |

These five are the **entire** `.github/workflows/` set — **keep all of them**.
The old GitHub-template clutter was removed: `deploy.yml` + `jekyll-gh-pages.yml`
(two redundant GitHub Pages deploys, unused since the site is on Vercel),
`npm-publish*.yml` (duplicate "Node.js Package", release-only, never ran), and
`copilot-setup-steps.yml` (broken empty-keyed SecureStack scan that failed on
every push).

### Checking deploy / CI status yourself (standing instruction from the user)

Before asking the user to verify something you can verify yourself, check it.
The tools are available — use them instead of delegating the lookup back:

- **Deploy status / live URL:** the Vercel MCP tools (`list_deployments`,
  `get_deployment`, `get_deployment_build_logs`, `get_runtime_logs`). Team
  `jack's projects` (`team_6vAACRftikFNNglCvAGxBRku`), project
  `urban-revolution-3ugz` (`prj_nByd8AePhWuduPtx0HQCTiIyxX7N`), production
  domain `urban-revolution-3ugz.vercel.app`. Confirm a commit is live by
  matching `meta.githubCommitSha` + `state: READY`.
- **CI / PR / review status:** the GitHub MCP tools (`pull_request_read`
  with `get_check_runs` / `get` / `get_diff`, etc.).
- **Visual rendering:** the SessionStart hook installs headless Chromium;
  `node scripts/shoot.mjs <url> <prefix>` writes desktop + mobile PNGs to
  `screenshots/` (gitignored). Use it to self-check layout instead of asking
  for a screenshot.

Only ask the user for things that genuinely require their hardware or eyes —
e.g. confirming an **iOS-Safari-specific scroll/toolbar bug on a real
device**, which headless Chromium cannot reproduce.

## Git

Default branch is `main`; don't push directly. Development happens on
feature branches. Don't open PRs unless explicitly asked.

### Auto-merge policy (standing instruction from the user)

For PRs Claude opens, Claude may merge them **without asking** once the
change is verified — scoped to **small, low-risk changes only**: copy/text,
images/assets, CSS, docs, and self-contained tweaks. For larger changes
(JS logic, `api/` edge functions, state flow, build/CI, anything
architectural) still ask before merging.

A PR is mergeable when **all functional CI checks are green** — `build`,
`test`, `validate`, `validate-css`, `validate-html` — and no review comment
requests a change. The advisory **"Vercel Agent Review"** is non-blocking;
address its points if valid, but it need not be green to merge. If any
functional check is red, fix it first; never merge red CI.
