// sisdepo/frontend/src/pages/ResetPassword.jsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Usamos los mismos estilos del login para mantener la coherencia
import styles from '../styles/Login.module.css'; 

const ResetPassword = () => {
  // useParams() lee el ':token' de la URL
  const { token } = useParams(); 
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Enviamos el token de la URL y la nueva contraseña al backend
        body: JSON.stringify({ token, password }), 
      });

      const data = await response.json();

      if (data.success) {
        setMessage('¡Contraseña actualizada con éxito! Serás redirigido al Login.');
        // Esperamos 3 segundos y lo mandamos al login
        setTimeout(() => {
          navigate('/'); // Redirige a /login
        }, 3000);
      } else {
        // Muestra errores del backend (ej: "Token expirado")
        setError(data.message || 'Error al resetear la contraseña.');
      }
    } catch (err) {
      setError('Error de conexión con el servidor.');
    }
  };

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginContainer}>
        <h2>Restablecer Contraseña</h2>
        <p>Ingresa tu nueva contraseña.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nueva Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.inputField}
          />
          <input
            type="password"
            placeholder="Confirmar Nueva Contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={styles.inputField}
          />
          <button type="submit" className={styles.loginButton}>
            Actualizar Contraseña
          </button>
        </form>
        
        {/* Mensajes de éxito o error */}
        {message && <p style={{color: 'green', marginTop: '10px'}}>{message}</p>}
        {error && <p className={styles.loginMessage}>{error}</p>}
      </div>
    </div>
  );
};

export default ResetPassword;