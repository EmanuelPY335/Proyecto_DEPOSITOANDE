// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; 
// 1. IMPORTAMOS EL ICONO PARA MATERIALES (Package o Box)
import { Home, Settings, HelpCircle, FileText, LogOut, Package } from "lucide-react"; 

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user_nombre");
    sessionStorage.removeItem("user_rol"); // Es bueno limpiar el rol también
    navigate("/"); 
  };

  // Links de la Sidebar
  const sidebarLinks = [
    { path: "/home", label: "Home", icon: <Home size={18} /> }, 
    // 2. AGREGAMOS LA RUTA DE MATERIALES AQUÍ
    // Usamos el path "/materiales" que definimos en las rutas
    { path: "/materiales", label: "Inventario", icon: <Package size={18} /> },
    { path: "/reports", label: "Informes", icon: <FileText size={18} /> },
    { path: "/config", label: "Configuración", icon: <Settings size={18} /> }, 
    { path: "/help", label: "Ayuda", icon: <HelpCircle size={18} /> },
  ];

  return (
    <div className="sidebar-dashboard">
      <nav className="sidebar-nav">
        <ul>
          {sidebarLinks.map((link) => (
            <li key={link.path}>
              {/* 3. POR QUÉ NO SE REINICIA AHORA:
                  El componente <Link> de react-router-dom maneja la navegación internamente.
                  Si usaras <a href="..."> el navegador recargaría todo desde cero.
              */}
              <Link 
                to={link.path} 
                className={`sidebar-link ${location.pathname === link.path ? 'active' : ''}`}
              >
                {link.icon} 
                <span className="sidebar-label">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        
        {/* Botón de Logout */}
        <ul style={{marginTop: 'auto'}}> 
           <li>
              <button 
                onClick={handleLogout} 
                className="sidebar-link"
                style={{width: '100%', background: 'none', border: 'none', cursor: 'pointer'}}
              >
                <LogOut size={18} /> 
                <span className="sidebar-label">Cerrar Sesión</span>
              </button>
            </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;