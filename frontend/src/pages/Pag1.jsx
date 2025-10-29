// Pag1.jsx
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/Pag1.css";
import io from "socket.io-client"; 
import { apiFetch } from "../utils/api"; // <--- CAMBIO: Importar apiFetch

// (Configuración de iconos Leaflet sin cambios)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BACKEND_URL = "http://127.0.0.1:5000";

export default function Pag1() {
  const [vehiculos, setVehiculos] = useState({});
  const [mapCenter, setMapCenter] = useState([-25.2637, -57.5759]);
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef();

  useEffect(() => {
    async function fetchActiveVehicles() {
      try {
        // <--- CAMBIO: Usar apiFetch en lugar de fetch --->
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
        // apiFetch ya maneja el 401, esto es para otros errores
        console.error("Error cargando vehículos:", error.message);
        setLoaded(true); 
      }
    }

    fetchActiveVehicles();

    // <--- CAMBIO: Conectar Socket.IO con el token --->
    // El backend de Socket.IO no está protegido por JWT, 
    // pero es buena práctica pasar el token si se quisiera proteger.
    const socket = io(BACKEND_URL, {
      auth: {
        token: localStorage.getItem("access_token")
      }
    });

    socket.on("position_update", (data) => {
      console.log("Socket update:", data);
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

    return () => {
      socket.disconnect();
    };
  }, []); 

  // (useEffect de resize sin cambios)
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

  if (!loaded) {
    return (
      <div className="loading-map">
        <div className="spinner"></div>
        <p>Cargando mapa y vehículos...</p>
      </div>
    );
  }

  return (
    // (JSX del MapContainer y Markers sin cambios)
    <div className="map-page">
      <MapContainer
        ref={mapRef}
        center={mapCenter} 
        zoom={13}
        scrollWheelZoom={true}
        className="leaflet-map-container"
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
    </div>
  );
}