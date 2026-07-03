/**
 * Urban Revolution — #facts Variante A „Das Protokoll" (Controller)
 *
 * Editoriales Beweis-Register: volle Breite, Zeile für Zeile. Wird im
 * Varianten-Labor gebaut; greift nur, wenn Slot #facts-a sichtbar ist.
 * Classic IIFE side-effect module (kein Global).
 */
(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__urFactsA) return;
    window.__urFactsA = true;

    function init() {
        var host = document.getElementById("facts-a");
        if (!host || host.hidden) return;
        // Variante A: statischer Platzhalter — Inszenierung folgt.
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
