// Home.jsx - REVISADO
import React from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar"; 
import "../styles/Home.css"; 
import { 
  Settings, Bell, UserCircle, 
  Box, TrendingUp, Users, Clipboard, FileText, Layers 
  // --- CAMBIO: 'Archive' (Proveedores) eliminado, 'Clipboard' (Órdenes) ya estaba ---
} from "lucide-react"; 

const Home = () => {
  const userName = "Oscar Báez"; // Simulación
  const notificationCount = 99; // Simulación

  // (Componente DashboardNavbar sin cambios)
  const DashboardNavbar = () => (
    <nav className="navbar-dashboard">
      <div className="navbar-left">
        <Settings size={24} className="navbar-logo-icon" />
        <span className="navbar-brand-title">SISDEPO</span>
      </div>
      <div className="navbar-right"> 
        <div className="notification-icon-wrapper">
          <Bell size={20} />
          {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
        </div>
        <Link to="/profile" className="navbar-profile-link">
          <UserCircle size={28} className="profile-icon" />
          <span className="profile-name">{userName}</span>
        </Link>
      </div>
    </nav>
  );

  // (Componente DashboardCards CON CAMBIOS)
  const DashboardCards = () => (
    <div className="dashboard-content-grid">
      
      {/* Fila 1 */}
      {/* --- CAMBIO: Tarjeta 1 actualizada para el Mapa GPS --- */}
      <div className="card card-pag1">
        <div className="card-header">
          <FileText size={30} className="card-main-icon" />
          <h3>Mapa de Vehículos</h3>
        </div>
        <p>Monitoreo en tiempo real de la flota.</p>
        <Link to="/pag1" className="card-button primary">Ver Mapa</Link>
      </div>

      {/* Tarjeta 2: Pag2.jsx (Sin cambios) */}
      <div className="card card-pag2">
        <div className="card-header">
          <Layers size={30} className="card-main-icon" />
          <h3>Pag2.jsx</h3>
        </div>
        <p>Administra configuraciones y detalles.</p>
        <Link to="/pag2" className="card-button secondary">Ir a Página 2</Link>
      </div>
      
      {/* Tarjeta 3: Materiales (Sin cambios) */}
      <div className="card card-materiales">
        <div className="card-header">
          <Box size={30} className="card-main-icon" />
          <h3>Materiales</h3>
        </div>
        <p>Control de stock actualizado y gestión de inventario.</p>
        <Link to="/materiales" className="card-button tertiary">Ver Inventario</Link>
      </div>
      
      {/* Fila 2 */}
      {/* Tarjeta 4: Movimientos (Sin cambios) */}
      <div className="card card-movimientos">
        <div className="card-header">
          <TrendingUp size={30} className="card-main-icon" />
          <h3>Movimientos</h3>
        </div>
        <p>Registro de entradas y salidas del depósito.</p>
        <Link to="/movimientos" className="card-button quaternary">Registrar</Link>
      </div>

      {/* Tarjeta 5: Empleados (Sin cambios) */}
      <div className="card card-empleados">
        <div className="card-header">
          <Users size={30} className="card-main-icon" />
          <h3>Empleados</h3>
        </div>
        <p>Gestión de usuarios y accesos al sistema.</p>
        <Link to="/empleados" className="card-button quinary">Gestionar</Link>
      </div>

      {/* --- CAMBIO: Tarjeta 6 'Proveedores' reemplazada por 'Órdenes de Trabajo' --- */}
      <div className="card card-ordenes"> {/* Clase CSS opcional nueva */}
        <div className="card-header">
          <Clipboard size={30} className="card-main-icon" />
          <h3>Órdenes de Trabajo</h3>
        </div>
        <p>Asignar y monitorear tareas del personal.</p>
        <Link to="/ordenes-trabajo" className="card-button senary">Ver Órdenes</Link>
      </div>

    </div>
  );

  return (
    <div className="dashboard-layout">
      <DashboardNavbar />
      <div className="main-area">
        <Sidebar />
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