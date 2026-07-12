# Website-Review — revolveurban.com

> Analysis note (handoff, read with `CLAUDE.md`). Three upgrades, ranked by
> impact on the **user**, biggest first. Grounded in the current `main`: read
> across `index.html`, `css/styles.css`, `js/landing.js`, `js/ur-create.js` and
> the `js/design-engine/` flow; walked the studio journey; rendered every key
> section at desktop and ≤ 480 px.
>
> Visual version (pitched in the site's own Ocean-Depths language):
> https://claude.ai/code/artifact/a20c62f4-de97-4ba8-b13a-bbe812a4726a

> **Status update (2026-07-12 review, read before acting):** re-checked
> against `main` @ `e97ec55`. **#02 is shipped** (PR #385) — see its section
> below for what actually landed, including two items done in the same PR
> that were never part of this backlog (an honesty fix to the OG share image,
> and English becoming a first-class, URL-addressable language). **#01 and
> #03 are still open**; #01's own "revive the intro" idea now needs a
> deliberate call — see the flag in its section, don't just build it as
> written.

The landing film is finished — dramaturgy, type, weave, sphere all land. The
open work is the **product behind the CTA**: helping a first-time visitor
understand the studio, finish a design, and be captured at the moment they
care most. Everything here stays inside the pre-launch honesty rules
(be-first, never "buy"; no prices/dates; no fabricated proof).

| # | Upgrade | User impact | Effort | Risk | Status |
| - | ------- | ----------- | ------ | ---- | ------ |
| 01 | The studio's front door — onboard, shorten, unify the create journey | highest | medium | high-visual (motion) | **open — see flag below** |
| 02 | Convert at the peak — "be first" inside the ownership moment, tied to the design | high | low | low-visual, additive | **done — PR #385** |
| 03 | Delivery polish — wire AVIF variants, de-duplicate GSAP, minify | modest | low | non-visual | open |

---

## 01 · The studio's front door — *biggest lift* (still open)

> **Flag (2026-07-12): the first bullet below conflicts with a standing
> directive, don't build it as originally written.** `flow.js` `resetJourney`
> carries an explicit, dated comment — *"Direktive: kein Onboarding — sofort
> die erste Frage (kein Intro-Screen)"* — predating this doc (shipped in #334,
> 2026-07-03, two days before this review was written). `showIntro` is kept
> as a function on purpose but is not meant to be called. Reviving it is a
> product-direction reversal, not a UI tweak — **ask the user before building
> it**, per `CLAUDE.md`'s "ask before assuming" rule. The other two bullets
> (length/fatigue, two commit models) don't touch that directive and can ship
> independently — see the re-scoped recommendation at the bottom of this file.

The studio **is** the product. Ownership, sharing and signup only happen for a
user who understood it and finished. Today it drops them in cold.

**What's wrong**
- **No framing.** `showIntro` exists but is deliberately dead (`void showIntro`
  in `flow.js`, kept off by the "no onboarding" directive above). The user
  lands straight on an abstract mood question — *"Was zieht dich mehr an?"*
  shown as two landscape photos — with nothing explaining they're designing a
  garment, how long it takes, or that the idea stays theirs.
- **Length & fatigue.** The jacket path is still ~14 screens; the roadmap's own
  target was 8–10 taps, and phase E ("Details") is named the **#1 abandonment
  risk** — currently only *assumed* fixed, not measured against `insights.html`.
- **Two commit models.** Single-select cards commit on tap; slider / colour /
  ranking / regions need an explicit confirm. That inconsistency forced the
  350 ms `isGuardedTap` double-tap guard — a band-aid over a real seam.

**The upgrade**
- Revive the intro as **one quiet card** — one line of what happens, an honest
  "~10 taps," the promise "your idea, start to finish." Gate to first visit;
  deep-links and returning users skip it.
- **Lead with intent, then feeling** — let the abstract mood pair follow a
  concrete anchor. Re-weight node priorities in `engine.js` and lean on the
  `regions` board to hold phase E to one screen.
- **One commit pattern everywhere** (a single explicit confirm) — deletes the
  tap-guard and makes the journey feel deliberate, not twitchy.

**Benefit** — more users finish a design, the one metric the whole site depends
on; and a documented seam is retired instead of maintained.

