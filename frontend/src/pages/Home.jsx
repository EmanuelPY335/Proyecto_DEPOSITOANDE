import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Home as HomeIcon, FileText, Layers, Menu } from "lucide-react";
import "../styles/Home.css";

const Home = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const navLinks = [
    { path: "/home", label: "Inicio", icon: <HomeIcon size={18} /> },
    { path: "/pag1", label: "Página 1", icon: <FileText size={18} /> },
    { path: "/pag2", label: "Página 2", icon: <Layers size={18} /> },
  ];

  return (
    <div className="home-container">
      {/* Navbar para PC */}
      <nav className="navbar">
        <div className="logo">Mi App</div>
        <ul className="nav-links">
          {navLinks.map((link) => (
            <li key={link.path}>
              <Link to={link.path}>
                {link.icon} {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <button className="menu-btn" onClick={toggleSidebar}>
          <Menu size={24} />
        </button>
      </nav>

      {/* Sidebar para móvil */}
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <ul>
          {navLinks.map((link) => (
            <li key={link.path} onClick={toggleSidebar}>
              <Link to={link.path}>
                {link.icon} {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Contenido principal */}
      <div className="content">
        <h1>Bienvenido a la Home</h1>
        <p>Aquí va el contenido principal.</p>
              {/* Card historial */}

        <div className="cards-container">
          <div className="card">
            <h3>📊 Reportes</h3>
            <p>Consulta estadísticas en tiempo real.</p>
          </div>
          <div className="card">
            <h3>⚙️ Configuración</h3>
            <p>Administra usuarios y permisos.</p>
          </div>
          <div className="card">
            <h3>📦 Inventario</h3>
            <p>Control de stock actualizado.</p>
          </div>
          <div className="card">
            <h3>📝 Tareas</h3>
            <p>Organiza y gestiona actividades.</p>
          </div>
        </div>
      </div>
             {/* Card historial */}
        <div className="card historial">
          <h3>📜 Historial</h3>
          <p>Aquí se mostrarán las últimas actividades.</p>
        </div>
    </div>
  );
};

export default Home;
