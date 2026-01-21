// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; 
// Importamos los iconos que faltaban: Map, Users, Clipboard
import { Home, Settings, HelpCircle, FileText, Package, ArrowRightLeft, DollarSign, Map, Users, Clipboard } from "lucide-react"; 
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

  // 2. Mapa (Nuevo - Protegido)
  if (hasPermission("ver_mapa")) {
      sidebarLinks.push({ path: "/Mapa", label: "Mapa", icon: <Map size={18} /> });
  }

  // 3. Órdenes de Trabajo (Visible para todos los empleados)
  sidebarLinks.push({ path: "/ordenes-trabajo", label: "Órdenes", icon: <Clipboard size={18} /> });

  // 4. Inventario (Protegido)
  if (hasPermission("gestion_materiales")) {
      sidebarLinks.push({ path: "/materiales", label: "Inventario", icon: <Package size={18} /> });
  }
  
  // 5. Movimientos (Protegido)
  if (hasPermission("gestion_movimientos")) {
      sidebarLinks.push({ path: "/movimientos", label: "Movimientos", icon: <ArrowRightLeft size={18} /> });
  }

  // 6. Gastos (Protegido - Aquí entrarán los Choferes con permiso)
  if (hasPermission("gestion_gastos")) {
      sidebarLinks.push({ path: "/gastos", label: "Gastos", icon: <DollarSign size={18} /> });
  }

  // 7. Empleados (Nuevo - Protegido)
  if (hasPermission("gestion_empleados")) {
      sidebarLinks.push({ path: "/empleados", label: "Empleados", icon: <Users size={18} /> });
  }

  // 8. Informes (Protegido)
  if (hasPermission("ver_reportes")) {
      sidebarLinks.push({ path: "/reports", label: "Informes", icon: <FileText size={18} /> });
  }

  // 9. Configuración
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
        
        {/* El style marginTop: 'auto' AHORA funcionará porque el padre es flex */}
        <ul style={{marginTop: 'auto', paddingBottom: '20px'}}> 
          <li>
              <button onClick={handleLogout} className="sidebar-link logout-btn">
                {/* ... icono ... */}
                <span className="sidebar-label">Cerrar Sesion</span>
              </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;