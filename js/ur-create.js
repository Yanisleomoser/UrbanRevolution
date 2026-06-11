/**
 * Urban Revolution — UR-Create-Direktive · Verdrahtung (Side-Effect-Modul)
 *
 * Verbindet die Produkt-Architektur-Sektionen mit der bestehenden Engine, OHNE
 * app.js / flow.js zu verändern (rein additiv, alle Zugriffe optional-guarded):
 *
 *  · Hero-Showcase   — eine endlos morphende Konzept-Evolution (GarmentSVG)
 *  · Ownership-Moment — blendet sich ein, sobald eine Kreation existiert
 *                       (StateManager currentDesign); Save · Share · Publish
 *  · Community-Hub    — /api/gallery (Upstash) mit kuratiertem Fallback,
 *                       Typ-Filter + Beitreten; VIEW/REMIX öffnen die DNA in
 *                       UR Create (Share-URL)
 *  · Problem-Karten   — Schritt-für-Schritt-Story
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
  // Galerie-Items können aus dem öffentlichen Publish-Endpoint stammen → Name/
  // Autor vor dem Einfügen als HTML escapen (defensiv gegen eingeschleustes Markup).
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

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

  // ── 1 · Hero-Showcase — Flat → echtes Foto, gewebt ─────────────────────────
  // Pro Stück: der technische Flat (GarmentSVG, aus derselben DNA) UND das
  // passende Studio-Foto stehen deckungsgleich übereinander (beide zentriert auf
  // dunklem Grund). Eine leuchtende „Webkante" fährt von oben nach unten —
  // darüber wird das echte Bild gewoben (per clip-path enthüllt, vorn unscharf →
  // scharf), darunter bleibt der Flat. So verwandelt sich der Stoff flüssig vom
  // Schnitt ins reale Stück. Datenquelle: hero-pairs.json (DNA == Foto).
  async function heroShowcase() {
    const stage = $("#hero-showcase");
    if (!stage) return;
    let pairs = [];
    try {
      const res = await fetch("js/design-engine/content/hero-pairs.json");
      pairs = (await res.json()).pairs || [];
    } catch (_e) { pairs = []; }
    const DIR = "js/design-engine/content/img/hero/";
    if (!pairs.length) return;

    stage.innerHTML =
      '<div class="ur-hero-flat" aria-hidden="true"></div>' +
      '<img class="ur-hero-photo" alt="" decoding="async">' +
      '<div class="ur-hero-weave" aria-hidden="true"></div>';
    const flatEl = stage.querySelector(".ur-hero-flat");
    const photoEl = stage.querySelector(".ur-hero-photo");
    const weaveEl = stage.querySelector(".ur-hero-weave");
    const canFlat = !!(window.DesignPreview && window.DesignShare);
    const renderFlat = (i) => {
      if (!canFlat) return;
      const dna = window.DesignShare.decode(pairs[i].dna);
      if (dna) window.DesignPreview.renderInto(flatEl, dna, {});
    };
    pairs.forEach((p) => { const im = new Image(); im.src = DIR + p.id + ".webp"; }); // vorladen

    const HIDDEN = "inset(0 0 100% 0)"; // Foto komplett abgeschnitten (von unten)
    const SHOWN = "inset(0 0 0% 0)";

    // Erststand: erstes Stück, Flat sichtbar, Foto verdeckt.
    const FLAT_FULL = "inset(0% 0 0 0)";   // Flat ganz sichtbar
    const FLAT_GONE = "inset(100% 0 0 0)"; // Flat von oben weggeschnitten
    renderFlat(0);
    flatEl.style.clipPath = FLAT_FULL;
    photoEl.src = DIR + pairs[0].id + ".webp";
    photoEl.style.clipPath = HIDDEN;

    // Reduced-motion / kein Flat-Renderer: direkt das Ergebnis (Foto), statisch.
    if (reduce() || !canFlat || !("animate" in photoEl)) {
      photoEl.style.clipPath = SHOWN;
      flatEl.style.clipPath = FLAT_GONE;
      return;
    }

    // Gleichmäßiger, sanfter Sweep (kein Front-Load → die Webkante WANDERT
    // sichtbar, statt das Bild vorzuschnappen).
    const EASE = "cubic-bezier(.65,0,.35,1)";
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const done = (anim) => anim.finished.catch(() => {}); // abgebrochene Animationen schlucken
    // WICHTIG: fill:"forwards"-Animationen überschreiben inline-Styles UND
    // sammeln sich an → vor jeder Phase die alten abbrechen, sonst bleibt z. B.
    // ein Opacity:0 aus dem Übergang hängen und das Weben ist unsichtbar.
    const clearAnims = (el) => el.getAnimations().forEach((a) => a.cancel());

    async function weaveIn() {
      const dur = 1850;
      // ZUERST verdecken + alte (forwards-)Anims abräumen, DANN erst decoden —
      // sonst blitzt das frisch gesetzte Foto während des decode-await kurz voll
      // auf (alte clip-Anim stand noch auf SHOWN). Reihenfolge ist hier der Bug.
      clearAnims(photoEl); clearAnims(flatEl); clearAnims(weaveEl);
      photoEl.style.opacity = "1"; photoEl.style.clipPath = HIDDEN; photoEl.style.filter = "none";
      flatEl.style.opacity = "1"; flatEl.style.clipPath = FLAT_FULL;
      weaveEl.style.opacity = "0"; weaveEl.style.top = "0%";
      try { if (photoEl.decode) await photoEl.decode(); } catch (_e) { /* egal */ }
      // Foto wird von oben enthüllt, Flat KOMPLEMENTÄR von oben weggewebt → beide
      // grenzen exakt an der Webkante an (kein Überlappen/Ausfransen).
      const a = photoEl.animate([{ clipPath: HIDDEN }, { clipPath: SHOWN }],
        { duration: dur, easing: EASE, fill: "forwards" });
      flatEl.animate([{ clipPath: FLAT_FULL }, { clipPath: FLAT_GONE }],
        { duration: dur, easing: EASE, fill: "forwards" });
      // frisch enthüllter Stoff: unscharf → scharf (verdichtet sich zum echten Bild)
      photoEl.animate(
        [{ filter: "blur(12px) saturate(1.4) brightness(1.15)" }, { filter: "blur(0px) saturate(1) brightness(1)" }],
        { duration: dur, easing: EASE, fill: "forwards" });
      weaveEl.animate([{ top: "0%" }, { top: "100%" }], { duration: dur, easing: EASE, fill: "forwards" });
      weaveEl.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }],
        { duration: dur, easing: "linear", fill: "forwards" });
      await done(a);
      weaveEl.style.opacity = "0";
    }

    // Übergang zum nächsten Stück: weiches Crossfade vom fertigen Foto zum
    // nächsten Flat (kurz, sauber — der Star ist das Weben oben).
    async function toNextFlat(next) {
      renderFlat(next);
      clearAnims(flatEl);
      flatEl.style.clipPath = FLAT_FULL;
      flatEl.style.opacity = "0";
      const fa = flatEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 520, easing: EASE, fill: "forwards" });
      photoEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: EASE, fill: "forwards" });
      await done(fa);
      // Übergang fertig: ALLE Foto-Anims weg (auch die alte clip-Anim auf SHOWN),
      // nächstes Bild bereits VERDECKT (clip HIDDEN) setzen → kein Aufblitzen.
      clearAnims(photoEl); clearAnims(flatEl);
      flatEl.style.opacity = "1";
      photoEl.src = DIR + pairs[next].id + ".webp";
      photoEl.style.clipPath = HIDDEN;
      photoEl.style.opacity = "1";
      photoEl.style.filter = "none";
    }

    let i = 0;
    /* eslint-disable no-await-in-loop */
    (async function loop() {
      while (true) {
        await weaveIn();        // Schnitt → echtes Stück gewebt (Star)
        await wait(2600);       // das fertige Stück hält
        i = (i + 1) % pairs.length;
        await toNextFlat(i);    // Crossfade zum nächsten Schnitt
        await wait(550);        // kurz der reine Schnitt
      }
    })();
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
      // Die fotorealistische Anprobe lebt jetzt IM Ownership-Moment (eine
      // Sektion) — sie wird mit ihm sichtbar, kein separates #preview mehr.
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

  // ── 3 · Community-Galerie (mit Typ-Filter) ─────────────────────────────────
  let galleryReady = false;
  let galleryItems = null;   // dekodierte Items: { it, dna, category }
  let galleryFilter = "all"; // aktiver Kleidungstyp-Filter

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
    // Session-Veröffentlichungen zuerst, dann Backend/kuratiert; je Item die DNA
    // einmal dekodieren (Typ für den Filter, Geometrie für die Kachel).
    galleryItems = published.concat(items).slice(0, 24).map((it) => {
      const dna = decode(it.d);
      return { it, dna, category: (dna && dna.category) || "" };
    });
    buildFilters();
    paintGallery();
  }

  // Filter-Chips aus den tatsächlich vorhandenen Typen (in CONFIG-Reihenfolge).
  // Bei < 2 Typen keine Leiste (ein einzelner Filter wäre sinnlos).
  function buildFilters() {
    const bar = $("#gallery-filters");
    if (!bar || !galleryItems) return;
    const present = new Set(galleryItems.map((x) => x.category).filter(Boolean));
    const order = (window.CONFIG && window.CONFIG.GARMENT_TYPES) || [];
    const types = order.filter((k) => present.has(k));
    if (types.length < 2) { bar.innerHTML = ""; bar.hidden = true; return; }
    bar.hidden = false;
    const chip = (key, label) =>
      `<button type="button" class="gallery-chip${galleryFilter === key ? " is-active" : ""}" data-filter="${key}" aria-pressed="${galleryFilter === key ? "true" : "false"}">${label}</button>`;
    bar.innerHTML = chip("all", t("gal.filter_all")) +
      types.map((k) => chip(k, t("type." + k))).join("");
    bar.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
      galleryFilter = b.getAttribute("data-filter");
      buildFilters();
      paintGallery();
    }));
  }

  function paintGallery() {
    const grid = $("#gallery-grid");
    if (!grid || !galleryItems) return;
    const view = galleryFilter === "all"
      ? galleryItems
      : galleryItems.filter((x) => x.category === galleryFilter);
    if (!view.length) {
      grid.innerHTML = `<p class="gallery-empty">${t("gal.empty")}</p>`;
      return;
    }
    grid.innerHTML = view.map(({ it, dna }, idx) => {
      const svg = flatFor(dna);
      const name = it.name ? esc(it.name) : "—";
      const by = it.by ? esc(it.by) : t("gal.anon");
      const safe = encodeURIComponent(it.d);
      // Erste Kachel der Ansicht wird hervorgehoben (größer, als Eyecatcher).
      return `<article class="gallery-tile${idx === 0 ? " is-featured" : ""}">
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

  // ── 5 · Join (Waitlist) ────────────────────────────────────────────────────
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
    const ids = ["#measure", "#production", "#faq"];
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
    joinForm();
    stickyCta();
    makeRealLinks();
    // Sprache umgeschaltet → dynamische Texte (Filter-Chips, Galerie-Buttons) neu.
    window.addEventListener("language:change", () => { if (galleryReady) renderGallery(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
