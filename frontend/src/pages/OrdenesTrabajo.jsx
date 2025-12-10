// src/pages/OrdenesTrabajo.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";
import {
  Plus, Clock, Wrench, CheckCircle, AlertCircle,
  User, ArrowRight, ArrowLeft, MapPin, UserPlus,
  Trash2, ShieldAlert // <--- Iconos para borrar
} from "lucide-react";
import "../styles/Ordenes.css";

const OrdenesTrabajo = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [rolUser, setRolUser] = useState("");
  const navigate = useNavigate();

  // Modales
  const [showModalNew, setShowModalNew] = useState(false);
  const [showModalUpdate, setShowModalUpdate] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState(null);

  // Wizard
  const [step, setStep] = useState(1);

  // Form nueva orden
  const [newOrden, setNewOrden] = useState({
    titulo: "",
    descripcion: "",
    prioridad: "Media",
    id_deposito: "",
    id_empleado: null 
  });

  // Form avance
  const [avance, setAvance] = useState({ herramientas: "", tiempo_empleado: "", estado: "" });

  useEffect(() => {
    setRolUser(sessionStorage.getItem("user_rol") || "");
    loadOrdenes();
    loadRecursos();
  }, []);

  const loadOrdenes = async () => {
    const data = await apiFetch("http://127.0.0.1:5000/api/ordenes");
    setOrdenes(data || []);
  };

  const loadRecursos = async () => {
    try {
      const dep = await apiFetch("http://127.0.0.1:5000/api/depositos");
      setDepositos(dep || []);
    } catch (e) { console.error(e); }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newOrden };
      if (!payload.id_empleado) {
        payload.id_empleado = null; // Enviamos null explícito
      }

      await apiFetch("http://127.0.0.1:5000/api/ordenes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowModalNew(false);
      setStep(1);
      setNewOrden({ titulo: "", descripcion: "", prioridad: "Media", id_deposito: "", id_empleado: null });
      loadOrdenes();
    } catch (err) {
      console.error(err);
      alert("Error al crear orden: " + err.message);
    }
  };

  const handleGoToAssign = (orden) => {
    navigate("/empleados", { state: { assigningOrden: orden } });
  };

  // --- BORRADO LÓGICO (ADMIN) ---
  const deleteSoft = async (id, titulo) => {
    // Confirmación simple
    if (!window.confirm(`¿Mover la orden "${titulo}" a la papelera?`)) return;

    try {
      await apiFetch(`http://127.0.0.1:5000/api/ordenes/${id}`, {
        method: "DELETE",
      });
      // Actualizar UI quitando la orden
      setOrdenes(ordenes.filter(o => o.id !== id));
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    }
  };

  // --- BORRADO PERMANENTE (MASTER) ---
  const permaDelete = async (id, titulo) => {
    // Confirmación doble por seguridad
    const confirm = window.confirm(`⚠️ ADVERTENCIA ⚠️\n\nEstás a punto de DESTRUIR la orden "${titulo}".\nEsta acción NO se puede deshacer.\n\n¿Estás seguro?`);
    if (!confirm) return;

    try {
      await apiFetch(`http://127.0.0.1:5000/api/ordenes/${id}/perma`, {
        method: "DELETE",
      });
      // Actualizar UI
      setOrdenes(ordenes.filter(o => o.id !== id));
    } catch (error) {
      alert("Error crítico: " + error.message);
    }
  };

  // Funciones de Update (resumidas para no ocupar espacio, mantenlas igual)
  const openUpdateModal = (o) => { setSelectedOrden(o); setAvance({ herramientas: o.herramientas || "", tiempo_empleado: o.tiempo_empleado || "", estado: o.estado }); setShowModalUpdate(true); };
  const handleUpdateSubmit = async (e) => { /* ... tu lógica existente ... */ };


  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        <div className="page-header">
          <div>
            <h1>Órdenes de Trabajo</h1>
            <p className="subtitle">Crea tareas y asignalas posteriormente.</p>
          </div>
          {(rolUser === "Admin" || rolUser === "Master_Admin") && (
            <button className="btn-new" onClick={() => setShowModalNew(true)}>
              <Plus size={18} /> Crear Orden
            </button>
          )}
        </div>

        <div className="ordenes-grid">
          {ordenes.map((orden) => (
            <div key={orden.id} className={`orden-card priority-${orden.prioridad.toLowerCase()}`}>
              <div className="orden-header">
                <span className={`badge-estado ${orden.estado.replace(" ", "-").toLowerCase()}`}>
                  {orden.estado}
                </span>
                <span className="orden-date">{orden.fecha_inicio}</span>
              </div>

              <h3>{orden.titulo}</h3>
              <p className="orden-desc">{orden.descripcion}</p>

              <div className="orden-meta">
                {(!orden.empleado_nombre || orden.empleado_nombre.toLowerCase().includes("sin asignar") || orden.empleado_nombre.toLowerCase() === "sin asignar") ? (
                  <div className="meta-item" style={{ color: '#dc3545', fontWeight: 600 }}>
                    <UserPlus size={14} /> Sin Asignar
                  </div>
                ) : (
                  <div className="meta-item">
                    <User size={14} /> {orden.empleado_nombre}
                  </div>
                )}

                <div className="meta-item">
                  <AlertCircle size={14} /> {orden.prioridad}
                </div>
              </div>

              <div className="orden-actions">
                {/* 1. Botón ASIGNAR (Si no tiene empleado) */}
                {(!orden.empleado_nombre || orden.empleado_nombre.toLowerCase().includes("sin asignar")) &&
                  (rolUser === "Admin" || rolUser === "Master_Admin") && (
                    <button className="btn-action primary" onClick={() => handleGoToAssign(orden)}>
                      Asignar <ArrowRight size={14} />
                    </button>
                  )}

                {/* 2. Botón AVANCE (Empleados) */}
                {orden.empleado_nombre && !orden.empleado_nombre.toLowerCase().includes("sin asignar") &&
                  rolUser !== "Admin" && rolUser !== "Master_Admin" && (
                    <button className="btn-action secondary" onClick={() => openUpdateModal(orden)}>
                      Avance
                    </button>
                  )}

                {/* 3. BOTONES DE BORRADO SEGÚN ROL */}
                
                {/* ADMIN: Borrado Lógico (Visual) */}
                {(rolUser === "Admin" || rolUser === "Master_Admin") && (
                  <button 
                    className="btn-action danger" 
                    onClick={() => deleteSoft(orden.id, orden.titulo)}
                    title="Enviar a papelera"
                    style={{marginLeft: 'auto'}} // Empujar a la derecha
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                {/* MASTER ADMIN: Borrado Permanente (Destruir) */}
                {rolUser === "Master_Admin" && (
                  <button 
                    className="btn-action danger" 
                    onClick={() => permaDelete(orden.id, orden.titulo)}
                    title="Eliminar permanentemente"
                    style={{backgroundColor: '#7f1d1d', color: '#fff', marginLeft: 'auto', borderColor: '#991b1b'}}
                  >
                    <ShieldAlert size={16} /> Destruir
                  </button>
                )}

              </div>
            </div>
          ))}
        </div>

        {/* --- MODAL NUEVA ORDEN --- */}
        {showModalNew && (
          <div className="modal-backdrop">
            <div className="discord-card modal-wizard">
              <div className="roles-header">
                <h2>Nueva Orden</h2>
                <span className="wizard-step-indicator">Paso {step} de 2</span>
              </div>
              <div className="wizard-progress">
                <div className="wizard-progress-bar" style={{ width: step === 1 ? "50%" : "100%" }}></div>
              </div>

              <form onSubmit={handleCreateSubmit} className="wizard-form">
                {step === 1 && (
                  <div className="fade-in">
                    <div className="input-group">
                      <label>Título de la Tarea</label>
                      <input type="text" autoFocus required value={newOrden.titulo} onChange={(e) => setNewOrden({ ...newOrden, titulo: e.target.value })} />
                    </div>
                    <div className="input-group">
                      <label>Descripción detallada</label>
                      <textarea rows="4" required value={newOrden.descripcion} onChange={(e) => setNewOrden({ ...newOrden, descripcion: e.target.value })}></textarea>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="fade-in">
                    <div className="input-group">
                      <label>Nivel de Prioridad</label>
                      <div className="priority-selector">
                        <select className="discord-select" value={newOrden.prioridad} onChange={(e) => setNewOrden({ ...newOrden, prioridad: e.target.value })}>
                          <option value="Baja">🟢 Baja</option>
                          <option value="Media">🟡 Media</option>
                          <option value="Alta">🔴 Alta</option>
                        </select>
                      </div>
                    </div>
                    {(rolUser === "Master_Admin" || rolUser === "Admin") && (
                      <div className="input-group" style={{ marginTop: '15px' }}>
                        <label>Ubicación / Depósito</label>
                        <div className="deposito-selector-container">
                          <MapPin size={18} className="deposito-icon-input" />
                          <select className="discord-select" style={{ paddingLeft: '35px' }} required value={newOrden.id_deposito} onChange={(e) => setNewOrden({ ...newOrden, id_deposito: e.target.value })}>
                            <option value="">-- Seleccionar --</option>
                            {depositos.map((d) => (<option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>))}
                          </select>
                        </div>
                        <small style={{ color: '#777', marginTop: '5px', display: 'block' }}>* Asignación posterior.</small>
                      </div>
                    )}
                  </div>
                )}

                <div className="wizard-buttons" style={{ marginTop: '20px' }}>
                  {step === 1 ? (
                    <button type="button" className="btn-status btn-danger" onClick={() => setShowModalNew(false)}>Cancelar</button>
                  ) : (
                    <button type="button" className="btn-status" onClick={() => setStep(1)}><ArrowLeft size={16} /> Atrás</button>
                  )}
                  {step === 1 ? (
                    <button type="button" className="btn-save" onClick={() => newOrden.titulo ? setStep(2) : alert("Falta el título")}>Siguiente <ArrowRight size={16} /></button>
                  ) : (
                    <button type="submit" className="btn-save">Finalizar y Crear</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Modal Update (omitido por brevedad, no cambia) */}
      </div>
    </div>
  );
};

export default OrdenesTrabajo;