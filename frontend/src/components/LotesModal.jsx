// src/components/LotesModal.jsx
import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { 
    X, Plus, AlertTriangle, CheckCircle, Search, Barcode
} from "lucide-react";
import "../styles/LotesModal.css"; 

const LotesModal = ({ material, onClose, depositos }) => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterDeposito, setFilterDeposito] = useState("Todos");

  // --- GENERADOR DE CÓDIGO ÚNICO ---
  const generarCodigo = () => {
    const fecha = new Date().toISOString().slice(2,10).replace(/-/g,""); 
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `L-${fecha}-${random}`;
  };

  const [newIngreso, setNewIngreso] = useState({
    codigo: generarCodigo(),
    cantidad: "",
    fecha_ingreso: new Date().toISOString().split('T')[0],
    id_deposito: depositos.length > 0 ? depositos[0].ID_DEPOSITO : "",
    observaciones: ""
  });

  useEffect(() => { loadLotes(); }, [material]);

  const loadLotes = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`http://127.0.0.1:5000/api/materiales/${material.ID_MATERIAL}/lotes`);
      setLotes(data || []);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const filteredLotes = lotes.filter(lote => {
    const texto = searchTerm.toLowerCase();
    const matchTexto = 
        lote.deposito.toLowerCase().includes(texto) ||
        (lote.codigo && lote.codigo.toLowerCase().includes(texto)) || 
        (lote.observaciones && lote.observaciones.toLowerCase().includes(texto));
    const matchEstado = filterEstado === "Todos" || lote.estado === filterEstado;
    const matchDeposito = filterDeposito === "Todos" || String(lote.deposito_id) === String(filterDeposito);
    return matchTexto && matchEstado && matchDeposito;
  });

  const handleAlta = async (e) => {
    e.preventDefault();
    if (!newIngreso.cantidad || newIngreso.cantidad <= 0) return alert("Cantidad inválida");
    try {
      await apiFetch("http://127.0.0.1:5000/api/lotes/ingreso", {
        method: "POST",
        body: JSON.stringify({ id_material: material.ID_MATERIAL, ...newIngreso })
      });
      alert(`Lote registrado: ${newIngreso.codigo}`);
      loadLotes();
      setNewIngreso({ 
          ...newIngreso, 
          codigo: generarCodigo(), 
          cantidad: "", 
          observaciones: "" 
      });
    } catch (error) { alert("Error: " + error.message); }
  };

  const handleToggleEstado = async (lote) => {
    const nuevoEstado = lote.estado === 'Dañado' ? 'Disponible' : 'Dañado';
    if(!window.confirm(`¿Cambiar a ${nuevoEstado}?`)) return;
    try {
        await apiFetch(`http://127.0.0.1:5000/api/inventario/${lote.id_inventario}/estado`, {
            method: "PUT", body: JSON.stringify({ estado: nuevoEstado })
        });
        loadLotes(); 
    } catch (e) { alert(e.message); }
  };

  const renderBadge = (cat) => {
    const map = { 'Conductores': 'badge-blue', 'Aisladores': 'badge-purple', 'Protección': 'badge-orange', 'Ferretería': 'badge-gray' };
    return <span className={`category-badge ${map[cat] || 'badge-default'}`} style={{fontSize: '0.8rem', padding: '4px 10px'}}>{cat}</span>;
  };

  return (
    <div className="modal-backdrop" style={{zIndex: 1000}}>
      <div className="discord-card modal-content" style={{ maxWidth: '950px' }}>
        
        {/* HEADER */}
        <div className="modal-header" style={{borderBottom: '1px solid #3f3f46', paddingBottom: '15px'}}>
          <div className="header-info">
             <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}>
                <h2 style={{margin:0}}>{material.NOMBRE}</h2>
                {renderBadge(material.CATEGORIA || material.categoria)}
             </div>
             <span style={{color:'#9ca3af'}}>Código Material: <strong style={{color:'#e5e7eb'}}>#{material.CODIGO_UNICO}</strong></span>
          </div>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="modal-body">
            
            {/* FORMULARIO DE INGRESO (Recepción de Mercadería) */}
            <div style={{ background: '#2b2d31', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #1e1f22' }}>
                <h4 style={{marginBottom: '15px', color: '#e5e7eb', display:'flex', alignItems:'center', gap:'8px'}}>
                    <Plus size={18} className="text-green"/> Recepción Manual (Ingreso)
                </h4>
                <form onSubmit={handleAlta} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr 0.8fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                    
                    <div className="input-group">
                        <label style={{color:'#fbbf24', fontSize:'0.8rem', fontWeight:'bold'}}><Barcode size={12}/> Cód. Lote</label>
                        <input type="text" value={newIngreso.codigo} onChange={e => setNewIngreso({...newIngreso, codigo: e.target.value})} 
                            className="discord-input" style={{fontFamily: 'monospace', color: '#fbbf24', textAlign: 'center', fontWeight:'bold'}} />
                    </div>

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
                        <div style={{position: 'relative'}}>
                            <input 
                                type="number" 
                                required 
                                value={newIngreso.cantidad} 
                                onChange={e => setNewIngreso({...newIngreso, cantidad: e.target.value})} 
                                placeholder="0.00" 
                                className="discord-input"
                                style={{paddingRight: '60px'}} // Espacio para el texto de unidad
                            />
                            <span style={{
                                position: 'absolute', 
                                right: '10px', 
                                top: '50%', 
                                transform: 'translateY(-50%)', 
                                color: '#9ca3af', 
                                fontSize: '0.8rem',
                                pointerEvents: 'none'
                            }}>
                                {material.UNIDAD || material.UNIDAD_MEDIDA}
                            </span>
                        </div>
                    </div>
                    <div className="input-group">
                        <label style={{color:'#9ca3af', fontSize:'0.8rem'}}>Observación</label>
                        <input type="text" value={newIngreso.observaciones} onChange={e => setNewIngreso({...newIngreso, observaciones: e.target.value})} className="discord-input"/>
                    </div>
                    <button type="submit" className="btn-save" style={{height: '40px'}}>Recepcionar</button>
                </form>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="toolbar-container">
                <div className="search-wrapper-pro">
                    <Search size={18} className="search-icon-pro"/>
                    <input type="text" placeholder="Buscar código..." className="input-pro" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                </div>
                <div style={{flex: 1}}></div>
                <select className="select-pro" value={filterDeposito} onChange={(e) => setFilterDeposito(e.target.value)} style={{width: '200px'}}>
                    <option value="Todos">🏭 Todos los Depósitos</option>
                    {depositos.map(d => <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>)}
                </select>
            </div>

            {/* TABLA DE LOTES */}
            {loading ? <p>Cargando...</p> : (
                <div className="table-scroll-container">
                    <table className="styled-table" style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead style={{position: 'sticky', top: 0, zIndex: 5, backgroundColor: '#f8fafc'}}>
                            <tr>
                                <th>Código Lote</th>
                                <th>Fecha</th>
                                <th>Depósito</th>
                                <th>Cantidad</th>
                                <th>Estado</th>
                                <th>Observación</th>
                                <th style={{textAlign:'right'}}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLotes.length === 0 ? (
                                <tr><td colSpan="7" style={{textAlign:'center', padding:'20px'}}>No hay datos.</td></tr>
                            ) : (
                                filteredLotes.map((lote, idx) => (
                                    <tr key={idx} style={{backgroundColor: lote.estado === 'Dañado' ? 'rgba(239, 68, 68, 0.05)' : 'transparent', borderBottom: '1px solid #f1f5f9'}}>
                                        <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: '#6366f1'}}>
                                            {lote.codigo || "S/C"}
                                        </td>
                                        <td>{lote.fecha_ingreso}</td>
                                        <td style={{fontWeight:'bold'}}>{lote.deposito}</td>
                                        <td style={{fontWeight: 'bold', color: lote.estado === 'Dañado' ? '#ef4444' : '#16a34a'}}>
                                            {lote.cantidad} {material.UNIDAD || material.UNIDAD_MEDIDA}
                                        </td>
                                        <td>
                                            <span style={{
                                                backgroundColor: lote.estado === 'Dañado' ? '#fee2e2' : '#dcfce7',
                                                color: lote.estado === 'Dañado' ? '#ef4444' : '#166534',
                                                padding: '4px 10px', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem'
                                            }}>{lote.estado}</span>
                                        </td>
                                        <td style={{fontSize: '0.85rem', maxWidth: '150px'}}>{lote.observaciones}</td>
                                        <td style={{textAlign:'right'}}>
                                            <button className="btn-icon" style={{backgroundColor: lote.estado === 'Dañado' ? '#22c55e' : '#ef4444', color: 'white', marginLeft: 'auto'}}
                                                onClick={() => handleToggleEstado(lote)}
                                                title={lote.estado === 'Dañado' ? 'Marcar como Disponible' : 'Marcar como Dañado'}
                                            >
                                                {lote.estado === 'Dañado' ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
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
      </div>
    </div>
  );
};

export default LotesModal;