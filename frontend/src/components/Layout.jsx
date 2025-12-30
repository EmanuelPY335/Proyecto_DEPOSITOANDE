// src/components/Layout.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar"; 
import NotificationMenu from "./NotificationMenu"; 
import "../styles/Home.css"; 
import { Settings, UserCircle } from "lucide-react";

const DashboardNavbar = () => {
  const [userName] = useState(sessionStorage.getItem("user_nombre") || "Usuario");
  return (
    <nav className="navbar-dashboard">
      <div className="navbar-left">
        <Settings size={24} className="navbar-logo-icon" />
        <span className="navbar-brand-title">SISDEPO</span>
      </div>
      <div className="navbar-right">
        <NotificationMenu />
        <Link to="/profile" className="navbar-profile-link">
          <UserCircle size={28} className="profile-icon" />
          <span className="profile-name">{userName}</span>
        </Link>
      </div>
    </nav>
  );
};

// MODIFICACIÓN AQUÍ: Agregamos la prop 'fullWidth'
const Layout = ({ children, fullWidth = false }) => {
  return (
    <div className="dashboard-layout">
      <DashboardNavbar />
      <div className="main-area">
        {/* Solo mostramos el Sidebar si fullWidth es falso */}
        {!fullWidth && <Sidebar />}
        
        {/* Ajustamos el estilo si es pantalla completa */}
        <div 
            className="content-dashboard" 
            style={fullWidth ? { width: '100%', maxWidth: '100%', margin: '0 auto', padding: '20px 40px' } : {}}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;