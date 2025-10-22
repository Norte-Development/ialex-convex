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
import { CaseProvider, useCase } from "./context/CaseContext";
import { HighlightProvider } from "./context/HighlightContext";
import { EscritoProvider } from "./context/EscritoContext";
import { PageProvider } from "./context/PageContext";
import { CasePermissionsProvider } from "./context/CasePermissionsContext";
import { ChatbotProvider } from "./context/ChatbotContext";
import { LayoutProvider } from "./context/LayoutContext";

// Lazy load pages to reduce initial bundle size
const HomePage = lazy(() => import("./pages/home/HomePage"));
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
const CaseDocumentPage = lazy(
  () => import("./pages/CaseOpen/CaseDocumentPage"),
);
const CaseSettingsRulesPage = lazy(
  () => import("./pages/CaseOpen/CaseSettingsRulesPage"),
);
const ComponentsShowcasePage = lazy(
  () => import("./pages/ComponentsShowcasePage"),
);
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const LibraryDocumentPage = lazy(() => import("./pages/LibraryDocumentPage"));
const UserPreferencesPage = lazy(() => import("./pages/UserPreferencesPage"));
const BillingSuccessPage = lazy(() => import("./pages/BillingSuccessPage"));

// AI Agent pages
const HomeAgentPage = lazy(() => import("./pages/home/HomeAgentPage"));
const HomeAgentChatPage = lazy(
  () => import("./pages/home/HomeAgentThreadPage"),
);

// Eventos pages
const EventosPage = lazy(() => import("./pages/EventosPage"));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage"));

const CaseDocumentsPage = lazy(
  () => import("./pages/CaseOpen/CaseDocumentsList"),
);

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
                  element={<CaseDocumentPage />}
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
      <PageProvider>
        <ChatbotProvider>
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
                          <CaseRoutesWrapper />
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
                        <HomeAgentPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ai/:threadId"
                    element={
                      <ProtectedRoute>
                        <HomeAgentChatPage />
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
                        <LibraryDocumentPage />
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
                </Routes>
              </Suspense>
            </div>
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
