// sisdepo/frontend/src/pages/Profile.jsx (ACTUALIZADO AHORA SÍ)
import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import "../styles/index.css";
// --- CAMBIO: Ya no importamos Home.css ---
import "../styles/Profile.css"; // Este se queda para el layout

const API_URL = "http://127.0.0.1:5000";

const Profile = () => {
  const [profileData, setProfileData] = useState({
    NOMBRE: "",
    APELLIDO: "",
    TELEFONO: "",
    CORREO: "",
  });

  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // (Tu lógica de useEffect y handlers de submit no cambia...)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await apiFetch(`${API_URL}/api/profile`);

        if (data) {
          setProfileData(data);
          if (data.NOMBRE) {
            sessionStorage.setItem("user_nombre", data.NOMBRE);
            window.dispatchEvent(new Event("storage"));
          }
        } else {
          throw new Error("No se recibieron datos del perfil.");
        }
      } catch (err) {
        console.error("Error en fetchProfile:", err);
        if (err.message && err.message.includes("Failed to fetch")) {
          setError("No se pudo conectar con el servidor.");
        } else {
          setError(err.message || "Error al cargar el perfil.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const data = await apiFetch(`${API_URL}/api/profile`, {
        method: "PUT",
        body: JSON.stringify(profileData),
      });

      if (data.success) {
        setSuccess(data.message);
        sessionStorage.setItem("user_nombre", profileData.NOMBRE);
        window.dispatchEvent(new Event("storage"));
      } else {
        setError(data.message || "Error al actualizar.");
      }
    } catch (err) {
      setError(err.message || "Error al actualizar.");
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (passwords.new_password !== passwords.confirm_password) {
      setError("Las nuevas contraseñas no coinciden.");
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
        setSuccess(data.message);
        setPasswords({
          current_password: "",
          new_password: "",
          confirm_password: "",
        });
      } else {
        setError(data.message || "Error al cambiar contraseña.");
      }
    } catch (err) {
      setError(err.message || "Error al cambiar contraseña.");
    }
  };


  return (
    <>
      {/* ESTOS TÍTULOS ESTABAN OCULTOS EN TU CAPTURA, 
        ASEGÚRATE DE QUE SE VEAN 
      */}
      <h1>Mi Perfil</h1>
      <p className="subtitle">Edita tu información personal y de seguridad.</p>

      {loading && <p>Cargando perfil...</p>}

      <div className="profile-forms-column">
        {/* Formulario 1: Datos Personales */}
        <div className="form-container">
          <h2>Datos Personales</h2>
          <form onSubmit={handleProfileSubmit}>
            {/* <--- CAMBIO: Añadido .form-group --- */}
            <div className="form-group"> 
              <label htmlFor="nombre">Nombre</label>
              <input
                type="text"
                id="nombre"
                name="NOMBRE"
                value={profileData.NOMBRE}
                onChange={handleProfileChange}
                required
                className="input-field" // <--- CAMBIO
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="apellido">Apellido</label>
              <input
                type="text"
                id="apellido"
                name="APELLIDO"
                value={profileData.APELLIDO}
                onChange={handleProfileChange}
                required
                className="input-field" // <--- CAMBIO
              />
            </div>

            <div className="form-group">
              <label htmlFor="telefono">Teléfono</label>
              <input
                type="tel"
                id="telefono"
                name="TELEFONO"
                value={profileData.TELEFONO}
                onChange={handleProfileChange}
                required
                className="input-field" // <--- CAMBIO
              />
            </div>

            <div className="form-group">
              <label htmlFor="correo">Correo Electrónico</label>
              <input
                type="email"
                id="correo"
                name="CORREO"
                value={profileData.CORREO}
                onChange={handleProfileChange}
                required
                className="input-field" // <--- CAMBIO
              />
            </div>

            {/* <--- CAMBIO: .btn y .btn-primary --- */}
            <button type="submit" className="btn btn-primary"> 
              Actualizar Datos
            </button>
          </form>
        </div>

        {/* Formulario 2: Cambiar Contraseña */}
        <div className="form-container">
          <h2>Cambiar Contraseña</h2>
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label htmlFor="current_password">Contraseña Actual</label>
              <input
                type="password"
                id="current_password"
                name="current_password"
                value={passwords.current_password}
                onChange={handlePasswordChange}
                required
                className="input-field" // <--- CAMBIO
              />
            </div>

            <div className="form-group">
              <label htmlFor="new_password">Nueva Contraseña</label>
              <input
                type="password"
                id="new_password"
                name="new_password"
                value={passwords.new_password}
                onChange={handlePasswordChange}
                required
                className="input-field" // <--- CAMBIO
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                value={passwords.confirm_password}
                onChange={handlePasswordChange}
                required
                className="input-field" // <--- CAMBIO
              />
            </div>

            {/* <--- CAMBIO: Usamos clases de index.css + la de Profile.css --- */}
            <button
              type="submit"
              className="btn btn-primary btn-alternate"
            >
              Cambiar Contraseña
            </button>
          </form>
        </div>
      </div>

      {/* Mensajes de éxito o error */}
      <div
        style={{
          marginTop: "20px",
          maxWidth: "1024px",
          margin: "20px auto 0 auto",
        }}
      >
        {/* <--- CAMBIO: Añadimos la clase base 'msg' --- */}
        {error && <p className="msg msg-error">{error}</p>}
        {success && <p className="msg msg-success">{success}</p>}
      </div>
    </>
  );
};

export default Profile;