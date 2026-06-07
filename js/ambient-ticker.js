/**
 * Urban Revolution — Live waste counter (ticker)
 *
 * Content: the real, cited mass of textile waste, ticking up live.
 *   92 Mio. t/year (UNEP / Ellen MacArthur Foundation — already cited in the
 *   facts section) ÷ seconds in a year ≈ 2'918 kg per second. The number steps
 *   +2'918 kg every second since the visitor arrived — no metaphor, the actual
 *   quantity. Tied to the "1 truckload of textiles every second" fact.
 *
 * Placement (combo C + A):
 *   C — one dramatic odometer in the facts section (static markup in
 *       index.html: .cost-ticker; this module only updates its number).
 *   A — a compact "LIVE … kg verbrannt oder vergraben" badge beside every
 *       OTHER section number (injected here).
 *
 * Bilingual via i18n (data-i18n on injected nodes; re-translated on
 * language:change). Self-mounts; side-effect module.
 */
(function () {
    if (window.__urAmbientTicker) return;
    window.__urAmbientTicker = true;

    const RATE = 2918; // kg of textiles wasted per second (92e9 kg ÷ 31.536e6 s)
    const t0 = Date.now();

    // Swiss thousands grouping (1234567 → "1'234'567"), locale-independent.
    const swiss = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");

    const t = (key, fallback) =>
        (window.I18N && typeof I18N.t === "function" ? I18N.t(key) : null) || fallback;

    // Build the compact "A" badge (used beside non-facts section numbers).
    function makeBadge() {
        const wrap = document.createElement("span");
        wrap.className = "section-live ticker-badge";
        wrap.setAttribute("aria-hidden", "true");
        wrap.innerHTML =
            '<span class="ticker-pulse"></span>' +
            '<span class="ticker-live-label" data-i18n="ticker.live">' + t("ticker.live", "Live") + "</span>" +
            '<span class="ticker-kg"><span class="tnum" data-ticker-kg>0</span> ' +
            '<span data-i18n="ticker.unit">' + t("ticker.unit", "kg") + "</span></span>" +
            '<span class="ticker-cap" data-i18n="ticker.cap_short">' + t("ticker.cap_short", "") + "</span>";
        return wrap;
    }

    function buildSlots() {
        document.querySelectorAll(".section-label").forEach((label) => {
            const parent = label.parentNode;
            if (!parent) return;
            // Facts section owns the big "C" odometer (static markup) → no badge.
            if (parent.classList.contains("facts-top")) return;
            // Landing eyebrow is centred → badge centred right under it.
            if (label.classList.contains("manifesto-eyebrow")) {
                const next = label.nextElementSibling;
                if (next && next.classList.contains("section-live")) return;
                const b = makeBadge();
                b.classList.add("manifesto-live");
                parent.insertBefore(b, label.nextSibling);
                return;
            }
            if (parent.classList.contains("section-meta")) return; // already wrapped
            // Wrap label + badge in a flex meta row (number left, ticker right).
            const meta = document.createElement("div");
            meta.className = "section-meta";
            parent.insertBefore(meta, label);
            meta.appendChild(label);
            meta.appendChild(makeBadge());
        });
        // Translate the freshly injected data-i18n nodes (apply() already ran
        // before this module loaded; language:change re-applies automatically).
        if (window.I18N && typeof I18N.apply === "function") I18N.apply();
    }

    function tick() {
        const kg = swiss(Math.floor((Date.now() - t0) / 1000) * RATE);
        document.querySelectorAll("[data-ticker-kg]").forEach((e) => { e.textContent = kg; });
    }

    function start() { buildSlots(); tick(); setInterval(tick, 1000); }

    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
})();
