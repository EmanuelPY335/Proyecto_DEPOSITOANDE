import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/Mapa.css";
import io from "socket.io-client";
import { apiFetch } from "../utils/api";
import {
  Truck,
  Home as HomeIcon,
  HelpCircle,
  Settings,
  Map as MapIcon,
  User,
  Radio,
  ChevronDown,
  Filter,
  Menu,
  X,
} from "lucide-react";
import iconoDepositoImg from "../assets/deposit_icon.png";
import RutaBolt from "../components/RutaBolt";
import RutaPanel from "../components/RutaPanel";

const BACKEND_URL = "http://127.0.0.1:5000";

// --- CONFIGURACIÓN DE ICONOS ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const depositoIcon = new L.Icon({
  iconUrl: iconoDepositoImg,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
  className: "mi-icono-deposito",
});

// --- GENERAR RELLENO (SIMULACIÓN) ---
const generarVehiculosFicticios = (cantidad = 5) => {
  const vehiculosFake = [];
  const baseLat = -25.2968;
  const baseLng = -57.6046;

  for (let i = 1; i <= cantidad; i++) {
    const latOffset = (Math.random() - 0.5) * 0.1;
    const lngOffset = (Math.random() - 0.5) * 0.1;
    vehiculosFake.push({
      id: `SIM-${i}`,
      nombre: `Móvil Apoyo ${i}`,
      conductor: `Simulado ${i}`,
      estado: "En Ruta",
      colorEstado: "#3b82f6",
      lat: baseLat + latOffset,
      lng: baseLng + lngOffset,
      esSimulado: true,
      esRaspberry: false,
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
  const location = useLocation();

  const [viewState, setViewState] = useState({ center: [-23.442503, -58.443832], zoom: 6 });
  const [deptoSeleccionado, setDeptoSeleccionado] = useState("TODOS");
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const roleLower = (userRole || "").toLowerCase();
  const esAdminMapa = ["admin", "master_admin"].includes(roleLower);
  const esMasterAdmin = roleLower === "master_admin";

  const [historialRutas, setHistorialRutas] = useState([]);
  const [rutaSeleccionada, setRutaSeleccionada] = useState(null);
  const [trazaSeleccionada, setTrazaSeleccionada] = useState(null);

  const nombreSeguro = (p) =>
    p?.nombre ||
    p?.NOMBRE ||
    (p?.id_deposito || p?.ID_DEPOSITO ? `Depósito #${p.id_deposito || p.ID_DEPOSITO}` : "Depósito");

  const [rutaChoferSeleccionada, setRutaChoferSeleccionada] = useState(null);
  const [rutaEnCurso, setRutaEnCurso] = useState(false);
  const [loadingAccion, setLoadingAccion] = useState(false);

  const [showRutasModal, setShowRutasModal] = useState(false);

  const [tabRutas, setTabRutas] = useState("historial");
  const [mesFiltro, setMesFiltro] = useState("");
  const [trasladosMes, setTrasladosMes] = useState([]);
  const [polylinesMes, setPolylinesMes] = useState([]);

  // cartel info
  const [infoRuta, setInfoRuta] = useState(null);

  // rutas multiparada (chofer)
  const [rutaActiva, setRutaActiva] = useState(null);
  const [tramoIdx, setTramoIdx] = useState(0);
  const [modoRuta, setModoRuta] = useState("completo"); // "completo" | "tramo"

  // filtros master_admin (solo para traslados del mes)
  const [depositoFiltro, setDepositoFiltro] = useState("ALL");
  const [textoChoferFiltro, setTextoChoferFiltro] = useState("");

  // --------------------------
  // Helpers
  // --------------------------
  const safe = (v, fb = "") => (v === null || v === undefined || v === "" ? fb : v);

  const fetchDetalleGrupo = async (grupo) => {
    if (!grupo) return { meta: null, paradas: [] };
    try {
      const det = await apiFetch(`${BACKEND_URL}/api/traslados/grupo/${grupo}/detalle`);
      return { meta: det?.meta || null, paradas: det?.paradas || [] };
    } catch (e) {
      console.warn("No se pudo cargar detalle del grupo:", grupo, e);
      return { meta: null, paradas: [] };
    }
  };

  const buildInfoRutaFromTraslado = (t, meta) => {
    const origen = safe(meta?.origen, safe(t?.origen, "Origen"));
    const chofer = safe(meta?.chofer, safe(t?.chofer, ""));
    const vehiculo = safe(meta?.vehiculo, safe(t?.vehiculo, ""));
    const items = meta?.items_count ?? t?.items_count ?? "";
    const fecha = safe(t?.fecha_entrega, safe(t?.fecha_salida, ""));

    const destinoRaw = safe(meta?.destino, safe(t?.destino, "Destino"));
    const esMultiparada = Array.isArray(meta?.paradas) ? meta.paradas.length > 1 : false;
    const destinoLabel = esMultiparada ? "Multiparada" : destinoRaw;

    const estado = safe(meta?.estado, safe(t?.estado, ""));

    return {
      nombre: safe(t?.grupo_ruta, safe(meta?.grupo_ruta, "Traslado")),
      fecha,
      responsable: chofer,
      trayecto: `${origen} → ${destinoLabel}`,
      obs: [vehiculo || null, items !== "" ? `${items} items` : null, estado ? `Estado: ${estado}` : null]
        .filter(Boolean)
        .join(" • "),
    };
  };

  // --------------------------
  // CARGA DE DATOS
  // --------------------------
  useEffect(() => {
    let socket;

    const fetchData = async () => {
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

        if (dataVehiculos && dataVehiculos.length > 0) {
          const reales = dataVehiculos.map((v) => ({
            id: v.ID_VEHICULO,
            nombre: v.MATRICULA || `Móvil ${v.ID_VEHICULO}`,
            conductor: v.NOMBRE_CHOFER || "Sin asignar",
            estado: v.ESTADO || "Desconocido",
            colorEstado: v.COLOR_ESTADO || "#808080",
            lat: v.LATITUD,
            lng: v.LONGITUD,
            esSimulado: false,
            esRaspberry: v.ID_VEHICULO === 3,
          }));
          flotaCombinada = [...flotaCombinada, ...reales];
        }

        const ficticios = generarVehiculosFicticios(5);
        flotaCombinada = [...flotaCombinada, ...ficticios];

        setVehiculos(flotaCombinada);
        setDepositos(dataDepositos || []);

        // RUTAS CHOFER
        if (roleLower === "chofer") {
          try {
            const dataRutas = await apiFetch(`${BACKEND_URL}/api/chofer/mi_ruta`);
            if (dataRutas) {
              setRutasChofer(dataRutas);
              if (dataRutas?.length > 0 && dataRutas[0].paradas?.length > 0) {
                setViewState({
                  center: [dataRutas[0].paradas[0].lat, dataRutas[0].paradas[0].lng],
                  zoom: 13,
                });
              }
            }
          } catch (err) {
            console.warn("No se pudieron cargar las rutas del chofer", err);
          }
        }

        // HISTORIAL ADMIN
        if (esAdminMapa) {
          try {
            const h = await apiFetch(`${BACKEND_URL}/api/rutas/historial`);
            setHistorialRutas(h || []);
          } catch (e) {
            console.warn("No se pudo cargar historial rutas", e);
          }
        }
      } catch (error) {
        console.error("Error cargando datos del mapa:", error);
        setVehiculos(generarVehiculosFicticios(6));
      } finally {
        setLoaded(true);
      }
    };

    fetchData();

    socket = io(BACKEND_URL, {
      auth: { token: sessionStorage.getItem("access_token") },
    });

    socket.on("position_update", (data) => {
      setVehiculos((prev) =>
        prev.map((v) =>
          String(v.id) === String(data.ID_VEHICULO) ? { ...v, lat: data.LATITUD, lng: data.LONGITUD } : v
        )
      );
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [roleLower, esAdminMapa]);

  // Trayecto en cartel según modo/tramo (chofer)
  useEffect(() => {
    if (!rutaActiva?.paradas?.length) return;

    const stops = rutaActiva.paradas;

    if (modoRuta === "completo") {
      const trayectoCompleto = stops.length > 4 ? "Multiparada" : stops.map(nombreSeguro).join(" → ");
      setInfoRuta((prev) => ({ ...(prev || {}), trayecto: trayectoCompleto }));
      return;
    }

    const a = stops[tramoIdx];
    const b = stops[tramoIdx + 1];
    if (!a || !b) return;

    setInfoRuta((prev) => ({ ...(prev || {}), trayecto: `${nombreSeguro(a)} → ${nombreSeguro(b)}` }));
  }, [rutaActiva, modoRuta, tramoIdx]);

  // Entrar desde Movimientos
  useEffect(() => {
    const st = location?.state;
    const id = st?.id_vale_ref ?? st?.id_vale ?? st?.id;
    if (!id) return;

    const t = st?.traslado || {};

    (async () => {
      try {
        const pl = await apiFetch(`${BACKEND_URL}/api/movimientos_ruta/${id}/polyline`);

        setTrazaSeleccionada({
          gps_points: pl.gps,
          planned_points: pl.plan,
        });
        setPolylinesMes([]);

        const pts = (pl.gps?.length > 1 ? pl.gps : pl.plan) || [];
        if (pts.length) setViewState({ center: [pts[0].lat, pts[0].lng], zoom: 12 });

        const grupo = t?.grupo_ruta;
        const { meta, paradas } = await fetchDetalleGrupo(grupo);
        const metaConParadas = meta ? { ...meta, paradas } : null;

        setInfoRuta(buildInfoRutaFromTraslado(t, metaConParadas));
      } catch (e) {
        console.warn("No se pudo cargar polyline/detalle del traslado", e);
        alert("No se pudo cargar el trayecto.");
      }
    })();
  }, [location?.state]);

  // Cargar traslados del mes (con filtros master_admin)
  useEffect(() => {
    const cargarTraslados = async () => {
      if (!mesFiltro) {
        setTrasladosMes([]);
        setPolylinesMes([]);
        return;
      }

      try {
        const qs = new URLSearchParams();
        qs.set("month", mesFiltro);
        qs.set("limit", "200");

        if (esMasterAdmin && depositoFiltro && depositoFiltro !== "ALL") qs.set("deposito_id", depositoFiltro);
        if (esMasterAdmin && textoChoferFiltro.trim()) qs.set("chofer", textoChoferFiltro.trim());

        const data = await apiFetch(`${BACKEND_URL}/api/traslados/historial?${qs.toString()}`);
        setTrasladosMes(data || []);
      } catch (e) {
        console.warn("No se pudieron cargar traslados del mes", e);
        setTrasladosMes([]);
      }
    };

    cargarTraslados();
  }, [mesFiltro, esMasterAdmin, depositoFiltro, textoChoferFiltro]);

  // Filtros de zona (mapa)
  const departamentos = useMemo(() => {
    const deptos = new Set(depositos.map((d) => d.DEPARTAMENTO || "Sin asignar"));
    return Array.from(deptos).sort();
  }, [depositos]);

  const depositosFiltrados = useMemo(() => {
    if (deptoSeleccionado === "TODOS") return depositos;
    return depositos.filter((d) => d.DEPARTAMENTO === deptoSeleccionado);
  }, [depositos, deptoSeleccionado]);

  // Handlers
  const seleccionarRutaHistorial = async (grupo) => {
    setRutaSeleccionada(grupo);
    try {
      const data = await apiFetch(`${BACKEND_URL}/api/rutas/historial/${grupo}/traza`);
      setTrazaSeleccionada(data);

      const pts = (data?.gps_points?.length > 1 ? data.gps_points : data?.planned_points) || [];
      if (pts.length) setViewState({ center: [pts[0].lat, pts[0].lng], zoom: 13 });

      setInfoRuta({
        nombre: data.grupo_ruta || grupo,
        fecha: `${data.inicio || ""} → ${data.fin || ""}`,
        responsable: data.id_vehiculo ? `Vehículo #${data.id_vehiculo}` : "",
        trayecto: "Recorrido auditado",
        obs: data.gps_points?.length > 1 ? "Con GPS" : "Ruta planificada",
      });
    } catch (e) {
      console.warn("No se pudo cargar traza", e);
      setTrazaSeleccionada(null);
    }
  };

  const handleCambioDepartamento = (e) => {
    const depto = e.target.value;
    setDeptoSeleccionado(depto);

    if (depto === "TODOS") {
      setViewState({ center: [-23.442503, -58.443832], zoom: 6 });
    } else {
      const deps = depositos.filter((d) => d.DEPARTAMENTO === depto);
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

  const normalizarPunto = (p) => {
    if (!p) return null;

    const lat = p.lat ?? p.LATITUD ?? p.latitude ?? p.Latitud;
    const lng = p.lng ?? p.LONGITUD ?? p.longitude ?? p.Longitud;

    return {
      ...p,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      nombre: p.nombre ?? p.NOMBRE ?? p.NomDep ?? p.descripcion ?? p.DESCRIPCION ?? "",
    };
  };

  const resolverParadasDeRuta = (ruta) => {
    const raw = Array.isArray(ruta?.paradas)
      ? ruta.paradas
      : Array.isArray(ruta?.puntos)
      ? ruta.puntos
      : [];

    return raw.map(normalizarPunto).filter((p) => p && p.lat != null && p.lng != null);
  };

  const seleccionarRutaChofer = (ruta) => {
    const stops = resolverParadasDeRuta(ruta);
    setRutaActiva({ id_grupo: ruta?.id_grupo, paradas: stops });
  };

  const iniciarRuta = async () => {
    if (!rutaChoferSeleccionada?.id_grupo) return;

    setLoadingAccion(true);
    try {
      await apiFetch(`${BACKEND_URL}/api/rutas/${rutaChoferSeleccionada.id_grupo}/iniciar`, {
        method: "POST",
        body: JSON.stringify({ id_grupo: rutaChoferSeleccionada.id_grupo }),
      });

      setRutaEnCurso(true);
      alert("✅ Ruta iniciada");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo iniciar la ruta");
    } finally {
      setLoadingAccion(false);
    }
  };

  const finalizarRuta = async () => {
    if (!rutaChoferSeleccionada?.id_grupo) return;

    setLoadingAccion(true);
    try {
      await apiFetch(`${BACKEND_URL}/api/rutas/${rutaChoferSeleccionada.id_grupo}/finalizar`, {
        method: "POST",
        body: JSON.stringify({ id_grupo: rutaChoferSeleccionada.id_grupo }),
      });

      setRutaEnCurso(false);

      setModoRuta("completo");
      setTramoIdx(0);

      const stops = rutaActiva?.paradas?.length ? rutaActiva.paradas : rutaChoferSeleccionada?.paradas || [];
      const trayectoCompleto = !stops.length ? "Sin paradas" : stops.length > 4 ? "Multiparada" : stops.map(nombreSeguro).join(" → ");

      setInfoRuta((prev) => ({
        ...(prev || {}),
        nombre: rutaChoferSeleccionada.id_grupo,
        responsable: "Chofer",
        trayecto: trayectoCompleto,
        obs: "Finalizado",
      }));

      setRutasChofer((prev) =>
        prev.map((r) =>
          String(r.id_grupo) === String(rutaChoferSeleccionada.id_grupo) ? { ...r, estado: "finalizado" } : r
        )
      );

      alert("✅ Ruta finalizada");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo finalizar la ruta");
    } finally {
      setLoadingAccion(false);
    }
  };

  // ✅ Seleccionar traslado del mes (ahora el backend ya devuelve multiparada por GRUPO)
  const seleccionarTrasladoMes = async (t) => {
    try {
      const id = t?.id_vale ?? t?.id_vale_ref ?? t?.id ?? null;
      if (!id) return;

      const pl = await apiFetch(`${BACKEND_URL}/api/movimientos_ruta/${id}/polyline`);

      setTrazaSeleccionada({
        gps_points: pl.gps,
        planned_points: pl.plan,
      });
      setPolylinesMes([]);

      const pts = (pl.gps?.length > 1 ? pl.gps : pl.plan) || [];
      if (pts.length) setViewState({ center: [pts[0].lat, pts[0].lng], zoom: 12 });

      const { meta, paradas } = await fetchDetalleGrupo(t?.grupo_ruta);
      const metaConParadas = meta ? { ...meta, paradas } : null;

      setInfoRuta(buildInfoRutaFromTraslado(t, metaConParadas));
    } catch (e) {
      console.warn("No se pudo cargar polyline del traslado", e);
    }
  };

  const dibujarTrasladosDelMes = async () => {
    if (!trasladosMes.length) return;

    try {
      const res = await Promise.allSettled(
        trasladosMes.map((t) => {
          const id = t?.id_vale ?? t?.id_vale_ref ?? t?.id;
          return apiFetch(`${BACKEND_URL}/api/movimientos_ruta/${id}/polyline`);
        })
      );

      const ok = res.filter((r) => r.status === "fulfilled").map((r) => r.value);
      setPolylinesMes(ok);
      setTrazaSeleccionada(null);

      const first = ok.find((p) => p.gps?.length > 1 || p.plan?.length > 0);
      const pts = first ? (first.gps?.length > 1 ? first.gps : first.plan) : [];
      if (pts?.length) setViewState({ center: [pts[0].lat, pts[0].lng], zoom: 10 });
    } catch (e) {
      console.warn("No se pudo dibujar el mes", e);
    }
  };

  return (
    <div className="mapa-layout-container">
      {!sidebarOpen && (
        <div className="floating-controls">
          <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(true)} title="Abrir Menú">
            <Menu size={24} />
          </button>

          <div className="fab-stack">
            <button className="fab-btn" title="Orden de Trabajo" onClick={() => (window.location.href = "/ordenes-trabajo")}>
              Orden
            </button>

            <button className="fab-btn" title="Gastos / Viáticos" onClick={() => (window.location.href = "/gastos")}>
              Gasto
            </button>

            <button className="fab-btn" title="Rutas" onClick={() => setShowRutasModal(true)}>
              Rutas
            </button>
          </div>
        </div>
      )}

      {showRutasModal && (
        <div className="ruta-modal-backdrop" onClick={() => setShowRutasModal(false)}>
          <div className="ruta-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ruta-modal-header">
              <h3 style={{ margin: 0 }}>Rutas</h3>
              <button className="ruta-modal-close" onClick={() => setShowRutasModal(false)} title="Cerrar">
                <X size={20} />
              </button>
            </div>

            <RutaPanel
              roleLower={roleLower}
              esAdminMapa={esAdminMapa}
              tabRutas={tabRutas}
              setTabRutas={setTabRutas}
              mesFiltro={mesFiltro}
              setMesFiltro={setMesFiltro}
              rutasChofer={rutasChofer}
              rutaChoferSeleccionada={rutaChoferSeleccionada}
              setRutaChoferSeleccionada={setRutaChoferSeleccionada}
              onSeleccionarRutaChofer={seleccionarRutaChofer}
              onIniciarRuta={iniciarRuta}
              onFinalizarRuta={finalizarRuta}
              rutaEnCurso={rutaEnCurso}
              loadingAccion={loadingAccion}
              historialRutas={historialRutas}
              rutaSeleccionada={rutaSeleccionada}
              onSeleccionarRutaHistorial={(grupo) => {
                seleccionarRutaHistorial(grupo);
                setShowRutasModal(false);
              }}
              trasladosMes={trasladosMes}
              onSeleccionarTraslado={seleccionarTrasladoMes}
              onDibujarMes={dibujarTrasladosDelMes}
              rutaActiva={rutaActiva}
              tramoIdx={tramoIdx}
              onSeleccionarTramo={(idx) => setTramoIdx(idx)}
              onSetModoRuta={setModoRuta}
              onClose={() => setShowRutasModal(false)}
              esMasterAdmin={esMasterAdmin}
              depositos={depositos}
              depositoFiltro={depositoFiltro}
              setDepositoFiltro={setDepositoFiltro}
              textoChoferFiltro={textoChoferFiltro}
              setTextoChoferFiltro={setTextoChoferFiltro}
              fetchDetalleGrupo={fetchDetalleGrupo} // ✅ NUEVO
            />
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className={`mapa-sidebar ${sidebarOpen ? "" : "closed"}`}>
        <div className="mapa-sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Truck size={22} color="#2563eb" />
            <h3>Monitor Logístico</h3>
          </div>

          <button className="close-btn-sidebar" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-section">
          <h4 className="section-title">
            <MapIcon size={14} /> Filtrar Zona
          </h4>

          <div className="custom-select-wrapper">
            <Filter size={16} className="select-icon" />
            <select className="modern-select" value={deptoSeleccionado} onChange={handleCambioDepartamento}>
              <option value="TODOS">Todas las zonas (Nacional)</option>
              {departamentos.map((dep) => (
                <option key={dep} value={dep}>
                  {dep} ({depositos.filter((d) => d.DEPARTAMENTO === dep).length} deps.)
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="select-arrow" />
          </div>
        </div>

        <div className="sidebar-section list-section">
          <div className="table-header-container">
            <h4 className="section-title" style={{ marginTop: 0 }}>
              Flota Activa{" "}
              <span style={{ marginLeft: 6, background: "#e2e8f0", padding: "2px 6px", borderRadius: 10, fontSize: 10 }}>
                {vehiculos.length}
              </span>
            </h4>
          </div>

          <div className="vehiculos-list-modern">
            {vehiculos.length === 0 ? (
              <div className="no-data-card">Buscando señal satelital...</div>
            ) : (
              vehiculos.map((v) => (
                <div
                  key={v.id}
                  className={`vehiculo-card ${vehiculoSeleccionado?.id === v.id ? "selected" : ""} ${v.esRaspberry ? "is-raspberry" : ""}`}
                  onClick={() => handleSelectVehiculo(v)}
                >
                  <div className="card-icon">
                    {v.esRaspberry ? <Radio size={18} /> : <Truck size={18} />}
                    {v.esRaspberry && <span className="pulse-indicator"></span>}
                  </div>

                  <div className="card-info">
                    <span className="card-title">{v.nombre}</span>
                    <div className="card-subtitle">
                      <User size={12} style={{ marginRight: 4 }} />
                      {v.esRaspberry ? "Rastreo Satelital" : v.conductor}
                    </div>
                  </div>

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
                          fontSize: "10px",
                          fontWeight: 600,
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

        <div className="mapa-menu-inferior">
          <button className="menu-btn" onClick={() => (window.location.href = "/home")}>
            <HomeIcon size={18} /> <span>Home</span>
          </button>
          <button className="menu-btn" onClick={() => (window.location.href = "/config")}>
            <Settings size={18} /> <span>Config</span>
          </button>
          <button className="menu-btn">
            <HelpCircle size={18} /> <span>Ayuda</span>
          </button>
        </div>
      </div>

      {/* MAPA */}
      <div className="content-dashboard-map">
        {infoRuta && (
          <div className="ruta-info-card">
            <div className="ruta-info-header">
              <strong>{infoRuta.nombre || "Ruta"}</strong>
              <button className="ruta-info-close" onClick={() => setInfoRuta(null)}>×</button>
            </div>

            {infoRuta.fecha && <div><b>Fecha:</b> {infoRuta.fecha}</div>}
            {infoRuta.responsable && <div><b>Responsable:</b> {infoRuta.responsable}</div>}
            {infoRuta.trayecto && <div><b>Trayecto:</b> {infoRuta.trayecto}</div>}
            {infoRuta.obs && <div><b>OBS:</b> {infoRuta.obs}</div>}
          </div>
        )}

        {!loaded ? (
          <div className="loading-map">
            <div className="spinner"></div>
            <p>Cargando...</p>
          </div>
        ) : (
          <MapContainer center={viewState.center} zoom={viewState.zoom} className="leaflet-map-container" zoomControl={false}>
            <MapController center={viewState.center} zoom={viewState.zoom} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />

            {/* Rutas chofer (no duplicar activa) */}
            {rutasChofer.map((ruta) => {
              if (rutaActiva?.id_grupo === ruta.id_grupo) return null;
              const puntosSanitizados = resolverParadasDeRuta(ruta);
              if (puntosSanitizados.length >= 2) return <RutaBolt key={ruta.id_grupo} waypoints={puntosSanitizados} />;
              return null;
            })}

            {/* RUTA MULTIPARADA (chofer) */}
            {rutaActiva?.paradas?.length >= 2 &&
              (modoRuta === "completo" ? (
                <RutaBolt waypoints={rutaActiva.paradas} />
              ) : (
                (() => {
                  const a = rutaActiva.paradas[tramoIdx];
                  const b = rutaActiva.paradas[tramoIdx + 1];
                  if (!a || !b) return null;
                  return <RutaBolt origen={a} destino={b} />;
                })()
              ))}

            {/* Traza seleccionada: GPS=Polyline, Plan=RutaBolt */}
            {trazaSeleccionada && (() => {
              const gps = trazaSeleccionada.gps_points || [];
              const plan = trazaSeleccionada.planned_points || [];

              if (gps.length > 1) {
                return <Polyline positions={gps.map((p) => [p.lat, p.lng])} color="blue" weight={4} />;
              }
              if (plan.length >= 2) {
                return <RutaBolt waypoints={plan} />;
              }
              return null;
            })()}

            {/* Mes */}
            {polylinesMes.map((pl, idx) => {
              const gps = pl.gps || [];
              const plan = pl.plan || [];

              if (gps.length > 1) return <Polyline key={`mes-gps-${idx}`} positions={gps.map((p) => [p.lat, p.lng])} />;
              if (plan.length === 2) return <RutaBolt key={`mes-bolt-${idx}`} origen={plan[0]} destino={plan[1]} />;
              if (plan.length > 1) return <Polyline key={`mes-plan-${idx}`} positions={plan.map((p) => [p.lat, p.lng])} />;

              return null;
            })}

            {/* Depósitos */}
            {depositosFiltrados.map((dep) => (
              <Marker key={`dep-${dep.ID_DEPOSITO}`} position={[dep.LATITUD, dep.LONGITUD]} icon={depositoIcon}>
                <Popup>
                  <strong>🏭 {dep.NOMBRE}</strong><br />
                  <span className="badge-depto-popup">{dep.DEPARTAMENTO}</span>
                </Popup>
              </Marker>
            ))}

            {/* Vehículos */}
            {vehiculos.map((v) =>
              v.lat && v.lng ? (
                <Marker
                  key={`veh-${v.id}`}
                  position={[v.lat, v.lng]}
                  opacity={v.esRaspberry ? 1 : 0.7}
                  zIndexOffset={v.esRaspberry ? 1000 : 0}
                >
                  <Popup>
                    <strong>{v.esRaspberry ? "📡 " : "🚗 "}{v.nombre}</strong><br />
                    {v.esRaspberry ? (
                      <span style={{ color: "green", fontWeight: "bold" }}>En vivo</span>
                    ) : (
                      <span style={{ color: v.colorEstado }}>{v.estado}</span>
                    )}
                  </Popup>
                </Marker>
              ) : null
            )}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
