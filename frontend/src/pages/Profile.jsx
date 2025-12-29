// src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Camera, User, Palette, Mail, Phone, CheckCircle, AlertTriangle, X } from "lucide-react";
import "../styles/Profile.css";
import "../styles/EmployeeModal.css"; 

const API_URL = "http://127.0.0.1:5000";

const Profile = () => {
  // Estado del Perfil (Solo datos visuales)
  const [profile, setProfile] = useState({
    NOMBRE: "", APELLIDO: "", TELEFONO: "", CORREO: "",
    BANNER_COLOR: "#5865F2", AVATAR: null
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    loadProfile();
  }, []);

  // Auto-cierre de alertas
  useEffect(() => {
    if (msg.text) {
      const timer = setTimeout(() => setMsg({ type: "", text: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const loadProfile = async () => {
    try {
      const data = await apiFetch(`${API_URL}/api/profile`);
      setProfile(data);
      if (data.AVATAR) setPreviewAvatar(`${API_URL}${data.AVATAR}`);
    } catch (err) { console.error(err); }
  };

  const handleChange = (e) => setProfile({...profile, [e.target.name]: e.target.value});

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setPreviewAvatar(URL.createObjectURL(file)); 
    }
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    try {
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        const token = sessionStorage.getItem("access_token");
        await fetch(`${API_URL}/api/profile/avatar`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData
        });
      }

      const resp = await apiFetch(`${API_URL}/api/profile`, {
        method: "PUT",
        body: JSON.stringify(profile)
      });

      if (resp.success) {
        setMsg({ type: "success", text: "¡Perfil actualizado con éxito!" });
        sessionStorage.setItem("user_nombre", profile.NOMBRE);
        window.dispatchEvent(new Event("storage"));
        loadProfile(); 
        setAvatarFile(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setMsg({ type: "error", text: "Error al actualizar perfil." });
    }
  };

  return (
      <div className="dashboard-layout">
          <div className="content-dashboard">

            <div className="profile-header-section">
                <h1>Mi Perfil</h1>
                <p className="subtitle">Personaliza tu identidad dentro de SISDEPO.</p>
                <br />
            </div>

            <div className="profile-grid">
              
              {/* 🟦 COLUMNA IZQUIERDA: FORMULARIOS */}
              <div className="profile-edit-column">

                {/* ALERTA VISUAL */}
                {msg.text && (
                  <div className={`alert-box ${msg.type}`}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      {msg.type === "success" ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                      <span>{msg.text}</span>
                    </div>
                    <button className="alert-close-btn" onClick={() => setMsg({ type: "", text: "" })}>
                      <X size={18} />
                    </button>
                  </div>
                )}

                {/* 1. DATOS PERSONALES */}
                <div className="settings-card">
                  <h3><User size={18}/> Datos Personales</h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Nombre</label>
                      <input type="text" name="NOMBRE" value={profile.NOMBRE} onChange={handleChange} className="input-field"/>
                    </div>
                    <div className="form-group">
                      <label>Apellido</label>
                      <input type="text" name="APELLIDO" value={profile.APELLIDO} onChange={handleChange} className="input-field"/>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Correo</label>
                    <input type="email" name="CORREO" value={profile.CORREO} onChange={handleChange} className="input-field"/>
                  </div>

                  <div className="form-group">
                    <label>Teléfono</label>
                    <input type="text" name="TELEFONO" value={profile.TELEFONO} onChange={handleChange} className="input-field"/>
                  </div>
                </div>

                {/* 2. APARIENCIA */}
                <div className="settings-card">
                  <h3><Palette size={18}/> Apariencia</h3>

                  <div className="form-group">
                    <label>Color del Banner</label>
                    <div className="color-picker-wrapper">
                      <input 
                        type="color" 
                        name="BANNER_COLOR" 
                        value={profile.BANNER_COLOR || "#5865F2"} 
                        onChange={handleChange}
                        className="input-color"
                      />
                      <span className="color-code">{profile.BANNER_COLOR}</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Avatar</label>
                    <label className="file-upload-btn">
                      <Camera size={16} /> Cambiar Imagen
                      <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
                    </label>
                  </div>
                </div>
                  
                <button className="btn-save-profile" onClick={handleSaveChanges}>
                  Guardar Cambios
                </button>
              </div> 

              {/* 🟩 COLUMNA DERECHA: VISTA PREVIA */}
              <div className="profile-preview-column">
                <h3 className="preview-title">Vista Previa</h3>
                <p className="preview-subtitle">Así te verán los administradores.</p>
                
                <div className="discord-card preview-card">
                  <div className="card-banner" style={{background: profile.BANNER_COLOR}}></div>

                  <div className="card-header-content">
                    {previewAvatar ? (
                      <img src={previewAvatar} alt="Avatar" className="avatar-circle img-avatar" />
                    ) : (
                      <div className="avatar-circle">
                        {profile.NOMBRE?.charAt(0)}{profile.APELLIDO?.charAt(0)}
                        <span className="status-dot online" />
                      </div>
                    )}

                    <div className="header-text">
                      <h2>{profile.NOMBRE} {profile.APELLIDO}</h2>
                      <br />
                    </div>
                  </div>

                  <div className="card-body" style={{overflow: "hidden"}}>
                    <div className="section-title">CONTACTO</div>
                    <div className="preview-info-row">
                      <Mail size={14} style={{marginRight: 8}}/> {profile.CORREO}
                    </div>
                    <div className="preview-info-row">
                      <Phone size={14} style={{marginRight: 8}}/> {profile.TELEFONO || "Sin teléfono"}
                    </div>
                    <div className="card-actions">
                      <button className="btn-save" disabled style={{opacity: 0.7, cursor: 'default'}}>
                        Ejemplo
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
      </div>
  );
};

export default Profile;