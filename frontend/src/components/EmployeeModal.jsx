// frontend/src/components/EmployeeModal.jsx
import React, { useState, useEffect } from "react";
import { 
  X, Save, Power, Mail, Phone, Calendar, Shield, MapPin, FileText, 
  Briefcase, Clock, User 
} from "lucide-react";
import "../styles/EmployeeModal.css";

const API_URL = "http://127.0.0.1:5000";

const EmployeeModal = ({ employee, depositos, roles, onClose, onSave, onToggleStatus }) => {
  const [formData, setFormData] = useState({ ...employee });
  const [activeTab, setActiveTab] = useState("perfil"); // pestañas

  useEffect(() => {
    setFormData({ ...employee });
  }, [employee]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!employee) return null;

  // -----------------------
  // Avatar Render Logic
  // -----------------------
  const avatarUrl = formData.AVATAR
    ? `${API_URL}${formData.AVATAR}`
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="discord-card" onClick={(e) => e.stopPropagation()}>
        
        {/* ----------------- BANNER SUPERIOR ----------------- */}
        <div
          className="card-banner"
          style={{ background: formData.BANNER_COLOR || "#5865F2" }}
        >
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* ----------------- HEADER CON AVATAR ----------------- */}
        <div className="card-header-content">
          
          {/* Avatar dinámico */}
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="avatar-circle img-avatar" />
          ) : (
            <div className="avatar-circle">
              {formData.nombre.charAt(0)}
              {formData.apellido.charAt(0)}
            </div>
          )}

          <div className="header-text">
            <h2>{formData.nombre} {formData.apellido}</h2>
            <span className="username-tag">
              @{formData.nombre?.toLowerCase()}_{formData.apellido?.toLowerCase()}
            </span>
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

        {/* ----------------- CONTENIDO DEL MODAL ----------------- */}
        <div className="card-body">
          
          {/* ----------------- TAB 1: PERFIL ----------------- */}
          {activeTab === "perfil" && (
            <form onSubmit={handleSubmit} className="fade-in">
              <div className="section-title">INFORMACIÓN PERSONAL</div>

              <div className="input-group">
                <label><Mail size={14}/> Correo</label>
                <input type="email" name="correo" value={formData.correo} onChange={handleChange} />
              </div>

              <div className="row-2">
                  <div className="input-group">
                      <label><Phone size={14}/> Teléfono</label>
                      <input type="text" name="telefono" value={formData.telefono || ""} onChange={handleChange} />
                  </div>
                  <div className="input-group">
                      <label><FileText size={14}/> Cédula</label>
                      <input type="text" name="NUMERO_DOCUMENTO" value={formData.NUMERO_DOCUMENTO || ""} onChange={handleChange} />
                  </div>
              </div>
               
              <div className="input-group">
                  <label><Calendar size={14}/> Fecha Nacimiento</label>
                  <input type="date" name="FECHA_NACIMIENTO" value={formData.FECHA_NACIMIENTO || ""} onChange={handleChange} />
              </div>

              <div className="section-title" style={{marginTop: '15px'}}>ROLES Y UBICACIÓN</div>

              <div className="row-2">
                  <div className="input-group">
                      <label><Shield size={14}/> Rol</label>
                      <select name="rol_id" value={formData.rol_id || ""} onChange={handleChange} className="discord-select">
                          {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.nombre}</option>
                          ))}
                      </select>
                  </div>

                  <div className="input-group">
                      <label><MapPin size={14}/> Depósito</label>
                      <select name="ID_DEPOSITO" value={formData.ID_DEPOSITO || ""} onChange={handleChange} className="discord-select">
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
                      {formData.estado ? "Desactivar" : "Activar"}
                  </button>

                  <button type="submit" className="btn-save">
                      <Save size={16} style={{marginRight: 5}}/> Guardar
                  </button>
              </div>
            </form>
          )}

          {/* ----------------- TAB 2: ACTIVIDADES ----------------- */}
          {activeTab === "ordenes" && (
            <div className="tab-content fade-in">
                <div className="empty-state">
                    <Briefcase size={40} color="#ccc" />
                    <p>No hay órdenes de trabajo asignadas recientemente.</p>
                    <button className="btn-small-primary">Asignar Nueva Tarea</button>
                </div>
            </div>
          )}

          {/* ----------------- TAB 3: ASISTENCIA ----------------- */}
          {activeTab === "asistencia" && (
            <div className="tab-content fade-in">
                <div className="attendance-stats">
                    <div className="stat-box">
                        <span className="stat-label">Asistencias</span>
                        <span className="stat-value">0</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label">Faltas</span>
                        <span className="stat-value">0</span>
                    </div>
                </div>

                <div className="empty-state">
                  <Clock size={40} color="#ccc" />
                  <p>No hay registros de asistencia disponibles.</p>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
