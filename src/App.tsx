import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import Layout from "./components/Layout/Layout";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import ClientsPage from "./pages/ClientsPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/casos" element={<CasesPage />} />
        <Route path="/caso/:title" element={<CaseDetailPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
