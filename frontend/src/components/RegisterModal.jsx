import React, { useState, useEffect } from "react";
import styles from "../styles/Login.module.css"; // Tus estilos originales
import { apiFetch } from "../utils/api"; // Usamos tu utilidad para mantener la sesión si es necesario

// Eliminé las props que causaban error y dejé solo onClose y reload (para recargar la tabla al terminar)
const RegisterModal = ({ onClose, reload }) => {
  
  // 1. ESTADO INTERNO (Esto arregla el error "Cannot read properties of undefined")
  const [registro, setRegistro] = useState({
    nombre: "",
    apellido: "",
    fecha: "",
    cedula: "",
    deposito: "",
    telefono: "",
    correo: "",
    contrasena: "",
    confirmar: ""
  });

  const [depositosList, setDepositosList] = useState([]);

  // 2. CARGAR DEPÓSITOS (Tu lógica original)
  useEffect(() => {
    async function fetchDepositos() {
      try {
        const response = await fetch("http://127.0.0.1:5000/api/depositos");
        const data = await response.json();
        if (response.ok) {
          setDepositosList(data);
        } else {
          console.error("Error al cargar depósitos:", data.error);
        }
      } catch (error) {
        console.error("Error de red:", error);
      }
    }
    fetchDepositos();
  }, []);

  // 3. MANEJADOR DE CAMBIOS (Copiado para que funcione interno)
  const handleRegistroChange = (e) => {
    const { name, value } = e.target;
    setRegistro((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 4. ENVÍO DEL FORMULARIO (Adaptado para crear empleado desde admin)
  const handleRegistroSubmit = async (e) => {
    e.preventDefault();

    // Validación de contraseñas
    if (registro.contrasena !== registro.confirmar) {
      alert("Las contraseñas no coinciden");
      return;
    }

    try {
      // Usamos apiFetch o fetch normal hacia tu endpoint de empleados
      await apiFetch("http://127.0.0.1:5000/api/empleados", {
        method: "POST",
        body: JSON.stringify({
          nombre: registro.nombre,
          apellido: registro.apellido,
          cedula: registro.cedula,
          telefono: registro.telefono,
          correo: registro.correo,
          contrasena: registro.contrasena,
          id_deposito: registro.deposito,
          // Asumimos rol por defecto o agregamos un select de rol si falta en tu HTML original
          rol: "Empleado", 
          estado: true
        }),
      });

      alert("Empleado registrado con éxito");
      if (reload) reload(); // Recarga la tabla de atrás
      onClose(); // Cierra el modal
    } catch (error) {
      console.error(error);
      alert("Error al registrar: " + error.message);
    }
  };

  // 5. TU HTML ORIGINAL (INTACTO)
  return (
    <div 
      className={styles.modal} 
      onClick={(e) => e.target.classList.contains(styles.modal) && onClose()}
    >
      <div className={styles.modalContent}>
        <span className={styles.close} onClick={onClose}>&times;</span>
        <h2>Crear Cuenta (Empleado)</h2>
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
          
          {/* SELECT DE DEPÓSITOS */}
          <select 
            name="deposito" 
            value={registro.deposito} 
            onChange={handleRegistroChange} 
            required 
            className={styles.modalSelect}
          >
            <option value="">-- Selecciona Depósito --</option>
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
            <button type="submit" className={styles.btnRegistrar}>Registrar</button>
            <button type="button" className={styles.btnCancelar} onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterModal;