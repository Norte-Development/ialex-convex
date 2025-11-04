import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Protect } from "@clerk/clerk-react";
import { AuthLoading } from "convex/react";
import { lazy, useMemo } from "react";
import { useAuth } from "./context/AuthContext";
import { clarity } from "./clarity";
import Layout from "./components/Layout/Layout";
import { OnboardingWrapper } from "./components/Auth/OnboardingWrapper";
import { SignInPage } from "./components/Auth/SignInPage";
import { RouteSuspense } from "./components/RouteSuspense";
import { AuthLoadingSkeleton } from "./components/AuthLoadingSkeleton";
import { LazyLoadErrorBoundary } from "./components/LazyLoadErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadProvider } from "./context/ThreadContext";
import { CaseProvider, useCase } from "./context/CaseContext";
import { HighlightProvider } from "./context/HighlightContext";
import { EscritoProvider } from "./context/EscritoContext";
import { PageProvider } from "./context/PageContext";
import { CasePermissionsProvider } from "./context/CasePermissionsContext";
import { ChatbotProvider } from "./context/ChatbotContext";
import { LayoutProvider } from "./context/LayoutContext";
import { TutorialProvider } from "./context/TutorialContext";
import { TutorialOverlay } from "./components/Tutorial/TutorialOverlay";
import { MigrationWrapper } from "./components/Migration";

// Eager load core navigation pages (not heavy, safe to bundle)
import HomePage from "./pages/home/HomePage";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseOpen/CaseDetailPage";
import ClientsPage from "./pages/ClientsPage";
import EscritosPage from "./pages/CaseOpen/EscritosPage";
import ModelsPage from "./pages/ModelsPage";
import DataBasePage from "./pages/DataBasePage";
import TeamPage from "./pages/TeamPage";
import TeamManagePage from "./pages/TeamManagePage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import SignupInvitePage from "./pages/SignupInvitePage";
import SignUpPage from "./pages/SignUpPage";
import CaseClientsPage from "./pages/CaseOpen/CaseClientPage";
import CaseTeamsPage from "./pages/CaseOpen/CaseTeamsPage";
import CaseModelPage from "./pages/CaseOpen/CaseModelPage";
import CaseDataBasePage from "./pages/CaseOpen/CaseDataBase";
import CaseSettingsRulesPage from "./pages/CaseOpen/CaseSettingsRulesPage";
import ComponentsShowcasePage from "./pages/ComponentsShowcasePage";
import LibraryPage from "./pages/LibraryPage";
import UserPreferencesPage from "./pages/UserPreferencesPage";
import BillingSuccessPage from "./pages/BillingSuccessPage";
import EventosPage from "./pages/EventosPage";
import EventDetailPage from "./pages/EventDetailPage";
import CaseDocumentsPage from "./pages/CaseOpen/CaseDocumentsList";
import HomeAgentPage from "./pages/home/HomeAgentPage";
import HomeAgentChatPage from "./pages/home/HomeAgentThreadPage";
import AdminPage from "./pages/AdminPage";

// Lazy load only heavy pages with document viewers/editors
const CaseDocumentPage = lazy(
  () => import("./pages/CaseOpen/CaseDocumentPage"),
);
const LibraryDocumentPage = lazy(() => import("./pages/LibraryDocumentPage"));

// Wrapper to provide CasePermissionsProvider with caseId from CaseContext
// Este wrapper NO usa Layout porque CaseLayout maneja su propio layout con sidebar
const CaseRoutesWrapper: React.FC = () => {
  return (
    <LayoutProvider>
      <CaseProvider>
        <CasePermissionsWrapper>
          <EscritoProvider>
            <HighlightProvider>
              <Routes>
                <Route index element={<CaseDetailPage />} />
                <Route path="escritos" element={<EscritosPage />} />
                <Route path="escritos/:escritoId" element={<EscritosPage />} />
                <Route path="documentos" element={<CaseDocumentsPage />} />

                <Route path="clientes" element={<CaseClientsPage />} />
                <Route path="equipos" element={<CaseTeamsPage />} />
                <Route path="modelos" element={<CaseModelPage />} />
                <Route path="base-de-datos" element={<CaseDataBasePage />} />
                <Route
                  path="documentos/:documentId"
                  element={
                    <LazyLoadErrorBoundary>
                      <CaseDocumentPage />
                    </LazyLoadErrorBoundary>
                  }
                />
                <Route
                  path="configuracion/reglas"
                  element={<CaseSettingsRulesPage />}
                />
              </Routes>
            </HighlightProvider>
          </EscritoProvider>
        </CasePermissionsWrapper>
      </CaseProvider>
    </LayoutProvider>
  );
};

