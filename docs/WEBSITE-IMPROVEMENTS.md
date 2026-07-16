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

> **Status update (2026-07-13 review, read before acting):** re-checked
> against `main` @ `5e5cbf3`. **12 PRs (#390–#409) landed since the
> 2026-07-12 sync above — none of them are in this doc, because they came
> from a separate, never-committed "redesign brief" plus a separate
> "Design-Studio-Audit," not from this backlog.** Full accounting:
> - **#03 is now partially shipped:** GSAP de-duped to one version (PR #389,
>   2026-07-12). AVIF wiring and script minification are still open — see
>   §03 below, unchanged otherwise.
> - **#01 has had zero code movement** — `isGuardedTap`/`COMMIT_GUARD_MS` is
>   still in `flow.js` verbatim, `jacket.json` node weights are byte-identical
>   to the 2026-07-12 review. It remains the single largest open item, see
>   the re-ranked table at the bottom (unchanged recommendation).
> - **A "redesign brief" (R-series) shipped R1, R2, R3, R5, R11, R13** as six
>   separate PRs (#400/#409/#408/#406/#404/#407) — studio-reveal scroll
>   clipped behind the navbar, a hero email capture + garment photo ("Mockup
>   A"), two WCAG contrast fixes (manifesto word-scrub, ghost-button border),
>   and a mobile `#machine` sticky-pill overlap fix. **The source document was
>   never committed to the repo and is now unrecoverable** — R4, R6–R10, R12
>   and anything past R13 have no PR, no code trace, and no record of their
>   content anywhere (confirmed via repo-wide code search). If whoever ran
>   that 2026-07-10 audit still has the session transcript, recovering it
>   would be worth doing; otherwise treat those numbers as permanently lost.
>   **One stale duplicate is still open: PR #402** is an independent, unmerged
>   R5 draft superseded by the merged #406 — recommend closing it.
> - **A separate "Design-Studio-Audit" shipped C1–C5 in one PR (#401):** a
>   skipped first mood question was silently hiding the pattern/signature/
>   hardware nodes (undefined `intent.energy` failing every `>` gate) — now
>   seeded neutral; the category question is now deterministically Q3; two
>   dead colour fields removed; a recolour now cross-fades instead of
>   snapping; a zip-hoodie's kangaroo pocket now draws a real split pouch
>   instead of silently doing nothing. **C2's "Variant 2" (a longer mood
>   preamble) is explicitly deferred, pending a product decision** — same
>   category of open call as #01's intro-screen flag below. A related,
>   non-numbered copy fix (PR #405) added a one-line "your piece begins with
>   a feeling" kicker above the opening question, which addresses part of
>   C2's other deferred item (the "reads like a quiz" framing gap) without
>   building a full intro screen.
> - **Also shipped, unrelated to either brief:** a server-rendered `/en/`
>   English page + footer-link/asset-path fixes (#394/#397/d883b65); the
>   site's dead contact address swapped to a real mailbox (#403 — the old
>   `hello@revolveurban.com` had no MX record); the Handelsregister/MWST
>   Impressum TODO resolved with an honest pre-launch note (#391); a sticky
>   "UR Create starten" CTA fix (#399); a studio neutral-flat/sub-archetype
>   fix (#395); and test-coverage additions (#392/#393/#398).
> - **Two open GitHub issues are real backlog, tracked nowhere else:**
>   **#384** — the Impressum's "Verantwortlich für diese Website" block still
>   ships literal `[Vollständiger Name / Firmenname]` / `[Strasse und
>   Hausnummer]` / `[PLZ] Zürich` placeholders on the live legal page (a
>   compliance gap, not just cosmetic) — **needs real business data from the
>   site owner, not something to build**. **#383** — an Instagram `sameAs`
>   link/footer icon and a dedicated "credibility block" section were
>   investigated and explicitly *not* built, pending a scope/copy decision
>   (Instagram needs a real handle; the credibility block needs copy that
>   doesn't read as a disclaimer).
> - **One more stale open PR: #363**, a draft prototype preview page for
>   this doc's original #01/#02/#03 mockups, based on a commit from
>   2026-07-05 (before #02 shipped, before the GSAP dedupe, before all of the
>   above) and explicitly marked "not meant to merge." Safe to close or
>   ignore — it predates most of what's now shipped.

> **Status update (2026-07-14 review, read before acting):** re-checked
> against `main` @ `c6b9a85`. Four PRs landed since the 2026-07-13 sync above
> (#411–#414), none of them touching #01:
> - **R4 and R10 are no longer lost.** A mobile "back to top" FAB (**R4**,
>   PR #412 — the header deliberately scrolls away on touch per the
>   iOS-WebKit #297779 workaround, so past the hero there was no way back up;
>   now a bottom-anchored, mobile-only FAB that retreats near the studio dock
>   and the machine blueprint) and a real hover vocabulary for the landing
>   (**R10**, PR #411 — token-based depth/glow/lift on the CTAs and station
>   cards, ≤ 250 ms, reduced-motion neutralised) both shipped. Each carries
>   its own fresh session transcript rather than a recovery of the original
>   2026-07-10 brief, so treat these as newly authored fixes that happened to
>   land on those two numbers, not evidence the lost brief was found.
>   **R6–R9, R12 and anything past R13 are still unaccounted for** — no PR,
>   no code trace of their content anywhere.
> - **Issue #383 is now half-resolved.** The Instagram half shipped in PR
>   #414 — the real, owner-confirmed `@revolveeurban` handle now sits in the
>   Organization JSON-LD `sameAs` and as a footer icon. The **credibility
>   block** half is still explicitly deferred pending a scope/copy/placement
>   decision, unchanged from the 2026-07-13 note (confirmed still absent by
>   two follow-up audits on the issue itself).
> - **Repo hygiene: PR #402 is closed** (confirmed on GitHub — the superseded
>   R5 duplicate this doc already recommended closing). **PR #363 is still
>   open** and now even more clearly stale (predates #02, the GSAP dedupe,
>   and everything else listed above) — still recommend closing it.
> - **One unrelated bugfix also landed:** #413, the `/en/` mobile hero
>   `<source>` 404 (`build-en.mjs` rewrote `href`/`src` to root-absolute but
>   missed `srcset`) — found by the same live-site audit that shipped #414,
>   not part of any tracked backlog item.
> - **#01 remains completely untouched** — `isGuardedTap`/`COMMIT_GUARD_MS`
>   is still verbatim in `flow.js`. It is still the single largest open item;
>   the re-ranked table at the bottom is unchanged from 2026-07-13.

> **Status update (2026-07-15 review, read before acting):** re-checked
> against `main` @ `caf0083`. One PR landed since the 2026-07-14 sync above
> (**#417** — `community-sphere.js` now reuses the already-loaded global GSAP
> instead of re-fetching a second, separately-cached ESM copy on lazy boot) —
> a small delivery-polish win in #03's spirit, but not one of its two
> still-open sub-items (AVIF wiring, script minification), which are
> unchanged.
> - **Repo hygiene closed out:** **PR #363** is confirmed closed (unmerged,
>   2026-07-14) — the 2026-07-13/14 recommendation to close it is done; drop
>   it from the hygiene row below.
> - **Two open draft PRs surfaced that this doc didn't know about — neither
>   is the recommended next PR, and no `engine/unify-commit-model` branch (or
>   similar) exists yet.** Both already have all seven functional CI checks
>   green:
>   - **#416** — a real correctness bug in the colour atelier
>     (`modalities/colorGradient.js`): the refine-screen confirm was never
>     disabled before a swatch tap, so hitting it early silently commits
>     `{scheme: "mono", stops: ["#1a1a1a"]}` at full confidence — into the
>     live flat, the AI prompt, the spec sheet, and any shared/published DNA.
>     Found by routine code review, fixed by mirroring `cards.js`'s existing
>     disable-until-selected pattern. Small, low-risk, still in **draft**.
>     Recommend un-drafting and merging as-is, and doing so *before* #01
>     below — #01 rewrites the same commit-model surface this PR touches.
>   - **#418** — "Reclaimed Light," a hero visual glow-up (scroll parallax on
>     the photo, a copper `mix-blend:screen` aura, magnetic CTAs) — from a
>     "make the site sexy" instruction outside either roadmap doc. Additive
>     and `html.fx`-gated, not a replacement of the landing film this doc's
>     "what I would not touch" section calls finished, but it's new,
>     uncoordinated scope worth knowing about. Explicitly flagged
>     **high-risk visual (scroll/parallax)** in its own description and
>     correctly held in **draft** for a real-iPhone check before merge, per
>     the risk-based auto-merge gate — nothing to build here, just don't
>     duplicate it.
> - **#01 remains completely untouched** — `isGuardedTap`/`COMMIT_GUARD_MS`
>   is still byte-identical in `flow.js`. Still the single largest open item;
>   see the re-ranked table at the bottom, now sequenced behind #416.
> - **Aside:** the task brief for this review also named
>   `claude/website-review-2026-07-10.md` as a doc to reconcile — that file
>   does not exist in this repository and never has (`git log --all` has no
>   trace of it). This matches the 2026-07-12 note above: the 2026-07-10
>   "redesign brief" was never committed and is confirmed permanently lost,
>   not merely misplaced.

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

> **Status (2026-07-13): one of three sub-items shipped.** GSAP is de-duped
> to a single 3.15.0 everywhere (PR #389, 2026-07-12) — the version-mismatch
> bullet below is resolved. AVIF wiring and script minification are still open.

**What's wrong**
- **AVIF made but unused.** `assets/story/` ships `.avif` and `-sm` variants,
  but `gallery/gallery.js` serves the `.jpg` only — ~1.7 MB of already-generated
  savings unrealised.
- ~~**GSAP loaded twice** — 3.15.0 eagerly for the landing, 3.13.0 lazily for the
  sphere: duplicate dependency *and* version mismatch.~~ **Fixed in #389** —
  every load site now pins 3.15.0.
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

## Re-ranked open work & recommended next PR (2026-07-15 review)

Re-ranked by impact/effort/risk, folding in the 2026-07-15 status update
above: one small PR landed (#417), one stale PR closed (#363), and two open
draft PRs (#416, #418) surfaced that neither this doc nor VISUAL-ROADMAP.md
knew about.

| Rank | Item | Impact | Effort | Risk | Why this order |
| ---- | ---- | ------ | ------ | ---- | --------------- |
| 1 | Merge PR #416 as-is (colour-atelier confirm gate) | real correctness bug — can currently commit an unselected colour at full confidence | trivial (2-line diff, already written, CI green) | low — single file, no new UI | Sitting idle in draft; also touches the exact commit-model surface rank 2 rewrites, so merging first avoids a rebase |
| 2 | #01, re-scoped: one commit model + phase-E reweighting (drop the intro-screen bullet) | high — completion is the site's one load-bearing metric | medium (`flow.js` interaction contract + `engine.js` priorities) | low-mid — no new UI surface, existing `shoot-journey`/`verify-*` harness covers it | Still untouched after 17 unrelated PRs landed around it — the largest remaining product gap by a wide margin |
| 3 | #03 remainder: AVIF wiring + script minification | modest, mobile/slow-connection users | low | none (non-visual) | GSAP now fully de-duped (#389 + #417); real but small win, safe autonomous-merge candidate |
| 4 | VISUAL-ROADMAP.md `#measure` trust component (see that doc) | modest, trust/privacy framing | low | none (static, no motion) | Only remaining item in the sibling landing roadmap; equally low-risk filler |
| — | PR #418 (hero "Reclaimed Light" glow-up) | unknown until seen on-device | already built, pending review | high (scroll/parallax) | Already built + CI-green, explicitly held for a real-iPhone check per its own description — an approval-and-device-check task, not an open engineering item |
| — | #01's intro-screen bullet | unknown until decided | — | high (product-direction reversal) | Blocked on a product decision, not on engineering — raise it, don't build it speculatively |
| — | C2 Variant 2 (longer mood preamble, PR #401) | unknown until decided | — | medium (changes journey length/copy) | Same category as above — flag, don't build speculatively |
| — | Issue #383 — credibility block (Instagram half shipped in #414) | unknown until decided | medium | needs on-brand copy + placement decision | Explicitly flagged "not implementing, needs a decision," reconfirmed absent three times (07-13 ×2, 07-14) |
| — | Issue #384 — Impressum legal placeholders (name/address) still live | real compliance gap | n/a — needs the site owner's real business data | n/a | Not something an engineering session can resolve; needs human input |

**Recommended next PR:** merge **PR #416** first (trivial, already built,
real bug, low risk), then *"Studio journey — one commit model + phase-E
reweighting"* (branch `engine/unify-commit-model`), scoped exactly as the
re-scoped recommendation under §01 above. Reasoning unchanged since the
2026-07-12 review, now additionally sequenced behind #416 so the
commit-model rewrite starts from the corrected `colorGradient.js` — every
other easy win nearby (hero conversion, contrast, mobile machine,
studio-reveal scroll, DNA/render bugs, the R4/R10 landing polish, the
Instagram credibility signal, the GSAP dedupe) has already shipped, leaving
this as the one clearly load-bearing gap left.
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
- **Dependencies:** merge #416 first (same file family, avoids a rebase). No
  other blockers. It should land *before* any future intro-screen work, since
  that work would otherwise inherit the same two-commit-model inconsistency
  it would need to unify anyway.
- **Explicitly not this PR:** reviving `showIntro` — flag it to the user as a
  standing-directive reversal and get an explicit answer first. Same for C2
  Variant 2 and the intro-screen bullet above — all three are product-decision
  flags, not engineering tasks. Also not this PR: #418, a separate,
  already-built, already-in-review hero PR orthogonal to the studio journey.
