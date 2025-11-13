// Home.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
// --- CAMBIO: Ya no se importa Sidebar ---
import "../styles/Home.css"; 
import { 
  // --- CAMBIO: Ya no se importan Settings, Bell, UserCircle ---
  Box, TrendingUp, Users, Clipboard, FileText, Layers, Shield
} from "lucide-react"; 

const Home = () => {
  const fullName = sessionStorage.getItem("user_nombre") || "Usuario";
  const [firstName = "", lastName = ""] = fullName.split(" ");
  const userRole = sessionStorage.getItem("user_rol") || "";
  const location = useLocation();
// Obtener nombre y apellido corto


  // --- CAMBIO: Eliminamos el componente DashboardNavbar (ya está en Layout) ---

  const DashboardCards = () => (
    <div className="dashboard-content-grid">
      {/* 1) Mapa */}
      <div className="card card-mapa">
        <div className="card-header">
          <FileText size={30} className="card-main-icon" />
          <h3>Mapa de Vehículos</h3>
        </div>
        <p>Monitoreo en tiempo real de la flota.</p>
        <Link to="/Mapa" className="card-button primary">Ver Mapa</Link>
      </div>

      {/* 2) Gastos */}
      <div className="card card-pag2">
        <div className="card-header">
          <Layers size={30} className="card-main-icon" />
          <h3>Gestionar Gastos</h3>
        </div>
        <p>Gestión de gastos dentro del depósito.</p>
        <Link to="/pag2" className="card-button secondary">Ver Gastos</Link>
      </div>

      {/* 3) Materiales */}
      <div className="card card-materiales">
        <div className="card-header">
          <Box size={30} className="card-main-icon" />
          <h3>Materiales</h3>
        </div>
        <p>Control de stock actualizado y gestión de inventario.</p>
        <Link to="/materiales" className="card-button tertiary">Ver Inventario</Link>
      </div>

      {/* 4) Movimientos */}
      <div className="card card-movimientos">
        <div className="card-header">
          <TrendingUp size={30} className="card-main-icon" />
          <h3>Movimientos</h3>
        </div>
        <p>Registro de entradas y salidas del depósito.</p>
        <Link to="/movimientos" className="card-button quaternary">Registrar</Link>
      </div>

      {/* 5) Empleados */}
      <div className="card card-empleados">
        <div className="card-header">
          <Users size={30} className="card-main-icon" />
          <h3>Empleados</h3>
        </div>
        <p>Gestión de usuarios y accesos al sistema.</p>
        <Link to="/empleados" className="card-button quinary">Ver Empleados</Link>
      </div>

      {/* 6) Órdenes */}
      <div className="card card-ordenes">
        <div className="card-header">
          <Clipboard size={30} className="card-main-icon" />
          <h3>Órdenes de Trabajo</h3>
        </div>
        <p>Asignar y monitorear tareas del personal.</p>
        <Link to="/ordenes-trabajo" className="card-button senary">Ver Órdenes</Link>
      </div>

      {/* ✅ 7) SOLO GERENTE: Roles y Permisos */}
      {(userRole === "Admin" || userRole === "Master_Admin") && (
        <div className="card" style={{gridColumn: '1 / -1'}}>
          <div className="card-header">
            <Shield size={30} className="card-main-icon" />
            <h3>Roles y Permisos</h3>
          </div>
          <p>Asigná o cambiá los roles de los usuarios.</p>
          <Link to="/roles" className="card-button primary">Administrar Roles</Link>
        </div>
      )}
    </div>
  );

  // --- CAMBIO: El return es mucho más simple ---
  return (
    // El Layout ya provee el <div className="content-dashboard">
    <>
      {/* Muestra el mensaje de error si existe (de App.jsx) */}
      {location.state?.message && (
        <p 
          className="msg-error" 
          style={{ 
            marginBottom: '1.5rem', 
            backgroundColor: '#f8d7da', // Estilos para asegurar visibilidad
            color: '#842029', 
            padding: '10px', 
            borderRadius: '5px' 
          }}
        >
          {location.state.message}
        </p>
      )}

      <h1>Gestión de Depósito</h1>
      <p className="subtitle">Bienvenido, {firstName} {lastName}.</p>

      <DashboardCards />
    </>
  );
};

export default Home;