// Wrapper to provide caseId from CaseContext to CasePermissionsProvider
const CasePermissionsWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentCase } = useCase();
  const caseId = currentCase?._id || null;

  return (
    <CasePermissionsProvider caseId={caseId}>
      {children}
    </CasePermissionsProvider>
  );
};
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <Protect fallback={<SignInPage />}>
      <OnboardingWrapper>
        <MigrationWrapper>
          <Layout>{children}</Layout>
        </MigrationWrapper>
      </OnboardingWrapper>
    </Protect>
  );
};

// Memoize QueryClient to prevent recreation on every render
const useQueryClient = () => {
  return useMemo(() => new QueryClient(), []);
};

// Clarity tracking component
const ClarityTracker = () => {
  const location = useLocation();
  const { user, clerkUser } = useAuth();

  // Track page views
  useEffect(() => {
    const pageName = location.pathname.split("/").filter(Boolean).join("/") || "home";
    clarity.page(pageName);
  }, [location]);

  // Identify user when available
  useEffect(() => {
    if (clerkUser?.id && user !== undefined && user !== null) {
      const anonymizedId = `u_${clerkUser.id.slice(0, 12)}`;
      clarity.identify(anonymizedId, {
        role: (user as { role?: string }).role || "unknown",
      });
    }
  }, [clerkUser, user]);

  return null;
};

// Component that uses the thread context
const AppWithThread = () => {
  const queryClient = useQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <PageProvider>
        <ChatbotProvider>
          <ThreadProvider>
            <TutorialProvider>
              <div>
                {/* Show authentication loading skeleton while Convex auth is initializing */}
                <AuthLoading>
                  <AuthLoadingSkeleton />
                </AuthLoading>

                {/* Tutorial Overlay - shown when tutorial is active */}
                <TutorialOverlay />

                {/* Clarity tracking */}
                <ClarityTracker />

                {/* Main routing with Clerk's Protect component */}
                <RouteSuspense>
                  <Routes>
                    {/* Public authentication routes */}
                    <Route path="/signin" element={<SignInPage />} />
                    <Route path="/signup" element={<SignUpPage />} />

                    {/* Public invitation routes */}
                    <Route
                      path="/invites/accept"
                      element={<AcceptInvitePage />}
                    />
                    <Route
                      path="/invites/signup"
                      element={<SignupInvitePage />}
                    />

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
                    {/* Rutas de casos - sin Layout porque CaseLayout maneja su propio layout */}
                    <Route
                      path="/caso/:id/*"
                      element={
                        <Protect fallback={<SignInPage />}>
                          <OnboardingWrapper>
                            <MigrationWrapper>
                              <CaseRoutesWrapper />
                            </MigrationWrapper>
                          </OnboardingWrapper>
                        </Protect>
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
                    <Route
                      path="/eventos"
                      element={
                        <ProtectedRoute>
                          <EventosPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/eventos/:id"
                      element={
                        <ProtectedRoute>
                          <EventDetailPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/componentes"
                      element={
                        <ProtectedRoute>
                          <ComponentsShowcasePage />
                        </ProtectedRoute>
                      }
                    />
                    {/* AI Agent routes */}
                    <Route
                      path="/ai"
                      element={
                        <ProtectedRoute>
                          <LazyLoadErrorBoundary>
                            <HomeAgentPage />
                          </LazyLoadErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/ai/:threadId"
                      element={
                        <ProtectedRoute>
                          <LazyLoadErrorBoundary>
                            <HomeAgentChatPage />
                          </LazyLoadErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/biblioteca"
                      element={
                        <ProtectedRoute>
                          <LibraryPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/biblioteca/documento/:documentId"
                      element={
                        <ProtectedRoute>
                          <LazyLoadErrorBoundary>
                            <LibraryDocumentPage />
                          </LazyLoadErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/preferencias"
                      element={
                        <ProtectedRoute>
                          <UserPreferencesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/billing/success"
                      element={
                        <ProtectedRoute>
                          <BillingSuccessPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute>
                          <AdminPage />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </RouteSuspense>
              </div>
            </TutorialProvider>
          </ThreadProvider>
        </ChatbotProvider>
      </PageProvider>
    </QueryClientProvider>
  );
};

function App() {
  return <AppWithThread />;
}

export default App;
