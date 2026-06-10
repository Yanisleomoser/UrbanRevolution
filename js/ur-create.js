/**
 * Urban Revolution — UR-Create-Direktive · Verdrahtung (Side-Effect-Modul)
 *
 * Verbindet die Produkt-Architektur-Sektionen mit der bestehenden Engine, OHNE
 * app.js / flow.js zu verändern (rein additiv, alle Zugriffe optional-guarded):
 *
 *  · Hero-Showcase   — eine endlos morphende Konzept-Evolution (GarmentSVG)
 *  · Ownership-Moment — blendet sich ein, sobald eine Kreation existiert
 *                       (StateManager currentDesign); Save · Share · Publish
 *  · Community-Galerie— /api/gallery (Upstash) mit kuratiertem Fallback;
 *                       VIEW/REMIX öffnen die DNA in UR Create (Share-URL)
 *  · Problem-Karten   — Schritt-für-Schritt-Story
 *  · Vision-Timeline  — Stationen wechseln den Beschreibungstext
 *  · Join             — POST /api/waitlist { email, consent }
 *  · Sticky-CTA       — mobil, erscheint nach dem Hero
 *  · make-real        — klappt den Maß-/Produktions-Pfad auf
 *
 * Folgt dem Seiteneffekt-Muster von animations.js / flair.js (kein Global).
 */
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const t = (k, v) => (window.I18N ? window.I18N.t(k, v) : k);
  const reduce = () =>
    window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

  // DNA-Share-String → sauberer Flat-SVG (für Galerie + Hero-Showcase).
  function flatFor(dna) {
    if (!dna || !window.GarmentSVG || !window.DesignPreview) return "";
    try {
      const p = window.DesignPreview.params(dna);
      return window.GarmentSVG.build(p.category || "tshirt", p);
    } catch (_e) {
      return "";
    }
  }
  const decode = (s) => (window.DesignShare ? window.DesignShare.decode(s) : null);

  // Aktuelle Journey-DNA (für Share/Publish) aus dem von flow.js gepflegten
  // localStorage-Eintrag lesen — ohne flow.js anzufassen.
  function currentDna() {
    try {
      const raw = localStorage.getItem("urev_journey_v1");
      if (!raw) return null;
      const o = JSON.parse(raw);
      return o && o.dna && o.dna.archetypeWeights ? o.dna : null;
    } catch (_e) {
      return null;
    }
  }

  let curated = null;
  const published = []; // in dieser Session veröffentlichte/lokale Kreationen
  async function loadCurated() {
    if (curated) return curated;
    try {
      const res = await fetch("js/design-engine/content/gallery-curated.json");
      curated = (await res.json()).items || [];
    } catch (_e) {
      curated = [];
    }
    return curated;
  }

  // ── 1 · Hero-Showcase — endlose Konzept-Evolution ──────────────────────────
  async function heroShowcase() {
    const el = $("#hero-showcase");
    if (!el || !window.DesignPreview) return;
    const items = await loadCurated();
    const dnas = items.map((i) => decode(i.d)).filter(Boolean);
    if (!dnas.length) return;
    let i = 0;
    const show = () => window.DesignPreview.renderInto(el, dnas[i % dnas.length], {});
    show();
    if (reduce() || dnas.length < 2) return;
    setInterval(() => { i += 1; show(); }, 3200);
  }

  // ── 2 · Ownership-Moment ───────────────────────────────────────────────────
  function flashButton(btn, key) {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = t(key);
    btn.classList.add("is-done");
    setTimeout(() => { btn.textContent = prev; btn.classList.remove("is-done"); }, 2200);
  }

  function ownership() {
    const sec = $("#ownership");
    if (!sec) return;
    let revealed = false;
    const reveal = (design) => {
      if (sec.hidden) sec.hidden = false;
      // Mit der ersten Kreation öffnet sich auch die fotorealistische Vorschau —
      // vorher wäre sie Output ohne Input (leere Stage, toter Anprobe-Dialog).
      const prevSec = $("#preview");
      if (prevSec && prevSec.hidden) prevSec.hidden = false;
      const nameEl = $("#own-name");
      if (nameEl && design && design.name) nameEl.textContent = "„" + design.name + "“";
      if (!revealed) {
        revealed = true;
        if (window.I18N && window.I18N.apply) window.I18N.apply(sec);
        // Geführter nächster Schritt: sanft zum Ownership-Moment scrollen —
        // aber nur beim Übergang (erste Kreation) und nicht bei reduced motion.
        const inCreate = (() => { const d = $("#design"); if (!d) return false;
          const r = d.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; })();
        // Eigener rAF-Tween: natives smooth-Scrolling (scrollIntoView UND
        // scrollTo{smooth}) ist mit dem globalen overflow-x:hidden auf
        // html/body in Chromium wirkungslos (verifiziert) — instant geht.
        if (inCreate) setTimeout(() => {
          const target = sec.getBoundingClientRect().top + window.scrollY - 12;
          if (reduce()) { window.scrollTo(0, target); return; }
          const from = window.scrollY, dist = target - from, dur = 700;
          const t0 = performance.now();
          const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
          const step = (now) => {
            const k = Math.min(1, (now - t0) / dur);
            window.scrollTo(0, from + dist * ease(k));
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }, 900);
      }
    };
    if (window.StateManager) {
      const existing = window.StateManager.get("currentDesign");
      if (existing) reveal(existing);
      // StateManager.subscribe-Callbacks erhalten { oldValue, newValue }.
      window.StateManager.subscribe("currentDesign:change", (e) => reveal(e && e.newValue));
    }

    const save = $("#own-save");
    if (save) save.addEventListener("click", () => {
      const design = window.StateManager && window.StateManager.get("currentDesign");
      if (design && window.Library) { try { window.Library.add(design); } catch (_e) { /* quota */ } }
      flashButton(save, "own.saved");
    });

    const share = $("#own-share");
    if (share) share.addEventListener("click", async () => {
      const dna = currentDna();
      const url = dna && window.DesignShare ? window.DesignShare.buildUrl(dna) : window.location.href;
      try {
        if (navigator.share && dna) { await navigator.share({ url, title: "Urban Revolution" }); }
        else if (navigator.clipboard) { await navigator.clipboard.writeText(url); }
      } catch (_e) { /* abgebrochen */ }
      flashButton(share, "own.shared");
    });

    const publish = $("#own-publish");
    if (publish) publish.addEventListener("click", async () => {
      const dna = currentDna();
      if (!dna || !window.DesignShare) { flashButton(publish, "own.shared"); return; }
      const d = window.DesignShare.encode(dna);
      const design = window.StateManager && window.StateManager.get("currentDesign");
      const entry = { d, name: (design && design.name) || "", by: "", ts: Date.now() };
      try {
        await fetch("/api/gallery", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ d: entry.d, name: entry.name }),
        });
      } catch (_e) { /* offline → trotzdem lokal zeigen */ }
      published.unshift(entry);     // sofort sichtbar, auch ohne Backend
      renderGallery();
      flashButton(publish, "own.published");
    });

    const makeReal = $("#own-makereal");
    if (makeReal) makeReal.addEventListener("click", () => { openMakeReal(); location.hash = "#measure"; });
  }

  // ── 3 · Community-Galerie ──────────────────────────────────────────────────
  let galleryReady = false;
  async function renderGallery() {
    const grid = $("#gallery-grid");
    if (!grid) return;
    let items = [];
    try {
      const res = await fetch("/api/gallery");
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : await loadCurated();
    } catch (_e) {
      items = await loadCurated();
    }
    const all = published.concat(items).slice(0, 24);
    if (!all.length) {
      grid.innerHTML = `<p class="gallery-empty">${t("gal.empty")}</p>`;
      return;
    }
    grid.innerHTML = all.map((it) => {
      const dna = decode(it.d);
      const svg = flatFor(dna);
      const name = it.name ? it.name : "—";
      const by = it.by ? it.by : t("gal.anon");
      const safe = encodeURIComponent(it.d);
      return `<article class="gallery-tile">
        <div class="gallery-tile-stage">${svg}</div>
        <p class="gallery-tile-name">${name}</p>
        <p class="gallery-tile-by">${by}</p>
        <div class="gallery-tile-actions">
          <a class="is-view" href="#design" data-d="${safe}">${t("gal.view")}</a>
          <button type="button" class="is-remix" data-d="${safe}">${t("gal.remix")}</button>
        </div>
      </article>`;
    }).join("");
    grid.querySelectorAll("[data-d]").forEach((btn) => btn.addEventListener("click", (e) => {
      e.preventDefault();
      openInCreate(decodeURIComponent(btn.getAttribute("data-d")));
    }));
  }

  // Eine Kreation in UR Create öffnen (Share-URL → flow.js liest sie beim Laden
  // und landet auf dem Refine/Evolve-Screen = Startpunkt für den Remix).
  function openInCreate(shareStr) {
    const dna = decode(shareStr);
    if (!dna || !window.DesignShare) { location.hash = "#design"; return; }
    const url = window.DesignShare.buildUrl(dna);
    window.location.href = url;
  }

  // ── 4 · Problem-Story-Karten ───────────────────────────────────────────────
  function problemCards() {
    const stack = $("#prob-stack");
    if (!stack) return;
    const cards = $$(".prob-card", stack);
    const next = $("#prob-next");
    const done = $("#prob-done");
    const prog = $("#prob-progress");
    let i = 0;
    const render = () => {
      cards.forEach((c, n) => c.classList.toggle("is-active", n === i));
      if (prog) prog.textContent = (i + 1) + " / " + cards.length;
      const last = i >= cards.length - 1;
      if (next) next.hidden = last;
      if (done) done.hidden = !last;
    };
    if (next) next.addEventListener("click", () => { if (i < cards.length - 1) { i += 1; render(); } });
    render();
  }

  // ── 5 · Vision-Timeline ────────────────────────────────────────────────────
  function visionTimeline() {
    const line = $("#vision-line");
    const desc = $("#vision-desc");
    if (!line || !desc) return;
    const stops = $$(".vision-stop", line);
    const select = (stop) => {
      stops.forEach((s) => s.classList.toggle("is-active", s === stop));
      const n = Number.parseInt(stop.getAttribute("data-stage"), 10) || 0;
      desc.textContent = t("vision.d" + (n + 1));
    };
    stops.forEach((s) => s.addEventListener("click", () => select(s)));
  }

  // ── 6 · Join (Waitlist) ────────────────────────────────────────────────────
  function joinForm() {
    const form = $("#join-form");
    if (!form) return;
    const status = $("#join-status");
    const setStatus = (key) => { if (status) status.textContent = t(key); };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = ($("#join-email") && $("#join-email").value || "").trim();
      const consent = $("#join-consent") && $("#join-consent").checked;
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setStatus("join.err_email"); return; }
      if (!consent) { setStatus("join.err_consent"); return; }
      try {
        const res = await fetch("/api/waitlist", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, consent: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) setStatus(data.status === "already" ? "join.already" : "join.ok");
        else setStatus("join.err");
      } catch (_e) {
        setStatus("join.err");
      }
    });
  }

  // ── 7 · Sticky-CTA (mobil) ─────────────────────────────────────────────────
  function stickyCta() {
    const cta = $("#sticky-create");
    const hero = $(".ur-hero");
    if (!cta || !hero) return;
    const onScroll = () => {
      const past = window.scrollY > hero.offsetHeight * 0.8;
      const design = $("#design");
      const atCreate = design && design.getBoundingClientRect().top < window.innerHeight && design.getBoundingClientRect().bottom > 0;
      cta.hidden = !past || atCreate;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ── 8 · make-real aufklappen (Maße/Vorschau/Produktion/FAQ) ────────────────
  function openMakeReal() {
    const mr = $("#make-real");
    if (mr && mr.hidden) mr.hidden = false;
  }
  function makeRealLinks() {
    const ids = ["#measure", "#preview", "#production", "#faq"];
    const check = () => { if (ids.includes(location.hash)) openMakeReal(); };
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && ids.includes(a.getAttribute("href"))) openMakeReal();
    });
    window.addEventListener("hashchange", check);
    check();
  }

  function init() {
    heroShowcase();
    ownership();
    renderGallery();
    galleryReady = true;
    problemCards();
    visionTimeline();
    joinForm();
    stickyCta();
    makeRealLinks();
    // Sprache umgeschaltet → dynamische Texte (Vision-Desc, Galerie-Buttons) neu.
    window.addEventListener("language:change", () => { if (galleryReady) renderGallery(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
