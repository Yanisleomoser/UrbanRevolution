/**
 * Urban Revolution — User Preferences Tracker
 *
 * Persists per-browser usage counts (garment type, color, material) and
 * recent prompts in localStorage so the design-section can offer
 * suggestions tailored to the user's history. Pure data layer — UI
 * lives in app.js.
 *
 * Storage shape (under key `urev_prefs_v1`):
 *   {
 *     type:     { tshirt: 3, hoodie: 1, ... },
 *     color:    { "#1a1a1a": 4, "#831843": 1, ... },
 *     material: { cotton: 2, wool: 1, ... },
 *     prompts:  ["last prompt", "older prompt", ...]  // capped to 5
 *   }
 *
 * Safety: every read/write is try-wrapped. Safari private mode,
 * disabled cookies, or quota-exceeded all degrade to "no history"
 * which yields the default suggestions — the app stays usable.
 */
const Preferences = (() => {
  const STORAGE_KEY = "urev_prefs_v1";
  const TRACKED_CATEGORIES = ["type", "color", "material"];
  const MAX_PROMPT_HISTORY = 5;
  const MAX_PROMPT_LENGTH = 200;

  function emptyPrefs() {
    return { type: {}, color: {}, material: {}, prompts: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyPrefs();
      const parsed = JSON.parse(raw);
      return {
        type: parsed.type || {},
        color: parsed.color || {},
        material: parsed.material || {},
        prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
      };
    } catch {
      return emptyPrefs();
    }
  }

  function save(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage unavailable — silently skip; suggestions just fall
      // back to defaults next call.
    }
  }

  function track(category, value) {
    if (!value || !TRACKED_CATEGORIES.includes(category)) return;
    const prefs = load();
    prefs[category][value] = (prefs[category][value] || 0) + 1;
    save(prefs);
  }

  function trackPrompt(prompt) {
    if (!prompt || typeof prompt !== "string") return;
    const prefs = load();
    const trimmed = prompt.slice(0, MAX_PROMPT_LENGTH);
    prefs.prompts = [trimmed, ...prefs.prompts.filter((p) => p !== trimmed)]
      .slice(0, MAX_PROMPT_HISTORY);
    save(prefs);
  }

  function topValues(category, n = 2) {
    const map = load()[category] || {};
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key]) => key);
  }

  function totalDesigns() {
    const types = load().type || {};
    return Object.values(types).reduce((sum, n) => sum + n, 0);
  }

  function getAll() {
    return load();
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return { track, trackPrompt, topValues, totalDesigns, getAll, clear };
})();

if (typeof window !== "undefined") window.Preferences = Preferences;
if (typeof module !== "undefined" && module.exports) module.exports = Preferences;
