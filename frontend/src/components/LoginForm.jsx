import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import RegisterModal from "./RegisterModal"; 
import ForgotPassModal from "./ForgotPassModal";
import styles from "../styles/Login.module.css";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false); 

  const [registro, setRegistro] = useState({
    nombre: "", apellido: "", fecha: "", cedula: "", deposito: "",
    telefono: "", correo: "", contrasena: "", confirmar: "",
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Revisa si fuimos redirigidos a esta página con un mensaje
  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
      // Limpiamos el state para que el mensaje no se quede
      window.history.replaceState({}, document.title)
    }
  }, [location]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); // Limpiar mensaje en un nuevo intento
    
    try {
      // 1. PETICIÓN DE LOGIN (Obtener Token)
      // CORRECCIÓN 1: La URL correcta es /api/login (según tu main.py)
      const response = await fetch("http://127.0.0.1:5000/api/login", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // CORRECCIÓN 2: Tu backend espera "contrasena", no "password"
        body: JSON.stringify({ correo: email, contrasena: password }), 
      });
      
      const data = await response.json();
      
      if (data.access_token) {
        // --- LÓGICA DE PERMISOS INTEGRADA ---
        
        // A. Guardamos el token y datos básicos
        sessionStorage.setItem("access_token", data.access_token);

        // B. Inmediatamente pedimos el PERFIL para obtener los permisos reales
        try {
            const perfilResponse = await fetch("http://127.0.0.1:5000/api/profile", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${data.access_token}`,
                    "Content-Type": "application/json"
                }
            });

              if (perfilResponse.ok) {
                const perfilData = await perfilResponse.json();
                
                const nombreCompleto = `${perfilData.NOMBRE} ${perfilData.APELLIDO}`;
                sessionStorage.setItem("user_nombre", nombreCompleto);
                sessionStorage.setItem("user_rol", perfilData.rol);
                sessionStorage.setItem("user_id", perfilData.ID_USUARIO);
                // LoginForm.jsx
 
                // 🔥 AGREGAR ESTA LÍNEA IMPORTANTE 🔥
                sessionStorage.setItem("user_deposito_id", perfilData.ID_DEPOSITO);
                
                const permisos = perfilData.permisos || [];
                sessionStorage.setItem("user_permissions", JSON.stringify(permisos));

            } else {
                console.warn("No se pudo cargar el perfil completo, usando datos básicos.");
                // Fallback si falla el perfil
                sessionStorage.setItem("user_permissions", "[]");
            }
        } catch (err) {
            console.error("Error fetching profile:", err);
            sessionStorage.setItem("user_permissions", "[]");
        }

        // C. Redirigir al Home
        navigate("/home");

      } else {
        setMessage(data.message || "Correo o contraseña incorrectos");
      }
    } catch (error) {
      console.error(error);
      setMessage("Ocurrió un error en el servidor");
    }
  };

  const handleRegistroChange = (e) => {
    setRegistro({ ...registro, [e.target.name]: e.target.value });
  };

  const handleRegistroSubmit = async (e) => {
    e.preventDefault();
    if (registro.contrasena !== registro.confirmar) {
        alert("Las contraseñas no coinciden");
        return;
    }
    // Lógica de registro
    try {
      const response = await fetch("http://127.0.0.1:5000/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registro),
      });
      const data = await response.json();
      if (data.success) {
        console.log("✅ Registro exitoso");
        setShowModal(false);
        setMessage("Registro exitoso. Por favor inicia sesión.");
      } else {
        console.error("❌ Error en registro:", data.message);
        alert(data.message);
      }
    } catch (error) {
      console.error("❌ Error al conectar con el servidor:", error);
    }
  };

  // --- TU RENDERIZADO ORIGINAL (Mantiene el diseño centrado) ---
  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginContainer}>
        <h2>Inicia Sesión</h2>
        <form onSubmit={handleLoginSubmit}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.inputField}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.inputField}
          />
          <button type="submit" className={styles.loginButton}>
            Iniciar Sesión
          </button>
        </form>

        <div className={styles.options}>
          <button
            type="button"
            className={styles.registerBtn}
            onClick={() => setShowModal(true)}
          >
            Crear cuenta
          </button>
          <button
            type="button"
            className={styles.forgotLink}
            onClick={() => setShowForgotModal(true)}
          >
            Olvidé la contraseña
          </button>
        </div>

        {message && <p className={styles.loginMessage}>{message}</p>}

        {showModal && (
          <RegisterModal
            registro={registro}
            handleRegistroChange={handleRegistroChange}
            handleRegistroSubmit={handleRegistroSubmit}
            onClose={() => setShowModal(false)}
          />
        )}
        
        {showForgotModal && (
          <ForgotPassModal onClose={() => setShowForgotModal(false)} />
        )}

      </div>
    </div>
  );
};

export default LoginForm;