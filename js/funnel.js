/**
 * Urban Revolution — Geführter Design-Funnel (window.Funnel)
 *
 * Für Besucher, die Hilfe brauchen zu wissen, was sie wollen: ein
 * mehrstufiger Chooser (allgemein → spezifisch). Aus der Auswahl wird ein
 * Brief zusammengesetzt (der die Marke „Stoff aus recycelten Kleidern" gleich
 * mitträgt) und an den bestehenden Design-Flow übergeben — #ai-prompt füllen,
 * Typ setzen, zu #design scrollen, generieren. Der freie Prompt bleibt jederzeit
 * als „komplett selbst designen"-Weg erhalten.
 *
 * IIFE-with-global im Stil der übrigen Module. Progressive Enhancement:
 * fällt das Modul aus, bleibt die freie Eingabe voll funktionsfähig.
 */
const Funnel = (() => {
  // Jede Stufe: i18n-Label-Key + ein deutsches Prompt-Wort (der lokale
  // Fallback-Generator ist keyword-basiert auf Deutsch; der Server-Proxy
  // versteht ohnehin jede Sprache — daher bauen wir den Brief auf Deutsch).
  const STEPS = [
    {
      key: "vibe", titleKey: "funnel.q_vibe",
      options: [
        { key: "everyday", labelKey: "funnel.vibe_everyday", de: "den Alltag" },
        { key: "street", labelKey: "funnel.vibe_street", de: "einen Streetwear-Look" },
        { key: "business", labelKey: "funnel.vibe_business", de: "das Büro" },
        { key: "night", labelKey: "funnel.vibe_night", de: "einen Abend aus" },
        { key: "sport", labelKey: "funnel.vibe_sport", de: "Sport" },
      ],
    },
    {
      key: "type", titleKey: "funnel.q_type",
      options: [
        { key: "tshirt", labelKey: "funnel.type_tshirt", de: "T-Shirt" },
        { key: "hoodie", labelKey: "funnel.type_hoodie", de: "Hoodie" },
        { key: "shirt", labelKey: "funnel.type_shirt", de: "Hemd" },
        { key: "pants", labelKey: "funnel.type_pants", de: "Hose" },
        { key: "jacket", labelKey: "funnel.type_jacket", de: "Jacke" },
        { key: "dress", labelKey: "funnel.type_dress", de: "Kleid" },
      ],
    },
    {
      key: "fit", titleKey: "funnel.q_fit",
      options: [
        { key: "slim", labelKey: "funnel.fit_slim", de: "schmal geschnittenes", fit: 0.2 },
        { key: "regular", labelKey: "funnel.fit_regular", de: "regulär geschnittenes", fit: 0.5 },
        { key: "oversized", labelKey: "funnel.fit_oversized", de: "oversized", fit: 0.85 },
      ],
    },
    {
      key: "color", titleKey: "funnel.q_color",
      options: [
        { key: "black", labelKey: "funnel.color_black", de: "Schwarz", hex: "#1a1a1a" },
        { key: "white", labelKey: "funnel.color_white", de: "Weiß", hex: "#ffffff" },
        { key: "blue", labelKey: "funnel.color_blue", de: "Tiefblau", hex: "#1e3a8a" },
        { key: "green", labelKey: "funnel.color_green", de: "Waldgrün", hex: "#365314" },
        { key: "burgundy", labelKey: "funnel.color_burgundy", de: "Burgund", hex: "#831843" },
        { key: "purple", labelKey: "funnel.color_purple", de: "Violett", hex: "#6b21a8" },
      ],
    },
  ];

  let overlay = null;
  let step = 0;
  const selection = {};
  let lastFocus = null;

  function t(key, fallback) {
    if (window.I18N && typeof window.I18N.t === "function") {
      const v = window.I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function buildPrompt() {
    const vibe = selection.vibe, type = selection.type, fit = selection.fit, color = selection.color;
    if (!type) return "";
    const fitWord = fit ? fit.de + " " : "";
    const forWord = vibe ? " für " + vibe.de : "";
    const colWord = color ? ", in " + color.de : "";
    return `Ein ${fitWord}${type.de}${forWord}${colWord}, aus recyceltem Stoff aus alten Kleidern.`;
  }

  // Übergabe an den bestehenden Design-Flow (kein Eingriff in app.js-Interna):
  // Typ-Button klicken (setzt currentType + UI), Prompt ins Textarea, zu #design
  // scrollen, dann den Generieren-Button auslösen.
  function handoff() {
    const prompt = buildPrompt();
    const ta = document.getElementById("ai-prompt");
    const typeBtn = selection.type &&
      document.querySelector('.type-btn[data-type="' + selection.type.key + '"], [data-type="' + selection.type.key + '"]');
    if (typeBtn && typeof typeBtn.click === "function") {
      try { typeBtn.click(); } catch { /* noop */ }
    }
    if (ta && prompt) {
      ta.value = prompt;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const reduce = reduceMotion();
    const section = document.getElementById("design");
    if (section) section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const gen = document.getElementById("generate-btn");
    if (gen) window.setTimeout(() => { try { gen.click(); } catch { /* noop */ } }, reduce ? 0 : 650);
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", onKey);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowLeft" && step > 0) { step--; render(); }
  }

  function choose(opt) {
    const s = STEPS[step];
    selection[s.key] = opt;
    if (step < STEPS.length - 1) {
      step++;
      render();
    } else {
      close();
      handoff();
    }
  }

  function render() {
    if (!overlay) return;
    const s = STEPS[step];
    const card = overlay.querySelector(".funnel-card");
    const total = STEPS.length;
    const dots = STEPS.map((_, i) =>
      '<span class="funnel-dot' + (i === step ? " is-active" : (i < step ? " is-done" : "")) + '"></span>'
    ).join("");

    const opts = s.options.map((o) => {
      const sel = selection[s.key] && selection[s.key].key === o.key;
      const swatch = o.hex
        ? '<span class="funnel-swatch" style="background:' + o.hex + '"></span>'
        : "";
      return (
        '<button type="button" class="funnel-opt' + (sel ? " is-selected" : "") +
        '" data-key="' + o.key + '">' + swatch +
        '<span class="funnel-opt-label">' + t(o.labelKey, o.de) + "</span></button>"
      );
    }).join("");

    card.innerHTML =
      '<div class="funnel-head">' +
        '<p class="funnel-step mono-label">[ ' + (step + 1) + " / " + total + " ]</p>" +
        '<button type="button" class="funnel-close" aria-label="' + t("funnel.close", "Schließen") + '">×</button>' +
      "</div>" +
      '<h2 class="funnel-q">' + t(s.titleKey, "") + "</h2>" +
      '<div class="funnel-opts">' + opts + "</div>" +
      '<div class="funnel-foot">' +
        '<div class="funnel-dots" aria-hidden="true">' + dots + "</div>" +
        (step > 0 ? '<button type="button" class="funnel-back mono-label">[ ← zurück ]</button>' : "<span></span>") +
        '<button type="button" class="funnel-skip mono-label">' + t("funnel.skip", "[ Ich designe selbst → ]") + "</button>" +
      "</div>";

    // wire
    card.querySelectorAll(".funnel-opt").forEach((b) => {
      b.addEventListener("click", () => {
        const o = s.options.find((x) => x.key === b.dataset.key);
        if (o) choose(o);
      });
    });
    card.querySelector(".funnel-close").addEventListener("click", close);
    const back = card.querySelector(".funnel-back");
    if (back) back.addEventListener("click", () => { if (step > 0) { step--; render(); } });
    card.querySelector(".funnel-skip").addEventListener("click", () => {
      close();
      const hero = document.getElementById("hero-prompt-input");
      if (hero && typeof hero.focus === "function") hero.focus();
    });

    const first = card.querySelector(".funnel-opt");
    if (first) first.focus();
  }

  function open() {
    if (overlay) return;
    lastFocus = document.activeElement;
    step = 0;
    for (const k in selection) delete selection[k];
    overlay = document.createElement("div");
    overlay.className = "funnel-overlay" + (reduceMotion() ? " no-anim" : "");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", t("funnel.title", "Hilf mir entscheiden"));
    overlay.innerHTML = '<div class="funnel-card" tabindex="-1"></div>';
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey);
    render();
  }

  function init() {
    const trigger = document.getElementById("funnel-trigger");
    if (trigger) trigger.addEventListener("click", open);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { open, close };
})();
window.Funnel = Funnel;
