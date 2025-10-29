// ForgotPassModal.jsx
import React, { useState } from "react";
import styles from "../styles/Login.module.css"; 

const ForgotPassModal = ({ onClose }) => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const response = await fetch("http://127.0.0.1:5000/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Mostramos el mensaje genérico del backend
        setMessage(data.message);
      } else {
        setError(data.error || "Error al procesar la solicitud.");
      }
    } catch (err) {
      setError("Error de conexión con el servidor.");
    }
  };

  return (
    <div 
      className={styles.modal} 
      onClick={(e) => e.target.classList.contains(styles.modal) && onClose()}
    >
      <div className={styles.modalContent}>
        <span className={styles.close} onClick={onClose}>&times;</span>
        <h2>Recuperar Contraseña</h2>
        <p>Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.</p>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <input 
            type="email" 
            name="email" 
            placeholder="Correo electrónico" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className={styles.modalInput}
          />
          <div className={styles.modalButtons}>
            <button type="submit" className={styles.btnRegistrar}>Enviar Enlace</button>
          </div>
        </form>
        
        {/* Asumiendo que tienes estilos msgSuccess y msgError en Login.module.css */}
        {message && <p style={{color: 'green', marginTop: '10px'}}>{message}</p>}
        {error && <p style={{color: 'red', marginTop: '10px'}}>{error}</p>}
      </div>
    </div>
  );
};

export default ForgotPassModal;