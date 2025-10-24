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
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Auto-reload when a lazy chunk fails after a deployment switch
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const msg = String((e.reason && (e.reason.message || e.reason)) || '');
  if (
    msg.includes('Loading chunk') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed')
  ) {
    e.preventDefault?.();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
                <Toaster />
              </LayoutProvider>
            </BrowserRouter>
          </AuthProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </ErrorBoundary>
  </StrictMode>,
);
