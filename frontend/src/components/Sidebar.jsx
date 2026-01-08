// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; 
import { Home, Settings, HelpCircle, FileText, Package, ArrowRightLeft, DollarSign } from "lucide-react"; 
import { hasPermission } from "../utils/auth"; 

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/"); 
  };

  const sidebarLinks = [];

  // 1. Home (Visible para todos)
  sidebarLinks.push({ path: "/home", label: "Inicio", icon: <Home size={18} /> });

  // 2. Inventario (Solo quien tenga permiso)
  if (hasPermission("gestion_materiales")) {
      sidebarLinks.push({ path: "/materiales", label: "Inventario", icon: <Package size={18} /> });
  }
  
  // 3. Movimientos (Solo Master Admin, Admin o Personal Inventario)
  // Usamos un permiso específico o verificamos rol en auth.js, pero asumiremos 'gestion_movimientos'
  if (hasPermission("gestion_movimientos")) {
      sidebarLinks.push({ path: "/movimientos", label: "Movimientos", icon: <ArrowRightLeft size={18} /> });
  }

  // 4. Gastos (Solo Admins)
  if (hasPermission("gestion_gastos")) {
      sidebarLinks.push({ path: "/gastos", label: "Gastos", icon: <DollarSign size={18} /> });
  }

  // 5. Informes (Solo Admins)
  if (hasPermission("ver_reportes")) {
      sidebarLinks.push({ path: "/reports", label: "Informes", icon: <FileText size={18} /> });
  }

  // 6. Configuración
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
              <button onClick={handleLogout} className="sidebar-link" style={{width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444'}}>
                 <span style={{marginRight: '10px'}}>🚪</span>
                 <span className="sidebar-label">Cerrar Sesion</span>
              </button>
           </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;