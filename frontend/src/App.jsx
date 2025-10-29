// sisdepo/frontend/src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Pag1 from "./pages/Pag1";
import Pag2 from "./pages/Pag2";

// --- 1. Importa el nuevo componente ---
import ResetPassword from "./pages/ResetPassword"; 

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/pag1" element={<Pag1 />} />
        <Route path="/pag2" element={<Pag2 />} />

        {/* --- 2. Añade la nueva ruta --- */}
        {/* El ':token' es el parámetro dinámico que viene del email */}
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        
      </Routes>
    </Router>
  );
}

export default App;