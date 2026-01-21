// src/pages/Roles.jsx
import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { 
  Shield, Lock, UserCog, Plus, Save, ShieldAlert, 
  Edit, Trash2, Check, X
} from "lucide-react";
import "../styles/Roles.css";

const API_URL = "http://127.0.0.1:5000";

const Roles = () => {
  const [roles, setRoles] = useState([]);
  const [permisosDisponibles, setPermisosDisponibles] = useState([]);
  const [selectedRol, setSelectedRol] = useState(null);
  const [permisosAsignados, setPermisosAsignados] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Estados para crear/editar rol
  const [showNewRol, setShowNewRol] = useState(false);
  const [newRolName, setNewRolName] = useState("");
  
  // Estados para editar rol existente
  const [editingRol, setEditingRol] = useState(null);
  const [editRolName, setEditRolName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const currentUserRole = sessionStorage.getItem("user_rol");
  const userPermissions = JSON.parse(sessionStorage.getItem("user_permissions") || "[]");

  const puedeGestionarRoles = () => {
    if (currentUserRole === "Master_Admin") return true;
    return userPermissions.includes("gestion_roles");
  };

  useEffect(() => {
    if (puedeGestionarRoles()) {
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
      
      let rolesFiltrados = rolesData || [];
      if (currentUserRole !== "Master_Admin") {
        rolesFiltrados = rolesFiltrados.filter(rol => rol.nombre !== "Master_Admin");
      }
      
      setRoles(rolesFiltrados);
      setPermisosDisponibles(permisosData || []);
      
      if (rolesFiltrados.length > 0) {
        handleSelectRol(rolesFiltrados[0]);
      }
    } catch (error) {
      console.error("Error cargando roles:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!puedeGestionarRoles()) {
    return (
        <div className="fade-in" style={{textAlign: 'center', padding: '50px', color:'#4b5563'}}>
            <ShieldAlert size={64} style={{color:'#ef4444', marginBottom: 20}} />
            <h1>Acceso Restringido</h1>
            <p>Se requiere permiso de <strong>Gestión de Roles</strong>.</p>
        </div>
    );
  }

  // ... (Funciones de edición/eliminación se mantienen igual, omitidas por brevedad pero funcionales) ...
  const startEditRol = (rol, e) => { e.stopPropagation(); setEditingRol(rol.id); setEditRolName(rol.nombre); };
  const cancelEditRol = () => { setEditingRol(null); setEditRolName(""); };
  const saveEditRol = async (rolId) => {
      // Lógica de guardado igual que antes
      try {
        await apiFetch(`${API_URL}/api/roles/${rolId}`, { method: "PUT", body: JSON.stringify({ nombre: editRolName }) });
        setRoles(roles.map(rol => rol.id === rolId ? { ...rol, nombre: editRolName } : rol));
        if (selectedRol && selectedRol.id === rolId) setSelectedRol({ ...selectedRol, nombre: editRolName });
        setEditingRol(null);
      } catch (error) { alert("Error: " + error.message); }
  };
  const confirmDeleteRol = (rol, e) => { e.stopPropagation(); setShowDeleteConfirm(rol.id); };
  const cancelDelete = () => { setShowDeleteConfirm(null); };
  const deleteRol = async (rolId) => {
      try {
        await apiFetch(`${API_URL}/api/roles/${rolId}`, { method: "DELETE" });
        const nuevosRoles = roles.filter(rol => rol.id !== rolId);
        setRoles(nuevosRoles);
        if (selectedRol && selectedRol.id === rolId) handleSelectRol(nuevosRoles[0] || null);
        setShowDeleteConfirm(null);
      } catch (error) { alert("Error: " + error.message); }
  };

  const handleSelectRol = async (rol) => {
    if(!rol) { setSelectedRol(null); return; }
    setSelectedRol(rol);
    setEditingRol(null);
    setShowDeleteConfirm(null);
    try {
      const assignedIds = await apiFetch(`${API_URL}/api/roles/${rol.id}/permisos`);
      setPermisosAsignados(assignedIds || []);
    } catch (error) {
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
    } catch (error) { alert(error.message); }
  };

  return (
    <div className="fade-in" style={{width: '100%'}}>
       <div className="roles-container">
           {/* SIDEBAR */}
           <div className="roles-sidebar">
               <div className="sidebar-header">
                   <h2><Shield size={22}/> Roles</h2>
                   <button className="btn-add-mini" onClick={() => setShowNewRol(true)}><Plus size={18}/></button>
               </div>

               {/* MODAL CREAR ROL (Integrado en sidebar) */}
               {showNewRol && (
                   <form onSubmit={handleCreateRol} className="new-rol-form fade-in">
                       <input autoFocus type="text" placeholder="Nombre..." value={newRolName} onChange={(e) => setNewRolName(e.target.value)} />
                       <div className="form-mini-actions">
                           <button type="button" onClick={() => setShowNewRol(false)} className="btn-cancel">✕</button>
                           <button type="submit" className="btn-confirm">✓</button>
                       </div>
                   </form>
               )}

               <div className="roles-list">
                   {loading ? <p style={{padding:10}}>Cargando...</p> : 
                    roles.map(rol => {
                      const isEditing = editingRol === rol.id;
                      const isDeleting = showDeleteConfirm === rol.id;
                      return (
                       <div key={rol.id} className={`rol-item ${selectedRol?.id === rol.id ? 'active' : ''}`} onClick={() => !isEditing && !isDeleting && handleSelectRol(rol)}>
                           {isEditing ? (
                               <div className="rol-edit-form">
                                 <input value={editRolName} onChange={e => setEditRolName(e.target.value)} onClick={e => e.stopPropagation()} className="rol-edit-input" autoFocus />
                                 <button type="button" className="btn-icon-success" onClick={() => saveEditRol(rol.id)}><Check size={14}/></button>
                                 <button type="button" className="btn-icon-cancel" onClick={cancelEditRol}><X size={14}/></button>
                               </div>
                           ) : isDeleting ? (
                               <div className="rol-delete-confirm">
                                 <span className="delete-text">¿Borrar?</span>
                                 <button type="button" className="btn-icon-danger" onClick={() => deleteRol(rol.id)}><Check size={14}/></button>
                                 <button type="button" className="btn-icon-cancel" onClick={cancelDelete}><X size={14}/></button>
                               </div>
                           ) : (
                               <>
                                 <UserCog size={18}/>
                                 <span className="rol-name">{rol.nombre}</span>
                                 {rol.nombre === "Master_Admin" && <Lock size={14} className="lock-icon"/>}
                                 {/* Acciones Hover */}
                                 {rol.nombre !== "Master_Admin" && currentUserRole === "Master_Admin" && (
                                     <div className="rol-actions" onClick={e => e.stopPropagation()}>
                                       <button className="btn-icon-edit" onClick={e => startEditRol(rol, e)}><Edit size={14}/></button>
                                       <button className="btn-icon-delete" onClick={e => confirmDeleteRol(rol, e)}><Trash2 size={14}/></button>
                                     </div>
                                 )}
                               </>
                           )}
                       </div>
                      );
                   })}
               </div>
           </div>

           {/* MAIN CONTENT */}
           <div className="roles-main">
               {selectedRol ? (
                   <>
                       <div className="config-header">
                           <div>
                               <h1>Rol: <span className="highlight-rol">{selectedRol.nombre}</span></h1>
                               <p>Gestiona los permisos para este perfil.</p>
                           </div>
                           <button className="btn-save-config" onClick={saveConfiguration} disabled={selectedRol.nombre === "Master_Admin"}>
                               <Save size={18}/> Guardar
                           </button>
                       </div>
                       <div className="permissions-grid">
                           {permisosDisponibles.map(permiso => {
                               const isActive = permisosAsignados.includes(permiso.id);
                               const isMaster = selectedRol.nombre === "Master_Admin";
                               return (
                                   <div key={permiso.id} className={`permiso-card ${isActive ? 'active' : ''}`} onClick={() => !isMaster && togglePermiso(permiso.id)}>
                                       <div className="permiso-info">
                                           <h4>{permiso.nombre.replace(/_/g, " ")}</h4>
                                           <p>{permiso.descripcion}</p>
                                       </div>
                                       <div className={`toggle-switch ${isActive ? 'on' : 'off'} ${isMaster ? 'locked' : ''}`}>
                                           <div className="toggle-knob"></div>
                                           {isMaster && <Lock size={10} className="toggle-lock"/>}
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   </>
               ) : (
                   <div className="empty-selection">
                       <UserCog size={64} style={{opacity: 0.2}}/>
                       <p>Selecciona un rol para configurar.</p>
                   </div>
               )}
           </div>
       </div>
    </div>
  );
};

export default Roles;