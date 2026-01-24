import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/Mapa.css"; 
import io from "socket.io-client"; 
import { apiFetch } from "../utils/api";
import { Truck, Home as HomeIcon, HelpCircle, Settings, Map as MapIcon, User, Radio, ChevronDown, Filter, Menu, X} from "lucide-react"; 
import iconoDepositoImg from '../assets/deposit_icon.png';
import RutaBolt from "../components/RutaBolt"; 

const BACKEND_URL = "http://127.0.0.1:5000";

// --- CONFIGURACIÓN DE ICONOS ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const depositoIcon = new L.Icon({
  iconUrl: iconoDepositoImg,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
  className: 'mi-icono-deposito'
});

// --- GENERAR RELLENO (SIMULACIÓN) ---
const generarVehiculosFicticios = (cantidad = 5) => {
    const vehiculosFake = [];
    const baseLat = -25.2968; 
    const baseLng = -57.6046;

    for (let i = 1; i <= cantidad; i++) {
        const latOffset = (Math.random() - 0.5) * 0.10; 
        const lngOffset = (Math.random() - 0.5) * 0.10;
        vehiculosFake.push({
            id: `SIM-${i}`, 
            nombre: `Móvil Apoyo ${i}`,
            conductor: `Simulado ${i}`,
            estado: "En Ruta",
            colorEstado: "#3b82f6", // Color azul para los simulados
            lat: baseLat + latOffset,
            lng: baseLng + lngOffset,
            esSimulado: true, 
            esRaspberry: false
        });
    }
    return vehiculosFake;
};

// Componente Zoom
function MapController({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom, { duration: 1.5 });
        }
    }, [center, zoom, map]);
    return null;
}

