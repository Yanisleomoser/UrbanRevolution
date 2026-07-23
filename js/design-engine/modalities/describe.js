/**
 * Urban Revolution — Design Engine · Modality "describe"
 * „Beschreib es. Die Maschine liest mit." — der optionale Auftakt in den
 * eigenen Worten des Users (Atelier-Analyse U4: die Studio-Headline verspricht
 * Beschreiben, die Reise liess bis zum letzten Screen kein Wort zu).
 *
 * Der Parser ist deterministisch und zu 100 % clientseitig: die exportierten
 * Strict-Extraktoren aus ai.js (Farbe/Material/Typ/Fit/Muster — null, wenn
 * nicht erwähnt) plus ein kleines Zusatzlexikon für Konstruktionsworte
 * (Kapuze, kurz, matt, Cargo …). Jeder erkannte Wert stammt aus den WORTEN
 * DES USERS — die KI entwirft nie, sie liest. Ergebnis wird als editierbare
 * „Verstanden"-Zeilen zurückgespielt; erst „Übernehmen" committet (conf 0.62:
 * über der Entscheidungs-Schwelle, damit der Motor beantwortete Fragen
 * überspringt — unter protectExplicit-Niveau, damit jede spätere echte
 * Antwort gewinnt). Leer lassen / „Lieber Schritt für Schritt" → der
 * klassische Pfad, unverändert.
 */
