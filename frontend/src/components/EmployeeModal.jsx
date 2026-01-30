// frontend/src/components/EmployeeModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { apiFetch } from "../utils/api";
import {
  X,
  Save,
  Mail,
  Phone,
  Calendar,
  Shield,
  MapPin,
  FileText,
  Briefcase,
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  User, 
} from "lucide-react";
import "../styles/EmployeeModal.css";

const API_URL = "http://127.0.0.1:5000";

const EmployeeModal = ({
  employee,
  depositos,
  roles,
  onClose,
  onSave,
  onToggleStatus,
  asistencias = [],
  asistenciasLoading = false,
  asistenciasError = "",
}) => {
  const [formData, setFormData] = useState(employee ? { ...employee } : {});
  const [activeTab, setActiveTab] = useState("perfil");
  const [imgError, setImgError] = useState(false);

  const [employeeOrdenes, setEmployeeOrdenes] = useState([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);

  const asistenciasArr = useMemo(() => (Array.isArray(asistencias) ? asistencias : []), [asistencias]);

  const stats = useMemo(
    () => ({
      asistencias: asistenciasArr.length,
      faltas: 0, 
    }),
    [asistenciasArr]
  );

  const bannerColor = formData.banner_color || formData.BANNER_COLOR || "#5865F2";

  useEffect(() => {
    if (employee) {
      setFormData({ ...employee });
      setImgError(false);
    }
  }, [employee]);

  useEffect(() => {
    const fetchOrdenes = async () => {
      if (activeTab === "ordenes" && employee?.id) {
        setLoadingOrdenes(true);
        try {
          const data = await apiFetch(`${API_URL}/api/ordenes/empleado/${employee.id}`);
          setEmployeeOrdenes(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error("Error al cargar órdenes:", error);
          setEmployeeOrdenes([]);
        } finally {
          setLoadingOrdenes(false);
        }
      }
    };
    fetchOrdenes();
  }, [activeTab, employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!employee) return null;

  // --- AVATAR URL ---
  const getAvatarPath = () => {
    return formData.avatar || formData.AVATAR || formData.foto || null;
  };

  const getImageUrl = () => {
    const path = getAvatarPath();
    if (!path) return null;
    if (path instanceof File) return URL.createObjectURL(path);
    if (typeof path === "string" && (path.startsWith("http") || path.startsWith("blob:"))) {
      return path;
    }
    let cleanPath = path.toString().replace(API_URL, "");
    if (!cleanPath.startsWith("/")) cleanPath = `/${cleanPath}`;
    return `${API_URL}${cleanPath}`;
  };

  const currentImageUrl = getImageUrl();

  // ✅ Helpers asistencia
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderOrdenCard = (orden) => {
    const isCompleted = ["Aprobada", "Completada", "Finalizada"].includes(orden.estado);

    return (
      <div
        key={orden.id}
        style={{
          borderLeft: `4px solid ${isCompleted ? "var(--success)" : "var(--warning)"}`,
          background: "var(--gray-50)",
          padding: "1rem",
          marginBottom: "0.75rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--gray-200)",
          borderLeftWidth: "4px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.8rem",
            color: "var(--gray-500)",
            marginBottom: "0.25rem",
          }}
        >
          <span>#{orden.id}</span>
          <span>{orden.fecha_inicio}</span>
        </div>
        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "var(--gray-900)", fontWeight: 600 }}>
          {orden.titulo}
        </h4>
        <span
          style={{
            fontSize: "0.75rem",
            background: isCompleted ? "#DCFCE7" : "#FEF3C7",
            color: isCompleted ? "#166534" : "#92400E",
            padding: "0.25rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            fontWeight: 500,
          }}
        >
          {orden.estado}
        </span>
      </div>
    );
  };

  const renderAsistenciaItem = (a) => {
    const estado = a?.estado_hoy || "";
    const enJornada = estado === "EN_JORNADA";

    return (
      <div
        key={a?.id_asistencia ?? `${a?.entrada_iso}-${a?.salida_iso}`}
        style={{
          background: "var(--white)",
          border: "1px solid var(--gray-200)",
          borderRadius: "var(--radius)",
          padding: "0.9rem",
          marginBottom: "0.75rem",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
          <div style={{ fontWeight: 700, color: "var(--gray-900)" }}>{fmtDate(a?.entrada_iso)}</div>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "0.25rem 0.5rem",
              borderRadius: "999px",
              border: `1px solid ${enJornada ? "#86EFAC" : "#BFDBFE"}`,
              background: enJornada ? "#DCFCE7" : "#DBEAFE",
              color: enJornada ? "#166534" : "#1D4ED8",
            }}
          >
            {enJornada ? "EN JORNADA" : "FINALIZADO"}
          </span>
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--gray-600)" }}>
          <b>Entrada:</b> {fmtTime(a?.entrada_iso)} &nbsp;•&nbsp; <b>Salida:</b> {fmtTime(a?.salida_iso)} &nbsp;•&nbsp;{" "}
          <b>Método:</b> {a?.metodo || "—"}
        </div>
      </div>
    );
  };

  const modalContent = (
    <div className="employee-modal-overlay" onClick={onClose}>
      <div 
        className="employee-modal-content" 
        onClick={(e) => e.stopPropagation()}
        // ✅ Quitamos el estilo inline que rompía el scroll
      >
        {/* BOTÓN CERRAR FLOTANTE */}
        <button 
            className="btn-close-modal" 
            onClick={onClose}
            title="Cerrar"
        >
            <X size={24} />
        </button>

        {/* BANNER (Parte del flujo normal ahora) */}
        <div style={{ height: "100px", backgroundColor: bannerColor, width: "100%", flexShrink: 0 }} />

        {/* CONTENIDO PRINCIPAL */}
        <div className="modal-content-body">
            
            {/* HEADER CON AVATAR */}
            <div className="employee-modal-header" style={{ marginTop: "-50px", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                    
                    {/* AVATAR */}
                    <div
                        style={{
                            width: "6rem",
                            height: "6rem",
                            borderRadius: "50%",
                            background: "var(--white)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                            border: "4px solid var(--white)",
                            overflow: "hidden",
                            position: "relative",
                            flexShrink: 0,
                            marginTop: "0" 
                        }}
                    >
                    {getAvatarPath() && !imgError ? (
                        <img
                        src={currentImageUrl}
                        alt="Perfil"
                        onError={() => setImgError(true)}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : (
                        <div
                        style={{
                            width: "100%",
                            height: "100%",
                            backgroundColor: bannerColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: "bold",
                            fontSize: "2.5rem",
                            textTransform: "uppercase",
                        }}
                        >
                        {formData.nombre ? formData.nombre.charAt(0) : <User size={40} />}
                        </div>
                    )}
                    </div>

                    {/* DATOS DE TEXTO (Bajados para que caigan en lo blanco) */}
                    <div style={{ marginTop: "60px" }}> 
                        <h2 style={{ fontSize: "1.5rem", lineHeight: "1.2", marginBottom: "4px" }}>
                            {formData.nombre} {formData.apellido}
                        </h2>
                        <span style={{ fontSize: "0.9rem", color: "var(--gray-500)", fontWeight: 500 }}>
                            {formData.rol || "Sin Rol Asignado"}
                        </span>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div
            style={{
                display: "flex",
                gap: "2rem",
                borderBottom: "1px solid var(--gray-200)",
                marginBottom: "1.5rem",
                paddingBottom: "1px",
            }}
            >
            {["perfil", "ordenes", "asistencia"].map((tab) => (
                <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                    background: "none",
                    border: "none",
                    borderBottom: activeTab === tab ? `2px solid ${bannerColor}` : "2px solid transparent",
                    color: activeTab === tab ? bannerColor : "var(--gray-500)",
                    fontWeight: activeTab === tab ? 600 : 500,
                    padding: "0.5rem 0",
                    cursor: "pointer",
                    textTransform: "capitalize",
                    fontSize: "0.95rem",
                    transition: "all 0.2s",
                }}
                >
                {tab}
                </button>
            ))}
            </div>

            {/* BODY */}
            <div className="modal-body">
            {/* PERFIL */}
            {activeTab === "perfil" && (
                <form onSubmit={handleSubmit} className="fade-in">
                <div className="employee-form-grid">
                    <div className="full-width form-group">
                    <label>
                        <Mail size={14} style={{ marginRight: 5 }} /> Correo Electrónico
                    </label>
                    <input className="form-input" type="email" name="correo" value={formData.correo || ""} onChange={handleChange} />
                    </div>

                    <div className="form-group">
                    <label>
                        <Phone size={14} style={{ marginRight: 5 }} /> Teléfono
                    </label>
                    <input className="form-input" type="text" name="telefono" value={formData.telefono || ""} onChange={handleChange} />
                    </div>

                    <div className="form-group">
                    <label>
                        <FileText size={14} style={{ marginRight: 5 }} /> Cédula / DNI
                    </label>
                    <input className="form-input" type="text" name="NUMERO_DOCUMENTO" value={formData.NUMERO_DOCUMENTO || ""} onChange={handleChange} />
                    </div>

                    <div className="full-width form-group">
                    <label>
                        <Calendar size={14} style={{ marginRight: 5 }} /> Fecha de Nacimiento
                    </label>
                    <input className="form-input" type="date" name="FECHA_NACIMIENTO" value={formData.FECHA_NACIMIENTO || ""} onChange={handleChange} />
                    </div>

                    <div className="form-group">
                    <label>
                        <Shield size={14} style={{ marginRight: 5 }} /> Rol / Cargo
                    </label>
                    <select name="rol_id" value={formData.rol_id || ""} onChange={handleChange} className="form-select">
                        <option value="">Seleccionar Rol</option>
                        {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                            {r.nombre}
                        </option>
                        ))}
                    </select>
                    </div>

                    <div className="form-group">
                    <label>
                        <MapPin size={14} style={{ marginRight: 5 }} /> Depósito Base
                    </label>
                    <select name="ID_DEPOSITO" value={formData.ID_DEPOSITO || ""} onChange={handleChange} className="form-select">
                        <option value="">Seleccionar Depósito</option>
                        {depositos.map((d) => (
                        <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>
                            {d.NOMBRE}
                        </option>
                        ))}
                    </select>
                    </div>
                </div>

                <div className="status-toggle-wrapper">
                    <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--gray-800)", display: "block" }}>
                        Estado de la cuenta
                    </label>
                    <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>Habilitar o deshabilitar acceso</span>
                    </div>

                    <button
                    type="button"
                    onClick={() => onToggleStatus(employee.id)}
                    style={{
                        background: formData.estado ? "#DCFCE7" : "#FEE2E2",
                        color: formData.estado ? "#166534" : "#991B1B",
                        border: `1px solid ${formData.estado ? "#86EFAC" : "#FECACA"}`,
                        padding: "0.5rem 1rem",
                        borderRadius: "var(--radius)",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s",
                    }}
                    >
                    {formData.estado ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {formData.estado ? "ACTIVO" : "INACTIVO"}
                    </button>
                </div>

                <div className="employee-modal-footer">
                    <button type="button" className="btn-cancel" onClick={onClose}>
                    Cancelar
                    </button>
                    {/* ✅ Botón guardar usa el color del banner */}
                    <button 
                        type="submit" 
                        className="btn-save" 
                        style={{ background: bannerColor, color: "white" }} 
                    >
                    <Save size={18} style={{ marginRight: 6 }} /> Guardar Ficha
                    </button>
                </div>
                </form>
            )}

            {/* ORDENES */}
            {activeTab === "ordenes" && (
                <div className="fade-in" style={{ minHeight: "200px" }}>
                {loadingOrdenes ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--gray-500)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <Loader2 className="animate-spin" size={30} color={bannerColor} />
                    <span>Cargando historial...</span>
                    </div>
                ) : employeeOrdenes.length > 0 ? (
                    <div style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "5px" }}>{employeeOrdenes.map(renderOrdenCard)}</div>
                ) : (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--gray-400)", border: "2px dashed var(--gray-200)", borderRadius: "var(--radius)" }}>
                    <Briefcase size={48} style={{ opacity: 0.2, marginBottom: 15, margin: "0 auto" }} />
                    <p style={{ fontWeight: 500 }}>Sin órdenes asignadas</p>
                    </div>
                )}
                </div>
            )}

            {/* ASISTENCIA */}
            {activeTab === "asistencia" && (
                <div className="fade-in">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                    <div style={{ background: "#F0FDF4", padding: "1.5rem", borderRadius: "var(--radius)", textAlign: "center", border: "1px solid #BBF7D0" }}>
                    <div style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--success)" }}>{stats.asistencias}</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#166534" }}>Asistencias</div>
                    </div>
                    <div style={{ background: "#FEF2F2", padding: "1.5rem", borderRadius: "var(--radius)", textAlign: "center", border: "1px solid #FECACA" }}>
                    <div style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--error)" }}>{stats.faltas}</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#991B1B" }}>Faltas / Retardos</div>
                    </div>
                </div>

                {asistenciasLoading ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--gray-500)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", background: "var(--gray-50)", borderRadius: "var(--radius)", border: "1px solid var(--gray-200)" }}>
                    <Loader2 className="animate-spin" size={30} color={bannerColor} />
                    <span>Cargando asistencias...</span>
                    </div>
                ) : asistenciasError ? (
                    <div style={{ textAlign: "center", color: "#991B1B", padding: "1.2rem", background: "#FEF2F2", borderRadius: "var(--radius)", border: "1px solid #FECACA", fontWeight: 600 }}>
                    {asistenciasError}
                    </div>
                ) : asistenciasArr.length > 0 ? (
                    <div style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "5px" }}>
                    {asistenciasArr.map(renderAsistenciaItem)}
                    </div>
                ) : (
                    <div style={{ textAlign: "center", color: "var(--gray-500)", padding: "2rem", background: "var(--gray-50)", borderRadius: "var(--radius)", border: "1px dashed var(--gray-200)" }}>
                    <Clock size={24} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No hay registros recientes de actividad</p>
                    </div>
                )}
                </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default EmployeeModal;