**Visuals** — a first-visit frame ("You design. We make it.") with a single
Beginnen button, and an honest remaining-taps stepper (`3 · 10`) on the
existing GEFÜHL→FORM→STOFF→FARBE→DETAILS rail.

**How to build it** — rewrite the dormant `showIntro` in `flow.js`; move phase
weighting in `engine.js`; unify the modality commit contract. All copy through
`i18n.js` (DE+EN), all node content in JSON (the engine needed zero changes for
`regions` — keep that discipline). Verify with `scripts/shoot-journey.mjs`
across **all six** categories and the relevant `verify-*.mjs`; sample the
motion, don't trust two stills. High-visual → check on a real iPhone before merge.

**Re-scoped recommendation (2026-07-12)** — ship the length/fatigue and
commit-model fixes now, hold the intro-screen bullet for an explicit decision:
1. Delete the two-commit-model split — one explicit-confirm pattern for every
   modality, which also retires the `isGuardedTap`/`COMMIT_GUARD_MS` 350 ms
   double-tap band-aid in `flow.js` (still present as of this review).
2. Re-weight `engine.js` node priorities so phase E ("Details") leans harder
   on the already-shipped `regions` board instead of adding screens, pulling
   the jacket path (still ~14 screens) toward the 8–10 tap target.
This is lower-risk than reviving `showIntro` (no new UI surface, no reversal
of a standing directive) and ships most of #01's user-facing benefit —
recommended as **the next PR**, see the bottom of this file.

---

## 02 · Convert at the peak — *shipped, PR #385 (2026-07-11)*

**What landed:** a "reserve this piece" capture card in `#ownership` —
rendered flat + `own.reserve*` copy (DE+EN) + email/consent, POSTing to the
existing Formspree endpoint together with the design's DNA string and share
link (no image, no extra PII), so the reservation is tied to the piece the
visitor made. `join.ok` was rewritten from the vague "we'll be in touch" to a
concrete confirmation. The bottom `#join-form` in `#community` was left
in place, unchanged. Verified at the real render (desktop + mobile) by the
PR author, including the empty-submit and mocked-Formspree success paths.

**Also landed in the same PR, outside this backlog** (worth knowing about,
not further action items): the social share OG image was replaced —the old
one asserted "KI-Design" and named a Swiss-tailor/PET-fibre/14-day supply
chain, violating both the AI-role rule and the pre-launch no-fabricated-facts
rule — with hero-language imagery inside the honesty rules; and English
became a first-class, URL-addressable language (`?lang=`, `navigator.language`
fallback, `hreflang`), where before the site defaulted every visitor to
German regardless of browser language.

---

## 02 (original) · Convert at the peak

The strongest asset the site ever creates is a design the visitor **made**.
Right now that asset is never used as a reason to come back.

**What's wrong**
- **The peak has no capture.** At `#ownership` — "this design exists because you
  made it" — the only actions are Save, Share, Publish, Make real. No "be first."
- **"Save" is a dead end.** `own-save` writes to `localStorage` only —
  device-bound, gone on the next phone, tied to no identity.
- **The real signup is buried.** The only email capture is the `#join-form` at
  the very bottom of the page, inside `#community` (index.html ~L1278), after the
  whole narrative and the studio. A visitor who peaks in the studio never reaches
  it — and its confirmation is a vague *"Wir melden uns" / "we'll be in touch."*

**The upgrade**
- Put a **"reserve this piece"** card in the ownership actions: the design
  beside one email field + consent.
- **Tie the signup to the design** — POST the `DesignShare` DNA string alongside
  the email, so the piece the user made *is* what they're first in line for.
- **Reward it concretely and honestly** — confirmation becomes "You're in — your
  design is saved to your spot," within the pre-launch rules.

**Benefit** — intent captured where it's highest; the co-created design becomes
the hook instead of a throwaway; the "be first" list fills with people who
already built something.

**Visuals** — an inline reservation card (rendered flat + `[ BE FIRST ]` mono
label + email field), keeping the magnetic / mono brand language.

**How to build it** — add the email field to `#ownership`; reuse the `join.*`
validation and the live Formspree endpoint already in `ur-create.js`, appending
the DNA to the payload (it already sends `interests`); rewrite `join.ok`
(DE+EN). Purely additive, no engine changes, low-visual → mergeable once CI is
green. Keep the bottom form too.

