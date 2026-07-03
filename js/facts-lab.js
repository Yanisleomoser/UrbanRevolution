/**
 * Urban Revolution — #facts Varianten-Labor (Review-Werkzeug, nur dieser Branch)
 *
 * Drei vollständige Neu-Inszenierungen des Beweisbands liegen als Slots im
 * Markup (#facts-a/-b/-c); genau EINE ist sichtbar. Auswahl per Query-Param
 * ?facts=a|b|c (Standard: a). Dieses Skript läuft als defer-Skript VOR
 * gsap/landing.js und schaltet SYNCHRON beim Auswerten um, damit nachfolgende
 * Skripte (Reveals, Counter, ScrollTrigger) die sichtbare Variante korrekt
 * vermessen.
 *
 * Progressive Enhancement: ohne JS bleibt Variante A sichtbar (statischer
 * Markup-Default; B/C tragen hidden). Die schwebende Varianten-Pille ist eine
 * reine Review-Affordanz. Nach der Auswahl: Gewinner behalten, dieses Skript,
 * die Pille und die Verlierer-Slots entfernen.
 *
 * Classic IIFE side-effect module (kein Global), wie ambient-ticker.js.
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFactsLab) return;
    window.__urFactsLab = true;

    var VARIANTS = ["a", "b", "c"];

    var active = "a";
    try {
        var q = String(new URLSearchParams(window.location.search).get("facts") || "a").toLowerCase();
        if (VARIANTS.indexOf(q) >= 0) active = q;
    } catch (_e) { active = "a"; }

    // Synchron (nicht erst auf DOMContentLoaded warten): nachfolgende
    // defer-Skripte sollen den Endzustand sehen.
    VARIANTS.forEach(function (v) {
        var el = document.querySelector('[data-facts-variant="' + v + '"]');
        if (el) el.hidden = (v !== active);
    });
    document.documentElement.setAttribute("data-facts-active", active);

    var t = function (key, fallback) {
        var s = (window.I18N && typeof I18N.t === "function") ? I18N.t(key) : null;
        return (s && s !== key) ? s : fallback;
    };

    function buildPill() {
        if (document.querySelector(".facts-lab-pill")) return;
        var nav = document.createElement("nav");
        nav.className = "facts-lab-pill";
        var label = document.createElement("span");
        label.className = "facts-lab-pill-label";
        label.setAttribute("data-i18n", "factsLab.label");
        label.textContent = t("factsLab.label", "Variante");
        nav.appendChild(label);
        VARIANTS.forEach(function (v) {
            var a = document.createElement("a");
            a.className = "facts-lab-chip" + (v === active ? " is-active" : "");
            a.href = "?facts=" + v + "#facts";
            a.textContent = v.toUpperCase();
            a.setAttribute("data-i18n-aria-label", "factsLab." + v);
            a.setAttribute("aria-label", t("factsLab." + v, "Variante " + v.toUpperCase()));
            if (v === active) a.setAttribute("aria-current", "true");
            nav.appendChild(a);
        });
        var apply = function () {
            nav.setAttribute("aria-label", t("factsLab.nav", "Facts-Variante wählen"));
        };
        apply();
        window.addEventListener("language:change", apply);
        document.body.appendChild(nav);
        // data-i18n-Knoten wurden nach I18N.apply() injiziert → einmal nachziehen.
        if (window.I18N && typeof I18N.apply === "function") I18N.apply();
    }

    if (document.body) buildPill();
    else document.addEventListener("DOMContentLoaded", buildPill);
})();
