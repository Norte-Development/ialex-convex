let portalEl: HTMLElement | null = null;

export function getPortalContainer(): HTMLElement | undefined {
  // Guard for unexpected environments
  if (typeof document === "undefined") return undefined;
  try {
    if (portalEl && document.body.contains(portalEl)) return portalEl;
    portalEl = document.getElementById("portal-root") as HTMLElement | null;
    if (!portalEl) {
      portalEl = document.createElement("div");
      portalEl.id = "portal-root";
      document.body.appendChild(portalEl);
    }
    return portalEl ?? undefined;
  } catch {
    return undefined;
  }
}


