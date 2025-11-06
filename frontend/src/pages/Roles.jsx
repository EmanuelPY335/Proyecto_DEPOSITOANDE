// src/pages/Roles.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { apiFetch } from "../utils/api";
import "../styles/Roles.css";

const API = "http://127.0.0.1:5000";

const Roles = () => {
  const [roles, setRoles] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const loadData = async () => {
    setMsg("");
    try {
      const [r, e] = await Promise.all([
        apiFetch(`${API}/api/roles`),
        apiFetch(`${API}/api/empleados`),   // <-- necesitas este endpoint en backend
      ]);
      setRoles(r || []);
      setEmpleados(e || []);
    } catch (err) {
      setMsg(err.message || "Error al cargar datos.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChangeRol = async (idUsuario, nuevoRol) => {
    setSaving(true);
    setMsg("");
    try {
      const resp = await apiFetch(`${API}/api/asignar-rol`, {
        method: "PUT",
        body: JSON.stringify({ usuario_id: idUsuario, rol: nuevoRol }),
      });
      setMsg(resp.msg || "Rol actualizado.");
      await loadData();
    } catch (err) {
      setMsg(err.message || "Error al asignar rol.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <div className="main-area">
        <Sidebar />
        <div className="content-dashboard">
          <h1>Roles y Permisos</h1>
          <p className="subtitle">Solo visible para el Gerente (Master_Admin).</p>

          {msg && <p className={msg.toLowerCase().includes("error") ? "msg-error" : "msg-success"}>{msg}</p>}

          <div className="form-container" style={{maxWidth: 1000}}>
            <h2>Usuarios</h2>
            <div style={{overflowX: "auto"}}>
              <table style={{width: "100%", borderCollapse: "collapse"}}>
                <thead>
                  <tr>
                    <th style={{textAlign: "left", padding: 8}}>Empleado</th>
                    <th style={{textAlign: "left", padding: 8}}>Correo</th>
                    <th style={{textAlign: "left", padding: 8}}>Rol actual</th>
                    <th style={{textAlign: "left", padding: 8}}>Nuevo rol</th>
                    <th style={{textAlign: "left", padding: 8}}></th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((u) => (
                    <tr key={u.ID_USUARIO}>
                      <td style={{padding: 8}}>{u.NOMBRE} {u.APELLIDO}</td>
                      <td style={{padding: 8}}>{u.CORREO}</td>
                      <td style={{padding: 8}}>{u.ROL}</td>
                      <td style={{padding: 8}}>
                        <select
                          defaultValue={u.ROL}
                          onChange={(e) => handleChangeRol(u.ID_USUARIO, e.target.value)}
                          disabled={saving}
                          className="modalSelect"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.nombre}>{r.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{padding: 8}}>
                        <button
                          className="btn-guardar"
                          onClick={() => handleChangeRol(u.ID_USUARIO, document.querySelector(`select[value="${u.ID_USUARIO}"]`)?.value)}
                          disabled={saving}
                          style={{display:"none"}}
                        >
                          Guardar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {empleados.length === 0 && (
                    <tr><td colSpan={5} style={{padding: 8, color: "#777"}}>No hay usuarios.</td></tr>
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

export default Roles;
