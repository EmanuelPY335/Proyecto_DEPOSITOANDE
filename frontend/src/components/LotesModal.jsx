// src/components/LotesModal.jsx
import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { 
    X, Plus, AlertTriangle, CheckCircle, Search, Barcode, Calendar, Box, FileText
} from "lucide-react";
import "../styles/LotesModal.css"; 

const LotesModal = ({ material, onClose, depositos }) => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [obsOpen, setObsOpen] = useState(false);
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
    const map = { 'Conductores': '#3b82f6', 'Aisladores': '#8b5cf6', 'Protección': '#f97316', 'Ferretería': '#64748b' };
    const color = map[cat] || '#64748b';
    return (
        <span style={{
            backgroundColor: `${color}20`, 
            color: color,
            border: `1px solid ${color}40`,
            fontSize: '0.75rem', 
            padding: '4px 10px', 
            borderRadius: '12px',
            fontWeight: 700
        }}>
            {cat}
        </span>
    );
  };

  return (
    <div className="lotes-modal-overlay" onClick={onClose}>
      <div className="lotes-modal-content" onClick={e => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className="lotes-modal-header">
          <div className="lotes-header-info">
             <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'4px'}}>
                <h2 className="lotes-header-title">{material.NOMBRE}</h2>
                {renderBadge(material.CATEGORIA || material.categoria)}
             </div>
             <div style={{fontSize: '0.9rem', opacity: 0.8}}>
                Código Material: <strong style={{color:'#fff', fontFamily:'monospace'}}>#{material.CODIGO_UNICO}</strong>
             </div>
          </div>
          <button className="lotes-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="lotes-modal-body">
            
            {/* SECCIÓN DE INGRESO (FORMULARIO) */}
            <div className="ingreso-section">
                <h4 className="ingreso-title">
                    <Plus size={20} color="#4ade80"/> Recepción Manual (Ingreso)
                </h4>
                

            {/* FORMULARIO COMPACTO */}
            <form onSubmit={handleAlta} className="ingreso-form">
                {/* CÓDIGO */}
                <div className="lotes-input-group">
                <label className="lotes-label" style={{color:'#fbbf24'}}><Barcode size={14}/> Cód. Lote</label>
                <input 
                    type="text" 
                    value={newIngreso.codigo} 
                    onChange={e => setNewIngreso({...newIngreso, codigo: e.target.value})} 
                    className="input-dark codigo-input" 
                    style={{fontFamily: 'monospace', color: '#fbbf24', textAlign: 'center', fontWeight:'bold', letterSpacing:'1px'}} 
                />
                </div>

                {/* DEPÓSITO */}
                <div className="lotes-input-group">
                <label className="lotes-label" style={{color:'#9ca3af'}}><Box size={14}/> Depósito</label>
                <select 
                    value={newIngreso.id_deposito} 
                    onChange={e => setNewIngreso({...newIngreso, id_deposito: e.target.value})} 
                    className="input-dark"
                >
                    {depositos.map(d => <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>)}
                </select>
                </div>

                {/* FECHA */}
                <div className="lotes-input-group">
                <label className="lotes-label" style={{color:'#9ca3af'}}><Calendar size={14}/> Fecha</label>
                <input 
                    type="date" 
                    required 
                    value={newIngreso.fecha_ingreso} 
                    onChange={e => setNewIngreso({...newIngreso, fecha_ingreso: e.target.value})} 
                    className="input-dark" 
                />
                </div>

                {/* CANTIDAD */}
                <div className="lotes-input-group">
                <label className="lotes-label" style={{color:'#9ca3af'}}>Cantidad</label>
                <div style={{position: 'relative'}}>
                    <input 
                    type="number" 
                    required 
                    value={newIngreso.cantidad} 
                    onChange={e => setNewIngreso({...newIngreso, cantidad: e.target.value})} 
                    placeholder="0.00" 
                    className="cantidad-input"
                    style={{paddingRight: '60px'}} 
                    />
                    <span className="qty-unit-modal">
                    {material.UNIDAD || material.UNIDAD_MEDIDA}
                    </span>
                </div>
                </div>


            </form>

            {/* OBSERVACIÓN AISLADA */}
            <div className="obs-standalone-wrapper">
                <label className="lotes-label" style={{color:'#9ca3af'}}>
                <FileText size={14}/> Observación
                </label>
                <div className={`obs-input-container ${obsOpen ? 'open' : ''}`}>
                <textarea
                    value={newIngreso.observaciones}
                    onChange={e => setNewIngreso({...newIngreso, observaciones: e.target.value})}
                    className="input-dark obs-input"
                    placeholder="Haz clic para escribir tu observación..."
                    onFocus={() => setObsOpen(true)}
                    onBlur={() => setObsOpen(false)}
                    
                />
                    {/* BOTÓN */}
                        <div className="lotes-input-group" style={{gridColumn: '1 / -1'}}>
                             <button type="submit" className="btn-ingreso">Recepcionar</button>
                         </div>
                

            </div>
        </div>

            </div>

            {/* BARRA DE FILTROS */}
            <div className="lotes-toolbar">
                <div style={{position: 'relative', width: '300px'}}>
                    <Search size={16} style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8'}}/>
                    <input 
                        type="text" 
                        placeholder="Buscar por código, obs..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-pro"
                        style={{paddingLeft: '36px', width: '100%', height:'40px', border: '1px solid #e2e8f0', borderRadius: '8px'}}
                    />
                </div>
                <div style={{flex: 1}}></div>
                <select 
                    value={filterDeposito} 
                    onChange={(e) => setFilterDeposito(e.target.value)} 
                    style={{padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', height:'40px'}}
                >
                    <option value="Todos">🏭 Todos los Depósitos</option>
                    {depositos.map(d => <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>)}
                </select>
            </div>

            {/* TABLA DE LOTES */}
            <div className="lotes-table-container">
                <div style={{maxHeight: '350px', overflowY: 'auto'}}>
                    <table className="lotes-table">
                        <thead style={{position: 'sticky', top: 0, zIndex: 10}}>
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
                            {loading ? (
                                <tr><td colSpan="7" style={{textAlign:'center', padding:'30px'}}>Cargando lotes...</td></tr>
                            ) : filteredLotes.length === 0 ? (
                                <tr><td colSpan="7" style={{textAlign:'center', padding:'30px', color: '#94a3b8'}}>No hay lotes registrados para este filtro.</td></tr>
                            ) : (
                                filteredLotes.map((lote, idx) => (
                                    <tr key={idx} style={{backgroundColor: lote.estado === 'Dañado' ? '#fef2f2' : 'transparent'}}>
                                        <td style={{fontFamily: 'monospace', fontWeight: '700', color: '#6366f1'}}>
                                            {lote.codigo || "S/C"}
                                        </td>
                                        <td>{lote.fecha_ingreso}</td>
                                        <td style={{fontWeight:'600'}}>{lote.deposito}</td>
                                        <td style={{fontWeight: '700', color: lote.estado === 'Dañado' ? '#ef4444' : '#10b981'}}>
                                            {lote.cantidad} {material.UNIDAD || material.UNIDAD_MEDIDA}
                                        </td>
                                        <td>
                                            <span style={{
                                                backgroundColor: lote.estado === 'Dañado' ? '#fee2e2' : '#dcfce7',
                                                color: lote.estado === 'Dañado' ? '#991b1b' : '#166534',
                                                padding: '4px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem'
                                            }}>{lote.estado}</span>
                                        </td>
                                        <td style={{fontSize: '0.85rem', color: '#64748b', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                            {lote.observaciones || "-"}
                                        </td>
                                        <td style={{textAlign:'right'}}>
                                            <button style={{
                                                backgroundColor: lote.estado === 'Dañado' ? '#22c55e' : '#ef4444', 
                                                color: 'white', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'inline-flex'
                                            }}
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
            </div>

        </div>
      </div>
    </div>
  );
};

export default LotesModal;