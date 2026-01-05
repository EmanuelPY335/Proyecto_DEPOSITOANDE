// src/pages/Home.jsx
import React, { useState, useEffect } from "react"; 
import { Link, useLocation } from "react-router-dom";
import "../styles/Home.css"; 
import { 
  Box, TrendingUp, Users, Clipboard, FileText,Shield, ShieldAlert,DollarSign
} from "lucide-react"; 

const Home = () => {
  const fullName = sessionStorage.getItem("user_nombre") || "Usuario";
  const [firstName = "", lastName = ""] = fullName.split(" ");
  const userRole = sessionStorage.getItem("user_rol") || "";
  const location = useLocation();

  const [permisos, setPermisos] = useState([]);

  useEffect(() => {
    try {
      // Recuperamos los permisos que LoginForm guardó
      const storedPermisos = sessionStorage.getItem("user_permissions");
      if (storedPermisos) {
        setPermisos(JSON.parse(storedPermisos));
      }
    } catch (error) {
      console.error("Error cargando permisos:", error);
    }
  }, []);

  // Función Helper: ¿Tiene permiso? (Master Admin siempre puede)
  const can = (permisoRequerido) => {
    if (userRole === "Master_Admin") return true; 
    return permisos.includes(permisoRequerido);
  };

  return (
    <div className="home-dashboard fade-in">
      {/* Mensajes de error/info que vienen de redirecciones */}
      {location.state?.message && (
        <p className="msg-error" style={{ marginBottom: '1.5rem', backgroundColor: '#f8d7da', color: '#842029', padding: '10px', borderRadius: '5px' }}>
          {location.state.message}
        </p>
      )}

      <h1>Gestión de Depósito</h1>
      <p className="subtitle">Bienvenido, {firstName} {lastName}.</p>
      <br />
      
      {/* Si el usuario NO es Master Admin Y la lista de permisos está vacía,
         asumimos que no tiene acceso a nada.
      */}
      {userRole !== "Master_Admin" && permisos.length === 0 ? (
         <div style={{textAlign: 'center', marginTop: '40px', color: '#666', background: '#f3f4f6', padding: '30px', borderRadius: '10px'}}>
            <ShieldAlert size={48} style={{marginBottom: '10px', color: '#ef4444'}}/>
            <h3>Sin Permisos Asignados</h3>
            <p>Tu usuario tiene el rol <strong>{userRole}</strong> pero no tiene permisos habilitados.</p>
            <p style={{fontSize: '0.9em', marginTop: '10px'}}>Contacta al administrador para configurar tu acceso.</p>
         </div>
      ) : (
        <div className="dashboard-content-grid">
          
          {/* TARJETAS CON PERMISOS DINÁMICOS */}
          
          {can("ver_mapa") && (
            <div className="card card-mapa">
              <div className="card-header">
                <FileText size={30} className="card-main-icon" />
                <h3>Mapa de Vehículos</h3>
              </div>
              <p>Monitoreo en tiempo real de la flota.</p>
              <Link to="/Mapa" className="card-button primary">Ver Mapa</Link>
            </div>
          )}

          {can("gestion_movimientos") && (
          <div className="card card-pag2">
            <div className="card-header">
              {/* Cambiamos Layers por DollarSign para consistencia visual */}
              <DollarSign size={30} className="card-main-icon" />
              <h3>Gestionar Gastos</h3>
            </div>
            <p>Gestión de gastos dentro del depósito.</p>
            {/* Corregimos la ruta: de /pag2 a /gastos */}
            <Link to="/gastos" className="card-button secondary">Ver Gastos</Link>
          </div>
          )}

          {can("gestion_materiales") && (
            <div className="card card-materiales">
              <div className="card-header">
                <Box size={30} className="card-main-icon" />
                <h3>Materiales</h3>
              </div>
              <p>Control de stock actualizado y gestión de inventario.</p>
              <Link to="/materiales" className="card-button tertiary">Ver Inventario</Link>
            </div>
          )}

          {can("gestion_movimientos") && (
            <div className="card card-movimientos">
              <div className="card-header">
                <TrendingUp size={30} className="card-main-icon" />
                <h3>Movimientos</h3>
              </div>
              <p>Registro de entradas y salidas del depósito.</p>
              <Link to="/movimientos" className="card-button quaternary">Registrar</Link>
            </div>
          )}

          {can("gestion_empleados") && (
            <div className="card card-empleados">
              <div className="card-header">
                <Users size={30} className="card-main-icon" />
                <h3>Empleados</h3>
              </div>
              <p>Gestión de usuarios y accesos al sistema.</p>
              <Link to="/empleados" className="card-button quinary">Ver Empleados</Link>
            </div>
          )}

          {/* ELIMINAMOS EL {can(...)} QUE ENVOLVÍA ESTO */}
          <div className="card card-ordenes">
            <div className="card-header">
              <Clipboard size={30} className="card-main-icon" />
              <h3>Órdenes de Trabajo</h3>
            </div>
            <p>Ver mis tareas asignadas y reportar avances.</p>
            <Link to="/ordenes-trabajo" className="card-button senary">Ver Órdenes</Link>
          </div>
         

          {/* Gestión de Roles: Solo Master Admin o quien tenga el permiso explícito */}
          {can("gestion_roles") && (
            <div className="card" style={{gridColumn: '1 / -1', borderLeft: '5px solid #333'}}>
              <div className="card-header">
                <Shield size={30} className="card-main-icon" />
                <h3>Roles y Permisos</h3>
              </div>
              <p>Asigná o cambiá los roles de los usuarios.</p>
              <Link to="/roles" className="card-button primary">Administrar Roles</Link>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default Home;