---

## 03 · Delivery polish — *the last honest grams*

The site is already conscientiously tuned: everything async/defer, fonts subset
+ preloaded, three.js/MediaPipe lazy, a CI weight budget. These are cleanups,
not a rescue — which is why they rank last.

**What's wrong**
- **AVIF made but unused.** `assets/story/` ships `.avif` and `-sm` variants,
  but `gallery/gallery.js` serves the `.jpg` only — ~1.7 MB of already-generated
  savings unrealised.
- **GSAP loaded twice** — 3.15.0 eagerly for the landing, 3.13.0 lazily for the
  sphere: duplicate dependency *and* version mismatch.
- **36 unminified first-party scripts** (~3.5 MB on disk); two stylesheets
  (`styles.css` + `fonts.css`) block the head.

**The upgrade** — wrap story imagery in `<picture>` with AVIF + a `srcset` of
the existing `-sm` variants (zero new assets); consolidate to one GSAP version;
add a minify pass served under the existing `?v=` immutable-cache pattern.

**Benefit** — faster first paint and less data, felt most on mobile / slow
connections. Incremental by nature.

**How to build it** — `<picture>`/`srcset` in the gallery; one GSAP version in
the importmap; an optional minify step (no bundler — keep "drop it on any
host"). All non-visual → merge autonomously once the seven CI checks are green.

---

## What I would *not* touch

A review is also a list of what to leave alone. These are already right; changing
them would be motion for its own sake.

- **The landing film** — preloader → weave → line-into-circle → sphere is the
  signature, and it works desktop + mobile.
- **The three-register type + Ocean-Depths palette** — distinctive and
  consistent; this note is pitched inside it on purpose.
- **The honesty discipline** — no fabricated proof, no prices, "be first" not
  "buy." Every upgrade above stays inside it.
- **The privacy posture** — client-side measurements, self-hosted fonts,
  explicit opt-in for the one external (VTO) render. Load-bearing trust; don't
  trade it for a metric.

---

## Re-ranked open work & recommended next PR (2026-07-12 review)

With #02 shipped, two items remain. Re-ranked by impact/effort/risk:

| Rank | Item | Impact | Effort | Risk | Why this order |
| ---- | ---- | ------ | ------ | ---- | --------------- |
| 1 | #01, re-scoped: one commit model + phase-E reweighting (drop the intro-screen bullet) | high — completion is the site's one load-bearing metric | medium (`flow.js` interaction contract + `engine.js` priorities) | low-mid — no new UI surface, existing `shoot-journey`/`verify-*` harness covers it | Delivers most of #01's user-facing value without touching the "no onboarding" directive |
| 2 | #03 Delivery polish | modest, mobile/slow-connection users | low | none (non-visual) | Real but small win; safe autonomous-merge candidate whenever there's a gap |
| — | #01's intro-screen bullet | unknown until decided | — | high (product-direction reversal) | Blocked on a product decision, not on engineering — raise it, don't build it speculatively |

**Recommended next PR:** *"Studio journey — one commit model + phase-E
reweighting"* (branch `engine/unify-commit-model`), scoped exactly as the
re-scoped recommendation under §01 above.
- **Impact:** highest available right now — journey completion is called out
  in this doc itself as "the one metric the whole site depends on," and the
  fix retires a documented workaround (`isGuardedTap`) instead of adding one.
- **Effort:** medium — an interaction-contract change in `flow.js` plus JSON
  priority tuning in `engine.js`/`content/nodes/*.json`; no new markup, no new
  i18n strings.
- **Risk:** low-mid, not high-visual — it changes *when* a screen commits and
  *which* screen appears next, not what anything looks like. Still verify
  with `scripts/shoot-journey.mjs` across all six categories + the relevant
  `verify-*.mjs`, motion-sampled per the project rule, before merge.
- **Dependencies:** none blocking. It should land *before* any future
  intro-screen work, since that work would otherwise inherit the same
  two-commit-model inconsistency it would need to unify anyway.
- **Explicitly not this PR:** reviving `showIntro` — flag it to the user as a
  standing-directive reversal and get an explicit answer first.
