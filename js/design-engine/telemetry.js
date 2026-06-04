/**
 * Urban Revolution — Design Engine · Telemetry (Umsetzungs-Brief §6, Stufe A)
 *
 * Was klicken Nutzer, wo brechen sie ab? Reine Aggregat-Signale, KEINE PII,
 * keine Foto-/Maßdaten. Respektiert Do-Not-Track. Sendet an Vercel Web
 * Analytics (`window.va` Custom-Event, schon eingebunden) UND best-effort per
 * Beacon an /api/track (Stufe B; ohne Backend einfach geschluckt).
 *
 *   DesignTelemetry.track(event, props)
 *
 * Die Fragelogik lernt NICHT von selbst über Nutzer hinweg — jede Session
 * startet bei null. Diese Daten sind die Basis, um Nodes manuell (oder später
 * als optionaler Prior) zu pflegen.
 */
const DesignTelemetry = (() => {
  function enabled() {
    const dnt = (typeof navigator !== "undefined" && (navigator.doNotTrack || navigator.msDoNotTrack)) ||
      (typeof window !== "undefined" && window.doNotTrack);
    return !(dnt === "1" || dnt === "yes");
  }

  function track(event, props) {
    if (!event || !enabled()) return;
    const data = props || {};
    // 1) Vercel Web Analytics Custom-Event
    try {
      if (typeof window !== "undefined" && typeof window.va === "function") {
        window.va("event", { name: "de_" + event, data });
      }
    } catch (_e) { /* analytics optional */ }
    // 2) Best-effort Aggregat-Beacon an /api/track (Stufe B)
    try {
      const body = JSON.stringify(Object.assign({ event }, data));
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else if (typeof fetch === "function") {
        fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch (_e) { /* never block the UI */ }
  }

  return { track, enabled };
})();

if (typeof window !== "undefined") window.DesignTelemetry = DesignTelemetry;
if (typeof module !== "undefined" && module.exports) module.exports = DesignTelemetry;
