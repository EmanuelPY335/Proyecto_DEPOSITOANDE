import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Inbox, CheckCircle, XCircle, Clock } from "lucide-react";
import "../styles/Materiales.css"; // Reusamos estilos para consistencia

const PedidosEntrantes = () => {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar datos al entrar
  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    try {
      // Llamamos a la nueva ruta que creamos en backend
      const data = await apiFetch("http://127.0.0.1:5000/solicitudes/entrantes");
      setPedidos(data);
    } catch (error) {
      console.error(error);
      alert("Error cargando pedidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout fade-in">
      <div className="content-dashboard">
        <div className="page-header">
          <div>
            <h1><Inbox size={28} style={{display:'inline', marginBottom:-4, marginRight:10}}/> Bandeja de Entrada</h1>
            <p className="subtitle">Gestiona las solicitudes de material recibidas de otros depósitos.</p>
          </div>
        </div>

        <div className="table-container">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Depósito Solicitante</th>
                <th>Material</th>
                <th>Cantidad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center p-5">Cargando...</td></tr>
              ) : pedidos.length === 0 ? (
                <tr><td colSpan="6" className="empty-state-row">No has recibido solicitudes nuevas.</td></tr>
              ) : (
                pedidos.map((p) => (
                  <tr key={p.id_solicitud}>
                    <td className="text-muted">{p.fecha}</td>
                    <td className="font-bold text-dark">{p.origen}</td>
                    <td>{p.material}</td>
                    <td className="font-mono" style={{fontSize: '1rem'}}>{p.cantidad}</td>
                    <td>
                      <span className={`category-badge ${p.estado === 'Pendiente' ? 'badge-orange' : 'badge-gray'}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td>
                      {p.estado === 'Pendiente' && (
                        <div style={{display:'flex', gap:5}}>
                            <button className="btn-icon" title="Aprobar / Asignar Camión" style={{color:'#16a34a', background:'#dcfce7'}}>
                                <CheckCircle size={18}/>
                            </button>
                            <button className="btn-icon danger" title="Rechazar">
                                <XCircle size={18}/>
                            </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PedidosEntrantes;