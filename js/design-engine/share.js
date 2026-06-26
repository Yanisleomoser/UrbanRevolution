/**
 * Urban Revolution — Design Engine · Shareable DNA links (brief §9, optional)
 *
 * Encodes a DesignDNA into a URL-safe base64 fragment so a design can be shared
 * by link and re-opened. On load the flow reads it, restores the DNA and drops
 * the recipient straight into Phase F (refine + generate).
 *
 *   DesignShare.encode(dna) / decode(str)
 *   DesignShare.buildUrl(dna)   → absolute URL with #dna=…
 *   DesignShare.read()          → dna | null   (from location.hash)
 *   DesignShare.clear()         → strip the #dna fragment
 */
const DesignShare = (() => {
  const PARAM = "dna";

  // The #dna= fragment is attacker-reachable and JSON-parsed without schema
  // validation. Colour stops are the one decoded field that downstream code
  // (garment-svg.js) writes UNESCAPED into SVG markup, so neutralise them here
  // at the trust boundary: drop any value that isn't a strict hex literal.
  // Everything else in the DNA is numeric/enum, only ever used as a number or
  // an object-lookup key — never interpolated into markup.
  const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  function sanitize(dna) {
    if (!dna || typeof dna !== "object") return dna;
    const stops = dna.color && dna.color.stops;
    if (Array.isArray(stops)) {
      dna.color.stops = stops
        .filter((s) => typeof s === "string" && HEX_RE.test(s.trim()))
        .map((s) => s.trim());
    }
    return dna;
  }

  function encode(dna) {
    const json = JSON.stringify(dna);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decode(str) {
    try {
      let b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return sanitize(JSON.parse(decodeURIComponent(escape(atob(b64)))));
    } catch (_e) {
      return null;
    }
  }

  function buildUrl(dna) {
    const base = (typeof location !== "undefined") ? location.origin + location.pathname : "";
    return base + "#" + PARAM + "=" + encode(dna);
  }

  function read() {
    if (typeof location === "undefined") return null;
    const hash = location.hash || "";
    const m = hash.match(new RegExp("[#&]" + PARAM + "=([^&]+)"));
    return m ? decode(m[1]) : null;
  }

  function clear() {
    if (typeof history === "undefined" || typeof location === "undefined") return;
    try {
      history.replaceState(null, "", location.origin + location.pathname + location.search);
    } catch (_e) { /* no-op */ }
  }

  return { encode, decode, buildUrl, read, clear, PARAM };
})();

if (typeof window !== "undefined") window.DesignShare = DesignShare;
if (typeof module !== "undefined" && module.exports) module.exports = DesignShare;
