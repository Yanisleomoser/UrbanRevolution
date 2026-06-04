/**
 * Urban Revolution — Ambient cost ticker (per section, facts-page style)
 *
 * The live clock ("[ HH:MM:SS · N Lkw Kleidung entsorgt, seit du hier bist ]")
 * sits next to EVERY section number, right-aligned, in the same mono style as
 * the facts section — a quiet, omnipresent reminder. Self-mounts on any page
 * that loads this script; bilingual via <html lang>. Side-effect module.
 */
(function () {
    if (window.__urAmbientTicker) return;
    window.__urAmbientTicker = true;

    var t0 = Date.now();
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };

    // Put a live ticker beside each section number, mirroring .facts-top.
    function buildSlots() {
        var labels = document.querySelectorAll(".section-label");
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i];
            // The landing eyebrow is centred, not a numbered section → skip.
            if (label.classList.contains("manifesto-eyebrow")) continue;
            var parent = label.parentNode;
            if (!parent) continue;
            // Facts already has its row (.facts-top + .facts-live) → reuse it.
            if (parent.classList.contains("facts-top")) {
                var fl = parent.querySelector(".facts-live");
                if (fl) fl.classList.add("section-live");
                continue;
            }
            // Already wrapped on a previous run.
            if (parent.classList.contains("section-meta")) continue;
            // Wrap the label + a new ticker in a flex meta row.
            var meta = document.createElement("div");
            meta.className = "section-meta";
            parent.insertBefore(meta, label);
            meta.appendChild(label);
            var live = document.createElement("span");
            live.className = "section-live mono-label";
            live.setAttribute("aria-hidden", "true");
            meta.appendChild(live);
        }
    }

    function tick() {
        var d = new Date();
        var s = Math.floor((Date.now() - t0) / 1000);
        var en = document.documentElement.lang === "en";
        var tail = en
            ? " trucks of clothing dumped since you arrived ]"
            : " Lkw Kleidung entsorgt, seit du hier bist ]";
        var txt = "[ " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " · " + s + tail;
        var slots = document.querySelectorAll(".section-live");
        for (var i = 0; i < slots.length; i++) slots[i].textContent = txt;
    }

    function start() { buildSlots(); tick(); setInterval(tick, 1000); }

    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
})();
