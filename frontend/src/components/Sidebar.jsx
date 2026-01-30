// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; 
// ✅ 1. Importamos Activity
import { Home, Settings, HelpCircle, FileText, Package, ArrowRightLeft, DollarSign, Map, Users, Clipboard, Activity } from "lucide-react"; 
import { hasPermission } from "../utils/auth"; 

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ 2. Definimos 'rol' obteniéndolo de la sesión
  const rol = (sessionStorage.getItem("user_rol") || sessionStorage.getItem("rol_nombre") || "").trim();

  const handleLogout = () => {
    // 🔥 limpiar wizard persistido
    localStorage.removeItem("wiz_step");
    localStorage.removeItem("wiz_config");
    localStorage.removeItem("wiz_stops");
    localStorage.removeItem("wiz_user");

    // limpiar sesión
    sessionStorage.clear();

    // navegar
    navigate("/", { replace: true });
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

          {/* ✅ 3. Enlace de Auditoría corregido (Estilo sidebar-link y uso de variables definidas) */}
          {(rol === "Master_Admin" || rol === "Admin") && (
             <li>
                <Link 
                  to="/reportes" 
                  className={`sidebar-link ${location.pathname === "/reportes" ? "active" : ""}`}
                >
                    <Activity size={18} />
                    <span className="sidebar-label">Auditoría</span>
                </Link>
             </li>
          )}
        </ul>

        {/* Botón Cerrar Sesión al fondo */}
        <ul style={{marginTop: 'auto', paddingBottom: '20px'}}> 
          <li>
              <button onClick={handleLogout} className="sidebar-link logout-btn">
                <span className="sidebar-label">Cerrar Sesion</span>
              </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;