// src/pages/Reportes.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { 
    ShieldAlert, Activity, Search, RefreshCw, FileText, ArrowLeft, 
    Info, Database, Globe, User, X 
} from "lucide-react";
import "../styles/Reportes.css";

const Reportes = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  // ✅ Estado para el modal
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/auditoria?limit=200");
      setLogs(data || []);
    } catch (e) {
      setError("No tienes permiso o hubo un error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(l => 
    (l.detalle || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.usuario || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.accion || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.tabla || "").toLowerCase().includes(search.toLowerCase())
  );

  const getActionClass = (accion) => {
    const act = (accion || "").toUpperCase();
    if (act.includes("BORRAR") || act.includes("ELIMINAR") || act.includes("RECHAZAR") || act.includes("ANULADO")) return "badge-delete";
    if (act.includes("CREAR") || act.includes("NUEVA") || act.includes("INGRESO") || act.includes("LOGIN")) return "badge-create";
    if (act.includes("EDITAR") || act.includes("MODIFICAR") || act.includes("ACTUALIZAR") || act.includes("CAMBIO")) return "badge-update";
    return "badge-info";
  };

  return (
    <div className="audit-container">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>
            <Activity size={28} style={{ marginRight: 10, verticalAlign: 'middle', color: '#60a5fa' }} /> 
            Auditoría del Sistema
          </h1>
          <p className="subtitle">Registro completo de actividades, seguridad y movimientos.</p>
        </div>
        
        <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn-status" onClick={() => navigate("/home")} style={{backgroundColor: "#334155", color: "white", border: "1px solid #475569", display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", cursor: "pointer"}}>
                <ArrowLeft size={18} /> Volver
            </button>
            <button className="btn-new" onClick={loadLogs}>
                <RefreshCw size={18} className={loading ? "spin-anim" : ""} /> Actualizar
            </button>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="audit-search-card">
        <Search className="text-gray-400" size={20} />
        <input 
            type="text" 
            placeholder="Buscar por usuario, acción, tabla o detalle..." 
            className="audit-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* TABLA PRINCIPAL (Minimalista) */}
      {loading && logs.length === 0 ? (
        <div className="text-center p-10 text-gray-400"><div className="spinner" style={{margin: "0 auto 10px"}}></div>Cargando registros...</div>
      ) : error ? (
        <div className="text-center p-10 text-red-400 bg-slate-800 rounded-lg border border-red-900"><ShieldAlert size={48} className="mx-auto mb-2"/>{error}</div>
      ) : (
        <div className="audit-table-card">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Depósito</th>
                <th>Acción</th>
                {/* Quitamos la columna 'Detalle' largo para que sea limpio */}
                <th style={{textAlign:'center'}}>Info</th> 
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="col-fecha">{log.fecha}</td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap: 8}}>
                        <User size={14} className="text-gray-500"/>
                        <div>
                            <span className="user-name">{log.usuario}</span>
                            <span className="user-role">{log.rol}</span>
                        </div>
                    </div>
                  </td>
                  <td><span className="badge-deposito">{log.deposito || "General"}</span></td>
                  <td><span className={`audit-badge ${getActionClass(log.accion)}`}>{log.accion}</span></td>
                  
                  {/* BOTÓN INFO: Abre el modal */}
                  <td style={{textAlign:'center'}}>
                    <button 
                        className="btn-icon-info" 
                        onClick={() => setSelectedLog(log)}
                        title="Ver Detalles Técnicos"
                    >
                        <Info size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && <div className="p-10 text-center text-gray-500">No hay registros.</div>}
        </div>
      )}

      {/* ✅ MODAL DE DETALLE (Diseño Técnico) */}
      {selectedLog && (
        <div className="audit-modal-backdrop" onClick={() => setSelectedLog(null)}>
            <div className="audit-modal" onClick={e => e.stopPropagation()}>
                
                <div className="audit-modal-header">
                    <h2>
                        <Database size={20} color="#60a5fa"/> 
                        Detalle de Auditoría #{selectedLog.id}
                    </h2>
                    <button className="audit-close-btn" onClick={() => setSelectedLog(null)}>
                        <X size={24}/>
                    </button>
                </div>

                <div className="audit-modal-body">
                    {/* Sección 1: Qué pasó */}
                    <label style={{color:'#94a3b8', fontSize:'0.8rem', fontWeight:'bold', textTransform:'uppercase'}}>ACCIÓN REGISTRADA</label>
                    <div style={{display:'flex', alignItems:'center', gap: 10, marginTop: 5, marginBottom: 20}}>
                        <span className={`audit-badge ${getActionClass(selectedLog.accion)}`} style={{fontSize:'1rem'}}>
                            {selectedLog.accion}
                        </span>
                        <span style={{color:'#64748b', fontSize:'0.9rem'}}>{selectedLog.fecha}</span>
                    </div>

                    {/* Sección 2: Narrativa completa */}
                    <label style={{color:'#94a3b8', fontSize:'0.8rem', fontWeight:'bold', textTransform:'uppercase'}}>DETALLE DEL EVENTO</label>
                    <div className="audit-detail-text">
                        {selectedLog.detalle}
                    </div>

                    {/* Sección 3: Datos Técnicos (BD) */}
                    <div className="tech-data-box">
                        <div className="tech-row">
                            <span className="tech-label">TABLA AFECTADA:</span>
                            <span className="tech-value">{selectedLog.tabla || "N/A"}</span>
                        </div>
                        <div className="tech-row">
                            <span className="tech-label">ID REGISTRO:</span>
                            <span className="tech-value">#{selectedLog.id_registro || "N/A"}</span>
                        </div>
                        <div className="tech-row">
                            <span className="tech-label">IP ORIGEN:</span>
                            <span className="tech-value" style={{color:'#f59e0b'}}>{selectedLog.ip || "Localhost"}</span>
                        </div>
                        <div className="tech-row">
                            <span className="tech-label">USUARIO ID:</span>
                            <span className="tech-value">{selectedLog.usuario}</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Reportes;