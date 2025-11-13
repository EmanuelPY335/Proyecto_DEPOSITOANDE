// Sidebar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; // <--- CAMBIO: Importar useNavigate
// <--- CAMBIO: Importar icono de Logout --->
import { Home, Settings, HelpCircle, FileText, LogOut } from "lucide-react"; 

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate(); // <--- CAMBIO: Hook para navegar

  // <--- CAMBIO: Función de Logout --->
  const handleLogout = () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user_nombre");
    navigate("/"); // Redirigir al login
  };

  // Links de la Sidebar
  const sidebarLinks = [
    { path: "/home", label: "Home", icon: <Home size={18} /> }, 
    { path: "/config", label: "Configuración", icon: <Settings size={18} /> }, 
    { path: "/help", label: "Ayuda", icon: <HelpCircle size={18} /> },
    { path: "/reports", label: "Informes", icon: <FileText size={18} /> },
  ];

  return (
    <div className="sidebar-dashboard">
      <nav className="sidebar-nav">
        {/* Usamos <ul> separados para empujar el logout al fondo */}
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
        
        {/* <--- CAMBIO: Botón de Logout ---> */}
        <ul style={{marginTop: 'auto'}}> {/* Empuja al fondo */}
           <li>
              {/* Usamos un botón para semántica, pero con la clase de link */}
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