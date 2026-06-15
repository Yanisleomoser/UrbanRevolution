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
KI-entworfene Einzelstücke nach Maß aus recycelter Kleidung — gegen Fast Fashion, für echtes Textil-Recycling.
Tagline „Made for one. Not for all." · AI · 3D · COUTURE. Deploy: Vercel. Sprachen: DE + EN.

## Architektur (nicht umbauen)
- Kein Build-Framework. Klassische `<script>`-Module im `window.X = …`-Muster, in index.html eingebunden. **Zwei Ausnahmen** (ES-Module, bewusst): `js/community-sphere.js` und die eigenständige Galerie-Seite `gallery/` — beide nutzen three.js (nur als ESM ausgeliefert) über die Import-Map + dynamisches `import()` (Lazy-Load). Sonst KEINE Module/Bundler einführen, ohne zu fragen.
- **Landing-Experience** (`js/landing.js`, GSAP via CDN) ist die Startseite: Manifest → Kreislauf-Sektion → Zahlen → magnetischer Kreis-CTA. Das eigentliche **UR-Create-Studio** (`#studio`) ist `hidden`, bis ein CTA/Anker (`#design`/`#ownership`/`#measure`/`#production`) oder ein Share-/Deep-Link es per `revealStudio()` aufklappt. Progressive Enhancement: ohne JS/GSAP alles sichtbar; mit `prefers-reduced-motion` keine Bewegung; nur `html.fx` bekommt die volle Animation.
- **UR-Create-Verdrahtung** (`js/ur-create.js`, Side-Effect, rein additiv) verbindet Hero-Showcase, Ownership-Moment, Community-Hub (`/api/gallery`), Problem-Karten, Join (Formspree) und `make-real` mit der Engine — ohne app.js/flow.js zu ändern.
- Design-Engine unter `js/design-engine/` (engine, dna, condition, inference, render-preview, summary, flow, garment-svg, share, telemetry, modalities/, content/*.json). Datengetrieben: Nodes/Archetypen/Attribute/Bilder liegen in JSON.
- State: `state-manager.js` (localStorage, Wiederaufnahme). KI: `ai.js` → Replicate (FLUX) / Anthropic-Proxy. Maße: `measurements.js` (9 Körpermaße). i18n: `i18n.js`. Telemetrie: `js/design-engine/telemetry.js` → `/api/track` (+ Admin-Dashboard `insights.html`). Fehler: Sentry (Loader im `<head>`).

## Design-System — NUR bestehende :root-Tokens
- Hintergrund Midnight-Navy `#0A1622`; Akzent-Verlauf Ozean-Blau `#2779A8` → Teal `#2A9D8F` → Aqua `#64D6C4` (`--gradient`, „Ocean Depths").
- Fonts: NUR Lora (Display) + Poppins (Body). KEINE anderen Fonts (kein Inter, kein Playfair).
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
- Jede Änderung über einen PR mit Vercel-Preview-Deployment; auf echtem iPhone prüfen, BEVOR nach `main` gemergt wird. Nicht direkt auf `main` pushen. (Diese Regel ersetzt für UI-Änderungen die ältere Auto-Merge-Notiz weiter unten.)
- Lokal: `python3 -m http.server 8080` (statisch) oder `npm run dev` (→ `npx serve .`). Die `/api/*`-Edge-Functions laufen nur via `vercel dev` / auf Vercel. Sentry (Loader im `<head>`) + Fehler-Tags (`area:ai|engine|preview|vto|measure|3d`) sind ohne lokalen Aufwand aktiv; Session-Replay bewusst aus.
- CI (Pflicht, grün vor Merge): `deno lint` (`test`), `npm run build` + `npm test` (`validate`, Workflow „Tests"), `validate-css`, `validate-html` — siehe „Deployment" unten.

---


## Project

Urban Revolution is a single-page web app — an "AI couture atelier." The
user writes a free-text prompt describing a garment, the app turns it into
a structured design concept, captures the user's measurements, renders a
live 2D technical-flat preview (the data-driven Design Engine), and produces
a printable production spec sheet for a tailor.

The **landing experience** (`js/landing.js`, GSAP) is the front door:
preloader logo-draw → hero with a thread-particle field → manifesto
word-scrub → pinned circular-economy section → counted-up stats → a
magnetic circle CTA. The **UR-Create studio** (`#studio`) stays `hidden`
until a CTA/anchor or a share/deep-link reveals it. The page closes with a
**community sphere** — a WebGL globe (`js/community-sphere.js`) whose inner
wall holds floating creations.

**Stack:** vanilla HTML / CSS / JS. No bundler, no transpiler. The
`package.json` only exists so Vercel runs `npm install` to pull
`@vercel/speed-insights` (+ `css-tree`/`htmlhint` dev deps for CI); the app
itself has no build step. MediaPipe, GSAP, three.js and Vercel analytics
load from CDNs at runtime (three.js + GSAP via an `importmap`). Seven Vercel
Edge Functions (`api/`) proxy the AI/storage calls.
UI copy is **bilingual German/English** (`I18N`, default `de`,
`toLocaleDateString` follows the active locale).

## Layout

```
index.html              # The atelier app; landing + studio + sections, import map + script tags
impressum.html          # German legal page (Impressum)
datenschutz.html        # German privacy policy (DSGVO + Swiss)
insights.html           # Design-Engine telemetry dashboard (admin, behind ?key=, noindex)
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
  animations.js         # IntersectionObserver scroll-reveal (side effect)
  app.js                # Main controller — wires DOM events to StateManager
  flair.js              # Pointer/scroll micro-interactions + easter egg (side effect)
  landing.js            # Landing-experience controller + studio reveal (GSAP, side effect)
  ur-create.js          # Wires UR-Create sections (hero/ownership/community/join) to the engine
  ambient-ticker.js     # Live cited textile-waste counter (kg/sec, side effect)
  community-sphere.js   # WebGL community globe (ES module — three.js + GSAP, lazy)
  design-engine/        # Data-driven adaptive journey + 2D technical-flat preview
assets/
  og-image.png          # Social share image · logo.png · hero-*.jpg · vto-*.jpg · presets/
  story/                # Documentary photos (Acts I–IV) — see assets/story/CREDITS.md
vercel.json             # Hosting config — no build, /api/ runs as edge functions
scripts/                # CI: validate-css.mjs · build/QA: shoot*, build-image-library,
                        # gen-presets, strip-hero-bg, audit*, verify-*, check-* (headless)
.github/workflows/      # CI only: deno(test), test.yml(validate = build-no-op
                        # + npm test), validate-css, validate-html — see Deployment
```

Unit tests: 11 offline suites in `test/` (DNA roundtrip, seam formulas, AI
fallback, export scaling, i18n parity, state, persistence, share-link
encode/decode, pose measurement math, API error mapping, API input validation),
run via `npm test` in CI (test.yml). No network needed. CI additionally runs
`deno lint` (configured via `deno.json`, with browser-incompatible rules
excluded) plus structural HTML/CSS validators.

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
| `app.js`          | (none — controller)     | classic         |
| `flair.js`        | (none — side effect)    | classic         |
| `landing.js`      | (none — side effect)    | classic         |
| `ur-create.js`    | (none — side effect)    | classic         |
| `ambient-ticker.js`| (none — side effect)   | classic         |
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
pose → export → preferences → library → preview-fallback → animations →
design-engine/* (dna … flow) → app → flair → ur-create → ambient-ticker →
[importmap] → gsap + ScrollTrigger (CDN) → landing → community-sphere (module)
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
- **Hub wiring (`js/ur-create.js`):** fetches `/api/gallery`, renders each
  item's DNA to a clean flat (`GarmentSVG`), offers type filters + VIEW/REMIX
  (open the DNA in UR Create via the share URL). Save · Share · Publish live
  in the Ownership-Moment, which appears once `StateManager.currentDesign`
  exists.
- **Community sphere (`js/community-sphere.js`, ES module):** the WebGL globe
  in `#community`. Photoreal creations float on the inner wall; drag/arrow
  keys rotate with Lenis-style easing; tap opens a detail overlay; the join
  flow is a CTA + overlay. Lazy-loads three.js/GSAP and images only when the
  section scrolls into view. Data sources: `/api/gallery` items **with** an
  `img` field first, topped up with `content/community-showcase.json` (36
  engine renders). Scroll stays free (no wheel hijack; `touch-action: pan-y`).
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
`:root` (`--bg*`, `--text*`, `--accent*`, `--gradient`, `--radius*`,
`--shadow*`). Reuse variables instead of hardcoding hex. The Ocean Depths
`--gradient` (#2779A8 → #2A9D8F → #64D6C4 on `--bg` #0A1622) is core brand.
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
  in `index.html`). The two `/api/` functions run as Edge Functions. **This is the
  only deploy target** (live at `revolveurban.com`). GitHub Pages was dropped
  — the repo no longer has a Pages workflow.

The functional PR checks (check name = job id):

| PR check       | File               | Workflow name | What it runs                                        |
| -------------- | ------------------ | ------------- | --------------------------------------------------- |
| `test`         | `deno.yml`         | "Deno"        | `deno lint` (Deno 2.x)                               |
| `validate`     | `test.yml`         | "Tests"       | `npm run build` (no-op) + `npm test` (11 offline suites) |
| `validate-css` | `validate-css.yml` |               | css-tree check                                       |
| `validate-html`| `validate-html.yml`|               | htmlhint (index, impressum, datenschutz, insights)   |

These four are the **entire** `.github/workflows/` set. Removed template
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

> **Aktualisiert (siehe Projekt-Regeln · Workflow oben):** Für **UI-/Frontend-
> Änderungen** gilt jetzt zuerst der iPhone-Preview-Check — PR öffnen, Vercel-
> Preview verlinken und auf dem echten Gerät verifizieren lassen, BEVOR nach
> `main` gemergt wird. Die autonome Auto-Merge-Regel unten gilt weiterhin für
> rein nicht-visuelle Änderungen (Docs, CI, `api/`-Logik, Tests).

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
`validate`, `validate-css`, `validate-html` — and no review comment
requests a change. The advisory **"Vercel Agent Review"** is non-blocking;
address its points if valid, but it need not be green to merge. If any
functional check is red, fix it first; never merge red CI.
