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

> **Status update (2026-07-18 review, read before acting):** re-checked
> against `main` @ `9a3caaf`. Seven PRs landed since the 2026-07-15 sync
> above, including a large, uncoordinated visual re-skin — full accounting:
> - **#416 is merged** (`6d33bbf`) — the colour-atelier confirm-gate fix.
>   Confirmed off the open-work table.
> - **#03 is effectively done except minification.** PR #422 wired AVIF into
>   `gallery/gallery.js` (story assets, JPEG fallback) and deduped a stray
>   GSAP pin; **PR #427** (new since 07-15) additionally serves AVIF for the
>   **hero LCP image** itself (`hero-wide`/`hero-2`, ~80%/32% byte savings,
>   JPEG fallback) — a delivery-polish win never listed in the original
>   backlog. Between #389/#417/#422, GSAP is one version/one instance
>   everywhere. **Only "36 unminified first-party scripts" remains open.**
> - **Security/hardening, unrelated to either doc's backlog:** #421
>   (rate limiter trusts `x-real-ip` over spoofable `x-forwarded-for`), #424
>   (`track.js`/`waitlist.js` gained the shared per-IP rate-limit gate; DNA
>   path-walker gained a `__proto__`/`constructor`/`prototype` denylist), and
>   **#426** (new — `StateManager.set`/`get` now reject prototype-chain keys,
>   closing the same class of gap as #424's DNA guard).
> - **A large, uncoordinated visual re-skin shipped, merged by the site
>   owner directly** (both PRs below were flagged high-risk-visual/no-
>   auto-merge by their own descriptions, and merged after a real-device
>   check rather than autonomously):
>   - **#429** — "Thermal Signature": palette (`Ocean Depths` →
>     night-black + periwinkle/teal/glow-green thermal gradient) and display
>     type (Fraunces serif → Poppins thin-caps) changed **site-wide**,
>     following an uploaded reference slide. `CLAUDE.md`'s Design-System
>     section and `VISUAL-ROADMAP.md`'s "Re-Skin-Hinweis" already reflect
>     the new tokens — nothing further to reconcile there.
>   - **#430** — the thermal-blob staging system moved from live inline-SVG
>     filters to a build-time raster pipeline (jank fix), **and the hero was
>     rebuilt**: the hero photo pair and the interactive `initWeave`
>     thread-field/`#weave-canvas` were removed entirely, replaced by
>     `js/thermal-waves.js`, a raw-WebGL domain-warped-fbm shader.
>   - **#431** — same-day regression fix: #430 deleted
>     `assets/hero-2.jpg`/`hero-wide.jpg`, but `gallery/gallery.js` (the
>     separate standalone `/gallery/` study) still referenced them, 404ing
>     4 requests and silently dropping 6 of 54 gallery cards. Fixed.
> - **PR #418 is closed, but its successor #428 is now stale/conflicting,
>   not just "pending an iPhone check."** #428 ("Reclaimed Light" hero
>   glow-up) is the same diff as #418, reopened only so CI would re-run —
>   its `mergeable_state` is **`dirty`**. Root cause: it patches
>   `initHeroParallax()`, a hero `<img>` photo layer, and `initWeave`'s
>   `drawField()` light-pool — all of which **no longer exist on `main`**
>   after #430's hero rebuild above. This isn't a rebase away; the parallax/
>   aurora concept was built for a hero architecture that's gone. Recommend
>   closing #428 and, if the "make it sexy" hero glow-up is still wanted,
>   re-scoping it against `thermal-waves.js` from scratch — don't try to
>   merge or patch the existing diff.
> - **New finding, not previously tracked: four permanent regression-guard
>   scripts are broken on `main`.** #429's own PR description flags
>   `scripts/verify-atelier.mjs`, `verify-a11y-studio.mjs`,
>   `verify-community.mjs` and `verify-gallery.mjs` as failing, confirmed
>   reproducible independent of that PR's own changes (walk-drift no longer
>   reaching the atelier board, a removed `DEModalities.hotspot` handle, an
>   internal `.vel` probe handle, and a script that expects an
>   externally-started server). These are exactly the load-bearing regression
>   guards `docs/STUDIO-UX-ROADMAP.md` §12 tells future sessions to run
>   before touching those surfaces — right now they'd pass or fail
>   meaninglessly. Small, non-visual, safe autonomous-merge chore once fixed;
>   see the re-ranked table below.
> - **#01 remains completely untouched** — `isGuardedTap`/`COMMIT_GUARD_MS`
>   is still byte-identical in `flow.js`. With #416 long merged, it remains
>   the single largest open item, unblocked, after 25+ unrelated PRs have
>   landed around it since it was first flagged (2026-07-12).
> - **Repo hygiene:** a stale docs-review PR, **#425** (proposed much of this
>   same update against `main` @ `343ad78`, before the re-skin/hardening
>   commits above landed), is superseded by this update — close it. It in
>   turn had already closed **#423**, which had already closed **#419**/
>   **#420** — the review-PR chain stays self-cleaning.
> - **Aside:** `claude/website-review-2026-07-10.md`, named in this review's
>   scope, still does not exist in the repository and never has — unchanged
>   since the 2026-07-12 note above.

