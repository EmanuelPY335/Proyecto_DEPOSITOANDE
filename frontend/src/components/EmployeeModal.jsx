// frontend/src/components/EmployeeModal.jsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom"; // IMPORTANTE: Necesario para el Portal
import { 
  X, Save, Power, Mail, Phone, Calendar, Shield, MapPin, FileText, 
  Briefcase, Clock, User 
} from "lucide-react";
import "../styles/EmployeeModal.css";

const API_URL = "http://127.0.0.1:5000";

const EmployeeModal = ({ employee, depositos, roles, onClose, onSave, onToggleStatus }) => {
  const [formData, setFormData] = useState({ ...employee });
  const [activeTab, setActiveTab] = useState("perfil");

  useEffect(() => {
    if (employee) {
      setFormData({ ...employee });
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  // Si no hay empleado o el modal está cerrado, no renderizamos nada
  if (!employee) return null;

  // Lógica del Avatar
  const avatarUrl = formData.AVATAR ? `${API_URL}${formData.AVATAR}` : null;
  
  // Iniciales seguras (por si nombre/apellido vienen vacíos)
  const initials = (
    (formData.nombre?.charAt(0) || "") + 
    (formData.apellido?.charAt(0) || "")
  ).toUpperCase();

  // CONTENIDO DEL MODAL
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

          {/* --- TAB: ACTIVIDADES --- */}
          {activeTab === "ordenes" && (
            <div className="tab-content fade-in">
                <div className="empty-state">
                    <Briefcase size={40} color="#ccc" style={{marginBottom: 10}} />
                    <p style={{fontWeight: 500, color: '#4F5660'}}>Sin órdenes recientes</p>
                    <span style={{fontSize: '0.8rem'}}>Este empleado no tiene tareas pendientes.</span>
                </div>
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

  // 🚀 AQUÍ ESTÁ LA MAGIA: Renderizamos en document.body
  return ReactDOM.createPortal(modalContent, document.body);
};

export default EmployeeModal;