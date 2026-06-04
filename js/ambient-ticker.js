/**
 * Urban Revolution — Ambient cost ticker (persistent, every page)
 *
 * A small, always-visible live clock in the corner: the seconds you've spent
 * here translated into "trucks of clothing dumped". It simply exists, like a
 * clock — not a pitch. Self-mounts a fixed element on any page that loads this
 * script (index, impressum, datenschutz). Bilingual via <html lang>.
 *
 * Side-effect module — no global. Safe to load once per page.
 */
(function () {
    if (window.__urAmbientTicker) return;
    window.__urAmbientTicker = true;

    function mount() {
        if (document.getElementById("ambient-ticker-fixed")) return;
        var el = document.createElement("div");
        el.id = "ambient-ticker-fixed";
        el.className = "ambient-ticker-fixed mono-label";
        el.setAttribute("aria-hidden", "true");
        document.body.appendChild(el);

        var t0 = Date.now();
        var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
        function tick() {
            var d = new Date();
            var s = Math.floor((Date.now() - t0) / 1000);
            var en = document.documentElement.lang === "en";
            var tail = en
                ? " trucks of clothing dumped since you arrived ]"
                : " Lkw Kleidung entsorgt, seit du hier bist ]";
            el.textContent = "[ " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " · " + s + tail;
        }
        tick();
        setInterval(tick, 1000);
    }

    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
})();
