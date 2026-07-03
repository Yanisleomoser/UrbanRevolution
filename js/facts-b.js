/**
 * Urban Revolution — #facts Variante B „Die Masse" (Controller)
 *
 * Cineastische Partikel-Beats: die Masse hinter den Zahlen. Wird im
 * Varianten-Labor gebaut; greift nur, wenn Slot #facts-b sichtbar ist.
 * Classic IIFE side-effect module (kein Global).
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFactsB) return;
    window.__urFactsB = true;

    function init() {
        var host = document.getElementById("facts-b");
        if (!host || host.hidden) return;
        // Variante B: statischer Platzhalter — Inszenierung folgt.
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
