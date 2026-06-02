/**
 * Urban Revolution — Saved Designs Library
 *
 * Persists generated designs (plus optional VTO image URL) in
 * localStorage so the user can revisit past creations across
 * sessions. Pure data layer — UI in app.js.
 *
 * Storage shape (key `urev_library_v1`):
 *   {
 *     designs: [
 *       {
 *         id, name, type, color, material, fit, tags, pattern,
 *         originalPrompt, constructionNotes, vtoImageUrl,
 *         previewImageUrl, savedAt
 *       },
 *       ...
 *     ]
 *   }
 *
 * Capped at MAX entries — oldest dropped FIFO so localStorage doesn't
 * fill. A motivated user with > 20 designs is unlikely; saving the
 * VTO image URL (not the base64) keeps each entry < 2 KB so a full
 * library is ~ 40 KB.
 *
 * Safety: every read/write is try-wrapped. Failures degrade to "no
 * library" — feature stays inert rather than breaking the app.
 */
const Library = (() => {
  const STORAGE_KEY = "urev_library_v1";
  const MAX_ENTRIES = 20;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { designs: [] };
      const parsed = JSON.parse(raw);
      return { designs: Array.isArray(parsed.designs) ? parsed.designs : [] };
    } catch {
      return { designs: [] };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function add(design, extras) {
    if (!design || !design.designId) return null;
    const ex = extras || {};
    const state = loadState();
    const entry = {
      id: design.designId,
      name: design.name || "Untitled",
      type: design.type || ex.type || "tshirt",
      color: design.color || ex.color || "#1a1a1a",
      material: design.material || ex.material || "cotton",
      fit: design.fit !== undefined ? design.fit : (ex.fit !== undefined ? ex.fit : 0.5),
      tags: Array.isArray(design.tags) ? design.tags.slice(0, 8) : [],
      pattern: design.pattern || "solid",
      originalPrompt: design.originalPrompt || "",
      constructionNotes: Array.isArray(design.constructionNotes)
        ? design.constructionNotes.slice(0, 6)
        : [],
      vtoImageUrl: ex.vtoImageUrl || null,
      previewImageUrl: ex.previewImageUrl || design.previewImageUrl || null,
      savedAt: new Date().toISOString(),
    };

    const existingIdx = state.designs.findIndex((d) => d.id === entry.id);
    if (existingIdx >= 0) {
      // Update in place but bring to top
      state.designs.splice(existingIdx, 1);
      state.designs.unshift(entry);
    } else {
      state.designs.unshift(entry);
      if (state.designs.length > MAX_ENTRIES) {
        state.designs = state.designs.slice(0, MAX_ENTRIES);
      }
    }

    saveState(state);
    return entry;
  }

  function list() {
    return loadState().designs;
  }

  function count() {
    return loadState().designs.length;
  }

  function get(id) {
    return loadState().designs.find((d) => d.id === id) || null;
  }

  function remove(id) {
    const state = loadState();
    state.designs = state.designs.filter((d) => d.id !== id);
    saveState(state);
  }

  function setVtoImage(id, url) {
    const state = loadState();
    const entry = state.designs.find((d) => d.id === id);
    if (entry) {
      entry.vtoImageUrl = url || null;
      saveState(state);
    }
  }

  function setPreviewImage(id, url) {
    const state = loadState();
    const entry = state.designs.find((d) => d.id === id);
    if (entry) {
      entry.previewImageUrl = url || null;
      saveState(state);
    }
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return { add, list, count, get, remove, setVtoImage, setPreviewImage, clear, MAX_ENTRIES };
})();

window.Library = Library;
