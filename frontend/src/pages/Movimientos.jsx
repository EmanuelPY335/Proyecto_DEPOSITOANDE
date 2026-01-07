// src/pages/Movimientos.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { 
  ArrowRightLeft, Truck, MapPin, Package, 
  User, Plus, Trash2, Calendar, Map as MapIcon, Lock 
} from "lucide-react";
import "../styles/Movimientos.css";

const Movimientos = () => {
  // Datos Usuario
  const userRole = sessionStorage.getItem("user_rol");
  const userDepositoId = sessionStorage.getItem("user_deposito_id"); // Asegúrate de que esto exista en el Login

  // Estados
  const [movimientos, setMovimientos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [depositos, setDepositos] = useState([]);
  const [materiales, setMateriales] = useState([]); 
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [choferes, setChoferes] = useState([]); 

  const [formData, setFormData] = useState({
    id_origen: "",
    id_destino: "",
    id_chofer: "",
    id_vehiculo: "",
    observacion: "",
    items: [] 
  });
  const [itemTemp, setItemTemp] = useState({ id_material: "", id_lote: "", cantidad: "" });

  // --- CARGA DE DATOS ---
  useEffect(() => {
    loadMovimientos();
    loadDepositos();
    loadMateriales();
    loadChoferes();
  }, []);

  // --- LÓGICA DE PRE-LLENADO Y DEPURACIÓN ---
  useEffect(() => {
    if (showWizard) {
      // Solo forzamos si NO es Master_Admin y tenemos un ID de depósito
      if (userRole !== "Master_Admin" && userDepositoId) {
        console.log("Fijando depósito origen:", userDepositoId);
        setFormData(prev => ({ 
            ...prev, 
            id_origen: userDepositoId 
        }));
      }
    }
  }, [showWizard, userRole, userDepositoId, depositos]); // Agregamos depositos a la dependencia

  const loadMovimientos = async () => {
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/movimientos");
      setMovimientos(data || []);
    } catch (e) { console.error(e); }
  };

  const loadDepositos = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/depositos"); setDepositos(data); } catch(e){}
  };
  const loadMateriales = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/materiales"); setMateriales(data); } catch(e){}
  };
  const loadChoferes = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/personal/choferes"); setChoferes(data || []); } catch(e){}
  };

  const filtered = movimientos.filter(m => {
    if (filtro === "locales") return m.es_local;
    if (filtro === "traslados") return !m.es_local;
    return true;
  });

  // --- LÓGICA WIZARD ---
  const handleMaterialChange = async (idMaterial) => {
    setItemTemp({...itemTemp, id_material: idMaterial, id_lote: ""});
    if(!idMaterial) { setLotesDisponibles([]); return; }
    try {
        const data = await apiFetch(`http://127.0.0.1:5000/api/materiales/${idMaterial}/lotes`);
        const filtrados = data.filter(l => 
            String(l.deposito_id) === String(formData.id_origen) && 
            l.cantidad > 0 && 
            l.estado === "Disponible"
        );
        setLotesDisponibles(filtrados);
    } catch(e) { console.error(e); }
  };

  const addItem = () => {
    if(!itemTemp.id_lote || !itemTemp.cantidad) return alert("Completa los datos del item");
    const loteInfo = lotesDisponibles.find(l => String(l.lote_id) === String(itemTemp.id_lote));
    if(Number(itemTemp.cantidad) > loteInfo.cantidad) return alert("Cantidad excede stock disponible");

    const newItem = {
        id_lote: itemTemp.id_lote,
        codigo: loteInfo.codigo,
        nombre: materiales.find(m => String(m.ID_MATERIAL) === String(itemTemp.id_material))?.NOMBRE,
        cantidad: itemTemp.cantidad
    };
    setFormData({...formData, items: [...formData.items, newItem]});
    setItemTemp({ id_material: "", id_lote: "", cantidad: "" });
    setLotesDisponibles([]);
  };

  const removeItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({...formData, items: newItems});
  };

  const handleSubmit = async () => {
    if(formData.items.length === 0) return alert("Agrega al menos un material");
    if(formData.id_origen === formData.id_destino) return alert("El origen y destino no pueden ser iguales");
    
    try {
        await apiFetch("http://127.0.0.1:5000/api/vales", {
            method: "POST", body: JSON.stringify(formData)
        });
        alert("Vale creado correctamente");
        setShowWizard(false);
        setStep(1);
        setFormData({ id_origen: "", id_destino: "", id_chofer: "", id_vehiculo: "", items: [] });
        loadMovimientos();
    } catch(e) { alert("Error: " + e.message); }
  };

  // --- HELPER MEJORADO PARA EL NOMBRE ---
  const getNombreDeposito = (id) => {
    if (!id) return "Sin Asignar";
    if (depositos.length === 0) return "Cargando lista...";
    
    // Comparamos como String para evitar errores de tipo (1 vs "1")
    const dep = depositos.find(d => String(d.ID_DEPOSITO) === String(id));
    return dep ? dep.NOMBRE : `Desconocido (ID: ${id})`;
  };

  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        
<div className="page-header">
            <div>
                <h1>Movimientos y Logística</h1>
                <p className="subtitle">Historial de operaciones y traslados.</p>
                {/* --- DEBUG TEMPORAL (Borrar luego) --- */}

            </div>
            
            {/* CONDICIÓN ESTRICTA:
                Solo mostramos el botón si el rol es EXACTAMENTE 'Master_Admin' o 'Personal_Inventario'.
                El rol 'Admin' NO está en esta lista, así que no debería verlo.
            */}
            {(userRole === "Master_Admin" || userRole === "Personal_Inventario") && (
                <button className="btn-new" onClick={() => setShowWizard(true)}>
                    <Plus size={18}/> Nuevo Traslado
                </button>
            )}
            
        </div>

        <div className="filters-bar" style={{marginBottom: '20px', display:'flex', gap:'10px'}}>
             <button className={`btn-status ${filtro==='todos'?'btn-primary':''}`} onClick={()=>setFiltro('todos')}>Todos</button>
             <button className={`btn-status ${filtro==='locales'?'btn-primary':''}`} onClick={()=>setFiltro('locales')}>Internos</button>
             <button className={`btn-status ${filtro==='traslados'?'btn-primary':''}`} onClick={()=>setFiltro('traslados')}>Traslados</button>
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
                      <small style={{color:'#888', fontFamily:'monospace'}}>{mov.lote}</small>
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

        {showWizard && (
          <div className="modal-backdrop">
            <div className="discord-card modal-wizard" style={{width: '700px'}}>
                <div className="wizard-header">
                    <h2>Generar Vale de Traslado</h2>
                    <div className="wizard-steps">
                        <span className={`step ${step>=1 ? 'active':''}`}>1. Ruta</span>
                        <div className="line"></div>
                        <span className={`step ${step>=2 ? 'active':''}`}>2. Transporte</span>
                        <div className="line"></div>
                        <span className={`step ${step>=3 ? 'active':''}`}>3. Carga</span>
                    </div>
                </div>

                <div className="wizard-body" style={{padding:'20px 0'}}>
                    {/* PASO 1: RUTA */}
                    {step === 1 && (
                        <div className="fade-in">
                            <h3 style={{display:'flex', gap:'10px', alignItems:'center'}}><MapIcon size={20}/> Definir Ruta</h3>
                            <div className="row-2" style={{display:'flex', gap:'20px', marginTop:'15px'}}>
                                
                                {/* DEPÓSITO ORIGEN */}
                                <div className="input-group" style={{flex:1}}>
                                    <label>Depósito Origen (Salida)</label>
                                    
                                    {userRole === "Master_Admin" ? (
                                        <select 
                                            className="discord-select" 
                                            value={formData.id_origen} 
                                            onChange={e=>setFormData({...formData, id_origen: e.target.value, id_destino: ""})} 
                                            // Al cambiar origen, reseteamos destino para evitar conflicto
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {depositos.map(d=><option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>)}
                                        </select>
                                    ) : (
                                        // MODO EMPLEADO: Solo Lectura
                                        <div className="discord-input" style={{
                                            display: 'flex', alignItems: 'center', gap: '10px', 
                                            backgroundColor: '#1e1f22', color: '#9ca3af', 
                                            cursor: 'default', border: '1px solid #3f3f46'
                                        }}>
                                            <Lock size={16} color="#ef4444" />
                                            <span style={{fontWeight:'500', color: '#e5e7eb'}}>
                                                {getNombreDeposito(formData.id_origen)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                <div style={{display:'flex', alignItems:'center', paddingTop:'25px'}}><ArrowRightLeft size={24} color="#666"/></div>
                                
                                {/* DEPÓSITO DESTINO (FILTRADO) */}
                                <div className="input-group" style={{flex:1}}>
                                    <label>Depósito Destino (Llegada)</label>
                                    <select 
                                        className="discord-select" 
                                        value={formData.id_destino} 
                                        onChange={e=>setFormData({...formData, id_destino: e.target.value})}
                                        disabled={!formData.id_origen} // Bloqueado hasta elegir origen
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {depositos
                                            // AQUÍ ESTÁ EL FILTRO IMPORTANTE:
                                            .filter(d => String(d.ID_DEPOSITO) !== String(formData.id_origen))
                                            .map(d=>(
                                                <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: TRANSPORTE */}
                    {step === 2 && (
                        <div className="fade-in">
                            <h3 style={{display:'flex', gap:'10px', alignItems:'center'}}><Truck size={20}/> Asignar Logística</h3>
                            <div className="input-group">
                                <label>Seleccionar Chofer</label>
                                <select className="discord-select" value={formData.id_chofer} onChange={e=>setFormData({...formData, id_chofer: e.target.value})}>
                                    <option value="">-- Seleccionar Personal --</option>
                                    {choferes.length > 0 ? (
                                        choferes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.estado})</option>)
                                    ) : <option disabled>No hay choferes disponibles</option>}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Seleccionar Vehículo</label>
                                <select className="discord-select" value={formData.id_vehiculo} onChange={e=>setFormData({...formData, id_vehiculo: e.target.value})}>
                                    <option value="">-- Seleccionar Camión --</option>
                                    <option value="1">Camión Scania #402</option>
                                    <option value="2">Camioneta Toyota #105</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Nota de Transporte</label>
                                <textarea className="discord-textarea" rows="2" placeholder="Ej: Carga frágil..."
                                    value={formData.observacion} onChange={e=>setFormData({...formData, observacion: e.target.value})}/>
                            </div>
                        </div>
                    )}

                    {/* PASO 3: CARGA */}
                    {step === 3 && (
                        <div className="fade-in">
                            <h3 style={{display:'flex', gap:'10px', alignItems:'center'}}><Package size={20}/> Cargar Materiales</h3>
                            <div style={{background: '#2b2d31', padding: '15px', borderRadius: '8px', marginBottom: '20px'}}>
                                <div style={{display:'flex', gap:'10px'}}>
                                    <div style={{flex:1}}>
                                        <label style={{fontSize:'0.8rem', color:'#aaa'}}>Material</label>
                                        <select className="discord-select" value={itemTemp.id_material} onChange={e=>handleMaterialChange(e.target.value)}>
                                            <option value="">-- Material --</option>
                                            {materiales.map(m=><option key={m.ID_MATERIAL} value={m.ID_MATERIAL}>{m.NOMBRE}</option>)}
                                        </select>
                                    </div>
                                    <div style={{flex:1}}>
                                        <label style={{fontSize:'0.8rem', color:'#aaa'}}>Lote (Stock Origen)</label>
                                        <select className="discord-select" value={itemTemp.id_lote} onChange={e=>setItemTemp({...itemTemp, id_lote: e.target.value})}>
                                            <option value="">-- Seleccionar Lote --</option>
                                            {lotesDisponibles.map(l=>(
                                                <option key={l.lote_id} value={l.lote_id}>
                                                    {l.codigo} (Disp: {l.cantidad})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{width:'100px'}}>
                                        <label style={{fontSize:'0.8rem', color:'#aaa'}}>Cantidad</label>
                                        <input type="number" className="discord-input" value={itemTemp.cantidad} onChange={e=>setItemTemp({...itemTemp, cantidad: e.target.value})}/>
                                    </div>
                                    <div style={{display:'flex', alignItems:'end'}}>
                                        <button className="btn-save" onClick={addItem} style={{height:'40px', width:'40px', padding:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
                                            <Plus size={20}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <table className="discord-table">
                                <thead><tr><th>Material</th><th>Código Lote</th><th>Cantidad</th><th></th></tr></thead>
                                <tbody>
                                    {formData.items.map((it, idx) => (
                                        <tr key={idx}>
                                            <td>{it.nombre}</td>
                                            <td style={{fontFamily:'monospace', color:'#facc15'}}>{it.codigo}</td>
                                            <td>{it.cantidad}</td>
                                            <td><button className="btn-icon-simple danger" onClick={()=>removeItem(idx)}><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                    {formData.items.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', color:'#777'}}>Vacío</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="wizard-footer" style={{display:'flex', justifyContent:'space-between', borderTop:'1px solid #444', paddingTop:'15px'}}>
                    <button className="btn-status" onClick={() => {if(step > 1) setStep(step - 1); else setShowWizard(false);}}>
                        {step === 1 ? "Cancelar" : "Atrás"}
                    </button>
                    <button className="btn-save" onClick={() => {
                        if(step < 3) {
                            if(step === 1 && (!formData.id_origen || !formData.id_destino)) return alert("Selecciona origen y destino");
                            setStep(step + 1);
                        } else { handleSubmit(); }
                    }}>
                        {step === 3 ? "Generar Vale" : "Siguiente"}
                    </button>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Movimientos;