// sisdepo/frontend/src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Link, useNavigate } from "react-router-dom";
import { Settings, Bell, UserCircle } from "lucide-react";
import { apiFetch } from "../utils/api"; // Tu wrapper de fetch
import "../styles/Home.css"; // Reusamos los estilos de Home

// --- ESTA ES LA CORRECCIÓN ---
// Definimos la URL base de tu backend
const API_URL = "http://127.0.0.1:5000";
// --- FIN DE LA CORRECCIÓN ---

// Componente de estilos (para no necesitar Materiales.css)
const ProfileStyles = () => (
  <style>{`
    .form-container {
      background: #ffffff;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
    }
    .form-container h2 {
      text-align: center;
      margin-top: 0;
      margin-bottom: 1.5rem;
      color: #333;
    }
    .form-container form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-container label {
      font-weight: 500;
      font-size: 0.9em;
      color: #555;
      margin-bottom: -10px;
    }
    .form-container input {
      width: 100%;
      padding: 0.8rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 1em;
      box-sizing: border-box;
    }
    .btn-guardar {
      padding: 0.9rem;
      border: none;
      border-radius: 8px;
      background: #007bff;
      color: white;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    .btn-guardar:hover {
      background: #0056b3;
    }
    .msg-error {
      color: #c62828;
      background: #ffebee;
      border: 1px solid #ffcdd2;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      margin-top: 1rem;
    }
    .msg-success {
      color: #1e7d32; /* Un verde más oscuro para el texto */
      background: #e8f5e9;
      border: 1px solid #c8e6c9;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      margin-top: 1rem;
    }
    .profile-forms-column {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    /* Layout responsivo para los formularios */
    @media (min-width: 992px) {
      .profile-forms-column {
        flex-direction: row; /* Lado a lado en pantallas grandes */
        align-items: flex-start;
      }
      .form-container {
        flex: 1; /* Cada formulario toma la mitad del espacio */
      }
    }
  `}</style>
);


const Profile = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState(sessionStorage.getItem("user_nombre") || "Usuario");

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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(""); // Limpiar error anterior
        
        // --- ESTA ES LA CORRECCIÓN ---
        const data = await apiFetch(`${API_URL}/api/profile`);
        // --- FIN DE LA CORRECCIÓN ---

        if (data) {
          setProfileData(data);
          // Sincronizamos el nombre en la Navbar
          if (data.NOMBRE) {
            sessionStorage.setItem("user_nombre", data.NOMBRE);
            setUserName(data.NOMBRE);
          }
        } else {
          // Esto puede pasar si apiFetch devuelve null
          throw new Error("No se recibieron datos del perfil.");
        }
      } catch (err) {
        console.error("Error en fetchProfile:", err);
        if (err.message.includes("Failed to fetch")) {
          setError("No se pudo conectar con el servidor. ¿Está el backend corriendo?");
        } else {
          setError(err.message || "Error al cargar el perfil.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []); // El array vacío [] asegura que se ejecute solo una vez

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
      // --- ESTA ES LA CORRECCIÓN ---
      const data = await apiFetch(`${API_URL}/api/profile`, {
      // --- FIN DE LA CORRECCIÓN ---
        method: "PUT",
        body: JSON.stringify(profileData),
      });

      if (data.success) {
        setSuccess(data.message);
        sessionStorage.setItem("user_nombre", profileData.NOMBRE);
        setUserName(profileData.NOMBRE);
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
      // --- ESTA ES LA CORRECCIÓN ---
      const data = await apiFetch(`${API_URL}/api/profile/change-password`, {
      // --- FIN DE LA CORRECCIÓN ---
        method: "POST",
        body: JSON.stringify({
          current_password: passwords.current_password,
          new_password: passwords.new_password,
        }),
      });

      if (data.success) {
        setSuccess(data.message);
        setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      } else {
        setError(data.message || "Error al cambiar contraseña.");
      }

    } catch (err) {
      setError(err.message || "Error al cambiar contraseña.");
    }
  };

  // --- Navbar (Copiado de Home.jsx) ---
  const DashboardNavbar = () => (
    <nav className="navbar-dashboard">
      <div className="navbar-left">
        <Settings size={24} className="navbar-logo-icon" />
        <span className="navbar-brand-title">SISDEPO</span>
      </div>
      <div className="navbar-right">
        <div className="notification-icon-wrapper">
          <Bell size={20} />
        </div>
        <Link to="/profile" className="navbar-profile-link">
          <UserCircle size={28} className="profile-icon" />
          <span className="profile-name">{userName}</span>
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="dashboard-layout">
      <ProfileStyles />
      <DashboardNavbar />
      <div className="main-area">
        <Sidebar />
        <div className="content-dashboard">
          <h1>Mi Perfil</h1>
          <p className="subtitle">Edita tu información personal y de seguridad.</p>

          {loading && <p>Cargando perfil...</p>}
          
          <div className="profile-forms-column">
            
            {/* Formulario 1: Datos Personales */}
            <div className="form-container">
              <h2>Datos Personales</h2>
              <form onSubmit={handleProfileSubmit}>
                <label htmlFor="nombre">Nombre</label>
                <input
                  type="text"
                  id="nombre"
                  name="NOMBRE"
                  value={profileData.NOMBRE}
                  onChange={handleProfileChange}
                  required
                />
                <label htmlFor="apellido">Apellido</label>
                <input
                  type="text"
                  id="apellido"
                  name="APELLIDO"
                  value={profileData.APELLIDO}
                  onChange={handleProfileChange}
                  required
                />
                <label htmlFor="telefono">Teléfono</label>
                <input
                  type="tel"
                  id="telefono"
                  name="TELEFONO"
                  value={profileData.TELEFONO}
                  onChange={handleProfileChange}
                  required
                />
                <label htmlFor="correo">Correo Electrónico</label>
                <input
                  type="email"
                  id="correo"
                  name="CORREO"
                  value={profileData.CORREO}
                  onChange={handleProfileChange}
                  required
                />
                <button type="submit" className="btn-guardar">Actualizar Datos</button>
              </form>
            </div>

            {/* Formulario 2: Cambiar Contraseña */}
            <div className="form-container">
              <h2>Cambiar Contraseña</h2>
              <form onSubmit={handlePasswordSubmit}>
                <label htmlFor="current_password">Contraseña Actual</label>
                <input
                  type="password"
                  id="current_password"
                  name="current_password"
                  value={passwords.current_password}
                  onChange={handlePasswordChange}
                  required
                />
                <label htmlFor="new_password">Nueva Contraseña</label>
                <input
                  type="password"
                  id="new_password"
                  name="new_password"
                  value={passwords.new_password}
                  onChange={handlePasswordChange}
                  required
                />
                <label htmlFor="confirm_password">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  value={passwords.confirm_password}
                  onChange={handlePasswordChange}
                  required
                />
                <button type="submit" className="btn-guardar" style={{backgroundColor: '#6f42c1'}}>Cambiar Contraseña</button>
              </form>
            </div>
            
          </div>
          
          {/* Mensajes de éxito o error (movidos fuera del grid) */}
          <div style={{marginTop: '20px', maxWidth: '1024px', margin: '20px auto 0 auto'}}>
            {error && <p className="msg-error">{error}</p>}
            {success && <p className="msg-success">{success}</p>}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;