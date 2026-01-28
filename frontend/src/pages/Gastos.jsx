// src/pages/Gastos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";
import {
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  X,
  Truck,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { generarReporteGastosPDF } from "../utils/pdfGenerator";
import "../styles/Gastos.css";

const Gastos = () => {
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const currentYear = new Date().getFullYear();
  const [filtroCat, setFiltroCat] = useState("");
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
  const [filtroAnio, setFiltroAnio] = useState(currentYear);

  const [newGasto, setNewGasto] = useState({
    titulo: "",
    monto: "",
    categoria_id: "",
    descripcion: "",
    id_vehiculo: "",
  });

  // =========================
  // ✅ CONTEXTO USUARIO
  // =========================
  const userRoleRaw =
    sessionStorage.getItem("user_rol") ||
    sessionStorage.getItem("rol_nombre") ||
    "";
  const userRole = (userRoleRaw || "").trim();
  const userPermissions = JSON.parse(
    sessionStorage.getItem("user_permissions") || "[]"
  );

  const roleLower = userRole.toLowerCase();
  const esMasterAdmin = roleLower === "master_admin";
  const esAdmin = roleLower === "admin";
  const esChofer = roleLower === "chofer";

  // Puede gestionar (ver todo, borrar, etc.)
  const puedeGestionarGastos = esMasterAdmin || esAdmin || userPermissions.includes("gestion_gastos");

  // ✅ Chofer también puede acceder, pero con restricciones de categorías
  const puedeAccederGastos = puedeGestionarGastos || esChofer;

  // =========================
  // ✅ HELPERS CHOFER (CATEGORÍAS)
  // =========================
  const normalize = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const categoriaPermitidaChofer = (nombreCat) => {
    const n = normalize(nombreCat);
    return n.includes("mantenimiento") || n.includes("viatico") || n.includes("peaje");
  };

  // =========================
  // ✅ MEMOS (NO CONDICIONALES)
  // =========================
  const categoriasVisibles = useMemo(() => {
    if (!esChofer) return categorias || [];
    return (categorias || []).filter((c) => categoriaPermitidaChofer(c?.nombre));
  }, [categorias, esChofer]);

  const gastosFiltrados = useMemo(() => {
    const base = Array.isArray(gastos) ? gastos : [];
    return base.filter((g) => (filtroCat ? g.categoria === filtroCat : true));
  }, [gastos, filtroCat]);

  const totalGastos = useMemo(() => {
    return (gastosFiltrados || []).reduce(
      (sum, g) => sum + (Number(g.monto) || 0),
      0
    );
  }, [gastosFiltrados]);

  const catSeleccionada = useMemo(() => {
    return (categorias || []).find((c) => String(c.id) === String(newGasto.categoria_id));
  }, [categorias, newGasto.categoria_id]);

  const nombreCat = useMemo(() => {
    return normalize(catSeleccionada?.nombre || "");
  }, [catSeleccionada]);

  const requiereVehiculo = useMemo(() => {
    // Mantengo tu lógica original, pero normalizada
    return (
      nombreCat.includes("mantenimiento") ||
      nombreCat.includes("viatico") ||
      nombreCat.includes("peaje") ||
      nombreCat.includes("combustible")
    );
  }, [nombreCat]);

  // =========================
  // ✅ FETCH
  // =========================
  useEffect(() => {
    if (puedeAccederGastos) {
      fetchData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [filtroMes, filtroAnio]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroMes) params.append("mes", filtroMes);
      if (filtroAnio) params.append("year", filtroAnio);

      const [gastosData, auxData] = await Promise.all([
        apiFetch(`/api/gastos?${params.toString()}`),
        apiFetch("/api/gastos/auxiliar"),
      ]);

      setGastos(Array.isArray(gastosData) ? gastosData : []);
      if (auxData) {
        setCategorias(auxData.categorias || []);
        setVehiculos(auxData.vehiculos || []);
      }
    } catch (error) {
      // Si el backend está restringiendo, acá se va a notar (403, etc.)
      console.error(error);
      setGastos([]);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // ✅ GUARDAR
  // =========================
  const handleCreate = async (e) => {
    e.preventDefault();

    // ✅ Restricción Chofer (solo peaje/viatico/mantenimiento)
    if (esChofer) {
      const nombre = catSeleccionada?.nombre || "";
      if (!categoriaPermitidaChofer(nombre)) {
        alert("⛔ Como Chofer solo podés reportar: Peaje / Viáticos / Mantenimiento.");
        return;
      }
    }

    try {
      await apiFetch("/api/gastos", {
        method: "POST",
        body: JSON.stringify(newGasto),
      });
      setShowModal(false);
      setNewGasto({
        titulo: "",
        monto: "",
        categoria_id: "",
        descripcion: "",
        id_vehiculo: "",
      });
      fetchData();
    } catch (error) {
      alert("Error al guardar: " + (error?.message || "desconocido"));
    }
  };

  // =========================
  // ✅ BORRAR (solo gestores)
  // =========================
  const handleDelete = async (id) => {
    if (!puedeGestionarGastos) return;
    if (!window.confirm("¿Eliminar?")) return;
    try {
      await apiFetch(`/api/gastos/${id}`, { method: "DELETE" });
      setGastos((prev) => prev.filter((g) => g.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  // =========================
  // ✅ PDF
  // =========================
  const handleDownloadPDF = () => {
    const userName = sessionStorage.getItem("user_nombre") || "Usuario";

    let nombreDeposito = "Mi Depósito";

    if (esMasterAdmin) {
      nombreDeposito = "Global (Todos los Depósitos)";
    } else {
      if (gastosFiltrados.length > 0 && gastosFiltrados[0].deposito) {
        nombreDeposito = gastosFiltrados[0].deposito;
      } else {
        nombreDeposito =
          sessionStorage.getItem("user_deposito_nombre") || "Mi Depósito";
      }
    }

    const meses = [
      "Todo",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const nombrePeriodo = `${filtroMes ? meses[filtroMes] : "Todos"} ${filtroAnio}`;

    generarReporteGastosPDF(gastosFiltrados, userName, nombrePeriodo, nombreDeposito);
  };

  // =========================
  // ✅ RENDER (condicional SOLO UI, NO hooks)
  // =========================
  if (!puedeAccederGastos) {
    return (
      <div
        className="fade-in"
        style={{ textAlign: "center", padding: "50px", color: "#4b5563" }}
      >
        <ShieldAlert size={64} style={{ color: "#ef4444", marginBottom: 20 }} />
        <h1>Acceso Restringido</h1>
      </div>
    );
  }

  return (
    <div className="gastos-page fade-in">
      <div className="gastos-header">
        <div>
          <h1>Gestión de Gastos</h1>
          <p className="subtitle">Control financiero</p>

          {esChofer && (
            <small style={{ color: "#6b7280" }}>
              (Chofer) Permitido: Peaje / Viáticos / Mantenimiento
            </small>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-secondary" onClick={handleDownloadPDF}>
            <FileText size={18} /> PDF
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Nuevo
          </button>
        </div>
      </div>

      <div className="gastos-stats">
        <div className="stat-card total">
          <div className="icon-circle">
            <DollarSign size={20} />
          </div>
          <div>
            <h3>Total</h3>
            <p className="stat-value">Gs. {totalGastos.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card count">
          <div className="icon-circle">
            <Calendar size={20} />
          </div>
          <div>
            <h3>Registros</h3>
            <p className="stat-value">{gastosFiltrados.length}</p>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Año</label>
          <select
            className="filter-select"
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(e.target.value)}
          >
            <option value="">Todos</option>
            {[currentYear, currentYear - 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Mes</label>
          <select
            className="filter-select"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
          >
            <option value="">Todos</option>
            {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map(
              (m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              )
            )}
          </select>
        </div>

        <div className="filter-group">
          <label>Categoría</label>
          <select
            className="filter-select"
            value={filtroCat}
            onChange={(e) => setFiltroCat(e.target.value)}
          >
            <option value="">Todas</option>
            {(categoriasVisibles || []).map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="gastos-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Categoría</th>
              <th>Vehículo</th>
              <th>Monto</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>
                  Cargando...
                </td>
              </tr>
            ) : gastosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>
                  No hay gastos para este filtro.
                </td>
              </tr>
            ) : (
              gastosFiltrados.map((g) => (
                <tr key={g.id}>
                  <td>{g.fecha_iso}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{g.titulo}</span>
                    <br />
                    <small style={{ color: "#999" }}>{g.descripcion}</small>
                  </td>
                  <td>
                    <span
                      className="cat-badge"
                      style={{ color: g.color, background: g.color + "20" }}
                    >
                      {g.categoria}
                    </span>
                  </td>
                  <td>
                    {g.vehiculo ? (
                      <>
                        <Truck size={12} /> {g.vehiculo}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="monto-cell">Gs. {Number(g.monto || 0).toLocaleString()}</td>
                  <td>
                    {puedeGestionarGastos ? (
                      <button className="btn-icon" onClick={() => handleDelete(g.id)}>
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="gastos-modal-overlay">
          <div className="gastos-modal-content">
            <div className="gastos-modal-header">
              <h3>Nuevo Gasto</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Título</label>
                <input
                  className="form-input"
                  autoFocus
                  type="text"
                  value={newGasto.titulo}
                  onChange={(e) => setNewGasto({ ...newGasto, titulo: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "15px" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Monto</label>
                  <input
                    className="form-input"
                    type="number"
                    value={newGasto.monto}
                    onChange={(e) => setNewGasto({ ...newGasto, monto: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>Categoría</label>
                  <select
                    className="form-select"
                    value={newGasto.categoria_id}
                    onChange={(e) =>
                      setNewGasto({
                        ...newGasto,
                        categoria_id: e.target.value,
                        id_vehiculo: "",
                      })
                    }
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {(categoriasVisibles || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>

                  {esChofer && (
                    <small style={{ color: "#6b7280" }}>
                      Solo disponible: Peaje / Viáticos / Mantenimiento
                    </small>
                  )}
                </div>
              </div>

              {requiereVehiculo && (
                <div className="form-group slide-in-animation">
                  <label style={{ color: "#2563eb" }}>Asignar Vehículo *</label>
                  <select
                    className="form-select"
                    value={newGasto.id_vehiculo}
                    onChange={(e) => setNewGasto({ ...newGasto, id_vehiculo: e.target.value })}
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    {(vehiculos || []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  value={newGasto.descripcion}
                  onChange={(e) => setNewGasto({ ...newGasto, descripcion: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gastos;
