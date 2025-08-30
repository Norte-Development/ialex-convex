import React from "react";
import { Routes, Route } from "react-router-dom";
import { Protect } from "@clerk/clerk-react";
import { AuthLoading } from "convex/react";
import { lazy, Suspense, useMemo } from "react";
import Layout from "./components/Layout/Layout";
import { AppSkeleton } from "./components/Skeletons";
import { OnboardingWrapper } from "./components/Auth/OnboardingWrapper";
import { SignInPage } from "./components/Auth/SignInPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadProvider } from "./context/ThreadContext";
import { CaseProvider } from "./context/CaseContext";
import { HighlightProvider } from "./context/HighlightContext";
import { EscritoProvider } from "./context/EscritoContext";

// Lazy load pages to reduce initial bundle size
const HomePage = lazy(() => import("./pages/HomePage"));
const CasesPage = lazy(() => import("./pages/CasesPage"));
const CaseDetailPage = lazy(() => import("./pages/CaseOpen/CaseDetailPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const EscritosPage = lazy(() => import("./pages/CaseOpen/EscritosPage"));
const ModelsPage = lazy(() => import("./pages/ModelsPage"));
const DataBasePage = lazy(() => import("./pages/DataBasePage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const TeamManagePage = lazy(() => import("./pages/TeamManagePage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const SignupInvitePage = lazy(() => import("./pages/SignupInvitePage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const CaseClientsPage = lazy(() => import("./pages/CaseOpen/CaseClientPage"));
const CaseTeamsPage = lazy(() => import("./pages/CaseOpen/CaseTeamsPage"));
const CaseModelPage = lazy(() => import("./pages/CaseOpen/CaseModelPage"));
const CaseDataBasePage = lazy(() => import("./pages/CaseOpen/CaseDataBase"));
const CaseDocumentPage = lazy(() => import("./pages/CaseOpen/CaseDocumentPage"));

// Removed unused CopilotKit CSS import to reduce bundle size
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <Protect fallback={<SignInPage />}>
      <OnboardingWrapper>
        <Layout>{children}</Layout>
      </OnboardingWrapper>
    </Protect>
  );
};

// Memoize QueryClient to prevent recreation on every render
const useQueryClient = () => {
  return useMemo(() => new QueryClient(), []);
};

// Component that uses the thread context
const AppWithThread = () => {
  const queryClient = useQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThreadProvider>
        <div>
          {/* Show authentication loading skeleton while Convex auth is initializing */}
          <AuthLoading>
            <AppSkeleton />
          </AuthLoading>

          {/* Main routing with Clerk's Protect component */}
          <Suspense fallback={<AppSkeleton />}>
            <Routes>
              {/* Public authentication routes */}
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/signup" element={<SignUpPage />} />

              {/* Public invitation routes */}
              <Route path="/invites/accept" element={<AcceptInvitePage />} />
              <Route path="/invites/signup" element={<SignupInvitePage />} />

              {/* Protected routes using Clerk's Protect component */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/casos"
                element={
                  <ProtectedRoute>
                    <CasesPage />
                  </ProtectedRoute>
                }
              />
              {/* Rutas de casos envueltas con CaseProvider */}
              <Route
                path="/caso/:id/*"
                element={
                  <ProtectedRoute>
                    <CaseProvider>
                      <EscritoProvider>
                        <HighlightProvider>
                          <Routes>
                            <Route index element={<CaseDetailPage />} />
                            <Route
                              path="escritos"
                              element={<EscritosPage />}
                            />
                            <Route
                              path="escritos/:escritoId"
                              element={<EscritosPage />}
                            />
                            <Route path="clientes" element={<CaseClientsPage />} />
                            <Route path="equipos" element={<CaseTeamsPage />} />
                            <Route path="modelos" element={<CaseModelPage />} />
                            <Route path="base-de-datos" element={<CaseDataBasePage />} />
                            <Route path="documentos/:documentId" element={<CaseDocumentPage />} />
                          </Routes>
                        </HighlightProvider>
                      </EscritoProvider>
                    </CaseProvider>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clientes"
                element={
                  <ProtectedRoute>
                    <ClientsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/modelos"
                element={
                  <ProtectedRoute>
                    <ModelsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/base-de-datos"
                element={
                  <ProtectedRoute>
                    <DataBasePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/equipo"
                element={
                  <ProtectedRoute>
                    <TeamPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/equipos/:id"
                element={
                  <ProtectedRoute>
                    <TeamManagePage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </div>
      </ThreadProvider>
    </QueryClientProvider>
  );
};

function App() {
  return <AppWithThread />;
}

export default App;
