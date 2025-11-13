// src/components/Layout.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar"; // Importamos el Sidebar que ya tienes
import "../styles/Home.css"; // Reusamos los estilos del Navbar de Home.css
import { Settings, Bell, UserCircle } from "lucide-react";

// 1. Definimos el Navbar aquí una sola vez
const DashboardNavbar = () => {
  // Obtenemos el nombre del sessionStorage
  const [userName] = useState(sessionStorage.getItem("user_nombre") || "Usuario");
  const notificationCount = 0;

  return (
    <nav className="navbar-dashboard">
      <div className="navbar-left">
        <Settings size={24} className="navbar-logo-icon" />
        <span className="navbar-brand-title">SISDEPO</span>
      </div>
      <div className="navbar-right">
        <div className="notification-icon-wrapper">
          <Bell size={20} />
          {notificationCount > 0 && (
            <span className="notification-badge">{notificationCount}</span>
          )}
        </div>
        <Link to="/profile" className="navbar-profile-link">
          <UserCircle size={28} className="profile-icon" />
          <span className="profile-name">{userName}</span>
        </Link>
      </div>
    </nav>
  );
};

// 2. Este es el componente Layout
// Recibe la página que debe mostrar (props.children)
const Layout = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <DashboardNavbar />
      <div className="main-area">
        <Sidebar />
        <div className="content-dashboard">
          {/* 3. Aquí se renderiza la página (Home, Profile, Roles, etc.) */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;