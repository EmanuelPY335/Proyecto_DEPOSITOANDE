// src/pages/Movimientos.jsx
import React, { useEffect, useState, useMemo} from "react";
import { useLocation, useNavigate} from "react-router-dom";
import { apiFetch } from "../utils/api";
import {
  Truck, MapPin, Package, Plus, Trash2,
  Navigation, List, ClipboardList, Search, Filter, Check, ShieldAlert,
  Eye, Printer, Layers, X, Map as MapIcon
} from "lucide-react";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "../styles/Movimientos.css";
import HistorialPedidos from "../components/HistorialPedidos";
import { generarValePDF } from "../utils/pdfGenerator";

// ... (MAP CONFIGURATION) ...
const iconOrigen = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const iconDestino = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const iconDisponible = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const iconCamion = new L.Icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/1048/1048313.png", iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -30] });

const MapUpdater = ({ center, zoom = 13 }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const Movimientos = () => {
  const rawRole = sessionStorage.getItem("user_rol") || sessionStorage.getItem("rol_nombre") || "";
  const userRole = rawRole.trim().toLowerCase();
  
  // Roles generales de gestión
  const adminRoles = ["master_admin", "admin", "administrador", "gerente", "it_support"];
  const esAdminGlobal = adminRoles.includes(userRole);
  
  // Roles específicos
  const esMasterAdmin = userRole === "master_admin"; 
  
  // ✅ NUEVA VARIABLE: Solo estos roles pueden ver el botón de borrar
  const canDelete = ["master_admin", "admin"].includes(userRole);

  const userPermissions = JSON.parse(sessionStorage.getItem("user_permissions") || "[]").map(p => p.trim());
  const userDepositoId = sessionStorage.getItem("user_deposito_id");
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "movimientos");
  const [movimientos, setMovimientos] = useState([]);
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showWizard, setShowWizard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [depositos, setDepositos] = useState([]);
  const [materiales, setMateriales] = useState([]); 
  const [choferes, setChoferes] = useState([]); 
  const [vehiculosList, setVehiculosList] = useState([]); 
  const [activeVehicles, setActiveVehicles] = useState([]);

  const [step, setStep] = useState(1);
  const [routeConfig, setRouteConfig] = useState({
    id_origen: "",
    observacion: "",
    id_chofer: "",
    id_vehiculo: ""
  });

  const [stops, setStops] = useState([]);
  const [editingStopIndex, setEditingStopIndex] = useState(null); 
  const [itemTemp, setItemTemp] = useState({ id_material: "", id_lote: "", cantidad: "" });
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [destinoSearch, setDestinoSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [traslados, setTraslados] = useState([]);
  
  const [showTrayectoModal, setShowTrayectoModal] = useState(false);
  const [trayectoData, setTrayectoData] = useState(null);
  const [trayectoLoading, setTrayectoLoading] = useState(false);
  const [trasladoSeleccionado, setTrasladoSeleccionado] = useState(null);

  const totalPuntos = useMemo(() => {
    return stops.reduce((acc, stop) => {
      const sumStop = (stop.items || []).reduce((a, it) => {
        const cant = Number(it.cantidad) || 0;
        const mat = materiales.find(m => String(m.ID_MATERIAL) === String(it.id_material));
        const factor = Number(mat?.FACTOR_PUNTOS ?? mat?.factor_puntos ?? 1);
        return a + (cant * factor);
      }, 0);
      return acc + sumStop;
    }, 0);
  }, [stops, materiales]);

  const clearWizardData = () => {
    localStorage.removeItem("wiz_step");
    localStorage.removeItem("wiz_config");
    localStorage.removeItem("wiz_stops");
    localStorage.removeItem("wiz_user");

    setStep(1);
    setStops([]);
    setRouteConfig({
      id_origen: "",
      observacion: "",
      id_chofer: "",
      id_vehiculo: ""
    });
    setEditingStopIndex(null);
    setShowWizard(false);
  };

  const closeWizardPreserveData = () => {
    setShowWizard(false);
  };

  const puedeGestionarMovimientos = () => {
    if (esAdminGlobal) return true; 
    return userPermissions.includes("gestion_movimientos");
  };
  
  const puedeVerPedidos = () => {
    if (esAdminGlobal) return true;
    const rolesPermitidos = ["personal_inventario"]; 
    return rolesPermitidos.some(r => r === userRole) || userPermissions.includes("ver_pedidos");
  };
  
  const puedeCrearRutas = () => {
    if (esAdminGlobal) return true;
    const rolesPermitidos = ["personal_inventario"];
    return rolesPermitidos.some(r => r === userRole) || userPermissions.includes("crear_rutas");
  };

  const parseAnyDate = (val) => {
    if (!val) return null;
    const d1 = new Date(val);
    if (!isNaN(d1.getTime())) return d1;
    const m = String(val).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]) - 1;
      const yy = Number(m[3]);
      const d2 = new Date(yy, mm, dd);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  };

  const inDateRange = (fechaStr) => {
    const f = parseAnyDate(fechaStr);
    if (!f) return true;
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    if (from && f < from) return false;
    if (to && f > to) return false;
    return true;
  };

  const userKey =
    sessionStorage.getItem("user_id") ||
    sessionStorage.getItem("id_usuario") ||
    sessionStorage.getItem("usuario_id") ||
    sessionStorage.getItem("email") ||
    sessionStorage.getItem("username") ||
    "";

  const token =
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("jwt") ||
    "";

  const isLoggedIn = Boolean(token);
  const canPersistWizard = Boolean(userKey);

  useEffect(() => {
    if (!isLoggedIn) {
      clearWizardData();
      return;
    }
    const savedUser = localStorage.getItem("wiz_user");
    if (!savedUser || savedUser !== userKey) {
      clearWizardData();
      return;
    }
    const savedStep = localStorage.getItem("wiz_step");
    const savedConfig = localStorage.getItem("wiz_config");
    const savedStops = localStorage.getItem("wiz_stops");

    if (!savedStep || !savedConfig || !savedStops) {
      clearWizardData();
      return;
    }
    try {
      setStep(Number(savedStep));
      setRouteConfig(JSON.parse(savedConfig));
      setStops(JSON.parse(savedStops));
      setShowWizard(true);
    } catch (e) {
      console.error("❌ Error restaurando wizard", e);
      clearWizardData();
    }
  }, [isLoggedIn, userKey]);

  useEffect(() => {
    if (!showWizard) return;
    if (!isLoggedIn) return;
    localStorage.setItem("wiz_user", userKey);
    localStorage.setItem("wiz_step", String(step));
    localStorage.setItem("wiz_config", JSON.stringify(routeConfig));
    localStorage.setItem("wiz_stops", JSON.stringify(stops));
  }, [step, routeConfig, stops, showWizard, isLoggedIn, userKey]);

  useEffect(() => {
    if (location.state?.activeTab) setActiveTab(location.state.activeTab);
  }, [location.state]);

  useEffect(() => { 
    if (puedeGestionarMovimientos() || puedeVerPedidos()) {
      loadMovimientos(); 
      loadDepositos(); 
      loadMateriales(); 
      loadChoferes(); 
      loadVehiculos(); 
      loadActiveVehicles(); 
      loadTraslados();
    }
  }, []);

  useEffect(() => {
    if (!routeConfig.id_vehiculo) return;
    const selected = vehiculosList.find(v =>
      String(v.ID_VEHICULO ?? v.id) === String(routeConfig.id_vehiculo)
    );
    if (!selected) return;
    const estado = String(selected.estado || "desconocido").toLowerCase();
    const capacidad = Number(selected.CAPACIDAD_PUNTOS || 0);
    if (estado !== "disponible" || capacidad < totalPuntos) {
      setRouteConfig(prev => ({ ...prev, id_vehiculo: "" }));
    }
  }, [totalPuntos, vehiculosList]); 

  useEffect(() => { 
      if (showWizard && !esMasterAdmin && userDepositoId) { 
          setRouteConfig(prev => ({ ...prev, id_origen: userDepositoId })); 
      } 
  }, [showWizard, esMasterAdmin, userDepositoId]);

  const loadMovimientos = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/movimientos"); 
      setMovimientos(data || []); 
    } catch(e) { console.error(e); } 
  };
  const loadTraslados = async () => {
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/traslados/historial?limit=100");
      setTraslados(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDepositos = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/depositos"); 
      setDepositos(data || []); 
    } catch(e) { console.error(e); } 
  };
  
  const loadMateriales = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/materiales"); 
      setMateriales(data || []); 
    } catch(e) { console.error(e); } 
  };
  
  const loadChoferes = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/personal/choferes"); 
      setChoferes(data || []); 
    } catch(e) { console.error(e); } 
  };
  
  const loadVehiculos = async () => {
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/vehiculos");
      setVehiculosList(data || []);
    } catch (e) {
      console.error("❌ Error loadVehiculos:", e);
    }
  };

  const loadActiveVehicles = async () => { 
    try { 
      const data = await apiFetch("http://127.0.0.1:5000/api/vehicles/active"); 
      setActiveVehicles(data || []); 
    } catch(e) { console.error(e); } 
  };

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
  
  const getReservadoLote = (loteId) => {
    const lid = String(loteId);
    let sum = 0;
    for (const s of stops) {
      for (const it of (s.items || [])) {
        if (String(it.id_lote) === lid) sum += Number(it.cantidad) || 0;
      }
    }
    return sum;
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

    const origenInicial = esMasterAdmin ? "" : (userDepositoId || "");

    setRouteConfig({ 
      ...routeConfig, 
      id_origen: origenInicial, 
      observacion: `[SOLICITUD #${pedido.id_solicitud}] Enviar: ${pedido.material} (Cant: ${pedido.cantidad}) - ${pedido.observacion || ''}` 
    }); 
    setStops([newStop]); 
    setShowWizard(true); 
    setStep(2); 
    
    if (!origenInicial && !esMasterAdmin) {
       alert("Error de configuración: Tu usuario no tiene un depósito de origen asignado.");
    } else if (!origenInicial && esMasterAdmin) {
        alert(`✅ Solicitud cargada. Por favor, regresa al PASO 1 para seleccionar el Depósito de Origen.`);
    } else {
        alert(`✅ Solicitud cargada para ${depDestino.NOMBRE}. Continúa para configurar la ruta.`); 
    }
  };
  
  const handleMaterialChange = async (idMaterial) => { 
    setItemTemp({...itemTemp, id_material: idMaterial, id_lote: ""}); 
    if(!idMaterial) { 
      setLotesDisponibles([]); 
      return; 
    } 
    try { 
      const data = await apiFetch(`http://127.0.0.1:5000/api/materiales/${idMaterial}/lotes`); 
      const filtrados = data
        .filter(l =>
          String(l.deposito_id) === String(routeConfig.id_origen) &&
          Number(l.cantidad) > 0 &&
          l.estado === "Disponible"
        )
        .map(l => {
          const stockTotal = Number(l.cantidad) || 0;
          const reservado = getReservadoLote(l.lote_id);
          const disponibleReal = Math.max(0, stockTotal - reservado);

          return {
            ...l,
            stock_total: stockTotal,
            reservado_wiz: reservado,
            disponible_wiz: disponibleReal,
          };
        })
        .filter(l => l.disponible_wiz > 0);

      setLotesDisponibles(filtrados);

    } catch(e) { 
      console.error(e); 
    } 
  };
  
 const addItemToStop = () => {
  if (editingStopIndex === null) return;
  if (!itemTemp.id_lote || !itemTemp.cantidad) return alert("Faltan datos");

  const loteInfo = lotesDisponibles.find(l => String(l.lote_id) === String(itemTemp.id_lote));
  if (!loteInfo) return alert("Lote inválido");

  let pedido = Number(itemTemp.cantidad) || 0;
  if (pedido <= 0) return alert("Cantidad inválida");

  const disponible = Number(loteInfo.disponible_wiz ?? loteInfo.cantidad ?? 0);

  if (pedido > disponible) {
    if (disponible <= 0) return alert("Stock insuficiente. Ya reservaste todo ese lote.");
    pedido = disponible;
    alert(`⚠️ Solo quedaban ${disponible}. Se ajustó automáticamente.`);
  }

  const mat = materiales.find(m => String(m.ID_MATERIAL) === String(itemTemp.id_material));
  const nombreMat = mat?.NOMBRE || "Material";
  const unidad = mat?.UNIDAD || "Unid.";

  const updatedStops = [...stops];
  const stopItems = updatedStops[editingStopIndex].items || [];

  const exists = stopItems.find(it => String(it.id_lote) === String(itemTemp.id_lote));

  if (exists) {
    exists.cantidad = (Number(exists.cantidad) || 0) + pedido;
  } else {
    stopItems.push({
      id_lote: itemTemp.id_lote,
      id_material: itemTemp.id_material,
      codigo: loteInfo.codigo,
      nombre: nombreMat,
      cantidad: pedido,
      UNIDAD: unidad
    });
  }

  updatedStops[editingStopIndex].items = stopItems;
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

  const handleDelete = async (m) => {
    if (!m) return;
    if (m.tipo_obj === "vale") {
      alert("Este registro es una RUTA/VALE. No se elimina desde Movimientos.\n\nSi querés 'borrar' un vale, lo correcto es ANULARLO (rechazar) desde /api/vales/<id>/rechazar.");
      return;
    }
    const BACKEND = "http://127.0.0.1:5000";
    const id = Number(m.id);
    if (!Number.isFinite(id)) return alert("ID inválido para borrar.");

    if (!window.confirm("¿Eliminar este movimiento?")) return;

    try {
      if (esMasterAdmin) {
        await apiFetch(`${BACKEND}/api/movimientos/${id}/perma`, { method: "DELETE" });
        alert("Eliminado permanentemente.");
      } else {
        await apiFetch(`${BACKEND}/api/movimientos/${id}/soft`, { method: "PUT" });
        alert("Movimiento ocultado.");
      }
      loadMovimientos();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handlePrint = (m, isPreview) => {
    // ✅ Caso 1: Movimiento interno
    if (m.es_local) {
      const pdfData = {
        tipo: "interno",
        id: m.id,
        fecha: m.fecha || m.fecha_movimiento || "",
        estado: m.estado || "Registrado",
        responsable: m.responsable || "Sin Responsable",
        
        // Pasamos el vehículo como Maquinaria para el PDF
        maquinaria: m.vehiculo || m.maquinaria || "N/A",

        sector_origen: m.sector_origen || m.ubicacion_anterior || "N/D",
        sector_destino: m.sector_destino || m.nueva_ubicacion || "N/D",

        deposito: m.deposito || "N/D",
        observaciones: m.observaciones || m.obs || "",

        items: m.items && m.items.length
          ? m.items
          : [{
              codigo: m.codigo || "-",
              material: m.material || "N/D",
              lote: m.lote || m.id_lote || "N/D",
              cantidad: m.cantidad || 0,
              unidad: m.unidad || "u.",
              sector_destino: m.sector_destino || m.nueva_ubicacion || "N/D" // Individual si existe
            }]
      };

      generarValePDF(pdfData, isPreview);
      return;
    }

    // ✅ Caso 2: Ruta / Vale externo
    const pdfData = {
      tipo: "ruta",
      id: m.id,
      fecha: m.fecha || m.fecha_salida || "",
      estado: m.estado || "Registrado",
      origen: m.deposito || m.origen || "N/D",
      destino: m.destino_final || m.destino || "Ruta",
      chofer: m.responsable || m.chofer || "Sin Asignar",
      vehiculo: m.vehiculo || "N/A",
      items: m.items || [{
        codigo: "-",
        material: m.material,
        lote: m.lote,
        cantidad: m.cantidad,
        unidad: m.unidad
      }]
    };

    generarValePDF(pdfData, isPreview);
  };

  const handleVerTrayecto = (t, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const id = t?.id_vale_ref ?? t?.id_vale ?? t?.id;
    if (!id) return alert("Traslado sin id_vale_ref (revisar backend).");
    navigate("/mapa", {
      state: { from: "movimientos", id_vale_ref: id, traslado: t },
    });
  };

  const handlePrintTraslado = async (t, isPreview) => {
    try {
      const grupo = t.grupo_ruta;
      if (!grupo) {
        alert("Traslado sin grupo_ruta (revisar backend)");
        return;
      }
      const det = await apiFetch(`http://127.0.0.1:5000/api/traslados/grupo/${grupo}/detalle`);
      const meta = det.meta || {};
      const paradas = det.paradas || [];

      const pdfData = {
        tipo: "ruta",
        id: grupo, 
        fecha: t.fecha_salida || "",
        estado: "Finalizado",
        origen: meta.origen || t.origen || "",
        destino: "Multiparada",
        chofer: meta.chofer || t.chofer || "",
        vehiculo: meta.vehiculo || t.vehiculo || "",
        paradas 
      };

      generarValePDF(pdfData, isPreview);
    } catch (e) {
      console.error(e);
      alert("No se pudo generar el PDF del traslado.");
    }
  };

  const handleSubmit = async () => { 
    const emptyStops = stops.filter(s => s.items.length === 0); 
    if(emptyStops.length > 0) return alert(`La parada "${emptyStops[0].nombre}" no tiene carga asignada.`); 
    if (!routeConfig.id_chofer || !routeConfig.id_vehiculo) return alert("Error: Falta asignar Chofer o Vehículo.");
    const payload = { ...routeConfig, stops: stops }; 
    try { 
        await apiFetch("http://127.0.0.1:5000/api/vales", { method: "POST", body: JSON.stringify(payload) }); 
        alert("✅ Ruta creada exitosamente."); 
        clearWizardData();
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

  const filtered = movimientos.filter(m => {
    let matchesType = true;
    if (tipoFiltro === "rutas") matchesType = !m.es_local;
    if (tipoFiltro === "interno") matchesType = m.es_local;

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (m.material && m.material.toLowerCase().includes(term)) ||
      (m.responsable && m.responsable.toLowerCase().includes(term)) ||
      (m.vehiculo && m.vehiculo.toLowerCase().includes(term)) ||
      (m.chofer && m.chofer.toLowerCase().includes(term));

    const est = String(m.estado || "sin_estado").toLowerCase();
    let matchesEstado = true;
    if (estadoFiltro !== "todos") matchesEstado = est === estadoFiltro;

    const fechaRef = m.fecha_salida || m.fecha || m.fecha_movimiento || "";
    const matchesFecha = inDateRange(fechaRef);

    return matchesType && matchesSearch && matchesEstado && matchesFecha;
  });

  if (!puedeGestionarMovimientos() && !puedeVerPedidos()) {
    return (
      <div className="fade-in" style={{ display:'flex', flexDirection: 'column', justifyContent:'center', alignItems:'center', height:'60vh', color:'#4b5563', textAlign: 'center' }}>
        <ShieldAlert size={64} style={{color:'#ef4444', marginBottom: 20}} />
        <h1>Acceso Restringido</h1>
        <p>No tienes permisos para acceder a Gestión de Movimientos.</p>
        <button className="btn-primary mt-4" onClick={() => navigate("/home")}>
          Volver al Inicio
        </button>
      </div>
    );
  }

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

        <div className="tabs-header">
            <button onClick={() => setActiveTab("movimientos")} className={`tab-btn ${activeTab === "movimientos" ? "active-blue" : ""}`}>
                <List size={18} /> Historial de Vales
            </button>
            {puedeVerPedidos() && (
                <button onClick={() => setActiveTab("pedidos")} className={`tab-btn ${activeTab === "pedidos" ? "active-yellow" : ""}`}>
                    <ClipboardList size={18} /> Pedidos
                </button>
            )}
            <button
              onClick={() => setActiveTab("traslados")}
              className={`tab-btn ${activeTab === "traslados" ? "active-blue" : ""}`}
            >
              <Truck size={18} /> Movimientos
            </button>
        </div>

        {activeTab === "movimientos" && (
            <div className="discord-card historial-card fade-in">
               <div className="toolbar-section relative">
                  <div className="search-bar-modern">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Buscar por material, chofer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <button className={`btn-filter ${showFilters ? "active" : ""}`} onClick={() => setShowFilters(!showFilters)} style={{ backgroundColor: showFilters ? "#e0e7ff" : "", color: showFilters ? "#4338ca" : "" }}>
                    <Filter size={18} /> Filtros
                  </button>
                  {showFilters && (
                    <div className="filters-mov fade-in">
                          <button
                              type="button"
                              className="filters-close"
                              onClick={() => setShowFilters(false)}
                              title="Cerrar"
                            >
                              ×
                          </button>
                      <div className="filter-group">
                        <label>Tipo de Movimiento</label>
                        <div className="filter-chips">
                          {["todos", "rutas", "interno"].map(tipo => (
                            <button key={tipo} className={`chip ${tipoFiltro === tipo ? "active" : ''}`} onClick={() => setTipoFiltro(tipo)}>
                              {tipo === "todos" ? "Todos" : tipo === "rutas" ? "Rutas" : "Interno"}
                              {tipoFiltro === tipo && <Check size={12}/>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="filter-group">
                        <label>Estado</label>
                        <div className="filter-chips">
                          {["todos", "pendiente", "en progreso", "finalizado", "anulado"].map(est => (
                            <button
                              key={est}
                              className={`chip ${estadoFiltro === est ? "active" : ""}`}
                              onClick={() => setEstadoFiltro(est)}
                            >
                              {est === "todos" ? "Todos" : est.toUpperCase()}
                              {estadoFiltro === est && <Check size={12} />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="filter-group">
                        <label>Rango de fechas</label>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <small className="text-gray-400">Desde</small>
                            <input type="date" className="discord-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <small className="text-gray-400">Hasta</small>
                            <input type="date" className="discord-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn-text-only"
                        onClick={() => {
                          setTipoFiltro("todos");
                          setSearchTerm("");
                          setEstadoFiltro("todos");
                          setDateFrom("");
                          setDateTo("");
                        }}
                      >
                        Limpiar filtros
                      </button>
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
                                <tr key={`${m.es_local ? "interno" : (m.tipo_obj || "vale")}::${m.id}::${m.id_vale_ref || ""}`}>
                                    <td>{m.fecha}</td>
                                    <td>
                                        <span className={`badge-estado ${m.es_local ? 'badge-interno' : 'badge-ruta'}`}>
                                            {m.es_local ? 'INTERNO' : 'RUTA'}
                                        </span>
                                    </td>
                                    <td>
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
                                            
                                            {/* ✅ SOLO VISIBLE PARA ADMIN Y MASTER_ADMIN */}
                                            {canDelete && (
                                              <button className="btn-action danger btn-small"
                                                      onClick={() => handleDelete(m)}
                                                      title={esMasterAdmin ? "Eliminar permanente" : "Ocultar (soft delete)"}>
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
        {activeTab === "traslados" && (
          <div className="discord-card historial-card fade-in">
            <div className="toolbar-section relative">
              <div className="search-bar-modern">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por chofer, vehículo, grupo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                className="btn-filter"
                onClick={() => loadTraslados()}
                title="Recargar"
              >
                Recargar
              </button>
            </div>

            <div className="table-responsive">
              <table className="historial-table">
                <thead>
                  <tr>
                    <th>Fecha salida</th>
                    <th>Fecha entrega</th>
                    <th>Chofer</th>
                    <th>Vehículo</th>
                    <th>Materiales</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {traslados
                    .filter(t => {
                      const term = (searchTerm || "").toLowerCase();
                      const text = `${t.grupo_ruta || ""} ${t.chofer || ""} ${t.vehiculo || ""} ${t.origen || ""} ${t.destino || ""}`.toLowerCase();
                      return term ? text.includes(term) : true;
                    })
                    .map(t => (
                      <tr key={t.grupo_ruta || t.id_vale_ref}>
                        <td>{t.fecha_salida || "-"}</td>
                        <td>{t.fecha_entrega || "-"}</td>
                        <td>
                          <strong>{t.chofer || "Sin chofer"}</strong>
                          <div className="text-gray-400 text-xs">
                            {t.origen || ""} → {t.destino || ""}
                          </div>
                        </td>
                        <td>{t.vehiculo || "Sin vehículo"}</td>
                        <td>
                          <span
                            className="badge-estado"
                            style={{
                              background: "#e0f2fe",
                              color: "#0369a1",
                              border: "1px solid #bae6fd",
                              width: "fit-content",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px"
                            }}
                          >
                            <Layers size={14} /> {t.items_count || 0} items
                          </span>
                        </td>
                        <td className="actions-cell">
                          <div className="actions-group">
                            <button
                              type="button"
                              className="btn-action secondary btn-icon-only"
                              onClick={(e) => handleVerTrayecto(t, e)}
                              title="Ver trayecto"
                            >
                              <MapIcon size={16} />
                            </button>
                            <button
                              className="btn-action secondary btn-icon-only"
                              onClick={() => handlePrintTraslado(t, true)}
                              title="Previsualizar PDF"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="btn-print btn-icon-only"
                              onClick={() => handlePrintTraslado(t, false)}
                              title="Descargar PDF"
                            >
                              <Printer size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {traslados.length === 0 && (
              <div className="text-center p-5 text-gray-500">
                No hay traslados finalizados para mostrar.
              </div>
            )}
          </div>
        )}

        {showWizard && ( 
            <div className="modal-backdrop">
                <div className="discord-card modal-wizard relative" style={{ width: '95%', maxWidth: '1400px', height: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <button
                      onClick={closeWizardPreserveData}
                      className="cerrar-newruta"
                      title="Cerrar (se guarda el progreso)"
                    >
                      <X size={24} />
                    </button>

                    <div className="wizard-header pr-12">
                        <h2>Nueva Ruta</h2>
                        <div className="wizard-steps">
                          <span className={`step ${step>=1 ? 'active':''}`}>1. Ruta</span>
                          <div className="line"></div>
                          <span className={`step ${step>=2 ? 'active':''}`}>2. Carga</span>
                          <div className="line"></div>
                          <span className={`step ${step>=3 ? 'active':''}`}>3. Asignación</span>
                        </div>
                    </div>
                    
                    <div className="wizard-body">
                        {step === 1 && (
                            <div className="fade-in">
                                <h3 className="flex gap-2 items-center"><Truck/> Configuración de Salida</h3>
                                <div className="wizard-row">
                                    <div className="input-group wizard-col">
                                        <label>Depósito Origen</label>
                                        {(esMasterAdmin || !userDepositoId) ? (
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
                                    </div>
                                </div>
                                <div className="input-group mt-4">
                                    <label>Observaciones</label>
                                    <textarea className="discord-input" value={routeConfig.observacion} onChange={e=>setRouteConfig({...routeConfig, observacion: e.target.value})} placeholder="Detalles del viaje..."/>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
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
                                                             <select
                                                                className="discord-select"
                                                                value={itemTemp.id_lote}
                                                                onChange={(e) => setItemTemp({ ...itemTemp, id_lote: e.target.value })}
                                                                disabled={!itemTemp.id_material}
                                                              >
                                                                <option value="">-- Seleccionar Lote --</option>
                                                                {lotesDisponibles.map(l => (
                                                                  <option key={l.lote_id} value={l.lote_id}>
                                                                    Lote {l.lote_id} • Disp: {l.disponible_wiz} • {l.codigo || ""}
                                                                  </option>
                                                                ))}
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

                        {step === 3 && (
                          <div className="fade-in">
                            <div className="input-group wizard-col">
                              <label>Chofer (Obligatorio)</label>
                              <select
                                className="discord-select"
                                value={routeConfig.id_chofer}
                                onChange={(e) => setRouteConfig({ ...routeConfig, id_chofer: e.target.value })}
                              >
                                <option value="">-- Seleccionar Chofer --</option>
                                  {choferes.map((c, idx) => {
                                    const id = (c.ID_EMPLEADO ?? c.id) ?? `idx-${idx}`;
                                    const nombreBase = (c.nombre ?? `${c.NOMBRE || ""} ${c.APELLIDO || ""}`.trim());
                                    const nombre = (nombreBase && nombreBase.length > 0) ? nombreBase : `Chofer ${idx + 1}`;
                                    return (
                                      <option key={`ch-${id}`} value={c.ID_EMPLEADO ?? c.id ?? ""}>
                                        {nombre}
                                      </option>
                                    );
                                })}
                              </select>
                            </div>

                            <div className="input-group wizard-col">
                              <label>Vehículo (Obligatorio)</label>
                              <select
                                className="discord-select"
                                value={routeConfig.id_vehiculo}
                                onChange={(e) => setRouteConfig({ ...routeConfig, id_vehiculo: e.target.value })}
                              >
                                <option value="">-- Seleccionar Vehículo --</option>
                                  {vehiculosList
                                    .filter(v => {
                                      const estado = String(v.estado || "desconocido").toLowerCase();
                                      const capacidad = Number(v.CAPACIDAD_PUNTOS || 0);
                                      const disponible = estado === "disponible";
                                      const alcanza = capacidad >= totalPuntos;
                                      return disponible && alcanza;
                                    })
                                    .map((v) => {
                                      const id = v.ID_VEHICULO ?? v.id;
                                      const estado = String(v.estado || "desconocido").toLowerCase();
                                      const capacidad = Number(v.CAPACIDAD_PUNTOS || 0);
                                      const label = `${v.MATRICULA || "-"} ${v.MARCA || ""} ${v.MODELO || ""} • Cap: ${capacidad} pts • ${estado}`;
                                      return (
                                        <option key={`veh-${id}`} value={id}>
                                          {label}
                                        </option>
                                      );
                                    })
                                  }
                              </select>
                              <small style={{ color: "#94a3b8" }}>
                                Total planificado: <b>{totalPuntos.toFixed(2)}</b> pts. Se bloquean vehículos sin capacidad o no disponibles.
                              </small>
                            </div>
                          </div>
                        )}
                    </div>

                    {showTrayectoModal && (
                      <div className="modal-backdrop">
                        <div className="discord-card modal-wizard relative" style={{ width: "95%", maxWidth: 1100, height: "85vh" }}>
                          <button
                            onClick={() => { setShowTrayectoModal(false); setTrayectoData(null); }}
                            className="cerrar-newruta"
                            title="Cerrar"
                          >
                            <X size={24} />
                          </button>

                          <div className="wizard-header pr-12">
                            <h2>Trayecto del Traslado</h2>
                            <small className="text-gray-400">
                              {trasladoSeleccionado?.grupo_ruta ? `Grupo: ${trasladoSeleccionado.grupo_ruta}` : ""}
                            </small>
                          </div>

                          <div className="wizard-body" style={{ height: "calc(85vh - 130px)" }}>
                            {trayectoLoading && (
                              <div className="loading-map" style={{ height: "100%" }}>
                                <div className="spinner"></div>
                                <p>Cargando trayecto...</p>
                              </div>
                            )}

                              {!trayectoLoading && trayectoData && (
                                    (() => {
                                          const gps = trayectoData.gps || [];
                                          const plan = trayectoData.plan || [];
                                          const pts = (gps.length >= 2 ? gps : plan);
                                          const base = (gps.length >= 2 ? gps : plan);
                                          const center = pts?.length ? [pts[0].lat, pts[0].lng] : [-25.2800, -57.6350];

                                          return (
                                            <div style={{ height: "100%", width: "100%" }}>
                                              <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
                                                <MapUpdater center={center} zoom={13} />
                                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                {pts.length >= 2 && (
                                                  <Polyline
                                                    positions={pts.map(p => [p.lat, p.lng])}
                                                    weight={5}
                                                  />
                                                )}
                                                {(plan.length >= 1) && (
                                                  <Marker position={[plan[0].lat, plan[0].lng]}>
                                                    <Popup><strong>Origen</strong></Popup>
                                                  </Marker>
                                                )}
                                                {(plan.length >= 2) && (
                                                  <Marker position={[plan[plan.length - 1].lat, plan[plan.length - 1].lng]}>
                                                    <Popup><strong>Destino</strong></Popup>
                                                  </Marker>
                                                )}
                                              </MapContainer>
                                            </div>
                                          );
                                        })()
                                      )}

                                      {!trayectoLoading && !trayectoData && (
                                        <div className="text-center p-5 text-gray-500">
                                          No hay datos para mostrar.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                        <div className="wizard-footer">
                          <button
                            className="btn-status"
                            type="button"
                            onClick={() => {
                              if (step > 1) setStep(step - 1);
                              else setShowWizard(false);
                            }}
                          >
                            {step === 1 ? "Cerrar" : "Atrás"}
                          </button>

                          <button
                            className="btn-save"
                            type="button"
                            onClick={() => {
                              if (step === 1) {
                                if (!routeConfig.id_origen) return alert("Selecciona el Depósito de Origen.");
                                if (stops.length === 0) return alert("Selecciona al menos 1 parada/destino.");
                                setStep(2);
                                setEditingStopIndex(0);
                                return;
                              }
                              if (step === 2) {
                                const emptyStops = stops.filter(s => (s.items || []).length === 0);
                                if (emptyStops.length > 0) {
                                  return alert(`La parada "${emptyStops[0].nombre}" no tiene carga asignada.`);
                                }
                                setStep(3);
                                return;
                              }
                              if (step === 3) {
                                if (!routeConfig.id_chofer) return alert("Debes seleccionar un Chofer.");
                                if (!routeConfig.id_vehiculo) return alert("Debes seleccionar un Vehículo.");
                                handleSubmit();
                              }
                            }}
                          >
                            {step === 3 ? "Finalizar y Crear Ruta" : "Siguiente"}
                          </button>
                        </div>
                    </div>
                </div>
        )}

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