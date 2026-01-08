// src/pages/Mapa.jsx
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet"; // <--- Importamos Polyline
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/Mapa.css"; 
import io from "socket.io-client"; 
import { apiFetch } from "../utils/api";
import { Link } from "react-router-dom";
import { Settings, Bell, UserCircle } from "lucide-react";
import "../styles/Home.css"; 
import iconoDepositoImg from '../assets/deposit_icon.png';
import MapSidebar from "../components/MapSidebar"; 

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
});

const DashboardNavbar = () => {
  const [userName] = useState(sessionStorage.getItem("user_nombre") || "Usuario");
  return (
    <nav className="navbar-dashboard">
      <div className="navbar-left">
        <Settings size={24} className="navbar-logo-icon" />
        <span className="navbar-brand-title">SISDEPO</span>
      </div>
      <div className="navbar-right">
        <div className="notification-icon-wrapper"><Bell size={20} /></div>
        <Link to="/profile" className="navbar-profile-link">
          <UserCircle size={28} className="profile-icon" />
          <span className="profile-name">{userName}</span>
        </Link>
      </div>
    </nav>
  );
};

export default function Mapa() { 
  const [vehiculos, setVehiculos] = useState({});
  const [depositos, setDepositos] = useState([]);
  const [rutasChofer, setRutasChofer] = useState([]); // <--- NUEVO ESTADO PARA RUTA
  const [mapCenter, setMapCenter] = useState([-25.2637, -57.5759]);
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef();

  // Obtenemos rol para saber si cargar rutas
  const userRole = sessionStorage.getItem("user_rol");

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Cargar Vehículos
        const dataVehiculos = await apiFetch(`${BACKEND_URL}/api/vehicles/active`);
        const vehiculosPorId = (dataVehiculos || []).reduce((acc, vehiculo) => {
          acc[vehiculo.ID_VEHICULO] = vehiculo;
          return acc;
        }, {});
        setVehiculos(vehiculosPorId);

        // 2. Cargar Depósitos
        const dataDepositos = await apiFetch(`${BACKEND_URL}/api/depositos`);
        setDepositos(dataDepositos || []);

        // 3. SI ES CHOFER, CARGAR SU RUTA ASIGNADA
        if (userRole === "Chofer") {
            const dataRutas = await apiFetch(`${BACKEND_URL}/api/chofer/mi_ruta`);
            setRutasChofer(dataRutas || []);
            
            // Si tiene ruta, centramos el mapa en el origen de la primera ruta
            if (dataRutas && dataRutas.length > 0 && dataRutas[0].puntos.length > 0) {
                const p = dataRutas[0].puntos[0];
                setMapCenter([p.lat, p.lng]);
            }
        }

        setLoaded(true);
      } catch (error) {
        console.error("Error cargando datos:", error.message);
        setLoaded(true); 
      }
    }
    fetchData();

    // Socket.IO para GPS en tiempo real
    const socket = io(BACKEND_URL, {
      auth: { token: sessionStorage.getItem("access_token") }
    });

    socket.on("position_update", (data) => {
      setVehiculos(prev => ({
        ...prev,
        [data.ID_VEHICULO]: {
          ...prev[data.ID_VEHICULO], 
          ID_VEHICULO: data.ID_VEHICULO,
          LATITUD: data.LATITUD,
          LONGITUD: data.LONGITUD,
          last_update: data.timestamp
        }
      }));
    });

    return () => { socket.disconnect(); };
  }, [userRole]); 

  // Fix renderizado
  useEffect(() => {
    if (loaded && mapRef.current) {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 100);
    }
  }, [loaded, mapCenter]);

  return (
    <div className="dashboard-layout">
      <DashboardNavbar />
      <div className="main-area">
        <MapSidebar />
        
        <div className="content-dashboard-map">
          {!loaded && <div className="loading-map"><div className="spinner"></div><p>Cargando mapa...</p></div>}

          {loaded && (
            <MapContainer
              ref={mapRef}
              center={mapCenter} 
              zoom={13}
              scrollWheelZoom={true}
              className="leaflet-map-container"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
              
              {/* DIBUJAR RUTA DEL CHOFER (LÍNEA AZUL) */}
              {rutasChofer.map((ruta) => (
                  <Polyline 
                    key={ruta.id_grupo}
                    positions={ruta.puntos.map(p => [p.lat, p.lng])}
                    color="#3b82f6" // Azul brillante
                    weight={5}
                    dashArray="10, 10" // Línea punteada estilo Bolt/Uber
                  />
              ))}

              {/* MARCADORES DE DEPÓSITOS */}
              {depositos.map((dep) => (
                <Marker
                    key={`dep-${dep.ID_DEPOSITO}`}
                    position={[dep.LATITUD, dep.LONGITUD]}
                    icon={depositoIcon}
                >
                    <Popup>
                        <strong>🏭 {dep.NOMBRE}</strong><br/>
                        <span style={{ fontSize: "0.9em" }}>{dep.DIRECCION}</span>
                    </Popup>
                </Marker>
              ))}

              {/* MARCADORES DE VEHÍCULOS (GPS) */}
              {Object.values(vehiculos).map((v) => (
                (v.LATITUD && v.LONGITUD) && (
                  <Marker key={`veh-${v.ID_VEHICULO}`} position={[v.LATITUD, v.LONGITUD]}>
                    <Popup>
                      <strong>🚗 {v.MATRICULA}</strong><br />
                      <small>ID: {v.ID_VEHICULO}</small>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  );
}