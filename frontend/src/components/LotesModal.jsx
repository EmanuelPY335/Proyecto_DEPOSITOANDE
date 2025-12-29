// frontend/src/components/LotesModal.jsx
import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { 
    X, Plus, ArrowRightLeft, Truck, 
    AlertTriangle, CheckCircle, Search 
} from "lucide-react";
import "../styles/EmployeeModal.css"; 

const LotesModal = ({ material, onClose, depositos }) => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterDeposito, setFilterDeposito] = useState("Todos");

  // Estado Modal Transferencia
  const [transferData, setTransferData] = useState(null);

  // Formulario Recepción
  const [newIngreso, setNewIngreso] = useState({
    cantidad: "",
    fecha_ingreso: new Date().toISOString().split('T')[0],
    id_deposito: depositos.length > 0 ? depositos[0].ID_DEPOSITO : "",
    observaciones: ""
  });

  useEffect(() => {
    loadLotes();
    // eslint-disable-next-line
  }, [material]);

  const loadLotes = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`http://127.0.0.1:5000/api/materiales/${material.ID_MATERIAL}/lotes`);
      setLotes(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLotes = lotes.filter(lote => {
    const texto = searchTerm.toLowerCase();
    const matchTexto = 
        lote.deposito.toLowerCase().includes(texto) ||
        lote.fecha_ingreso.includes(texto) ||
        (lote.observaciones && lote.observaciones.toLowerCase().includes(texto));
    const matchEstado = filterEstado === "Todos" || lote.estado === filterEstado;
    const matchDeposito = filterDeposito === "Todos" || String(lote.deposito_id) === String(filterDeposito);
    return matchTexto && matchEstado && matchDeposito;
  });

  // Acciones (Alta, Estado, Transfer)
  const handleAlta = async (e) => {
    e.preventDefault();
    if (!newIngreso.cantidad || newIngreso.cantidad <= 0) return alert("Cantidad inválida");
    try {
      await apiFetch("http://127.0.0.1:5000/api/lotes/ingreso", {
        method: "POST",
        body: JSON.stringify({ id_material: material.ID_MATERIAL, ...newIngreso })
      });
      alert("Material recepcionado correctamente.");
      loadLotes();
      setNewIngreso({ ...newIngreso, cantidad: "", observaciones: "" });
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleToggleEstado = async (lote) => {
    const nuevoEstado = lote.estado === 'Dañado' ? 'Disponible' : 'Dañado';
    if(!window.confirm(`¿Cambiar estado a ${nuevoEstado}?`)) return;
    try {
        await apiFetch(`http://127.0.0.1:5000/api/inventario/${lote.id_inventario}/estado`, {
            method: "PUT",
            body: JSON.stringify({ estado: nuevoEstado })
        });
        loadLotes(); 
    } catch (e) { alert(e.message); }
  };

  const openTransferModal = (lote) => {
    if (lote.estado === 'Dañado') return alert("No puedes transferir material dañado.");
    setTransferData({
      id_lote: lote.lote_id,
      id_deposito_origen: lote.deposito_id, 
      nombre_origen: lote.deposito,
      cantidad_disponible: lote.cantidad,
      id_deposito_destino: depositos.length > 0 ? depositos[0].ID_DEPOSITO : "",
      cantidad_transferir: "",
      observacion: ""
    });
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferData) return;
    if (Number(transferData.cantidad_transferir) > Number(transferData.cantidad_disponible)) {
        return alert("Error: Cantidad excede disponibilidad.");
    }
    try {
      await apiFetch("http://127.0.0.1:5000/api/transferencia", {
        method: "POST",
        body: JSON.stringify({
            id_lote: transferData.id_lote,
            id_deposito_origen: transferData.id_deposito_origen, 
            id_deposito_destino: transferData.id_deposito_destino,
            cantidad: transferData.cantidad_transferir,
            observacion: transferData.observacion
        })
      });
      alert("Transferencia exitosa.");
      setTransferData(null); 
      loadLotes(); 
    } catch (error) { alert("Error: " + error.message); }
  };

  const renderCategoryBadge = (cat) => {
    const styleMap = { 'Conductores': 'badge-blue', 'Aisladores': 'badge-purple', 'Protección': 'badge-orange', 'Ferretería': 'badge-gray', 'General': 'badge-default' };
    return <span className={`category-badge ${styleMap[cat] || 'badge-default'}`} style={{fontSize: '0.8rem', padding: '4px 10px'}}>{cat}</span>;
  };

  return (
    <div className="modal-backdrop" style={{zIndex: 1000}}>
      <div className="discord-card modal-content" style={{ maxWidth: '950px', position:'relative' }}>
        
        {/* HEADER */}
        <div className="modal-header" style={{borderBottom: '1px solid #3f3f46', paddingBottom: '15px'}}>
          <div className="header-info">
             <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}>
                <h2 style={{margin:0}}>{material.NOMBRE}</h2>
                {renderCategoryBadge(material.CATEGORIA || material.categoria)}
             </div>
             <span style={{color:'#9ca3af'}}>Código: <strong style={{color:'#e5e7eb'}}>#{material.CODIGO_UNICO}</strong></span>
          </div>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="modal-body">
            
            {/* ALTA DE MATERIAL */}
            <div style={{ background: '#2b2d31', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #1e1f22' }}>
                <h4 style={{marginBottom: '15px', color: '#e5e7eb', display:'flex', alignItems:'center', gap:'8px'}}>
                    <Plus size={18} className="text-green"/> Recepción de Material
                </h4>
                <form onSubmit={handleAlta} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                    <div className="input-group">
                        <label style={{color:'#9ca3af', fontSize:'0.8rem'}}>Depósito</label>
                        <select value={newIngreso.id_deposito} onChange={e => setNewIngreso({...newIngreso, id_deposito: e.target.value})} className="discord-select" style={{padding:'8px'}}>
                            {depositos.map(d => <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label style={{color:'#9ca3af', fontSize:'0.8rem'}}>Fecha</label>
                        <input type="date" required value={newIngreso.fecha_ingreso} onChange={e => setNewIngreso({...newIngreso, fecha_ingreso: e.target.value})} className="discord-input" />
                    </div>
                    <div className="input-group">
                        <label style={{color:'#9ca3af', fontSize:'0.8rem'}}>Cantidad</label>
                        <input type="number" required value={newIngreso.cantidad} onChange={e => setNewIngreso({...newIngreso, cantidad: e.target.value})} placeholder="0.00" className="discord-input"/>
                    </div>
                    <div className="input-group">
                        <label style={{color:'#9ca3af', fontSize:'0.8rem'}}>Observación</label>
                        <input type="text" value={newIngreso.observaciones} onChange={e => setNewIngreso({...newIngreso, observaciones: e.target.value})} placeholder="..." className="discord-input"/>
                    </div>
                    <button type="submit" className="btn-save" style={{height: '40px'}}>Recepcionar</button>
                </form>
            </div>

            <h3>Distribución en Depósitos</h3>
            
            {/* --- BARRA DE HERRAMIENTAS MODIFICADA --- */}
            <div className="toolbar-container">
                {/* BUSCADOR COMPACTO */}
                <div className="search-wrapper-pro">
                    <Search size={18} className="search-icon-pro"/>
                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                        className="input-pro"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div style={{flex: 1}}>
                    {/* Espaciador flexible para empujar filtros a la derecha si quieres, o dejar que se ajusten */}
                </div>

                <div style={{width: '200px'}}>
                    <select className="select-pro" value={filterDeposito} onChange={(e) => setFilterDeposito(e.target.value)}>
                        <option value="Todos">🏭 Todos los Depósitos</option>
                        {depositos.map(d => <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>)}
                    </select>
                </div>

                <div style={{width: '180px'}}>
                    <select className="select-pro" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                        <option value="Todos">📋 Todos los Estados</option>
                        <option value="Disponible">✅ Disponible</option>
                        <option value="Dañado">⚠️ Dañado</option>
                    </select>
                </div>
            </div>

            {loading ? <p>Cargando stock...</p> : (
                /* --- APLICAMOS LA CLASE DE SCROLL AQUÍ --- */
                <div className="table-scroll-container">
                    <table className="styled-table" style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead style={{position: 'sticky', top: 0, zIndex: 5, backgroundColor: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                            <tr>
                                <th>Fecha</th>
                                <th>Depósito</th>
                                <th>Cantidad</th>
                                <th>Estado</th>
                                <th>Observación</th> {/* <--- CORREGIDO */}
                                <th style={{textAlign:'right'}}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLotes.length === 0 ? (
                                <tr><td colSpan="6" style={{textAlign:'center', padding:'20px'}}>No se encontraron resultados.</td></tr>
                            ) : (
                                filteredLotes.map((lote, idx) => (
                                    <tr key={idx} style={{backgroundColor: lote.estado === 'Dañado' ? 'rgba(239, 68, 68, 0.05)' : 'transparent', borderBottom: '1px solid #f1f5f9'}}>
                                        <td>{lote.fecha_ingreso}</td>
                                        <td style={{fontWeight:'bold'}}>{lote.deposito}</td>
                                        <td style={{fontWeight: 'bold', color: lote.estado === 'Dañado' ? '#ef4444' : '#16a34a'}}>
                                            {lote.cantidad} {material.UNIDAD || material.UNIDAD_MEDIDA}
                                        </td>
                                        <td>
                                            <span style={{
                                                backgroundColor: lote.estado === 'Dañado' ? '#fee2e2' : '#dcfce7',
                                                color: lote.estado === 'Dañado' ? '#ef4444' : '#166534',
                                                padding: '4px 10px', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem',
                                                border: lote.estado === 'Dañado' ? '1px solid #fca5a5' : '1px solid #bbf7d0'
                                            }}>
                                                {lote.estado}
                                            </span>
                                        </td>
                                        <td style={{color: '#64748b', fontSize: '0.85rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                            {lote.observaciones || "-"}
                                        </td>
                                        <td style={{textAlign:'right', display:'flex', justifyContent:'flex-end', gap:'8px', paddingRight: '10px'}}>
                                            {/* Botón Estado */}
                                            <button 
                                                className="btn-icon" 
                                                style={{
                                                    backgroundColor: lote.estado === 'Dañado' ? '#22c55e' : '#ef4444', 
                                                    color: 'white', padding: '6px', borderRadius: '6px'
                                                }}
                                                title={lote.estado === 'Dañado' ? "Marcar Disponible" : "Reportar Daño"}
                                                onClick={() => handleToggleEstado(lote)}
                                            >
                                                {lote.estado === 'Dañado' ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                                            </button>

                                            {/* Botón Transferir */}
                                            <button 
                                                className="btn-transfer-pro" 
                                                onClick={() => openTransferModal(lote)}
                                                title="Transferir a otro depósito"
                                                disabled={lote.estado === 'Dañado'}
                                            >
                                                <ArrowRightLeft size={16}/> Transferir
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* --- MODAL FLOTANTE DE TRANSFERENCIA --- */}
        {transferData && (
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px', zIndex: 20
            }}>
                <div style={{background: '#1e1f22', padding: '25px', borderRadius: '8px', width: '400px', border: '1px solid #4b5563', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'}}>
                    <h3 style={{marginBottom: '15px', display:'flex', alignItems:'center', gap:'10px', color: '#60a5fa'}}>
                        <Truck size={20}/> Transferir Material
                    </h3>
                    <div style={{background:'#2b2d31', padding:'10px', borderRadius:'5px', marginBottom:'15px', fontSize:'0.9rem'}}>
                        <p style={{margin:'0 0 5px 0'}}><strong>Origen:</strong> {transferData.nombre_origen}</p>
                        <p style={{margin:0}}><strong>Disponible:</strong> {transferData.cantidad_disponible}</p>
                    </div>
                    <form onSubmit={handleTransfer}>
                        <div className="input-group" style={{marginBottom: '15px'}}>
                            <label style={{color:'#e5e7eb'}}>Depósito Destino</label>
                            <select className="discord-select" value={transferData.id_deposito_destino} onChange={e => setTransferData({...transferData, id_deposito_destino: e.target.value})}>
                                {depositos.filter(d => String(d.ID_DEPOSITO) !== String(transferData.id_deposito_origen)).map(d => (
                                    <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>
                                ))}
                            </select>
                        </div>
                        <div className="input-group" style={{marginBottom: '15px'}}>
                            <label style={{color:'#e5e7eb'}}>Cantidad</label>
                            <input type="number" className="discord-input" required max={transferData.cantidad_disponible} value={transferData.cantidad_transferir} onChange={e => setTransferData({...transferData, cantidad_transferir: e.target.value})}/>
                        </div>
                        <div className="input-group" style={{marginBottom: '20px'}}>
                            <label style={{color:'#e5e7eb'}}>Motivo</label>
                            <input type="text" className="discord-input" placeholder="Ej: Pedido #44" value={transferData.observacion} onChange={e => setTransferData({...transferData, observacion: e.target.value})}/>
                        </div>
                        <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}>
                            <button type="button" className="btn-status" onClick={() => setTransferData(null)}>Cancelar</button>
                            <button type="submit" className="btn-save" style={{backgroundColor: '#3b82f6'}}>Confirmar</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default LotesModal;