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
const isLoggedIn = () => !!sessionStorage.getItem("access_token");

const isAdmin = () => {
  const userRole = sessionStorage.getItem("user_rol");
  // Ahora permite pasar al Gerente (Admin) O al Desarrollador (Master_Admin)
  return userRole === "Admin" || userRole === "Master_Admin";
};


// --- CAMBIO 1: ProtectedRoute ---
const ProtectedRoute = ({ children }) => {
  if (!isLoggedIn()) {
    // Escenario 1: No ha iniciado sesión
    return (
      <Navigate 
        to="/" 
        replace 
        state={{ message: "Error: Ingrese con un correo y contraseña válida." }} 
      />
    );
  }
  return children;
};


// --- CAMBIO 2: AdminRoute ---
const AdminRoute = ({ children }) => {
  if (!isLoggedIn()) {
    // Caso A: Ni siquiera ha iniciado sesión
    return (
      <Navigate 
        to="/" 
        replace 
        state={{ message: "Error: Ingrese con un correo y contraseña válida." }} 
      />
    );
  }

  if (!isAdmin()) {
    // Escenario 2: Inició sesión pero no tiene permisos
    return (
      <Navigate 
        to="/home" 
        replace 
        state={{ message: "No tienes permisos para acceder a esa dirección." }} 
      />
    );
  }

  return children;
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