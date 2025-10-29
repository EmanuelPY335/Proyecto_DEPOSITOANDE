// proyecto_gemi/frontend/src/components/RegisterModal.jsx

import React, { useState, useEffect } from "react"; // <--- CAMBIO: Importar hooks
import styles from "../styles/Login.module.css";

const RegisterModal = ({ registro, handleRegistroChange, handleRegistroSubmit, onClose }) => {
  
  // <--- CAMBIO: Nuevo estado para guardar la lista de depósitos
  const [depositosList, setDepositosList] = useState([]);

  // <--- CAMBIO: useEffect para cargar los depósitos desde el backend
  useEffect(() => {
    async function fetchDepositos() {
      try {
        // Llamamos a la nueva ruta del backend
        const response = await fetch("http://127.0.0.1:5000/api/depositos");
        const data = await response.json();
        
        if (response.ok) {
          setDepositosList(data); // Guardamos la lista en el estado
        } else {
          console.error("Error al cargar depósitos:", data.error);
        }
      } catch (error) {
        console.error("Error de red al cargar depósitos:", error);
      }
    }
    
    fetchDepositos(); // Ejecutamos la función al cargar el modal
  }, []); // El array vacío [] significa que se ejecuta solo 1 vez


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
          
          {/* <--- CAMBIO: Select de Cargo eliminado ---> */}

          {/* <--- CAMBIO: Añadimos el <select> de Depósitos ---> */}
          <select 
            name="deposito" 
            value={registro.deposito} // Esto guardará el ID_DEPOSITO
            onChange={handleRegistroChange} 
            required 
            className={styles.modalSelect}
          >
            <option value="">-- Selecciona tu Depósito --</option>
            
            {depositosList.map((deposito) => (
              <option key={deposito.ID_DEPOSITO} value={deposito.ID_DEPOSITO}>
                {deposito.NOMBRE}
              </option>
            ))}
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