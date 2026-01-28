// src/components/RutaBolt.jsx
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

/**
 * RutaBolt PRO (multi-waypoint)
 * - waypoints: [{lat,lng}, ...]  (>=2)
 * - Si no se pasa waypoints, usa origen/destino como antes.
 */
export default function RutaBolt({ origen, destino, waypoints = [] }) {
  const map = useMap();
  const routingRef = useRef(null);

  const MAPBOX_TOKEN =
    "pk.eyJ1IjoiZW1hMzM1IiwiYSI6ImNta212dDUyajBrc3MzY3BzbWVhZjZ6Z3QifQ.cBlelICbwHkD0eWcd4PWdA";

  useEffect(() => {
    if (!map) return;

    // resolver puntos finales
    let pts = waypoints?.length >= 2 ? waypoints : (origen && destino ? [origen, destino] : []);
    pts = pts.filter(p => p?.lat != null && p?.lng != null);

    if (pts.length < 2) return;

    // limpiar anterior
    if (routingRef.current) {
      try { map.removeControl(routingRef.current); } catch {}
      routingRef.current = null;
    }

    const hiddenContainer = L.DomUtil.create("div");
    hiddenContainer.style.display = "none";

    const control = L.Routing.control({
      waypoints: pts.map(p => L.latLng(p.lat, p.lng)),
      router: L.Routing.mapbox(MAPBOX_TOKEN),

      showAlternatives: false,
      addWaypoints: false,
      draggableWaypoints: false,
      routeWhileDragging: false,
      createMarker: () => null,
      fitSelectedRoutes: false,

      lineOptions: {
        styles: [{ color: "#005bea", opacity: 0.85, weight: 6 }],
        addWaypoints: false,
      },

      show: false,
      collapsible: true,
      container: hiddenContainer,
    });

    control.addTo(map);
    routingRef.current = control;

    return () => {
      if (routingRef.current) {
        try { map.removeControl(routingRef.current); } catch {}
        routingRef.current = null;
      }
    };
  }, [
    map,
    // dependencia “estable” para que se actualice cuando cambia la ruta
    JSON.stringify((waypoints?.length >= 2 ? waypoints : origen && destino ? [origen, destino] : []).map(p => [p?.lat, p?.lng]))
  ]);

  return null;
}
