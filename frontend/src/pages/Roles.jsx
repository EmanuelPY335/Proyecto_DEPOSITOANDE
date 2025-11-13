// src/pages/Roles.jsx
import React, { useEffect, useState }from "react";
import { apiFetch } from "../utils/api";
import "../styles/Roles.css";

const API = "http://127.0.0.1:5000";

// --- Componente Modal ---
// Lo ponemos en el mismo archivo por simplicidad
const RoleModal = ({ modalState, onClose, onSave, setMsg }) => {
  const [roleName, setRoleName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Cuando el modal se abre para editar, carga el nombre del rol
    if (modalState.mode === "edit" && modalState.role) {
      setRoleName(modalState.role.nombre);
    } else {
      setRoleName("");
    }
  }, [modalState]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setMsg("El nombre del rol no puede estar vacío.");
      return;
    }

    setIsSaving(true);
    setMsg("");
    
    // Llama a la función onSave que decidirá si crear o actualizar
    await onSave(roleName, modalState.role ? modalState.role.id : null);
    
    setIsSaving(false);
  };

  if (!modalState.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>{modalState.mode === "add" ? "Agregar Nuevo Rol" : "Editar Rol"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="roleName">Nombre del Rol</label>
            <input
              type="text"
              id="roleName"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="Ej: Personal_Inventario"
              disabled={isSaving}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// --- Componente Principal de la Página ---
const Roles = () => {
  const [roles, setRoles] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [savingUser, setSavingUser] = useState(false); // Para la tabla de usuarios
  const [msg, setMsg] = useState("");
  
  // Estado para el modal de roles
  const [modalState, setModalState] = useState({ 
    open: false, 
    mode: 'add', // 'add' o 'edit'
    role: null  // El rol a editar
  });

  const loadData = async () => {
    // No limpiar el mensaje aquí para que se vean los mensajes de éxito/error
    try {
      const [r, e] = await Promise.all([
        apiFetch(`${API}/api/roles`),
        apiFetch(`${API}/api/empleados`),
      ]);
      setRoles(r || []);
      setEmpleados(e || []);
    } catch (err) {
      setMsg(err.message || "Error al cargar datos.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // -- Lógica de Asignación de Roles a Usuarios --
  const handleChangeRol = async (idUsuario, nuevoRol) => {
    setSavingUser(true);
    setMsg("");
    try {
      const resp = await apiFetch(`${API}/api/asignar-rol`, {
        method: "PUT",
        body: JSON.stringify({ usuario_id: idUsuario, rol: nuevoRol }),
      });
      setMsg(resp.msg || "Rol de usuario actualizado.");
      // Recargar solo los empleados, los roles no cambiaron
      const e = await apiFetch(`${API}/api/empleados`);
      setEmpleados(e || []);
    } catch (err) {
      setMsg(err.message || "Error al asignar rol de usuario.");
    } finally {
      setSavingUser(false);
    }
  };

  // -- Lógica de Gestión de Roles (CRUD) --

  const handleOpenModal = (mode, role = null) => {
    setMsg("");
    setModalState({ open: true, mode, role });
  };

  const handleCloseModal = () => {
    setModalState({ open: false, mode: 'add', role: null });
  };

  const handleSaveRole = async (roleName, roleId) => {
    const isEditing = modalState.mode === 'edit';
    const url = isEditing ? `${API}/api/roles/${roleId}` : `${API}/api/roles`;
    const method = isEditing ? "PUT" : "POST";

    try {
      const resp = await apiFetch(url, {
        method: method,
        body: JSON.stringify({ nombre_rol: roleName }),
      });
      
      setMsg(resp.msg || "Rol guardado.");
      handleCloseModal();
      await loadData(); // Recargar todo (roles y empleados)
    } catch (err) {
      setMsg(err.message || "Error al guardar el rol.");
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (window.confirm(`¿Está seguro que desea eliminar el rol "${roleName}"?`)) {
      setMsg("");
      try {
        const resp = await apiFetch(`${API}/api/roles/${roleId}`, {
          method: "DELETE",
        });
        setMsg(resp.msg || "Rol eliminado.");
        await loadData(); // Recargar
      } catch (err) {
        setMsg(err.message || "Error al eliminar el rol.");
      }
    }
  };


  return (
    <div className="dashboard-layout">
      <div className="main-area">
        
        <div className="content-dashboard">
          <h1>Roles y Permisos</h1>
          <p className="subtitle">Solo visible para el Gerente (Master_Admin).</p>

          {msg && (
            <p
              className={
                msg.toLowerCase().includes("error") ? "msg-error" : "msg-success"
              }
            >
              {msg}
            </p>
          )}

          {/* --- 1. Sección de Gestión de Roles --- */}
          <div className="form-container">
            <div className="roles-header">
              <h2>Gestión de Roles</h2>
              <button 
                className="btn btn-primary"
                onClick={() => handleOpenModal('add')}
              >
                Agregar Rol
              </button>
            </div>
            <div className="table-wrapper">
              <table className="roles-table">
                <thead>
                  <tr>
                    <th>Nombre del Rol</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nombre}</td>
                      <td className="roles-actions">
                        <button 
                          className="btn btn-secondary"
                          onClick={() => handleOpenModal('edit', r)}
                        >
                          Editar
                        </button>
                        <button 
                          className="btn btn-danger"
                          onClick={() => handleDeleteRole(r.id, r.nombre)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 && (
                    <tr>
                      <td colSpan={2} className="empty-table-row">
                        No hay roles definidos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>


          {/* --- 2. Sección de Asignación de Usuarios --- */}
          <div className="form-container form-container-responsive">
            <h2>Asignación de Usuarios</h2>
            <div className="table-wrapper">
              <table className="roles-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Correo</th>
                    <th>Rol actual</th>
                    <th>Asignar nuevo rol</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.nombre} {u.apellido}
                      </td>
                      <td>{u.correo}</td>
                      <td>{u.rol}</td>
                      <td>
                        <select
                          defaultValue={u.rol}
                          onChange={(e) =>
                            handleChangeRol(u.id, e.target.value)
                          }
                          disabled={savingUser}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.nombre}>
                              {r.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {empleados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-table-row">
                        No hay usuarios.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
      
      {/* --- Modal para Crear/Editar Roles --- */}
      <RoleModal 
        modalState={modalState}
        onClose={handleCloseModal}
        onSave={handleSaveRole}
        setMsg={setMsg}
      />
    </div>
  );
};

export default Roles;