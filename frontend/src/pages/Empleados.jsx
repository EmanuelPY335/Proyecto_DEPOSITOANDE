// src/pages/Empleados.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import EmployeeModal from "../components/EmployeeModal";
import RegisterModal from "../components/RegisterModal";
import { useLocation, useNavigate } from "react-router-dom";
import { UserPlus, MoreHorizontal, AlertTriangle, Search, X, ChevronDown, Loader2, User } from "lucide-react"; 
import "../styles/Empleados.css";

const API = "http://127.0.0.1:5000";

const Empleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
  }, [location]);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [empData, depData, rolData] = await Promise.all([
        apiFetch(`${API}/api/empleados`), // RESTAURADO A TU VERSIÓN ORIGINAL
        apiFetch(`${API}/api/depositos`),
        apiFetch(`${API}/api/roles`),
      ]);
      setEmpleados(empData || []);
      setDepositos(depData || []);
      setRoles(rolData || []);
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatText = (text) => {
    if (!text) return "";
    return text.toString().toLowerCase().split(" ").map((word) => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(" ");
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
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      );
    }
    return (
      <div className="avatar-placeholder" style={{ backgroundColor: getAvatarColor(empleado.nombre) }}>
        {empleado.nombre ? empleado.nombre.charAt(0).toUpperCase() : <User size={16}/>}
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

  // Guardar cambios de edición
  const handleSaveEmployee = async (formData) => {
    try {
        await apiFetch(`${API}/api/empleados/${formData.id}`, {
            method: "PUT",
            body: JSON.stringify(formData)
        });
        alert("Empleado actualizado correctamente.");
        loadData(); 
        setSelectedEmployee(null); 
    } catch (error) {
        alert("Error al actualizar: " + error.message);
    }
  };

  // Activar/Desactivar cuenta
  const handleToggleStatus = async (idEmpleado) => {
    if(!window.confirm("¿Seguro que deseas cambiar el estado de este empleado?")) return;

    try {
        await apiFetch(`${API}/api/empleados/${idEmpleado}/estado`, {
            method: "PUT"
        });
        loadData(); 
        setSelectedEmployee(null); 
    } catch (error) {
        alert("Error al cambiar estado: " + error.message);
    }
  };

  // --- Filtros ---
  const filteredEmpleados = empleados.filter((e) => {
    const nombreNorm = (e.nombre || "").toLowerCase().trim();
    const apellidoNorm = (e.apellido || "").toLowerCase().trim();
    if (nombreNorm === "sin" && apellidoNorm === "asignar") return false;
    if (nombreNorm === "system" && apellidoNorm === "unassigned") return false;

    if (ordenPendiente) {
        if (Number(e.ID_DEPOSITO) !== Number(ordenPendiente.deposito_id)) {
            return false;
        }
    }

    if (!searchTerm) return true;
    const text = searchTerm.toLowerCase();
    switch (searchType) {
      case "nombre": return e.nombre.toLowerCase().includes(text);
      case "apellido": return e.apellido.toLowerCase().includes(text);
      case "rol": return (e.rol || "").toLowerCase().includes(text);
      case "deposito":
        const nombreDeposito = depositos.find(d => d.ID_DEPOSITO === e.ID_DEPOSITO)?.NOMBRE || "";
        return nombreDeposito.toLowerCase().includes(text);
      default: return true;
    }
  });

  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        
        {ordenPendiente && (
          <div className="assignment-banner fade-in-down">
            <div className="banner-content">
              <AlertTriangle size={20} className="text-amber-600" />
              <div>
                <strong>Modo Asignación:</strong> Selecciona un empleado para <span className="highlight-order">"{ordenPendiente.titulo}"</span>
                <div style={{fontSize: '0.8rem', marginTop: '2px'}}>
                   (Filtrando empleados del depósito correspondiente)
                </div>
              </div>
            </div>
            <button className="btn-cancel-assign" onClick={cancelarAsignacion}>Cancelar</button>
          </div>
        )}

        <div className="page-header">
          <div>
            <h1>Empleados</h1>
            <p className="subtitle">Listado del personal {!isLoading && `(${filteredEmpleados.length})`}</p>
          </div>
          {!ordenPendiente && (
            <button className="btn-new" onClick={() => setShowCreateModal(true)}>
              <UserPlus size={18} /> Nuevo Empleado
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
              <button className="clear-search-btn" onClick={() => setSearchTerm("")}><X size={16} /></button>
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
                    <Loader2 className="animate-spin" size={24} style={{marginRight: 10}}/> Cargando...
                  </td>
                </tr>
              ) : filteredEmpleados.length > 0 ? (
                filteredEmpleados.map((e) => (
                  <tr key={e.id} className={ordenPendiente ? "row-highlight-mode" : ""}>
                    <td>
                      <div className="employee-profile-cell">
                        {renderAvatar(e)}
                        <span className="employee-name-text">
                          {formatText(e.nombre)}
                        </span>
                      </div>
                    </td>
                    <td>{formatText(e.apellido)}</td>
                    <td>{depositos.find((d) => d.ID_DEPOSITO === e.ID_DEPOSITO)?.NOMBRE || <span style={{color: '#999'}}>—</span>}</td>
                    <td><span className="role-badge">{formatText(e.rol)}</span></td>
                    <td>
                      <span className={`status-badge ${e.estado ? "active" : "inactive"}`}>
                        {e.estado ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {ordenPendiente ? (
                        <button className="btn-icon" onClick={() => handleAsignarOrden(e)} style={{color: '#d97706', background: '#fffbeb'}}>
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
                <tr><td colSpan="6" className="empty-search-state">No se encontraron resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeModal 
            employee={selectedEmployee} 
            depositos={depositos} 
            roles={roles} 
            onClose={() => setSelectedEmployee(null)} 
            onSave={handleSaveEmployee}
            onToggleStatus={handleToggleStatus}
        />
      )}
      
      {showCreateModal && <RegisterModal onClose={() => setShowCreateModal(false)} depositos={depositos} roles={roles} reload={loadData} />}
    </div>
  );
};

export default Empleados;