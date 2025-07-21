import { Routes, Route } from "react-router-dom";
import { Protect } from "@clerk/clerk-react";
import { AuthLoading } from "convex/react";
import HomePage from "./pages/HomePage";
import Layout from "./components/Layout/Layout";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/DetailCases/CaseDetailPage";
import ClientsPage from "./pages/ClientsPage";
import AgreementsPage from "./pages/DetailCases/AgreementsPage";
import NameOfDocumentPage from "./pages/DetailCases/NameOfDocumentPage";
import ModelsPage from "./pages/ModelsPage";
import DataBasePage from "./pages/DataBasePage";
import { AppSkeleton } from "./components/Skeletons";
import { OnboardingWrapper } from "./components/Auth/OnboardingWrapper";
import { SignInPage } from "./components/Auth/SignInPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import TeamPage from "./pages/TeamPage";
import TeamManagePage from "./pages/TeamManagePage";
import CaseClientsPage from "./pages/DetailCases/CaseClientPage";
import { CaseProvider } from "./context/CaseContext";

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Show authentication loading skeleton while Convex auth is initializing */}
      <AuthLoading>
        <AppSkeleton />
      </AuthLoading>

      {/* Main routing with Clerk's Protect component */}
      <Routes>
        {/* Public sign-in route */}
        <Route path="/signin" element={<SignInPage />} />

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
                  <Route path="acuerdos" element={<AgreementsPage />} />
                  <Route
                    path="nombre-del-documento"
                    element={<NameOfDocumentPage />}
                  />
                  <Route path="clientes" element={<CaseClientsPage />} />
                  <Route path="modelos" element={<ModelsPage />} />
                  <Route path="base-de-datos" element={<DataBasePage />} />
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
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
