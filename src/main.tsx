import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// import { ClerkProvider, useAuth } from "@clerk/clerk-react";
// import { ConvexProviderWithClerk } from "convex/react-clerk";
// import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App.tsx";
// import { ErrorBoundary } from "./ErrorBoundary.tsx";

// const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* <ErrorBoundary>
      <ClerkProvider
        publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      > */}
    {/* <ConvexProviderWithClerk client={convex} useAuth={useAuth}> */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
    {/* </ConvexProviderWithClerk>
      </ClerkProvider>
    </ErrorBoundary> */}
  </StrictMode>,
);
