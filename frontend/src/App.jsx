// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";

// --- Páginas ---
import Login from "./pages/Login";
import Home from "./pages/Home";
import Mapa from "./pages/Mapa";
import Pag2 from "./pages/Pag2"; // ESTA ES LA PÁGINA DE GASTOS
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Roles from "./pages/Roles";
import Empleados from "./pages/Empleados";
import Config from "./pages/Config"; 
import OrdenesTrabajo from "./pages/OrdenesTrabajo";
import Materiales from "./pages/Materiales"; 
import PedidosEntrantes from "./pages/PedidosEntrantes";
import Movimientos from "./pages/Movimientos"; 
import Layout from "./components/Layout";

// --- Lógica de Permisos ---
const isLoggedIn = () => !!sessionStorage.getItem("access_token");

const hasPermission = (requiredPermission) => {
  const userRole = sessionStorage.getItem("user_rol");
  if (userRole === "Master_Admin") return true; 
  const storedPermisos = sessionStorage.getItem("user_permissions");
  const permisos = storedPermisos ? JSON.parse(storedPermisos) : [];
  return permisos.includes(requiredPermission);
};

// --- Componentes de Protección ---

const ProtectedRoute = ({ children }) => {
  if (!isLoggedIn()) {
    return <Navigate to="/" replace state={{ message: "Error: Ingrese con un correo válido." }} />;
  }
  return <Layout>{children}</Layout>;
};

const AuthenticatedRoute = ({ children }) => {
  if (!isLoggedIn()) {
    return <Navigate to="/" replace state={{ message: "Error: Ingrese con un correo válido." }} />;
  }
  return children;
};

const AdminRoute = ({ children }) => {
  const userRole = sessionStorage.getItem("user_rol");
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  if (userRole !== "Admin" && userRole !== "Master_Admin") {
    // ESTA ES LA REDIRECCIÓN QUE PODRÍA ESTAR MOLESTANDO SI USARAS ADMINROUTE
    return <Navigate to="/home" replace state={{ message: "Acceso restringido a Administradores." }} />;
  }
  return <Layout>{children}</Layout>;
};

const PermissionRoute = ({ children, requiredPermission }) => {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/home" replace state={{ message: `No tienes permisos para acceder a: ${requiredPermission}` }} />;
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
            
          {/* --- GESTIÓN --- */}
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
             element={<ProtectedRoute><Movimientos /></ProtectedRoute>} 
          />

          {/* ✅ RUTA GASTOS: Verificamos que apunte a Pag2 y sea ProtectedRoute */}
          <Route 
             path="/gastos" 
             element={
               <ProtectedRoute>
                 <Pag2 />
               </ProtectedRoute>
             } 
          />

          {/* --- RUTAS ESPECIALES --- */}
          <Route path="/mapa" element={<AuthenticatedRoute><Mapa /></AuthenticatedRoute>} />
          <Route path="/roles" element={<AdminRoute><Roles /></AdminRoute>} />
          <Route 
            path="/pedidos-entrantes" 
            element={<ProtectedRoute><Layout fullWidth={true}><PedidosEntrantes /></Layout></ProtectedRoute>} 
          />

          {/* --- FALLBACK (CATCH-ALL) --- */}
          {/* Si ninguna ruta de arriba coincide, te manda al home. */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;