// src/pages/Empleados.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";
import EmployeeModal from "../components/EmployeeModal";
import RegisterModal from "../components/RegisterModal";
import { useLocation, useNavigate } from "react-router-dom";
import { UserPlus, MoreHorizontal, AlertTriangle, Search, X, ChevronDown, Loader2, User } from "lucide-react";
import "../styles/Empleados.css";

const API = "http://127.0.0.1:5000";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeEmpleado = (raw) => {
  const nombre = raw?.nombre ?? raw?.NOMBRE ?? "";
  const apellido = raw?.apellido ?? raw?.APELLIDO ?? "";

  const ID_EMPLEADO = raw?.ID_EMPLEADO ?? raw?.id_empleado ?? raw?.ID ?? null;
  const ID_USUARIO = raw?.ID_USUARIO ?? raw?.usuario_id ?? raw?.id_usuario ?? null;

  // ⚠️ id lo dejamos tal cual venga (lo usan tus PUT /estado /etc),
  // pero garantizamos ID_EMPLEADO como fallback seguro.
  const id = raw?.id ?? raw?.ID_EMPLEADO ?? raw?.id_empleado ?? raw?.ID ?? raw?.ID_USUARIO ?? raw?.usuario_id ?? null;

  return {
    ...raw,
    id,
    ID_EMPLEADO: ID_EMPLEADO ?? id, // si no viene, cae al id (modo legacy)
    ID_USUARIO: ID_USUARIO ?? null,
    nombre,
    apellido,
    rol: raw?.rol ?? raw?.ROL ?? raw?.rol_nombre ?? "",
    ID_DEPOSITO: raw?.ID_DEPOSITO ?? raw?.deposito_id ?? raw?.id_deposito ?? null,
    estado: raw?.estado ?? raw?.ESTADO ?? raw?.ESTADO_ACTIVO ?? raw?.ESTADO_ACTIVO_BOOL ?? raw?.ACTIVO ?? raw?.activo ?? raw?.ESTADO_ACTIVO === true,
  };
};

const Empleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Asistencia
  const [asistenciaHoyIndex, setAsistenciaHoyIndex] = useState({});
  const [asistenciasEmpleado, setAsistenciasEmpleado] = useState([]);
  const [asistenciasEmpleadoLoading, setAsistenciasEmpleadoLoading] = useState(false);
  const [asistenciasEmpleadoError, setAsistenciasEmpleadoError] = useState("");

  // Buscador
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("nombre");

  // Asignación
  const location = useLocation();
  const navigate = useNavigate();
  const [ordenPendiente, setOrdenPendiente] = useState(null);

  useEffect(() => {
    loadData();
    if (location.state?.assigningOrden) {
      setOrdenPendiente(location.state.assigningOrden);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [empDataRaw, depData, rolData, asisHoy] = await Promise.all([
        apiFetch(`${API}/api/empleados`),
        apiFetch(`${API}/api/depositos`),
        apiFetch(`${API}/api/roles`),
        apiFetch(`${API}/api/asistencia/resumen-hoy`),
      ]);

      const empData = (empDataRaw || []).map(normalizeEmpleado);

      // ✅ index por empleado y por usuario
      const idx = {};
      (Array.isArray(asisHoy) ? asisHoy : []).forEach((r) => {
        const eid = toNum(r?.id_empleado);
        const uid = toNum(r?.usuario_id);
        if (eid != null) idx[`emp:${eid}`] = r;
        if (uid != null) idx[`usr:${uid}`] = r;
      });
      setAsistenciaHoyIndex(idx);

      const merged = empData.map((e) => {
        const keyEmp = toNum(e?.ID_EMPLEADO) != null ? `emp:${Number(e.ID_EMPLEADO)}` : null;
        const keyUsr = toNum(e?.ID_USUARIO) != null ? `usr:${Number(e.ID_USUARIO)}` : null;
        const asistencia = (keyEmp && idx[keyEmp]) || (keyUsr && idx[keyUsr]) || null;
        return { ...e, asistencia_hoy: asistencia };
      });

      setEmpleados(merged);
      setDepositos(depData || []);
      setRoles(rolData || []);
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Cargar últimas asistencias al abrir modal (con fallback de IDs)
  useEffect(() => {
    const run = async () => {
      setAsistenciasEmpleado([]);
      setAsistenciasEmpleadoError("");

      if (!selectedEmployee) return;

      const candidates = [
        selectedEmployee?.ID_EMPLEADO,
        selectedEmployee?.id_empleado,
        selectedEmployee?.id,
        selectedEmployee?.ID_USUARIO,
        selectedEmployee?.usuario_id,
        selectedEmployee?.id_usuario,
      ]
        .map(toNum)
        .filter((v) => v != null);

      const unique = Array.from(new Set(candidates));

      if (!unique.length) return;

      setAsistenciasEmpleadoLoading(true);

      try {
        let found = [];
        let lastErr = null;

        // probamos uno por uno hasta encontrar data
        for (const idAny of unique) {
          try {
            const res = await apiFetch(`${API}/api/asistencia/empleado/${idAny}/ultimas?limit=10`);
            const items = Array.isArray(res?.items) ? res.items : [];
            if (items.length) {
              found = items;
              break;
            }
          } catch (e) {
            lastErr = e;
          }
        }

        if (!found.length && lastErr) throw lastErr;

        setAsistenciasEmpleado(found);
      } catch (e) {
        setAsistenciasEmpleadoError(e?.message || "Error cargando asistencias del empleado");
      } finally {
        setAsistenciasEmpleadoLoading(false);
      }
    };

    run();
  }, [selectedEmployee?.id, selectedEmployee?.ID_EMPLEADO, selectedEmployee?.ID_USUARIO]);

  const formatText = (text) => {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getAvatarColor = (name) => {
    const colors = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"];
    const charCode = name ? name.charCodeAt(0) : 0;
    return colors[charCode % colors.length];
  };

  const renderAvatar = (empleado) => {
    if (empleado.AVATAR) {
      const imageUrl = `${API}${empleado.AVATAR}`;
      return (
        <img
          src={imageUrl}
          alt={empleado.nombre}
          className="avatar-img"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      );
    }
    return (
      <div className="avatar-placeholder" style={{ backgroundColor: getAvatarColor(empleado.nombre) }}>
        {empleado.nombre ? empleado.nombre.charAt(0).toUpperCase() : <User size={16} />}
      </div>
    );
  };

  const handleAsignarOrden = async (empleado) => {
    if (!ordenPendiente) return;
    if (!window.confirm(`¿Asignar la orden "${ordenPendiente.titulo}" a ${empleado.nombre}?`)) return;

    try {
      await apiFetch(`${API}/api/ordenes/${ordenPendiente.id}`, {
        method: "PUT",
        body: JSON.stringify({ id_empleado: empleado.id, accion: "asignar" }),
      });
      alert(`Orden asignada correctamente a ${empleado.nombre}`);
      setOrdenPendiente(null);
      navigate("/ordenes-trabajo");
    } catch (error) {
      alert("Error al asignar la orden: " + error.message);
    }
  };

  const cancelarAsignacion = () => {
    setOrdenPendiente(null);
    navigate(location.pathname, { replace: true, state: {} });
  };

  const handleSaveEmployee = async (formData) => {
    try {
      await apiFetch(`${API}/api/empleados/${formData.id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      alert("Empleado actualizado correctamente.");
      loadData();
      setSelectedEmployee(null);
    } catch (error) {
      alert("Error al actualizar: " + error.message);
    }
  };

  const handleToggleStatus = async (idEmpleado) => {
    if (!window.confirm("¿Seguro que deseas cambiar el estado de este empleado?")) return;
    try {
      await apiFetch(`${API}/api/empleados/${idEmpleado}/estado`, { method: "PUT" });
      loadData();
      setSelectedEmployee(null);
    } catch (error) {
      alert("Error al cambiar estado: " + error.message);
    }
  };

  const filteredEmpleados = useMemo(() => {
    return empleados.filter((e) => {
      const nombreNorm = (e.nombre || "").toLowerCase().trim();
      const apellidoNorm = (e.apellido || "").toLowerCase().trim();
      if (nombreNorm === "sin" && apellidoNorm === "asignar") return false;
      if (nombreNorm === "system" && apellidoNorm === "unassigned") return false;
      if (ordenPendiente && Number(e.ID_DEPOSITO) !== Number(ordenPendiente.deposito_id)) return false;
      if (!searchTerm) return true;

      const text = searchTerm.toLowerCase();
      switch (searchType) {
        case "nombre":
          return (e.nombre || "").toLowerCase().includes(text);
        case "apellido":
          return (e.apellido || "").toLowerCase().includes(text);
        case "rol":
          return (e.rol || "").toLowerCase().includes(text);
        case "deposito": {
          const nombreDeposito = depositos.find((d) => d.ID_DEPOSITO === e.ID_DEPOSITO)?.NOMBRE || "";
          return nombreDeposito.toLowerCase().includes(text);
        }
        default:
          return true;
      }
    });
  }, [empleados, depositos, ordenPendiente, searchTerm, searchType]);

  return (
    <div className="fade-in">
      {ordenPendiente && (
        <div className="assignment-banner fade-in-down">
          <div className="banner-content">
            <AlertTriangle size={20} className="text-amber-600" />
            <div>
              <strong>Modo Asignación:</strong> Selecciona un empleado para{" "}
              <span className="highlight-order">"{ordenPendiente.titulo}"</span>
              <div style={{ fontSize: "0.8rem", marginTop: "2px" }}>(Filtrando empleados del depósito correspondiente)</div>
            </div>
          </div>
          <button className="btn-cancel-assign" onClick={cancelarAsignacion}>
            Cancelar
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Empleados</h1>
          <p className="subtitle">Listado del personal {!isLoading && `(${filteredEmpleados.length})`}</p>
        </div>
        {!ordenPendiente && (
          <button className="btn-new" onClick={() => setShowCreateModal(true)}>
            <UserPlus size={18} /> <span className="btn-text">Nuevo</span>
          </button>
        )}
      </div>

      <div className="search-section">
        <div className="modern-search-bar">
          <Search className="search-icon-left" size={20} />
          <input
            type="text"
            placeholder={`Buscar por ${searchType}...`}
            className="search-input-main"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm("")}>
              <X size={16} />
            </button>
          )}
          <div className="search-divider"></div>
          <div className="search-type-wrapper">
            <span className="search-label">Filtro:</span>
            <select className="search-type-select" value={searchType} onChange={(e) => setSearchType(e.target.value)}>
              <option value="nombre">Nombre</option>
              <option value="apellido">Apellido</option>
              <option value="rol">Cargo</option>
              <option value="deposito">Depósito</option>
            </select>
            <ChevronDown size={16} className="select-arrow" />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="styled-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Apellido</th>
              <th>Depósito</th>
              <th>Cargo</th>
              <th>Estado</th>
              <th style={{ textAlign: "center" }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                  <Loader2 className="animate-spin" size={24} style={{ marginRight: 10 }} /> Cargando...
                </td>
              </tr>
            ) : filteredEmpleados.length > 0 ? (
              filteredEmpleados.map((e) => (
                <tr key={e.id} className={ordenPendiente ? "row-highlight-mode" : ""}>
                  <td data-label="Empleado">
                    <div className="employee-profile-cell">
                      {renderAvatar(e)}
                      <span className="employee-name-text">{formatText(e.nombre)}</span>
                    </div>
                  </td>
                  <td data-label="Apellido">{formatText(e.apellido)}</td>
                  <td data-label="Depósito">
                    {depositos.find((d) => d.ID_DEPOSITO === e.ID_DEPOSITO)?.NOMBRE || <span style={{ color: "#999" }}>—</span>}
                  </td>
                  <td data-label="Cargo">
                    <span className="role-badge">{formatText(e.rol)}</span>
                  </td>
                  <td data-label="Estado">
                    <span className={`status-badge ${e.estado ? "active" : "inactive"}`}>{e.estado ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td data-label="Acción" style={{ textAlign: "center" }}>
                    {ordenPendiente ? (
                      <button className="btn-icon" onClick={() => handleAsignarOrden(e)} style={{ color: "#d97706", background: "#fffbeb" }}>
                        <UserPlus size={20} />
                      </button>
                    ) : (
                      <button className="btn-icon" onClick={() => setSelectedEmployee(e)}>
                        <MoreHorizontal size={20} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty-search-state">
                  No se encontraron resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          depositos={depositos}
          roles={roles}
          onClose={() => setSelectedEmployee(null)}
          onSave={handleSaveEmployee}
          onToggleStatus={handleToggleStatus}
          // ✅ props asistencia
          asistencias={asistenciasEmpleado}
          asistenciasLoading={asistenciasEmpleadoLoading}
          asistenciasError={asistenciasEmpleadoError}
        />
      )}

      {showCreateModal && (
        <RegisterModal onClose={() => setShowCreateModal(false)} depositos={depositos} roles={roles} reload={loadData} />
      )}
    </div>
  );
};

export default Empleados;
