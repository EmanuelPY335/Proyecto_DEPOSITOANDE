// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; 
import { Home, Settings, HelpCircle, FileText, LogOut, Package } from "lucide-react"; 
import { hasPermission } from "../utils/auth"; // Importamos el helper

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/"); 
  };

  // CONSTRUCCIÓN DINÁMICA DEL MENÚ
  const sidebarLinks = [];

  // 1. Home (Siempre visible)
  sidebarLinks.push({ path: "/home", label: "Inicio", icon: <Home size={18} /> });

  // 2. Inventario (Solo si tiene permiso o es Admin)
  if (hasPermission("gestion_materiales")) {
      sidebarLinks.push({ 
          path: "/materiales", 
          label: "Inventario", 
          icon: <Package size={18} /> 
      });
  }

  // 3. Informes (Podemos usar un permiso o dejarlo abierto)
  sidebarLinks.push({ path: "/reports", label: "Informes", icon: <FileText size={18} /> });

  // 4. Configuración (Protegido)
  if (hasPermission("gestion_roles")) {
      sidebarLinks.push({ path: "/config", label: "Configuración", icon: <Settings size={18} /> });
  } else {
      sidebarLinks.push({ path: "/help", label: "Ayuda", icon: <HelpCircle size={18} /> });
  }

  return (
    <div className="sidebar-dashboard">
      <nav className="sidebar-nav">
        <ul>
          {sidebarLinks.map((link) => (
            <li key={link.path}>
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
        
        <ul style={{marginTop: 'auto'}}> 
           <li>
              <button onClick={handleLogout} className="sidebar-link" style={{width: '100%', background: 'none', border: 'none', cursor: 'pointer'}}>
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