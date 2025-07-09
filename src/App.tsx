import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import Layout from "./components/Layout/Layout";
import CasesPage from "./pages/CasesPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/casos" element={<CasesPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
