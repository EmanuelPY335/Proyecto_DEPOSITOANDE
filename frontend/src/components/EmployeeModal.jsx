// frontend/src/components/EmployeeModal.jsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { apiFetch } from "../utils/api"; 
import { 
  X, Save, Power, Mail, Phone, Calendar, Shield, MapPin, FileText, 
  Briefcase, Clock, User, AlertCircle 
} from "lucide-react";
import "../styles/EmployeeModal.css";

const API_URL = "http://127.0.0.1:5000";

const EmployeeModal = ({ employee, depositos, roles, onClose, onSave, onToggleStatus }) => {
  const [formData, setFormData] = useState({ ...employee });
  const [activeTab, setActiveTab] = useState("perfil");
  
  // Estados para las órdenes
  const [employeeOrdenes, setEmployeeOrdenes] = useState([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);

  // Sincronizar datos del empleado al abrir
  useEffect(() => {
    if (employee) {
      setFormData({ ...employee });
    }
  }, [employee]);

  // Sincronizar Carga de Órdenes
  useEffect(() => {
    const fetchOrdenes = async () => {
      if (activeTab === 'ordenes' && employee?.id) {
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

  // Lógica del Avatar
  const avatarUrl = formData.AVATAR ? `${API_URL}${formData.AVATAR}` : null;
  
  const initials = (
    (formData.nombre?.charAt(0) || "") + 
    (formData.apellido?.charAt(0) || "")
  ).toUpperCase();

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="discord-card" onClick={(e) => e.stopPropagation()}>
        
        {/* ----------------- BANNER ----------------- */}
        <div
          className="card-banner"
          style={{ background: formData.BANNER_COLOR || "#5865F2" }}
        >
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* ----------------- HEADER ----------------- */}
        <div className="card-header-content">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="avatar-circle img-avatar" />
          ) : (
            <div className="avatar-circle" style={{fontSize: '1.5rem'}}>
              {initials}
            </div>
          )}

          <div className="header-text">
            <h2>{formData.nombre} {formData.apellido}</h2>
            <br />
          </div>
        </div>

        {/* ----------------- TABS ----------------- */}
        <div className="tabs-container">
            <button 
                className={`tab-btn ${activeTab === "perfil" ? "active" : ""}`} 
                onClick={() => setActiveTab("perfil")}
            >
                <User size={14} /> Perfil
            </button>

            <button 
                className={`tab-btn ${activeTab === "ordenes" ? "active" : ""}`} 
                onClick={() => setActiveTab("ordenes")}
            >
                <Briefcase size={14} /> Actividades
            </button>

            <button 
                className={`tab-btn ${activeTab === "asistencia" ? "active" : ""}`} 
                onClick={() => setActiveTab("asistencia")}
            >
                <Clock size={14} /> Asistencia
            </button>
        </div>

        {/* ----------------- CUERPO (SCROLL) ----------------- */}
        <div className="card-body">
          
          {/* --- TAB: PERFIL --- */}
          {activeTab === "perfil" && (
            <form onSubmit={handleSubmit} className="fade-in">
              <div className="section-title">INFORMACIÓN PERSONAL</div>

              <div className="input-group">
                <label><Mail size={14}/> Correo</label>
                <input 
                  type="email" 
                  name="correo" 
                  value={formData.correo || ""} 
                  onChange={handleChange} 
                />
              </div>

              <div className="row-2">
                  <div className="input-group">
                      <label><Phone size={14}/> Teléfono</label>
                      <input 
                        type="text" 
                        name="telefono" 
                        value={formData.telefono || ""} 
                        onChange={handleChange} 
                      />
                  </div>
                  <div className="input-group">
                      <label><FileText size={14}/> Cédula</label>
                      <input 
                        type="text" 
                        name="NUMERO_DOCUMENTO" 
                        value={formData.NUMERO_DOCUMENTO || ""} 
                        onChange={handleChange} 
                      />
                  </div>
              </div>
                
              <div className="input-group">
                  <label><Calendar size={14}/> Fecha Nacimiento</label>
                  <input 
                    type="date" 
                    name="FECHA_NACIMIENTO" 
                    value={formData.FECHA_NACIMIENTO || ""} 
                    onChange={handleChange} 
                  />
              </div>

              <div className="section-title" style={{marginTop: '15px'}}>ROLES Y UBICACIÓN</div>

              <div className="row-2">
                  <div className="input-group">
                      <label><Shield size={14}/> Rol</label>
                      <select 
                        name="rol_id" 
                        value={formData.rol_id || ""} 
                        onChange={handleChange} 
                        className="discord-select"
                      >
                          <option value="">Seleccionar Rol</option>
                          {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.nombre}</option>
                          ))}
                      </select>
                  </div>

                  <div className="input-group">
                      <label><MapPin size={14}/> Depósito</label>
                      <select 
                        name="ID_DEPOSITO" 
                        value={formData.ID_DEPOSITO || ""} 
                        onChange={handleChange} 
                        className="discord-select"
                      >
                          <option value="">Seleccionar Depósito</option>
                          {depositos.map(d => (
                              <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>
                          ))}
                      </select>
                  </div>
              </div>

              <div className="card-actions">
                  <button type="button" 
                          className={`btn-status ${formData.estado ? "btn-danger" : "btn-success"}`}
                          onClick={() => onToggleStatus(employee.id)}
                  >
                      <Power size={16} style={{marginRight: 5}}/>
                      {formData.estado ? "Desactivar Cuenta" : "Reactivar Cuenta"}
                  </button>

                  <button type="submit" className="btn-save">
                      <Save size={16} style={{marginRight: 5}}/> Guardar Cambios
                  </button>
              </div>
            </form>
          )}

          {/* --- TAB: ACTIVIDADES (CORREGIDO VISUALMENTE) --- */}
          {activeTab === "ordenes" && (
            <div className="tab-content fade-in">
                {loadingOrdenes ? (
                    <div style={{textAlign: 'center', padding: '30px', color: '#888'}}>
                        Cargando actividades...
                    </div>
                ) : employeeOrdenes.length > 0 ? (
                    <div className="lista-actividades-perfil">
                        {employeeOrdenes.map((orden) => {
                            // --- LÓGICA VISUAL AÑADIDA ---
                            const isExpired = orden.estado === "Fin de tiempo limite";
                            const isCompleted = ["Aprobada", "Completada", "Finalizada"].includes(orden.estado);

                            let estadoTexto = orden.estado;
                            let estiloExtra = {};

                            if (isExpired) {
                                estadoTexto = "TIEMPO AGOTADO";
                                estiloExtra = {
                                    backgroundColor: '#fee2e2',
                                    color: '#991b1b',
                                    border: '1px solid #fca5a5'
                                };
                            } else if (isCompleted) {
                                estadoTexto = "Completada";
                                // La clase CSS ya maneja el verde, pero por seguridad:
                                estiloExtra = {
                                    backgroundColor: '#e6f4ea',
                                    color: '#1e7e34',
                                    border: '1px solid #a7f3d0'
                                };
                            }

                            // Reemplazo seguro de espacios para la clase CSS
                            const claseEstado = orden.estado.toLowerCase().replace(/ /g, "-");

                            return (
                                <div key={orden.id} className="actividad-card-mini" style={{
                                    background: '#f8f9fa',
                                    border: '1px solid #e9ecef',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '10px'
                                }}>
                                    <div className="actividad-header" style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                                        <span 
                                            className={`badge-estado ${claseEstado}`} 
                                            style={{
                                                fontSize: '10px', 
                                                padding: '2px 8px', 
                                                borderRadius: '4px', 
                                                textTransform: 'uppercase', 
                                                fontWeight: 'bold',
                                                border: '1px solid transparent', // Default invisible border
                                                ...estiloExtra // Aplica los colores especiales
                                            }}
                                        >
                                            {estadoTexto}
                                        </span>
                                        <span style={{fontSize: '11px', color: '#888'}}>{orden.fecha_inicio}</span>
                                    </div>
                                    <h4 style={{margin: '0 0 4px 0', fontSize: '14px', color: '#2d3748', fontWeight: '600'}}>
                                        {orden.titulo}
                                    </h4>
                                    <p style={{fontSize: '12px', color: '#718096', margin: 0, lineHeight: '1.4'}}>
                                        {orden.descripcion}
                                    </p>
                                    <div style={{marginTop: '8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', color: '#4a5568'}}>
                                    <AlertCircle size={12}/> Prioridad {orden.prioridad}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        <Briefcase size={40} color="#ccc" style={{marginBottom: 10}} />
                        <p style={{fontWeight: 500, color: '#4F5660'}}>Sin órdenes recientes</p>
                        <span style={{fontSize: '0.8rem'}}>Este empleado no tiene tareas pendientes.</span>
                    </div>
                )}
            </div>
          )}

          {/* --- TAB: ASISTENCIA --- */}
          {activeTab === "asistencia" && (
            <div className="tab-content fade-in">
                <div className="attendance-stats">
                    <div className="stat-box">
                        <span className="stat-label" style={{color: '#23a559'}}>Asistencias</span>
                        <span className="stat-value">0</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label" style={{color: '#ED4245'}}>Faltas</span>
                        <span className="stat-value">0</span>
                    </div>
                </div>

                <div className="empty-state" style={{marginTop: 20}}>
                  <Clock size={40} color="#ccc" style={{marginBottom: 10}} />
                  <p style={{fontWeight: 500, color: '#4F5660'}}>Historial vacío</p>
                  <span style={{fontSize: '0.8rem'}}>No se encontraron registros de fichaje.</span>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default EmployeeModal;