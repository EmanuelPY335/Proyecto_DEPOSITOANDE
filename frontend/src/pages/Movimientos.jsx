// src/pages/Movimientos.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { 
  Truck, MapPin, Package, Plus, Trash2, Calendar, 
  Map as MapIcon, Layers, Navigation, CheckCircle 
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "../styles/Movimientos.css";

// --- CONFIGURACIÓN DE ICONOS DEL MAPA ---
const iconOrigen = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const iconDestino = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const iconDisponible = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const iconCamion = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/1048/1048313.png", 
    iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -30]
});

// Componente para centrar el mapa automáticamente
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 13); }, [center, map]);
  return null;
};

const Movimientos = () => {
  const userRole = sessionStorage.getItem("user_rol");
  const userDepositoId = sessionStorage.getItem("user_deposito_id");

  // Estados Generales
  const [movimientos, setMovimientos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  
  // Estados Wizard
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  
  // Datos Maestros
  const [depositos, setDepositos] = useState([]);
  const [materiales, setMateriales] = useState([]); 
  const [choferes, setChoferes] = useState([]); 
  const [vehiculosList, setVehiculosList] = useState([]); // <--- NUEVO ESTADO PARA LISTA REAL
  const [activeVehicles, setActiveVehicles] = useState([]); // Camiones en vivo (GPS)

  // Configuración del Viaje
  const [routeConfig, setRouteConfig] = useState({
    id_origen: "", id_chofer: "", id_vehiculo: "", observacion: ""
  });

  // GESTIÓN DE RUTA VISUAL
  const [stops, setStops] = useState([]); 
  
  // Estado para cargar materiales
  const [editingStopIndex, setEditingStopIndex] = useState(null); 
  const [itemTemp, setItemTemp] = useState({ id_material: "", id_lote: "", cantidad: "" });
  const [lotesDisponibles, setLotesDisponibles] = useState([]);

  useEffect(() => {
    loadMovimientos();
    loadDepositos();
    loadMateriales();
    loadChoferes();
    loadVehiculos(); // <--- CARGAMOS VEHICULOS REALES
    loadActiveVehicles();
  }, []);

  // Pre-llenado de Origen
  useEffect(() => {
    if (showWizard && userRole !== "Master_Admin" && userDepositoId) {
       setRouteConfig(prev => ({ ...prev, id_origen: userDepositoId }));
    }
  }, [showWizard, userRole, userDepositoId]);

  const loadMovimientos = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/movimientos"); setMovimientos(data || []); } catch(e){}
  };
  const loadDepositos = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/depositos"); setDepositos(data || []); } catch(e){}
  };
  const loadMateriales = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/materiales"); setMateriales(data || []); } catch(e){}
  };
  const loadChoferes = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/personal/choferes"); setChoferes(data || []); } catch(e){}
  };
  // Nueva función para cargar la lista de vehículos disponibles para asignar
  const loadVehiculos = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/vehiculos"); setVehiculosList(data || []); } catch(e){}
  };
  const loadActiveVehicles = async () => {
    try { const data = await apiFetch("http://127.0.0.1:5000/api/vehicles/active"); setActiveVehicles(data || []); } catch(e){}
  };

  // --- LÓGICA DEL MAPA (PASO 2) ---
  const handleMapClick = (deposito) => {
    // Si es el origen, no hacemos nada
    if (String(deposito.ID_DEPOSITO) === String(routeConfig.id_origen)) return;

    // Verificar si ya está en la ruta
    const existsIndex = stops.findIndex(s => String(s.id_destino) === String(deposito.ID_DEPOSITO));

    if (existsIndex >= 0) {
        const newStops = [...stops];
        newStops.splice(existsIndex, 1);
        setStops(newStops);
    } else {
        setStops([...stops, {
            id_destino: deposito.ID_DEPOSITO,
            nombre: deposito.NOMBRE,
            lat: deposito.LATITUD,
            lng: deposito.LONGITUD,
            items: []
        }]);
    }
  };

  // --- LÓGICA DE CARGA DE MATERIALES (PASO 3) ---
  const handleMaterialChange = async (idMaterial) => {
    setItemTemp({...itemTemp, id_material: idMaterial, id_lote: ""});
    if(!idMaterial) { setLotesDisponibles([]); return; }
    try {
        const data = await apiFetch(`http://127.0.0.1:5000/api/materiales/${idMaterial}/lotes`);
        const filtrados = data.filter(l => 
            String(l.deposito_id) === String(routeConfig.id_origen) && 
            l.cantidad > 0 && l.estado === "Disponible"
        );
        setLotesDisponibles(filtrados);
    } catch(e) { console.error(e); }
  };

  const addItemToStop = () => {
    if (editingStopIndex === null) return;
    if(!itemTemp.id_lote || !itemTemp.cantidad) return alert("Faltan datos");
    
    const loteInfo = lotesDisponibles.find(l => String(l.lote_id) === String(itemTemp.id_lote));
    if(Number(itemTemp.cantidad) > loteInfo.cantidad) return alert("Cantidad excede stock");

    const newItem = {
        id_lote: itemTemp.id_lote,
        id_material: itemTemp.id_material, // IMPORTANTE: Enviamos el ID del material
        codigo: loteInfo.codigo,
        nombre: materiales.find(m => String(m.ID_MATERIAL) === String(itemTemp.id_material))?.NOMBRE,
        cantidad: itemTemp.cantidad
    };

    const updatedStops = [...stops];
    updatedStops[editingStopIndex].items.push(newItem);
    setStops(updatedStops);
    
    setItemTemp({ id_material: "", id_lote: "", cantidad: "" });
    setLotesDisponibles([]);
  };

  const removeItemFromStop = (stopIndex, itemIndex) => {
    const updatedStops = [...stops];
    updatedStops[stopIndex].items.splice(itemIndex, 1);
    setStops(updatedStops);
  };

  // --- ENVÍO AL BACKEND ---
  const handleSubmit = async () => {
    const emptyStops = stops.filter(s => s.items.length === 0);
    if(emptyStops.length > 0) return alert(`La parada "${emptyStops[0].nombre}" no tiene carga asignada.`);
    
    const payload = { ...routeConfig, stops: stops };

    try {
        await apiFetch("http://127.0.0.1:5000/api/vales", { method: "POST", body: JSON.stringify(payload) });
        alert("Ruta generada exitosamente.");
        setShowWizard(false); setStep(1); setStops([]); setRouteConfig({ id_origen: "", id_chofer: "", id_vehiculo: "", observacion: "" });
        loadMovimientos();
    } catch(e) { alert("Error: " + e.message); }
  };

  const getCoords = (id) => {
    const dep = depositos.find(d => String(d.ID_DEPOSITO) === String(id));
    return dep && dep.LATITUD ? [dep.LATITUD, dep.LONGITUD] : [-27.33056, -55.86667]; 
  };

  const getRoutePositions = () => {
    const start = getCoords(routeConfig.id_origen);
    const waypoints = stops.map(s => [s.lat, s.lng]).filter(c => c[0]); 
    return [start, ...waypoints];
  };

  const filtered = movimientos.filter(m => filtro==="todos" ? true : (filtro==="locales" ? m.es_local : !m.es_local));

  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        <div className="page-header">
            <div>
                <h1>Gestión de Rutas</h1>
                <p className="subtitle">Planificación de traslados múltiples.</p>
            </div>
            {(userRole === "Master_Admin" || userRole === "Personal_Inventario") && (
                <button className="btn-new" onClick={() => setShowWizard(true)}>
                    <Plus size={18}/> Crear Ruta
                </button>
            )}
        </div>

        <div className="discord-card">
          <table className="discord-table">
             <thead><tr><th>Fecha</th><th>Tipo</th><th>Material</th><th>Cant.</th><th>Destino</th></tr></thead>
             <tbody>
                {filtered.map(m => (
                    <tr key={m.id}>
                        <td>{m.fecha}</td>
                        <td><span className="badge-estado">{m.es_local ? 'Interno' : 'Ruta'}</span></td>
                        <td>{m.material} <small>({m.lote})</small></td>
                        <td>{m.cantidad}</td>
                        <td>{m.deposito}</td>
                    </tr>
                ))}
             </tbody>
          </table>
        </div>

        {showWizard && (
          <div className="modal-backdrop">
            <div className="discord-card modal-wizard" style={{width: '900px', height: '90vh', display:'flex', flexDirection:'column'}}>
                
                <div className="wizard-header">
                    <h2>Nueva Ruta de Reparto</h2>
                    <div className="wizard-steps">
                        <span className={`step ${step>=1 ? 'active':''}`}>1. Logística</span>
                        <div className="line"></div>
                        <span className={`step ${step>=2 ? 'active':''}`}>2. Mapa de Ruta</span>
                        <div className="line"></div>
                        <span className={`step ${step>=3 ? 'active':''}`}>3. Carga</span>
                    </div>
                </div>

                <div className="wizard-body" style={{flex: 1, overflowY: 'auto', padding: '20px'}}>
                    
                    {/* PASO 1: LOGÍSTICA */}
                    {step === 1 && (
                        <div className="fade-in">
                            <h3 style={{display:'flex', gap:'10px'}}><Truck/> Configuración de Salida</h3>
                            <div className="row-2" style={{display:'flex', gap:'20px', marginTop:'15px'}}>
                                <div className="input-group" style={{flex:1}}>
                                    <label>Depósito Origen</label>
                                    <div className="discord-input" style={{display:'flex', alignItems:'center', gap:'10px', color:'#eab308'}}>
                                        <MapPin size={16}/>
                                        <span>{depositos.find(d=>String(d.ID_DEPOSITO)===String(routeConfig.id_origen))?.NOMBRE || "Cargando..."}</span>
                                    </div>
                                </div>
                                <div className="input-group" style={{flex:1}}>
                                    <label>Chofer</label>
                                    <select className="discord-select" value={routeConfig.id_chofer} onChange={e=>setRouteConfig({...routeConfig, id_chofer: e.target.value})}>
                                        <option value="">-- Seleccionar --</option>
                                        {choferes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="input-group">
                                <label>Vehículo</label>
                                {/* --- AQUÍ ESTÁ EL CAMBIO IMPORTANTE: SELECT DINÁMICO --- */}
                                <select 
                                    className="discord-select" 
                                    value={routeConfig.id_vehiculo} 
                                    onChange={e=>setRouteConfig({...routeConfig, id_vehiculo: e.target.value})}
                                >
                                    <option value="">-- Seleccionar Camión --</option>
                                    {vehiculosList.length > 0 ? (
                                        vehiculosList.map(v => (
                                            <option key={v.id} value={v.id}>{v.nombre}</option>
                                        ))
                                    ) : (
                                        <option disabled>No hay vehículos disponibles</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: MAPA INTERACTIVO */}
                    {step === 2 && (
                        <div className="fade-in" style={{height: '100%', display:'flex', flexDirection:'column'}}>
                            <div style={{marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <h3><Navigation size={20}/> Selecciona las paradas en el mapa</h3>
                                <div className="badge-estado" style={{background:'#3b82f6'}}>
                                    {stops.length} Paradas Seleccionadas
                                </div>
                            </div>
                            
                            <div style={{flex:1, borderRadius:'10px', overflow:'hidden', border:'2px solid #444', minHeight:'300px'}}>
                                <MapContainer center={getCoords(routeConfig.id_origen)} zoom={13} style={{ height: "100%", width: "100%" }}>
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                                    <MapUpdater center={getCoords(routeConfig.id_origen)} />
                                    
                                    {stops.length > 0 && (
                                        <Polyline positions={getRoutePositions()} color="#3b82f6" weight={4} dashArray="10, 10" />
                                    )}

                                    {depositos.map(dep => {
                                        const isOrigin = String(dep.ID_DEPOSITO) === String(routeConfig.id_origen);
                                        const isSelected = stops.some(s => String(s.id_destino) === String(dep.ID_DEPOSITO));
                                        if(!dep.LATITUD || !dep.LONGITUD) return null;

                                        return (
                                            <Marker 
                                                key={dep.ID_DEPOSITO} 
                                                position={[dep.LATITUD, dep.LONGITUD]}
                                                icon={isOrigin ? iconOrigen : (isSelected ? iconDestino : iconDisponible)}
                                                eventHandlers={{ click: () => handleMapClick(dep) }}
                                            >
                                                <Popup>
                                                    <strong>{dep.NOMBRE}</strong><br/>
                                                    {isOrigin ? "📍 Punto de Partida" : (isSelected ? "✅ Parada Seleccionada" : "Haz clic para añadir")}
                                                </Popup>
                                            </Marker>
                                        );
                                    })}

                                    {activeVehicles.map(veh => (
                                        <Marker 
                                            key={`veh-${veh.ID_VEHICULO}`}
                                            position={[veh.LATITUD, veh.LONGITUD]}
                                            icon={iconCamion}
                                        >
                                            <Popup>
                                                <div style={{textAlign:'center'}}>
                                                    <strong>{veh.MODELO}</strong><br/>
                                                    <span style={{fontSize:'0.8rem', color:'#666'}}>{veh.MATRICULA}</span><br/>
                                                    <span style={{fontSize:'0.7rem', color:'#22c55e'}}>● En movimiento</span>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}

                                </MapContainer>
                            </div>
                            <p style={{fontSize:'0.8rem', color:'#aaa', marginTop:'5px', textAlign:'center'}}>
                                * Haz clic en los marcadores azules para agregarlos a la ruta. Haz clic de nuevo para quitarlos.
                            </p>
                        </div>
                    )}

                    {/* PASO 3: CARGA */}
                    {step === 3 && (
                        <div className="fade-in">
                            <h3 style={{display:'flex', gap:'10px'}}><Package/> Asignar Carga por Parada</h3>
                            <div style={{display:'flex', gap:'20px', height:'400px'}}>
                                <div style={{width:'30%', borderRight:'1px solid #444', paddingRight:'10px', overflowY:'auto'}}>
                                    {stops.map((stop, idx) => (
                                        <div 
                                            key={stop.id_destino}
                                            onClick={() => setEditingStopIndex(idx)}
                                            style={{
                                                padding:'15px', marginBottom:'10px', borderRadius:'8px', cursor:'pointer',
                                                background: editingStopIndex === idx ? '#3b82f6' : '#1e1f22',
                                                color: editingStopIndex === idx ? 'white' : '#ccc',
                                                border: stop.items.length === 0 ? '1px solid #ef4444' : '1px solid transparent'
                                            }}
                                        >
                                            <div style={{fontWeight:'bold'}}>Parada #{idx+1}</div>
                                            <div style={{fontSize:'0.9rem'}}>{stop.nombre}</div>
                                            <div style={{fontSize:'0.8rem', marginTop:'5px', opacity:0.8}}>
                                                {stop.items.length} items cargados
                                            </div>
                                            {stop.items.length === 0 && <small style={{color:'#fca5a5'}}>⚠ Sin carga</small>}
                                        </div>
                                    ))}
                                </div>

                                <div style={{flex:1, paddingLeft:'10px', display:'flex', flexDirection:'column'}}>
                                    {editingStopIndex !== null ? (
                                        <>
                                            <h4>Cargando para: <span style={{color:'#60a5fa'}}>{stops[editingStopIndex].nombre}</span></h4>
                                            
                                            <div style={{background:'#111', padding:'10px', borderRadius:'6px', display:'flex', gap:'10px', alignItems:'end', marginBottom:'15px'}}>
                                                <div style={{flex:1}}>
                                                    <label style={{fontSize:'0.7rem'}}>Material</label>
                                                    <select className="discord-select" value={itemTemp.id_material} onChange={e=>handleMaterialChange(e.target.value)}>
                                                        <option value="">-- Item --</option>
                                                        {materiales.map(m=><option key={m.ID_MATERIAL} value={m.ID_MATERIAL}>{m.NOMBRE}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{flex:1}}>
                                                    <label style={{fontSize:'0.7rem'}}>Lote</label>
                                                    <select className="discord-select" value={itemTemp.id_lote} onChange={e=>setItemTemp({...itemTemp, id_lote: e.target.value})}>
                                                        <option value="">-- Lote --</option>
                                                        {lotesDisponibles.map(l=><option key={l.lote_id} value={l.lote_id}>{l.codigo} (Disp: {l.cantidad})</option>)}
                                                    </select>
                                                </div>
                                                <div style={{width:'80px'}}>
                                                    <label style={{fontSize:'0.7rem'}}>Cant.</label>
                                                    <input type="number" className="discord-input" value={itemTemp.cantidad} onChange={e=>setItemTemp({...itemTemp, cantidad: e.target.value})}/>
                                                </div>
                                                <button className="btn-icon-simple success" onClick={addItemToStop}><Plus size={18}/></button>
                                            </div>

                                            <div style={{flex:1, overflowY:'auto'}}>
                                                <table className="discord-table">
                                                    <thead><tr><th>Material</th><th>Lote</th><th>Cant.</th><th></th></tr></thead>
                                                    <tbody>
                                                        {stops[editingStopIndex].items.map((it, i) => (
                                                            <tr key={i}>
                                                                <td>{it.nombre}</td>
                                                                <td style={{color:'#eab308', fontFamily:'monospace'}}>{it.codigo}</td>
                                                                <td>{it.cantidad}</td>
                                                                <td><button className="btn-icon-simple danger" onClick={()=>removeItemFromStop(editingStopIndex, i)}><Trash2 size={14}/></button></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#555', flexDirection:'column'}}>
                                            <Truck size={40} style={{marginBottom:'10px'}}/>
                                            <p>Selecciona una parada de la izquierda para cargar mercadería.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="wizard-footer" style={{display:'flex', justifyContent:'space-between', borderTop:'1px solid #444', paddingTop:'15px', padding:'15px'}}>
                    <button className="btn-status" onClick={()=>{if(step>1) setStep(step-1); else setShowWizard(false)}}>
                        {step===1?"Cancelar":"Atrás"}
                    </button>
                    <button className="btn-save" onClick={()=>{
                        if(step===1){
                             if(!routeConfig.id_origen || !routeConfig.id_chofer || !routeConfig.id_vehiculo) return alert("Completa los datos de salida");
                             setStep(2);
                        } else if (step===2){
                             if(stops.length===0) return alert("Selecciona al menos un destino en el mapa");
                             setStep(3);
                             setEditingStopIndex(0); 
                        } else {
                             handleSubmit();
                        }
                    }}>
                        {step===3?"Confirmar Ruta Completa":"Siguiente"}
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