import React, { useState, useEffect } from "react"; 
import { Link, useLocation } from "react-router-dom";
import "../styles/Home.css"; 
import { Box, TrendingUp, Users, Clipboard, FileText, Shield, ShieldAlert, DollarSign, QrCode } from "lucide-react"; 
import QRAsistenciaModal from "../components/QrAsistenciaModal"; 
// Importamos la función mejorada
import { getUser } from "../utils/auth"; 

const Home = () => {
  const location = useLocation();
  
  // 1. RECUPERACIÓN ROBUSTA DEL USUARIO
  // Usamos un estado para asegurar que el componente se renderice con los datos
  const [currentUser, setCurrentUser] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [showQR, setShowQR] = useState(false);

  // Recuperamos datos básicos para el saludo (SessionStorage suele ser rápido)
  const fullName = sessionStorage.getItem("user_nombre") || "Usuario";
  const userRole = sessionStorage.getItem("user_rol") || "";
  const [firstName = "", lastName = ""] = fullName.split(" ");

 // En Home.jsx - dentro del useEffect
useEffect(() => {
    // A. Obtener Usuario Real (decodificando token)
    const usuarioSeguro = getUser();
    console.log("DEBUG HOME -> Usuario recuperado:", usuarioSeguro);
    
    if (usuarioSeguro && usuarioSeguro.ID_USUARIO) {
        setCurrentUser(usuarioSeguro);
    } else {
        console.warn("⚠️ No se pudo recuperar el ID del usuario desde el token.");
        // Si no hay usuario, redirige al login
        sessionStorage.clear();
        window.location.href = '/login';
    }

    // B. Obtener Permisos
    try {
      const storedPermisos = sessionStorage.getItem("user_permissions");
      if (storedPermisos) setPermisos(JSON.parse(storedPermisos));
    } catch (error) {
      console.error("Error cargando permisos:", error);
    }
}, []);

  const can = (permiso) => userRole === "Master_Admin" || permisos.includes(permiso);

  const floatingButtonStyle = {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    width: '70px',
    height: '70px',
    background: 'linear-gradient(135deg, #005bea, #00c6fb)',
    borderRadius: '50%',
    border: 'none',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 999999, 
    color: 'white'
  };

  return (
    <> 
      <div className="home-dashboard fade-in">
        {location.state?.message && (
          <p className="msg-error" style={{ marginBottom: '1.5rem', backgroundColor: '#f8d7da', color: '#842029', padding: '10px', borderRadius: '5px' }}>
            {location.state.message}
          </p>
        )}

        <div className="home-header">
          <div className="header-titles">
              <h1>Gestión de Depósito</h1>
              <p className="subtitle">Bienvenido, {firstName} {lastName}.</p>
          </div>
        </div>
        
        <br />
        
        {userRole !== "Master_Admin" && permisos.length === 0 ? (
           <div style={{textAlign: 'center', marginTop: '40px', color: '#666', background: '#f3f4f6', padding: '30px', borderRadius: '10px'}}>
              <ShieldAlert size={48} style={{marginBottom: '10px', color: '#ef4444'}}/>
              <h3>Sin Permisos Asignados</h3>
           </div>
        ) : (
          <div className="dashboard-content-grid">
            {can("ver_mapa") && (
              <div className="card card-mapa">
                <div className="card-header"><FileText size={30} className="card-main-icon" /><h3>Mapa</h3></div>
                <p>Monitoreo en tiempo real.</p>
                <Link to="/Mapa" className="card-button primary">Ver Mapa</Link>
              </div>
            )}
            
            {/* ... TUS OTRAS TARJETAS ... */}
            {can("gestion_gastos") && (
              <div className="card card-pag2">
                <div className="card-header"><DollarSign size={30} className="card-main-icon" /><h3>Gastos</h3></div>
                <p>Gestión de gastos.</p>
                <Link to="/gastos" className="card-button secondary">Ver Gastos</Link>
              </div>
            )}

             {can("gestion_materiales") && (
              <div className="card card-materiales">
                <div className="card-header"><Box size={30} className="card-main-icon" /><h3>Materiales</h3></div>
                <p>Control de stock.</p>
                <Link to="/materiales" className="card-button tertiary">Inventario</Link>
              </div>
            )}

            {can("gestion_movimientos") && (
              <div className="card card-movimientos">
                <div className="card-header"><TrendingUp size={30} className="card-main-icon" /><h3>Movimientos</h3></div>
                <p>Entradas y salidas.</p>
                <Link to="/movimientos" className="card-button quaternary">Registrar</Link>
              </div>
            )}

            {can("gestion_empleados") && (
              <div className="card card-empleados">
                <div className="card-header"><Users size={30} className="card-main-icon" /><h3>Empleados</h3></div>
                <p>Gestión de usuarios.</p>
                <Link to="/empleados" className="card-button quinary">Ver Empleados</Link>
              </div>
            )}

            <div className="card card-ordenes">
              <div className="card-header"><Clipboard size={30} className="card-main-icon" /><h3>Órdenes</h3></div>
              <p>Tareas asignadas.</p>
              <Link to="/ordenes-trabajo" className="card-button senary">Ver Órdenes</Link>
            </div>

            {can("gestion_roles") && (
              <div className="card" style={{gridColumn: '1 / -1', borderLeft: '5px solid #333'}}>
                <div className="card-header"><Shield size={30} className="card-main-icon" /><h3>Roles</h3></div>
                <p>Administrar accesos.</p>
                <Link to="/roles" className="card-button primary">Administrar</Link>
              </div>
            )}
          </div>
        )}
      </div>

      <button 
        style={floatingButtonStyle} 
        onClick={() => setShowQR(true)}
        title="Fichar Asistencia"
      >
        <QrCode size={32} strokeWidth={2.5} />
      </button>

      {/* RENDERIZADO DEL MODAL CON EL USUARIO SEGURO */}
      {showQR && (
        <QRAsistenciaModal 
            onClose={() => setShowQR(false)} 
            user={currentUser} 
        />
      )}
    </>
  );
};

export default Home;