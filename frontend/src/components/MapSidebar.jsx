// src/components/MapSidebar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Settings, HelpCircle, FileText, LogOut, Car, ListChecks, MapPin } from "lucide-react"; 

// Reutilizamos los estilos del sidebar principal
import "../styles/Home.css"; 

const MapSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user_nombre");
    navigate("/"); 
  };

  // Links de navegación estándar (iguales a Sidebar.jsx)
  const sidebarLinks = [
    { path: "/home", label: "Home", icon: <Home size={18} /> }, 
    { path: "/config", label: "Configuración", icon: <Settings size={18} /> }, 
    { path: "/help", label: "Ayuda", icon: <HelpCircle size={18} /> },
    { path: "/reports", label: "Informes", icon: <FileText size={18} /> },
  ];

  // Sección de gestión de flota
  const vehicleLinks = [
    { path: "/mapa/lista-vehiculos", label: "Lista de Vehículos", icon: <ListChecks size={18} /> },
    { path: "/mapa/asignar-ruta", label: "Asignar Ruta", icon: <MapPin size={18} /> },
    { path: "/mapa/nuevo-vehiculo", label: "Añadir Vehículo", icon: <Car size={18} /> },
  ];

  // función helper para marcar activo (por si usás subrutas)
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="sidebar-dashboard">
      <nav className="sidebar-nav">
        {/* Sección de Vehículos (Nueva) */}
        <ul>
          <li
            style={{
              padding: "12px 20px",
              color: "#999",
              fontSize: "0.9em",
              fontWeight: "600",
            }}
          >
            GESTIÓN DE FLOTA
          </li>
          {vehicleLinks.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`sidebar-link ${isActive(link.path) ? "active" : ""}`}
              >
                {link.icon}
                <span className="sidebar-label">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Separador */}
        <hr
          style={{
            margin: "15px 0",
            border: "none",
            borderTop: "1px solid #f0f0f0",
          }}
        />

        {/* Links Estándar */}
        <ul>
          {sidebarLinks.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`sidebar-link ${isActive(link.path) ? "active" : ""}`}
              >
                {link.icon}
                <span className="sidebar-label">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Botón de Logout */}
        <ul style={{ marginTop: "auto" }}>
          <li>
            <button
              onClick={handleLogout}
              className="sidebar-link"
              style={{
                width: "100%",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
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

export default MapSidebar;
