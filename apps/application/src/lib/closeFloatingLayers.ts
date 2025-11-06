/**
 * Closes any open floating layers (Select dropdowns, Popovers, etc.)
 * by dispatching Escape key events. This prevents NotFoundError when
 * portals are torn down in the wrong order, especially in Safari/Firefox
 * or when dialogs close immediately after mutations.
 */
export function closeFloatingLayers() {
  try {
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(esc);
    // Dispatch twice to close stacked layers (e.g. Select inside Dialog)
    document.dispatchEvent(esc);
  } catch {
    // Silently fail if dispatch fails
  }
}

