/**
 * Urban Revolution — FocusTrap (window.FocusTrap)
 *
 * Keyboard focus containment for modal dialogs. The dialogs already set
 * aria-modal, move focus in on open and return it on close, and close on
 * Escape — but a non-native dialog does NOT stop a keyboard user from Tabbing
 * out into the (inert-to-AT but still focusable) page behind it. This wraps Tab
 * so focus cycles within the container, the one piece the axe gate can't check.
 *
 * Usage:  const release = FocusTrap.activate(dialogEl);  // on open
 *         release();                                      // on close
 * Single responsibility: it only traps Tab. Focus move-in / return stays with
 * the caller (each dialog already does that its own way).
 */
const FocusTrap = (() => {
  const SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  // Visible, focusable descendants in DOM order (skips display:none / hidden).
  function focusables(container) {
    return Array.from(container.querySelectorAll(SELECTOR)).filter(
      (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
    );
  }

  function activate(container) {
    if (!container) return () => {};
    const onKeydown = (e) => {
      if (e.key !== "Tab") return;
      const items = focusables(container);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Wrap at the edges; also pull focus back in if it somehow escaped.
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKeydown);
    return function release() {
      container.removeEventListener("keydown", onKeydown);
    };
  }

  return { activate, focusables };
})();

if (typeof window !== "undefined") window.FocusTrap = FocusTrap;
if (typeof module !== "undefined" && module.exports) module.exports = FocusTrap;
