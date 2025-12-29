// src/pages/Config.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/api"; // Importar apiFetch
import { 
  Bell, Map as MapIcon, Shield, ChevronRight, 
  Globe, Volume2, Truck, X, Lock, CheckCircle, AlertTriangle 
} from "lucide-react";
import "../styles/Config.css";
import "../styles/EmployeeModal.css"; // Importar estilos para el Modal

const API_URL = "http://127.0.0.1:5000";

const Config = () => {
  // Configuración General
  const [notifications, setNotifications] = useState({ email: true, browser: true, sound: false });
  const [mapSettings, setMapSettings] = useState({ refreshRate: "30", showTraffic: false });

  // --- ESTADO PARA MODAL DE SEGURIDAD ---
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Manejadores Generales
  const toggleNotif = (key) => setNotifications(prev => ({...prev, [key]: !prev[key]}));
  const handleMapChange = (e) => setMapSettings({...mapSettings, [e.target.name]: e.target.value});

  // Manejadores Seguridad
  const handlePassChange = (e) => setPasswords({...passwords, [e.target.name]: e.target.value});

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    if (passwords.new_password !== passwords.confirm_password) {
        setMsg({ type: "error", text: "Las nuevas contraseñas no coinciden." });
        return;
    }

    try {
        const data = await apiFetch(`${API_URL}/api/profile/change-password`, {
            method: "POST",
            body: JSON.stringify({
                current_password: passwords.current_password,
                new_password: passwords.new_password,
            }),
        });

        if (data.success) {
            setMsg({ type: "success", text: "¡Contraseña actualizada correctamente!" });
            setPasswords({ current_password: "", new_password: "", confirm_password: "" });
            // Cerrar modal después de 2s si quieres
            // setTimeout(() => setShowSecurityModal(false), 2000);
        } else {
            setMsg({ type: "error", text: data.message || "Error al cambiar contraseña." });
        }
    } catch (err) {
        setMsg({ type: "error", text: err.message || "Error de conexión." });
    }
  };

  const closeSecurityModal = () => {
      setShowSecurityModal(false);
      setMsg({ type: "", text: "" });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
  };

  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        
        <div className="config-header">
            <h1>Configuración del Sistema</h1>
            <p className="subtitle">Ajusta las preferencias de alertas y rastreo de SISDEPO.</p>
            <br />
        </div>

        <div className="config-container">
            
            {/* 1. NOTIFICACIONES */}
            <div className="config-card">
                <div className="card-title"><Bell size={22} /><h3>Notificaciones</h3></div>
                <p className="card-desc">Controla cómo recibes las alertas de inventario y flota.</p>
                <div className="config-item-row">
                    <span className="label-text">Alertas por Correo</span>
                    <input type="checkbox" className="checkbox-ios" checked={notifications.email} onChange={() => toggleNotif('email')}/>
                </div>
                {/* ... (resto de notificaciones) ... */}
            </div>

            {/* 2. MAPA */}
            <div className="config-card">
                <div className="card-title"><MapIcon size={22} /><h3>Mapa y GPS</h3></div>
                <p className="card-desc">Optimiza el rendimiento del seguimiento vehicular.</p>
                <div className="config-input-group">
                    <label>Frecuencia de actualización</label>
                    <select name="refreshRate" value={mapSettings.refreshRate} onChange={handleMapChange} className="config-select">
                        <option value="5">Tiempo Real (5s)</option>
                        <option value="30">Normal (30s)</option>
                    </select>
                </div>
            </div>

            {/* 3. CUENTA Y SEGURIDAD */}
            <div className="config-card">
                <div className="card-title"><Shield size={22} /><h3>Cuenta</h3></div>
                <p className="card-desc">Accesos directos a la gestión de tu perfil.</p>
                
                <Link to="/profile" className="config-link-item">
                    <div className="row-center">
                        <div className="icon-bg"><Globe size={18}/></div>
                        <div className="link-text-group">
                            <span className="link-title">Editar Perfil</span>
                            <span className="link-subtitle">Avatar, teléfono y banner</span>
                        </div>
                    </div>
                    <ChevronRight size={18} color="#ccc" />
                </Link>

                {/* --- BOTÓN SEGURIDAD (ABRE MODAL) --- */}
                <div className="config-link-item" onClick={() => setShowSecurityModal(true)} style={{cursor: 'pointer'}}>
                    <div className="row-center">
                        <div className="icon-bg sec"><Shield size={18}/></div>
                        <div className="link-text-group">
                            <span className="link-title">Seguridad</span>
                            <span className="link-subtitle">Cambiar contraseña</span>
                        </div>
                    </div>
                    <ChevronRight size={18} color="#ccc" />
                </div>
            </div>

        </div>

        {/* --- MODAL DE SEGURIDAD --- */}
        {showSecurityModal && (
            <div className="modal-backdrop" onClick={closeSecurityModal}>
                <div className="discord-card" onClick={(e) => e.stopPropagation()} style={{width: '400px', maxHeight: '90vh'}}>
                    
                    {/* Header Modal */}
                    <div style={{padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h2 style={{margin:0, fontSize: '1.2rem'}}>Cambiar Contraseña</h2>
                        <button onClick={closeSecurityModal} style={{background:'none', border:'none', cursor:'pointer'}}><X size={20}/></button>
                    </div>

                    <div className="card-body">
                        
                        {/* Alerta dentro del modal */}
                        {msg.text && (
                            <div className={`alert-box ${msg.type}`} style={{marginBottom: '15px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                    {msg.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                    <span style={{fontSize: '0.85rem'}}>{msg.text}</span>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handlePasswordSubmit}>
                            <div className="input-group">
                                <label><Lock size={14}/> Contraseña Actual</label>
                                <input type="password" name="current_password" value={passwords.current_password} onChange={handlePassChange} required />
                            </div>
                            <div className="input-group">
                                <label><Lock size={14}/> Nueva Contraseña</label>
                                <input type="password" name="new_password" value={passwords.new_password} onChange={handlePassChange} required placeholder="Mínimo 6 caracteres"/>
                            </div>
                            <div className="input-group">
                                <label><Lock size={14}/> Confirmar Nueva</label>
                                <input type="password" name="confirm_password" value={passwords.confirm_password} onChange={handlePassChange} required placeholder="Repite la nueva clave"/>
                            </div>

                            <div style={{marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                                <button type="button" className="btn-status btn-danger" onClick={closeSecurityModal}>Cancelar</button>
                                <button type="submit" className="btn-save">Actualizar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Config;