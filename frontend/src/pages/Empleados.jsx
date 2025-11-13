// src/pages/Empleados.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

const API = "http://127.0.0.1:5000";

const Empleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      setMsg("");
      try {
        const data = await apiFetch(`${API}/api/empleados`);
        console.log("Empleados desde backend:", data); // 👈 para debug
        setEmpleados(data || []);
      } catch (err) {
        setMsg(err.message || "Error al cargar empleados.");
      }
    };
    load();
  }, []);

  return (
    <>
      <h1>Empleados</h1>
      <p className="subtitle">Listado general de empleados del sistema.</p>

      {msg && <p className="msg msg-error">{msg}</p>}

      <div className="table-wrapper">
        <table className="styled-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Cédula</th>
              <th>Fecha Nac.</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th>Depósito</th>
              <th>Cargo</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((e) => (
              <tr key={e.id}>
                <td>{e.nombre}</td>
                <td>{e.apellido}</td>
                <td>{e.NUMERO_DOCUMENTO || "—"}</td>
                <td>{e.FECHA_NACIMIENTO || "—"}</td>
                <td>{e.telefono || "—"}</td>
                <td>{e.correo}</td>
                <td>{e.ID_DEPOSITO || "—"}</td>
                <td>{e.rol}</td>
              </tr>
            ))}

            {empleados.length === 0 && (
              <tr>
                <td colSpan="8">No hay empleados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Empleados;
