import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Camera, Save, Lock, User, Palette, Mail, Phone } from "lucide-react";
import "../styles/Profile.css";
import "../styles/EmployeeModal.css"; 

const API_URL = "http://127.0.0.1:5000";

const Profile = () => {
  // Estado del Perfil (Datos + Apariencia)
  const [profile, setProfile] = useState({
    NOMBRE: "", APELLIDO: "", TELEFONO: "", CORREO: "",
    BANNER_COLOR: "#5865F2", AVATAR: null
  });
  
  // Estado de Contraseñas
  const [passwords, setPasswords] = useState({ 
    current_password: "", 
    new_password: "", 
    confirm_password: "" 
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await apiFetch(`${API_URL}/api/profile`);
      setProfile(data);
      if (data.AVATAR) setPreviewAvatar(`${API_URL}${data.AVATAR}`);
    } catch (err) { console.error(err); }
  };

  // --- MANEJADORES ---
  const handleChange = (e) => setProfile({...profile, [e.target.name]: e.target.value});
  
  const handlePassChange = (e) => setPasswords({...passwords, [e.target.name]: e.target.value});

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setPreviewAvatar(URL.createObjectURL(file)); 
    }
  };

  // 1. Guardar Perfil (Info + Avatar)
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
      }
    } catch (err) {
      setMsg({ type: "error", text: "Error al actualizar perfil." });
    }
  };

  // 2. Guardar Contraseña (Separado por seguridad)
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
        setMsg({ type: "success", text: "Contraseña actualizada correctamente." });
        setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      } else {
        setMsg({ type: "error", text: data.message || "Error al cambiar contraseña." });
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Error de conexión." });
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
              
              {/* ------------------------------------------------------ */}
              {/* 🟦 COLUMNA IZQUIERDA — 3 TARJETAS UNA DEBAJO DE OTRA   */}
              {/* ------------------------------------------------------ */}
              <div className="profile-edit-column">

                {/* --- 1. DATOS PERSONALES --- */}
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

                  <button className="btn-save-profile" onClick={handleSaveChanges}>
                    Guardar Cambios
                  </button>
                </div>


                {/* --- 2. SEGURIDAD --- */}
                <div className="settings-card security-card">
                  <h3><Lock size={18}/> Seguridad</h3>

                  <div className="form-group">
                    <label>Contraseña Actual</label>
                    <input 
                      type="password" 
                      name="current_password" 
                      value={passwords.current_password} 
                      onChange={handlePassChange} 
                      className="input-field"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Nueva Contraseña</label>
                      <input 
                        type="password" 
                        name="new_password" 
                        value={passwords.new_password} 
                        onChange={handlePassChange} 
                        className="input-field"
                        placeholder="Nueva clave"
                      />
                    </div>

                    <div className="form-group">
                      <label>Confirmar</label>
                      <input 
                        type="password" 
                        name="confirm_password" 
                        value={passwords.confirm_password} 
                        onChange={handlePassChange} 
                        className="input-field"
                        placeholder="Repetir clave"
                      />
                    </div>
                  </div>

                  <button className="btn-save-password" onClick={handlePasswordSubmit}>
                    Actualizar Contraseña
                  </button>
                </div>


                {/* --- 3. APARIENCIA --- */}
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

              </div> {/* Fin perfil-edit-column */}



              {/* ------------------------------------------------------ */}
              {/* 🟩 COLUMNA DERECHA — VISTA PREVIA                      */}
              {/* ------------------------------------------------------ */}
              <div className="profile-preview-column">

                <h3 className="preview-title">Vista Previa</h3>
                <p className="preview-subtitle">Así te verán los administradores.</p>
                
                <div className="discord-card preview-card">
                  
                  {/* Banner */}
                  <div className="card-banner" style={{background: profile.BANNER_COLOR}}></div>

                  {/* Avatar */}
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
                      <span className="username-tag">
                        @{profile.NOMBRE?.toLowerCase()}_{profile.APELLIDO?.toLowerCase()}
                      </span>
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