(function () {
  const V = window.DEVisuals;
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  const CAT_WORDS = {
    tshirt: { de: "T-Shirt", en: "T-shirt" }, hoodie: { de: "Hoodie", en: "Hoodie" },
    shirt: { de: "Hemd", en: "Shirt" }, pants: { de: "Hose", en: "Trousers" },
    jacket: { de: "Jacke", en: "Jacket" }, dress: { de: "Kleid", en: "Dress" },
  };
  // ai.js-Pattern-Werte → DNA-Enum (pattern.type).
  const PATTERN_MAP = {
    stripes_h: "stripe", stripes_v: "stripe", dots: "graphic", check: "check",
    karo: "check", camo: "camo", abstract: "abstract", graphic: "graphic",
    floral: "graphic", solid: "none",
  };
  const has = (t, words) => words.some((w) => t.includes(w));

  function fitWord(v, lang) {
    if (typeof v !== "number") return String(v);
    if (v < 0.33) return lang === "en" ? "slim" : "schmal";
    if (v > 0.66) return lang === "en" ? "oversized" : "oversized";
    return "regular";
  }

  // text → Liste editierbarer Erkenntnisse [{ id, label, value, set }].
  // Pure bis auf die AI/GarmentSVG-Globals (beide optional, graceful).
  function parseIdea(text, lang) {
    const t = " " + String(text || "").toLowerCase() + " ";
    if (t.trim().length < 3) return [];
    const A = window.AI || {};
    const entries = [];
    const push = (id, labelKey, value, set) => entries.push({ id, labelKey, value, set });

    const cat = A.detectType ? A.detectType(t) : null;
    if (cat && CAT_WORDS[cat]) push("category", "engine.dsc_form", CAT_WORDS[cat][lang] || CAT_WORDS[cat].de, { category: cat });

    const col = A.detectColorStrict ? A.detectColorStrict(t) : null;
    if (typeof col === "string" && HEX_RE.test(col)) {
      push("color", "engine.dsc_color", col, { "color.scheme": "mono", "color.stops": [col] });
    }
    const mat = A.detectMaterialStrict ? A.detectMaterialStrict(t) : null;
    if (mat) {
      const w = window.DesignInference ? window.DesignInference.valueWord(mat, lang) : mat;
      push("material", "engine.dsc_material", w, { "fabric.material": mat });
    }
    const fit = A.detectFitStrict ? A.detectFitStrict(t) : null;
    if (typeof fit === "number") push("fit", "engine.dsc_fit", fitWord(fit, lang), { "silhouette.fit": fit });
    else if (has(t, ["kastig", "boxy", "oversized", "weit "])) push("fit", "engine.dsc_fit", fitWord(0.85, lang), { "silhouette.fit": 0.85, "silhouette.structure": 0.7 });

    const pat = A.detectPatternStrict ? A.detectPatternStrict(t) : null;
    const mapped = pat && Object.prototype.hasOwnProperty.call(PATTERN_MAP, pat) ? PATTERN_MAP[pat] : null;
    if (mapped) {
      const w = window.DesignInference ? window.DesignInference.valueWord(mapped, lang) : mapped;
      push("pattern", "engine.dsc_pattern", w, { "pattern.type": mapped });
    }

    if (has(t, ["matt", "matte"])) push("finish", "engine.dsc_finish", lang === "en" ? "matte" : "matt", { "fabric.finishWeight": 0.2 });
    else if (has(t, ["glänzend", "glanz", "glossy", "shiny", "sheen", "satin"])) push("finish", "engine.dsc_finish", lang === "en" ? "sheen" : "glänzend", { "fabric.finishWeight": 0.8 });

    if (has(t, ["kurz", "cropped", "mini"])) push("length", "engine.dsc_length", lang === "en" ? "cropped" : "kurz", { length: "cropped" });
    else if (has(t, ["lang ", "long ", "maxi", "longline"])) push("length", "engine.dsc_length", lang === "en" ? "long" : "lang", { length: "long" });

    if (has(t, ["kapuze", "hood"])) push("collar", "engine.dsc_collar", lang === "en" ? "hood" : "Kapuze", { "construction.collar": "hood" });

    // Verschluss nur, wenn die (erkannte) Kategorie ihn zeichnen kann.
    const G = window.GarmentSVG;
    const closureOk = (v) => !cat || !G || !G.closureAllowed || G.closureAllowed(cat, v);
    if (has(t, ["reissverschluss", "zip", "zipper"]) && closureOk("zip")) {
      push("closure", "engine.dsc_closure", lang === "en" ? "zip" : "Reissverschluss", { "construction.closure": "zip" });
    } else if (has(t, ["knopf", "knöpfe", "button"]) && closureOk("button")) {
      push("closure", "engine.dsc_closure", lang === "en" ? "buttons" : "Knöpfe", { "construction.closure": "button" });
    }

    // Taschen: Cargo/Känguru explizit; generisches „Taschen" wählt die
    // kategorie-typische Form (nur wenn die Kategorie schon gelesen wurde).
    if (has(t, ["cargo"])) push("pockets", "engine.dsc_pockets", "Cargo", { "construction.pockets": "cargo" });
    else if (has(t, ["känguru", "kangaroo"])) push("pockets", "engine.dsc_pockets", lang === "en" ? "kangaroo" : "Känguru", { "construction.pockets": "kangaroo" });
    else if (has(t, ["tasche", "pocket"]) && cat && cat !== "dress") {
      const pk = cat === "hoodie" ? "kangaroo" : (cat === "pants" || cat === "jacket") ? "cargo" : "chest";
      const w = window.DesignInference ? window.DesignInference.valueWord(pk, lang) : pk;
      push("pockets", "engine.dsc_pockets", w, { "construction.pockets": pk });
    }
    return entries;
  }

  // Vorschlags-Chip aus der lokalen Taste-Historie (Preferences): rein
  // clientseitig, erscheint nur, wenn wirklich Historie existiert.
  function lastPieceSeed() {
    const P = window.Preferences;
    if (!P || !P.totalDesigns || P.totalDesigns() < 1) return null;
    const type = (P.topValues("type", 1) || [])[0];
    if (!type || !CAT_WORDS[type]) return null;
    const set = { category: type };
    const col = (P.topValues("color", 1) || [])[0];
    if (typeof col === "string" && HEX_RE.test(col)) { set["color.scheme"] = "mono"; set["color.stops"] = [col]; }
    const mat = (P.topValues("material", 1) || [])[0];
    if (typeof mat === "string" && /^[a-z]+$/.test(mat)) set["fabric.material"] = mat;
    return { type, set };
  }

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const t = ctx.t;

    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const box = V.el("div", { class: "de-describe" });
    const input = V.el("textarea", { class: "de-describe-input", rows: "2", placeholder: t("engine.dsc_ph") });
    input.setAttribute("aria-label", node.question ? node.question[lang] : "");
    box.appendChild(input);

    const foot = V.el("div", { class: "de-describe-foot" });
    const hint = V.el("span", { class: "de-describe-hint mono-label" });
    hint.textContent = t("engine.dsc_hint");
    const read = V.el("button", { type: "button", class: "de-confirm de-describe-read", disabled: "" });
    read.textContent = t("engine.dsc_read");
    foot.appendChild(hint); foot.appendChild(read);
    box.appendChild(foot);
    host.appendChild(box);

    // Verstanden-Playback (leer bis zum ersten Lesen).
    const back = V.el("div", { class: "de-understood", hidden: "" });
    host.appendChild(back);

    const alt = V.el("div", { class: "de-describe-alts" });
    const skip = V.el("button", { type: "button", class: "de-describe-skip" });
    skip.textContent = t("engine.dsc_skip");
    skip.addEventListener("click", () => ctx.commit({ skip: true }));
    alt.appendChild(skip);
    const seed = lastPieceSeed();
    if (seed) {
      const again = V.el("button", { type: "button", class: "de-describe-skip de-describe-last" });
      again.textContent = t("engine.dsc_last", { type: CAT_WORDS[seed.type][lang] || CAT_WORDS[seed.type].de });
      again.addEventListener("click", () => ctx.commit({ set: seed.set }));
      alt.appendChild(again);
    }
    host.appendChild(alt);

    let entries = [];
    const renderBack = () => {
      back.innerHTML = "";
      back.hidden = false;
      const h = V.el("p", { class: "de-understood-h mono-label" });
      h.textContent = entries.length ? t("engine.dsc_understood") : t("engine.dsc_none");
      back.appendChild(h);
      entries.forEach((e) => {
        const row = V.el("span", { class: "de-understood-row" });
        const k = V.el("b", { class: "mono-label" }); k.textContent = t(e.labelKey);
        const v = document.createTextNode(" " + e.value + " ");
        const x = V.el("button", { type: "button", class: "de-understood-x", "aria-label": t("engine.dsc_remove", { what: t(e.labelKey) }) });
        x.textContent = "×";
        x.addEventListener("click", () => { entries = entries.filter((o) => o !== e); renderBack(); });
        row.appendChild(k); row.appendChild(v); row.appendChild(x);
        back.appendChild(row);
      });
      if (entries.length) {
        const apply = V.el("button", { type: "button", class: "de-confirm de-understood-apply" });
        apply.textContent = t("engine.dsc_apply");
        apply.addEventListener("click", () => {
          const set = {};
          entries.forEach((e) => Object.assign(set, e.set));
          ctx.commit({ set });
        });
        back.appendChild(apply);
      }
    };

    input.addEventListener("input", () => { read.disabled = input.value.trim().length < 3; });
    read.addEventListener("click", () => { entries = parseIdea(input.value, lang); renderBack(); });
    // Enter (ohne Shift) = Lesen — die Maschine antwortet sofort.
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); if (!read.disabled) read.click(); }
    });
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.describe = render;
  // Test-/Wiederverwendungs-Seam (Refine-Freitext nutzt denselben Parser).
  window.DEModalities.describeParse = parseIdea;
})();
