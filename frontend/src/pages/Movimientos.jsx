// src/pages/Movimientos.jsx
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom"; 
import { apiFetch } from "../utils/api";
import { 
  Truck, MapPin, Package, Plus, Trash2, 
  Navigation, List, ClipboardList, UserPlus, CheckCircle, Search, Filter, Check, ShieldAlert,
  Eye, Printer // <--- Iconos nuevos
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "../styles/Movimientos.css"; 

import HistorialPedidos from "../components/HistorialPedidos"; 
import { generarValePDF } from "../utils/pdfGenerator"; // <--- Importar Generador PDF

// --- MAP CONFIGURATION ---
const iconOrigen = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const iconDestino = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const iconDisponible = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const iconCamion = new L.Icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/1048/1048313.png", iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -30] });

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 13); }, [center, map]);
  return null;
};

const Movimientos = () => {
  const userRole = sessionStorage.getItem("user_rol");
  const userDepositoId = sessionStorage.getItem("user_deposito_id");
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "movimientos");
  
  // --- STATES ---
  const [movimientos, setMovimientos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (location.state) {
        if (location.state.activeTab) setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Wizard & Modal States
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Data States
  const [depositos, setDepositos] = useState([]);
  const [materiales, setMateriales] = useState([]); 
  const [choferes, setChoferes] = useState([]); 
  const [vehiculosList, setVehiculosList] = useState([]); 
  const [activeVehicles, setActiveVehicles] = useState([]);

  // Wizard Data
  const [routeConfig, setRouteConfig] = useState({ 
    id_origen: "", 
    observacion: "",
    id_chofer: "",   
    id_vehiculo: ""  
  });

  const [stops, setStops] = useState([]); 
  const [editingStopIndex, setEditingStopIndex] = useState(null); 
  const [itemTemp, setItemTemp] = useState({ id_material: "", id_lote: "", cantidad: "" });
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [destinoSearch, setDestinoSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState(""); 

  // --- LOAD DATA ---
  useEffect(() => { loadMovimientos(); loadDepositos(); loadMateriales(); loadChoferes(); loadVehiculos(); loadActiveVehicles(); }, []);
  
  useEffect(() => { 
      if (showWizard && userRole !== "Master_Admin" && userDepositoId) { 
          setRouteConfig(prev => ({ ...prev, id_origen: userDepositoId })); 
      } 
  }, [showWizard, userRole, userDepositoId]);

  const loadMovimientos = async () => { try { const data = await apiFetch("http://127.0.0.1:5000/api/movimientos"); setMovimientos(data || []); } catch(e){} };
  const loadDepositos = async () => { try { const data = await apiFetch("http://127.0.0.1:5000/api/depositos"); setDepositos(data || []); } catch(e){} };
  const loadMateriales = async () => { try { const data = await apiFetch("http://127.0.0.1:5000/api/materiales"); setMateriales(data || []); } catch(e){} };
  const loadChoferes = async () => { try { const data = await apiFetch("http://127.0.0.1:5000/api/personal/choferes"); setChoferes(data || []); } catch(e){} };
  const loadVehiculos = async () => { try { const data = await apiFetch("http://127.0.0.1:5000/api/vehiculos"); setVehiculosList(data || []); } catch(e){} };
  const loadActiveVehicles = async () => { try { const data = await apiFetch("http://127.0.0.1:5000/api/vehicles/active"); setActiveVehicles(data || []); } catch(e){} };

  // --- LOGIC HANDLERS ---
  const handleMapClick = (deposito) => { if (String(deposito.ID_DEPOSITO) === String(routeConfig.id_origen)) return; const existsIndex = stops.findIndex(s => String(s.id_destino) === String(deposito.ID_DEPOSITO)); if (existsIndex >= 0) { const newStops = [...stops]; newStops.splice(existsIndex, 1); setStops(newStops); } else { setStops([...stops, { id_destino: deposito.ID_DEPOSITO, nombre: deposito.NOMBRE, lat: deposito.LATITUD, lng: deposito.LONGITUD, items: [] }]); } };
  const handlePredictiveChange = (e) => { const val = e.target.value; setDestinoSearch(val); const depot = depositos.find(d => d.NOMBRE.toLowerCase() === val.toLowerCase()); if (depot) { if (String(depot.ID_DEPOSITO) === String(routeConfig.id_origen)) { alert("No puedes seleccionar el origen como destino."); setDestinoSearch(""); return; } if (stops.some(s => String(s.id_destino) === String(depot.ID_DEPOSITO))) { alert("Este depósito ya está en la ruta."); setDestinoSearch(""); return; } handleMapClick(depot); setDestinoSearch(""); } };
  const handleMaterialPredictiveChange = (e) => { const val = e.target.value; setMaterialSearch(val); const material = materiales.find(m => m.NOMBRE.toLowerCase() === val.toLowerCase()); if (material) { handleMaterialChange(material.ID_MATERIAL); } else { setItemTemp(prev => ({...prev, id_material: "", id_lote: ""})); setLotesDisponibles([]); } };
  const handleAtenderPedido = (pedido) => { const depDestino = depositos.find(d => String(d.ID_DEPOSITO) === String(pedido.id_destino)); if (!depDestino) return alert("Error: No se encuentran datos geográficos del depósito solicitante."); const newStop = { id_destino: depDestino.ID_DEPOSITO, nombre: depDestino.NOMBRE, lat: depDestino.LATITUD, lng: depDestino.LONGITUD, items: [] }; setRouteConfig({ ...routeConfig, id_origen: userDepositoId || "", observacion: `[SOLICITUD #${pedido.id_solicitud}] Enviar: ${pedido.material} (Cant: ${pedido.cantidad}) - ${pedido.observacion || ''}` }); setStops([newStop]); setShowWizard(true); setStep(2); alert(`✅ Solicitud cargada para ${depDestino.NOMBRE}. Continúa para configurar la ruta.`); };
  const handleMaterialChange = async (idMaterial) => { setItemTemp({...itemTemp, id_material: idMaterial, id_lote: ""}); if(!idMaterial) { setLotesDisponibles([]); return; } try { const data = await apiFetch(`http://127.0.0.1:5000/api/materiales/${idMaterial}/lotes`); const filtrados = data.filter(l => String(l.deposito_id) === String(routeConfig.id_origen) && l.cantidad > 0 && l.estado === "Disponible" ); setLotesDisponibles(filtrados); } catch(e) { console.error(e); } };
  const addItemToStop = () => { if (editingStopIndex === null) return; if(!itemTemp.id_lote || !itemTemp.cantidad) return alert("Faltan datos"); const loteInfo = lotesDisponibles.find(l => String(l.lote_id) === String(itemTemp.id_lote)); if(Number(itemTemp.cantidad) > loteInfo.cantidad) return alert("Cantidad excede stock"); const newItem = { id_lote: itemTemp.id_lote, id_material: itemTemp.id_material, codigo: loteInfo.codigo, nombre: materiales.find(m => String(m.ID_MATERIAL) === String(itemTemp.id_material))?.NOMBRE, cantidad: itemTemp.cantidad }; const updatedStops = [...stops]; updatedStops[editingStopIndex].items.push(newItem); setStops(updatedStops); setItemTemp({ id_material: "", id_lote: "", cantidad: "" }); setMaterialSearch(""); setLotesDisponibles([]); };
  const removeItemFromStop = (stopIndex, itemIndex) => { const updatedStops = [...stops]; updatedStops[stopIndex].items.splice(itemIndex, 1); setStops(updatedStops); };
  
  // --- FUNCIONES DE BORRADO ---
  const handleDeleteSoft = async (id) => {
    if (!window.confirm("¿Enviar este registro a la papelera?")) return;
    try {
        await apiFetch(`http://127.0.0.1:5000/api/movimientos/${id}`, { method: "DELETE" });
        setMovimientos(movimientos.filter(m => m.id !== id));
        alert("Registro movido a la papelera.");
    } catch (e) {
        alert("Error: " + e.message);
    }
  };

  const handleDeletePerma = async (id) => {
    if (!window.confirm("⚠️ ¿Eliminar permanentemente? Esta acción no se puede deshacer.")) return;
    try {
        await apiFetch(`http://127.0.0.1:5000/api/movimientos/${id}/perma`, { method: "DELETE" });
        setMovimientos(movimientos.filter(m => m.id !== id));
        alert("Registro eliminado permanentemente.");
    } catch (e) {
        alert("Error: " + e.message);
    }
  };

  // --- LÓGICA DE IMPRESIÓN ---
  const handlePrint = (m, isPreview) => {
    // Adaptamos los datos de la fila (movimiento individual)
    // para que parezca un Vale completo en el PDF.
    const pdfData = {
        id: m.id,
        fecha: m.fecha,
        estado: 'Registrado',
        origen: m.deposito, // Asumimos que el backend manda el nombre del depósito origen
        destino: m.destino_final || (m.es_local ? 'Mov. Interno' : 'Ruta Externa'), 
        chofer: m.responsable || "Sin Asignar",
        vehiculo: m.vehiculo || "N/A",
        // Creamos un array de items con este único movimiento
        items: [{
            codigo: m.codigo || '-',
            material: m.material,
            lote: m.lote,
            cantidad: m.cantidad,
            unidad: m.unidad || 'u.'
        }]
    };
    generarValePDF(pdfData, isPreview);
  };

  // --- SUBMIT FINAL ---
  const handleSubmit = async () => { 
    const emptyStops = stops.filter(s => s.items.length === 0); 
    if(emptyStops.length > 0) return alert(`La parada "${emptyStops[0].nombre}" no tiene carga asignada.`); 
    
    if (!routeConfig.id_chofer || !routeConfig.id_vehiculo) {
        return alert("Error: Falta asignar Chofer o Vehículo.");
    }

    const payload = { ...routeConfig, stops: stops }; 

    try { 
        await apiFetch("http://127.0.0.1:5000/api/vales", { method: "POST", body: JSON.stringify(payload) }); 
        alert("✅ Ruta creada exitosamente."); 
        setShowWizard(false); 
        setStep(1); 
        setStops([]); 
        setRouteConfig({ id_origen: "", observacion: "", id_chofer: "", id_vehiculo: "" }); 
        loadMovimientos(); 
    } catch(e) { 
        alert("Error: " + e.message); 
    } 
  };

  const getCoords = (id) => { const dep = depositos.find(d => String(d.ID_DEPOSITO) === String(id)); return dep && dep.LATITUD ? [dep.LATITUD, dep.LONGITUD] : [-25.2800, -57.6350]; };
  const getRoutePositions = () => { const start = getCoords(routeConfig.id_origen); const waypoints = stops.map(s => [s.lat, s.lng]).filter(c => c[0]); return [start, ...waypoints]; };

  // --- FILTER LOGIC ---
  const filtered = movimientos.filter(m => {
    let matchesType = true;
    if (filtro === "rutas") matchesType = !m.es_local;
    if (filtro === "interno") matchesType = m.es_local;
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
        (m.material && m.material.toLowerCase().includes(term)) || 
        (m.responsable && m.responsable.toLowerCase().includes(term)) ||
        (m.vehiculo && m.vehiculo.toLowerCase().includes(term));
    return matchesType && matchesSearch;
  });

  // --- VALIDACIÓN DEL PASO 1 ---
  const handleNextStep1 = () => {
    if(!routeConfig.id_origen) return alert("Selecciona el Depósito de Origen.");
    if(!routeConfig.id_chofer) return alert("Debes seleccionar un Chofer.");
    if(!routeConfig.id_vehiculo) return alert("Debes seleccionar un Vehículo.");
    setStep(2);
  };

  return (
    <div className="movimientos-container">
      <div className="movimientos-content">
        <div className="page-header">
            <div>
                <h1>Gestión de Movimientos</h1>
                <p className="subtitle">Planificación de traslados y atención de pedidos.</p>
            </div>
            {(userRole === "Master_Admin" || userRole === "Personal_Inventario") && (
                <button className="btn-new" onClick={() => setShowWizard(true)}>
                    <Plus size={18}/> Nueva Ruta
                </button>
            )}
        </div>

        {/* TABS */}
        <div className="tabs-header">
            <button 
                onClick={() => setActiveTab("movimientos")} 
                className={`tab-btn ${activeTab === "movimientos" ? "active-blue" : ""}`}
            >
                <List size={18} /> Historial
            </button>
            {(userRole === "Master_Admin" || userRole === "Personal_Inventario" || userRole === "Administrador") && (
                <button 
                    onClick={() => setActiveTab("pedidos")} 
                    className={`tab-btn ${activeTab === "pedidos" ? "active-yellow" : ""}`}
                >
                    <ClipboardList size={18} /> Pedidos
                </button>
            )}
        </div>

        {/* MAIN TABLE (HISTORIAL) */}
        {activeTab === "movimientos" && (
            <div className="discord-card historial-card fade-in">
                
                {/* TOOLBAR */}
               <div className="toolbar-section relative">
                  <div className="search-bar-modern">
                    <Search size={18} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar por material, chofer o vehículo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <button
                    className={`btn-filter ${showFilters ? "active" : ""}`}
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                      backgroundColor: showFilters ? "#e0e7ff" : "",
                      color: showFilters ? "#4338ca" : ""
                    }}
                  >
                    <Filter size={18} /> Filtros
                  </button>

                  {showFilters && (
                    <div className="filters-dropdown fade-in">
                      <div className="filter-group">
                        <label>Tipo de Movimiento</label>
                        <div className="filter-chips">
                          {["todos", "rutas", "interno"].map(tipo => (
                            <button
                              key={tipo}
                              className={`chip ${filtro === tipo ? "active" : ""}`}
                              onClick={() => setFiltro(tipo)}
                            >
                              {tipo === "todos" ? "Todos" : tipo === "rutas" ? "Rutas" : "Interno"}
                              {filtro === tipo && <Check size={12} />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="filter-footer">
                        <button
                          className="btn-text-only"
                          onClick={() => { setFiltro("todos"); setSearchTerm(""); }}
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="table-responsive">
                    <table className="historial-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo / Detalle</th>
                                <th>Material</th>
                                <th>Responsable / Chofer</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(m => (
                                <tr key={m.id}>
                                    <td>{m.fecha}</td>
                                    <td>
                                        <span className={`badge-estado ${m.es_local ? 'badge-interno' : 'badge-ruta'}`}>
                                            {m.es_local ? 'INTERNO' : 'RUTA'}
                                        </span>
                                        <div className="cell-subtext mt-1">
                                            {m.es_local ? 'Mov. en Depósito' : 'Salida a Ruta'}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="font-semibold">{m.material}</span>
                                        <br/>
                                        <small className="bg-gray-100 px-1 rounded text-gray-500">
                                            Lote: {m.lote}
                                        </small>
                                        <span className="ml-2 font-bold text-gray-800">
                                            x{m.cantidad}
                                        </span>
                                    </td>
                                    <td>
                                        {m.responsable && m.responsable !== "Sin Asignar" ? (
                                            <div className="flex items-center gap-2">
                                                {m.es_local ? <ClipboardList size={16} color="#4b5563"/> : <Truck size={16} color="#4b5563"/>}
                                                <div className="text-sm">
                                                    <strong>{m.responsable}</strong>
                                                    {!m.es_local && <div className="text-gray-400 text-xs">{m.vehiculo}</div>}
                                                    {m.es_local && <div className="text-green-500 text-xs">Encargado</div>}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="badge-estado badge-sin-asignar">
                                                {m.es_local ? "Sin Responsable" : "Sin Asignar"}
                                            </span>
                                        )}
                                    </td>
                                    <td className="actions-cell">
                                        <div className="actions-group">
                                            {/* --- BOTONES DE IMPRESIÓN (Para todos) --- */}
                                            <button 
                                                className="btn-action secondary btn-icon-only" 
                                                onClick={() => handlePrint(m, true)} 
                                                title="Previsualizar PDF"
                                            >
                                                <Eye size={16}/>
                                            </button>
                                            <button 
                                                className="btn-print btn-icon-only" 
                                                onClick={() => handlePrint(m, false)} 
                                                title="Descargar PDF"
                                            >
                                                <Printer size={16}/>
                                            </button>

                                            {/* --- BOTONES DE EDICIÓN/BORRADO (Solo Admin) --- */}
                                            {(userRole === "Master_Admin" || userRole === "Administrador") && (
                                                <>
                                                    <button className="btn-action danger btn-small" onClick={() => handleDeleteSoft(m.id)} title="Papelera">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                    {userRole === "Master_Admin" && (
                                                        <button 
                                                            className="btn-action danger btn-small" 
                                                            onClick={() => handleDeletePerma(m.id)} 
                                                            title="Eliminar Permanente"
                                                            style={{backgroundColor: '#7f1d1d', color: 'white'}}
                                                        >
                                                            <ShieldAlert size={16}/>
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {/* --- BADGE INFORMATIVO PARA INVENTARIO --- */}
                                            {userRole === "Personal_Inventario" && (
                                                <span className="badge-estado badge-solo-lectura" style={{marginLeft: '5px'}}>
                                                    Solo Lectura
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="text-center p-5 text-gray-500">
                        {searchTerm ? "No se encontraron resultados para tu búsqueda." : "No hay movimientos registrados en esta categoría."}
                    </div>
                )}
            </div>
        )}

        {/* COMPONENTES SECUNDARIOS */}
        {activeTab === "pedidos" && <div className="fade-in"><HistorialPedidos onAtenderPedido={handleAtenderPedido} /></div>}
        
        {/* --- WIZARD --- */}
        {showWizard && ( 
            <div className="modal-backdrop">
                <div className="discord-card modal-wizard" style={{ width: '95%', maxWidth: '1400px', height: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <div className="wizard-header">
                        <h2>Nueva Ruta</h2>
                        <div className="wizard-steps">
                            <span className={`step ${step>=1 ? 'active':''}`}>1. Salida</span>
                            <div className="line"></div>
                            <span className={`step ${step>=2 ? 'active':''}`}>2. Mapa</span>
                            <div className="line"></div>
                            <span className={`step ${step>=3 ? 'active':''}`}>3. Carga</span>
                        </div>
                    </div>
                    
                    <div className="wizard-body">
                        {step === 1 && (
                            <div className="fade-in">
                                <h3 className="flex gap-2 items-center"><Truck/> Configuración de Salida</h3>
                                <div className="wizard-row">
                                    <div className="input-group wizard-col">
                                        <label>Depósito Origen</label>
                                        {userRole === "Master_Admin" ? (
                                            <select className="discord-select" value={routeConfig.id_origen} onChange={e => setRouteConfig({...routeConfig, id_origen: e.target.value})}>
                                                <option value="">-- Seleccionar Origen --</option>
                                                {depositos.map(d => (<option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>{d.NOMBRE}</option>))}
                                            </select>
                                        ) : (
                                            <div className="discord-input flex items-center gap-2 text-yellow-500">
                                                <MapPin size={16}/>
                                                <span>{depositos.find(d=>String(d.ID_DEPOSITO)===String(routeConfig.id_origen))?.NOMBRE || "Cargando..."}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="wizard-row">
                                    <div className="input-group wizard-col">
                                        <label>Chofer (Obligatorio)</label>
                                        <select className="discord-select" value={routeConfig.id_chofer} onChange={e => setRouteConfig({...routeConfig, id_chofer: e.target.value})}>
                                            <option value="">-- Seleccionar Chofer --</option>
                                            {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group wizard-col">
                                        <label>Vehículo (Obligatorio)</label>
                                        <select className="discord-select" value={routeConfig.id_vehiculo} onChange={e => setRouteConfig({...routeConfig, id_vehiculo: e.target.value})}>
                                            <option value="">-- Seleccionar Vehículo --</option>
                                            {vehiculosList.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="input-group mt-4">
                                    <label>Observaciones</label>
                                    <textarea className="discord-input" value={routeConfig.observacion} onChange={e=>setRouteConfig({...routeConfig, observacion: e.target.value})} placeholder="Detalles del viaje..."/>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="fade-in h-full flex flex-col">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="flex items-center gap-2"><Navigation size={20}/> Selecciona las paradas</h3>
                                    <div className="badge-estado bg-blue-500 text-white">{stops.length} Paradas Seleccionadas</div>
                                </div>
                                <div className="input-group mb-4">
                                    <label>Buscar y Agregar Parada</label>
                                    <div className="relative flex items-center">
                                        <Search size={18} className="absolute left-2 text-gray-500"/>
                                        <input type="text" list="depositos-list" className="discord-input pl-10" placeholder="Escribe el nombre del depósito..." value={destinoSearch} onChange={handlePredictiveChange}/>
                                        <datalist id="depositos-list">{depositos.filter(d => String(d.ID_DEPOSITO) !== String(routeConfig.id_origen)).filter(d => !stops.some(s => String(s.id_destino) === String(d.ID_DEPOSITO))).map(d => (<option key={d.ID_DEPOSITO} value={d.NOMBRE} />))}</datalist>
                                    </div>
                                </div>
                                
                                <div className="wizard-map-container" style={{ flex: 1, minHeight: '500px', width: '100%', position: 'relative' }}>
                                    <MapContainer center={getCoords(routeConfig.id_origen)} zoom={13} style={{ height: "100%", width: "100%", position: "absolute", top: 0, left: 0 }}>
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                                        <MapUpdater center={getCoords(routeConfig.id_origen)} />
                                        {stops.length > 0 && <Polyline positions={getRoutePositions()} color="#3b82f6" weight={4} dashArray="10, 10" />}
                                        {depositos.map(dep => { 
                                            const isOrigin = String(dep.ID_DEPOSITO) === String(routeConfig.id_origen); 
                                            const isSelected = stops.some(s => String(s.id_destino) === String(dep.ID_DEPOSITO)); 
                                            if(!dep.LATITUD) return null; 
                                            return ( <Marker key={dep.ID_DEPOSITO} position={[dep.LATITUD, dep.LONGITUD]} icon={isOrigin ? iconOrigen : (isSelected ? iconDestino : iconDisponible)} eventHandlers={{ click: () => handleMapClick(dep) }}> <Popup>{dep.NOMBRE}</Popup> </Marker> ); 
                                        })}
                                        {activeVehicles.map(veh => ( <Marker key={`veh-${veh.ID_VEHICULO}`} position={[veh.LATITUD, veh.LONGITUD]} icon={iconCamion}> <Popup><strong>{veh.MODELO}</strong><br/>{veh.MATRICULA}</Popup> </Marker> ))}
                                    </MapContainer>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="fade-in">
                                <h3 className="flex gap-2 mb-4"><Package/> Asignar Carga</h3>
                                <div className="load-selector-container">
                                    <div className="stops-sidebar">
                                        {stops.map((stop, idx) => (
                                            <div key={idx} onClick={() => setEditingStopIndex(idx)} className={`stop-item ${editingStopIndex === idx ? 'active' : ''}`}>
                                                <div className="font-bold">Parada #{idx+1}</div>
                                                <div className="text-sm">{stop.nombre}</div>
                                                <small>{stop.items.length} items</small>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex-1 pl-4">
                                        {editingStopIndex !== null ? (
                                            <>
                                                <h4 className="mb-2">Cargando para: {stops[editingStopIndex].nombre}</h4>
                                                <div className="load-form-row">
                                                    <div className="flex-1">
                                                        <label className="text-xs">Material</label>
                                                        <input type="text" list="materiales-list" className="discord-input" placeholder="Buscar material..." value={materialSearch} onChange={handleMaterialPredictiveChange}/>
                                                        <datalist id="materiales-list">{materiales.map(m => (<option key={m.ID_MATERIAL} value={m.NOMBRE} />))}</datalist>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-xs">Lote</label>
                                                        <select className="discord-select" value={itemTemp.id_lote} onChange={e=>setItemTemp({...itemTemp, id_lote: e.target.value})}>
                                                            <option value="">-- Lote --</option>
                                                            {lotesDisponibles.map(l=><option key={l.lote_id} value={l.lote_id}>{l.codigo} (Disp: {l.cantidad})</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="w-20">
                                                        <label className="text-xs">Cant.</label>
                                                        <input type="number" className="discord-input" value={itemTemp.cantidad} onChange={e=>setItemTemp({...itemTemp, cantidad: e.target.value})}/>
                                                    </div>
                                                    <button className="btn-icon-simple success" onClick={addItemToStop} type="button"><Plus size={18}/></button>
                                                </div>
                                                <div className="load-list">
                                                    {stops[editingStopIndex].items.map((it, i) => (
                                                        <div key={i} className="load-list-item">
                                                            <span>{it.nombre} ({it.cantidad})</span>
                                                            <button className="btn-icon-simple danger" onClick={()=>removeItemFromStop(editingStopIndex, i)} type="button"><Trash2 size={12}/></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : <div className="h-full flex items-center justify-center text-gray-500">Selecciona una parada a la izquierda</div>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="wizard-footer">
                        <button className="btn-status" type="button" onClick={()=>{if(step>1) setStep(step-1); else setShowWizard(false)}}>{step===1?"Cancelar":"Atrás"}</button>
                        <button className="btn-save" type="button" onClick={()=>{
                            if(step===1){ 
                                handleNextStep1(); 
                            } else if (step===2){ 
                                if(stops.length===0) return alert("Selecciona destinos"); 
                                setStep(3); 
                                setEditingStopIndex(0); 
                            } else { 
                                handleSubmit(); 
                            }
                        }}>{step===3?"Finalizar y Crear Ruta":"Siguiente"}</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Movimientos;