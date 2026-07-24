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

> **Status update (2026-07-24, second same-day follow-up):** re-checked
> against `main` @ `100217a`. Three more PRs landed same day, none moving
> this table:
> - **#447** — doc-only, `STUDIO-UX-ROADMAP.md`'s own same-day accounting of
>   #446. No overlap with this doc's tracked backlog.
> - **#448** ("Atelier-Runde 3," high-risk-visual, checked on a real iPhone
>   before merge — confirmed: merged directly by the repo owner, not
>   autonomously): a large Cockpit/engine round (8px grid, photo-duel/slider/
>   card-set density, a sixth jacket style, all seven materials reachable, a
>   dress Detail-Atelier, stackable signatures, seeded question-order
>   variation, archetype-pulled refine) — full accounting in
>   `STUDIO-UX-ROADMAP.md`'s matching second same-day entry. **Reconfirmed
>   directly against code: `isGuardedTap`/`COMMIT_GUARD_MS` in `flow.js` is
>   still byte-identical** — #448 touches `flow.js` heavily but not the
>   two-commit-model split itself, so this doc's rescoped `#01` stays open.
>   The four broken `verify-*.mjs` guards are explicitly reconfirmed still
>   broken in #448's own PR description. Script minification (#03's last
>   sub-item) is untouched. Issues #383/#384 unchanged; PR #428 still open,
>   still stale.
> - **#449** ("Atelier-Wow-Roadmap," docs-only): a forward-looking companion
>   doc (`docs/ATELIER-WOW-ROADMAP.md`) scoping a further five-block visual
>   pass (stage-dominance, studio lighting, material backdrops, a starting
>   gallery, "instrument-glass" controls) from an owner brief. Nothing
>   started yet, owner-prioritised — doesn't touch this doc's ranked items.
> - **Recommendation unchanged:** the rescoped `#01` remains the top pick —
>   still unaddressed across **ten consecutive reviews (07-12 → 07-24)**,
>   now having watched 30+ unrelated PRs land around it including *two*
>   large studio/Cockpit rounds (#444, #448) that each extended the very
>   journey surfaces this item would unify without touching the unification
>   itself.

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
either remaining rank below.

| Rank | Item | Impact | Effort | Risk | Why this order |
| ---- | ---- | ------ | ------ | ---- | --------------- |
| 1 | #01, re-scoped: one commit model + phase-E reweighting | high — completion is the site's one load-bearing metric | medium (`flow.js` interaction contract + `engine.js` priorities) | low-mid — no new UI surface, existing `shoot-journey`/`verify-*` harness covers it | Still untouched after 30+ unrelated PRs landed around it since first flagged — including #444, which added a *new* modality inside the very two-commit-model split this item would unify — the largest remaining product gap by a wide margin |
| 2 | #03 remainder: script minification only | modest, mobile/slow-connection users | low | none (non-visual) | AVIF (gallery #422 + hero #427) and GSAP dedupe (#389/#417/#422) are both done; one small win left, safe autonomous-merge candidate |
| 3 | Chore: repair or retire the 4 broken `verify-*.mjs` regression scripts (`verify-atelier`, `verify-a11y-studio`, `verify-community`, `verify-gallery`) | none directly user-facing, but closes a QA blind spot on studio-atelier/a11y/community/gallery surfaces | low-medium (per-script; likely stale selectors/handles after prior refactors) | none (test-only, non-visual) | Flagged in #429's own PR body (07-18), reconfirmed still broken 07-23 and 07-24 (`verify-a11y-studio.mjs` still calls the removed `DEModalities.hotspot`); safe autonomous-merge candidate once fixed |
| — | PR #428 ("Reclaimed Light" hero glow-up, successor to closed #418) | unknown until rebuilt | **not** "pending review" — `mergeable_state` still unresolved/`dirty`; its `initHeroParallax`/`initWeave` targets were removed by #430's hero rebuild | high (scroll/parallax, and now a from-scratch rebuild against `thermal-waves.js`) | Recommend closing; if the glow-up is still wanted, re-scope against the current WebGL hero rather than patching the old diff |
| — | C2 Variant 2 (longer mood preamble, PR #401) | unknown until decided | — | medium (changes journey length/copy) | Product-decision flag, not an engineering task — raise it, don't build it speculatively |
| — | Issue #383 — credibility block (Instagram half shipped in #414) | unknown until decided | medium | needs on-brand copy + placement decision | Explicitly flagged "not implementing, needs a decision"; no new comment since 07-21 |
| — | Issue #384 — Impressum legal placeholders (name/address) still live | real compliance gap | n/a — needs the site owner's real business data | n/a | Not something an engineering session can resolve; needs human input |

**Recommended next PR:** *"Studio journey — one commit model + phase-E
reweighting"* (branch `engine/unify-commit-model`), scoped exactly as the
re-scoped recommendation under §01 above. Reasoning unchanged since the
2026-07-12 review — it has now been the top-ranked recommendation across
**ten consecutive reviews (07-12 → 07-24)** without a single unit of
engineering effort spent on it, while 30+ unrelated PRs landed around it
(hero conversion, contrast, mobile machine, studio-reveal scroll, DNA/render
bugs, the R4/R10 landing polish, the Instagram credibility signal, the GSAP
dedupe, the colour-atelier confirm bug (and its 07-21 duo-gradient follow-up),
both AVIF wirings, rate-limit/prototype-pollution hardening plus its 07-23
EXPIRE-retry follow-up, a widened image/font caching rule, a full visual
re-skin, the `#measure` trust seal, the orphaned `preview-design.js`
endpoint removal, and now the atelier/Cockpit PR itself).
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
  behind) is merged. #444's describe-first opener and Cockpit both now live
  inside the current two-commit-model split; this item should still land
  before any further journey-surface work inherits the same inconsistency.
- **Explicitly not this PR:** C2 Variant 2 is still a live product-decision
  flag, not an engineering task. Also not this PR: #428, a separate,
  now-stale hero PR orthogonal to the studio journey that needs its own
  triage (close-or-rebuild) independent of this recommendation.
