// src/pages/OrdenesTrabajo.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus, CheckCircle, AlertCircle,
  User, ArrowRight, ArrowLeft, MapPin, UserPlus,
  Trash2, ShieldAlert, Send, Edit, Calendar, Wrench, ArrowRightLeft, Box,
  Info, Clock
} from "lucide-react";
import "../styles/Ordenes.css";

const API_BASE_URL = "http://127.0.0.1:5000";

const OrdenesTrabajo = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  const [rolUser, setRolUser] = useState("");
  const [userDepositoId, setUserDepositoId] = useState("");
  const [canManage, setCanManage] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const [showModalNew, setShowModalNew] = useState(false);
  const [showModalUpdate, setShowModalUpdate] = useState(false);
  const [showModalEdit, setShowModalEdit] = useState(false);

  const [selectedOrden, setSelectedOrden] = useState(null);

  const [avancesList, setAvancesList] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [step, setStep] = useState(1);

  const [inventario, setInventario] = useState([]);

  // ✅ NUEVO: sectores + maquinaria
  const [sectores, setSectores] = useState([]);
  const [maquinarias, setMaquinarias] = useState([]);

  // ✅ NUEVO: modal detalle inventario
  const [showInvInfo, setShowInvInfo] = useState(false);
  const [invInfoLoading, setInvInfoLoading] = useState(false);
  const [invInfo, setInvInfo] = useState(null);

  const [newOrden, setNewOrden] = useState({
    titulo: "",
    descripcion: "",
    prioridad: "Media",
    id_deposito: "",
    id_empleado: "",
    fecha_limite: "",
    tipo_orden: "General",

    // movimiento
    id_lote: "",
    cantidad: 0,
    nueva_ubicacion: "",

    // ✅ NUEVOS
    id_sector_destino: "",
    id_maquinaria: "",

    id_solicitud_origen: null
  });

  const [depositoFiltro, setDepositoFiltro] = useState("TODOS");

  const [editForm, setEditForm] = useState({
    titulo: "",
    descripcion: "",
    prioridad: "Media",
    fecha_limite: ""
  });

  useEffect(() => {
    const rol = (sessionStorage.getItem("user_rol") || sessionStorage.getItem("rol_nombre") || "").trim();
    const depId = sessionStorage.getItem("user_deposito_id") || "";

    const permisosStr = sessionStorage.getItem("user_permissions");
    const permisos = permisosStr ? JSON.parse(permisosStr) : [];
    const roleLower = rol.toLowerCase();

    const esAdminGlobal = roleLower === "master_admin" || roleLower === "admin";
    const puedeGestionarOrdenes = esAdminGlobal || permisos.includes("gestion_ordenes");
    const puedeVerPersonal = esAdminGlobal || permisos.includes("ver_personal") || permisos.includes("gestion_personal");

    setRolUser(rol);
    setUserDepositoId(depId);
    setCanManage(puedeGestionarOrdenes);

    loadOrdenes();
    loadRecursos();

    if (puedeGestionarOrdenes || puedeVerPersonal) {
      loadEmpleados();
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const ordenIdParam = query.get("id");
    if (ordenIdParam && ordenes.length > 0) {
      const targetOrden = ordenes.find((o) => o.id === parseInt(ordenIdParam));
      if (targetOrden) openUpdateModal(targetOrden);
    }
    // eslint-disable-next-line
  }, [location.search, ordenes]);

  // Crear desde Solicitud (LÓGICA ACTUALIZADA PARA OBS)
  useEffect(() => {
    if (location.state?.crearDesdeSolicitud && location.state?.solicitud) {
      const sol = location.state.solicitud;

      // ✅ Capturamos la observación correctamente
      const obsReal = sol.observacion || sol.obs || "Ninguna";

      let descripcionGenerada = "";
      if (sol.items && Array.isArray(sol.items) && sol.items.length > 0) {
        const listaItems = sol.items
          .map((item) => `- ${item.material} (${item.cantidad} ${item.unidad || "u."})`)
          .join("\n");

        descripcionGenerada =
          `Solicitud #${sol.id_solicitud} de ${sol.deposito_solicitante}:\n\n` +
          `Materiales requeridos:\n${listaItems}\n\n` +
          `Obs: ${obsReal}`;
      } else {
        const unidad = sol.unidad || "u.";
        descripcionGenerada =
          `Solicitud de ${sol.deposito_solicitante}: ${sol.cantidad} ${unidad} de ${sol.material}.\n\n` +
          `Obs: ${obsReal}`;
      }

      setNewOrden((prev) => ({
        ...prev,
        titulo: `Preparar Pedido #${sol.id_solicitud}`,
        descripcion: descripcionGenerada,
        prioridad: "Alta",
        tipo_orden: "General",
        id_solicitud_origen: sol.id_solicitud,
        id_deposito: sol.id_destino || ""
      }));

      setShowModalNew(true);
      setStep(1);
    }
  }, [location.state]);

  const loadOrdenes = async () => {
    try {
      const rol = (sessionStorage.getItem("user_rol") || sessionStorage.getItem("rol_nombre") || "").trim();
      let url = `${API_BASE_URL}/api/ordenes`;

      if (rol === "Master_Admin" && depositoFiltro !== "TODOS") {
        url += `?deposito_id=${depositoFiltro}`;
      }

      const data = await apiFetch(url);
      setOrdenes(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if ((rolUser || "") === "Master_Admin") loadOrdenes();
    // eslint-disable-next-line
  }, [depositoFiltro]);

  const loadRecursos = async () => {
    try {
      const dep = await apiFetch(`${API_BASE_URL}/api/depositos`);
      setDepositos(dep || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadEmpleados = async () => {
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/empleados`);
      setEmpleados(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const isMaster = useMemo(() => (rolUser || "").trim().toLowerCase() === "master_admin", [rolUser]);

  // ✅ Cargar recursos de movimiento según depósito
  const fetchMovimientoRecursos = async (depositoId) => {
    try {
      const qs = depositoId ? `?deposito_id=${depositoId}` : "";
      const [inv, secs, maqs] = await Promise.all([
        apiFetch(`${API_BASE_URL}/api/recursos/inventario-local${qs}`),
        apiFetch(`${API_BASE_URL}/api/recursos/sectores${qs}`),
        apiFetch(`${API_BASE_URL}/api/recursos/maquinaria${qs}`),
      ]);
      setInventario(inv || []);
      setSectores(secs || []);
      setMaquinarias(maqs || []);
    } catch (e) {
      console.error(e);
      setInventario([]);
      setSectores([]);
      setMaquinarias([]);
    }
  };

  // ✅ cuando abro modal y tipo Movimiento: cargar inventario/sectores/maquinaria
  useEffect(() => {
    if (!showModalNew) return;

    if (newOrden.tipo_orden === "Movimiento") {
      if (isMaster) {
        if (!newOrden.id_deposito) {
          // Master debe elegir depósito primero
          setInventario([]);
          setSectores([]);
          setMaquinarias([]);
          return;
        }
        fetchMovimientoRecursos(newOrden.id_deposito);
      } else {
        fetchMovimientoRecursos(null);
      }
    }
    // eslint-disable-next-line
  }, [showModalNew, newOrden.tipo_orden, newOrden.id_deposito, isMaster]);

  const selectedItem = useMemo(() => {
    if (!newOrden.id_lote) return null;
    return (inventario || []).find((x) => String(x.lote_id) === String(newOrden.id_lote)) || null;
  }, [inventario, newOrden.id_lote]);

  const openInvInfo = async () => {
    if (!selectedItem?.id_inventario) return;
    setShowInvInfo(true);
    setInvInfo(null);
    setInvInfoLoading(true);
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/recursos/inventario-detalle/${selectedItem.id_inventario}`);
      setInvInfo(data || null);
    } catch (e) {
      alert(e?.message || "No se pudo cargar el detalle del lote");
    } finally {
      setInvInfoLoading(false);
    }
  };

  const resetNewOrden = () => {
    setStep(1);
    setNewOrden({
      titulo: "",
      descripcion: "",
      prioridad: "Media",
      id_deposito: "",
      id_empleado: "",
      fecha_limite: "",
      tipo_orden: "General",

      id_lote: "",
      cantidad: 0,
      nueva_ubicacion: "",
      id_sector_destino: "",
      id_maquinaria: "",

      id_solicitud_origen: null
    });
    setInventario([]);
    setSectores([]);
    setMaquinarias([]);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (step === 1) {
      if (newOrden.titulo?.trim()) setStep(2);
      else alert("El título es obligatorio.");
      return;
    }

    // ✅ validaciones mínimas seguras para Movimiento
    if (newOrden.tipo_orden === "Movimiento") {
      if (!newOrden.id_lote) return alert("Seleccioná un lote.");
      const qty = Number(newOrden.cantidad);
      if (!qty || qty <= 0) return alert("Cantidad inválida.");
      if (!newOrden.id_sector_destino) return alert("Seleccioná un sector destino.");
      if (!newOrden.id_maquinaria) return alert("Seleccioná una maquinaria.");
    }

    try {
      // Nos aseguramos de enviar la fecha limite
      const ordenPayload = { ...newOrden, id_empleado: null };

      if (newOrden.id_solicitud_origen) {
        await apiFetch(`${API_BASE_URL}/api/ordenes/crear-desde-solicitud`, {
          method: "POST",
          body: JSON.stringify({
            id_solicitud: newOrden.id_solicitud_origen,
            id_empleado: null,
            titulo: newOrden.titulo,
            descripcion: newOrden.descripcion,
            prioridad: newOrden.prioridad,
            fecha_limite: newOrden.fecha_limite || null, // ✅ Se envía la fecha límite
            tipo_orden: newOrden.tipo_orden
          })
        });
      } else {
        if (!isMaster) delete ordenPayload.id_deposito;

        await apiFetch(`${API_BASE_URL}/api/ordenes`, {
          method: "POST",
          body: JSON.stringify(ordenPayload)
        });
      }

      setShowModalNew(false);
      resetNewOrden();
      loadOrdenes();
      alert("✅ Orden creada.");
    } catch (err) {
      alert("Error: " + (err?.message || "No se pudo crear la orden"));
    }
  };

  const handleGoToAssign = (orden) => {
    navigate("/empleados", { state: { assigningOrden: orden } });
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
      await apiFetch(`${API_BASE_URL}/api/ordenes/${selectedOrden.id}`, {
        method: "PUT",
        body: JSON.stringify({ accion: "editar_info", ...editForm })
      });
      setShowModalEdit(false);
      loadOrdenes();
    } catch (err) {
      alert("Error: " + (err?.message || "No se pudo editar"));
    }
  };

  const openUpdateModal = async (o) => {
    setSelectedOrden(o);
    setNuevoMensaje("");
    setAvancesList([]);
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/ordenes/${o.id}/avances`);
      setAvancesList(data || []);
    } catch (e) {
      console.error(e);
    }
    setShowModalUpdate(true);
  };

  const handlePostAvance = async () => {
    if (!nuevoMensaje.trim()) return;
    try {
      const resp = await apiFetch(`${API_BASE_URL}/api/ordenes/${selectedOrden.id}/avances`, {
        method: "POST",
        body: JSON.stringify({ mensaje: nuevoMensaje })
      });
      if (resp.success) {
        setAvancesList([...avancesList, resp.avance]);
        setNuevoMensaje("");
      }
    } catch (e) {
      alert("Error: " + (e?.message || "No se pudo enviar avance"));
    }
  };

  // ✅ NUEVA LÓGICA DE FINALIZACIÓN CON CONTROL DE TIEMPO
  const handleFinalizarTarea = async () => {
    // 1. Verificamos si tiene fecha límite y si ya pasó
    let estadoFinal = "Completada";
    let mensajeConfirm = "¿Confirmar que la tarea está terminada?";

    if (selectedOrden.fecha_limite) {
      const ahora = new Date();
      const limite = new Date(selectedOrden.fecha_limite);
      
      // Si ahora es mayor al límite, está fuera de tiempo
      if (ahora > limite) {
        estadoFinal = "Fuera de Tiempo";
        mensajeConfirm = "⚠️ El tiempo límite ha expirado. ¿Deseas finalizar la tarea como 'Fuera de Tiempo'?";
      }
    }

    if (!window.confirm(mensajeConfirm)) return;

    try {
      await apiFetch(`${API_BASE_URL}/api/ordenes/${selectedOrden.id}`, {
        method: "PUT",
        body: JSON.stringify({ nuevo_estado: estadoFinal })
      });
      setShowModalUpdate(false);
      loadOrdenes();
    } catch (e) {
      console.error(e);
      alert("Error al finalizar: " + e.message);
    }
  };

  const deleteSoft = async (id) => {
    if (!window.confirm("¿Papelera?")) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/ordenes/${id}`, { method: "DELETE" });
      setOrdenes(ordenes.filter((o) => o.id !== id));
    } catch (error) {
      alert(error?.message || "No se pudo enviar a papelera");
    }
  };

  const permaDelete = async (id) => {
    if (!window.confirm("⚠️ ¿Destruir permanentemente?")) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/ordenes/${id}/perma`, { method: "DELETE" });
      setOrdenes(ordenes.filter((o) => o.id !== id));
    } catch (error) {
      alert(error?.message || "No se pudo eliminar");
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Órdenes de Trabajo</h1>
          <p className="subtitle">Gestión y monitoreo de tareas.</p>
        </div>

        {canManage && (
          <button className="btn-new" onClick={() => setShowModalNew(true)}>
            <Plus size={18} /> Crear Orden
          </button>
        )}
      </div>

      {rolUser === "Master_Admin" && (
        <div className="discord-card" style={{ padding: 12, marginBottom: 12 }}>
          <b>Filtrar por depósito:</b>
          <select
            className="discord-select"
            value={depositoFiltro}
            onChange={(e) => setDepositoFiltro(e.target.value)}
            style={{ marginLeft: 10, minWidth: 260 }}
          >
            <option value="TODOS">TODOS</option>
            {depositos.map((d) => (
              <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>
                {d.NOMBRE}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="ordenes-grid">
        {ordenes.map((orden) => {
          const isCompleted = ["Aprobada", "Completada", "Finalizada"].includes(orden.estado);
          const isLate = orden.estado === "Fuera de Tiempo"; // ✅ Detectamos si se entregó tarde
          const isExpired = orden.estado === "Fin de tiempo limite"; // ✅ Detectamos si el cron job la venció
          
          let estadoClase = orden.estado.toLowerCase().replace(/ /g, "-");
          let estadoTexto = orden.estado;

          if (isCompleted) {
            estadoClase = "completada";
            estadoTexto = "Completada";
          } else if (isExpired) {
            estadoTexto = "TIEMPO AGOTADO";
          } else if (isLate) {
            estadoClase = "vencida"; // Usará CSS de alerta/rojo
            estadoTexto = "FUERA DE TIEMPO";
          }

          return (
            <div key={orden.id} className={`orden-card priority-${orden.prioridad.toLowerCase()}`}>
              <div className="orden-header">
                {/* Badge de estado dinámico */}
                <span className={`badge-estado ${estadoClase}`} 
                      style={isLate ? { backgroundColor: "#ef4444", color: "white" } : {}}>
                  {estadoTexto}
                </span>
                <span className="orden-date">{orden.fecha_inicio}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3>{orden.titulo}</h3>
                {canManage && (
                  <button className="btn-icon-simple" onClick={() => openEditModal(orden)} title="Editar">
                    <Edit size={16} />
                  </button>
                )}
              </div>

              <p className="orden-desc" style={{ whiteSpace: "pre-wrap" }}>
                {orden.descripcion}
              </p>

              {orden.tipo_orden === "Movimiento" && (
                <div
                  style={{
                    background: "#f0f9ff",
                    padding: "8px",
                    borderRadius: "6px",
                    margin: "10px 0",
                    fontSize: "0.85rem",
                    color: "#0369a1",
                    border: "1px solid #bae6fd"
                  }}
                >
                  <div style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px" }}>
                    <Box size={14} /> Mover {orden.cantidad_mov}u
                  </div>
                  <div>
                    A:{" "}
                    {orden.sector_destino_codigo
                      ? `${orden.sector_destino_codigo} - ${orden.sector_destino_nombre || ""}`
                      : "—"}
                    {orden.nueva_ubicacion ? ` (${orden.nueva_ubicacion})` : ""}
                  </div>
                  <div>
                    Maquinaria: {orden.maquinaria_nombre ? `${orden.maquinaria_nombre}${orden.maquinaria_tipo ? ` (${orden.maquinaria_tipo})` : ""}` : "—"}
                  </div>
                </div>
              )}

              {orden.fecha_limite_fmt && (
                <div
                  style={{
                    fontSize: "0.85rem",
                    // Si está vencida o entregada tarde, rojo oscuro. Si no, rojo suave
                    color: (isExpired || isLate) ? "#991b1b" : "#e11d48",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontWeight: 500
                  }}
                >
                  <Calendar size={14} /> Límite: {orden.fecha_limite_fmt}
                </div>
              )}

              {orden.tiempo_empleado && (
                <div
                  style={{
                    marginBottom: "10px",
                    fontSize: "0.9rem",
                    color: isLate ? "#b91c1c" : "#059669", // Rojo si tardó, verde si no
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  {isLate ? <Clock size={14} /> : <CheckCircle size={14} />} 
                  Tiempo: {orden.tiempo_empleado}
                </div>
              )}

              <div className="orden-meta">
                {!orden.empleado_nombre || orden.empleado_nombre.toLowerCase().includes("sin asignar") ? (
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
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <User size={14} className="meta-fallback-icon" />
                    )}
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
                {!orden.empleado_nombre || orden.empleado_nombre.toLowerCase().includes("sin asignar") ? (
                  canManage && (
                    <button className="btn-action primary" onClick={() => handleGoToAssign(orden)}>
                      Asignar <ArrowRight size={14} />
                    </button>
                  )
                ) : (
                  <button className="btn-action secondary" onClick={() => openUpdateModal(orden)}>
                    {canManage ? "Ver Bitácora" : ((isCompleted || isExpired || isLate) ? "Ver Bitácora" : "Avance / Finalizar")}
                  </button>
                )}

                {canManage && (
                  <button
                    className="btn-action danger"
                    onClick={() => deleteSoft(orden.id)}
                    style={{ marginLeft: "auto", flex: "0 0 auto", width: "40px" }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                {rolUser === "Master_Admin" && (
                  <button
                    className="btn-action danger"
                    onClick={() => permaDelete(orden.id)}
                    style={{ backgroundColor: "#7f1d1d", flex: "0 0 auto", width: "40px" }}
                  >
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
          <div className="discord-card modal-wizard" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="roles-header">
              <h2>{newOrden.id_solicitud_origen ? "Procesar Solicitud" : "Nueva Orden"}</h2>
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
                    <input
                      type="text"
                      autoFocus
                      required
                      value={newOrden.titulo}
                      onChange={(e) => setNewOrden({ ...newOrden, titulo: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Descripción detallada</label>
                    <textarea
                      rows="6"
                      required
                      value={newOrden.descripcion}
                      onChange={(e) => setNewOrden({ ...newOrden, descripcion: e.target.value })}
                      style={{ resize: "vertical" }}
                    />
                    <small style={{ color: "#aaa" }}>Tip: Puedes editar esta descripción antes de crear la orden.</small>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="fade-in">
                  {/* ✅ ACTUALIZADO: Input de Fecha Límite visible para TODOS los tipos de orden al principio del paso 2 */}
                  <div className="input-group" style={{ marginBottom: "15px", borderBottom: "1px solid #eee", paddingBottom: "15px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Calendar size={16} /> Fecha Límite (Opcional)
                    </label>
                    <input
                      type="datetime-local"
                      className="discord-select"
                      value={newOrden.fecha_limite}
                      onChange={(e) => setNewOrden({ ...newOrden, fecha_limite: e.target.value })}
                    />
                    <small style={{ color: "#888" }}>Si se deja vacío, no tendrá vencimiento.</small>
                  </div>

                  {!newOrden.id_solicitud_origen && (
                    <div className="input-group" style={{ marginBottom: "15px" }}>
                      <label>Tipo de Tarea</label>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          className={`btn-status ${newOrden.tipo_orden === "General" ? "btn-primary" : ""}`}
                          onClick={() =>
                            setNewOrden({
                              ...newOrden,
                              tipo_orden: "General",
                              // reset movimiento
                              id_lote: "",
                              cantidad: 0,
                              nueva_ubicacion: "",
                              id_sector_destino: "",
                              id_maquinaria: ""
                            })
                          }
                        >
                          General
                        </button>
                        <button
                          type="button"
                          className={`btn-status ${newOrden.tipo_orden === "Movimiento" ? "btn-primary" : ""}`}
                          onClick={() =>
                            setNewOrden({
                              ...newOrden,
                              tipo_orden: "Movimiento",
                              prioridad: "Media", // no molesta
                            })
                          }
                        >
                          <ArrowRightLeft size={14} style={{ marginRight: 5 }} /> Movimiento Interno
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ✅ Para Master: elegir depósito ANTES cuando es Movimiento */}
                  {isMaster ? (
                    <div className="input-group" style={{ marginTop: "5px" }}>
                      <label>Depósito (Master Admin)</label>
                      <select
                        className="discord-select"
                        required
                        value={newOrden.id_deposito}
                        onChange={(e) =>
                          setNewOrden({
                            ...newOrden,
                            id_deposito: e.target.value,
                            // reset movimiento al cambiar depósito
                            id_lote: "",
                            id_sector_destino: "",
                            id_maquinaria: "",
                          })
                        }
                      >
                        <option value="">-- Seleccionar --</option>
                        {depositos.map((d) => (
                          <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>
                            {d.NOMBRE}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div
                      className="info-box"
                      style={{
                        background: "#f0f9ff",
                        padding: "10px",
                        borderRadius: "6px",
                        marginTop: "10px",
                        border: "1px solid #bae6fd"
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.85rem",
                          color: "#0369a1",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        <MapPin size={14} />
                        <b>Depósito:</b> Se asignará automáticamente a tu sucursal.
                      </p>
                    </div>
                  )}

                  {newOrden.tipo_orden === "Movimiento" ? (
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        marginBottom: "15px",
                        marginTop: "12px"
                      }}
                    >
                      <div className="input-group">
                        <label>Material / Lote a Mover</label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select
                            className="discord-select"
                            value={newOrden.id_lote}
                            onChange={(e) =>
                              setNewOrden({
                                ...newOrden,
                                id_lote: e.target.value,
                              })
                            }
                            required
                            style={{ flex: 1 }}
                            disabled={isMaster && !newOrden.id_deposito}
                          >
                            <option value="">
                              {isMaster && !newOrden.id_deposito
                                ? "-- Elegí depósito primero --"
                                : "-- Seleccionar del stock --"}
                            </option>
                            {(inventario || []).map((item) => (
                              <option key={item.id_inventario} value={item.lote_id}>
                                {item.material} — Lote {item.lote_codigo || item.lote_id} — Disp: {item.cantidad} {item.unidad}
                                {item.sector_codigo ? ` — Sector: ${item.sector_codigo}` : ""}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            className="btn-icon-simple"
                            onClick={openInvInfo}
                            title="Ver detalles del lote"
                            disabled={!selectedItem?.id_inventario}
                            style={{ width: 42, height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Info size={16} />
                          </button>
                        </div>

                        {/* mini resumen bonito */}
                        {selectedItem && (
                          <div style={{ marginTop: 8, fontSize: "0.85rem", color: "#334155" }}>
                            <b>{selectedItem.material}</b> • Lote <span style={{ fontFamily: "monospace" }}>{selectedItem.lote_codigo || selectedItem.lote_id}</span>{" "}
                            • Disponible: <b>{selectedItem.cantidad} {selectedItem.unidad}</b>{" "}
                            {selectedItem.sector_codigo ? `• Sector actual: ${selectedItem.sector_codigo}` : ""}
                          </div>
                        )}
                      </div>

                      <div className="row-2" style={{ display: "flex", gap: "10px" }}>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label>Cantidad a mover</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={newOrden.cantidad}
                            onChange={(e) => setNewOrden({ ...newOrden, cantidad: parseFloat(e.target.value || "0") })}
                          />
                          {selectedItem?.unidad && (
                            <small style={{ color: "#64748b" }}>Unidad: {selectedItem.unidad}</small>
                          )}
                        </div>

                        <div className="input-group" style={{ flex: 1 }}>
                          <label>Sector destino</label>
                          <select
                            className="discord-select"
                            required
                            value={newOrden.id_sector_destino}
                            onChange={(e) => setNewOrden({ ...newOrden, id_sector_destino: e.target.value })}
                            disabled={isMaster && !newOrden.id_deposito}
                          >
                            <option value="">-- Seleccionar --</option>
                            {(sectores || []).map((s) => (
                              <option key={s.id_sector} value={s.id_sector}>
                                {s.codigo} - {s.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="row-2" style={{ display: "flex", gap: "10px" }}>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label>Maquinaria</label>
                          <select
                            className="discord-select"
                            required
                            value={newOrden.id_maquinaria}
                            onChange={(e) => setNewOrden({ ...newOrden, id_maquinaria: e.target.value })}
                            disabled={isMaster && !newOrden.id_deposito}
                          >
                            <option value="">-- Seleccionar --</option>
                            {(maquinarias || []).map((m) => (
                              <option key={m.id_maquinaria} value={m.id_maquinaria}>
                                {m.nombre}{m.tipo ? ` (${m.tipo})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="input-group" style={{ flex: 1 }}>
                          <label>Detalle ubicación (Opcional)</label>
                          <input
                            type="text"
                            placeholder="Ej: Estante 3, Posición 2"
                            value={newOrden.nueva_ubicacion}
                            onChange={(e) => setNewOrden({ ...newOrden, nueva_ubicacion: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="input-group">
                        <label>Prioridad</label>
                        <select
                          className="discord-select"
                          value={newOrden.prioridad}
                          onChange={(e) => setNewOrden({ ...newOrden, prioridad: e.target.value })}
                        >
                          <option value="Baja">🟢 Baja</option>
                          <option value="Media">🟡 Media</option>
                          <option value="Alta">🔴 Alta</option>
                        </select>
                      </div>

                      {/* para General: el depósito master ya lo eligió arriba */}
                      {!isMaster && (
                        <div
                          className="info-box"
                          style={{
                            background: "#f0f9ff",
                            padding: "10px",
                            borderRadius: "6px",
                            marginTop: "10px",
                            border: "1px solid #bae6fd"
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.85rem",
                              color: "#0369a1",
                              display: "flex",
                              alignItems: "center",
                              gap: "5px"
                            }}
                          >
                            <MapPin size={14} />
                            <b>Depósito:</b> Se asignará automáticamente a tu sucursal.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="wizard-buttons" style={{ marginTop: "20px" }}>
                {step === 1 ? (
                  <button
                    type="button"
                    className="btn-status btn-danger"
                    onClick={() => {
                      setShowModalNew(false);
                      resetNewOrden();
                    }}
                  >
                    Cancelar
                  </button>
                ) : (
                  <button type="button" className="btn-status" onClick={() => setStep(1)}>
                    <ArrowLeft size={16} /> Atrás
                  </button>
                )}

                {step === 1 ? (
                  <button type="submit" className="btn-save">
                    Siguiente <ArrowRight size={16} />
                  </button>
                ) : (
                  <button type="submit" className="btn-save">
                    Finalizar y Crear
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* ✅ Modal de info inventario */}
          {showInvInfo && (
            <div className="modal-backdrop" onClick={() => setShowInvInfo(false)}>
              <div className="discord-card" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{ borderBottom: "1px solid #eee", paddingBottom: 10 }}>
                  <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Detalle del Lote</h2>
                  <small style={{ color: "#64748b" }}>Información del stock y ubicación</small>
                </div>

                <div style={{ paddingTop: 12 }}>
                  {invInfoLoading ? (
                    <div style={{ padding: 20, color: "#64748b" }}>Cargando...</div>
                  ) : !invInfo ? (
                    <div style={{ padding: 20, color: "#64748b" }}>Sin datos.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div><b>Material:</b> {invInfo.material || "—"}</div>
                      <div><b>Código material:</b> <span style={{ fontFamily: "monospace" }}>{invInfo.codigo_material || "—"}</span></div>
                      <div><b>Lote:</b> <span style={{ fontFamily: "monospace" }}>{invInfo.lote_codigo || invInfo.id_lote}</span></div>
                      <div><b>Estado:</b> {invInfo.estado || "Disponible"}</div>
                      <div><b>Disponible:</b> {invInfo.cantidad_disponible} {invInfo.unidad}</div>
                      <div>
                        <b>Sector actual:</b>{" "}
                        {invInfo.sector_codigo ? `${invInfo.sector_codigo} - ${invInfo.sector_nombre || ""}` : "—"}
                        {invInfo.ubicacion_detalle ? ` (${invInfo.ubicacion_detalle})` : ""}
                      </div>
                      <div><b>Fecha ingreso:</b> {invInfo.fecha_ingreso || "—"}</div>
                      <div style={{ color: "#64748b" }}><b>Obs lote:</b> {invInfo.obs_lote || "—"}</div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button className="btn-status btn-danger" onClick={() => setShowInvInfo(false)}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Modal EDIT --- */}
      {showModalEdit && (
        <div className="modal-backdrop">
          <div className="discord-card" style={{ width: "450px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header" style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
              <h2>Editar Orden</h2>
            </div>

            <form
              onSubmit={handleEditSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}
            >
              <div className="input-group">
                <label>Título</label>
                <input
                  type="text"
                  required
                  value={editForm.titulo}
                  onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label>Descripción</label>
                <textarea
                  rows="4"
                  required
                  value={editForm.descripcion}
                  onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                  style={{ whiteSpace: "pre-wrap" }}
                />
              </div>

              <div className="row-2" style={{ display: "flex", gap: "15px" }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Prioridad</label>
                  <select
                    className="discord-select"
                    value={editForm.prioridad}
                    onChange={(e) => setEditForm({ ...editForm, prioridad: e.target.value })}
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>

                <div className="input-group" style={{ flex: 1 }}>
                  <label>Fecha Límite</label>
                  <input
                    type="datetime-local"
                    className="discord-select"
                    value={editForm.fecha_limite}
                    onChange={(e) => setEditForm({ ...editForm, fecha_limite: e.target.value })}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "15px",
                  borderTop: "1px solid #eee",
                  paddingTop: "15px"
                }}
              >
                <button type="button" className="btn-status btn-danger" onClick={() => setShowModalEdit(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal BITÁCORA / AVANCES --- */}
      {showModalUpdate && selectedOrden && (
        <div className="modal-backdrop" onClick={() => setShowModalUpdate(false)}>
          <div
            className="discord-card"
            style={{ width: "500px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Bitácora: {selectedOrden.titulo}</h2>
              <small style={{ color: "#777" }}>Reporta tus progresos aquí</small>
            </div>

            <div
              className="avances-history"
              style={{
                flex: 1,
                overflowY: "auto",
                marginBottom: "15px",
                background: "#f9f9f9",
                padding: "15px",
                borderRadius: "8px",
                border: "1px solid #eee"
              }}
            >
              {avancesList.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#ccc" }}>
                  <Wrench size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                  <p>Sin avances registrados.</p>
                </div>
              ) : (
                avancesList.map((av) => (
                  <div key={av.id} style={{ marginBottom: "12px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#888", marginBottom: "4px" }}>
                      <span style={{ fontWeight: "bold", color: "#555" }}>{av.autor}</span>
                      <span>{av.fecha}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "#333", lineHeight: "1.4" }}>{av.mensaje}</p>
                  </div>
                ))
              )}
            </div>

            {selectedOrden.estado !== "Aprobada" &&
              selectedOrden.estado !== "Completada" &&
              selectedOrden.estado !== "Finalizada" &&
              selectedOrden.estado !== "Fin de tiempo limite" &&
              selectedOrden.estado !== "Fuera de Tiempo" &&
              !canManage && (
                <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Escribe tu avance..."
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePostAvance()}
                    autoFocus
                  />
                  <button className="btn-save" onClick={handlePostAvance} title="Enviar">
                    <Send size={16} />
                  </button>
                </div>
              )}

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #eee", paddingTop: "15px" }}>
              <button className="btn-status btn-danger" onClick={() => setShowModalUpdate(false)}>
                Cerrar
              </button>

              {selectedOrden.estado !== "Aprobada" &&
                selectedOrden.estado !== "Completada" &&
                selectedOrden.estado !== "Finalizada" &&
                selectedOrden.estado !== "Fin de tiempo limite" &&
                selectedOrden.estado !== "Fuera de Tiempo" &&
                !canManage && (
                  <button className="btn-save" style={{ background: "#23a559" }} onClick={handleFinalizarTarea}>
                    <CheckCircle size={16} style={{ marginRight: 5 }} /> Finalizar Tarea
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdenesTrabajo;