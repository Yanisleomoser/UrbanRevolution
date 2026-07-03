/**
 * Urban Revolution — #facts Variante C „Die Linie" (Controller)
 *
 * Durchgehende Linien-Erzählung: eine Linie, drei Stationen. Wird im
 * Varianten-Labor gebaut; greift nur, wenn Slot #facts-c sichtbar ist.
 * Classic IIFE side-effect module (kein Global).
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFactsC) return;
    window.__urFactsC = true;

    function init() {
        var host = document.getElementById("facts-c");
        if (!host || host.hidden) return;
        // Variante C: statischer Platzhalter — Inszenierung folgt.
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
