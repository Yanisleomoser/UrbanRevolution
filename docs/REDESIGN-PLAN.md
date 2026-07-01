# Redesign Plan — the narrative spine (`#manifesto → #loop → #ai-done-right → #your-style → #how → finale`)

> Execution plan for the beats still open in `docs/VISUAL-ROADMAP.md` §4.
> Grounded in a first-hand read of the real code (line refs below), it follows
> the pattern the shipped `#facts` band established (`js/facts-instruments.js`).
> Read alongside `VISUAL-ROADMAP.md` (diagnosis + guardrails) and `CLAUDE.md`
> (load-bearing rules). `#facts` is **done**; this covers everything after it.

---

## 1. Through-line (what we are actually changing)

The spine is *written* brilliantly but *shown* as serif text on flat navy — the
one thing capping the Awwwards Visual/Creativity axes. We turn each beat into a
**felt, movable, per-element** moment (never wallpaper), reusing the exact
progressive-enhancement recipe that shipped with `#facts`. We land **one**
signature interaction — the `#loop` circle physically closing — and let the
calmer beats build toward it. No new fonts, frameworks, bundlers, or fabricated
proof; the palette stays "Ocean Depths" with the single reserved
`--accent-warm` moment at `#your-style`.

**One motif ties it together.** The manifesto says *"we bend the line back to a
circle."* So the visual vocabulary is a single **thread → seam → loop**: a line
that curls (`#manifesto`), the closed material circle (`#loop`), the one warm
thread pulling free of the cool rack (`#your-style`), the stitched user-journey
seam (`#how`), and the orb where the loop seals shut (finale). Shared language,
shipped as independent PRs.

---

## 2. What the code actually is today (grounding)

| Beat | Markup | Driver | Motion today |
| --- | --- | --- | --- |
| `#manifesto` | `index.html:338-341` | `landing.js buildManifesto()` :148, tween var `manifestoTween` :146, rebuilt on `language:change` :989 | per-word opacity 0.13→1 scrub |
| `#loop` | `index.html:394-449` (ring SVG :402-422, `<ol>` steps :425-446) | `landing.js initLoop()` :185 + `setProgress()` :200, pinned `ScrollTrigger` end `+=280%` :217 | arc draws, needle sweeps `16+p*360`, `.is-active` steps/dots toggle |
| `#ai-done-right` | `index.html:452-468` (two `.lp-aidr-card` `.is-dim`/`.is-lit`) | `[data-lp-reveal]` → `initReveals()` :226 | entrance only |
| `#your-style` | `index.html:471-475` (`.lp-label--warm`, title `em`) | `[data-lp-reveal]` | entrance only; warm radial wash `styles.css:6724` |
| `#how` | `index.html:482-520` (seam :489-492, 4 `.lp-how-station`) | `animations.js` `[data-reveal]`/`[data-reveal-stagger]` → `.is-revealed` | seam clip-draws + needle travels to 95% (CSS only, `styles.css:6795-6806`) |
| finale | `index.html:523-533` (`.lp-finale`, `#cta-orb`) | `landing.js initOrb()` :268 (pointer-magnet, `pointer:fine`) | magnetic orb |

**The reference recipe (`js/facts-instruments.js`, 88 lines) — copy it exactly:**
- Classic IIFE side-effect, idempotent guard (`window.__urFactsInstruments` :27).
- **Default CSS = the visible END state.** The entrance is opt-**in**: the module
  itself adds `html.fx-go` (:60), and only `html.fx-go .x {hidden-start}` rules
  hide anything. So if the script/observer never runs, content stays **visible**
  (this really bit Edge/Safari — do **not** gate the hidden start on `html.fx`).
- IntersectionObserver reveal (:61-66) **plus** a fail-safe `setTimeout(…, 1600)`
  reveal (:69) for engines that don't fire the observer on already-visible nodes.
- Decorative graphic is `aria-hidden`; meaning stays in the real number+caption
  (no new i18n strings, no new contrast obligation for the graphic).
- `:empty` hides the box when JS is absent; inline SVG carries **explicit
  `width`/`height` attrs** (Safari sizing); no `aspect-ratio` for load-bearing size.
- Loaded `defer` + cache-busted `?v=` in `index.html:1160`, before `landing.js`.

`landing.js` owns the GSAP/scroll beats and is gated by `fx = hasGsap &&
!reduceMotion` (:33); it already rebuilds on `language:change` (:989) and
`document.fonts.ready` (:995). `--accent-warm` (#E8A06A) is cleanly contained to
`#your-style` (`:root` :29, `.lp-label--warm` :6726, identity `em` :6736, wash
:6724) — the plan must **keep it there**.

---

## 3. Shared foundation (decide once, apply everywhere)

**Where each beat's logic lives — honest split, not one god-module:**

- **Scroll-synced GSAP beats → extend `landing.js`** (they belong to the pinned
  timeline + the `language:change`/`fonts.ready` rebuild that already lives
  there): `#manifesto`, `#loop`, finale orb.
- **Self-contained instrument beats → a new tiny IIFE module** mirroring
  `facts-instruments.js` exactly (fx-go opt-in + fail-safe reveal + aria-hidden):
  `#your-style` warm thread → `js/identity-thread.js`.
- **Pure-CSS beats → no JS at all**, keyed on the reveal class that already
  toggles: `#how` vignettes self-draw on `.lp-how-station.is-revealed`
  (`animations.js` adds `.is-revealed`); the `#ai-done-right` diptych's two
  opposed states are CSS + one `pointer:fine`/focus interaction (JS only if the
  interaction genuinely needs it — prefer `:hover`/`:focus-within` first).

**Conventions locked for every beat:**
- Reveal = the fx-go opt-in + `setTimeout` fail-safe recipe (new modules) or the
  existing `fx`-gate (landing.js beats). Reduced-motion & no-JS → full static end
  state, always.
- Any **decorative** SVG/canvas is `aria-hidden`; the message stays in real text.
  Any **new visible copy** gets DE **and** EN keys in `js/i18n.js` (the parity
  test gates CI) under the existing namespaces (`identity.*`, `how.*`, `aidr.*`,
  `measure.*`). Prefer zero new strings where the graphic is purely decorative.
- Inline SVG: explicit `width`/`height` attrs, `svh`/`dvh` not raw `vh`,
  safe-area insets, no overflow ≤480px. Reuse `:root` tokens + existing
  primitives (`.aurora` :5515, film grain :2755, `.de-preview-duo`
  `mix-blend-mode:color` :5197) — don't add parallel mechanisms.
- **Cache-bust:** bump the `?v=` on any changed script (add one to `landing.js`
  at `index.html:1166` on its first change, matching `ur-create.js?v=` /
  `facts-instruments.js?v=`). HTML is already `no-store`, so this can't restale.

---

## 4. Recommended sequencing (one PR each, calm → payoff)

Priority = leverage × safety, and the roadmap's rule: **build the calmer beats
first, land `#loop` last as the payoff.** The `thread→loop` motif means
`#manifesto` and `#loop` share vocabulary, so design them as a pair even though
they ship separately (manifesto first — it *introduces* the bend).

1. **`#your-style`** — warm-thread instrument. Self-contained, high payoff, tiny
   blast radius; exercises the new-module recipe on the safest surface first.
2. **`#ai-done-right`** — the diptych. Copy is already guardrail-safe; mostly CSS.
3. **`#how`** — self-drawing artifact vignettes (CSS-only, no new JS).
4. **`#manifesto`** — kinetic "line curls toward a loop"; introduces the motif.
5. **`#loop`** — THE signature moment: the circle *closes*. Highest risk, built
   once the motif and the calmer beats exist.
6. **finale orb** — the loop visibly *seals*; ties back to `#loop`, so it follows.
7. **Studio headers** (separate track, any time): `#measure` privacy →
   trust-component; `#production`+`#faq` → "Fabrik-Dossier" styling.

---

## 5. Per-beat build specs

### 5.1 `#your-style` — "one warm thread bends out of the cool rack"
- **Current:** static copy + a warm radial wash. `--accent-warm` used only here.
- **Build:** `js/identity-thread.js` (new IIFE, mirrors `facts-instruments.js`).
  A field of many **cool** vertical strands (the "rack"), one **warm** strand that
  bends/pulls free — SVG paths (crisp, cheap) rather than canvas so it frame-
  samples cleanly and needs no rAF loop. The warm strand's curve draws on reveal;
  a slow idle sway only under `html.fx`. This is the **single** `--accent-warm`
  moment — do not leak the token elsewhere.
- **Files:** `index.html` (aria-hidden SVG host in the section + `<script defer
  src="js/identity-thread.js?v=…">` beside `facts-instruments.js`), `styles.css`
  (strand styles, reduced-motion stop), `js/identity-thread.js`.
- **New i18n:** none (decorative, aria-hidden; the copy already exists).
- **Fallback/a11y:** default = warm thread already bent-out & static; `fx-go`
  opt-in adds the draw; `setTimeout` fail-safe; `aria-hidden`; no contrast
  obligation (decorative). **No human portrait** (reads as testimonial).
- **Risk:** medium — SVG draw is frame-provable headless. Verify motion by
  sampling; glance on device since it's the identity climax.

### 5.2 `#ai-done-right` — the demand-vs-reclaim diptych
- **Current:** two near-identical cards `.is-dim` (demand AI) / `.is-lit`
  (reclaim AI); the body copy already states *"Das Design bleibt deins."*
- **Build:** make the two cards a genuine **opposed diptych** — the "demand" side
  reads as noise/multiplication (many faint arrows fanning *outward* toward more
  consumption), the "reclaim" side as convergence (tangled strands being *sorted*
  into order). Pure CSS states; a `:hover`/`:focus-within` (or `pointer:fine`
  scrub) shifts emphasis between the two. **STRICT guard:** the reclaim side shows
  *sorting/untangling*, never *designing* — no garment is authored by AI here.
- **Files:** `index.html` (aria-hidden decorative layers inside each card),
  `styles.css`. JS only if the emphasis-shift needs it (try CSS first).
- **New i18n:** none if the existing card copy stands; any new label → DE+EN.
- **Fallback/a11y:** both states legible statically; keyboard-reachable if
  interactive; decorative layers `aria-hidden`; contrast proven over any tint.
- **Risk:** low if CSS-only static two-state → autonomous merge on green CI.

### 5.3 `#how` — self-drawing artifact vignettes
- **Current:** 4 stations; seam bar clip-draws + needle travels to 95% on
  `.is-revealed`, **CSS only** (`styles.css:6785-6806`). The section comment
  explicitly wants "keine neue JS."
- **Build:** each station's icon becomes a small **artifact vignette** —
  prompt → technical flat → measured flat → spec sheet — that **self-draws** via
  `stroke-dashoffset` transition keyed on `.lp-how-station.is-revealed`, stitched
  in by the existing staggered needle. Reuse the flat-drawing idiom from the
  design engine's silhouettes conceptually (SVG stroke), **no** new JS.
- **Files:** `index.html` (richer inline SVGs per station, aria-hidden),
  `styles.css` (dashoffset draw on `.is-revealed`, reduced-motion = drawn).
- **New i18n:** none (labels/lines exist under `how.*`).
- **Fallback/a11y:** reduced-motion/no-JS → vignettes already fully drawn (the
  reveal only *animates* the draw). Honesty: **AI refines, never authors** — keep
  station 2 copy ("KI verfeinert … ersetzt ihn nie").
- **Risk:** low–medium — CSS transition, frame-provable headless.

### 5.4 `#manifesto` — the line that curls toward a loop
- **Current:** per-word opacity scrub via `manifestoTween` (:166), rebuilt on
  DE/EN (:989).
- **Build:** add **one** aria-hidden SVG thread beneath the words: a pre-authored
  path that reads as a straight seam whose ends curl inward into a *nearly*-closed
  loop, revealed by `stroke-dashoffset` **driven by the same `manifestoTween`
  timeline** (not a second competing ScrollTrigger — two scrubbed triggers on one
  short section fights on mobile). **Constraint noted honestly:** GSAP MorphSVG is
  paid/unavailable, so we do **not** morph line→circle geometry; instead the path
  *is* the final curled shape and we *draw* it in — same felt result, robust.
  Rebuild the draw alongside `buildManifesto()` on `language:change`.
- **Files:** `landing.js buildManifesto()` (add the thread to the timeline),
  `index.html` (aria-hidden SVG in `#manifesto`), `styles.css`. Add `?v=` to
  `landing.js`.
- **New i18n:** none (thread is decorative).
- **Fallback/a11y:** no-JS/reduced-motion → words full opacity, thread fully drawn
  & static; `aria-hidden`.
- **Risk:** **high** (scroll-scrubbed motion feel) → iPhone check before merge.

### 5.5 `#loop` — THE signature moment: the circle closes
- **Current:** `setProgress(p)` (:200) already draws the arc (`strokeDashoffset`),
  sweeps the needle, toggles `.is-active` steps/dots; pinned `+=280%` scrub (:217).
  So an arc *drawing* exists — the upgrade must be **more than re-drawing it.**
- **Build:** two additions synced to `self.progress`:
  1. **Stage transformation** — as each quarter activates
     (worn → reclaimed → designed → reborn), a small artifact at the ring morphs
     state (a scrap of cloth → sorted fibre → a flat/pattern → a finished
     silhouette). Drive it off the existing `idx` switch in `setProgress` (:204).
  2. **The close** — the dashed *broken* track (`stroke-dasharray:"2 10"` :410)
     visibly **seals into a solid unbroken ring** as `p→1`, with a single restrained
     pulse at closure. That sealing instant is the "stop-scrolling" payoff — the
     line has become the circle the manifesto promised.
- **Files:** `landing.js initLoop()`/`setProgress()`, `index.html` (ring +
  artifact SVG), `styles.css`. Bump `landing.js` `?v=`.
- **New i18n:** none (stages already `landing.stageN_*`).
- **Fallback/a11y:** `fx`-gated; no-JS/reduced-motion → static **closed** ring
  with all four stages legible (the `<ol>` already carries them). Keep
  `ScrollTrigger.config({ignoreMobileResize:true})` (:41) so the pin doesn't jump
  on the iOS toolbar; heights in `svh`.
- **Risk:** **high** (pin + scrub + `svh` + iOS-Safari) → mandatory iPhone check.

### 5.6 finale — the orb where the loop seals
- **Current:** magnetic `#cta-orb` (:268), decorative dashed ring (:527-529).
- **Build:** tie the orb's dashed ring to `#loop`'s closure — on entering the
  finale the ring completes/seals (echoing 5.5), reinforcing "the circle is now
  whole; step in." Keep the magnet (`pointer:fine`). CTA stays **"UR Create
  starten" / join** — never "buy/order" (pre-launch).
- **Files:** `landing.js initOrb()` + a reveal hook, `styles.css`.
- **New i18n:** none.
- **Fallback/a11y:** ring closed & static without JS; orb is a real focusable
  `<a>`; label already i18n'd.
- **Risk:** high (motion feel, ties to loop) → device glance.

### 5.7 Studio headers (separate, lower-priority track)
- **`#measure` privacy → trust component:** promote the buried "100 % im Browser"
  line into a designed **"stays on this device"** badge/panel (CSS/SVG only — a
  device glyph + the client-side guarantee). The DSGVO/client-side claim in
  `pose.js`/`measurements.js` is load-bearing — mirror it, don't overstate.
  New visible copy → DE+EN keys (`measure.*`). **Risk: low.**
- **`#production` + `#faq` → "Fabrik-Dossier":** treat the spec sheet as a
  credible engineering blueprint — blueprint grid, technical framing, dimension
  lines as **decoration** (CSS/SVG). **Hard guardrail:** no fabricated numbers —
  `CONFIG.PRODUCTION_ESTIMATES` stays internal, `export.js` keeps emitting
  *planned* strings, not concrete CHF/lead-times. Keep the `@media print
  .spec-sheet` selector working (`Export.print()` depends on it). **Risk: low**
  (static styling), but verify print + `SpecView` still render.

---

## 6. Where I'd diverge from / sharpen the roadmap

1. **`#loop` "circle closing" is half-built already.** The arc draws today
   (`setProgress`). If we only re-draw it, it won't read as new. The payoff has to
   be the **dashed-broken → solid-sealed** transition *plus* stage-artifact
   morphs — otherwise it's polish, not the signature moment. Called out in 5.5.
2. **`#manifesto` — don't add a second ScrollTrigger, and don't promise a morph.**
   Two scrubbed triggers on one short section janks on mobile, and line→circle
   geometry morphing needs paid MorphSVG. Fold the thread's draw into the existing
   `manifestoTween` and *draw* a pre-curled path instead. (5.4)
3. **`#how` should stay JS-free.** The seam already self-draws in pure CSS on
   `.is-revealed`; extend that idiom rather than adding a module. Keeps the
   section's stated "keine neue JS" and is more robust. (5.3)
4. **`#your-style` — SVG over canvas.** A generative canvas "feel" is exactly what
   headless can't prove and burns a rAF loop on mobile; SVG strands frame-sample
   cleanly, degrade to a static drawn state, and keep the reveal recipe intact.
5. **Consistency guard on `--accent-warm`:** every PR's CSS review must confirm
   the token stays contained to `#your-style` — easy to leak once we're adding
   warmth-adjacent gradients.

---

## 7. Verification & merge gate (every PR)

**Standard loop (project rule — belegt, not "müsste passen"):**
- `npm test` (i18n DE/EN parity + suites), `validate-css`, `validate-html`,
  `validate-assets`, `deno lint` (const/let + arrows, no `var`), `e2e`.
- Headless render **desktop + mobile ≤480px**; **frame-sample motion over the
  full duration** (not two stills) — `npm run shoot -- <section>` or an ad-hoc
  Playwright sampler logging the animated value every ~100ms.
- axe-core on the changed section, desktop + mobile = **0 serious/critical + 0
  color-contrast**.
- Degraded paths: no-JS / reduced-motion / observer-never-fires → content still
  **visible**. No console errors. No overflow ≤480px.

**Auto-merge risk classification (per `CLAUDE.md`):**

| PR | Risk | Gate |
| --- | --- | --- |
| `#ai-done-right` (CSS static two-state) | **Low** | autonomous merge on green CI + own screenshots |
| `#how` vignettes (CSS-only) | **Low–med** | autonomous if headless frame-sample is clean |
| `#measure` trust component / Fabrik-Dossier (static) | **Low** | autonomous merge on green CI |
| `#your-style` warm thread (SVG draw) | **Med** | autonomous if frame-provable; device glance |
| `#manifesto` (scrub thread) | **High** | iPhone check before merge |
| `#loop` (pin + scrub + svh + iOS) | **High** | **mandatory** iPhone check before merge |
| finale orb (motion, ties to loop) | **High** | iPhone check before merge |

Branch prefixes (per `CLAUDE.md`): `visual/` for the look-&-feel beats,
`layout/` if a beat touches `svh`/sticky/overflow structurally. One task → one
branch → one PR → its own Vercel preview.

---

## 8. Open questions for the user (before build)

1. **Scope of this task:** is this document the deliverable, or should I proceed
   to implement beat #1 (`#your-style`) next?
2. **Sequencing:** OK to build calm→payoff as in §4, or do you want `#loop`
   (the headline moment) prototyped first despite the higher risk?
3. **Studio headers:** in-scope for this pass, or defer the `#measure` /
   Fabrik-Dossier track to a later batch (they're a separate, lower-priority
   thread from the narrative spine)?
