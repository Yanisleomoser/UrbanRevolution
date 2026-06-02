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
waitlist.html           # Pre-launch email capture → POSTs to /api/waitlist
impressum.html          # German legal page (Impressum)
datenschutz.html        # German privacy policy (DSGVO + Swiss)
css/styles.css          # Single stylesheet; dark theme, CSS vars in :root
api/
  generate-design.js    # Edge Function — Anthropic proxy for design JSON
  preview-design.js     # Edge Function — Replicate (FLUX 1.1 Pro) garment render
  try-on.js             # Edge Function — Replicate proxy for photoreal VTO
  waitlist.js           # Edge Function — waitlist signups → Upstash Redis
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
  animations.js         # IntersectionObserver scroll-reveal (side effect)
  flair.js              # Pointer/scroll micro-interactions + easter egg (side effect)
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
| `preview-fallback.js`| `window.PreviewFallback` | classic      |
| `animations.js`   | (none — side effect)    | classic         |
| `flair.js`        | (none — side effect)    | classic         |
| `app.js`          | (none — controller)     | classic         |
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
config → i18n → state-manager → ai → measurements →
pose → export → preferences → library → preview-fallback → animations → app →
hero → flair → 3d/story-scene.js (module)
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

## Waitlist (`waitlist.html` + `api/waitlist.js`)

The pre-launch page (`waitlist.html`, standalone, English, not part of the
`index.html` app) captures emails. `POST /api/waitlist { email, consent }`
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

`npm install` is not needed to run the app locally. Vercel Web Analytics and
Speed Insights load at runtime from Vercel's own `/_vercel/insights/script.js`
and `/_vercel/speed-insights/script.js` endpoints (served only on Vercel, via
script tags in `index.html` — no npm import). The `/api/*` edge functions only
run on Vercel (or `vercel dev`).

## Deployment

- **Vercel** (`vercel.json`) — no build, root is output. Speed Insights +
  Web Analytics load from Vercel's `/_vercel/*` script endpoints (script tags
  in `index.html`). The two `/api/` functions run as Edge Functions. **This is the
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

**Default: Claude merges its own PRs autonomously — do NOT ask, do NOT wait
for confirmation, do NOT just report "CI is green" and stop.** The user has
said this repeatedly and emphatically. The moment a PR Claude opened has all
functional CI green (see below), squash-merge it. This applies to **every**
change type — CSS, copy, docs, JS logic, `api/` functions, build/CI — unless
the user explicitly says "don't merge / let me review this one" for a
specific PR. When you open a PR, the job isn't done until it's merged (or CI
is red and you're fixing it). Subscribing to a PR means driving it to merge,
not narrating that you're waiting.

A PR is mergeable when **all functional CI checks are green** — `build`,
`test`, `validate`, `validate-css`, `validate-html` — and no review comment
requests a change. The advisory **"Vercel Agent Review"** is non-blocking;
address its points if valid, but it need not be green to merge. If any
functional check is red, fix it first; never merge red CI.
