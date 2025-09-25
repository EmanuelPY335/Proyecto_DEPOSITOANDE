import React from "react";
import styles from "../styles/Login.module.css"; // 👈 Mismo archivo CSS

const RegisterModal = ({ registro, handleRegistroChange, handleRegistroSubmit, onClose }) => {
  return (
    <div 
      className={styles.modal} 
      onClick={(e) => e.target.classList.contains(styles.modal) && onClose()}
    >
      <div className={styles.modalContent}>
        <span className={styles.close} onClick={onClose}>&times;</span>
        <h2>Crear Cuenta</h2>
        <form onSubmit={handleRegistroSubmit} className={styles.modalForm}>
          <input 
            type="text" 
            name="nombre" 
            placeholder="Nombre" 
            value={registro.nombre} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalInput}
          />
          <input 
            type="text" 
            name="apellido" 
            placeholder="Apellido" 
            value={registro.apellido} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalInput}
          />
          <input 
            type="date" 
            name="fecha" 
            value={registro.fecha} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalInput}
          />
          <input 
            type="text" 
            name="cedula" 
            placeholder="Cédula" 
            value={registro.cedula} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalInput}
          />
          
          <select 
            name="cargo" 
            value={registro.cargo} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalSelect}
          >
            <option value="">--Selecciona un cargo--</option>
            <option value="Empleado">Empleado</option>
            <option value="Contratista">Contratista</option>
          </select>

          <input 
            type="tel" 
            name="telefono" 
            placeholder="Teléfono" 
            value={registro.telefono} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalInput}
          />
          <input 
            type="email" 
            name="correo" 
            placeholder="Correo" 
            value={registro.correo} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalInput}
          />
          <input 
            type="password" 
            name="contrasena" 
            placeholder="Contraseña" 
            value={registro.contrasena} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalInput}
          />
          <input 
            type="password" 
            name="confirmar" 
            placeholder="Confirmar contraseña" 
            value={registro.confirmar} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalInput}
          />

          <div className={styles.modalButtons}>
            <button type="submit" className={styles.btnRegistrar}>Registrarse</button>
            <button type="button" className={styles.btnCancelar} onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterModal;