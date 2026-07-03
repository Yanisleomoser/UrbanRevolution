# UR-Create Studio — UX Upgrade Roadmap & Diagnosis

> Handoff note for making the **studio journey** (decision tree → your own
> garment) award-worthy. Distilled from a full code read of `js/design-engine/`
> + a scripted headless walkthrough of the real journey (every question screen,
> desktop 1440 + mobile 390, jacket path to the refine screen — see
> `scripts/shoot-journey.mjs`). Read together with `CLAUDE.md` and
> `docs/VISUAL-ROADMAP.md` (the landing counterpart; its principles carry over).

---

## 1. Core diagnosis

The engine underneath is **genuinely award-grade thinking**: a data-driven,
adaptive node selector (priority × information-gain, no hard-coded tree), a
morphing parametric flat, a genesis nebula before the category exists, resume,
share-links, honest phase stepper, telemetry, a11y and reduced-motion
throughout. Nobody else has this mechanic. **The problem is that the
experience layer doesn't perform the mechanic.** The journey *reads* as a
well-made form with a preview panel: hard question swaps (raw `innerHTML`
replace, zero enter/exit choreography), a native range slider, plain pill
buttons, generic line-art icons, a colour picker of raw dots, and a refine
screen that stacks four form sections where the emotional crescendo should be.
The landing is a two-act film; the studio — the product's heart — is a
questionnaire wearing the film's colours.

**The one-line strategy:** don't add effects — *stage the engine you already
built.* Every mechanic below exists in code and just needs a visible,
choreographed moment: the genesis→weave materialisation, the per-answer morph,
the archetype inference, the concept evolution, the made-for-one measurements.

### Awwwards scorecard (studio only, current → potential, 1–10)

| Category (weight)         | Now | Potential | Gap |
| ------------------------- | --- | --------- | --- |
| Visual Design (40%)       | 5   | 9         | Form-like modality surfaces (native slider, dot palette, pill grids); flat proportions; no bespoke moment per phase |
| Usability (30%)           | 7   | 9         | Strong bones (back/skip/resume/a11y) but: mobile preview scrolls away, inconsistent commit models, fat-finger generate, 16–19-question fatigue |
| Creativity (20%)          | 6   | 10        | The adaptive engine + genesis→weave is a signature nobody has — currently invisible in ~400 ms of subtlety |
| Content/Storytelling (10%)| 6   | 9         | Journey has no narrative arc: no threshold moment, no phase beats, no finale; sentence fragments ("Stück.", "Jacke.") as debris |
| Mobile                    | 5   | 9         | ≤480 px: preview static → colour/fit decided blind; long scroll pages |
| Accessibility             | 8   | 9         | Focus management, ARIA, reduced-motion already in place — protect it |
| Performance               | 9   | 9         | SVG flat + CSS; keep it that way (no WebGL in the journey) |

---

## 2. What's already strong — protect, don't trade away

- **Adaptive engine** (`engine.js`): emergent ordering, soft-mood retraction,
  phase bias. Don't replace with a hard-coded wizard.
- **Genesis → weave concept** (`render-preview.js`, `garment-svg.js` nebula):
  the right idea — under-performed, not wrong.
- **Live flat + chips + sentence** as three feedback registers.
- **Honest progress** (phase stepper, "Fertig" as affordance not gauge).
- **Safety rails**: back/skip/restart, localStorage resume, share round-trip,
  focus-to-question on advance, telemetry breadcrumbs, `prefers-reduced-motion`.
- **Concept studio** (4 deterministic mutation directions + EVOLVE chains).
- All content in JSON (`content/nodes/*.json`) — keep new UX data-driven.

---

## 3. Defect inventory (verified at the real render — fix first, all low-risk)

These are trust-erosion bugs at the exact moments the user studies their piece.
Each was seen in the walkthrough screenshots, not inferred.

1. **Sentence fragments as debris.** Before enough DNA exists,
   `DesignSummary.toSentence` renders bare "Stück." / "Jacke." under the
   controls (`#de-live`). Suppress below a minimum maturity, or render a
   styled placeholder ("… entsteht" in mono), never a bare fragment.
2. **Material label contradiction.** `jacket_material` card says
   **"Recycled Nylon"** but sets `fabric.material: "polyester"` →
   chip + sentence say **"Recycled Polyester"** (`nodes/jacket.json` L51 vs
   `I18N.material`). Either add a real nylon key or rename the card. Audit all
   branches for label↔key drift.
3. **Chip duplication.** Fit "Regular" + length "Regular" render as two
   identical chips ("Regular · Regular"). Prefix chips by dimension (mono
   micro-label: `FIT Regular · LÄNGE Regular`) — also fixes chip legibility.
4. **Fat-finger generate.** The refine screen's generate button shares
   `.de-confirm` with every modality confirm; single-select cards commit on
   tap while slider/colour/ranking need "Weiter". A double-tap on the last
   card question lands on the next screen's confirm — our own walkthrough bot
   accidentally *generated a design* this way. Unify the commit model (see §6)
   and give generate its own class + a ~350 ms input-guard after render.
5. **Realism photo contradicts the design** (the worst one). At convergence
   the flat crossfades to a curated photo keyed only by
   `category×archetype` (36 images, `heroCandidates`) — user built an
   *oversized cropped zip puffer, deep-red gradient*; photo showed a *classic
   notched-collar button blazer*, duotoned pink. At the single most decisive
   moment the product visibly ignores the user's decisions. Fix = honesty
   gate: only crossfade when the photo matches the load-bearing attributes
   (closure/subarchetype at minimum — encode them in the filename or a
   manifest JSON); otherwise **keep the flat**, which is always correct. The
   flat-only ending is better than a wrong photo.
6. **Weave-in moment doesn't land.** Frames sampled 120–600 ms after the
   category pick show the flat already fully painted — the one-time
   genesis→silhouette draw-in (`.is-weave`) is over before the eye arrives, so
   the product's signature beat reads as a snap. Make it the hero beat (§5).
7. **Question order oddity.** `jacket_fit` ("Wie sitzt sie?") surfaces before
   `jacket_subarch` ("Welche Art Jacke?") — the pronoun refers to a garment
   type the user hasn't chosen; the preview shows a default long coat that
   then jumps. Nudge `jacket_subarch` priority above `jacket_fit` (pure JSON
   change; same for other branches).

---

## 4. Mobile: the broken feedback loop (structural, high value)

At ≤480 px `.de-preview-col` goes `position: static` (styles.css ~L5100) — the
preview scrolls away exactly when the user makes the *visual* decisions
(colour, fit, pattern). The core loop "choose → see it change" only exists on
desktop.

**Fix: a docked mini-preview.** When the full preview scrolls out of view on
small screens, dock a compact flat (~72–88 px, current colours/shape, tappable
to scroll back up) in a corner via IntersectionObserver — same pattern as the
existing `[data-ticker-kg]` badges: tiny, calm, informative. The morph then
visibly plays *in the dock* on every answer. (Alternative — sticky 30svh
preview above questions — costs too much viewport at 390×844; the dock wins.)
Verify on-device (iOS toolbar/svh) before merge — high-risk class.

---

## 5. The signature: "Der Faden" — one continuous thread metaphor

The brand already owns a thread: the preloader draws a needle logo, the hero is
a thread-particle field, the genesis stage is thread-flow, the landing's story
is "Die Linie und der Kreis". Make the studio the third act of that same
material: **the line becomes your garment.**

1. **Threshold (studio entrance).** Today `revealStudio()` is a bare `hidden`
   toggle — a hard cut from cinematic landing into the studio. Stage it: the
   CTA orb's circle expands into the studio surface (clip-path circle from the
   orb's position, ~600 ms, `html.fx` only), the genesis threads already
   drifting inside it. The landing's geometric conclusion (the circle) is
   literally the portal into UR-Create. Reduced-motion / deep-links: instant,
   as today.
2. **Genesis that responds.** The nebula already takes `energy`/`structure`/
   `archetype` — make each mood answer visibly re-tension the threads (calm =
   long slow arcs, bold = tight fast crossings). The user should *feel* the
   engine listening before a garment exists.
3. **The weave (category pick) as the hero beat.** Slow the one-time draw-in
   to ~1.2–1.6 s: threads align, then the flat's outline draws along its
   paths (`stroke-dashoffset`, like `#how`'s arc), panels fill last. This is
   the "I've never seen this" moment juries screenshot. One-time per journey,
   reduced-motion = instant, and *verify by frame-sampling the full duration*
   (project rule — two stills already lied to us here once).
4. **Generate = the machine sews.** While `AI.generateDesign` runs (1–4 s),
   don't just disable a button ("Generiere …"): run the thread field over the
   flat — the autonomous factory stitching. The wait becomes the story's
   payoff instead of a spinner. On resolve, name-plate types on in JetBrains
   Mono (the "machine voice"), then the ownership moment takes over.

Everything above is CSS/SVG/rAF on the existing stack — no new deps, no WebGL.

---

## 6. Choreography & rhythm (the craft layer juries score)

- **Question transitions.** Replace the hard swap with a two-phase
  choreography: outgoing content fades/translates 8 px down (~140 ms), new
  question + options stagger in (~40 ms/child, ≤250 ms total — the project's
  transition ceiling). The machinery exists (`urConceptIn` for concept tiles);
  generalise it on `#de-body` render. Keep focus management exactly as is.
- **Preview reactions.** On commit, briefly highlight the *changed region* of
  the flat (the model is parametric — collar/hem/pockets are known paths): a
  200 ms stroke-glow on the part the answer touched. The flash chip tells,
  the glow *shows*.
- **Phase interstitials.** Crossing A→B→C→D→E, let the stepper beat pulse and
  a mono micro-title ("STOFF") appear for ~400 ms above the question. Cheap,
  calm, gives the 16-step journey perceptible chapters.
- **Unify the commit model.** Cards commit on tap (good — keep); make
  slider/colour auto-commit optional ("Weiter" stays for multi-step choices,
  but the tap targets get a consistent selected→advance rhythm with a ~250 ms
  settle so the user sees the state before the swap). At minimum: consistent
  timing, distinct generate button class, input-guard after render (§3.4).
- **Modality surfaces to couture level:**
  - *Slider* → styled track with live value ghost on the flat (native input
    under the hood for a11y — restyle, don't replace).
  - *Colour* → replace the raw dot grid + giant black rectangle with named
    fabric swatches (Tiefrot, Salbei … via `I18N.colorName`), dyeing the flat
    live; the "preview rectangle" dies — the *garment* is the preview.
  - *Category icons* → six bespoke mini-flats from `GarmentSVG` itself
    (consistent language) instead of the near-identical 64×64 line glyphs
    (t-shirt/shirt/hemd currently read the same).

---

## 7. Journey length & the detail grind

Jacket path today: up to 16 answered screens (19 nodes gated by energy);
phase E alone is **six consecutive near-identical card grids** (closure →
collar → sleeve → pockets → cuffs → hem). Fatigue is the #1 abandonment risk
(telemetry `abandon` events will confirm — check `insights.html` aggregates).

- **Target: ~8–10 taps to a confident "Fertig".** Phase A–D as today (they're
  varied and fast); compress phase E.
- **The hotspot board (the right compression).** `engine.js` already parses a
  `regions` node shape (`targetPaths`/`hasWeights` walk `node.regions` —
  L45/L55) but **no `regions` renderer exists in `DEModalities`**: it's a
  designed-for extension point. Build it: one screen, the flat large in the
  centre, tappable hotspots on collar/closure/sleeve/pockets/cuffs/hem; each
  opens a 3–4-option micro-picker anchored to the part; answers write the same
  effects the six card nodes write today. Six screens become one interactive
  "detail atelier" — *and* it's the most award-distinctive surface in the
  whole journey (direct manipulation of the garment). Keyboard path: hotspots
  are buttons in DOM order; reduced-motion unaffected. Data stays in JSON
  (one `regions` node per category replaces six card nodes).
- Until the board ships: keep "Fertig" prominent once mature (today it's a
  quiet text button that appears far right; give it the confirm gradient) and
  route the remaining detail nodes behind "Tiefer verfeinern" — the engine
  already supports finishing early; make the affordance feel first-class.

---

## 8. The decisive moment (refine screen) — from settings page to crescendo

Today (`renderRefine`): summary sentence, 4 concept tiles + 4 repeated
"Weiterentwickeln" buttons, inferred chips, 3 axis rows of grey
"weniger/mehr" pills, freetext, Teilen/Generieren, then the sentence *again*
at the bottom. ~1400 px of stacked form on desktop. Restage it:

1. **Arrival beat first.** Stage dims, the flat does a final materialisation
   pass (reveal → 1), the sentence types on (mono) *above* everything. One
   breath before options appear.
2. **Concepts as fabric swatches, not thumbnails.** The four tiles are
   currently near-identical dark flats; the mutations (hue ±34°, fit ±0.15)
   don't read at 150 px. Give each direction a *name derived from its delta*
   ("Wärmer & cropped", "Muster gewagt") and render tiles bigger, on lighter
   stage material. Also: `mutateDna`'s pattern lottery can introduce a pattern
   the user explicitly cleaned away — respect a chosen `pattern.type: none`
   (mutate colour/fit/finish instead). One EVOLVE control on the *selected*
   card replaces four repeated buttons.
3. **Axis nudges as sliders-on-the-flat** (or at least accent-styled steppers
   with a live 100 ms response on the preview) instead of grey form pills.
4. **Kill the duplicate sentence**; the top one is the design's voice.
5. **Realism honesty gate** from §3.5 governs whether a photo ever appears
   here.

---

## 9. After generate: the ownership handoff

`onDesign` → `applyJourneyDesign` scrolls to `#ai-output` while the journey
column stays behind; the ownership section reveals separately. The seam
between "journey done" and "this is yours" is where the emotional payoff
lives — today it's a scroll jump between two surfaces. Stage the handoff as
one continuous motion (§5.4 sewing → name-plate → ownership card slides in),
and pull the **made-for-one moment** forward: the flat subtly re-proportioned
from the user's measurements once they exist (`Measurements` + parametric
flat = a personal silhouette nobody else renders client-side). That is the
brand thesis made visible.

---

## 10. Prioritised roadmap (PR-sized, per repo branch conventions)

Ship order = trust first, loop second, signature third, crescendo fourth.
Every visual PR: verify via `npm run shoot` + `scripts/shoot-journey.mjs`
(desktop + ≤480 px; animations frame-sampled over full duration). Auto-merge
policy: low-risk visual merges autonomously on green CI + verified shots;
anything scroll/sticky/`svh`/iOS or the entrance transition gets a real-iPhone
check via the Vercel preview before merge.

| # | Slice (branch)                                        | Contents | Risk class |
|---|-------------------------------------------------------|----------|------------|
| 1 | `fix/studio-trust-details`                            | §3.1–3.4 + §3.7 (fragments, label drift, chips, commit guard, node order) | low |
| 2 | `engine/realism-honesty-gate`                         | §3.5 photo↔DNA match gate + manifest | low (logic + unit tests) |
| 3 | `layout/mobile-docked-preview`                        | §4 dock | **high — iPhone check** |
| 4 | `visual/question-choreography`                        | §6 transitions + phase interstitials + generalised stagger | low-mid (frame-sample) |
| 5 | `visual/weave-hero-beat`                              | §5.3 slowed draw-in + §5.2 responsive genesis | mid (frame-sample) |
| 6 | `visual/studio-threshold`                             | §5.1 orb→studio portal | **high — iPhone check** |
| 7 | `visual/colour-atelier` + `visual/modality-polish`    | §6 colour/slider/category-icon surfaces | low |
| 8 | `engine/regions-hotspot-board`                        | §7 detail atelier (renderer + per-category JSON) | mid (a11y + e2e) |
| 9 | `visual/refine-crescendo`                             | §8 restaged refine + concept naming + mutation respect | mid |
| 10| `engine/sewing-handoff` + `visual/ownership-seam`     | §5.4 + §9 | mid |

**Metrics to watch** (already collected — `insights.html`): completion
(`journey_refine` / first `node_shown`), `abandon` node distribution (expect
phase-E cluster today), `generate` rate, `node_skip` hotspots, `concept_evolve`
usage. Define success as completion ↑ and time-to-Fertig ↓ while generate rate
holds.

---

## 11. Guardrails (non-negotiable while doing all of the above)

- No framework, no bundler, no WebGL in the journey; classic IIFE modules;
  CSS/SVG/rAF only. `config.js`/JSON stay the source of truth.
- Every motion gated on `html.fx`; `prefers-reduced-motion` = complete static
  experience; no-JS still shows all content. Transitions ≤ 250 ms except the
  two sanctioned hero beats (weave, threshold).
- All new strings through `i18n.js` (DE + EN). All new node content in JSON.
- Keep the a11y contract: focus-to-question, ARIA states on tiles/swatches,
  keyboard paths for every new surface (hotspots included), axe gate green.
- Flat rules from `CLAUDE.md` §Design-Engine: clean fashion-flat, never over a
  photo mid-journey, shoulder widest, sleeves visible, morph via transforms.
- Bump `?v=` for any versioned JS/CSS touched; unit tests for every new pure
  helper (mutation respect, honesty gate, region effects) — coverage floor.

---

## 12. Status & session handoff (updated 2026-07-03)

### Shipped (slices 1–4, all merged to `main`)

| # | Slice | PR | What landed |
|---|-------|----|-------------|
| 1 | `fix/studio-trust-details` | #328 | Fragment-free live sentence (≥ half maturity); chips with mono dimension labels that echo **the tapped card's word** across all six categories (`choiceWord`, side-effect-safe: fewest-set-paths wins); Nylon→Polyester truth + gender-correct German finish adjective ("aus matter Wolle"); engine-pattern i18n fallbacks; 350 ms double-tap guard (`isGuardedTap`) on commits **and** generate; `jacket_subarch` before `jacket_fit` (0.85→0.72) |
| 2 | `engine/realism-honesty-gate` | #329 | `content/preview-photos.json` — all 36 convergence photos individually described; **12 retired** (colorblock no DNA can produce, a two-piece "dress", 4 of 6 "pants" photos show full suits). `photoMatches`/`matchingCandidates` in render-preview.js: photo only crossfades when nothing it shows contradicts a decided DNA value; fail-closed, rejected photos never loaded |
| 3 | `layout/mobile-docked-preview` | #330 | 76 px dock, thumb corner, ≤480 px + preview <30 % visible + journey on screen (`dockShouldShow`); mirrors **every** render/morph frame (`opts.mirror` in renderInto/morph); tap = rAF scroll-tween back to the stage; hoisted to `<body>` (see pitfalls); iPhone-verified by the user |
| 4 | `visual/question-choreography` | #332 | Two-phase question swap (`deStepOut` 150 ms → `deStepIn` 240 ms staggered, `html.fx` only); preview morph starts WITH the entrance (see pitfalls); commits blocked mid-swap, pending paint replaced on double navigation; phase interstitial on a permanently reserved mono line + stepper-dot pulse (no interstitial on the crossing into refine); "Fertig" as gradient pill. Verified across all six categories: every swap choreographed, interstitials only on real chapter crossings, 0 page errors |

Also permanent: `scripts/shoot-journey.mjs [viewport] [category]` — deterministic
walkthrough of any branch, every question screen + weave frames to
`screenshots/journey/`, fails on page errors. Use it for **every** studio change.

### Next up

Slice 5 `visual/weave-hero-beat` (§5.2–5.3), then slice 6
`visual/studio-threshold` (§5.1, **iPhone-gated**), then 7–10 per §10.

### Hard-won pitfalls (cost real debugging time — read before touching the studio)

1. **This container renders ~13 fps** (software raster; the genesis nebula keeps
   the compositor busy). Sub-300 ms motion CANNOT be verified by screenshots or
   even rAF-opacity sampling — a 150 ms window can pass without a single frame.
   Verify short motion via in-page rAF curves for ≥400 ms animations, and via
   `el.getAnimations()` (name/duration/playState) + an isolated manual-class
   curve for shorter ones. Long-running loops (morph) starve everything else:
   sequence heavy work AFTER short animations, never in parallel.
2. **`position: fixed` is hijacked inside the studio.** The revealed `#design`
   section keeps an identity `transform` from its reveal animation and
   `.design-journey` has `will-change: transform` — both create containing
   blocks. Any fixed overlay must be hoisted to `document.body` (the dock does
   this at mount).
3. **Single-select cards commit on tap and the next screen renders under the
   finger.** Any new tappable surface near the confirm position needs the
   `isGuardedTap`/`swapping` guards; test tools must not blind-click
   `.de-confirm` after a card tap (that's how the bot once fired generate).
4. **The `test` CI check (deno lint) flakes on Deno-CDN outages** ("fetch
   failed" in setup-deno before lint runs). Re-run failed jobs after ~15–20 min;
   never "fix" code for it.
5. **After every squash-merge the remote branch auto-deletes** → `git remote
   prune origin` before pushing the restarted branch, or push rejects with
   "stale info". Session branch flow: restart from `origin/main`, keep the same
   branch name, one PR per slice; never push while a gated PR is open on the
   branch (hold commits locally, cherry-pick after the merge).
6. **Verify per category, not per code path.** Chips/labels/photos/flats all
   have per-branch data; three separate cross-category defects were only found
   by walking all six branches at the render (`shoot-journey.mjs desktop dress`
   etc.). "It's category-agnostic code" is a hypothesis, not a verification.
7. **Merge gates:** docs/CI/api = autonomous merge on green CI. Animation feel,
   scroll/sticky/`svh`, iOS layout = user checks the Vercel preview on a real
   iPhone first (the dock and the choreography both went through this). CI =
   seven functional checks; "Vercel Agent Review" is neutral/non-blocking.
