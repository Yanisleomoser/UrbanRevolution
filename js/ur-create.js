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
 *  · Join             — POST an Formspree (E-Mail + Einwilligung + Interessen)
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

  // ── Community-Anmeldung: Formspree-Endpoint ────────────────────────────────
  // Die Beitreten-E-Mails laufen über Formspree (kein eigener Server, keine
  // Upstash-Konfiguration nötig). Der Endpoint ist ÖFFENTLICH/clientseitig —
  // KEIN Secret — und darf hier im Code stehen.
  //
  //   EINRICHTEN: auf https://formspree.io ein (kostenloses) Formular anlegen,
  //   die Endpoint-URL kopieren ("https://formspree.io/f/<deine-id>") und unten
  //   eintragen. Solange der Platzhalter steht, meldet der Button neutral, dass
  //   die Anmeldung noch nicht aktiv ist (Hinweis nur in der Konsole).
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/mnjyloyn";
  const formspreeReady = () =>
    !FORMSPREE_ENDPOINT.includes("REPLACE_WITH_FORM_ID") &&
    /^https:\/\/formspree\.io\/f\/[A-Za-z]\w+$/.test(FORMSPREE_ENDPOINT);

  // Aktuelle Journey-DNA (für Share/Publish) aus dem von flow.js gepflegten
  // localStorage-Eintrag lesen — ohne flow.js anzufassen.
  function currentDna() {
    // Primary source: the journey blob flow.js keeps during the journey.
    try {
      const raw = localStorage.getItem("urev_journey_v1");
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.dna && o.dna.archetypeWeights) return o.dna;
      }
    } catch (_e) {
      /* fall through to the design snapshot */
    }
    // Fallback: handoff() clears that blob the instant it reveals this panel, so
    // read the DNA flow.js stamps onto the finished design (Share/Publish live in
    // the just-revealed Ownership-Moment, where the blob is already gone).
    try {
      const d = window.StateManager && window.StateManager.get("currentDesign");
      if (d && d.dna && d.dna.archetypeWeights) return d.dna;
    } catch (_e) {
      /* ignore */
    }
    return null;
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
    // Repeated clicks inside the 2200ms window must not stack: keep the ONE
    // true original label (not an already-flashed one) and reset the pending
    // restore timer each time, or a fast double-click permanently freezes the
    // button on its confirmation text.
    if (btn._flashTimer) clearTimeout(btn._flashTimer);
    if (btn.dataset.flashOrig === undefined) btn.dataset.flashOrig = btn.textContent;
    btn.textContent = t(key);
    btn.classList.add("is-done");
    btn._flashTimer = setTimeout(() => {
      btn.textContent = btn.dataset.flashOrig;
      delete btn.dataset.flashOrig;
      btn.classList.remove("is-done");
      btn._flashTimer = null;
    }, 2200);
  }

  function ownership() {
    const sec = $("#ownership");
    if (!sec) return;
    let revealed = false;
    const reveal = (design) => {
      if (sec.hidden) {
        sec.hidden = false;
        // §9 Ownership-Nahtstelle: die Karte GLEITET herein statt einfach da
        // zu sein — ein Bogen mit dem Namensschild-Beat der Engine (nur fx;
        // reduced-motion zeigt sofort, der globale Reset stoppt die Animation).
        if (document.documentElement.classList.contains("fx")) {
          sec.classList.add("own-arrive");
          setTimeout(() => sec.classList.remove("own-arrive"), 800);
        }
      }
      // Die fotorealistische Anprobe lebt jetzt IM Ownership-Moment (eine
      // Sektion) — sie wird mit ihm sichtbar, kein separates #preview mehr.
      const nameEl = $("#own-name");
      if (nameEl && design && design.name) {
        // Locale-aware quotation marks (German „…" vs English "…") — same
        // convention as spec-view; avoids German quotes in the English UI.
        const en = window.I18N && window.I18N.getLang && window.I18N.getLang() === "en";
        nameEl.textContent = en ? `“${design.name}”` : `„${design.name}“`;
      }
      // Reservieren-Karte: das Flat des aktuellen Entwurfs als Miniatur
      // (dieselbe DNA→SVG-Maschine wie der Hero-Showcase). Ohne DNA — z. B.
      // ein klassischer Prompt-Entwurf — bleibt die Karte ohne Bild; das
      // Formular funktioniert trotzdem.
      const reserveFlat = $("#reserve-flat");
      if (reserveFlat && window.DesignPreview && window.DesignShare) {
        const dna = currentDna();
        if (dna) {
          try {
            window.DesignPreview.renderInto(reserveFlat, dna, {});
            reserveFlat.hidden = false;
          } catch (_e) { reserveFlat.hidden = true; }
        }
      }
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
        const scrollAtReveal = window.scrollY;
        if (inCreate) setTimeout(() => {
          // The user may have scrolled elsewhere in the 900ms window (e.g. down
          // to browse the community gallery) — respect that instead of yanking
          // them back to a section they've since navigated away from.
          if (Math.abs(window.scrollY - scrollAtReveal) > 40) return;
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
      // Doppelklick-Guard: der await unten macht den Button ~200 ms träge, das
      // lädt zum Nachtippen ein — jeder Extra-Klick wäre ein weiterer POST in
      // den Redis-Ringpuffer und ein zweites urev:published-Event. Während der
      // Handler läuft, ist der Button gesperrt.
      if (publish.disabled) return;
      const dna = currentDna();
      if (!dna || !window.DesignShare) {
        // Nothing to publish (e.g. a classic prompt-based design with no DNA) —
        // don't flash the Share button's success copy, that would lie to the user.
        console.warn("[ur-create] Publish skipped: no DNA design to publish yet.");
        return;
      }
      const d = window.DesignShare.encode(dna);
      const design = window.StateManager && window.StateManager.get("currentDesign");
      const entry = { d, name: (design && design.name) || "", by: "", ts: Date.now() };
      publish.disabled = true;
      let ok = false;
      try {
        const res = await fetch("/api/gallery", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ d: entry.d, name: entry.name }),
        });
        ok = !!(res && res.ok);
      } catch (_e) { /* offline / network error → ok stays false */
      } finally { publish.disabled = false; }
      if (ok) {
        // Der Kreis schließt sich: die Community-Kugel setzt das Stück sofort
        // an ihre Innenwand (community-sphere.js hört auf dieses Event).
        window.dispatchEvent(new CustomEvent("urev:published", { detail: { d: entry.d, name: entry.name } }));
        flashButton(publish, "own.published");
      } else {
        // Nichts wurde serverseitig gespeichert — dem Nutzer keinen Erfolg
        // vorgaukeln (Projekt-Regel: keine geschönten „grün"-Meldungen).
        flashButton(publish, "own.publish_retry");
      }
    });

    const makeReal = $("#own-makereal");
    if (makeReal) makeReal.addEventListener("click", () => { openMakeReal("#measure"); location.hash = "#measure"; });
  }

  // ── 5 · Capture-Formulare: Join (unten) + Reservieren (Ownership-Moment) ──
  // Beide E-Mail-Formulare teilen Validierung, A11y-Verdrahtung und den
  // Formspree-Submit; nur Erfolgstext und Zusatzfelder unterscheiden sich.
  function wireCaptureForm({ form, emailEl, consentEl, status, statusId, okKey, buildPayload }) {
    if (!form) return;
    const setStatus = (key) => { if (status) status.textContent = t(key); };
    // A11y: tie the inline error to the field that failed so a screen reader,
    // on re-focusing it, hears that it's invalid (the live status element
    // carries the human message). Cleared on every fresh submit and on success.
    const markInvalid = (el) => {
      if (!el) return;
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", statusId);
      el.focus();
    };
    const clearInvalid = () => {
      [emailEl, consentEl].forEach((el) => {
        if (el) { el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); }
      });
    };
    const submitBtn = $("button[type=submit]", form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearInvalid();
      const email = (emailEl && emailEl.value || "").trim();
      const consent = consentEl && consentEl.checked;
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setStatus("join.err_email"); markInvalid(emailEl); return; }
      if (!consent) { setStatus("join.err_consent"); markInvalid(consentEl); return; }
      if (!formspreeReady()) {
        console.warn(
          "[join] Formspree-Endpoint nicht gesetzt — FORMSPREE_ENDPOINT in js/ur-create.js eintragen.",
        );
        setStatus("join.err");
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await fetch(FORMSPREE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ email, consent: true, ...buildPayload() }),
        });
        if (res.ok) {
          setStatus(okKey);
          form.reset();
          clearInvalid();
        } else {
          setStatus("join.err");
        }
      } catch (_e) {
        setStatus("join.err");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function joinForm() {
    const form = $("#join-form");
    if (!form) return;
    wireCaptureForm({
      form,
      emailEl: $("#join-email"),
      consentEl: $("#join-consent"),
      status: $("#join-status"),
      statusId: "join-status",
      okKey: "join.ok",
      // Die gewählten Teilnahme-Optionen mitsenden (für den Kontext im Postfach).
      buildPayload: () => ({
        interests: $$('input[name="part"]:checked', form).map((i) => i.value).join(", "),
        _subject: "Neue Urban-Revolution-Anmeldung",
      }),
    });
  }

  // ── 5b · Reservieren am Höhepunkt (docs/WEBSITE-IMPROVEMENTS.md #02) ──────
  // Der kompakte DNA-Code (kein Bild, keine PII) und der Share-Link gehen mit,
  // damit der reservierte Platz mit genau diesem Entwurf verknüpft ist.
  function reserveForm() {
    wireCaptureForm({
      form: $("#reserve-form"),
      emailEl: $("#reserve-email"),
      consentEl: $("#reserve-consent"),
      status: $("#reserve-status"),
      statusId: "reserve-status",
      okKey: "own.reserve_ok",
      buildPayload: () => {
        const design = window.StateManager && window.StateManager.get("currentDesign");
        const dna = currentDna();
        const canShare = dna && window.DesignShare;
        return {
          design: canShare ? window.DesignShare.encode(dna) : "",
          designName: (design && design.name) || "",
          designUrl: canShare ? window.DesignShare.buildUrl(dna) : "",
          _subject: "Urban Revolution — Platz reserviert",
        };
      },
    });
  }

  // ── 7 · Sticky-CTA (mobil) ─────────────────────────────────────────────────
  function stickyCta() {
    const cta = $("#sticky-create");
    // Anchor on the landing hero (.lp-hero). The old UR-Create hero (.ur-hero)
    // was removed in a redesign, so this selector went null and the mobile
    // sticky CTA never un-hid — a silently-dead conversion affordance.
    const hero = $(".lp-hero");
    if (!cta || !hero) return;
    const design = $("#design");
    const community = $("#community");
    // Der Pill erscheint nur mobil (CSS: `.sticky-create { display:none }` ab
    // 861px). Diese Media-Query spiegelt exakt diesen Breakpoint, damit der
    // Scroll-Handler auf Desktop GAR KEIN Layout misst — vorher las er dort 2–3
    // erzwungene Reflows (offsetHeight + getBoundingClientRect) pro Scroll-Event,
    // obwohl der Button nie sichtbar ist: eine echte Scroll-Ruckel-Quelle.
    const mobileMq = window.matchMedia("(max-width: 860px)");
    // Hero-Höhe für den Schwellwert cachen — nur bei Resize neu messen, nicht
    // synchron in jedem Scroll-Frame.
    let heroH = hero.offsetHeight;
    // Sichtbarkeit von #design/#community per IntersectionObserver verfolgen,
    // statt in jedem Scroll-Frame getBoundingClientRect() zu lesen (erzwungenes
    // Reflow). So misst der Scroll-Handler NULL Layout — er liest nur scrollY.
    let designInView = false;
    let communityInView = false;
    let scheduled = false;
    const update = () => {
      scheduled = false;
      if (!mobileMq.matches) { if (!cta.hidden) cta.hidden = true; return; }
      const past = window.scrollY > heroH * 0.8;
      // In UR Create und in der Community-Sphäre hat der Moment eigene CTAs —
      // dort tritt der Sticky-Button zurück.
      cta.hidden = !past || designInView || communityInView;
    };
    // Scroll-Events zu EINEM Read pro Frame zusammenfassen (rAF-Throttle);
    // der rohe Handler las bei jedem Event synchron Layout und thrashte so.
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.target === design) designInView = e.isIntersecting;
          else if (e.target === community) communityInView = e.isIntersecting;
        });
        onScroll();
      });
      if (design) io.observe(design);
      if (community) io.observe(community);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { heroH = hero.offsetHeight; onScroll(); }, { passive: true });
    if (mobileMq.addEventListener) mobileMq.addEventListener("change", update);
    else if (mobileMq.addListener) mobileMq.addListener(update);
    update();
  }

  // ── 8 · make-real aufklappen (Maße/Vorschau/Produktion/FAQ) ────────────────
  function openMakeReal(focusSel) {
    const mr = $("#make-real");
    if (!mr || !mr.hidden) return; // already open → native anchor focus works
    mr.hidden = false;
    // A11y (WCAG 2.4.3): the panel was display:none when the anchor fired, so
    // native fragment-focus fell to <body>. Move focus into the section the
    // user asked for (defaults to the measurement step), now that it's visible.
    const target = (focusSel && $(focusSel)) || $("#measure");
    if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: false }); }
  }
  function makeRealLinks() {
    const ids = ["#measure", "#production", "#faq"];
    const check = () => { if (ids.includes(location.hash)) openMakeReal(location.hash); };
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && ids.includes(a.getAttribute("href"))) openMakeReal(a.getAttribute("href"));
    });
    window.addEventListener("hashchange", check);
    check();
  }

  function init() {
    heroShowcase();
    ownership();
    joinForm();
    reserveForm();
    stickyCta();
    makeRealLinks();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
