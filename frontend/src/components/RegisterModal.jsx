import React, { useState, useEffect } from "react";
import styles from "../styles/Login.module.css";
// import { apiFetch } from "../utils/api"; <--- YA NO LO NECESITAS AQUÍ

const RegisterModal = ({ onClose, reload }) => {
  
  const [registro, setRegistro] = useState({
    nombre: "", apellido: "", fecha: "", cedula: "", deposito: "",
    telefono: "", correo: "", contrasena: "", confirmar: ""
  });

  const [depositosList, setDepositosList] = useState([]);

  // ---------------------------------------------------------
  // CORRECCIÓN AQUÍ: Usamos fetch normal, NO apiFetch
  // ---------------------------------------------------------
  useEffect(() => {
    async function fetchDepositos() {
      try {
        console.log("📡 Fetching depositos..."); // Debug en consola del navegador
        const response = await fetch("http://127.0.0.1:5000/api/depositos_publico", {
             method: "GET",
             headers: {
                 "Content-Type": "application/json"
                 // IMPORTANTE: NO enviar el header 'Authorization' aquí
             }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("✅ Depósitos cargados:", data);
          setDepositosList(data);
        } else {
          const errorText = await response.text();
          console.error("❌ Error backend:", errorText);
        }
      } catch (error) {
        console.error("❌ Error de red:", error);
      }
    }
    fetchDepositos();
  }, []);
  // ---------------------------------------------------------

  const handleRegistroChange = (e) => {
    const { name, value } = e.target;
    setRegistro((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegistroSubmit = async (e) => {
    e.preventDefault(); // Evita el reinicio del form
    
    if (registro.contrasena !== registro.confirmar) {
      alert("Las contraseñas no coinciden");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            // Asegúrate de enviar los nombres exactos que espera el backend
            nombre: registro.nombre,
            apellido: registro.apellido,
            cedula: registro.cedula,
            telefono: registro.telefono,
            correo: registro.correo,
            contrasena: registro.contrasena,
            deposito: registro.deposito, 
            fecha: registro.fecha
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Cuenta creada con éxito.");
        if (reload) reload();
        onClose();
      } else {
        alert("❌ Error: " + (data.message || "No se pudo registrar"));
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión con el servidor");
    }
  };

  return (
    <div className={styles.modal} onClick={(e) => e.target.classList.contains(styles.modal) && onClose()}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <span className={styles.close} onClick={onClose}>&times;</span>
        <h2>Crear Cuenta</h2>
        <form onSubmit={handleRegistroSubmit} className={styles.modalForm}>
          {/* ... TUS INPUTS SIGUEN IGUAL ... */}
          <input type="text" name="nombre" placeholder="Nombre" value={registro.nombre} onChange={handleRegistroChange} required className={styles.modalInput} />
          <input type="text" name="apellido" placeholder="Apellido" value={registro.apellido} onChange={handleRegistroChange} required className={styles.modalInput} />
          <input type="date" name="fecha" value={registro.fecha} onChange={handleRegistroChange} required className={styles.modalInput} />
          <input type="text" name="cedula" placeholder="Cédula" value={registro.cedula} onChange={handleRegistroChange} required className={styles.modalInput} />
          
          <select name="deposito" value={registro.deposito} onChange={handleRegistroChange} required className={styles.modalSelect}>
            <option value="">-- Selecciona Depósito --</option>
            {depositosList.map((deposito) => (
              <option key={deposito.ID_DEPOSITO} value={deposito.ID_DEPOSITO}>{deposito.NOMBRE}</option>
            ))}
          </select>

          <input type="tel" name="telefono" placeholder="Teléfono" value={registro.telefono} onChange={handleRegistroChange} required className={styles.modalInput} />
          <input type="email" name="correo" placeholder="Correo" value={registro.correo} onChange={handleRegistroChange} required className={styles.modalInput} />
          <input type="password" name="contrasena" placeholder="Contraseña" value={registro.contrasena} onChange={handleRegistroChange} required className={styles.modalInput} />
          <input type="password" name="confirmar" placeholder="Confirmar contraseña" value={registro.confirmar} onChange={handleRegistroChange} required className={styles.modalInput} />

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