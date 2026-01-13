// src/components/SolicitudModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { X, Save, ShoppingCart, Building2, Search, Plus, Trash2, AlertCircle, Package } from "lucide-react";
import { apiFetch } from "../utils/api";

// IMPORTANTE: Asegúrate de que este archivo CSS exista en tu carpeta styles
import "../styles/SolicitudModal.css"; 

const SolicitudModal = ({ materialInicial, onClose, onConfirm }) => {
  // --- ESTADOS Y LÓGICA ---
  const [selectedProveedorId, setSelectedProveedorId] = useState("");
  const [observacionGlobal, setObservacionGlobal] = useState("");
  const [listaSolicitud, setListaSolicitud] = useState([]); 
  const [error, setError] = useState("");

  const [proveedoresDisponibles, setProveedoresDisponibles] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const [materialSeleccionado, setMaterialSeleccionado] = useState(null);
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [cantidadTemp, setCantidadTemp] = useState("");
  
  // CORRECCIÓN 1: Usar .UNIDAD aquí también para el feedback visual
  const stockTemp = loteSeleccionado ? { cantidad: loteSeleccionado.cantidad, unidad: materialSeleccionado?.UNIDAD || "u." } : null;

  const searchTimeoutRef = useRef(null);

  // --- EFECTO: CARGA INICIAL ---
  useEffect(() => {
    const initData = async () => {
      setLoadingProveedores(true);
      setError("");
      try {
        if (materialInicial) {
          const data = await apiFetch(`/api/solicitudes/stock-disponible/${materialInicial.ID_MATERIAL}`);
          
          if (Array.isArray(data) && data.length > 0) {
            setProveedoresDisponibles(data);
            setMaterialSeleccionado(materialInicial);
          } else {
             setProveedoresDisponibles([]);
             setError(`Nadie tiene stock disponible de ${materialInicial.NOMBRE}.`);
          }
        } else {
          const data = await apiFetch(`/api/depositos`); 
          if (Array.isArray(data)) {
              const depMap = data.map(d => ({
                  id_deposito: d.ID_DEPOSITO,
                  nombre: d.NOMBRE,
                  cantidad: 0, 
                  unidad: '-'
              }));
              setProveedoresDisponibles(depMap);
          }
        }
      } catch (e) {
        console.error(e);
        setError("Error cargando proveedores.");
      } finally {
        setLoadingProveedores(false);
      }
    };

    initData();
  }, [materialInicial]);

  // --- FUNCIONES AUXILIARES ---
  const limpiarFormulario = (borrarMaterial = true) => {
      if (borrarMaterial) {
          setMaterialSeleccionado(null);
          setBusqueda("");
      }
      setLotesDisponibles([]);
      setLoteSeleccionado(null);
      setCantidadTemp("");
      setError("");
  };

  const cargarLotes = async (idMaterial, idDeposito) => {
      setSearching(true);
      setLotesDisponibles([]);
      setLoteSeleccionado(null);
      try {
          const data = await apiFetch(`/api/materiales/${idMaterial}/lotes`);
          if (Array.isArray(data)) {
              const lotesValidos = data.filter(l => 
                  String(l.deposito_id) === String(idDeposito) && l.cantidad > 0
              );
              setLotesDisponibles(lotesValidos);
              
              if (lotesValidos.length === 0) setError("Este proveedor no tiene lotes con stock.");
              else if (lotesValidos.length === 1) setLoteSeleccionado(lotesValidos[0]);
          }
      } catch (e) {
          setError("Error al cargar lotes.");
      } finally {
          setSearching(false);
      }
  };

  // --- HANDLERS ---
  const handleProveedorChange = (e) => {
    const idProv = e.target.value;
    setSelectedProveedorId(idProv);
    setListaSolicitud([]); 
    setError("");
    limpiarFormulario(false);

    if (materialSeleccionado && idProv) {
       cargarLotes(materialSeleccionado.ID_MATERIAL, idProv);
    }
  };

  const handleSearchChange = (e) => {
    const termino = e.target.value;
    setBusqueda(termino);

    if (termino === "") {
        setResultadosBusqueda([]);
        limpiarFormulario(true);
        return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (termino.length > 1) {
        setSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const data = await apiFetch(`/api/materiales?q=${encodeURIComponent(termino)}`);
                setResultadosBusqueda(Array.isArray(data) ? data : []);
            } catch (err) {
                setResultadosBusqueda([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    } else {
        setResultadosBusqueda([]);
    }
  };

  const handleSelectMaterial = (mat) => {
    setBusqueda(mat.NOMBRE);
    setResultadosBusqueda([]);
    setMaterialSeleccionado(mat);
    
    if (selectedProveedorId) {
        cargarLotes(mat.ID_MATERIAL, selectedProveedorId);
    } else {
        setError("Selecciona un proveedor arriba primero.");
    }
  };

  const handleAddItem = () => {
    if (!materialSeleccionado) return setError("Selecciona un material.");
    if (!loteSeleccionado) return setError("Selecciona un lote.");
    if (!cantidadTemp || Number(cantidadTemp) <= 0) return setError("Cantidad inválida.");
    
    if (Number(cantidadTemp) > loteSeleccionado.cantidad) {
        return setError(`Stock insuficiente en lote. Disp: ${loteSeleccionado.cantidad}`);
    }

    const existe = listaSolicitud.some(item => 
        item.id_material === materialSeleccionado.ID_MATERIAL && 
        item.id_lote === loteSeleccionado.lote_id
    );
    if (existe) return setError("Ya agregaste este lote a la lista.");

    const newItem = {
        id_material: materialSeleccionado.ID_MATERIAL,
        nombre: materialSeleccionado.NOMBRE,
        id_lote: loteSeleccionado.lote_id,
        codigo_lote: loteSeleccionado.codigo,
        cantidad: parseFloat(cantidadTemp),
        // CORRECCIÓN 2: Aquí es donde se guardaba mal. Usamos .UNIDAD
        unidad: materialSeleccionado.UNIDAD || "u.", 
        id_inventario: loteSeleccionado.id_inventario 
    };

    setListaSolicitud([...listaSolicitud, newItem]);
    limpiarFormulario(true); 
  };

  const handleRemoveItem = (index) => {
    const newList = [...listaSolicitud];
    newList.splice(index, 1);
    setListaSolicitud(newList);
  };

  const handleSubmit = () => {
    if (!selectedProveedorId) return setError("Falta seleccionar proveedor.");
    if (listaSolicitud.length === 0) return setError("Lista vacía.");
    
    onConfirm({
        id_deposito_proveedor: selectedProveedorId,
        observacion: observacionGlobal,
        items: listaSolicitud
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="discord-card modal-content solicitud-modal-content">
        
        {/* HEADER */}
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
             <ShoppingCart size={22}/> Nueva Solicitud
          </h3>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
            
            {/* 1. SELECCIONAR PROVEEDOR */}
            <div className="input-group-row">
                <label className="input-group-label"><Building2 size={16}/> 1. Proveedor (Origen)</label>
                
                {loadingProveedores ? (
                    <span className="loading-text">Cargando depósitos...</span>
                ) : (
                    <select 
                        className={`discord-select select-proveedor ${selectedProveedorId ? 'active' : ''}`}
                        value={selectedProveedorId} 
                        onChange={handleProveedorChange}
                        disabled={listaSolicitud.length > 0} 
                    >
                        <option value="">-- Seleccionar Depósito --</option>
                        {proveedoresDisponibles.map(p => (
                            <option key={p.id_deposito} value={p.id_deposito}>
                                {p.nombre} {p.cantidad > 0 ? `(Disp Total: ${p.cantidad})` : ''}
                            </option>
                        ))}
                    </select>
                )}
                {listaSolicitud.length > 0 && <small className="warning-text">* Vacía la lista para cambiar de proveedor.</small>}
            </div>

            {/* 2. AGREGAR MATERIALES */}
            <div className={`add-item-section ${!selectedProveedorId ? 'disabled' : ''}`}>
                <label className="section-title">2. Agregar Items</label>
                
                <div className="add-item-controls">
                    
                    {/* A. BUSCADOR MATERIAL */}
                    <div className="search-container">
                        <label className="field-label">Material</label>
                        <div className="search-input-wrapper">
                            <Search size={16} color="#aaa"/>
                            <input 
                                type="text" 
                                className="search-input"
                                placeholder="Buscar..." 
                                value={busqueda} 
                                onChange={handleSearchChange}
                            />
                        </div>
                        
                        {resultadosBusqueda.length > 0 && (
                            <ul className="dropdown-results">
                                {resultadosBusqueda.map(m => (
                                    <li key={m.ID_MATERIAL} onClick={() => handleSelectMaterial(m)} className="dropdown-item">
                                        {m.NOMBRE}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* B. SELECTOR DE LOTE */}
                    <div className="lote-container">
                        <label className="field-label">Lote</label>
                        <div className="lote-select-wrapper">
                            <Package size={16} color="#aaa"/>
                            <select 
                                className="lote-select"
                                value={loteSeleccionado ? loteSeleccionado.lote_id : ""}
                                onChange={(e) => {
                                    const lote = lotesDisponibles.find(l => String(l.lote_id) === e.target.value);
                                    setLoteSeleccionado(lote);
                                }}
                                disabled={!materialSeleccionado || lotesDisponibles.length === 0}
                            >
                                <option value="">- Seleccionar -</option>
                                {lotesDisponibles.map(l => (
                                    <option key={l.lote_id} value={l.lote_id}>
                                        {l.codigo} (Disp: {l.cantidad})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* C. CANTIDAD */}
                    <div className="qty-container">
                        <label className="field-label">Cant.</label>
                        <input 
                            type="number" 
                            className="discord-input qty-input" 
                            placeholder="0" 
                            value={cantidadTemp} 
                            onChange={e => setCantidadTemp(e.target.value)}
                        />
                         {stockTemp && (
                            <span className="max-stock-indicator">
                                Máx: {stockTemp.cantidad}
                            </span>
                        )}
                    </div>

                    {/* D. BOTÓN AGREGAR */}
                    <button 
                        className="btn-save btn-add" 
                        onClick={handleAddItem}
                        disabled={!loteSeleccionado}
                        title="Agregar a la lista"
                    >
                        <Plus size={20}/>
                    </button>
                </div>

                {/* Feedback */}
                <div className="feedback-area">
                    {searching ? <span className="text-searching">Buscando datos...</span> :
                     error ? <span className="text-error"><AlertCircle size={14}/> {error}</span> :
                     loteSeleccionado ? (
                    <span className="text-success">
                        En lote <strong>{loteSeleccionado.codigo}</strong> hay {loteSeleccionado.cantidad} {materialSeleccionado?.UNIDAD || "u."}
                    </span>
                    ) :
                     null
                    }
                </div>
            </div>

            {/* 3. RESUMEN DETALLADO */}
            <div className="resumen-container">
                <h4 className="resumen-title">Resumen ({listaSolicitud.length} items)</h4>
                
                {listaSolicitud.length === 0 ? (
                    <div className="empty-cart-msg">
                        Carrito vacío.
                    </div>
                ) : (
                    <table className="discord-table" style={{width: '100%', fontSize: '0.9rem'}}>
                        <thead>
                            <tr style={{color: '#aaa', borderBottom: '1px solid #333'}}>
                                <th style={{textAlign:'left', padding:'8px'}}>Material / Lote</th>
                                <th style={{textAlign:'right', padding:'8px'}}>Cant.</th>
                                <th style={{width:'30px'}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {listaSolicitud.map((item, idx) => (
                                <tr key={idx} className="table-row">
                                    <td className="col-material">
                                        <div className="material-name">{item.nombre}</div>
                                        <div className="lote-badge">
                                            <Package size={12}/> Lote: {item.codigo_lote}
                                        </div>
                                    </td>
                                    {/* Aquí ya se mostrará bien porque guardamos bien la unidad en el paso anterior */}
                                    <td className="col-qty">
                                        {item.cantidad} {item.unidad}
                                    </td>
                                    <td style={{textAlign:'right'}}>
                                        <button onClick={() => handleRemoveItem(idx)} className="btn-remove">
                                            <Trash2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* OBSERVACIÓN */}
            <div className="input-group-row" style={{marginTop: '20px'}}>
                <label className="input-group-label">Observación General</label>
                <textarea 
                    className="discord-input" 
                    rows={2} 
                    placeholder="Comentarios..." 
                    value={observacionGlobal} 
                    onChange={e => setObservacionGlobal(e.target.value)}
                />
            </div>
        </div>

        {/* FOOTER */}
        <div className="modal-footer">
          <button className="btn-status" onClick={onClose}>Cancelar</button>
          <button 
            className="btn-save" 
            onClick={handleSubmit} 
            disabled={listaSolicitud.length === 0}
            style={{opacity: listaSolicitud.length === 0 ? 0.5 : 1}}
          >
            <Save size={16} style={{marginRight: '5px'}}/> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolicitudModal;