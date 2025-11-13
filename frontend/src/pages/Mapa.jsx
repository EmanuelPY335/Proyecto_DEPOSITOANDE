

// --- Imports Estándar del Mapa ---
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/Mapa.css"; // Estilos del mapa
import io from "socket.io-client"; 
import { apiFetch } from "../utils/api";

// --- Imports para el Layout ---
import { Link } from "react-router-dom";
import { Settings, Bell, UserCircle } from "lucide-react";
import "../styles/Home.css"; // Reutilizamos estilos de layout, navbar y sidebar
import MapSidebar from "../components/MapSidebar"; // <--- TU NUEVO SIDEBAR

// (Configuración de iconos Leaflet sin cambios)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BACKEND_URL = "http://127.0.0.1:5000";

// --- Componente Navbar (Copiado de Layout.jsx) ---
const DashboardNavbar = () => {
  const [userName] = useState(sessionStorage.getItem("user_nombre") || "Usuario");
  const notificationCount = 0;

  return (
    <nav className="navbar-dashboard">
      <div className="navbar-left">
        <Settings size={24} className="navbar-logo-icon" />
        <span className="navbar-brand-title">SISDEPO</span>
      </div>
      <div className="navbar-right">
        <div className="notification-icon-wrapper">
          <Bell size={20} />
          {notificationCount > 0 && (
            <span className="notification-badge">{notificationCount}</span>
          )}
        </div>
        <Link to="/profile" className="navbar-profile-link">
          <UserCircle size={28} className="profile-icon" />
          <span className="profile-name">{userName}</span>
        </Link>
      </div>
    </nav>
  );
};
// --- Fin del Navbar ---


export default function Pag1() {
  // --- Lógica del Mapa (Sin cambios) ---
  const [vehiculos, setVehiculos] = useState({});
  const [mapCenter, setMapCenter] = useState([-25.2637, -57.5759]);
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef();

  useEffect(() => {
    // (Tu lógica de fetchActiveVehicles y Socket.IO no cambia)
    async function fetchActiveVehicles() {
      try {
        const data = await apiFetch(`${BACKEND_URL}/api/vehicles/active`);
        const vehiculosPorId = data.reduce((acc, vehiculo) => {
          acc[vehiculo.ID_VEHICULO] = vehiculo;
          return acc;
        }, {});
        setVehiculos(vehiculosPorId);
        if (data.length > 0) {
          setMapCenter([data[0].LATITUD, data[0].LONGITUD]);
        }
        setLoaded(true);
      } catch (error) {
        console.error("Error cargando vehículos:", error.message);
        setLoaded(true); 
      }
    }
    fetchActiveVehicles();
    const socket = io(BACKEND_URL, {
      auth: { token: sessionStorage.getItem("access_token") } // <--- Usa sessionStorage
    });
    socket.on("position_update", (data) => {
      setVehiculos(prevVehiculos => ({
        ...prevVehiculos,
        [data.ID_VEHICULO]: {
          ...prevVehiculos[data.ID_VEHICULO], 
          ID_VEHICULO: data.ID_VEHICULO,
          LATITUD: data.LATITUD,
          LONGITUD: data.LONGITUD,
          last_update: data.timestamp
        }
      }));
    });
    return () => { socket.disconnect(); };
  }, []); 

  useEffect(() => {
    if (loaded && mapRef.current) {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    }
  }, [loaded, mapCenter]);
  // --- Fin Lógica del Mapa ---


  // --- Renderizado del Layout ---
  return (
    <div className="dashboard-layout">
      <DashboardNavbar /> {/* Navbar en la parte superior */}
      <div className="main-area">
        <MapSidebar /> {/* Tu Sidebar exclusivo a la izquierda */}
        
        {/* Área de contenido del mapa */}
        <div className="content-dashboard-map"> {/* <--- Usamos una clase nueva */}
          
          {!loaded && (
            <div className="loading-map">
              <div className="spinner"></div>
              <p>Cargando mapa y vehículos...</p>
            </div>
          )}

          {loaded && (
            <MapContainer
              ref={mapRef}
              center={mapCenter} 
              zoom={13}
              scrollWheelZoom={true}
              className="leaflet-map-container" // <--- Esta clase llenará el div
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              
              {Object.values(vehiculos).map((v) => (
                (v.LATITUD && v.LONGITUD) && (
                  <Marker 
                    key={v.ID_VEHICULO} 
                    position={[v.LATITUD, v.LONGITUD]}
                  >
                    <Popup>
                      <strong>Vehículo ID: {v.ID_VEHICULO}</strong><br />
                      Matrícula: {v.MATRICULA || 'N/D'}<br />
                      Marca: {v.MARCA || 'N/D'}<br />
                      Lat: {v.LATITUD.toFixed(4)}, Lng: {v.LONGITUD.toFixed(4)}
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