export default function Mapa() { 
  const [vehiculos, setVehiculos] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [rutasChofer, setRutasChofer] = useState([]); 
  const userRole = sessionStorage.getItem("user_rol"); 

  const [viewState, setViewState] = useState({ center: [-23.442503, -58.443832], zoom: 6 });
  const [deptoSeleccionado, setDeptoSeleccionado] = useState("TODOS");
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const roleLower = (userRole || "").toLowerCase();
  const esAdminMapa = ["admin", "master_admin"].includes(roleLower);
  const [setTraza] = useState(null);
  const [historialRutas, setHistorialRutas] = useState([]);
  const [rutaSeleccionada, setRutaSeleccionada] = useState(null);
  const [trazaSeleccionada] = useState(null);


  // --- CARGA DE DATOS ---
  useEffect(() => {
    async function fetchData() {
      try {
            let dataVehiculos = [];
            let dataDepositos = [];

            try {
              dataVehiculos = await apiFetch(`${BACKEND_URL}/api/vehicles/active`);
            } catch (e) {
              console.error("Falló vehicles", e);
            }

            try {
              dataDepositos = await apiFetch(`${BACKEND_URL}/api/depositos`);
            } catch (e) {
              console.error("Falló depositos", e);
            }


        let flotaCombinada = [];

        // 1. VEHÍCULOS REALES (Backend con DB Híbrida)
        if (dataVehiculos && dataVehiculos.length > 0) {
          const reales = dataVehiculos.map(v => ({
            id: v.ID_VEHICULO, 
            nombre: v.MATRICULA || `Móvil ${v.ID_VEHICULO}`, 
            conductor: v.NOMBRE_CHOFER || "Sin asignar", 
            
            // --- NUEVO: Usamos datos dinámicos de la BD ---
            estado: v.ESTADO || "Desconocido", 
            colorEstado: v.COLOR_ESTADO || "#808080", 
            // ----------------------------------------------

            lat: v.LATITUD, 
            lng: v.LONGITUD,
            esSimulado: false,
            esRaspberry: v.ID_VEHICULO === 3 
          }));
          flotaCombinada = [...flotaCombinada, ...reales];
        }
        // 2. VEHÍCULOS DE RELLENO
        const ficticios = generarVehiculosFicticios(5); 
        flotaCombinada = [...flotaCombinada, ...ficticios];

        setVehiculos(flotaCombinada);
        setDepositos(dataDepositos || []);

        // 3. CARGAR RUTAS SI ES CHOFER
        if (userRole === "Chofer") {
            try {
                const dataRutas = await apiFetch(`${BACKEND_URL}/api/chofer/mi_ruta`);
                if (dataRutas) {
                    setRutasChofer(dataRutas);
                    if (dataRutas.length > 0 && dataRutas[0].puntos.length > 0) {
                        setViewState({ 
                            center: [dataRutas[0].puntos[0].lat, dataRutas[0].puntos[0].lng], 
                            zoom: 13 
                        });
                    }
                }
            } catch (err) {
                console.warn("No se pudieron cargar las rutas del chofer", err);
            }
        if (esAdminMapa) {
          try {
            const h = await apiFetch(`${BACKEND_URL}/api/rutas/historial`);
            setHistorialRutas(h || []);
          } catch(e) {
            console.warn("No se pudo cargar historial rutas", e);
          }
        }
        }
        setLoaded(true);
      } catch (error) {
        console.error("Error:", error);
        setVehiculos(generarVehiculosFicticios(6));
        setLoaded(true);
      }
    }
    fetchData();


    // SOCKET IO
    const socket = io(BACKEND_URL, { auth: { token: sessionStorage.getItem("access_token") } });
    socket.on("position_update", (data) => {
      setVehiculos(prev => prev.map(v => {
        if (v.id === data.ID_VEHICULO) {
          return { ...v, lat: data.LATITUD, lng: data.LONGITUD };
        }
        return v;
      }));
    });
    return () => { socket.disconnect(); };
  }, [userRole]);

  // --- FILTROS ---
  const departamentos = useMemo(() => {
      const deptos = new Set(depositos.map(d => d.DEPARTAMENTO || "Sin asignar"));
      return Array.from(deptos).sort();
  }, [depositos]);

  const depositosFiltrados = useMemo(() => {
      if (deptoSeleccionado === "TODOS") return depositos;
      return depositos.filter(d => d.DEPARTAMENTO === deptoSeleccionado);
  }, [depositos, deptoSeleccionado]);

  // --- HANDLERS ---
  const seleccionarRutaHistorial = async (grupo) => {
  setRutaSeleccionada(grupo);
  try {
    const data = await apiFetch(`${BACKEND_URL}/api/rutas/historial/${grupo}/traza`);
    setTraza(data);
  } catch (e) {
    console.warn("No se pudo cargar traza", e);
    setTraza(null);
  }
};

  const handleCambioDepartamento = (e) => {
      const depto = e.target.value;
      setDeptoSeleccionado(depto);
      
      if (depto === "TODOS") {
          setViewState({ center: [-23.442503, -58.443832], zoom: 6 });
      } else {
          const deps = depositos.filter(d => d.DEPARTAMENTO === depto);
          if (deps.length > 0) {
              const latAvg = deps.reduce((s, d) => s + d.LATITUD, 0) / deps.length;
              const lngAvg = deps.reduce((s, d) => s + d.LONGITUD, 0) / deps.length;
              setViewState({ center: [latAvg, lngAvg], zoom: 10 });
          }
      }
  };

  const handleSelectVehiculo = (v) => {
      setVehiculoSeleccionado(v);
      setViewState({ center: [v.lat, v.lng], zoom: 15 });
  };

return (
    <div className="mapa-layout-container">
      
{/* =========================================
    CONTROLES FLOTANTES (MISMA CAPA DEL BOTÓN MENÚ)
    - Solo se muestran cuando el sidebar está CERRADO
    - Cuando el sidebar se abre, quedan TAPADOS (no renderizan)
   ========================================= */}
{!sidebarOpen && (
  <div className="floating-controls">
    {/* Botón abrir menú */}
    <button
      className="sidebar-toggle-btn"
      onClick={() => setSidebarOpen(true)}
      title="Abrir Menú"
    >
      <Menu size={24} />
    </button>

    {/* Accesos rápidos (1 = Orden de trabajo, 2 = Gastos) */}
    <div className="fab-stack">
      <button
        className="fab-btn"
        title="Orden de Trabajo"
        onClick={() => (window.location.href = "/ordenes-trabajo")}
      >
        Orden
      </button>

      <button
        className="fab-btn"
        title="Gastos / Viáticos"
        onClick={() => (window.location.href = "/gastos")}
      >
        Gasto
      </button>
    </div>
  </div>
)}

      {/* --- SIDEBAR IZQUIERDA (CONTENEDOR ÚNICO) --- */}
      {/* Aquí aplicamos la lógica: si sidebarOpen es false, agregamos la clase 'closed' */}
      <div className={`mapa-sidebar ${sidebarOpen ? '' : 'closed'}`}>
        
        <div className="mapa-sidebar-header">
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
             <Truck size={22} color="#2563eb" />
             <h3>Monitor Logístico</h3>
          </div>

          {/* Botón X para cerrar */}
          <button 
            className="close-btn-sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* FILTRO DE ZONA */}
        <div className="sidebar-section">
            <h4 className="section-title"><MapIcon size={14}/> Filtrar Zona</h4>
            
            <div className="custom-select-wrapper">
                <Filter size={16} className="select-icon" />
                <select 
                    className="modern-select" 
                    value={deptoSeleccionado} 
                    onChange={handleCambioDepartamento}
                >
                    <option value="TODOS">Todas las zonas (Nacional)</option>
                    {departamentos.map(dep => (
                        <option key={dep} value={dep}>
                            {dep} ({depositos.filter(d => d.DEPARTAMENTO === dep).length} deps.)
                        </option>
                    ))}
                </select>
                <ChevronDown size={16} className="select-arrow" />
            </div>
        </div>

        {/* LISTA DE VEHÍCULOS */}
        <div className="sidebar-section list-section">
            <div className="table-header-container"> {/* Si tienes estilo para esto, sino quítalo */}
                <h4 className="section-title" style={{marginTop:0}}>
                    Flota Activa <span style={{marginLeft:6, background:'#e2e8f0', padding:'2px 6px', borderRadius:10, fontSize:10}}>{vehiculos.length}</span>
                </h4>
            </div>
            
            <div className="vehiculos-list-modern">
                {vehiculos.length === 0 ? (
                    <div className="no-data-card">Buscando señal satelital...</div>
                ) : (
                    vehiculos.map((v) => (
                        <div 
                            key={v.id} 
                            className={`vehiculo-card ${vehiculoSeleccionado?.id === v.id ? 'selected' : ''} ${v.esRaspberry ? 'is-raspberry' : ''}`}
                            onClick={() => handleSelectVehiculo(v)}
                        >
                            {/* Icono */}
                            <div className="card-icon">
                                {v.esRaspberry ? <Radio size={18} /> : <Truck size={18} />}
                                {v.esRaspberry && <span className="pulse-indicator"></span>}
                            </div>

                            {/* Info */}
                            <div className="card-info">
                                <span className="card-title">{v.nombre}</span>
                                <div className="card-subtitle">
                                    <User size={12} style={{marginRight:4}}/>
                                    {v.esRaspberry ? "Rastreo Satelital" : v.conductor}
                                </div>
                            </div>
              {esAdminMapa && (
                <div className="sidebar-section list-section">
                  <h4 className="section-title">Historial de Recorridos</h4>

                  {historialRutas.length === 0 ? (
                    <div className="no-data-card">No hay recorridos finalizados.</div>
                  ) : (
                    <div className="vehiculos-list-modern">
                      {historialRutas.map(r => (
                        <div
                          key={r.grupo_ruta}
                          className={`vehiculo-card ${rutaSeleccionada === r.grupo_ruta ? "selected" : ""}`}
                          onClick={() => seleccionarRutaHistorial(r.grupo_ruta)}
                        >
                          <div className="card-info">
                            <span className="card-title">{r.grupo_ruta}</span>
                            <div className="card-subtitle">
                              {r.inicio} → {r.fin}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

                            {/* ESTADO */}
                            <div className="card-status">
                                {v.esRaspberry ? (
                                    <span className="status-badge online">ONLINE</span>
                                ) : (
                                    <span 
                                        className="status-badge" 
                                        style={{
                                            backgroundColor: `${v.colorEstado}20`,
                                            color: v.colorEstado,
                                            border: `1px solid ${v.colorEstado}`,
                                            fontSize: '10px',
                                            fontWeight: 600
                                        }}
                                    >
                                        {v.estado}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
        
        {/* Menú Inferior */}
        <div className="mapa-menu-inferior">
          <button className="menu-btn" onClick={() => window.location.href = "/home"}>
            <HomeIcon size={18} /> <span>Home</span>
          </button>
          <button className="menu-btn" onClick={() => window.location.href = "/config"}>
            <Settings size={18} /> <span>Config</span>
          </button>
          <button className="menu-btn">
            <HelpCircle size={18} /> <span>Ayuda</span>
          </button>
        </div>
      </div>


      {/* --- MAPA DE FONDO --- */}
      <div className="content-dashboard-map">
        {!loaded ? (
          <div className="loading-map"><div className="spinner"></div><p>Cargando...</p></div>
        ) : (
          <MapContainer
            center={viewState.center}
            zoom={viewState.zoom}
            className="leaflet-map-container"
            zoomControl={false} // Desactivamos el zoom por defecto para moverlo si queremos, o déjalo true y usa CSS
          >
            {/* Si quieres mover el zoom de lugar con react-leaflet es más complejo, 
                pero con el CSS que te di (.leaflet-top) ya debería bajarse solo */}
            <MapController center={viewState.center} zoom={viewState.zoom} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            
            {/* Rutas */}
            {rutasChofer.map((ruta) => (
               ruta.puntos && ruta.puntos.length >= 2 ? 
               <RutaBolt key={ruta.id_grupo} origen={ruta.puntos[0]} destino={ruta.puntos[1]} /> : null
            ))}
            {trazaSeleccionada && (
              <Polyline
                positions={(
                  (trazaSeleccionada.gps_points && trazaSeleccionada.gps_points.length > 1)
                    ? trazaSeleccionada.gps_points
                    : trazaSeleccionada.planned_points
                ).map(p => [p.lat, p.lng])}
              />
            )}
            {/* Marcadores Depósitos */}
            {depositosFiltrados.map((dep) => (
              <Marker key={`dep-${dep.ID_DEPOSITO}`} position={[dep.LATITUD, dep.LONGITUD]} icon={depositoIcon}>
                <Popup>
                    <strong>🏭 {dep.NOMBRE}</strong><br/>
                    <span className="badge-depto-popup">{dep.DEPARTAMENTO}</span>
                </Popup>
              </Marker>
            ))}

            {/* Marcadores Vehículos */}
            {vehiculos.map((v) => v.lat && v.lng && (
              <Marker 
                key={`veh-${v.id}`} 
                position={[v.lat, v.lng]} 
                opacity={v.esRaspberry ? 1 : 0.7}
                zIndexOffset={v.esRaspberry ? 1000 : 0} 
              >
                <Popup>
                    <strong>{v.esRaspberry ? "📡 " : "🚗 "}{v.nombre}</strong><br />
                    {v.esRaspberry ? 
                        <span style={{color: 'green', fontWeight:'bold'}}>En vivo</span> : 
                        <span style={{color: v.colorEstado}}>{v.estado}</span>
                    }
                </Popup>
              </Marker>
              
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}