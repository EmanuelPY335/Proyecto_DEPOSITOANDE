// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";

// --- Páginas ---
import Login from "./pages/Login";
import Home from "./pages/Home";
import Mapa from "./pages/Mapa";
import Pag2 from "./pages/Pag2";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Roles from "./pages/Roles";
import Empleados from "./pages/Empleados";
import Config from "./pages/Config"; 
import OrdenesTrabajo from "./pages/OrdenesTrabajo";
import Materiales from "./pages/Materiales"; 
import PedidosEntrantes from "./pages/PedidosEntrantes";
import Layout from "./components/Layout";

// --- Lógica de Permisos ---
const isLoggedIn = () => !!sessionStorage.getItem("access_token");

// ✅ NUEVA FUNCIÓN: Verifica si tiene el permiso específico
const hasPermission = (requiredPermission) => {
  const userRole = sessionStorage.getItem("user_rol");
  
  // Master_Admin siempre tiene acceso a todo
  if (userRole === "Master_Admin") return true; 

  // Recuperar permisos guardados
  const storedPermisos = sessionStorage.getItem("user_permissions");
  const permisos = storedPermisos ? JSON.parse(storedPermisos) : [];
  
  return permisos.includes(requiredPermission);
};

// 1. Ruta Protegida Básica
const ProtectedRoute = ({ children }) => {
  if (!isLoggedIn()) {
    return <Navigate to="/" replace state={{ message: "Error: Ingrese con un correo válido." }} />;
  }
  return <Layout>{children}</Layout>;
};

// 2. Ruta Autenticada (Sin Layout)
const AuthenticatedRoute = ({ children }) => {
  if (!isLoggedIn()) {
    return <Navigate to="/" replace state={{ message: "Error: Ingrese con un correo válido." }} />;
  }
  return children;
};

// 3. Ruta Admin (Solo para gestión de roles, estricta para Admins)
const AdminRoute = ({ children }) => {
  const userRole = sessionStorage.getItem("user_rol");
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  
  // Solo Admin y Master_Admin pueden entrar aquí (ej: para crear Roles)
  if (userRole !== "Admin" && userRole !== "Master_Admin") {
    return <Navigate to="/home" replace state={{ message: "Acceso restringido a Administradores." }} />;
  }
  return <Layout>{children}</Layout>;
};

// ✅ 4. NUEVA RUTA: PROTECCIÓN POR PERMISO (La que necesitas)
const PermissionRoute = ({ children, requiredPermission }) => {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  
  if (!hasPermission(requiredPermission)) {
    return (
      <Navigate 
        to="/home" 
        replace 
        state={{ message: `No tienes permisos para acceder a: ${requiredPermission}` }} 
      />
    );
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
            
          {/* --- RUTAS CON PERMISOS ESPECÍFICOS --- */}
          
          {/* Antes usabas AdminRoute, ahora usa PermissionRoute con el permiso 'gestion_empleados' */}
          <Route 
            path="/empleados" 
            element={
              <PermissionRoute requiredPermission="gestion_empleados">
                <Empleados />
              </PermissionRoute>
            } 
          />

          <Route 
            path="/materiales" 
            element={
              <PermissionRoute requiredPermission="gestion_materiales">
                <Materiales />
              </PermissionRoute>
            } 
          />

          <Route 
            path="/ordenes-trabajo" 
            element={
              <ProtectedRoute>
                <OrdenesTrabajo />
              </ProtectedRoute>
            } 
          />
          
          <Route 
             path="/pag2" 
             element={
               <PermissionRoute requiredPermission="gestion_movimientos">
                 <Pag2 />
               </PermissionRoute>
             } 
          />

          {/* --- RUTAS ESPECIALES --- */}
          <Route path="/mapa" element={<AuthenticatedRoute><Mapa /></AuthenticatedRoute>} />

          {/* --- RUTAS SOLO ADMIN --- */}
          {/* Roles sigue siendo solo para admins, así que AdminRoute está bien aquí */}
          <Route path="/roles" element={<AdminRoute><Roles /></AdminRoute>} />
            
          <Route 
            path="/pedidos-entrantes" 
            element={
              <ProtectedRoute>
                  <Layout fullWidth={true}>
                      <PedidosEntrantes />
                  </Layout>
              </ProtectedRoute>
            } 
          />

          {/* --- FALLBACK --- */}
          <Route path="*" element={<Navigate to="/home" replace />} />
            
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;