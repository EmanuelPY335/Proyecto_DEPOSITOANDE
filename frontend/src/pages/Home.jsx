// Home.jsx - REVISADO
import React from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar"; // Se importa el Sidebar
import "../styles/Home.css"; // Usa el Home.css (estilos ajustados)
// Íconos de lucide-react:
import { 
  Settings, Bell, UserCircle, Search, 
  Box, TrendingUp, Users, Clipboard, FileText, Layers, Archive 
} from "lucide-react"; 

const Home = () => {
  // Simulación de datos para el Navbar
  const userName = "Oscar Báez";
  const notificationCount = 99;

  // Componente Navbar: Se mueve dentro para simplificar la composición
  const DashboardNavbar = () => (
    <nav className="navbar-dashboard">
      <div className="navbar-left">
        {/* Superior Izquierda: SISDEPO */}
        <Settings size={24} className="navbar-logo-icon" />
        <span className="navbar-brand-title">SISDEPO</span>
      </div>

      <div className="navbar-right"> 
        {/* Campanita de Notificaciones */}
        <div className="notification-icon-wrapper">
          <Bell size={20} />
          {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
        </div>
        
        {/* Perfil del Usuario con Nombre */}
        <Link to="/profile" className="navbar-profile-link">
          <UserCircle size={28} className="profile-icon" />
          <span className="profile-name">{userName}</span>
        </Link>
      </div>
    </nav>
  );

  // Componente de Tarjetas 2x3
  const DashboardCards = () => (
    <div className="dashboard-content-grid">
      
      {/* Fila 1 */}
      {/* Tarjeta 1: Pag1.jsx */}
      <div className="card card-pag1">
        <div className="card-header">
          <FileText size={30} className="card-main-icon" />
          <h3>Pag1.jsx</h3>
        </div>
        <p>Ver y resumir tus datos principales.</p>
        <Link to="/pag1" className="card-button primary">Ir a Página 1</Link>
      </div>

      {/* Tarjeta 2: Pag2.jsx */}
      <div className="card card-pag2">
        <div className="card-header">
          <Layers size={30} className="card-main-icon" />
          <h3>Pag2.jsx</h3>
        </div>
        <p>Administra configuraciones y detalles.</p>
        <Link to="/pag2" className="card-button secondary">Ir a Página 2</Link>
      </div>
      
      {/* Tarjeta 3: Materiales (Nuevo) */}
      <div className="card card-materiales">
        <div className="card-header">
          <Box size={30} className="card-main-icon" />
          <h3>Materiales</h3>
        </div>
        <p>Control de stock actualizado y gestión de inventario.</p>
        <Link to="/materiales" className="card-button tertiary">Ver Inventario</Link>
      </div>
      
      {/* Fila 2 */}
      {/* Tarjeta 4: Movimientos (Nuevo) */}
      <div className="card card-movimientos">
        <div className="card-header">
          <TrendingUp size={30} className="card-main-icon" />
          <h3>Movimientos</h3>
        </div>
        <p>Registro de entradas y salidas del depósito.</p>
        <Link to="/movimientos" className="card-button quaternary">Registrar</Link>
      </div>

      {/* Tarjeta 5: Empleados (Nuevo) */}
      <div className="card card-empleados">
        <div className="card-header">
          <Users size={30} className="card-main-icon" />
          <h3>Empleados</h3>
        </div>
        <p>Gestión de usuarios y accesos al sistema.</p>
        <Link to="/empleados" className="card-button quinary">Gestionar</Link>
      </div>

      {/* Tarjeta 6: Proveedores (Nuevo) */}
      <div className="card card-proveedores">
        <div className="card-header">
          <Archive size={30} className="card-main-icon" />
          <h3>Proveedores</h3>
        </div>
        <p>Administra la lista de proveedores y contactos.</p>
        <Link to="/proveedores" className="card-button senary">Ver Lista</Link>
      </div>

    </div>
  );

  return (
    <div className="dashboard-layout">
      <DashboardNavbar />
      
      {/* Contenedor principal con Sidebar y Contenido */}
      <div className="main-area">
        <Sidebar /> {/* Sidebar fijo en la izquierda */}
        
        <div className="content-dashboard">
          <h1>Gestión de Depósito</h1>
          <p className="subtitle">Bienvenido, {userName}.</p>
          
          <DashboardCards />
        </div>
      </div>
    </div>
  );
};

export default Home;