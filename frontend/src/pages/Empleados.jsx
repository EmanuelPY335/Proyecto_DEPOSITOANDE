import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import EmployeeModal from "../components/EmployeeModal";
import RegisterModal from "../components/RegisterModal";
import { useLocation, useNavigate } from "react-router-dom";
import { UserPlus, MoreHorizontal, AlertTriangle, Search, X, ChevronDown, Loader2, User } from "lucide-react"; // Agregué User icon
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
        apiFetch(`${API}/api/empleados`),
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

// Helper para mayúsculas en CADA palabra (Ej: "oscar emanuel" -> "Oscar Emanuel")
  const formatText = (text) => {
    if (!text) return "";
    
    return text
      .toString()
      .toLowerCase()       // 1. Convertimos todo a minúscula primero
      .split(" ")          // 2. Separamos el texto por espacios
      .map((word) =>       // 3. Recorremos cada palabra...
        word.charAt(0).toUpperCase() + word.slice(1) // ...y ponemos mayúscula solo a la primera letra
      )
      .join(" ");          // 4. Unimos todo de nuevo con espacios
  };

  // --- NUEVO: Lógica para el Avatar ---
  const getAvatarColor = (name) => {
    const colors = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"];
    const charCode = name ? name.charCodeAt(0) : 0;
    return colors[charCode % colors.length];
  };

// --- FUNCIÓN RENDER AVATAR CORREGIDA ---
  const renderAvatar = (empleado) => {
    // 1. CORRECCIÓN: La propiedad en tu consola es "AVATAR" (mayúsculas)
    if (empleado.AVATAR) {
      // 2. CORRECCIÓN: Tu BD ya devuelve "/api/uploads/...", así que solo unimos con el host
      // Resultado: http://127.0.0.1:5000/api/uploads/avatars/avatar_4.jpg
      const imageUrl = `${API}${empleado.AVATAR}`;

      return (
        <img 
          src={imageUrl} 
          alt={empleado.nombre}
          className="avatar-img"
          // Si la imagen falla al cargar (ej. ruta rota), ocultamos la imagen para ver las iniciales
          onError={(e) => {
            e.target.style.display = 'none'; 
            // Esto es un truco rápido: si falla la img, podrías forzar a mostrar el div de abajo,
            // pero por ahora solo ocultamos la imagen rota para que no se vea el icono de error.
          }}
        />
      );
    }

    // 3. Fallback: Si AVATAR es null, mostramos las iniciales
    return (
      <div 
        className="avatar-placeholder"
        style={{ backgroundColor: getAvatarColor(empleado.nombre) }}
      >
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

const filteredEmpleados = empleados.filter((e) => {
    // --- 1. FILTRO ROBUSTO PARA OCULTAR AL FANTASMA ---
    // Convertimos a minúsculas y quitamos espacios para comparar seguro
    const nombreNorm = (e.nombre || "").toLowerCase().trim();
    const apellidoNorm = (e.apellido || "").toLowerCase().trim();

    // Si coincide con "sin asignar" o "system unassigned", lo ocultamos
    if (nombreNorm === "sin" && apellidoNorm === "asignar") return false;
    if (nombreNorm === "system" && apellidoNorm === "unassigned") return false;
    // ---------------------------------------------------

    // --- 2. Lógica normal del buscador (SIN CAMBIOS) ---
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
                    
                    {/* --- AQUÍ ESTÁ EL CAMBIO VISUAL PRINCIPAL --- */}
                    <td>
                      <div className="employee-profile-cell">
                        {/* Renderizamos el Avatar (Foto o Inicial) */}
                        {renderAvatar(e)}
                        
                        {/* Nombre del empleado */}
                        <span className="employee-name-text">
                          {formatText(e.nombre)}
                        </span>
                      </div>
                    </td>
                    {/* --------------------------------------------- */}

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

      {selectedEmployee && <EmployeeModal employee={selectedEmployee} depositos={depositos} roles={roles} onClose={() => setSelectedEmployee(null)} />}
      {showCreateModal && <RegisterModal onClose={() => setShowCreateModal(false)} depositos={depositos} roles={roles} reload={loadData} />}
    </div>
  );
};

export default Empleados;