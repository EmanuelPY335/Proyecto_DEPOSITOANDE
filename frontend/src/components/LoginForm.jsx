import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import RegisterModal from "./RegisterModal"; 
import styles from "../styles/Login.module.css";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [registro, setRegistro] = useState({
    nombre: "", apellido: "", fecha: "", cedula: "", cargo: "",
    telefono: "", correo: "", contrasena: "", confirmar: "",
  });

  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://127.0.0.1:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.success) {
        navigate("/home");
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      setMessage("Ocurrió un error en el servidor");
    }
  };

  const handleRegistroChange = (e) => {
    setRegistro({ ...registro, [e.target.name]: e.target.value });
  };

  const handleRegistroSubmit = async (e) => {
    e.preventDefault();
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
      } else {
        console.error("❌ Error en registro:", data.message);
      }
    } catch (error) {
      console.error("❌ Error al conectar con el servidor:", error);
    }
  };

  return (
    /* 👇 CAMBIO PRINCIPAL: usar loginWrapper en lugar de body */
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
          <a href="/recuperar-contrasena" className={styles.forgotLink}>
            Olvidé la contraseña
          </a>
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
      </div>
    </div>
  );
};

export default LoginForm;