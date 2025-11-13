// src/App.jsx

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";

// 👈 CAMBIO IMPORTANTE: respeta mayúsculas/minúsculas del archivo
import Mapa from "./pages/Mapa";

import Pag2 from "./pages/Pag2";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Roles from "./pages/Roles";
import Empleados from "./pages/Empleados";

import Layout from "./components/Layout";

// --- Guards ---
const isLoggedIn = () => !!sessionStorage.getItem("access_token");

const isAdmin = () => {
  const userRole = sessionStorage.getItem("user_rol");
  return userRole === "Admin" || userRole === "Master_Admin";
};

// Usa Layout
const ProtectedRoute = ({ children }) => {
  if (!isLoggedIn()) {
    return (
      <Navigate
        to="/"
        replace
        state={{ message: "Error: Ingrese con un correo y contraseña válida." }}
      />
    );
  }
  return <Layout>{children}</Layout>;
};

// SOLO verifica login (sin Layout) → para el mapa
const AuthenticatedRoute = ({ children }) => {
  if (!isLoggedIn()) {
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

const AdminRoute = ({ children }) => {
  if (!isLoggedIn()) {
    return (
      <Navigate
        to="/"
        replace
        state={{ message: "Error: Ingrese con un correo y contraseña válida." }}
      />
    );
  }
  if (!isAdmin()) {
    return (
      <Navigate
        to="/home"
        replace
        state={{ message: "No tienes permisos para acceder a esa dirección." }}
      />
    );
  }
  return <Layout>{children}</Layout>;
};
// --- Fin Guards ---

function App() {
  return (
    <Router>
      <Routes>
        {/* Público */}
        <Route path="/" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protegidas (requieren login + Layout) */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* Mapa: requiere login, pero SIN Layout principal */}
        <Route
          path="/mapa"
          element={
            <AuthenticatedRoute>
              <Mapa />
            </AuthenticatedRoute>
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

        {/* Solo Admin/Master_Admin */}
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
