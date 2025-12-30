// src/pages/Roles.jsx
import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { 
  Shield, Lock, UserCog, Plus, Save, ShieldAlert
} from "lucide-react";
import "../styles/Roles.css";

const API_URL = "http://127.0.0.1:5000";

const Roles = () => {
  const [roles, setRoles] = useState([]);
  const [permisosDisponibles, setPermisosDisponibles] = useState([]);
  const [selectedRol, setSelectedRol] = useState(null);
  const [permisosAsignados, setPermisosAsignados] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Estado para crear rol
  const [showNewRol, setShowNewRol] = useState(false);
  const [newRolName, setNewRolName] = useState("");

  // 1. OBTENER EL ROL ACTUAL DEL USUARIO
  const currentUserRole = sessionStorage.getItem("user_rol");

  // 2. DEFINIR QUIÉN PUEDE ENTRAR AQUÍ
  // Generalmente, solo el Master_Admin debería tocar roles y permisos.
  const ALLOWED_ROLES = ["Master_Admin", "Admin"]; 

  useEffect(() => {
    // Solo cargamos datos si el usuario tiene permiso
    if (ALLOWED_ROLES.includes(currentUserRole)) {
        loadInitialData();
    } else {
        setLoading(false);
    }
    // eslint-disable-next-line
  }, []);

  const loadInitialData = async () => {
    try {
      const [rolesData, permisosData] = await Promise.all([
        apiFetch(`${API_URL}/api/roles`),
        apiFetch(`${API_URL}/api/permisos`)
      ]);
      setRoles(rolesData || []);
      setPermisosDisponibles(permisosData || []);
      
      if (rolesData && rolesData.length > 0) {
        handleSelectRol(rolesData[0]);
      }
    } catch (error) {
      console.error("Error cargando roles:", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. BLOQUEO DE SEGURIDAD (Renderizado Condicional)
  if (!ALLOWED_ROLES.includes(currentUserRole)) {
    return (
        <div className="fade-in" style={{
            display:'flex', 
            flexDirection: 'column', 
            justifyContent:'center', 
            alignItems:'center', 
            height:'60vh', 
            color:'#4b5563',
            textAlign: 'center'
        }}>
            <ShieldAlert size={64} style={{color:'#ef4444', marginBottom: 20}} />
            <h1>Acceso Restringido</h1>
            <p>La configuración de Roles y Permisos es exclusiva del <strong>Master Admin</strong>.</p>
        </div>
    );
  }

  const handleSelectRol = async (rol) => {
    setSelectedRol(rol);
    try {
      const assignedIds = await apiFetch(`${API_URL}/api/roles/${rol.id}/permisos`);
      setPermisosAsignados(assignedIds || []);
    } catch (error) {
      console.error(error);
      setPermisosAsignados([]);
    }
  };

  const togglePermiso = (idPermiso) => {
    if (permisosAsignados.includes(idPermiso)) {
      setPermisosAsignados(permisosAsignados.filter(id => id !== idPermiso));
    } else {
      setPermisosAsignados([...permisosAsignados, idPermiso]);
    }
  };

  const saveConfiguration = async () => {
    if (!selectedRol) return;
    try {
      await apiFetch(`${API_URL}/api/roles/${selectedRol.id}/permisos`, {
        method: "PUT",
        body: JSON.stringify({ permisos: permisosAsignados })
      });
      alert(`Permisos actualizados para ${selectedRol.nombre}`);
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  const handleCreateRol = async (e) => {
    e.preventDefault();
    if (!newRolName.trim()) return;
    try {
      await apiFetch(`${API_URL}/api/roles`, {
        method: "POST",
        body: JSON.stringify({ nombre: newRolName, descripcion: "Rol personalizado" })
      });
      setShowNewRol(false);
      setNewRolName("");
      loadInitialData(); 
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    // Quitamos los divs de layout duplicados
    <div className="fade-in" style={{width: '100%'}}>
       
       <div className="roles-container">
           {/* --- PANEL IZQUIERDO: LISTA DE ROLES --- */}
           <div className="roles-sidebar">
               <div className="sidebar-header">
                   <h2><Shield size={22}/> Roles</h2>
                   <button className="btn-add-mini" onClick={() => setShowNewRol(true)} title="Crear Rol">
                       <Plus size={18}/>
                   </button>
               </div>

               {showNewRol && (
                   <form onSubmit={handleCreateRol} className="new-rol-form fade-in">
                       <input 
                           autoFocus
                           type="text" 
                           placeholder="Nombre del Rol..." 
                           value={newRolName}
                           onChange={(e) => setNewRolName(e.target.value)}
                       />
                       <div className="form-mini-actions">
                           <button type="button" onClick={() => setShowNewRol(false)} className="btn-cancel">✕</button>
                           <button type="submit" className="btn-confirm">✓</button>
                       </div>
                   </form>
               )}

               <div className="roles-list">
                   {loading ? <p className="loading-text">Cargando...</p> : 
                    roles.map(rol => (
                       <div 
                           key={rol.id} 
                           className={`rol-item ${selectedRol?.id === rol.id ? 'active' : ''}`}
                           onClick={() => handleSelectRol(rol)}
                       >
                           <UserCog size={18}/>
                           <span>{rol.nombre}</span>
                           {rol.nombre === "Master_Admin" && <Lock size={14} className="lock-icon"/>}
                       </div>
                   ))}
               </div>
           </div>

           {/* --- PANEL DERECHO: MATRIZ DE PERMISOS --- */}
           <div className="roles-main">
               {selectedRol ? (
                   <>
                       <div className="config-header">
                           <div>
                               <h1>Configurando: <span className="highlight-rol">{selectedRol.nombre}</span></h1>
                               <p>Define qué puede hacer este usuario en el sistema.</p>
                           </div>
                           <button className="btn-save-config" onClick={saveConfiguration}>
                               <Save size={18}/> Guardar Cambios
                           </button>
                       </div>

                       <div className="permissions-grid">
                           {permisosDisponibles.map(permiso => {
                               const isActive = permisosAsignados.includes(permiso.id);
                               return (
                                   <div 
                                       key={permiso.id} 
                                       className={`permiso-card ${isActive ? 'active' : ''}`}
                                       onClick={() => togglePermiso(permiso.id)}
                                   >
                                       <div className="permiso-info">
                                           <h4>{permiso.nombre.replace(/_/g, " ")}</h4>
                                           <p>{permiso.descripcion}</p>
                                       </div>
                                       <div className={`toggle-switch ${isActive ? 'on' : 'off'}`}>
                                           <div className="toggle-knob"></div>
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   </>
               ) : (
                   <div className="empty-selection">
                       <UserCog size={64} style={{opacity: 0.2}}/>
                       <p>Selecciona un rol de la izquierda para editar sus permisos.</p>
                   </div>
               )}
           </div>
       </div>
    </div>
  );
};

export default Roles;