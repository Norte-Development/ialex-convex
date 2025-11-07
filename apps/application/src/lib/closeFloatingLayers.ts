/**
 * Closes any open floating layers (Select, Popover, Tooltip, etc.)
 * by dispatching Escape and relevant pointer events. This prevents NotFoundError
 * when portals are torn down in the wrong order.
 */
let isClosing = false;

export function closeFloatingLayers() {
  if (isClosing) return;
  isClosing = true;
  try {
    // Blur active element to break focus traps
    try {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && typeof ae.blur === "function") ae.blur();
    } catch {}

    // Close layers that respond to Escape (Select, Popover, Dialog sublayers)
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(esc);
    document.dispatchEvent(esc);

    // Proactively close tooltips (Radix tooltip often opens on hover)
    try {
      document
        .querySelectorAll<HTMLElement>('[data-slot="tooltip-trigger"]')
        .forEach((el) => {
          el.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
          el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
        });
    } catch {}

    // Click-away to close any click-outside layers
    try {
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true })
      );
      document.body.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true })
      );
    } catch {}

    // Second pass on next frame for stacked layers
    requestAnimationFrame(() => {
      try {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
      } catch {}
      isClosing = false;
    });
  } catch {
    isClosing = false;
  }
}

