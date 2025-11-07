let portalEl: HTMLElement | null = null;

/**
 * Stable container for all Radix portals (Dialog/Select/Popover/Tooltip).
 * Uses a dedicated container to reduce interference from extensions.
 * The safe removeChild shim in main.tsx handles NotFoundError cases.
 */
export function getPortalContainer(): HTMLElement | undefined {
  // Guard for unexpected environments
  if (typeof document === "undefined") return undefined;
  try {
    if (portalEl && document.body.contains(portalEl)) return portalEl;
    portalEl = document.getElementById("portal-root") as HTMLElement | null;
    if (!portalEl) {
      portalEl = document.createElement("div");
      portalEl.id = "portal-root";
      portalEl.setAttribute("role", "presentation");
      // Add data attribute to help identify portal container
      portalEl.setAttribute("data-portal-container", "true");
      document.body.appendChild(portalEl);
    }
    return portalEl ?? undefined;
  } catch {
    return undefined;
  }
}


