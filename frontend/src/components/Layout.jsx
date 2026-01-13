// src/components/Layout.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Settings, UserCircle } from "lucide-react";
import Sidebar from "./Sidebar"; 
import NotificationMenu from "./NotificationMenu"; // <--- ¿ESTÁ ESTO AQUÍ?
import "../styles/Home.css"; 

// Navbar Interno
const DashboardNavbar = () => {
  const [userName] = useState(sessionStorage.getItem("user_nombre") || "Usuario");
  console.log("Renderizando Navbar..."); // DEBUG: Mira la consola F12

  return (
    <nav className="navbar-dashboard">
      <div className="navbar-left">
        <Settings size={24} className="navbar-logo-icon" />
        <span className="navbar-brand-title">SISDEPO</span>
      </div>
      
      <div className="navbar-right">
        {/* LA CAMPANA ESTÁ AQUÍ */}
        <NotificationMenu />
        
        <Link to="/profile" className="navbar-profile-link">
          <UserCircle size={28} className="profile-icon" />
          <span className="profile-name">{userName}</span>
        </Link>
      </div>
    </nav>
  );
};

const Layout = ({ children, fullWidth = false }) => {
  return (
    <div className="dashboard-layout">
      {/* Navbar arriba */}
      <DashboardNavbar />
      
      <div className="main-area">
        {!fullWidth && <Sidebar />}
        <div 
            className="content-dashboard" 
            style={fullWidth ? { width: '100%', maxWidth: '100%', padding: 0 } : {}}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;