> **Status update (2026-07-21 review, read before acting):** re-checked
> against `main` @ `6aadf22`. Three PRs landed since the 2026-07-18 sync
> above (**#433–#435**), none touching this doc's tracked backlog — all
> three are routine hardening: WebGL context-loss recovery + reduced-motion
> resize handling in `thermal-waves.js` (#433), tightening the gallery DNA
> regex to the real base64url alphabet (#434), and guarding a crafted
> `#dna=` share link from crashing the refine screen on a `null`
> `archetypeWeights` (#435).
> - **New finding, not previously tracked: `api/preview-design.js` is a
>   live, billed, unauthenticated Edge Function with no caller anywhere in
>   the shipped app.** Flagged in #435's own PR description, independently
>   confirmed by repo-wide search: `CLAUDE.md`'s "Design Preview" section
>   describes a `generateDesignPreview()` in `app.js` POSTing to this route
>   from a `#design-preview-slot` card — neither exists in `app.js` or
>   `index.html`, and `git log -S` on both symbols returns zero commits.
>   The route itself is real and reachable (calls Replicate FLUX 1.1 Pro,
>   ~$0.04/render), guarded only by the shared per-IP rate limiter
>   (`api/_lib/rate-limit.js`), which **fails open** without Upstash
>   configured or on a store hiccup — by design, so a transient store issue
>   doesn't take down a revenue-relevant flow, but here there's no revenue
>   flow behind it to protect. Net effect: a stranger who finds the URL can
>   spend the site owner's Replicate credit up to the rate-limit ceiling,
>   for a feature no visitor can reach. Low urgency pre-launch (low traffic,
>   bounded per-IP), but it's real spend for zero benefit and stale
>   documentation actively describing dead wiring — worth a small
>   decide-and-fix PR (delete the route, or actually wire it to the
>   `/api/try-on` no-photo gate `CLAUDE.md` describes it as). See the
>   re-ranked table below.
> - **Nothing else changed.** `#01` (commit-model unification) remains
>   completely untouched — `isGuardedTap`/`COMMIT_GUARD_MS` still
>   byte-identical in `flow.js`, `showIntro` still dead. The four broken
>   `verify-*.mjs` regression guards (`verify-atelier`, `verify-a11y-studio`,
>   `verify-community`, `verify-gallery`) are still unfixed — no commit
>   since 07-18 touches any of those four files. Script minification (#03's
>   last sub-item) is still open. PR #428 ("Reclaimed Light") is still open,
>   still draft, still stale against the post-#430 hero. Issues #383
>   (credibility block) and #384 (Impressum placeholders) are both still
>   open with no material movement — #383's last comment (07-18) proposes
>   narrowing its own scope but nothing has been acted on yet; #384 still
>   needs the site owner's real business data, unchanged since filed.

> **Status update (2026-07-22 review, read before acting):** re-checked
> against `main` @ `9799d49`. Only **two commits** landed since the 07-21
> sync above, neither touching this doc's tracked backlog: `abd7e45`
> (fix: stop the colour atelier anchoring a duo-gradient on unchosen black
> — a `colorGradient.js`-only correctness fix, same family as #416/#438 but
> not part of any item tracked here) and `9799d49` (CLAUDE.md refresh
> documenting the `/en/` page + recent audit fixes, no app-code change). A
> third, `0a10ee0`, is a `brace-expansion` npm-audit dependency patch.
> - **Nothing on the open-work list moved.** Re-verified directly against
>   code, not re-derived from the docs: `isGuardedTap`/`COMMIT_GUARD_MS`
>   still byte-identical in `flow.js`; `.photo-privacy` still plain 11px
>   text in `css/styles.css` (still not a designed trust component); no
>   commit since 07-18 touches `verify-atelier.mjs`/`verify-a11y-studio.mjs`/
>   `verify-community.mjs`/`verify-gallery.mjs` or the surfaces they exercise
>   (`js/community-sphere.js`, `gallery/`, the atelier modality) — still
>   broken for the same reasons recorded in the 07-18 note; `api/preview-
>   design.js` still has no caller anywhere in `js/*.js` or `index.html`.
>   Issues #383 and #384 are both still open, no new comments since 07-21.
>   PR #428 is still open, still draft, still stale against the post-#430
>   hero (unchanged `mergeable_state`).
> - **Repo hygiene: PR #436 (the 07-21 review PR) was left open and
>   unmerged** despite all seven functional CI checks green and
>   `mergeable_state: clean` — an oversight against this repo's own
>   autonomous-merge policy for docs-only changes. Rebased onto current
>   `main` and merged as part of this review rather than opened as a
>   redundant new PR, since its content (minus this addendum) is still
>   accurate.
> - **Recommendation unchanged:** the rescoped `#01` (one commit model +
>   phase-E reweighting) remains the top pick — now unaddressed across
>   **eight consecutive reviews (07-12 → 07-22)**.

> **Status update (2026-07-23 review, read before acting):** re-checked
> against `main` @ `8ed3e97`. Two commits landed since the 07-22 sync above,
> neither touching this doc's tracked backlog: `4a6087d` (chore: widen the
> `?v=`-gated immutable-cache rule to images + fonts, not just css/js — the
> two `tblob-*.webp` thermal-blob backgrounds and self-hosted `woff2` fonts
> were falling through to Vercel's `max-age=0` default; a delivery-polish
> win adjacent to but not part of item #03's tracked scope, same pattern as
> #427's hero-AVIF win) and `8ed3e97` (fix: `api/_lib/rate-limit.js`'s
> `checkRateLimit` only inspected the pipeline's `INCR` result for an error,
> not `EXPIRE` — a transient Upstash hiccup could leave a rate-limit key
> without a TTL, a slow unbounded key leak; now retries `EXPIRE` standalone,
> best-effort, fail-open contract unaffected).
> - **Nothing on the open-work list moved.** Re-verified directly against
>   code: `isGuardedTap`/`COMMIT_GUARD_MS` still byte-identical in `flow.js`;
>   `.photo-privacy` still plain 11px text in `css/styles.css`; no commit
>   since 07-18 touches `verify-atelier.mjs`/`verify-a11y-studio.mjs`/
>   `verify-community.mjs`/`verify-gallery.mjs` — independently reconfirmed
>   broken this pass (`verify-a11y-studio.mjs` still calls
>   `window.DEModalities.hotspot`, which doesn't exist; only `.regions` does).
>   `api/preview-design.js` still has no caller anywhere in `js/*.js` or
>   `index.html`. Issues #383 and #384 are both still open (#383's last
>   audit comment, 07-21, proposed cutting its own re-audit cadence — still
>   no reply). PR #428 is still open, still draft, still stale against the
>   post-#430 hero.
> - **Repo hygiene: PR #440 was left open and unmerged** despite all seven
>   functional CI checks green (plus CodeQL/Vercel preview/Actions-analyze) —
>   the same oversight pattern as #436 in the 07-22 review. It was a small,
>   well-tested, non-visual backend fix (see `8ed3e97` above) with nothing to
>   gate on, so it was merged as part of this review rather than left to
>   linger further.
> - **Recommendation unchanged:** the rescoped `#01` (one commit model +
>   phase-E reweighting) remains the top pick — now unaddressed across
>   **nine consecutive reviews (07-12 → 07-23)**, the longest-standing item
>   in this doc.

> **Status update (2026-07-24 review, read before acting):** re-checked
> against `main` @ `052f2e5`. Two PRs landed since the 07-23 sync above:
> - **#443** ("polish pass"): six low-risk visual fixes, including the
>   `#measure` privacy trust seal — **closes `VISUAL-ROADMAP.md`'s last open
>   item** (see that doc's own 2026-07-24 update). Doesn't touch this doc's
>   tracked backlog.
> - **#444** ("the atelier reads your mind," high-risk-visual per the repo's
>   own gate, checked on a real iPhone before merge — confirmed: merged
>   directly by the repo owner, not autonomously): five slices —
>   contradiction eviction, refine integrity, flat-anatomy fixes, a new
>   describe-first opening question, and a mobile "Cockpit" restructuring.
>   Full accounting in `STUDIO-UX-ROADMAP.md`'s 2026-07-24 update. Relevant
>   to **this doc's #01**:
>   - The describe-first opener is a **partial answer to the "revive the
>     intro" flag below** — but a differently-shaped one (a skippable real
>     question, not an explanatory intro card) that the owner explicitly
>     green-lit in-session per the PR's own description. Treat that specific
>     sub-flag as **resolved by product decision**, not open for a future
>     session to build as originally worded.
>   - **The actual rescoped recommendation — one commit model, deleting
>     `isGuardedTap`/`COMMIT_GUARD_MS` — is still untouched.** Reconfirmed
>     directly against code this pass: `js/design-engine/flow.js:41-42` is
>     byte-identical to every prior review. #444 added a new question
>     surface (describe) and a new mobile frame (Cockpit) without changing
>     the underlying two-commit-model split those surfaces still live inside.
>   - Journey length moved the wrong way for §7's 8–10-tap target: the new
>     opener is **+1 screen** (jacket spine assertion now ≤16, was ≤14). Not
>     a regression — it's a new, owner-approved capability — but worth
>     weighing together with the still-pending phase-E reweighting rather
>     than treating them as independent.
> - **Nothing else on the ranked table moved.** Reconfirmed directly against
>   code: `api/preview-design.js` still has no caller in `app.js`/
>   `index.html` (only stale comments referencing it, confirmed by #444's own
>   PR description too); the four broken `verify-*.mjs` regression guards
>   (`verify-atelier`, `verify-a11y-studio`, `verify-community`,
>   `verify-gallery`) are still broken — `verify-a11y-studio.mjs` still calls
>   the removed `window.DEModalities.hotspot` handle. Script minification
>   (#03's last sub-item) is still open. Issues #383 and #384 are both still
>   open with no new activity (#383 last commented 07-21, #384 unchanged
>   since filed 07-11). PR #428 is still open, still draft, still stale
>   against the post-#430 hero (`mergeable_state: dirty`, unchanged). No
>   stale docs-review PR was left open this time — nothing to merge as repo
>   hygiene.
> - **Recommendation unchanged, ranking unchanged:** the rescoped `#01`
>   (delete the two-commit-model split, unify on one explicit-confirm
>   pattern) remains the top pick — now unaddressed across **ten consecutive
>   reviews (07-12 → 07-24)**, having watched 30+ unrelated PRs land around
>   it, including one (#444) that added a *new* modality surface inside the
>   very inconsistency it would unify.
>
> **Status update (2026-07-24, same-day follow-up): rank 2 shipped.** The
> orphaned `api/preview-design.js` endpoint — unauthenticated, billed,
> flagged with no caller across three consecutive reviews (07-21 → 07-24) —
> is **deleted** rather than wired up: reviving that "visualise the draft
> before try-on" feature is a product-shape decision (new UI, i18n copy,
> rate-limit UX), not something to build speculatively during a routine
> review. `js/preview-fallback.js` is kept — it turned out to still be a
> live caller from `js/design-engine/render-preview.js`'s `silhouette()` as
> the defensive fallback when `window.GarmentSVG` isn't available, unrelated
> to the deleted endpoint. All stale comments across `api/*.js`, `js/*.js`,
> tests, `CLAUDE.md`, and `README.md` referencing the removed route were
> corrected in the same pass. Rank 2 drops off the table below.

> **Status update (2026-07-24, later same-day follow-up):** two more PRs
> landed after the sync above — **#448** ("Atelier-Runde 3," high-risk-visual
> per its own gate, real-iPhone-checked before merge) and **#449**
> ("Atelier-Wow-Roadmap," docs-only).
> - **#448** is a large Cockpit/atelier content pass: an 8px-grid layout
>   cleanup, the photo-duell now filling the full sheet with a derived
>   "→ archetype" line per side, a live slider readout, compact grids for
>   5+-choice sets, a sixth jacket style (Trucker, wired to an
>   already-built renderer branch), all 7 `CONFIG` materials now reachable
>   across categories, a new dress Detail-Atelier (`regions` board matching
>   the jacket/shirt/pants pattern), stackable multi-select signatures with
>   an exclusive "none," a seeded order-jitter (`?dseed=`, active only after
>   the category decision) and archetype-fed refine directions — plus a
>   same-PR adversarial-review round (7 confirmed fixes: a describe/refine
>   free-text contradiction gap at conf 0.62, missing "trucker" vocabulary in
>   summary/AI prompt, describe a11y, and a sticky-action-bar selector fix).
>   **None of it touches this doc's #01.** Reconfirmed directly against code
>   this pass: `js/design-engine/flow.js:41-42`
>   (`isGuardedTap`/`COMMIT_GUARD_MS`) is still byte-identical. The two
>   `verify-*.mjs` edits inside #448 (`verify-atelier.mjs`,
>   `verify-describe.mjs`) only pin a `?dseed=7` query so the new
>   order-jitter doesn't break their deterministic walk — they do **not**
>   fix the underlying failures. Ran both broken guards fresh against this
>   commit rather than just reading the diff: `verify-atelier.mjs` still
>   fails identically ("the walk reaches the detail atelier (jacket)" —
>   throws on a null hotspot handle); `verify-a11y-studio.mjs` still throws
>   `window.DEModalities.hotspot is not a function`. Both remain open
>   chores, unchanged. **New permanent guard from this PR:**
>   `scripts/verify-signature-stack.mjs` (stacking, exclusive "none," DNA +
>   flat) — add it to the guard list alongside `verify-describe`.
> - **#449** adds a new planning document, `docs/ATELIER-WOW-ROADMAP.md` —
>   an owner brief ("studio atelier like Nike Football/Apple, with its own
>   Liquid-Glass dialect") translated into five PR-sized building blocks (B1
>   stage-first Cockpit v4, B2 studio light, B3 material-reality macro
>   backdrops, B4 a starting-point gallery, B5 instrument-glass +
>   carousels); the owner's own recommendation is B1+B5 first. Pure docs, no
>   code touched, no item on this doc's table resolved or superseded — noted
>   here only so a future session doesn't mistake it for engineering
>   progress against this doc's own open items.
> - Nothing else moved: `api/preview-design.js` stays deleted (see the entry
>   above); issues #383/#384 unchanged; **PR #428 reconfirmed still open,
>   still draft, still stale** (`mergeable_state: dirty`, no new activity
>   since 07-17).
> - **Recommendation unchanged:** the rescoped `#01` remains the top pick,
>   now unaddressed across **ten consecutive reviews (07-12 → 07-24)**, with
>   two large PRs landed since the count was last stated — #444 and now
>   #448 — each adding a new question surface to the very two-commit-model
>   split this item would retire.

> **Status update (2026-07-25 review, read before acting):** re-checked
> against `main` @ `577c589` — no new commits landed since the 07-24 sync
> above, and #453 (the last docs commit) had already reconfirmed both this
> doc and `STUDIO-UX-ROADMAP.md` current, so **nothing on the ranked table
> moved**. `isGuardedTap`/`COMMIT_GUARD_MS` remains byte-identical in
> `flow.js` — the rescoped `#01` is now unaddressed across **eleven
> consecutive reviews (07-12 → 07-25)**.
> - **Repo hygiene: three stale PRs closed.** **#450** and **#452** were
>   superseded duplicate docs-review PRs — both proposed status updates for
>   #448/#449 that had already landed, in fuller form, via the merged
>   #451/#453; diffed each branch against current `main` and found no
>   unique content in either. **#428** ("Reclaimed Light" hero glow-up,
>   successor to #418) was closed per this doc's own recommendation,
>   independently reconfirmed across six prior reviews (07-18 → 07-24): its
>   diff targets `initHeroParallax()`/`initWeave`'s `drawField()`, both
>   removed by #430's hero rebuild back on 07-17 — not a rebase conflict,
>   the architecture it patches is gone. If the glow-up concept is still
>   wanted, it needs a from-scratch re-scope against `js/thermal-waves.js`.
> - **One new, active, unrelated PR observed, not yet mergeable:** **#454**
>   ("Atelier-Wow B1+B5 — Bühne zuerst + Instrumenten-Glas"), opened
>   2026-07-24 evening, implements the first slice of
>   `docs/ATELIER-WOW-ROADMAP.md` (Cockpit v4 stage-first layout + glass
>   instrument tokens/rails). Still in **draft**, flagged high-risk-visual
>   by its own description (studio layout, `svh`, `backdrop-filter`/scroll-
>   snap on iOS) pending a real-iPhone check — same gate `#01` itself will
>   need. Unmerged, so no doc content to reconcile yet; noted here only so
>   the next review isn't surprised by it. Doesn't touch `#01` or any item
>   on this doc's ranked table.
> - **Aside:** `claude/website-review-2026-07-10.md`, named in this
>   review's task scope, still does not exist in the repository and never
>   has — unchanged since the 2026-07-12 note, permanently lost.
> - **Recommendation unchanged:** the rescoped `#01` remains the single
>   largest open item and the recommended next PR.

**Status update (2026-07-25, later same-day follow-up):** triggered by the
`pull_request.closed` webhook for **#454** — it merged (real-iPhone-checked
per its own description: "iPhone-Gate: vom Owner am Preview geprüft und
freigegeben"), correcting the "not yet mergeable" note two paragraphs above.
Re-checked directly against `main` @ `00d8b2b`:
- **#454 shipped B1+B5** of `docs/ATELIER-WOW-ROADMAP.md` (Cockpit v4
  stage-first layout, ~63–68% stage share on standard question screens, plus
  instrument-glass tokens/rails), an owner-preview round (five findings —
  including a real, newly-introduced closure-inference bug caught by
  adversarial review before merge), and construction fixes to the dress
  skirt/closure vocabulary in `garment-svg.js`. Full accounting already
  lives in `ATELIER-WOW-ROADMAP.md` §6 (updated in the same PR) and
  `STUDIO-UX-ROADMAP.md`'s matching 07-25 entry — not duplicated here.
- **Does not touch `#01`.** `js/design-engine/flow.js`'s
  `isGuardedTap`/`COMMIT_GUARD_MS` (lines 41-42) is still byte-identical.
  The two broken regression guards (`verify-atelier.mjs`,
  `verify-a11y-studio.mjs`) are unchanged — #454 only extended
  `scripts/verify-describe.mjs` with a new Cockpit-v4-contract section, it
  didn't touch either broken script.
- **Recommendation unchanged:** the rescoped `#01` remains the top pick,
  still unaddressed across eleven consecutive reviews (07-12 → 07-25) —
  the "later same-day" check above doesn't add a twelfth, per this doc's
  existing same-day-doesn't-recount convention (see the three 07-24
  entries above).

> **Status update (2026-07-26, triggered by the `pull_request.closed`
> webhook for #462):** re-checked against `main` @ `349b085`. Four commits
> landed since the 07-25 sync above (**#458, #460, #459, #462**), none
> touching this doc's tracked backlog:
> - **#458** ("Atelier-Wow B2 + Kanten-Diät") and **#462** ("Atelier-Wow
>   B3 — die Bühne nimmt den Stoff an") ship the next two slices of
>   `docs/ATELIER-WOW-ROADMAP.md` (studio-light staging: podium cone, floor
>   pool, cyclorama, contact shadow; then a material macro-photo backdrop
>   behind the flat during the fabric moment, pointer-hover + touch-select
>   gestures, honesty-bounded as material-proof not product-proof). Both are
>   the same orthogonal studio-layout track as the merged B1+B5 (#454) —
>   full accounting lives in `ATELIER-WOW-ROADMAP.md` §6, not duplicated
>   here. Neither touches `flow.js`'s commit-model split.
> - **#459** ("Fortschrittsregler wird Kapitel-Index") replaced the
>   14-object progress stepper with a five-chapter row + single growing
>   hairline (owner-reviewed against four rendered alternatives) — a UI
>   polish inside the same Cockpit surface, not a change to *when* a screen
>   commits.
> - **#460** ("#machine radikal verdichtet") condensed Act II's prose blocks
>   (station cards, verifiable-anchors paragraph, AI-role paragraph, how-to
>   steps) into short lines + mono micro-chains — a copy/landing change,
>   unrelated to the studio journey or this doc's backlog.
> - **Nothing on the ranked table moved.** Reconfirmed directly against
>   code this pass: `isGuardedTap`/`COMMIT_GUARD_MS` still byte-identical
>   in `flow.js` (lines 41-42); no minified build output exists anywhere
>   under `js/` (`#03`'s last sub-item, script minification, still open);
>   `verify-a11y-studio.mjs` still calls `window.DEModalities.hotspot`,
>   which still doesn't exist (`regions.js` only exposes `.de-hotspot`
>   elements, no such handle on the `DEModalities` global) — still broken,
>   unchanged since first flagged 07-18. Issues #383 (credibility block)
>   and #384 (Impressum placeholders) both remain open with no new
>   engineering movement from this batch.
> - **Recommendation unchanged:** the rescoped `#01` remains the top pick,
>   now unaddressed across **twelve consecutive reviews (07-12 → 07-26)**,
>   with two more Atelier-Wow slices (B2, B3) landed around it since the
>   count was last stated.

> **Status update (2026-07-26, scheduled review, same day as the sync
> above):** `main` hasn't moved (still `41efbae`) — no PR merged or closed
> since the last sync. **But four open PRs exist that no prior review in
> this doc has tracked**, because this doc's methodology reconciles merges
> into `main`, not the open-PR queue. Worth breaking that pattern for once,
> since one of them is actionable right now:
> - **#457 ("harden against malformed AI responses + tighten billed-endpoint
>   rate limits") is a real bug fix — not draft, all seven functional CI
>   checks green, `mergeable_state: clean`, non-visual.** It fixes a genuine
>   spec-sheet crash (`renderNotes`/HTML export throw if the AI ever returns
>   `tags`/`constructionNotes` as a bare string instead of an array) plus
>   tightens two billed-endpoint rate limits. Per this repo's own standing
>   auto-merge policy ("the moment a PR Claude opened has all functional CI
>   green, squash-merge it... do NOT wait"), **this should already be
>   merged and isn't** — flagging the gap rather than merging it from inside
>   a docs-review session that didn't author or diff-review it itself.
> - **#456** ("bump brace-expansion to patch high-severity DoS advisory") —
>   draft, CI green, `mergeable_state: clean`, lockfile-only. Same
>   autonomous-merge bar as #457 once undrafted.
> - **#461** ("#machine mobile — card-snap rail under the drawing") — draft,
>   CI green but `mergeable_state: dirty` (base is several merges behind
>   current `main`), self-flagged **Hochrisiko-Visuell** (scroll-snap +
>   programmatic smooth-scroll on iOS Safari) — needs a real-iPhone check
>   per the merge-gate policy before it can land, not just a rebase.
> - **#464** ("Atelier-Wow B4 — die Startpunkt-Galerie") — draft, CI green,
>   `mergeable_state: clean`, based directly on current `main`. Self-flagged
>   product-decision gate (adds a 17th journey screen against this doc's own
>   ≤16-screen budget) — see `ATELIER-WOW-ROADMAP.md`'s 2026-07-26 entry for
>   the three options the PR lays out. Orthogonal to `#01`, same as B1–B3.
> - **Recommendation:** merge #457 immediately (zero risk, zero remaining
>   effort, already-built value sitting idle) before starting any new PR;
>   undraft-and-merge #456 alongside it; #461 and #464 both need a human
>   call (real-device check / product decision) that no engineering session
>   can make for them.

> **Status update (2026-07-26, triggered by #467's `pull_request.closed`
> webhook):** acted on the gap the sync above flagged rather than just
> re-flagging it:
> - **#457 merged** (squash, `3a7a12a`) — independently re-verified all
>   seven functional checks green (`test`, `validate`, `validate-css`,
>   `validate-html`, `validate-assets`, `e2e`, `coverage`, plus CodeQL) and
>   `mergeable_state: clean` immediately before merging, per this repo's
>   standing auto-merge policy for non-visual fixes. No review requested
>   changes (Copilot's review bounced on a quota limit, not a finding).
> - **#456 closed as a stale duplicate**, not undrafted-and-merged as the
>   prior sync suggested — re-checked `main`'s `package-lock.json` directly
>   first and confirmed `brace-expansion` is already at `5.0.8` via #466, so
>   #456's diff is a no-op against current `main`. Closed with a comment
>   pointing at #466 instead of merging a no-op.
> - **#461 and #464 unchanged** — both still gated on a human call (real-
>   iPhone check for #461's scroll-snap/smooth-scroll on iOS Safari; the
>   17-vs-16-screen product decision for #464). `main` has now moved twice
>   since either was opened (`41efbae` → `47f5bd1` → `3a7a12a`), so both
>   PRs' `mergeable_state` reads `unknown` pending GitHub's recompute —
>   worth a rebase check before either lands, independent of their human-call
>   gates.
> - **`#01` recommendation unchanged** — now unaddressed across **thirteen
>   consecutive reviews (07-12 → 07-26)**.

> **Status update (2026-07-26, live-site audit, same day as the syncs
> above):** a separate scheduled session audited `revolveurban.com` itself
> (not the repo backlog) for broken links, missing asset renders, and the
> two items this doc already tracks under #383. Findings, for the record:
> all internal anchors, footer/legal links, and external references return
> HTTP 200 with no redirect chains (the UNEP source link 403s to
> non-browser requests — confirmed via response headers this is a
> Cloudflare JS challenge on that one article path, not a dead link); every
> image asset checked (hero thermal-wave stage, `#facts`, community-sphere
> cards, standalone gallery cards, all 16 Story AVIF variants) returned 200
> and was confirmed rendering via headless-Chromium screenshot, not just a
> correct `src`. Instagram (`sameAs` + footer icon) is live and confirmed
> working — no change from #414. The credibility block is still absent,
> exactly as #383 already tracks — nothing new to add there. No `fix/*` PR
> was needed since nothing was actually broken.

> **Status update (2026-07-26, triggered by #469's `pull_request.closed`
> webhook):** re-checked against `main` @ `82dcc3e` (#469's merge commit).
> - **Two concurrent scheduled-review sessions had raced off the same base**
>   (`3a7a12a`) — #468 ("close stale-duplicate #456") and #469 ("#457
>   merged, #456 closed, live-site audit") both opened from the same commit
>   with overlapping content. #469 landed first (it's the merge above), so
>   **closed #468 as a stale duplicate** (explanatory comment posted
>   linking to #469) rather than merging a diff that re-did the #456
>   closure and was already stale on the #457 point — #468 still listed
>   "merge #457" as an open recommendation, no longer accurate once #457
>   landed via #469.
> - **#461 and #464 unchanged** — both still gated on a human call
>   (real-iPhone check for #461's scroll-snap/smooth-scroll; the
>   17-vs-16-screen product decision for #464), no new commits on either
>   since the last sync.
> - **Same-day-doesn't-recount convention applies** — thirteen consecutive
>   reviews (07-12 → 07-26) stands unchanged.

> **Status update (2026-07-26, triggered by the `pull_request.closed`
> webhook for #465):** re-checked against `main` @ `1fc4dd8`. One commit
> landed since the sync above — **#466** ("patch brace-expansion
> high-severity DoS advisory"), lockfile-only, `npm audit` → 0
> vulnerabilities. It does **not** touch this doc's tracked backlog, but it
> changes the recommendation two entries up: **#456 is now a stale
> duplicate.** #456 and #466 fix the identical advisory
> (`brace-expansion@<=5.0.7` → `5.0.8`, same transitive path via
> `minimatch`) on the same lockfile entry; #466 landed independently
> (different session, different branch) while #456 sat open. #456's diff is
> now a no-op against current `main` — **recommend closing #456**, not
> undrafting it as the previous entry said. #457, #461, #464 are otherwise
> unchanged since the sync above (same `updated_at` — no new commits on any
> of the three) — the previous recommendation for each still stands.
> - **Same-day-doesn't-recount convention applies** — the twelve-review
>   count below is unchanged.

> **Status update (2026-07-26, triggered by the `pull_request.closed`
> webhook for #457 itself):** by the time this session read repo state,
> #457 was already merged (`3a7a12a`) and #456 already closed — both
> reconciled by a concurrent session's **#469**, merged minutes earlier.
> Two things this session's read of live state added:
> - **Closed #468 as a stale duplicate of #469.** #468 was a second,
>   concurrently-opened scheduled-review PR proposing the same
>   #457-merged/#456-closed reconciliation to this doc, opened *after*
>   #457's merge but written from pre-merge state (its diff still lists
>   "merge #457" as a pending recommendation). #469 landed first with the
>   accurate, complete version (including the rank-0 table edit below);
>   #468 would have re-added a stale, less-accurate entry on top. Closed
>   with a comment pointing at #469, same pattern as #456→#466.
> - **New finding, not covered by the same-day live-site audit above** (that
>   pass checked links/images, not backend config): `/api/gallery` and
>   `/api/waitlist` both return production JSON that's only possible when
>   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are unset —
>   `{"items":null}` and `{"count":null}` respectively (confirmed against
>   `api/gallery.js`/`api/waitlist.js`: a *configured* store returns `[]`/`0`
>   for zero rows, never `null` — `null` is exclusively the "no Upstash env"
>   branch). All three Upstash-backed edge functions (gallery, waitlist,
>   track) degrade gracefully — no crash, no 500 — but community-gallery
>   publishing, waitlist signups, and the `/insights` telemetry dashboard are
>   all silently inert in production right now. Added as a tracked row below
>   (needs the Upstash integration reconnected in Vercel, not an engineering
>   fix).
> - **#461 and #464 unchanged** — both still gated on a human call this
>   session can't make for them.

> **Status update (2026-07-26, triggered by #461's `pull_request.closed`
> webhook):** re-checked against `main` @ `415ad05` (#461's merge commit).
> - **#461 merged** ("#machine mobile — card-snap rail under the drawing"),
>   squash-merged by the repo owner directly, not from inside a docs-review
>   session — the real-iPhone check this doc's merge-gate policy called for
>   was exactly the human call no engineering session could make for it, and
>   the owner made it. Drops off the "gated on a human call" line repeated
>   across the last several entries.
> - **#464 unchanged** — now the only open PR, still gated on the
>   17-vs-16-screen product decision flagged in its own body; no new commits
>   since the last sync.
> - **No other open-PR or ranked-table action items.** Same-day-doesn't-
>   recount convention applies — thirteen consecutive reviews (07-12 → 07-26)
>   stands unchanged.

> **Status update (2026-07-26, scheduled live-site audit, re-run same day):**
> re-verified `revolveurban.com` against production `main` @ `4dbd38e`
> (confirmed live via Vercel: `dpl_4J3E1BJXqhB9zmeaGzE9Pk6VsFwz`, target
> `production`, `state: READY`) — the only diff since the prior same-day
> audit above is a CSS `?v=` cache-bust bump, no new links/assets/markup.
> Independently re-crawled with a real headless-Chromium session (not just
> `curl`) and per-section screenshots at 1440×900:
> - **All internal anchors** (`#main-content`, `#top`, `#community`,
>   `#design`, `#machine`, `#facts`, `#measure`, `#production`) resolve to an
>   existing element. **Footer/legal links** (`impressum.html`,
>   `datenschutz.html`, GitHub repo, GitHub `CREDITS.md`) all return HTTP 200,
>   no redirect chains.
> - **UNEP source link**: a bare `fetch`/`curl` gets 403, but a real browser
>   (realistic UA, full page load) gets a clean 200 with the correct page
>   title ("Putting the brakes on fast fashion") — confirmed Cloudflare
>   bot-challenge on the non-browser request path, not a dead link. No change
>   needed.
> - **Instagram link** (`instagram.com/revolveeurban`, both the footer icon
>   and JSON-LD `sameAs`): even a full headless-Chromium session with a
>   realistic UA gets HTTP 429 → redirected to `/accounts/login/`. This is
>   Instagram's own anti-scraping gate on unauthenticated/datacenter-IP
>   traffic, reproduces identically outside any site code path, and is not
>   something `revolveurban.com` can fix — noted for the record, not a repo
>   action item.
> - **Images**: hero (`tblob-cool.webp` / `tblob-thermal.webp`, both 200),
>   `#facts` (canvas-driven, no `<img>` — visually confirmed rendering via
>   screenshot), community-sphere gallery cards (visually confirmed
>   rendering — real photos on stage cards inside the WebGL globe), and
>   preset photos (`assets/presets/{f,m}-{1,2,3}.jpg`, all 200) all load
>   clean. Zero `>=400` responses and zero `requestfailed` events across the
>   full scroll (hero → facts → machine → community). Zero `pageerror`/
>   console errors.
> - **Story AVIF files** (`assets/story/act{1-4}[-sm].avif`): **not
>   referenced anywhere** in current `index.html`/`css/styles.css`/`js/**` —
>   confirmed via repo-wide search, zero hits. These are orphaned assets kept
>   only because `footer.credits` still links to `CREDITS.md` (which itself
>   returns 200); the actual Act I–IV photos were intentionally removed from
>   the hero per this doc's own architecture notes (the former photo-pair +
>   `initWeave` beat). Nothing to check because nothing on the live page
>   renders them — not a broken-asset finding, just worth flagging in case
>   the AVIF files are expected to still be live somewhere.
> - **Instagram loop** (`sameAs` + footer icon): confirmed live and rendering
>   in the footer screenshot — unchanged from #414, still not an open item.
> - **Credibility block**: confirmed still absent (searched for any
>   "who's behind this" / about / team surface — none exists). Exactly the
>   open half of **#383**, unchanged — a product/copy decision, not
>   something to build speculatively (needs a real handle for what's
>   actually true pre-launch: no team bios, no company history yet). Not
>   implemented, per standing instruction to flag rather than build
>   undecided product surfaces.
> - No `fix/*` PR opened — nothing was actually broken.

> **Correction (2026-07-26, third scheduled live-site audit, same day as the
> above):** independently re-ran the same links/assets/open-items audit
> against `main` @ `6910a69` (curl-based: this session's headless Chromium
> couldn't complete a browser navigation through the sandbox's egress proxy
> at all — confirmed via a raw `net`/`tls` socket that the proxy itself works,
> so it's this session's tooling, not the site). All link/anchor/asset/
> open-items findings independently matched the audit directly above —
> **except one: the "Story AVIF files ... not referenced anywhere ... orphaned"
> claim two entries up is wrong.** `gallery/gallery.js` (the standalone
> `/gallery/` page, wired in via `<script type="module" src="gallery.js">` in
> `gallery/index.html:85`) actively references `assets/story/act1.jpg`
> through `act4.jpg` in its `SOURCES` array, feature-tests AVIF support once
> per session (`checkAvifSupport`), and serves the AVIF/`-sm` variants via
> `bestSrc()`/`isStoryPath()`/`toAvif()`/`toSmJpg()` — these 4 sources (of 16)
> generate 12 of the standalone gallery's 36 cards ("Act I–IV" editorial
> tiles). The prior entry's repo-wide search evidently covered `index.html`/
> `css/styles.css`/root `js/**` (where the *hero* photo pair lived before
> #430 removed it) but missed `gallery/` — a separate ES-module page
> `CLAUDE.md`'s own architecture section calls out as one of only two ES-module
> exceptions in the codebase, easy to miss with a root-scoped search. All 16
> Story AVIF/JPEG variants (confirmed 200, correct `content-type`, real byte
> sizes via direct fetch) are live, in-use assets on `/gallery/`, not orphans
> — nothing to clean up, and nothing to flag as "expected to still be live
> somewhere," per the prior entry's own hedge. No other correction needed;
> no `fix/*` PR opened — nothing was actually broken.

> **Status update (2026-07-26, triggered by #474's `pull_request.closed`
> webhook):** re-checked against `main` @ `526c562f` (#474's own merge
> commit, confirmed live in production via Vercel:
> `dpl_592Ai96f3HCnMZV7jFhxWRXtWeEg`, target `production`, `state: READY`).
> #474 itself already carries this cycle's status — it corrected the
> immediately-prior entry's "Story AVIF orphaned" claim after an independent
> third same-day audit reconfirmed the same clean links/assets/open-items
> result. Nothing has changed since: **#464 remains the only open PR**, still
> gated on its own self-flagged 17-vs-16-screen product decision, no new
> commits. **Issues #383 (credibility block) and #384 (Impressum
> placeholders)** are both unchanged — still waiting on a copy/product
> decision and real business data respectively, neither actionable by an
> engineering session. Separately ran a full live-site health pass this
> session (homepage/legal/insights/404 boot, `/api/gallery` `/api/track`
> `/api/waitlist`, security headers, OG/Twitter tags, sitemap/robots,
> deploy-vs-`main` match) — all green except the already-tracked Upstash gap
> in the ranked table below (`items:null`/`count:null`), unchanged. No other
> open-PR or ranked-table action items. Same-day-doesn't-recount convention
> keeps the "thirteen consecutive reviews" count on the ranked table
> unchanged.

The landing film is finished — dramaturgy, type, weave, sphere all land. The
open work is the **product behind the CTA**: helping a first-time visitor
understand the studio, finish a design, and be captured at the moment they
care most. Everything here stays inside the pre-launch honesty rules
(be-first, never "buy"; no prices/dates; no fabricated proof).

| # | Upgrade | User impact | Effort | Risk | Status |
| - | ------- | ----------- | ------ | ---- | ------ |
| 01 | The studio's front door — onboard, shorten, unify the create journey | highest | medium | high-visual (motion) | **open — see flag below** |
| 02 | Convert at the peak — "be first" inside the ownership moment, tied to the design | high | low | low-visual, additive | **done — PR #385** |
| 03 | Delivery polish — wire AVIF variants, de-duplicate GSAP, minify | modest | low | non-visual | open — only minification left |

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

> **Status (2026-07-18): two of three sub-items shipped, one left.** GSAP is
> de-duped to a single 3.15.0/one-instance everywhere (PR #389, 2026-07-12;
> #417 and #422 closed the remaining double-fetch sites). AVIF is now wired
> into `gallery/gallery.js` (PR #422, 2026-07-15) **and** into the hero LCP
> image itself (PR #427, 2026-07-17 — ~80%/32% byte savings desktop/mobile).
> **Only script minification is still open.**

**What's wrong**
- ~~**AVIF made but unused.**~~ **Fixed in #422 + #427** — `gallery/gallery.js`'s
  wall texture/detail view and the hero LCP image both fetch AVIF with a JPEG
  fallback now.
- ~~**GSAP loaded twice** — 3.15.0 eagerly for the landing, 3.13.0 lazily for the
  sphere: duplicate dependency *and* version mismatch.~~ **Fixed in #389,
  #417, #422** — one version, one loaded instance, everywhere (including
  `gallery/index.html`'s own import map).
- **36 unminified first-party scripts** (~3.5 MB on disk); two stylesheets
  (`styles.css` + `fonts.css`) block the head.

**The upgrade** — add a minify pass served under the existing `?v=`
immutable-cache pattern (the AVIF/GSAP bullets above are both done; no
bundler — keep "drop it on any host").

**Benefit** — faster first paint and less data, felt most on mobile / slow
connections. Incremental by nature.

**How to build it** — an optional minify step (no bundler — keep "drop it on
any host"). Non-visual → merge autonomously once the seven CI checks are
green.

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

## Re-ranked open work & recommended next PR (2026-07-24 review)

Re-ranked by impact/effort/risk, folding in the 2026-07-24 status update
above: **rank 2 (the orphaned `preview-design.js` endpoint) shipped
same-day**, and **rank 4 (the `VISUAL-ROADMAP.md` `#measure` trust
component) shipped in #443** — both drop off this table; **the `#01`
intro-screen bullet is resolved by product decision** (the describe-first
opener, #444 — a differently-shaped answer the owner explicitly approved)
and also drops off as an open flag. Everything else is unchanged from 07-23
— #444 touched the studio journey extensively (new opener, mobile Cockpit)
without addressing the actual top-ranked item (commit-model unification) or
either remaining rank below. **#448 (Cockpit-Runde 3) landed the same day,
also without touching either remaining rank** — see the later same-day
status update above for the full accounting.

| Rank | Item | Impact | Effort | Risk | Why this order |
| ---- | ---- | ------ | ------ | ---- | --------------- |
| 1 | #01, re-scoped: one commit model + phase-E reweighting | high — completion is the site's one load-bearing metric | medium (`flow.js` interaction contract + `engine.js` priorities) | low-mid — no new UI surface, existing `shoot-journey`/`verify-*` harness covers it | Still untouched after 30+ unrelated PRs landed around it since first flagged — including #444 and now #448, each adding a *new* modality/content surface inside the very two-commit-model split this item would unify — the largest remaining product gap by a wide margin |
| 2 | #03 remainder: script minification only | modest, mobile/slow-connection users | low | none (non-visual) | AVIF (gallery #422 + hero #427) and GSAP dedupe (#389/#417/#422) are both done; one small win left, safe autonomous-merge candidate |
| 3 | Chore: repair or retire the 4 broken `verify-*.mjs` regression scripts (`verify-atelier`, `verify-a11y-studio`, `verify-community`, `verify-gallery`) | none directly user-facing, but closes a QA blind spot on studio-atelier/a11y/community/gallery surfaces | low-medium (per-script; likely stale selectors/handles after prior refactors) | none (test-only, non-visual) | Flagged in #429's own PR body (07-18), reconfirmed still broken 07-23, 07-24, and again after #448 (which only added a `?dseed=7` pin to two of them, not a fix) — ran both this pass: `verify-atelier.mjs` still fails to reach the board, `verify-a11y-studio.mjs` still calls the removed `DEModalities.hotspot`; safe autonomous-merge candidate once fixed |
| — | C2 Variant 2 (longer mood preamble, PR #401) | unknown until decided | — | medium (changes journey length/copy) | Product-decision flag, not an engineering task — raise it, don't build it speculatively |
| — | Issue #383 — credibility block (Instagram half shipped in #414) | unknown until decided | medium | needs on-brand copy + placement decision | Explicitly flagged "not implementing, needs a decision"; no new comment since 07-21 |
| — | Issue #384 — Impressum legal placeholders (name/address) still live | real compliance gap | n/a — needs the site owner's real business data | n/a | Not something an engineering session can resolve; needs human input |
| — | Upstash Redis integration not connected in production — `/api/gallery`, `/api/waitlist`, `/api/track` all silently no-op (`items:null`/`count:null`/empty aggregates) | real feature gap — community-gallery publishing, waitlist signups, and the `/insights` telemetry dashboard are all inert (graceful, no crash) | n/a — Vercel dashboard integration, not app code | n/a | Confirmed 2026-07-26: `null` (not `[]`/`0`) is only returned by the "no Upstash env" branch in `api/gallery.js`/`api/waitlist.js`. Reconnect the integration in Vercel → Project Settings → Storage (see `CLAUDE.md`'s Waitlist/Gallery setup notes) |

**Done since the last edit of this table:** rank 0, merging already-open
**#457**, is complete — squash-merged as `3a7a12a` in the 2026-07-26
"triggered by #467's `pull_request.closed` webhook" status update above.
**#456** was closed as a stale duplicate of the already-merged #466 rather
than undrafted-and-merged, per the same update. Row removed rather than
left stale.

**Recommended next PR (new engineering work):** *"Studio journey — one
commit model + phase-E reweighting"* (branch `engine/unify-commit-model`),
scoped exactly as the re-scoped recommendation under §01 above. Reasoning
unchanged since the 2026-07-12 review — it has now been the top-ranked
recommendation across **thirteen consecutive reviews (07-12 → 07-26)**
without a single unit of engineering effort spent on it, while 30+
unrelated PRs landed around it (hero conversion, contrast, mobile machine,
studio-reveal scroll, DNA/render bugs, the R4/R10 landing polish, the
Instagram credibility signal, the GSAP dedupe, the colour-atelier confirm
bug (and its 07-21 duo-gradient follow-up), both AVIF wirings,
rate-limit/prototype-pollution hardening plus its 07-23 EXPIRE-retry
follow-up, a widened image/font caching rule, a full visual re-skin, the
`#measure` trust seal, the orphaned `preview-design.js` endpoint removal,
the atelier/Cockpit PR (#444), Cockpit-Runde 3's atelier/materials/
signature expansion (#448), and now the merged Atelier-Wow B1+B5+B2+B3
slices (#454/#458/#462, orthogonal to the studio journey, with B4 open as
a product-decision-gated draft, #464).
If a quick, low-risk win is wanted *alongside* it rather than instead of it,
rank 2 (script minification, `#03`'s last sub-item) is small enough to ship
same-day without displacing this recommendation.
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
- **Dependencies:** none — #416 (the one thing this was ever sequenced
  behind) is merged. #444's describe-first opener and Cockpit, plus #448's
  stackable signatures/order-jitter/refine-direction additions, all now live
  inside the current two-commit-model split; this item should still land
  before any further journey-surface work inherits the same inconsistency.
- **Explicitly not this PR:** C2 Variant 2 is still a live product-decision
  flag, not an engineering task. Also not this PR: the merged Atelier-Wow
  B1+B5+B2+B3 slices (#454/#458/#462), a separate, orthogonal studio-layout
  track — B4 remains open per `ATELIER-WOW-ROADMAP.md` as PR #464, gated on
  its own product decision (screen-count budget), not implied by this
  recommendation.
