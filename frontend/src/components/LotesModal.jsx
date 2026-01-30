// src/components/LotesModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../utils/api";
import {
  X,
  Plus,
  AlertTriangle,
  CheckCircle,
  Search,
  Barcode,
  Calendar,
  Box,
  FileText,
  Trash2,
  History,
  Info // ✅ Nuevo icono importado
} from "lucide-react";
import "../styles/LotesModal.css";

const API_URL = "http://127.0.0.1:5000";

const LotesModal = ({ material, onClose, depositos }) => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [obsOpen, setObsOpen] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado] = useState("Todos");
  const [filterDeposito, setFilterDeposito] = useState("Todos");

  // ✅ Estados para el modal de detalle (Info)
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoData, setInfoData] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  const todayISO = () => new Date().toISOString().split("T")[0];

  const generarCodigo = () => {
    const fecha = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `L-${fecha}-${random}`;
  };

  const [newIngreso, setNewIngreso] = useState({
    codigo: generarCodigo(),
    cantidad: "",
    fecha_ingreso: todayISO(),
    id_deposito: "",
    observaciones: "",
  });

  // Default depósito cuando se cargan depósitos
  useEffect(() => {
    if (!depositos || depositos.length === 0) return;
    setNewIngreso((prev) => {
      if (prev.id_deposito) return prev;
      return { ...prev, id_deposito: String(depositos[0].ID_DEPOSITO) };
    });
  }, [depositos]);

  useEffect(() => {
    if (!material?.ID_MATERIAL) return;
    loadLotes();

    setNewIngreso((prev) => ({
      ...prev,
      codigo: generarCodigo(),
      cantidad: "",
      fecha_ingreso: todayISO(),
      observaciones: "",
      id_deposito:
        prev.id_deposito ||
        (depositos?.length ? String(depositos[0].ID_DEPOSITO) : ""),
    }));
    // eslint-disable-next-line
  }, [material?.ID_MATERIAL]);

  const loadLotes = async () => {
    if (!material?.ID_MATERIAL) return;
    setLoading(true);
    try {
      const data = await apiFetch(`${API_URL}/api/materiales/${material.ID_MATERIAL}/lotes`);
      setLotes(data || []);
    } catch (error) {
      console.error(error);
      setLotes([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Función para abrir el modal de Info
  const handleOpenInfo = async (lote) => {
    const idInv = lote.id_inventario;
    if (!idInv) return;

    setShowInfoModal(true);
    setInfoData(null);
    setLoadingInfo(true);

    try {
      // Reutilizamos el endpoint de detalle de inventario
      const data = await apiFetch(`${API_URL}/api/recursos/inventario-detalle/${idInv}`);
      setInfoData(data || null);
    } catch (e) {
      console.error(e);
      setInfoData(null); // Fallback si falla
    } finally {
      setLoadingInfo(false);
    }
  };

  const filteredLotes = useMemo(() => {
    const texto = (searchTerm || "").toLowerCase();

    return (lotes || []).filter((lote) => {
      const depTxt = (lote.deposito || "").toLowerCase();
      const codTxt = (lote.codigo || "").toLowerCase();
      const obsTxt = (lote.observaciones || "").toLowerCase();

      const matchTexto =
        depTxt.includes(texto) || codTxt.includes(texto) || obsTxt.includes(texto);

      const matchEstado = filterEstado === "Todos" || lote.estado === filterEstado;

      const matchDeposito =
        filterDeposito === "Todos" || String(lote.deposito_id) === String(filterDeposito);

      return matchTexto && matchEstado && matchDeposito;
    });
  }, [lotes, searchTerm, filterEstado, filterDeposito]);

  const handleAlta = async (e) => {
    e.preventDefault();

    const idDep = newIngreso.id_deposito;
    if (!idDep) return alert("Seleccioná un depósito.");
    const qty = Number(newIngreso.cantidad);
    if (!qty || qty <= 0) return alert("Cantidad inválida");

    try {
      const payload = {
        id_material: material.ID_MATERIAL,
        codigo: newIngreso.codigo,
        cantidad: qty,
        fecha_ingreso: newIngreso.fecha_ingreso,
        id_deposito: Number(idDep),
        observaciones: newIngreso.observaciones || "",
      };

      await apiFetch(`${API_URL}/api/lotes/ingreso`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert(`✅ Lote registrado: ${newIngreso.codigo}`);
      await loadLotes();

      setNewIngreso((prev) => ({
        ...prev,
        codigo: generarCodigo(),
        cantidad: "",
        observaciones: "",
      }));
    } catch (error) {
      alert("Error: " + (error?.message || "No se pudo registrar el lote"));
    }
  };

  const setEstadoLote = async (lote, nuevoEstado) => {
    const idInv = lote?.id_inventario;
    if (!idInv) return alert("Este lote no tiene id_inventario, no puedo cambiarle el estado.");

    if (!window.confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) return;

    try {
      await apiFetch(`${API_URL}/api/inventario/${idInv}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      await loadLotes();
    } catch (e) {
      alert(e?.message || "Error cambiando estado");
    }
  };

  const handleToggleDanado = (lote) => {
    const nuevoEstado = lote.estado === "Dañado" ? "Disponible" : "Dañado";
    setEstadoLote(lote, nuevoEstado);
  };

  const handleToggleAntiguo = (lote) => {
    const nuevoEstado = lote.estado === "Antiguo" ? "Disponible" : "Antiguo";
    setEstadoLote(lote, nuevoEstado);
  };

  const handleDeleteLote = async (lote) => {
    const idInv = lote?.id_inventario;
    if (!idInv) return alert("Este lote no tiene id_inventario, no puedo borrarlo.");

    const rol = (sessionStorage.getItem("user_rol") || sessionStorage.getItem("rol_nombre") || "").trim();
    const esMaster = rol === "Master_Admin";

    const ok = window.confirm(
      esMaster
        ? `⚠️ Vas a borrar PERMANENTEMENTE el lote "${lote.codigo || "S/C"}".\n\nEsto no se puede deshacer.\n¿Confirmás?`
        : `Vas a enviar a papelera el lote "${lote.codigo || "S/C"}" (soft delete).\n\n¿Confirmás?`
    );
    if (!ok) return;

    try {
      const url = esMaster
        ? `${API_URL}/api/inventario/${idInv}/perma`
        : `${API_URL}/api/inventario/${idInv}`;

      await apiFetch(url, { method: "DELETE" });

      alert(esMaster ? "🗑️ Lote eliminado permanentemente." : "🧺 Lote enviado a papelera.");
      await loadLotes();
    } catch (e) {
      alert("Error: " + (e?.message || "No se pudo borrar el lote"));
    }
  };

  const renderBadge = (cat) => {
    const map = {
      Conductores: "#3b82f6",
      Aisladores: "#8b5cf6",
      Protección: "#f97316",
      Ferretería: "#64748b",
    };
    const color = map[cat] || "#64748b";
    return (
      <span
        style={{
          backgroundColor: `${color}20`,
          color: color,
          border: `1px solid ${color}40`,
          fontSize: "0.75rem",
          padding: "4px 10px",
          borderRadius: "12px",
          fontWeight: 700,
        }}
      >
        {cat}
      </span>
    );
  };

  const estadoStyles = (estado) => {
    if (estado === "Dañado") {
      return { bg: "#fee2e2", fg: "#991b1b" };
    }
    if (estado === "Antiguo") {
      return { bg: "#fef3c7", fg: "#92400e" };
    }
    return { bg: "#dcfce7", fg: "#166534" };
  };

  const qtyColor = (estado) => {
    if (estado === "Dañado") return "#ef4444";
    if (estado === "Antiguo") return "#f59e0b";
    return "#10b981";
  };

  const rowBg = (estado) => {
    if (estado === "Dañado") return "#fef2f2";
    if (estado === "Antiguo") return "#fffbeb";
    return "transparent";
  };

  return (
    <div className="lotes-modal-overlay" onClick={onClose}>
      <div className="lotes-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="lotes-modal-header">
          <div className="lotes-header-info">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <h2 className="lotes-header-title">{material?.NOMBRE}</h2>
              {renderBadge(material?.CATEGORIA || material?.categoria)}
            </div>
            <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>
              Código Material:{" "}
              <strong style={{ color: "#fff", fontFamily: "monospace" }}>
                #{material?.CODIGO_UNICO}
              </strong>
            </div>
          </div>
          <button className="lotes-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="lotes-modal-body">
          {/* INGRESO */}
          <div className="ingreso-section">
            <h4 className="ingreso-title">
              <Plus size={20} color="#4ade80" /> Recepción Manual (Ingreso)
            </h4>

            <form onSubmit={handleAlta} className="ingreso-form">
              {/* CÓDIGO */}
              <div className="lotes-input-group">
                <label className="lotes-label" style={{ color: "#fbbf24" }}>
                  <Barcode size={14} /> Cód. Lote
                </label>
                <input
                  type="text"
                  value={newIngreso.codigo}
                  onChange={(e) => setNewIngreso({ ...newIngreso, codigo: e.target.value })}
                  className="input-dark codigo-input"
                  style={{
                    fontFamily: "monospace",
                    color: "#fbbf24",
                    textAlign: "center",
                    fontWeight: "bold",
                    letterSpacing: "1px",
                  }}
                />
              </div>

              {/* DEPÓSITO */}
              <div className="lotes-input-group">
                <label className="lotes-label" style={{ color: "#9ca3af" }}>
                  <Box size={14} /> Depósito
                </label>
                <select
                  value={String(newIngreso.id_deposito || "")}
                  onChange={(e) => setNewIngreso({ ...newIngreso, id_deposito: e.target.value })}
                  className="input-dark"
                  disabled={!depositos || depositos.length === 0}
                >
                  {(!depositos || depositos.length === 0) && (
                    <option value="">Cargando depósitos...</option>
                  )}
                  {(depositos || []).map((d) => (
                    <option key={d.ID_DEPOSITO} value={String(d.ID_DEPOSITO)}>
                      {d.NOMBRE}
                    </option>
                  ))}
                </select>
              </div>

              {/* FECHA */}
              <div className="lotes-input-group">
                <label className="lotes-label" style={{ color: "#9ca3af" }}>
                  <Calendar size={14} /> Fecha
                </label>
                <input
                  type="date"
                  required
                  value={newIngreso.fecha_ingreso}
                  onChange={(e) => setNewIngreso({ ...newIngreso, fecha_ingreso: e.target.value })}
                  className="input-dark"
                />
              </div>

              {/* CANTIDAD */}
              <div className="lotes-input-group">
                <label className="lotes-label" style={{ color: "#9ca3af" }}>
                  Cantidad
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    required
                    value={newIngreso.cantidad}
                    onChange={(e) => setNewIngreso({ ...newIngreso, cantidad: e.target.value })}
                    placeholder="0.00"
                    className="cantidad-input"
                    style={{ paddingRight: "60px" }}
                  />
                  <span className="qty-unit-modal">
                    {material?.UNIDAD || material?.UNIDAD_MEDIDA}
                  </span>
                </div>
              </div>

              {/* OBS + SUBMIT */}
              <div className="obs-standalone-wrapper" style={{ gridColumn: "1 / -1" }}>
                <label className="lotes-label" style={{ color: "#9ca3af" }}>
                  <FileText size={14} /> Observación
                </label>

                <div className={`obs-input-container ${obsOpen ? "open" : ""}`}>
                  <textarea
                    value={newIngreso.observaciones}
                    onChange={(e) => setNewIngreso({ ...newIngreso, observaciones: e.target.value })}
                    className="input-dark obs-input"
                    placeholder="Haz clic para escribir tu observación..."
                    onFocus={() => setObsOpen(true)}
                    onBlur={() => setObsOpen(false)}
                  />
                </div>

                <div className="lotes-input-group" style={{ marginTop: 10 }}>
                  <button type="submit" className="btn-ingreso">
                    Recepcionar
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* FILTROS */}
          <div className="lotes-toolbar">
            <div style={{ position: "relative", width: "300px" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                placeholder="Buscar por código, obs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-pro"
                style={{
                  paddingLeft: "36px",
                  width: "100%",
                  height: "40px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
            </div>

            <div style={{ flex: 1 }} />

            <select
              value={filterDeposito}
              onChange={(e) => setFilterDeposito(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                height: "40px",
              }}
            >
              <option value="Todos">🏭 Todos los Depósitos</option>
              {(depositos || []).map((d) => (
                <option key={d.ID_DEPOSITO} value={String(d.ID_DEPOSITO)}>
                  {d.NOMBRE}
                </option>
              ))}
            </select>
          </div>

          {/* TABLA */}
          <div className="lotes-table-container">
            <div style={{ maxHeight: "350px", overflowY: "auto" }}>
              <table className="lotes-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr>
                    <th>Código Lote</th>
                    <th>Fecha</th>
                    <th>Depósito</th>
                    <th>Cantidad</th>
                    <th>Estado</th>
                    {/* ❌ Columna Observación eliminada */}
                    <th style={{ textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "30px" }}>
                        Cargando lotes...
                      </td>
                    </tr>
                  ) : filteredLotes.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                        No hay lotes registrados para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredLotes.map((lote, idx) => {
                      const key = lote?.id_inventario || lote?.codigo || idx;
                      const st = estadoStyles(lote.estado);

                      return (
                        <tr
                          key={key}
                          style={{ backgroundColor: rowBg(lote.estado) }}
                        >
                          <td style={{ fontFamily: "monospace", fontWeight: "700", color: "#6366f1" }}>
                            {lote.codigo || "S/C"}
                          </td>
                          <td>{lote.fecha_ingreso}</td>
                          <td style={{ fontWeight: "600" }}>{lote.deposito}</td>
                          <td
                            style={{
                              fontWeight: "700",
                              color: qtyColor(lote.estado),
                            }}
                          >
                            {lote.cantidad} {material?.UNIDAD || material?.UNIDAD_MEDIDA}
                          </td>
                          <td>
                            <span
                              style={{
                                backgroundColor: st.bg,
                                color: st.fg,
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontWeight: "700",
                                fontSize: "0.75rem",
                              }}
                            >
                              {lote.estado}
                            </span>
                          </td>
                          {/* ❌ Celda Observación eliminada */}
                          <td style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            
                            {/* ✅ Botón INFO (Ver Detalles) */}
                            <button
                                style={{
                                    backgroundColor: "#3b82f6", // Azul info
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    padding: "6px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                }}
                                onClick={() => handleOpenInfo(lote)}
                                title="Ver Detalles del Lote"
                            >
                                <Info size={16} />
                            </button>

                            {/* Toggle Dañado/Disponible */}
                            <button
                              style={{
                                backgroundColor: lote.estado === "Dañado" ? "#22c55e" : "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                padding: "6px",
                                cursor: "pointer",
                                display: "inline-flex",
                              }}
                              onClick={() => handleToggleDanado(lote)}
                              title={lote.estado === "Dañado" ? "Marcar como Disponible" : "Marcar como Dañado"}
                            >
                              {lote.estado === "Dañado" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                            </button>

                            {/* Toggle Antiguo/Disponible */}
                            <button
                              style={{
                                backgroundColor: lote.estado === "Antiguo" ? "#22c55e" : "#f59e0b",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                padding: "6px",
                                cursor: "pointer",
                                display: "inline-flex",
                              }}
                              onClick={() => handleToggleAntiguo(lote)}
                              title={lote.estado === "Antiguo" ? "Quitar Antiguo (Disponible)" : "Marcar como Antiguo"}
                            >
                              <History size={16} />
                            </button>

                            {/* Delete */}
                            <button
                              style={{
                                backgroundColor: "#111827",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                padding: "6px",
                                cursor: "pointer",
                                display: "inline-flex",
                              }}
                              onClick={() => handleDeleteLote(lote)}
                              title="Borrar lote"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ MODAL DE INFO (DETALLES DEL LOTE) */}
      {showInfoModal && (
        <div className="lotes-modal-overlay" style={{zIndex: 1100}} onClick={() => setShowInfoModal(false)}>
            <div className="lotes-modal-content" style={{ width: 500, height: "auto", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
                <div className="lotes-modal-header" style={{ borderBottom: "1px solid #eee", paddingBottom: 10 }}>
                    <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Detalle del Lote</h2>
                    <button className="lotes-close-btn" onClick={() => setShowInfoModal(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: "20px", color: "#334155" }}>
                    {loadingInfo ? (
                        <div style={{ textAlign: "center", color: "#64748b" }}>Cargando información...</div>
                    ) : !infoData ? (
                        <div style={{ textAlign: "center", color: "#64748b" }}>No se encontró información.</div>
                    ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                            <div><b>Material:</b> {infoData.material || "—"}</div>
                            <div><b>Código material:</b> <span style={{ fontFamily: "monospace" }}>{infoData.codigo_material || "—"}</span></div>
                            <div><b>Lote:</b> <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#6366f1" }}>{infoData.lote_codigo || infoData.id_lote}</span></div>
                            <div><b>Estado:</b> {infoData.estado || "Disponible"}</div>
                            <div><b>Disponible:</b> {infoData.cantidad_disponible} {infoData.unidad}</div>
                            <div>
                                <b>Sector actual:</b>{" "}
                                {infoData.sector_codigo ? `${infoData.sector_codigo} - ${infoData.sector_nombre || ""}` : "—"}
                                {infoData.ubicacion_detalle ? ` (${infoData.ubicacion_detalle})` : ""}
                            </div>
                            <div><b>Fecha ingreso:</b> {infoData.fecha_ingreso || "—"}</div>
                            
                            <div style={{ 
                                marginTop: "10px", 
                                background: "#f1f5f9", 
                                padding: "10px", 
                                borderRadius: "6px",
                                borderLeft: "4px solid #cbd5e1"
                            }}>
                                <b>Observación:</b>
                                <p style={{ margin: "5px 0 0 0", fontSize: "0.9rem", color: "#475569" }}>
                                    {infoData.obs_lote || "Sin observaciones."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: "15px 20px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end" }}>
                    <button 
                        className="lotes-close-btn" 
                        style={{ position: "static", background: "#ef4444", color: "white", borderRadius: "6px", padding: "6px 12px", width: "auto", height: "auto" }} 
                        onClick={() => setShowInfoModal(false)}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default LotesModal;