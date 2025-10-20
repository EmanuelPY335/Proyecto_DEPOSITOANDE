// Sidebar.jsx - REVISADO
import React from "react";
import { Link, useLocation } from "react-router-dom";
// Íconos necesarios: Home (Casita), Settings (Engranaje)
import { Home, Settings, HelpCircle, FileText } from "lucide-react"; 

const Sidebar = () => {
  const location = useLocation(); // Hook para saber qué enlace está activo

  // Links de la Sidebar, según la imagen
  const sidebarLinks = [
    // El primer icono es la Casita para el Home/Pantalla principal
    { path: "/Home", label: "Home", icon: <Home size={18} /> }, 
    // El segundo icono es el Engranaje para Configuración
    { path: "/config", label: "Configuración", icon: <Settings size={18} /> }, 
    { path: "/help", label: "Ayuda", icon: <HelpCircle size={18} /> },
    { path: "/reports", label: "Informes", icon: <FileText size={18} /> },
  ];

  return (
    // La clase 'sidebar-dashboard' recibe los nuevos estilos
    <div className="sidebar-dashboard">
      <nav className="sidebar-nav">
        <ul>
          {sidebarLinks.map((link) => (
            <li key={link.path}>
              <Link 
                to={link.path} 
                // La clase 'active' resalta el enlace actual
                className={`sidebar-link ${location.pathname === link.path ? 'active' : ''}`}
              >
                {link.icon} 
                <span className="sidebar-label">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;