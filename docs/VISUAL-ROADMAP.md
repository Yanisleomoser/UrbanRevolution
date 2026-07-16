# Visual Upgrade Roadmap & Diagnosis — revolveurban.com

> Handoff note for continuing the "make the landing award-worthy" work in a new
> session. Distilled from a 28-agent deep analysis + what's already shipped.
> Read this together with `CLAUDE.md` (the load-bearing project rules).

---

## 1. The core diagnosis

The site is **already award-grade where most submissions die**: usability (30% of
the Awwwards score), performance discipline, accessibility, progressive
enhancement, and honest pre-launch copy are all strong. Typography (Fraunces /
Poppins / JetBrains Mono) and the "Ocean Depths" palette are confident.

**The one thing holding it back:** the narrative spine —
`#manifesto → #facts → #loop → #ai-done-right → #your-style` — is brilliantly
written but **visually inert**: a sequence of serif text-walls on flat navy.
Award juries read empty text surfaces as a "negative halo."

### Awwwards scorecard (current → potential, 1–10)

| Category (weight)        | Now | Potential | Gap |
| ------------------------ | --- | --------- | --- |
| Visual Design (40%)      | 6   | 9         | Narrative beats are text-on-flat-navy; give each a bespoke visual/interactive moment |
| Usability (30%)          | 9   | 9         | Already the strongest axis — **protect** it, don't trade it for effects |
| Creativity (20%)         | 6   | 9         | Land **one** signature scroll moment (the `#loop` circle closing); resist effect-spam |
| Content/Storytelling (10%)| 7  | 9         | Excellent, cited, honest copy — but *told, never shown* |
| Mobile                   | 8   | 9         | Ship `-sm` variants, cap animated blur on mid-range GPUs |
| Accessibility            | 9   | 9         | Exemplary; the one risk is contrast over any new imagery — prove via axe |
| Performance              | 8   | 9         | Keep LCP on the hero; lazy/sized/budgeted assets |

---

## 2. THE load-bearing principle (learned the hard way this session)

> **Premium, INTERACTIVE, per-element components — never wallpaper.**

The first attempt put a graded photo *behind* the `#facts` stats. It was rejected,
correctly: **a single static image behind multiple different data points is just
wallpaper**, even when it's meaningful and on-brand. A *meaningful* photo (a waste
mountain) was also rejected for the same reason — one image can only "match" one
idea, so behind three stats it's still decoration.

**The winning direction:** turn each piece of content into something the user can
*feel and move*. For statistics that means animated/interactive data-viz, not a
background. This is also what award research says beats static imagery for data.

This principle now governs the whole roadmap: every remaining beat gets *bespoke
interaction/animation*, not a background image.

---

## 3. What's already shipped (the `#facts` band — DONE)

