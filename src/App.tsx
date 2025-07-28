import { Routes, Route } from "react-router-dom";
import { Protect } from "@clerk/clerk-react";
import { AuthLoading } from "convex/react";
import HomePage from "./pages/HomePage";
import Layout from "./components/Layout/Layout";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseOpen/CaseDetailPage";
import ClientsPage from "./pages/ClientsPage";
import EscritosPage from "./pages/CaseOpen/EscritosPage";
import ModelsPage from "./pages/ModelsPage";
import DataBasePage from "./pages/DataBasePage";
import { AppSkeleton } from "./components/Skeletons";
import { OnboardingWrapper } from "./components/Auth/OnboardingWrapper";
import { SignInPage } from "./components/Auth/SignInPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThreadProvider } from "./context/ThreadContext";
import TeamPage from "./pages/TeamPage";
import TeamManagePage from "./pages/TeamManagePage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import SignupInvitePage from "./pages/SignupInvitePage";
import CaseClientsPage from "./pages/CaseOpen/CaseClientPage";
import CaseTeamsPage from "./pages/CaseOpen/CaseTeamsPage";
import { CaseProvider } from "./context/CaseContext";
import CaseModelPage from "./pages/CaseOpen/CaseModelPage";
import CaseDataBasePage from "./pages/CaseOpen/CaseDataBase";

import "@copilotkit/react-ui/styles.css";

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

const queryClient = new QueryClient();

// Component that uses the thread context
const AppWithThread = () => {

  return (
    <div>
      {/* Show authentication loading skeleton while Convex auth is initializing */}
      <AuthLoading>
        <AppSkeleton />
      </AuthLoading>

      {/* Main routing with Clerk's Protect component */}
      <Routes>
        {/* Public sign-in route */}
        <Route path="/signin" element={<SignInPage />} />

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
                <Routes>
                  <Route index element={<CaseDetailPage />} />
                  <Route
                    path="escritos/:escritoId"
                    element={<EscritosPage />}
                  />
                  <Route path="clientes" element={<CaseClientsPage />} />
                  <Route path="equipos" element={<CaseTeamsPage />} />
                  <Route path="modelos" element={<CaseModelPage />} />
                  <Route path="base-de-datos" element={<CaseDataBasePage />} />
                </Routes>
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
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThreadProvider>
        <AppWithThread />
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      </ThreadProvider>
    </QueryClientProvider>
  );
}

export default App;
