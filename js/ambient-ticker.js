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

    const t0 = Date.now();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);

    // Put a live ticker beside each section number, mirroring .facts-top.
    function buildSlots() {
        document.querySelectorAll(".section-label").forEach((label) => {
            // The landing eyebrow is centred, not a numbered section → skip.
            if (label.classList.contains("manifesto-eyebrow")) return;
            const parent = label.parentNode;
            if (!parent) return;
            // Facts already has its row (.facts-top + .facts-live) → reuse it.
            if (parent.classList.contains("facts-top")) {
                const fl = parent.querySelector(".facts-live");
                if (fl) fl.classList.add("section-live");
                return;
            }
            if (parent.classList.contains("section-meta")) return; // already wrapped
            // Wrap the label + a new ticker in a flex meta row.
            const meta = document.createElement("div");
            meta.className = "section-meta";
            parent.insertBefore(meta, label);
            meta.appendChild(label);
            const live = document.createElement("span");
            live.className = "section-live mono-label";
            live.setAttribute("aria-hidden", "true");
            meta.appendChild(live);
        });
    }

    function tick() {
        const d = new Date();
        const s = Math.floor((Date.now() - t0) / 1000);
        const en = document.documentElement.lang === "en";
        const tail = en
            ? " trucks of clothing dumped since you arrived ]"
            : " Lkw Kleidung entsorgt, seit du hier bist ]";
        const txt = "[ " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " · " + s + tail;
        document.querySelectorAll(".section-live").forEach((e) => { e.textContent = txt; });
    }

    function start() { buildSlots(); tick(); setInterval(tick, 1000); }

    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
})();
