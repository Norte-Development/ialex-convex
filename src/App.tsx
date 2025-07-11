import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import Layout from "./components/Layout/Layout";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import ClientsPage from "./pages/ClientsPage";
import AgreementsPage from "./pages/AgreementsPage";
import NameOfDocumentPage from "./pages/NameOfDocumentPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/casos" element={<CasesPage />} />
        <Route path="/caso/:title" element={<CaseDetailPage />} />
        <Route path="/caso/:title/acuerdos" element={<AgreementsPage />} />
        <Route
          path="/caso/:title/nombre-del-documento"
          element={<NameOfDocumentPage />}
        />
        <Route path="/clientes" element={<ClientsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
