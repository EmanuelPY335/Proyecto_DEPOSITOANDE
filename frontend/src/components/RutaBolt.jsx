import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";

const RutaBolt = ({ origen, destino }) => {
  const map = useMap();

  useEffect(() => {
    // Si el mapa no está listo o faltan puntos, no hacemos nada
    if (!map || !origen || !destino) return;

    // Crear el control de enrutamiento
    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(origen.lat, origen.lng),
        L.latLng(destino.lat, destino.lng)
      ],
      
      // --- TU TOKEN DE MAPBOX YA CONFIGURADO ---
      router: L.Routing.mapbox('pk.eyJ1IjoiZW1hMzM1IiwiYSI6ImNta212dDUyajBrc3MzY3BzbWVhZjZ6Z3QifQ.cBlelICbwHkD0eWcd4PWdA'),
      
      // ESTILO BOLT: Línea azul (#005bea), gruesa (6px) y sólida
      lineOptions: {
        styles: [{ color: "#005bea", opacity: 0.8, weight: 6 }]
      },
      
      // CONFIGURACIÓN "LIMPIA" (Para que parezca app nativa)
      createMarker: function() { return null; }, // No crea marcadores automáticos (ya tienes los tuyos)
      addWaypoints: false,       // El usuario no puede arrastrar la ruta
      draggableWaypoints: false, 
      fitSelectedRoutes: false,  // Evita que el mapa haga zoom loco automáticamente
      showAlternatives: false,   // Solo muestra la ruta más rápida
      containerClassName: 'routing-hidden' // Clase para ocultar la caja de texto
    }).addTo(map);

    // Limpieza: Borrar la ruta si el componente se desmonta o cambian los puntos
    return () => {
      try {
        map.removeControl(routingControl);
      } catch (e) {
        console.warn("Limpiando ruta anterior...", e);
      }
    };
  }, [map, origen, destino]);

  return null;
};

export default RutaBolt;