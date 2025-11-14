import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { LayoutProvider } from "./context/LayoutContext";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
import { esUY } from "@clerk/localizations";
import "./clarity.ts";
import { PostHogProvider } from 'posthog-js/react'
import posthog from 'posthog-js'
import TagManager from 'react-gtm-module';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Initialize Google Tag Manager
const gtmId = "GTM-5RQNM7X4";
if (gtmId) {
  TagManager.initialize({
    gtmId: gtmId,
  });
}

const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: "2025-05-24",
} as const;

// Safe DOM removal shim: ignore NotFoundError when a node is already gone.
// This prevents commit-time crashes when extensions or other scripts move/remove nodes.
(() => {
  const nativeRemoveChild = Node.prototype.removeChild;
  // @ts-ignore - augmenting DOM prototype
  Node.prototype.removeChild = function (child: Node) {
    // If the child isn't ours anymore, treat as no-op
    if (child && (child as any).parentNode !== this) return child;
    try {
      return nativeRemoveChild.call(this, child);
    } catch (e) {
      if ((e as any)?.name === "NotFoundError") return child;
      throw e;
    }
  };
})();

// Auto-reload when a lazy chunk fails after a deployment switch
window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const msg = String((e.reason && (e.reason.message || e.reason)) || "");
  if (
    msg.includes("Loading chunk") ||
    msg.includes("ChunkLoadError") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed")
  ) {
    e.preventDefault?.();
    window.location.reload();
  }
});

// Log NotFoundError removeChild context for debugging portal teardown issues
window.addEventListener("error", (e) => {
  if (String(e.message || "").includes("removeChild")) {
    // Prevent default error propagation for this specific case
    e.preventDefault?.();
    const details = {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      activeElement: document.activeElement?.tagName,
      openSelects: document.querySelectorAll(
        "[data-state='open'][data-slot='select-content']",
      ).length,
      openDialogs: document.querySelectorAll("[data-slot='dialog-content']")
        .length,
      openPopovers: document.querySelectorAll("[data-slot='popover-content']")
        .length,
      openTooltips: document.querySelectorAll("[data-slot='tooltip-content']")
        .length,
      path: window.location.pathname,
      stack: (e as any).error?.stack,
    } as const;
    console.warn(
      "NotFoundError removeChild detected - portal teardown issue",
      details,
    );
    try {
      posthog.capture("portal_teardown_notfound", details as any);
    } catch {}
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={options}
    >
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
          localization={esUY}
        >
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <AuthProvider>
              <BrowserRouter>
                <LayoutProvider>
                  <App />
                  <Toaster position="top-right" />
                </LayoutProvider>
              </BrowserRouter>
            </AuthProvider>
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </ErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
);
