import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Pag1 from "./pages/Pag1";
import Pag2 from "./pages/Pag2";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";

// NUEVO: páginas admin
import Roles from "./pages/Roles";          // crea este archivo (lo que te pasé)
import Empleados from "./pages/Empleados";  // crea este archivo (lo que te pasé)

// --- Guards ---
const isLoggedIn = () => !!localStorage.getItem("access_token");
const isAdmin = () => localStorage.getItem("user_rol") === "Master_Admin";

const ProtectedRoute = ({ children }) => {
  return isLoggedIn() ? children : <Navigate to="/" replace />;
};

const AdminRoute = ({ children }) => {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  return isAdmin() ? children : <Navigate to="/home" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Público */}
        <Route path="/" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protegidas (requieren login) */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pag1"
          element={
            <ProtectedRoute>
              <Pag1 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pag2"
          element={
            <ProtectedRoute>
              <Pag2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Solo Gerente (Master_Admin) */}
        <Route
          path="/roles"
          element={
            <AdminRoute>
              <Roles />
            </AdminRoute>
          }
        />
        <Route
          path="/empleados"
          element={
            <AdminRoute>
              <Empleados />
            </AdminRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
