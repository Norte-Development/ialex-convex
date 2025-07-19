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
import { CopilotKit } from "@copilotkit/react-core";


import "@copilotkit/react-ui/styles.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <AuthProvider>
            <BrowserRouter>
              <CopilotKit
              runtimeUrl="http://localhost:4000/copilotkit"
              agent="memory_agent"
              >
              <LayoutProvider>
                <App />
              </LayoutProvider>
              </CopilotKit>
            </BrowserRouter>
          </AuthProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </ErrorBoundary>
  </StrictMode>,
);
