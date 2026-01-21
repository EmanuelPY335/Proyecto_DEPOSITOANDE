// src/pages/Movimientos.jsx (CORREGIDO)
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom"; 
import { apiFetch } from "../utils/api";
import { 
  Truck, MapPin, Package, Plus, Trash2, 
  Navigation, List, ClipboardList, Search, Filter, Check, ShieldAlert,
  Eye, Printer, Layers, X
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "../styles/Movimientos.css"; 

import HistorialPedidos from "../components/HistorialPedidos"; 
import { generarValePDF } from "../utils/pdfGenerator"; 

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
  // 1. TODOS LOS HOOKS AL INICIO - SIN CONDICIONALES
  const userRole = sessionStorage.getItem("user_rol");
  const userPermissions = JSON.parse(sessionStorage.getItem("user_permissions") || "[]");
  const userDepositoId = sessionStorage.getItem("user_deposito_id");
  const location = useLocation();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "movimientos");
  const [movimientos, setMovimientos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");

  // States del Wizard
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(() => {
      const saved = localStorage.getItem('wiz_step');
      return saved ? Number(saved) : 1;
  });
  const [showFilters, setShowFilters] = useState(false);

  // Data States
  const [depositos, setDepositos] = useState([]);
  const [materiales, setMateriales] = useState([]); 
  const [choferes, setChoferes] = useState([]); 
  const [vehiculosList, setVehiculosList] = useState([]); 
  const [activeVehicles, setActiveVehicles] = useState([]);

  // Wizard Data
 const [routeConfig, setRouteConfig] = useState(() => {
      const saved = localStorage.getItem('wiz_config');
      return saved ? JSON.parse(saved) : { 
        id_origen: "", 
        observacion: "",
        id_chofer: "",    
        id_vehiculo: ""   
      };
  });

  // CORRECCIÓN 3: Leer las paradas guardadas
  const [stops, setStops] = useState(() => {
      const saved = localStorage.getItem('wiz_stops');
      return saved ? JSON.parse(saved) : [];
  });
  const [editingStopIndex, setEditingStopIndex] = useState(null); 
  const [itemTemp, setItemTemp] = useState({ id_material: "", id_lote: "", cantidad: "" });
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [destinoSearch, setDestinoSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");

  // 2. LOGICA DE PERMISOS DESPUÉS DE LOS HOOKS
  const puedeGestionarMovimientos = () => {
    if (userRole === "Master_Admin") return true;
    return userPermissions.includes("gestion_movimientos");
  };
  
  const puedeVerPedidos = () => {
    if (userRole === "Master_Admin") return true;
    const rolesPermitidos = ["Admin", "Personal_Inventario", "Administrador"];
    return rolesPermitidos.includes(userRole) || userPermissions.includes("ver_pedidos");
  };
  
  const puedeCrearRutas = () => {
    if (userRole === "Master_Admin") return true;
    const rolesPermitidos = ["Personal_Inventario", "Admin"];
    return rolesPermitidos.includes(userRole) || userPermissions.includes("crear_rutas");
  };
useEffect(() => {
        localStorage.setItem('wiz_step', step);
        localStorage.setItem('wiz_config', JSON.stringify(routeConfig));
        localStorage.setItem('wiz_stops', JSON.stringify(stops));
    }, [step, routeConfig, stops]);


    // ---------------------------------------------------------
    // EFECTO 2: Autodestrucción en F5 (Limpieza)
    // Se ejecuta solo una vez al cargar el componente
    // ---------------------------------------------------------
    useEffect(() => {
        const handleBrowserRefresh = () => {
            // Borramos todo si detecta que la página se va a cerrar o recargar
            localStorage.removeItem('wiz_step');
            localStorage.removeItem('wiz_config');
            localStorage.removeItem('wiz_stops');
        };

        // Activamos el sensor de "F5 / Cerrar Pestaña"
        window.addEventListener('beforeunload', handleBrowserRefresh);

        // Limpieza: quitamos el sensor cuando el componente se desmonta
        return () => {
            window.removeEventListener('beforeunload', handleBrowserRefresh);
        };
    }, []); // <--- El array vacío es clave: esto solo se configura al inicio
  // 3. TODOS LOS USEEFFECT FUERA DE CONDICIONALES
  // Este siempre se ejecuta
  useEffect(() => {
    if (location.state?.activeTab) setActiveTab(location.state.activeTab);
  }, [location.state]);

  // Este siempre se ejecuta, pero la lógica interna es condicional
  useEffect(() => { 
    // La condición va DENTRO del useEffect, no afuera
    if (puedeGestionarMovimientos() || puedeVerPedidos()) {
      loadMovimientos(); 
      loadDepositos(); 
      loadMateriales(); 
      loadChoferes(); 
      loadVehiculos(); 
      loadActiveVehicles(); 
    }
  }, []); // ← Array de dependencias vacío
  
  // Este siempre se ejecuta
  useEffect(() => { 
      if (showWizard && userRole !== "Master_Admin" && userDepositoId) { 
          setRouteConfig(prev => ({ ...prev, id_origen: userDepositoId })); 
      } 
  }, [showWizard, userRole, userDepositoId]);

  // 4. BLOQUEO DE ACCESO - DESPUÉS DE LOS HOOKS
  if (!puedeGestionarMovimientos() && !puedeVerPedidos()) {
    return (
      <div className="fade-in" style={{
        display:'flex', 
        flexDirection: 'column', 
        justifyContent:'center', 
        alignItems:'center', 
        height:'60vh', 
        color:'#4b5563',
        textAlign: 'center'
      }}>
        <ShieldAlert size={64} style={{color:'#ef4444', marginBottom: 20}} />
        <h1>Acceso Restringido</h1>
        <p>No tienes permisos para acceder a Gestión de Movimientos.</p>
        <p className="mt-4">Permiso requerido: <strong>gestion_movimientos</strong> o <strong>ver_pedidos</strong></p>
        <p>Tu rol actual: <strong>{userRole}</strong></p>
        <p>Tus permisos: {userPermissions.join(", ") || "Ninguno"}</p>
        <button 
          className="btn-primary mt-4" 
          onClick={() => navigate("/home")}
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  // 5. FUNCIONES DE CARGA DE DATOS
  const loadMovimientos = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/movimientos"); 
      setMovimientos(data || []); 
    } catch(e) {
      console.error("Error cargando movimientos:", e);
    } 
  };
  
  const loadDepositos = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/depositos"); 
      setDepositos(data || []); 
    } catch(e) {
      console.error("Error cargando depósitos:", e);
    } 
  };
  
  const loadMateriales = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/materiales"); 
      setMateriales(data || []); 
    } catch(e) {
      console.error("Error cargando materiales:", e);
    } 
  };
  
  const loadChoferes = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/personal/choferes"); 
      setChoferes(data || []); 
    } catch(e) {
      console.error("Error cargando choferes:", e);
    } 
  };
  
  const loadVehiculos = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/vehiculos"); 
      setVehiculosList(data || []); 
    } catch(e) {
      console.error("Error cargando vehículos:", e);
    } 
  };
  
  const loadActiveVehicles = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/vehicles/active"); 
      setActiveVehicles(data || []); 
    } catch(e) {
      console.error("Error cargando vehículos activos:", e);
    } 
  };

  // --- LOGIC HANDLERS (Manteniendo todas las funciones) ---
  const handleMapClick = (deposito) => { 
    if (String(deposito.ID_DEPOSITO) === String(routeConfig.id_origen)) return; 
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
  
  const handlePredictiveChange = (e) => { 
    const val = e.target.value; 
    setDestinoSearch(val); 
    const depot = depositos.find(d => d.NOMBRE.toLowerCase() === val.toLowerCase()); 
    if (depot) { 
      if (String(depot.ID_DEPOSITO) === String(routeConfig.id_origen)) { 
        alert("No puedes seleccionar el origen como destino."); 
        setDestinoSearch(""); 
        return; 
      } 
      if (stops.some(s => String(s.id_destino) === String(depot.ID_DEPOSITO))) { 
        alert("Este depósito ya está en la ruta."); 
        setDestinoSearch(""); 
        return; 
      } 
      handleMapClick(depot); 
      setDestinoSearch(""); 
    } 
  };
  
  const handleMaterialPredictiveChange = (e) => { 
    const val = e.target.value; 
    setMaterialSearch(val); 
    const material = materiales.find(m => m.NOMBRE.toLowerCase() === val.toLowerCase()); 
    if (material) { 
      handleMaterialChange(material.ID_MATERIAL); 
    } else { 
      setItemTemp(prev => ({...prev, id_material: "", id_lote: ""})); 
      setLotesDisponibles([]); 
    } 
  };
  
  const handleAtenderPedido = (pedido) => { 
    const depDestino = depositos.find(d => String(d.ID_DEPOSITO) === String(pedido.id_destino)); 
    if (!depDestino) return alert("Error: No se encuentran datos geográficos del depósito solicitante."); 
    const newStop = { 
      id_destino: depDestino.ID_DEPOSITO, 
      nombre: depDestino.NOMBRE, 
      lat: depDestino.LATITUD, 
      lng: depDestino.LONGITUD, 
      items: [] 
    }; 
    setRouteConfig({ 
      ...routeConfig, 
      id_origen: userDepositoId || "", 
      observacion: `[SOLICITUD #${pedido.id_solicitud}] Enviar: ${pedido.material} (Cant: ${pedido.cantidad}) - ${pedido.observacion || ''}` 
    }); 
    setStops([newStop]); 
    setShowWizard(true); 
    setStep(2); 
    alert(`✅ Solicitud cargada para ${depDestino.NOMBRE}. Continúa para configurar la ruta.`); 
  };
  
  const handleMaterialChange = async (idMaterial) => { 
    setItemTemp({...itemTemp, id_material: idMaterial, id_lote: ""}); 
    if(!idMaterial) { 
      setLotesDisponibles([]); 
      return; 
    } 
    try { 
      const data = await apiFetch(`http://127.0.0.1:5000/api/materiales/${idMaterial}/lotes`); 
      const filtrados = data.filter(l => 
        String(l.deposito_id) === String(routeConfig.id_origen) && 
        l.cantidad > 0 && 
        l.estado === "Disponible" 
      ); 
      setLotesDisponibles(filtrados); 
    } catch(e) { 
      console.error(e); 
    } 
  };
  
  const addItemToStop = () => { 
    if (editingStopIndex === null) return; 
    if(!itemTemp.id_lote || !itemTemp.cantidad) return alert("Faltan datos"); 
    const loteInfo = lotesDisponibles.find(l => String(l.lote_id) === String(itemTemp.id_lote)); 
    if(Number(itemTemp.cantidad) > loteInfo.cantidad) return alert("Cantidad excede stock"); 
    const newItem = { 
      id_lote: itemTemp.id_lote, 
      id_material: itemTemp.id_material, 
      codigo: loteInfo.codigo, 
      nombre: materiales.find(m => String(m.ID_MATERIAL) === String(itemTemp.id_material))?.NOMBRE, 
      cantidad: itemTemp.cantidad, 
      UNIDAD: materiales.find(m => String(m.ID_MATERIAL) === String(itemTemp.id_material))?.UNIDAD || "Unid."
    }; 
    const updatedStops = [...stops]; 
    updatedStops[editingStopIndex].items.push(newItem); 
    setStops(updatedStops); 
    setItemTemp({ id_material: "", id_lote: "", cantidad: "" }); 
    setMaterialSearch(""); 
    setLotesDisponibles([]); 
  };
  
  const removeItemFromStop = (stopIndex, itemIndex) => { 
    const updatedStops = [...stops]; 
    updatedStops[stopIndex].items.splice(itemIndex, 1); 
    setStops(updatedStops); 
  };
  
  // --- FUNCIONES DE BORRADO ---
  const handleDeleteSoft = async (id) => { 
    if (!window.confirm("¿Enviar a papelera?")) return; 
    try { 
      await apiFetch(`http://127.0.0.1:5000/api/movimientos/${id}`, { method: "DELETE" }); 
      setMovimientos(movimientos.filter(m => m.id !== id)); 
      alert("Registro movido a la papelera."); 
    } catch (e) { 
      alert("Error: " + e.message); 
    } 
  };
  
  const handleDeletePerma = async (id) => { 
    if (!window.confirm("⚠️ ¿Eliminar permanentemente?")) return; 
    try { 
      await apiFetch(`http://127.0.0.1:5000/api/movimientos/${id}/perma`, { method: "DELETE" }); 
      setMovimientos(movimientos.filter(m => m.id !== id)); 
      alert("Registro eliminado."); 
    } catch (e) { 
      alert("Error: " + e.message); 
    } 
  };


  // --- LÓGICA DE IMPRESIÓN ACTUALIZADA ---
  const handlePrint = (m, isPreview) => {
    const pdfData = {
        id: m.id,
        fecha: m.fecha,
        estado: 'Registrado',
        origen: m.deposito,
        destino: m.destino_final || (m.es_local ? 'Mov. Interno' : 'Ruta Externa'), 
        chofer: m.responsable || "Sin Asignar",
        vehiculo: m.vehiculo || "N/A",
        
        // PASAMOS LA LISTA COMPLETA
        items: m.items || [{
            codigo: '-', material: m.material, lote: m.lote, cantidad: m.cantidad, unidad: m.unidad
        }]
    };
    generarValePDF(pdfData, isPreview);
  };

  const handleSubmit = async () => { 
    const emptyStops = stops.filter(s => s.items.length === 0); 
    if(emptyStops.length > 0) return alert(`La parada "${emptyStops[0].nombre}" no tiene carga asignada.`); 
    if (!routeConfig.id_chofer || !routeConfig.id_vehiculo) return alert("Error: Falta asignar Chofer o Vehículo.");
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

  const getCoords = (id) => { 
    const dep = depositos.find(d => String(d.ID_DEPOSITO) === String(id)); 
    return dep && dep.LATITUD ? [dep.LATITUD, dep.LONGITUD] : [-25.2800, -57.6350]; 
  };
  
  const getRoutePositions = () => { 
    const start = getCoords(routeConfig.id_origen); 
    const waypoints = stops.map(s => [s.lat, s.lng]).filter(c => c[0]); 
    return [start, ...waypoints]; 
  };

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

  const handleNextStep1 = () => {
    if(!routeConfig.id_origen) return alert("Selecciona el Depósito de Origen.");
    if(!routeConfig.id_chofer) return alert("Debes seleccionar un Chofer.");
    if(!routeConfig.id_vehiculo) return alert("Debes seleccionar un Vehículo.");
    setStep(2);
  };

  // ---------------- RENDER ----------------
  return (
    <div className="movimientos-container">
      <div className="movimientos-content">
        <div className="page-header">
            <div>
                <h1>Gestión de Movimientos</h1>
                <p className="subtitle">Planificación de traslados y atención de pedidos.</p>
                {!puedeGestionarMovimientos() && puedeVerPedidos() && (
                  <small className="text-gray-500">Modo solo lectura - Solo puedes ver pedidos</small>
                )}
            </div>
            {puedeCrearRutas() && (
                <button className="btn-new" onClick={() => setShowWizard(true)}>
                    <Plus size={18}/> Nueva Ruta
                </button>
            )}
        </div>

        {/* TABS */}
        <div className="tabs-header">
            <button onClick={() => setActiveTab("movimientos")} className={`tab-btn ${activeTab === "movimientos" ? "active-blue" : ""}`}>
                <List size={18} /> Historial
            </button>
            {puedeVerPedidos() && (
                <button onClick={() => setActiveTab("pedidos")} className={`tab-btn ${activeTab === "pedidos" ? "active-yellow" : ""}`}>
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
                    <input type="text" placeholder="Buscar por material, chofer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <button className={`btn-filter ${showFilters ? "active" : ""}`} onClick={() => setShowFilters(!showFilters)} style={{ backgroundColor: showFilters ? "#e0e7ff" : "", color: showFilters ? "#4338ca" : "" }}>
                    <Filter size={18} /> Filtros
                  </button>
                  {showFilters && (
                    <div className="filters-dropdown fade-in">
                      <div className="filter-group">
                        <label>Tipo de Movimiento</label>
                        <div className="filter-chips">
                          {["todos", "rutas", "interno"].map(tipo => (
                            <button key={tipo} className={`chip ${filtro === tipo ? "active" : ''}`} onClick={() => setFiltro(tipo)}>
                              {tipo === "todos" ? "Todos" : tipo === "rutas" ? "Rutas" : "Interno"}
                              {filtro === tipo && <Check size={12}/>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="filter-footer">
                        <button className="btn-text-only" onClick={() => { setFiltro("todos"); setSearchTerm(""); }}>Limpiar filtros</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="table-responsive">
                    <table className="historial-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo</th>
                                <th>Material / Carga</th>
                                <th>Responsable</th>
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
                                    </td>
                                    <td>
                                        {/* LÓGICA DE VISUALIZACIÓN AGRUPADA */}
                                        {m.items && m.items.length > 1 ? (
                                            <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                                                <span className="badge-estado" style={{background:'#e0f2fe', color:'#0369a1', border:'1px solid #bae6fd', width:'fit-content', display:'flex', alignItems:'center', gap:'5px'}}>
                                                    <Layers size={14}/> {m.items.length} Items Variados
                                                </span>
                                                <small className="text-gray-400">Ver PDF para detalles</small>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="font-semibold">{m.material}</span>
                                                <br/>
                                                <span className="ml-0 font-bold text-gray-800">
                                                    {m.cantidad} {m.unidad}
                                                </span>
                                                <small className="bg-gray-100 px-1 rounded text-gray-500 ml-2">
                                                    Lote: {m.lote}
                                                </small>
                                            </>
                                        )}
                                    </td>
                                    <td>
                                        {m.responsable && m.responsable !== "Sin Asignar" ? (
                                            <div className="flex items-center gap-2">
                                                {m.es_local ? <ClipboardList size={16} color="#4b5563"/> : <Truck size={16} color="#4b5563"/>}
                                                <div className="text-sm">
                                                    <strong>{m.responsable}</strong>
                                                    {!m.es_local && <div className="text-gray-400 text-xs">{m.vehiculo}</div>}
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
                                            <button className="btn-action secondary btn-icon-only" onClick={() => handlePrint(m, true)} title="Previsualizar PDF">
                                                <Eye size={16}/>
                                            </button>
                                            <button className="btn-print btn-icon-only" onClick={() => handlePrint(m, false)} title="Descargar PDF">
                                                <Printer size={16}/>
                                            </button>
                                            {puedeGestionarMovimientos() && (userRole === "Master_Admin" || userPermissions.includes("eliminar_movimientos")) && (
                                                <button className="btn-action danger btn-small" onClick={() => handleDeletePerma(m.id)} title="Eliminar">
                                                    <Trash2 size={16}/>
                                                </button>
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

{/* WIZARD (Actualizado con persistencia y botón de cierre) */}
        {showWizard && ( 
            <div className="modal-backdrop">
                {/* Agregamos 'relative' aquí para posicionar la X absoluta respecto a esta tarjeta */}
                <div className="discord-card modal-wizard relative" style={{ width: '95%', maxWidth: '1400px', height: '90vh', display: 'flex', flexDirection: 'column' }}>
                    
                    {/* --- NUEVO BOTÓN DE CERRAR (X) --- */}
                    <button 
                        onClick={() => setShowWizard(false)} 
                        className="cerrar-newruta"
                        title="Cerrar y guardar progreso"
                    >
                        <X size={24} />
                    </button>
                    {/* ---------------------------------- */}

                    <div className="wizard-header pr-12"> {/* pr-12 para que el texto no se monte sobre la X */}
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
                            <div className="fade-in wizard-step-3">
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
                                                    <div className="flex-1 ">
                                                      <label>Cantidad</label>

                                                      <div className="qty-input-wrapper">
                                                        <input
                                                          type="number"
                                                          className="cantidad-input"
                                                          value={itemTemp.cantidad}
                                                          onChange={e => setItemTemp({ ...itemTemp, cantidad: e.target.value })}
                                                        />
                                                        <span className="qty-unit"> {materiales.find(m => String(m.ID_MATERIAL) === String(itemTemp.id_material))?.UNIDAD || "Unid."}</span>
                                                      </div>
                                                    </div>
                                                    <button className="btn-icon-simple success" onClick={addItemToStop} type="button"><Plus size={18}/></button>
                                                </div>
                                                <div className="load-list">
                                                        {stops[editingStopIndex].items.map((it, i) => (
                                                          <div key={i} className="load-list-item flex justify-between items-center">
                                                            <span>{it.nombre} ({it.cantidad} {it.UNIDAD})</span>
                                                            <button className="btn-icon-simple danger" onClick={() => removeItemFromStop(editingStopIndex, i)} type="button">
                                                              <Trash2 size={12}/>
                                                            </button>
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
                        {/* NOTA: El botón 'Atrás' en step 1 ahora solo oculta el modal sin borrar, igual que la X */}
                        <button className="btn-status" type="button" onClick={()=>{if(step>1) setStep(step-1); else setShowWizard(false)}}>{step===1?"Cerrar":"Atrás"}</button>
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

        {/* COMPONENTES SECUNDARIOS */}
        {activeTab === "pedidos" && puedeVerPedidos() && (
          <div className="fade-in">
            <HistorialPedidos onAtenderPedido={handleAtenderPedido} />
          </div>
        )}
        
      </div>
    </div>
  );
};

export default Movimientos;