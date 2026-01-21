import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Camera, User, Palette, Mail, Phone, CheckCircle, AlertTriangle, X, Save } from "lucide-react";
import "../styles/Profile.css";

const API_URL = "http://127.0.0.1:5000";

const Profile = () => {
  // Estado del Perfil
  const [profile, setProfile] = useState({
    NOMBRE: "", 
    APELLIDO: "", 
    TELEFONO: "", 
    CORREO: "",
    BANNER_COLOR: "#5865F2", 
    AVATAR: null
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

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
    } catch (err) { 
      console.error("Error cargando perfil:", err); 
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMsg({ type: "error", text: "La imagen debe ser menor a 5MB" });
        return;
      }
      setAvatarFile(file);
      setPreviewAvatar(URL.createObjectURL(file)); 
    }
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    
    setMsg({ type: "", text: "" });
    setIsSaving(true);

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
        body: JSON.stringify({
          NOMBRE: profile.NOMBRE,
          APELLIDO: profile.APELLIDO,
          TELEFONO: profile.TELEFONO,
          CORREO: profile.CORREO,
          BANNER_COLOR: profile.BANNER_COLOR
        })
      });

      if (resp.success) {
        setMsg({ 
          type: "success", 
          text: "¡Perfil actualizado con éxito!" 
        });
        sessionStorage.setItem("user_nombre", profile.NOMBRE);
        window.dispatchEvent(new Event("storage"));
        loadProfile();
        setAvatarFile(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error(resp.message || "Error al actualizar");
      }
    } catch (err) {
      console.error("Error guardando perfil:", err);
      setMsg({ 
        type: "error", 
        text: err.message || "Error al actualizar perfil. Intenta nuevamente." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-wrapper">
        
        {/* Header */}
        <div className="profile-header">
          <h1 className="profile-title">Mi Perfil</h1>
          <p className="profile-subtitle">
            Personaliza tu información y apariencia en SISDEPO
          </p>
        </div>

        {/* Alertas */}
        {msg.text && (
          <div className={`message-alert ${msg.type}`}>
            <div className="alert-icon">
              {msg.type === "success" ? 
                <CheckCircle size={20} /> : 
                <AlertTriangle size={20} />
              }
            </div>
            <p className="alert-text">{msg.text}</p>
            <button 
              className="alert-close" 
              onClick={() => setMsg({ type: "", text: "" })}
              aria-label="Cerrar alerta"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="profile-content">
          
          {/* Columna Izquierda - Formulario */}
          <div className="form-column">
            
            {/* Datos Personales */}
            <div className="form-section">
              <div className="section-header">
                <div className="section-icon">
                  <User size={20} />
                </div>
                <h2>Datos Personales</h2>
              </div>
              
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="nombre">Nombre</label>
                  <input 
                    type="text" 
                    id="nombre"
                    name="NOMBRE" 
                    value={profile.NOMBRE} 
                    onChange={handleChange} 
                    className="text-input"
                    placeholder="Ingresa tu nombre"
                  />
                </div>
                
                <div className="input-group">
                  <label htmlFor="apellido">Apellido</label>
                  <input 
                    type="text" 
                    id="apellido"
                    name="APELLIDO" 
                    value={profile.APELLIDO} 
                    onChange={handleChange} 
                    className="text-input"
                    placeholder="Ingresa tu apellido"
                  />
                </div>
                
                <div className="input-group full-width">
                  <label htmlFor="correo">Correo Electrónico</label>
                  <input 
                    type="email" 
                    id="correo"
                    name="CORREO" 
                    value={profile.CORREO} 
                    onChange={handleChange} 
                    className="text-input"
                    placeholder="ejemplo@empresa.com"
                  />
                </div>
                
                <div className="input-group full-width">
                  <label htmlFor="telefono">Teléfono</label>
                  <input 
                    type="tel" 
                    id="telefono"
                    name="TELEFONO" 
                    value={profile.TELEFONO} 
                    onChange={handleChange} 
                    className="text-input"
                    placeholder="+56 9 1234 5678"
                  />
                </div>
              </div>
            </div>

            {/* Apariencia */}
            <div className="form-section">
              <div className="section-header">
                <div className="section-icon">
                  <Palette size={20} />
                </div>
                <h2>Apariencia</h2>
              </div>
              
              <div className="appearance-grid">
                <div className="color-section">
                  <label htmlFor="banner-color">Color del Banner</label>
                  <div className="color-selector">
                    <input 
                      type="color" 
                      id="banner-color"
                      name="BANNER_COLOR" 
                      value={profile.BANNER_COLOR || "#5865F2"} 
                      onChange={handleChange}
                      className="color-input"
                      aria-label="Seleccionar color del banner"
                    />
                    <div className="color-info">
                      <span className="color-hex">
                        {profile.BANNER_COLOR.toUpperCase()}
                      </span>
                      <p className="color-description">
                        Aparecerá en tu tarjeta de perfil
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="avatar-section">
                  <label>Avatar</label>
                  <div className="avatar-upload">
                    <input 
                      type="file" 
                      id="avatar-upload"
                      accept="image/*" 
                      onChange={handleAvatarChange} 
                      className="file-input"
                    />
                    <label htmlFor="avatar-upload" className="upload-button">
                      <Camera size={16} /> 
                      <span>{avatarFile ? "Cambiar Imagen" : "Subir Imagen"}</span>
                    </label>
                    {avatarFile && (
                      <div className="file-details">
                        <p className="file-name">{avatarFile.name}</p>
                        <p className="file-size">
                          {(avatarFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="upload-note">
                    Formatos: JPG, PNG, WebP. Máximo 5MB
                  </p>
                </div>
              </div>
            </div>
            
            {/* Botón Guardar */}
            <button 
              className="save-button" 
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="loading-spinner"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>

          {/* Columna Derecha - Vista Previa */}
          <div className="preview-column">
            <div className="preview-container">
              <div className="preview-header">
                <h3>Vista Previa</h3>
                <p>Así aparecerás en el sistema</p>
              </div>
              
              <div className="profile-card">
                <div 
                  className="card-banner" 
                  style={{background: profile.BANNER_COLOR}}
                  aria-label="Banner de perfil"
                />
                
                <div className="card-content">
                  <div className="avatar-container">
                    {previewAvatar ? (
                      <img 
                        src={previewAvatar} 
                        alt="Avatar del usuario" 
                        className="profile-avatar"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          const fallback = e.target.parentElement.querySelector('.avatar-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    
                    <div className={`avatar-fallback ${previewAvatar ? 'hidden' : ''}`}>
                      <span>{profile.NOMBRE?.charAt(0)}{profile.APELLIDO?.charAt(0)}</span>
                      <div className="status-indicator online" />
                    </div>
                  </div>
                  
                  <div className="profile-info">
                    <h2 className="profile-name">
                      {profile.NOMBRE || "Nombre"} {profile.APELLIDO || "Apellido"}
                    </h2>
                    <p className="profile-role">Miembro de SISDEPO</p>
                    
                    <div className="contact-info">
                      <div className="contact-item">
                        <Mail size={16} className="contact-icon" />
                        <span className="contact-text">
                          {profile.CORREO || "correo@ejemplo.com"}
                        </span>
                      </div>
                      
                      <div className="contact-item">
                        <Phone size={16} className="contact-icon" />
                        <span className="contact-text">
                          {profile.TELEFONO || "Sin teléfono registrado"}
                        </span>
                      </div>
                    </div>
                    
    
                  </div>
                </div>
                
                <div className="card-footer">
                  <button className="preview-button" disabled>
                    Vista de Ejemplo
                  </button>
                </div>
              </div>
              
              <div className="preview-note">
                <div className="note-icon">ℹ️</div>
                <p>
                  Los cambios se aplicarán al presionar "Guardar Cambios"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;