`#facts` ("Die Zahlen") — the three cited fast-fashion stats — is now three
interactive data-instruments (PRs #306, #309, #311; cache fix #314):

1. **`<1%` recycled → a "1-in-100" matrix.** 100 cells, exactly one glows; a
   pointer spotlight (fine-pointer only) sweeps the grid so you *feel* how tiny
   the fraction is. Cells stagger-reveal.
2. **`1 truckload/second` → live accumulation.** Bars pile up beside the real-time
   kg odometer (`ambient-ticker.js`, +2'918 kg/s); leading bar pulses each tick.
3. **`≤8% CO₂` → a radial gauge.** An 8% arc sweeps in on reveal.

Files: historisch `js/facts-instruments.js` — **ersetzt durch `js/facts-mass.js`**
(„Die Masse": drei Canvas-Partikel-Beats, gewählt aus dem Varianten-Labor PR #337);
markup in `index.html`, styles in `css/styles.css`. Live kg readout reuses
`ambient-ticker.js` + `ticker.*` i18n keys.

### Patterns established here — REUSE THESE for the next beats

- **Default = the visible END state.** The entrance animation is opt-in: the module
  adds `html.fx-go` itself, and only `html.fx-go .x { hidden-start }` rules apply.
  So if JS or the IntersectionObserver never runs (real Edge/Safari did this!), the
  content stays **visible**, never stuck hidden. A **fail-safe `setTimeout` reveal**
  (~1.6s) adds `.is-in` even if the observer never fires. **Do NOT gate the hidden
  start-state on `html.fx` alone** — that was the bug.
- **Decorative reinforcement is `aria-hidden`** — the meaning stays in the real text
  (big number + caption), so screen readers lose nothing and there are no new i18n
  strings or contrast obligations for the graphic itself.
- **No `aspect-ratio` for load-bearing sizing** (older iOS Safari) — use explicit
  px. **Inline SVGs get explicit `width`/`height` attributes**, not just CSS (Safari
  renders attribute-less SVGs oversized → layout shift).
- **Cache-bust changed scripts** with `?v=` (matches the existing `ur-create.js?v=`
  pattern). HTML is now `no-store` (see §6) so stale-page bugs won't recur.
- Verify with headless: build cells, frame-sample the motion over its full duration
  (not stills), run axe (`#facts` desktop+mobile = 0 violations), check no overflow
  at ≤480px, and test the degraded paths (script blocked → still visible).

---

## 4. Remaining roadmap (each its own PR, interactive-not-wallpaper)

> **Status update (2026-07-12 review):** re-checked against `main` @
> `e97ec55`. **Every row below is now done except the `#measure` trust
> component.** `#loop`, `#manifesto`'s metaphor, `#ai-done-right` and `#how`
> no longer exist as separate sections — they were superseded, not built as
> originally scoped: the Akt-II rewrite (PRs #382/#386/#387) merged
> loop/AI-role/how into one `#machine` engineering-simulation section, and
> the line→circle "signature moment" + manifesto metaphor now live in the
> pinned `#pivot` beat (`initPivot`/`pivotBendPath`, shipped before this
> table was last edited but never reflected in it). Verified by reading the
> current `index.html`/`css/styles.css`, not re-derived from this table.

Suggested order (highest leverage / most visible first) — kept for history;
see the status column for what to actually act on:

| Beat | Anchor | Interactive concept (starting point — refine at build time) | Status |
| ---- | ------ | ----------------------------------------------------------- | ------ |
| **The signature moment** | ~~`#loop`~~ → `#pivot` | The pinned circular-economy circle physically **closing** as you scroll — the one "stop-scrolling" interaction. | **done** — `#pivot`: a straight line scroll-scrubs into a circle (`initPivot`/`pivotBendPath`), pinned, hinge sentence + mission statement. |
| **Manifesto** | `#manifesto` | Kinetic typography on the existing word-scrub; visualize the "line becomes a circle" metaphor. | **done** — word-scrub thesis (`buildManifesto`) ships; the line→circle metaphor itself is carried by `#pivot` directly after it rather than inside the manifesto beat — same payoff, adjacent section. |
| **AI done right** | ~~`#ai-done-right`~~ → `#machine` | Make the "demand-AI vs reclaim-AI" contrast a real interactive **diptych**, not two near-identical text cards. | **done** — `#machine`'s `.lp-aidr-grid` diptych (`aidr.*` i18n keys), "Auf der Linie" vs "Im Kreis" cards, AI-role guard intact (`aidr.h2_html`: "KI kann die Linie beschleunigen. Oder den Kreis schliessen."). |
| **Your style** | `#your-style` | ~~The identity climax + the ONE `--accent-warm` use.~~ | **removed (2026-07)** — identity message now lives inside `#machine` (AI-role contrast + user steps); machine hands off to the finale directly. |
| **How it works** | ~~`#how`~~ → `#machine` | The four steps become self-drawing "artifact vignettes" the needle stitches along. | **done, simpler than scoped** — shipped as a compact `how.*` protocol rail inside `#machine`, not standalone self-drawing vignettes. If the vignette treatment still matters, it's a *new*, smaller-scope idea against the current rail, not a resumption of this row. |
| **Finale** | `.lp-finale` | The orb CTA becomes the point where the loop visibly *completes*. | **done** — the magnetic circle CTA is the page's geometric conclusion, tying back to `#pivot`'s circle. |
| Studio headers | `#design`/`#measure`/`#production`/`#faq` | `#measure`: promote the buried privacy line into a designed trust component. `#production`+`#faq`: spec sheet as engineering blueprint. | **split:** `#production`/`#faq` **done** (`.spec-drawing` "Werkstatt-Tinte" print/export treatment, PR #356). `#measure` **still open** — `.photo-privacy` is still 11px italic text (`css/styles.css`), not a designed component. |

**Only open item from this table: the `#measure` privacy trust component.**
Low effort (one section, existing tokens, no new mechanism — promote the
existing `measure.photo_privacy` string into a small designed component next
to the upload control), low risk (static, no motion, no `svh`/scroll
concerns) — a good low-risk-visual autonomous-merge candidate once built.
Re-checked 2026-07-13 against `main` @ `5e5cbf3`: `.photo-privacy` is still
11px italic text in `css/styles.css` — unchanged.

> **Status update (2026-07-13):** two accessibility fixes landed on surfaces
> this doc discusses, from a separate never-committed review (see
> `docs/WEBSITE-IMPROVEMENTS.md`'s 2026-07-13 status update for the full
> accounting) — the manifesto word-scrub's opacity floor was raised to clear
> WCAG-AA large-text contrast in full motion (27/30 axe-serious nodes fixed),
> and the ghost-button border was darkened to clear WCAG 1.4.11 non-text
> contrast. Neither changes this doc's own open item above.

> **Status update (2026-07-15):** re-checked against `main` @ `caf0083`; the
> `#measure` trust component (`.photo-privacy`, still 11px italic) remains
> this doc's only open item, unchanged. New, adjacent scope worth knowing
> about: an open draft PR (**#418**, "Reclaimed Light") adds a scroll-
> parallax photo, a copper `mix-blend:screen` aura, and magnetic CTAs to the
> hero — additive to, not a replacement of, the landing film this doc
> considers finished (all new motion is `html.fx`-gated, reduced-motion gets
> a static frame). It sits outside this doc's own remaining-roadmap table
> (§4) and outside `WEBSITE-IMPROVEMENTS.md`; CI is green but the PR is
> correctly held in draft for a real-iPhone scroll/parallax check before
> merge — see `WEBSITE-IMPROVEMENTS.md`'s 2026-07-15 status update for the
> full accounting.

---

## 5. Hard guardrails (from the adversarial review — violating any kills a change)

1. **No fabricated proof (pre-launch).** No testimonials, finished-garment / before-
   after photos, prices, lead-times, delivery countries, working purchase. Trust
   comes only from: the live studio, the cited `#facts` evidence, the client-side
   privacy guarantee, and the forward-looking vision. Frame what *will be*. CTAs =
   "join / be first," not "buy / order."
2. **AI role.** The **user designs** every piece. AI does only two things —
   autonomously **sorts/reclaims** textile and autonomously **manufactures**.
   Copy/visuals must never imply AI designs, shapes, or reimagines the garment.
3. **Provenance honesty.** The orphaned `assets/story/act1–4` photos are GENERAL
   waste/pollution (a 1970s garbage dump, river trash, garbage-eating cows,
   Agbogbloshie e-waste) — **none is textile-specific**. Never caption them as
   "reclaimed textile." For fashion-specific imagery use the generated `problem/*`
   set (see §7) and frame generated images as concept/vision, not documentary proof.
4. **Accessibility / progressive enhancement.** Keyboard, focus-visible, ARIA,
   `prefers-reduced-motion` full-static fallback, works without JS/GSAP. axe gate
   must stay 0 serious/critical. Prove contrast, don't assert it.
5. **Mobile-first.** `svh`/`dvh` not raw `vh`; safe-area; test ≤480px; no overflow.
6. **No new framework/bundler/font.** Classic IIFE-with-global modules (two existing
   ES-module exceptions: `community-sphere.js`, `gallery/`). All strings via
   `i18n.js` (DE + EN, parity test gates CI). Use existing `:root` tokens.

---

## 6. The caching gotcha (resolved — context for the future)

Symptom that ate a lot of time: the live site rendered an **old version on iOS
Safari / Edge even after a fix deployed**. Root cause was **not** code — production
was serving the fix; the browser was rendering a stale `index.html` from its
back-forward (bfcache) memory cache (the doc was `max-age=0, must-revalidate`,
which those browsers satisfy from bfcache without re-fetching). Because the
cache-bust lived only on the `<script>` URL, a stale HTML never even requested the
fixed script.

**Fixed in #314:** `vercel.json` now sets the HTML document (`/` and `*.html`) to
`no-store`, which disables bfcache and forces a fresh HTML fetch every visit.
Versioned assets stay `immutable`, unversioned css/js stay `must-revalidate`.

**Lesson for the next session:** when "it still looks old," verify production with
`curl` (the deployed files) before assuming a code bug; if the files have the
change, it's the viewer's cache — test in a private tab / `?query`. With `no-store`
now on HTML this should no longer happen.

---

## 7. Assets & infra you already own (use before sourcing new)

- **Generated, fashion-specific images on disk but referenced NOWHERE:**
  `js/design-engine/content/img/bg/{final,alternative}.jpg` and
  `js/design-engine/content/img/problem/{overproduction,unsold,waste,human}.jpg`
  (32–108 KB, in the 150 KB `content/img` budget). `final.jpg` = sculptural fabric→
  ocean (abstract, zero risk); `problem/*` = overproduction racks / unsold warehouse
  / clothing-waste mountain / worker's hands. **Use these only as deliberate,
  interactive/integrated elements — not wallpaper.**
- **FLUX image pipeline** (`api/gen-image.js` + `scripts/build-image-library.mjs` +
  `content/img-library.json`) can generate more on-brand imagery (`bg_style`,
  `bg_light_style`, `prob_style`, material macros) — gated by `IMAGE_GEN_KEY`.
- **Documentary `assets/story/act1–4`** (CC, credited) — only used in `gallery/`.
  Honest-framing caveat in §5.3.
- **Reusable CSS/JS primitives:** the `mix-blend-mode: color` duotone idiom
  (`styles.css` `.de-preview-*`), the `aurora` orbs, per-section radial washes,
  global film grain, the `.lp-loop` ring SVG, the `[data-lp-reveal]` (landing) and
  `[data-reveal]`/`[data-reveal-stagger]` (`animations.js`) reveal systems, and
  `ambient-ticker.js` ([data-ticker-kg]).

---

## 8. Verification loop (the project's standard, applied every time)

- `npm test` (i18n parity etc.), `validate-css`, `validate-html`, deno-lint-clean
  (no `var`; use `const`/`let` + arrows).
- Headless render desktop + mobile ≤480px; **frame-sample motion over full
  duration**, not two stills (project rule).
- axe-core on the changed section, desktop + mobile = 0 serious/critical + 0
  color-contrast. (Install ad-hoc: `npm i --no-save @axe-core/playwright axe-core`.)
- Test degraded paths: no-JS / reduced-motion / observer-never-fires → content
  still visible.
- Per-task branch → PR → Vercel preview → merge when functional CI green
  (`test`, `validate`, `validate-css`, `validate-html`, `validate-assets`, `e2e`).
  `e2e` occasionally hits a transient npm/Playwright `ECONNRESET` — just re-kick it.
