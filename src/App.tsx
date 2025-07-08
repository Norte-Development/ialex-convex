import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import NavBar from "./components/Layout/NavBar";

function App() {
  return (
    <main className="flex flex-col min-h-screen bg-white">
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </main>
  );
}

export default App;
