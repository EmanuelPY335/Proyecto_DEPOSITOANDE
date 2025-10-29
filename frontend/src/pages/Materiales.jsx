// Materiales.jsx
import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import "../styles/Home.css"; 
import "../styles/Materiales.css";
import { apiFetch } from "../utils/api"; // <--- CAMBIO: Importar apiFetch

const Materiales = () => {
  const [materiales, setMateriales] = useState([]);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchMateriales = async () => {
    try {
      // <--- CAMBIO: Usar apiFetch --->
      const data = await apiFetch("http://127.0.0.1:5000/api/materiales");
      setMateriales(data);
    } catch (err) {
      setError(err.message || "Error de conexión al servidor");
    }
  };

  // Cargar materiales al inicio
  useEffect(() => {
    fetchMateriales();
  }, []);

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      // <--- CAMBIO: Usar apiFetch --->
      const data = await apiFetch("http://127.0.0.1:5000/api/materiales", {
        method: "POST",
        body: JSON.stringify({ nombre: nombre, codigo_unico: codigo }),
      });
      
      if (data.success) {
        setSuccess(data.message);
        setNombre(""); 
        setCodigo("");
        fetchMateriales(); // Recargar la lista
      } else {
        setError(data.message || "Error al guardar el material");
      }
    } catch (err) {
      setError(err.message || "Error de conexión al servidor");
    }
  };

  return (
    <div className="dashboard-layout">
      {/* (Asumimos que el Navbar se renderiza aquí o en App.jsx) */}
      
      <div className="main-area">
        <Sidebar /> {/* Sidebar a la izquierda */}
        
        <div className="content-dashboard">
          <h1>Gestión de Materiales</h1>
          <p className="subtitle">Añada o vea los materiales del depósito.</p>
          
          <div className="materiales-container">
            {/* Formulario para añadir */}
            <div className="form-container">
              <h2>Añadir Nuevo Material</h2>
              <form onSubmit={handleAddMaterial}>
                <input
                  type="text"
                  placeholder="Código Único (Ej: 12345)"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Nombre del Material (Ej: Cable 2mm)"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
                <button type="submit" className="btn-guardar">Guardar Material</button>
              </form>
              {error && <p className="msg-error">{error}</p>}
              {success && <p className="msg-success">{success}</p>}
            </div>

            {/* Tabla de materiales existentes */}
            <div className="table-container">
              <h2>Materiales en Sistema</h2>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Código Único</th>
                    <th>Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((material) => (
                    <tr key={material.ID_MATERIAL}>
                      <td>{material.ID_MATERIAL}</td>
                      <td>{material.CODIGO_UNICO}</td>
                      <td>{material.NOMBRE}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Materiales;