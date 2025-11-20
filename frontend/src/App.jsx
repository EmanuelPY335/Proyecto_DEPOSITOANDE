// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// --- Contextos ---
import { ThemeProvider } from "./context/ThemeContext"; // <--- IMPORTANTE PARA MODO OSCURO

// --- Páginas ---
import Login from "./pages/Login";
import Home from "./pages/Home";
import Mapa from "./pages/Mapa";
import Pag2 from "./pages/Pag2";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Roles from "./pages/Roles";
import Empleados from "./pages/Empleados";
import Config from "./pages/Config"; // <--- NUEVA PÁGINA

// --- Componentes ---
import Layout from "./components/Layout";

// --- Guards (Lógica de Protección) ---
const isLoggedIn = () => !!sessionStorage.getItem("access_token");

const isAdmin = () => {
  const userRole = sessionStorage.getItem("user_rol");
  return userRole === "Admin" || userRole === "Master_Admin";
};

// 1. Ruta Protegida (Cualquier usuario logueado + Layout)
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

// 2. Ruta Autenticada (Solo login, SIN Layout - Ej: Mapa pantalla completa)
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

// 3. Ruta Admin (Solo Gerentes + Layout)
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

// --- APP PRINCIPAL ---
function App() {
  return (
    // Envolvemos toda la app en el ThemeProvider para que los colores funcionen
    <ThemeProvider>
      <Router>
        <Routes>
          
          {/* --- RUTAS PÚBLICAS --- */}
          <Route path="/" element={<Login />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* --- RUTAS GENERALES (Cualquier empleado) --- */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
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

          {/* Nueva Ruta de Configuración */}
          <Route
            path="/config"
            element={
              <ProtectedRoute>
                <Config /> 
              </ProtectedRoute>
            }
          />

          {/* --- RUTAS ESPECIALES (Sin Layout) --- */}
          <Route
            path="/mapa"
            element={
              <AuthenticatedRoute>
                <Mapa />
              </AuthenticatedRoute>
            }
          />

          {/* --- RUTAS DE ADMINISTRADOR --- */}
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

          {/* --- FALLBACK (Error 404) --- */}
          <Route path="*" element={<Navigate to="/home" replace />} />
          
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;