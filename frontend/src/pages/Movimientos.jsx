import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { Calendar, User} from "lucide-react";
import "../styles/Movimientos.css";

const Movimientos = () => {
  const [movimientos, setMovimientos] = useState([]);
  const [filtro, setFiltro] = useState("todos"); // todos, locales, traslados

  useEffect(() => {
    loadMovimientos();
  }, []);

  const loadMovimientos = async () => {
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/movimientos");
      setMovimientos(data || []);
    } catch (e) { console.error(e); }
  };

  const filtered = movimientos.filter(m => {
    if (filtro === "locales") return m.es_local;
    if (filtro === "traslados") return !m.es_local;
    return true;
  });

  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        <div className="page-header">
          <div>
            <h1>Historial de Movimientos</h1>
            <p className="subtitle">Registro de traslados y reubicaciones internas.</p>
          </div>
          <div className="filters" style={{display:'flex', gap:'10px'}}>
             <button className={`btn-status ${filtro==='todos'?'btn-primary':''}`} onClick={()=>setFiltro('todos')}>Todos</button>
             <button className={`btn-status ${filtro==='locales'?'btn-primary':''}`} onClick={()=>setFiltro('locales')}>Internos</button>
             <button className={`btn-status ${filtro==='traslados'?'btn-primary':''}`} onClick={()=>setFiltro('traslados')}>Traslados</button>
          </div>
        </div>

        <div className="discord-card">
          <table className="discord-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Material</th>
                <th>Cant.</th>
                <th>Responsable</th>
                <th>Detalle / Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mov) => (
                <tr key={mov.id}>
                  <td>
                      <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                          <Calendar size={14} color="#aaa"/> {mov.fecha}
                      </div>
                  </td>
                  <td>
                    <span className={`badge-estado ${mov.es_local ? 'pendiente' : 'completada'}`} 
                          style={{background: mov.es_local ? '#3b82f6' : '#8b5cf6', color: 'white'}}>
                        {mov.es_local ? "Local" : "Traslado"}
                    </span>
                  </td>
                  <td>
                      <div style={{fontWeight:'bold'}}>{mov.material}</div>
                      <small style={{color:'#888'}}>{mov.lote}</small>
                  </td>
                  <td style={{fontWeight:'bold', color: '#10b981'}}>
                    {mov.cantidad} {mov.unidad}
                  </td>
                  <td>
                      <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                        <User size={14}/> {mov.responsable}
                      </div>
                  </td>
                  <td style={{maxWidth:'250px'}}>
                    <div style={{fontSize:'0.9rem'}}>{mov.observacion}</div>
                    {!mov.es_local && <small style={{color:'#aaa'}}>{mov.deposito}</small>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                  <tr><td colSpan="6" style={{textAlign:'center', padding:'20px'}}>No hay movimientos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Movimientos;