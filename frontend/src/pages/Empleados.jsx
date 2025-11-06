// src/pages/Empleados.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { apiFetch } from "../utils/api";
import "../styles/Empleados.css";

const API = "http://127.0.0.1:5000";

const Empleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      setMsg("");
      try {
        const data = await apiFetch(`${API}/api/empleados`); // <-- backend requerido
        setEmpleados(data || []);
      } catch (err) {
        setMsg(err.message || "Error al cargar empleados.");
      }
    };
    load();
  }, []);

  return (
    <div className="dashboard-layout">
      <div className="main-area">
        <Sidebar />
        <div className="content-dashboard">
          <h1>Empleados</h1>
          <p className="subtitle">Listado general de empleados del sistema.</p>
          {msg && <p className="msg-error">{msg}</p>}
          <div className="form-container" style={{maxWidth: 1000}}>
            <div style={{overflowX: "auto"}}>
              <table style={{width: "100%", borderCollapse: "collapse"}}>
                <thead>
                  <tr>
                    <th style={{textAlign: "left", padding: 8}}>ID</th>
                    <th style={{textAlign: "left", padding: 8}}>Nombre</th>
                    <th style={{textAlign: "left", padding: 8}}>Apellido</th>
                    <th style={{textAlign: "left", padding: 8}}>Teléfono</th>
                    <th style={{textAlign: "left", padding: 8}}>Correo</th>
                    <th style={{textAlign: "left", padding: 8}}>Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map(e => (
                    <tr key={e.ID_EMPLEADO}>
                      <td style={{padding: 8}}>{e.ID_EMPLEADO}</td>
                      <td style={{padding: 8}}>{e.NOMBRE}</td>
                      <td style={{padding: 8}}>{e.APELLIDO}</td>
                      <td style={{padding: 8}}>{e.TELEFONO || "—"}</td>
                      <td style={{padding: 8}}>{e.CORREO}</td>
                      <td style={{padding: 8}}>{e.ROL}</td>
                    </tr>
                  ))}
                  {empleados.length === 0 && (
                    <tr><td colSpan={6} style={{padding: 8, color: "#777"}}>No hay empleados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Empleados;
