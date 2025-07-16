import { Routes, Route } from "react-router-dom";
import { Protect } from "@clerk/clerk-react";
import { AuthLoading } from "convex/react";
import HomePage from "./pages/HomePage";
import Layout from "./components/Layout/Layout";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import ClientsPage from "./pages/ClientsPage";
import AgreementsPage from "./pages/AgreementsPage";
import NameOfDocumentPage from "./pages/NameOfDocumentPage";
import ModelsPage from "./pages/ModelsPage";
import DataBasePage from "./pages/DataBasePage";
import { AppSkeleton } from "./components/Skeletons";
import { OnboardingWrapper } from "./components/Auth/OnboardingWrapper";
import { SignInPage } from "./components/Auth/SignInPage";

// Helper component to reduce repetition
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Protect fallback={<SignInPage />}>
      <OnboardingWrapper>
        <Layout>
          {children}
        </Layout>
      </OnboardingWrapper>
    </Protect>
  );
};

function App() {
  return (
    <>
      {/* Show authentication loading skeleton while Convex auth is initializing */}
      <AuthLoading>
        <AppSkeleton />
      </AuthLoading>

      {/* Main routing with Clerk's Protect component */}
      <Routes>
        {/* Public sign-in route */}
        <Route path="/signin" element={<SignInPage />} />
        
        {/* Protected routes using Clerk's Protect component */}
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/casos" element={<ProtectedRoute><CasesPage /></ProtectedRoute>} />
        <Route path="/caso/:title" element={<ProtectedRoute><CaseDetailPage /></ProtectedRoute>} />
        <Route path="/caso/:title/acuerdos" element={<ProtectedRoute><AgreementsPage /></ProtectedRoute>} />
        <Route
          path="/caso/:title/nombre-del-documento"
          element={<ProtectedRoute><NameOfDocumentPage /></ProtectedRoute>}
        />
        <Route path="/clientes" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
        <Route path="/modelos" element={<ProtectedRoute><ModelsPage /></ProtectedRoute>} />
        <Route path="/base-de-datos" element={<ProtectedRoute><DataBasePage /></ProtectedRoute>} />
      </Routes>
    </>
  );
}

export default App;
