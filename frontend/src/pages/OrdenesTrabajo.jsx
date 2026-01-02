// src/pages/OrdenesTrabajo.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";
import {
  Plus, CheckCircle, AlertCircle,
  User, ArrowRight, ArrowLeft, MapPin, UserPlus,
  Trash2, ShieldAlert, Send, Edit, Calendar, Wrench
} from "lucide-react";
import "../styles/Ordenes.css";

const API_BASE_URL = "http://127.0.0.1:5000";

const OrdenesTrabajo = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [rolUser, setRolUser] = useState("");
  
  // ✅ NUEVO ESTADO: Controla si el usuario tiene poder de gestión (Admin, Master o Permiso)
  const [canManage, setCanManage] = useState(false);
  
  const navigate = useNavigate();

  const [showModalNew, setShowModalNew] = useState(false);
  const [showModalUpdate, setShowModalUpdate] = useState(false);
  const [showModalEdit, setShowModalEdit] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState(null);

  const [avancesList, setAvancesList] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");

  const [step, setStep] = useState(1);

  const [newOrden, setNewOrden] = useState({
    titulo: "",
    descripcion: "",
    prioridad: "Media",
    id_deposito: "",
    id_empleado: null,
    fecha_limite: ""
  });

  const [editForm, setEditForm] = useState({
    titulo: "",
    descripcion: "",
    prioridad: "Media",
    fecha_limite: ""
  });

  useEffect(() => {
    // 1. Obtener Rol y Permisos
    const rol = sessionStorage.getItem("user_rol") || "";
    const permisosStr = sessionStorage.getItem("user_permissions");
    const permisos = permisosStr ? JSON.parse(permisosStr) : [];
    
    setRolUser(rol);

    // 2. Definir quién puede gestionar (Crear, Editar, Borrar, Asignar)
    // Pasa si es Master, Admin O si tiene el permiso 'gestion_ordenes'
    const hasPower = rol === "Master_Admin" || rol === "Admin" || permisos.includes("gestion_ordenes");
    setCanManage(hasPower);

    loadOrdenes();
    loadRecursos();
  }, []);

  const loadOrdenes = async () => {
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/ordenes");
      setOrdenes(data || []);
    } catch (e) { console.error(e); }
  };

  const loadRecursos = async () => {
    try {
      const dep = await apiFetch("http://127.0.0.1:5000/api/depositos");
      setDepositos(dep || []);
    } catch (e) { console.error(e); }
  };

  // --- CREAR ORDEN ---
  const handleCreateSubmit = async (e) => {
    e.preventDefault(); 

    if (step === 1) {
        if (newOrden.titulo && newOrden.titulo.trim() !== "") {
            setStep(2); 
        } else {
            alert("El título es obligatorio para continuar.");
        }
        return;
    }

    try {
      const payload = { ...newOrden };

      // Si NO es Master Admin, borramos el depósito seleccionado 
      // (El backend usará el depósito del usuario logueado automáticamente)
      if (rolUser !== "Master_Admin") {
          delete payload.id_deposito;
      }

      if (!payload.id_empleado) payload.id_empleado = null; 

      await apiFetch("http://127.0.0.1:5000/api/ordenes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowModalNew(false);
      setStep(1);
      setNewOrden({ titulo: "", descripcion: "", prioridad: "Media", id_deposito: "", id_empleado: null, fecha_limite: "" });
      loadOrdenes();

    } catch (err) {
      alert("Error al crear orden: " + err.message);
    }
  };

  const openEditModal = (orden) => {
    setSelectedOrden(orden);
    setEditForm({
      titulo: orden.titulo,
      descripcion: orden.descripcion,
      prioridad: orden.prioridad,
      fecha_limite: orden.fecha_limite || "" 
    });
    setShowModalEdit(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`http://127.0.0.1:5000/api/ordenes/${selectedOrden.id}`, {
        method: "PUT",
        body: JSON.stringify({
          accion: "editar_info",
          ...editForm
        })
      });
      setShowModalEdit(false);
      loadOrdenes();
    } catch (err) {
      alert("Error al editar: " + err.message);
    }
  };

  const openUpdateModal = async (o) => {
    setSelectedOrden(o);
    setNuevoMensaje("");
    setAvancesList([]);
    try {
        const data = await apiFetch(`http://127.0.0.1:5000/api/ordenes/${o.id}/avances`);
        setAvancesList(data || []);
    } catch (e) { console.error(e); }
    setShowModalUpdate(true);
  };

  const handlePostAvance = async () => {
    if (!nuevoMensaje.trim()) return;
    try {
        const resp = await apiFetch(`http://127.0.0.1:5000/api/ordenes/${selectedOrden.id}/avances`, {
            method: "POST",
            body: JSON.stringify({ mensaje: nuevoMensaje })
        });
        if (resp.success) {
            setAvancesList([...avancesList, resp.avance]);
            setNuevoMensaje("");
        }
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleFinalizarTarea = async () => {
    if(!window.confirm("¿Confirmar que la tarea está terminada?")) return;
    try {
        await apiFetch(`http://127.0.0.1:5000/api/ordenes/${selectedOrden.id}`, {
            method: "PUT",
            body: JSON.stringify({ nuevo_estado: "Aprobada" }) 
        });
        setShowModalUpdate(false);
        loadOrdenes(); 
    } catch (e) { console.error(e); }
  };

  const handleGoToAssign = (orden) => navigate("/empleados", { state: { assigningOrden: orden } });

  const deleteSoft = async (id) => {
    if (!window.confirm("¿Mover a papelera?")) return;
    try {
      await apiFetch(`http://127.0.0.1:5000/api/ordenes/${id}`, { method: "DELETE" });
      setOrdenes(ordenes.filter(o => o.id !== id));
    } catch (error) { alert(error.message); }
  };

  const permaDelete = async (id) => {
    if (!window.confirm("⚠️ ¿Destruir permanentemente?")) return;
    try {
      await apiFetch(`http://127.0.0.1:5000/api/ordenes/${id}/perma`, { method: "DELETE" });
      setOrdenes(ordenes.filter(o => o.id !== id));
    } catch (error) { alert(error.message); }
  };

  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        
        <div className="page-header">
          <div>
            <h1>Órdenes de Trabajo</h1>
            <p className="subtitle">Gestión y monitoreo de tareas.</p>
          </div>
          {/* ✅ CORREGIDO: Ahora usa canManage en lugar de rol fijo */}
          {canManage && (
            <button className="btn-new" onClick={() => setShowModalNew(true)}>
              <Plus size={18} /> Crear Orden
            </button>
          )}
        </div>

        <div className="ordenes-grid">
          {ordenes.map((orden) => {
            const isCompleted = ["Aprobada", "Completada", "Finalizada"].includes(orden.estado);
            const isExpired = orden.estado === "Fin de tiempo limite";
            
            let estadoClase = orden.estado.toLowerCase().replace(/ /g, "-");
            let estadoTexto = orden.estado;

            if (isCompleted) {
                estadoClase = "completada"; 
                estadoTexto = "Completada";
            } else if (isExpired) {
                estadoTexto = "TIEMPO AGOTADO";
            }

            return (
              <div key={orden.id} className={`orden-card priority-${orden.prioridad.toLowerCase()}`}>
                <div className="orden-header">
                  <span className={`badge-estado ${estadoClase}`}>{estadoTexto}</span>
                  <span className="orden-date">{orden.fecha_inicio}</span>
                </div>

                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                    <h3>{orden.titulo}</h3>
                    {/* ✅ CORREGIDO: Botón editar info */}
                    {canManage && (
                        <button className="btn-icon-simple" onClick={() => openEditModal(orden)} title="Editar información">
                            <Edit size={16} />
                        </button>
                    )}
                </div>

                <p className="orden-desc">{orden.descripcion}</p>

                {orden.fecha_limite_fmt && (
                    <div style={{fontSize: '0.85rem', color: isExpired ? '#991b1b' : '#e11d48', marginBottom: '10px', display:'flex', alignItems:'center', gap:'5px', fontWeight: 500}}>
                        <Calendar size={14}/> Límite: {orden.fecha_limite_fmt}
                    </div>
                )}

                {orden.tiempo_empleado && (
                   <div style={{marginBottom: '10px', fontSize: '0.9rem', color: '#059669', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px'}}>
                      <CheckCircle size={14}/> Tiempo: {orden.tiempo_empleado}
                   </div>
                )}

                <div className="orden-meta">
                  {(!orden.empleado_nombre || orden.empleado_nombre.toLowerCase().includes("sin asignar")) ? (
                    <div className="meta-item text-danger fw-bold">
                      <UserPlus size={14} /> Sin Asignar
                    </div>
                  ) : (
                    <div className="meta-item employee-assigned-meta">
                      {orden.empleado_avatar ? (
                        <img 
                          src={`${API_BASE_URL}${orden.empleado_avatar}`} 
                          alt="Avatar" 
                          className="meta-avatar-img"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : <User size={14} className="meta-fallback-icon" />}
                      <span className="employee-name-text" title={orden.empleado_nombre}>
                          {orden.empleado_nombre}
                      </span>
                    </div>
                  )}
                  <div className="meta-item">
                    <AlertCircle size={14} /> {orden.prioridad}
                  </div>
                </div>

                <div className="orden-actions">
                  {/* ✅ CORREGIDO: Botón Asignar */}
                  {(!orden.empleado_nombre || orden.empleado_nombre.toLowerCase().includes("sin asignar")) &&
                    canManage && (
                      <button className="btn-action primary" onClick={() => handleGoToAssign(orden)}>
                        Asignar <ArrowRight size={14} />
                      </button>
                    )}

                  {orden.empleado_nombre && !orden.empleado_nombre.toLowerCase().includes("sin asignar") && (
                      <button className="btn-action secondary" onClick={() => openUpdateModal(orden)}>
                        {/* Si es Manager, ve Bitácora. Si es empleado, ve Avance */}
                        {canManage 
                            ? "Ver Bitácora" 
                            : (isCompleted || isExpired ? "Ver Bitácora" : "Avance")
                        }
                      </button>
                  )}

                  {/* ✅ CORREGIDO: Botón Papelera */}
                  {canManage && (
                    <button className="btn-action danger" onClick={() => deleteSoft(orden.id)} style={{marginLeft: 'auto', flex: '0 0 auto', width:'40px'}}>
                      <Trash2 size={16} />
                    </button>
                  )}
                  {/* Master Admin sigue siendo el único que puede eliminar permanentemente */}
                  {rolUser === "Master_Admin" && (
                    <button className="btn-action danger" onClick={() => permaDelete(orden.id)} style={{backgroundColor: '#7f1d1d', flex: '0 0 auto', width:'40px'}}>
                      <ShieldAlert size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- MODAL NUEVA ORDEN --- */}
        {showModalNew && (
          <div className="modal-backdrop">
            <div className="discord-card modal-wizard">
              <div className="roles-header"><h2>Nueva Orden</h2><span className="wizard-step-indicator">Paso {step} de 2</span></div>
              <div className="wizard-progress"><div className="wizard-progress-bar" style={{ width: step === 1 ? "50%" : "100%" }}></div></div>

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
                      <label>Prioridad</label>
                      <select className="discord-select" value={newOrden.prioridad} onChange={(e) => setNewOrden({ ...newOrden, prioridad: e.target.value })}>
                        <option value="Baja">🟢 Baja</option>
                        <option value="Media">🟡 Media</option>
                        <option value="Alta">🔴 Alta</option>
                      </select>
                    </div>
                    <div className="input-group">
                        <label>Fecha Límite (Opcional)</label>
                        <input type="datetime-local" className="discord-select" value={newOrden.fecha_limite} onChange={(e) => setNewOrden({ ...newOrden, fecha_limite: e.target.value })} />
                    </div>
                    
                    {/* Lógica de Depósito:
                       Solo Master_Admin ve el selector. 
                       Admin y Gerentes verán el aviso de "Asignación automática".
                    */}
                    {rolUser === "Master_Admin" ? (
                      <div className="input-group" style={{ marginTop: '15px' }}>
                        <label>Depósito</label>
                        <select className="discord-select" required value={newOrden.id_deposito} onChange={(e) => setNewOrden({ ...newOrden, id_deposito: e.target.value })}>
                          <option value="">-- Seleccionar --</option>
                          {depositos.map((d) => (<option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>))}
                        </select>
                      </div>
                    ) : (
                        <div className="info-box" style={{background: '#f0f9ff', padding: '10px', borderRadius: '6px', marginTop: '10px', border: '1px solid #bae6fd'}}>
                            <p style={{margin:0, fontSize: '0.85rem', color: '#0369a1', display:'flex', alignItems:'center', gap:'5px'}}>
                                <MapPin size={14}/> 
                                <b>Depósito:</b> Se asignará automáticamente a tu sucursal.
                            </p>
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
                    <button type="submit" className="btn-save">Siguiente <ArrowRight size={16} /></button>
                  ) : (
                    <button type="submit" className="btn-save">Finalizar y Crear</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- Modal EDIT --- */}
        {showModalEdit && (
            <div className="modal-backdrop">
                <div className="discord-card" style={{width: '450px', maxHeight: '90vh', overflowY: 'auto'}}>
                    <div className="modal-header" style={{borderBottom:'1px solid #eee', paddingBottom:'10px'}}><h2>Editar Orden</h2></div>
                    <form onSubmit={handleEditSubmit} style={{display:'flex', flexDirection:'column', gap:'15px', marginTop:'20px'}}>
                        <div className="input-group"><label>Título</label><input type="text" required value={editForm.titulo} onChange={(e) => setEditForm({...editForm, titulo: e.target.value})} /></div>
                        <div className="input-group"><label>Descripción</label><textarea rows="4" required value={editForm.descripcion} onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})} /></div>
                        <div className="row-2" style={{display:'flex', gap:'15px'}}>
                            <div className="input-group" style={{flex:1}}><label>Prioridad</label><select className="discord-select" value={editForm.prioridad} onChange={(e) => setEditForm({...editForm, prioridad: e.target.value})}><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option></select></div>
                            <div className="input-group" style={{flex:1}}><label>Fecha Límite</label><input type="datetime-local" className="discord-select" value={editForm.fecha_limite} onChange={(e) => setEditForm({...editForm, fecha_limite: e.target.value})} /></div>
                        </div>
                        <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'15px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                            <button type="button" className="btn-status btn-danger" onClick={() => setShowModalEdit(false)}>Cancelar</button>
                            <button type="submit" className="btn-save">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* --- Modal BITÁCORA / AVANCES --- */}
        {showModalUpdate && selectedOrden && (
            <div className="modal-backdrop" onClick={() => setShowModalUpdate(false)}>
                <div className="discord-card" style={{ width: '500px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header" style={{borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px'}}>
                        <h2 style={{margin: 0, fontSize: '1.2rem'}}>Bitácora: {selectedOrden.titulo}</h2>
                        <small style={{color: '#777'}}>Reporta tus progresos aquí</small>
                    </div>

                    <div className="avances-history" style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                        {avancesList.length === 0 ? (
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#ccc'}}><Wrench size={40} style={{opacity:0.2, marginBottom:10}}/><p>Sin avances registrados.</p></div>
                        ) : (
                            avancesList.map((av) => (
                                <div key={av.id} style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginBottom: '4px'}}><span style={{fontWeight: 'bold', color: '#555'}}>{av.autor}</span><span>{av.fecha}</span></div>
                                    <p style={{margin: 0, fontSize: '0.9rem', color: '#333', lineHeight: '1.4'}}>{av.mensaje}</p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ✅ CORREGIDO: Los Gestores (Admin/Gerente) NO pueden escribir avances, solo leer. */}
                    {selectedOrden.estado !== "Aprobada" && selectedOrden.estado !== "Completada" && selectedOrden.estado !== "Finalizada" && selectedOrden.estado !== "Fin de tiempo limite" && 
                     !canManage && ( // <--- Si NO es manager, puede escribir
                        <div style={{display: 'flex', gap: '8px', marginBottom: '15px'}}>
                            <input type="text" className="input-field" placeholder="Escribe tu avance..." value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePostAvance()} autoFocus />
                            <button className="btn-save" onClick={handlePostAvance} title="Enviar"><Send size={16}/></button>
                        </div>
                    )}

                    <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '15px'}}>
                        <button className="btn-status btn-danger" onClick={() => setShowModalUpdate(false)}>Cerrar</button>
                        
                        {/* Botón Finalizar Tarea: Solo para el empleado que la hace (No managers) */}
                        {selectedOrden.estado !== "Aprobada" && selectedOrden.estado !== "Completada" && selectedOrden.estado !== "Finalizada" && selectedOrden.estado !== "Fin de tiempo limite" && 
                         !canManage && (
                            <button className="btn-save" style={{background: '#23a559'}} onClick={handleFinalizarTarea}>
                                <CheckCircle size={16} style={{marginRight:5}}/> Finalizar Tarea
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default OrdenesTrabajo;