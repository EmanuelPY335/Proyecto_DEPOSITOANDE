import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/Pag1.css";

// Configurar iconos de Leaflet (FIX para iconos)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function Pag1() {
  const [position, setPosition] = useState([-25.2637, -57.5759]); // Asunción por defecto
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef();

  useEffect(() => {
    // Ubicación por defecto (Asunción) si la geolocalización falla
    const defaultPosition = [-25.2637, -57.5759];
    
    if (!navigator.geolocation) {
      setPosition(defaultPosition);
      setLoaded(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setLoaded(true);
      },
      (err) => {
        console.error("Error geolocalización:", err);
        setPosition(defaultPosition);
        setLoaded(true);
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000, // 10 segundos máximo
        maximumAge: 60000 // 1 minuto de cache
      }
    );
  }, []);

  // Forzar redimensionado del mapa cuando se carga
  useEffect(() => {
    if (loaded && mapRef.current) {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
  }, [loaded]);

  if (!loaded) {
    return (
      <div className="loading-map">
        <div className="spinner"></div>
        <p>Cargando mapa...</p>
      </div>
    );
  }

  return (
    <div className="map-page">
      <MapContainer
        ref={mapRef}
        center={position}
        zoom={13}
        scrollWheelZoom={true}
        className="leaflet-map-container"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={position}>
          <Popup>
            <strong>Tu ubicación actual</strong>
            <br />
            Lat: {position[0].toFixed(4)}, Lng: {position[1].toFixed(4)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}