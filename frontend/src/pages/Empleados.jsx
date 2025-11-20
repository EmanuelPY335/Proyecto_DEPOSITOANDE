// frontend/src/pages/Empleados.jsx
import React, { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import EmployeeModal from "../components/EmployeeModal";
import RegisterModal from "../components/RegisterModal";
import { MoreHorizontal, UserPlus, Search, ChevronDown, X, Check } from "lucide-react";
import "../styles/Empleados.css";

const API = "http://127.0.0.1:5000";

const Empleados = () => {
  // --- DATOS ---
  const [empleados, setEmpleados] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [roles, setRoles] = useState([]);
  
  // --- UI ---
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [msg, setMsg] = useState("");

  // --- BUSCADOR INTELIGENTE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("nombre"); 
  const [showOptions, setShowOptions] = useState(false); // Controla si se ve la lista
  const searchContainerRef = useRef(null); // Para detectar click fuera

  // --- NUEVO EMPLEADO ---
  const [registro, setRegistro] = useState({
    nombre: "", apellido: "", fecha: "", cedula: "", deposito: "",
    telefono: "", correo: "", contrasena: "", confirmar: "",
  });

  // 1. Cargar datos
  const loadData = async () => {
    try {
      const [empData, depData, rolData] = await Promise.all([
        apiFetch(`${API}/api/empleados`),
        apiFetch(`${API}/api/depositos`),
        apiFetch(`${API}/api/roles`)
      ]);
      setEmpleados(empData || []);
      setDepositos(depData || []);
      setRoles(rolData || []);
    } catch (err) { setMsg(err.message); }
  };

  useEffect(() => { loadData(); }, []);

  // Cerrar opciones al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchContainerRef]);


  // 2. Lógica de Filtrado (Tabla)
  const filteredEmpleados = empleados.filter((emp) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();

    switch (searchType) {
        case "nombre":
            return `${emp.nombre} ${emp.apellido}`.toLowerCase().includes(term);
        case "cedula":
            return emp.NUMERO_DOCUMENTO?.toString().includes(term);
        case "cargo":
            return emp.rol?.toLowerCase().includes(term);
        case "deposito":
            const depNombre = depositos.find(d => d.ID_DEPOSITO === emp.ID_DEPOSITO)?.NOMBRE || "";
            return depNombre.toLowerCase().includes(term);
        case "estado":
            const estadoTexto = emp.estado ? "activo" : "inactivo";
            // CAMBIO: Usamos startsWith para que "Inactivo" NO coincida cuando buscas "Activo"
            return estadoTexto.startsWith(term);
        default:
            return true;
    }
  });


  // 3. Generar Opciones para el Dropdown (Autocompletado)
  const getOptions = () => {
    let options = [];
    if (searchType === "cargo") {
        options = roles.map(r => r.nombre);
    } else if (searchType === "deposito") {
        options = depositos.map(d => d.NOMBRE);
    } else if (searchType === "estado") {
        options = ["Activo", "Inactivo"];
    } else {
        return []; // Nombre y Cédula no tienen lista predefinida
    }

    // Filtrar las opciones según lo que el usuario escribe (Autocompletado)
    if (searchTerm) {
        return options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return options;
  };

  const filteredOptions = getOptions();
  const showDropdown = (["cargo", "deposito", "estado"].includes(searchType)) && showOptions;

  // Handlers
  const handleOptionClick = (value) => {
    setSearchTerm(value);
    setShowOptions(false);
  };

  const handleTypeChange = (e) => {
    setSearchType(e.target.value);
    setSearchTerm("");
    setShowOptions(true); // Abrir lista al cambiar tipo para ver qué hay
  };

  // ... (Funciones de Guardar/Crear se mantienen igual)
  const handleSaveEmployee = async (d) => { /* Tu lógica PUT */ try{ await apiFetch(`${API}/api/empleados/${d.id}`, {method:"PUT", body:JSON.stringify(d)}); alert("Guardado"); setSelectedEmployee(null); loadData(); }catch(e){alert(e)} };
  const handleToggleStatus = async (id) => { if(window.confirm("¿Cambiar estado?")){ try{ await apiFetch(`${API}/api/empleados/${id}/estado`, {method:"PUT"}); setSelectedEmployee(null); loadData(); }catch(e){alert(e)} } };
  const handleCreateSubmit = async (e) => { e.preventDefault(); try{ const r = await fetch(`${API}/api/registro`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(registro)}); const d = await r.json(); if(d.success){ alert("Creado"); setShowCreateModal(false); loadData(); setRegistro({nombre:"",apellido:"",fecha:"",cedula:"",deposito:"",telefono:"",correo:"",contrasena:"",confirmar:""}); }else{alert(d.message)} }catch(err){alert("Error red")} };
  const handleRegistroChange = (e) => setRegistro({...registro, [e.target.name]: e.target.value});

  return (
    <div className="dashboard-layout">
       <div className="content-dashboard">
            
            <div className="page-header">
                <div>
                    <h1>Empleados</h1>
                    <p className="subtitle">Gestión centralizada de personal.</p>
                </div>
                <button className="btn btn-primary btn-new" onClick={() => setShowCreateModal(true)}>
                    <UserPlus size={18} /> <span>Nuevo Empleado</span>
                </button>
            </div>

            {/* --- SUPER BUSCADOR CON AUTOCOMPLETADO --- */}
            <div className="search-section" ref={searchContainerRef}>
                <div className="modern-search-bar">
                    <Search className="search-icon-left" size={20} />
                    
                    <input 
                        type="text" 
                        className="search-input-main"
                        placeholder={searchType === "cedula" ? "Escribe cédula..." : `Buscar por ${searchType}...`}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowOptions(true); // Mostrar lista al escribir
                        }}
                        onFocus={() => setShowOptions(true)} // Mostrar al hacer click
                        autoComplete="off"
                    />

                    {searchTerm && (
                        <button className="clear-search-btn" onClick={() => {setSearchTerm(""); setShowOptions(true);}}>
                            <X size={16} />
                        </button>
                    )}

                    <div className="search-divider"></div>

                    <div className="search-type-wrapper">
                        <span className="search-label">Filtrar por:</span>
                        <select 
                            className="search-type-select"
                            value={searchType}
                            onChange={handleTypeChange}
                        >
                            <option value="nombre">Nombre</option>
                            <option value="cedula">Cédula</option>
                            <option value="cargo">Cargo</option>
                            <option value="deposito">Depósito</option>
                            <option value="estado">Estado</option>
                        </select>
                        <ChevronDown size={14} className="select-arrow" />
                    </div>
                </div>

                {/* --- LISTA FLOTANTE (DROPDOWN) --- */}
                {showDropdown && (
                    <div className="autocomplete-dropdown fade-in-down">
                        {filteredOptions.length > 0 ? (
                            <ul className="options-list">
                                {filteredOptions.map((opt, index) => (
                                    <li key={index} onClick={() => handleOptionClick(opt)}>
                                        {/* Resaltar si ya está seleccionado */}
                                        <span>{opt}</span>
                                        {searchTerm.toLowerCase() === opt.toLowerCase() && <Check size={16} color="#007bff"/>}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="no-options">No hay resultados para "{searchTerm}"</div>
                        )}
                    </div>
                )}
            </div>

            {/* TABLA */}
            <div className="table-container">
                <table className="styled-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Apellido</th>
                        <th>Depósito</th>
                        <th>Cargo</th>
                        <th>Cédula</th>
                        <th>Estado</th>
                        <th style={{textAlign: 'center'}}>Info</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredEmpleados.map((e) => (
                    <tr key={e.id} style={{opacity: e.estado ? 1 : 0.6}}>
                        <td style={{fontWeight: '500'}}>{e.nombre}</td>
                        <td>{e.apellido}</td>
                        <td>{depositos.find(d => d.ID_DEPOSITO === e.ID_DEPOSITO)?.NOMBRE || "—"}</td>
                        <td><span className="role-badge">{e.rol}</span></td>
                        <td>{e.NUMERO_DOCUMENTO}</td>
                        <td>
                            <span className={`status-badge ${e.estado ? "active" : "inactive"}`}>
                                {e.estado ? "Activo" : "Inactivo"}
                            </span>
                        </td>
                        <td style={{textAlign: 'center'}}>
                            <button className="btn-icon" onClick={() => setSelectedEmployee(e)}>
                                <MoreHorizontal size={20} />
                            </button>
                        </td>
                    </tr>
                    ))}
                    {filteredEmpleados.length === 0 && (
                        <tr><td colSpan="7" className="empty-search-state">No se encontraron resultados.</td></tr>
                    )}
                </tbody>
                </table>
            </div>
       </div>

       {/* Modales */}
       {selectedEmployee && <EmployeeModal employee={selectedEmployee} depositos={depositos} roles={roles} onClose={() => setSelectedEmployee(null)} onSave={handleSaveEmployee} onToggleStatus={handleToggleStatus} />}
       {showCreateModal && <RegisterModal registro={registro} handleRegistroChange={handleRegistroChange} handleRegistroSubmit={handleCreateSubmit} onClose={() => setShowCreateModal(false)} />}
    </div>
  );
};

export default Empleados;