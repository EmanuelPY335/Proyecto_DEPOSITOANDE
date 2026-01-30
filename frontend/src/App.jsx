// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";

// --- Páginas ---
import Login from "./pages/Login";
import Home from "./pages/Home";
import Mapa from "./pages/Mapa";
import Gastos from "./pages/Gastos";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Roles from "./pages/Roles";
import Empleados from "./pages/Empleados";
import Config from "./pages/Config"; 
import OrdenesTrabajo from "./pages/OrdenesTrabajo";
import Materiales from "./pages/Materiales"; 
import Movimientos from "./pages/Movimientos"; 
import Layout from "./components/Layout";
import Buzon from "./pages/Buzon";
// src/App.jsx
// ... imports
import Reportes from "./pages/Reportes";


// --- Lógica de Permisos ---
const isLoggedIn = () => !!sessionStorage.getItem("access_token");

const hasPermission = (requiredPermission) => {
  const userRole = sessionStorage.getItem("user_rol");
  if (userRole === "Master_Admin") return true; 
  const storedPermisos = sessionStorage.getItem("user_permissions");
  const permisos = storedPermisos ? JSON.parse(storedPermisos) : [];
  return permisos.includes(requiredPermission);
};

// --- Componentes de Protección Actualizados ---

// Acepta fullWidth para pasar al Layout
const ProtectedRoute = ({ children, requireAuth = true, fullWidth = false }) => {
  if (requireAuth && !isLoggedIn()) {
    return <Navigate to="/" replace state={{ message: "Error: Ingrese con un correo válido." }} />;
  }
  return <Layout fullWidth={fullWidth}>{children}</Layout>;
};

const PermissionRoute = ({ children, requiredPermission, fullWidth = false }) => {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/home" replace state={{ message: `No tienes permisos para acceder: ${requiredPermission}` }} />;
  }
  return <Layout fullWidth={fullWidth}>{children}</Layout>;
};

const RoleRoute = ({ children, allowedRoles }) => {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  const userRole = sessionStorage.getItem("user_rol");
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/home" replace state={{ message: `Acceso restringido a: ${allowedRoles.join(', ')}` }} />;
  }
  return <Layout>{children}</Layout>;
};

// --- APP PRINCIPAL ---
function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* --- RUTAS PÚBLICAS --- */}
          <Route path="/" element={<Login />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* --- RUTAS GENERALES --- */}
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute><Config /></ProtectedRoute>} />
          
          {/* CAMBIO: Buzón ahora usa fullWidth={true} */}
          <Route path="/buzon" element={<ProtectedRoute fullWidth={true}><Buzon /></ProtectedRoute>} />
            
          {/* --- GESTIÓN CON PERMISOS --- */}
          <Route 
            path="/empleados" 
            element={<PermissionRoute requiredPermission="gestion_empleados"><Empleados /></PermissionRoute>} 
          />

          <Route 
            path="/materiales" 
            element={<PermissionRoute requiredPermission="gestion_materiales"><Materiales /></PermissionRoute>} 
          />

          <Route 
            path="/ordenes-trabajo" 
            element={<ProtectedRoute><OrdenesTrabajo /></ProtectedRoute>} 
          />
          
          <Route 
            path="/movimientos" 
            element={<PermissionRoute requiredPermission="gestion_movimientos"><Movimientos /></PermissionRoute>} 
          />

          <Route 
            path="/gastos" 
            element={<PermissionRoute requiredPermission="gestion_gastos"><Gastos /></PermissionRoute>} 
          />

          {/* --- RUTAS ESPECIALES --- */}
          {/* CAMBIO: Mapa ahora usa fullWidth={true} */}
          <Route path="/mapa" element={
            <PermissionRoute requiredPermission="ver_mapa" fullWidth={true}>
              <Mapa />
            </PermissionRoute>
          } />
          
          <Route path="/roles" element={
            <RoleRoute allowedRoles={["Master_Admin", "Admin"]}>
              <Roles />
            </RoleRoute>
          } />
// ... dentro de Routes
          <Route path="/reportes" element={<ProtectedRoute fullWidth={true}><Reportes /></ProtectedRoute>} />
          {/* --- FALLBACK --- */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;