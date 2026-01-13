import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { 
    Package, FileText, ClipboardList, CheckCircle, XCircle, Eye 
} from "lucide-react";
import { generarValePDF } from "../utils/pdfGenerator"; 

const HistorialPedidos = ({ defaultView = "solicitudes", onAtenderPedido }) => {
  const [view, setView] = useState(defaultView); 
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("user_rol");
  const canManage = ["Master_Admin", "Administrador"].includes(userRole);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = view === "solicitudes" 
          ? "http://127.0.0.1:5000/api/solicitudes/entrantes" 
          : "http://127.0.0.1:5000/api/vales/pendientes";

      const data = await apiFetch(url);
      setDataList(Array.isArray(data) ? data : []); 
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [view]);

  // --- ACCIONES SOLICITUDES ---
  const handleGenerarOrden = (solicitud) => {
    navigate("/ordenes-trabajo", { 
        state: { 
            crearDesdeSolicitud: true,
            modo: "asignar_personal", 
            solicitud: solicitud 
        } 
    });
  };

  const handleRechazarSolicitud = async (solicitud) => {
    const motivo = window.prompt("Ingrese el motivo del rechazo de la solicitud:");
    if (motivo === null) return; // Cancelado
    if (!motivo.trim()) return alert("Debe especificar un motivo.");

    try {
        // Asumiendo que existe este endpoint en tu backend
        await apiFetch(`http://127.0.0.1:5000/api/solicitudes/${solicitud.id_solicitud}/rechazar`, { 
            method: "PUT", 
            body: JSON.stringify({ motivo: motivo })
        });
        alert("❌ Solicitud rechazada.");
        fetchData(); 
    } catch (e) { 
        alert("Error al rechazar solicitud: " + e.message); 
    }
  };

  // --- ACCIONES VALES ---
  const handleAprobarVale = async (vale) => {
    if(!window.confirm("¿Aprobar salida de material y notificar al chofer?")) return;
    try {
        await apiFetch(`http://127.0.0.1:5000/api/vales/${vale.id}/aprobar_salida`, { method: "PUT" });
        alert("✅ Vale aprobado.");
        fetchData(); 
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleRechazarVale = async (vale) => {
    const motivo = window.prompt("Ingrese el motivo del rechazo del vale:");
    if (motivo === null) return; 
    if (!motivo.trim()) return alert("Debe especificar un motivo.");
    try {
        await apiFetch(`http://127.0.0.1:5000/api/vales/${vale.id}/rechazar`, { 
            method: "PUT", body: JSON.stringify({ motivo: motivo })
        });
        alert("❌ Vale rechazado.");
        fetchData(); 
    } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div className="discord-card historial-card">
      <div className="tabs-header">
        <button onClick={() => setView("solicitudes")} className={`tab-btn ${view === "solicitudes" ? "active-yellow" : ""}`}>
            <Package size={18}/> Solicitudes de Stock
        </button>
        <button onClick={() => setView("vales")} className={`tab-btn ${view === "vales" ? "active-blue" : ""}`}>
            <FileText size={18}/> Vales por Aprobar
        </button>
      </div>

      {loading ? <p className="p-4 text-gray-400">Cargando...</p> : dataList.length === 0 ? (
          <div className="empty-state"><p>No hay items pendientes.</p></div>
      ) : (
        <div className="table-responsive">
            <table className="discord-table historial-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>{view === "solicitudes" ? "Solicitante" : "Destino"}</th>
                        <th>Detalle</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {dataList.map(item => (
                        <tr key={item.id_solicitud || item.id}>
                            <td className="cell-id">#{item.id_solicitud || item.id}</td>
                            <td>{item.fecha}</td>
                            <td>
                                {view === "solicitudes" ? (
                                    <><strong>{item.deposito_solicitante}</strong><span className="cell-subtext">{item.solicitante_usuario}</span></>
                                ) : item.destino}
                            </td>
                            <td>
                                {view === "solicitudes" ? (
                                    <span className="text-sm">
                                        {item.material} <br/>
                                        <strong className="cell-quantity">{item.cantidad} {item.unidad}</strong>
                                        {item.observacion && <div className="cell-obs">"{item.observacion}"</div>}
                                    </span>
                                ) : (
                                    <span>{item.chofer} <br/><small className="text-gray-400">{item.vehiculo}</small></span>
                                )}
                            </td>
                            <td className="actions-cell">
                                <div className="actions-group">
                                    {view === "solicitudes" ? (
                                        <>
                                            {/* EN SOLICITUDES: ATENDER O RECHAZAR */}
                                            {canManage ? (
                                                <>
                                                    <button className="btn-new btn-small" onClick={() => handleGenerarOrden(item)} title="Atender Pedido">
                                                        <ClipboardList size={14} className="mr-1"/> Atender
                                                    </button>
                                                    <button className="btn-status btn-danger btn-icon-only" onClick={() => handleRechazarSolicitud(item)} title="Rechazar Solicitud">
                                                        <XCircle size={16}/>
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="badge-estado badge-solo-lectura">Lectura</span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {/* EN VALES: VER, APROBAR, RECHAZAR */}
                                            <button className="btn-action secondary btn-icon-only" onClick={() => generarValePDF(item, true)} title="Ver Vale">
                                                <Eye size={16}/>
                                            </button>

                                            {canManage && (
                                                <>
                                                    <button className="btn-save btn-icon-only" onClick={() => handleAprobarVale(item)} title="Aprobar">
                                                        <CheckCircle size={16}/>
                                                    </button>
                                                    <button className="btn-status btn-danger btn-icon-only" onClick={() => handleRechazarVale(item)} title="Rechazar">
                                                        <XCircle size={16}/>
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}
    </div>
  );
};

export default HistorialPedidos;