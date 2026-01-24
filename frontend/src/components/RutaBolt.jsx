// src/components/RutaBolt.jsx
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

/**
 * RutaBolt PRO
 * - Dibuja SOLO la polyline (estilo Bolt)
 * - NO muestra panel, NO muestra itinerario, NO muestra tooltips raros
 * - Cleanup robusto en cada cambio
 *
 * Props:
 *  - origen: { lat, lng }
 *  - destino: { lat, lng }
 */
export default function RutaBolt({ origen, destino }) {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!map || !origen || !destino) return;

    // Limpieza previa (por si React re-renderiza)
    if (routingRef.current) {
      try { map.removeControl(routingRef.current); } catch {}
      routingRef.current = null;
    }

    // Contenedor "fake" fuera de la UI para que LRM no inserte panel dentro del mapa
    const hiddenContainer = L.DomUtil.create("div");
    hiddenContainer.style.display = "none";

    const control = L.Routing.control({
      waypoints: [L.latLng(origen.lat, origen.lng), L.latLng(destino.lat, destino.lng)],

      router: L.Routing.mapbox(
        "pk.eyJ1IjoiZW1hMzM1IiwiYSI6ImNta212dDUyajBrc3MzY3BzbWVhZjZ6Z3QifQ.cBlelICbwHkD0eWcd4PWdA"
      ),

      // Solo una ruta
      showAlternatives: false,

      // No tocar waypoints
      addWaypoints: false,
      draggableWaypoints: false,
      routeWhileDragging: false,

      // No markers
      createMarker: () => null,

      // No zoom automático
      fitSelectedRoutes: false,

      // Línea
      lineOptions: {
        styles: [{ color: "#005bea", opacity: 0.85, weight: 6 }],
        addWaypoints: false,
      },

      // SUPER CLAVE: ocultar UI
      show: false,
      collapsible: true,
      container: hiddenContainer,
    });

    // SUPER CLAVE: bloquear eventos para que no “ensucie” el mapa
    // (evita overlays / tooltips en algunas versiones)
    control.on("routeselected", () => {});

    control.addTo(map);
    routingRef.current = control;

    return () => {
      if (routingRef.current) {
        try { map.removeControl(routingRef.current); } catch {}
        routingRef.current = null;
      }
    };
  }, [map, origen?.lat, origen?.lng, destino?.lat, destino?.lng]);

  return null;
}
