// src/pages/Materiales.jsx
import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import {
  Box,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Package,
  Layers,
  Ruler,
  Hash,
  Edit,
  Trash2,
  X,
  Save,
  ShieldAlert,
  Truck,
  Check,
  ShoppingCart,
} from "lucide-react";
import LotesModal from "../components/LotesModal";
import SolicitudModal from "../components/SolicitudModal";
import "../styles/Materiales.css";

const API_URL = "http://127.0.0.1:5000";

const Materiales = () => {
  const [materiales, setMateriales] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS PARA FILTROS Y BÚSQUEDA ---
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [filterStock, setFilterStock] = useState("Todos");

  // --- ESTADOS PARA MODALES ---
  const [showModal, setShowModal] = useState(false);
  const [selectedMaterialLotes, setSelectedMaterialLotes] = useState(null);

  // --- ESTADOS PARA SOLICITUD ---
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);
  const [solicitudMat, setSolicitudMat] = useState(null);

  // Formulario y Permisos
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [rolUser, setRolUser] = useState("");
  const [hasAccess, setHasAccess] = useState(false);

  const [formData, setFormData] = useState({
    codigo_unico: "",
    nombre: "",
    cantidad: "",
    unidad_medida: "unid",
    categoria: "General",
    stock_minimo: "5",
  });

  useEffect(() => {
    const rol = sessionStorage.getItem("user_rol");
    const permisosStr = sessionStorage.getItem("user_permissions");
    const permisos = permisosStr ? JSON.parse(permisosStr) : [];

    setRolUser(rol);

    const canAccess =
      rol === "Master_Admin" ||
      rol === "Admin" ||
      rol === "Personal_Inventario" ||
      permisos.includes("gestion_materiales");

    setHasAccess(canAccess);

    if (canAccess) {
      loadData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [matData, depData] = await Promise.all([
        apiFetch(`${API_URL}/api/materiales`),
        apiFetch(`${API_URL}/api/depositos`),
      ]);
      setMateriales(matData || []);
      setDepositos(depData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER PARA SOLICITUD GENERAL ---
  const openSolicitudGeneral = () => {
    setSolicitudMat(null);
    setShowSolicitudModal(true);
  };

  const handleConfirmarSolicitud = async (datos) => {
    try {
      const response = await apiFetch(`${API_URL}/api/solicitudes`, {
        method: "POST",
        body: JSON.stringify(datos),
      });

      if (response.success) {
        alert("✅ Solicitud enviada exitosamente.");
        setShowSolicitudModal(false);
        setSolicitudMat(null);
      } else {
        alert("Error: " + (response.error || "No se pudo crear la solicitud"));
      }
    } catch (e) {
      alert("Error de conexión: " + e.message);
    }
  };

  // --- LÓGICA DE FILTRADO (más segura ante nulls) ---
  const filteredMaterials = materiales.filter((m) => {
    const nombre = (m.NOMBRE || "").toLowerCase();
    const codigo = String(m.CODIGO_UNICO ?? "");
    const matchesText =
      nombre.includes(searchTerm.toLowerCase()) || codigo.includes(searchTerm);

    const matchesCategory =
      filterCategory === "Todas" || m.CATEGORIA === filterCategory;

    let matchesStock = true;
    const stockMinimo = m.STOCK_MINIMO || 5;
    if (filterStock === "Bajo") {
      matchesStock = (m.CANTIDAD ?? 0) <= stockMinimo;
    } else if (filterStock === "Normal") {
      matchesStock = (m.CANTIDAD ?? 0) > stockMinimo;
    }

    return matchesText && matchesCategory && matchesStock;
  });

  if (!loading && !hasAccess) {
    return (
      <div
        className="fade-in"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
          color: "#4b5563",
        }}
      >
        <ShieldAlert size={64} style={{ color: "#ef4444", marginBottom: 20 }} />
        <h1>Acceso Restringido</h1>
        <p>No tienes los permisos necesarios para ver el inventario.</p>
      </div>
    );
  }

  const totalItems = materiales.length;
  const stockBajo = materiales.filter(
    (m) => (m.CANTIDAD ?? 0) <= (m.STOCK_MINIMO || 5)
  ).length;

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const openNewModal = () => {
    setFormData({
      codigo_unico: "",
      nombre: "",
      cantidad: "",
      unidad_medida: "unid",
      categoria: "General",
      stock_minimo: "5",
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (material) => {
    setFormData({
      codigo_unico: material.CODIGO_UNICO,
      nombre: material.NOMBRE,
      cantidad: material.CANTIDAD,
      unidad_medida: material.UNIDAD || "unid",
      categoria: material.CATEGORIA || "General",
      stock_minimo: material.STOCK_MINIMO || 5,
    });
    setCurrentId(material.ID_MATERIAL);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isEditing
      ? `${API_URL}/api/materiales/${currentId}`
      : `${API_URL}/api/materiales`;
    const method = isEditing ? "PUT" : "POST";
    try {
      await apiFetch(endpoint, { method, body: JSON.stringify(formData) });
      setShowModal(false);
      loadData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este material?")) return;
    try {
      await apiFetch(`${API_URL}/api/materiales/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // ✅ Abrir LotesModal con depósitos ya cargados
  const openLotesModal = (material) => {
    if (!depositos || depositos.length === 0) {
      alert("⏳ Aún no se cargaron los depósitos. Intenta de nuevo en 1 segundo.");
      return;
    }
    setSelectedMaterialLotes(material);
  };

  const renderCategoryBadge = (cat) => {
    const styleMap = {
      Conductores: "badge-blue",
      Aisladores: "badge-purple",
      Protección: "badge-orange",
      Ferretería: "badge-gray",
      General: "badge-default",
    };
    return (
      <span className={`category-badge ${styleMap[cat] || "badge-default"}`}>
        {cat}
      </span>
    );
  };

  const categoriasPosibles = [
    "Todas",
    "Conductores",
    "Aisladores",
    "Protección",
    "Ferretería",
    "General",
  ];
  const estadosPosibles = [
    { label: "Todos los Estados", value: "Todos" },
    { label: "Stock Normal", value: "Normal" },
    { label: "En Falta / Crítico", value: "Bajo" },
  ];

  return (
    <div className="fade-in" style={{ width: "100%" }}>
      <div className="page-header">
        <div>
          <h1>Inventario</h1>
          <p className="subtitle">Gestión de materiales y stock del depósito.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn-new"
            onClick={openSolicitudGeneral}
            style={{ backgroundColor: "#f59e0b" }}
          >
            <ShoppingCart size={18} /> Nueva Solicitud
          </button>

          <button className="btn-new" onClick={openNewModal}>
            <Plus size={18} /> Nuevo Material
          </button>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon bg-blue">
            <Package size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{totalItems}</span>
            <span className="metric-label">Total Materiales</span>
          </div>
        </div>
        <div className="metric-card">
          <div className={`metric-icon ${stockBajo > 0 ? "bg-red" : "bg-green"}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stockBajo}</span>
            <span className="metric-label">Stock Crítico</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR Y FILTROS */}
      <div className="toolbar-section" style={{ position: "relative" }}>
        <div className="search-bar-modern">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          className={`btn-filter ${showFilters ? "active" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
          style={{
            backgroundColor: showFilters ? "#e0e7ff" : "",
            color: showFilters ? "#4338ca" : "",
          }}
        >
          <Filter size={18} /> Filtros
        </button>

        {showFilters && (
          <div className="filters-dropdown fade-in">
            <div className="filter-group">
              <label>Categoría</label>
              <div className="filter-chips">
                {categoriasPosibles.map((cat) => (
                  <button
                    key={cat}
                    className={`chip ${filterCategory === cat ? "active" : ""}`}
                    onClick={() => setFilterCategory(cat)}
                  >
                    {cat} {filterCategory === cat && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <label>Estado de Stock</label>
              <select
                className="discord-select"
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
              >
                {estadosPosibles.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-footer">
              <button
                className="btn-text-only"
                onClick={() => {
                  setFilterCategory("Todas");
                  setFilterStock("Todos");
                  setSearchTerm("");
                }}
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TABLA */}
      <div className="table-container fade-in">
        <table className="styled-table materials-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Stock Global</th>
              <th>Unidad</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center p-5">
                  Cargando inventario...
                </td>
              </tr>
            ) : filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state-row">
                  {materiales.length === 0
                    ? "No hay materiales registrados."
                    : "No se encontraron coincidencias."}
                </td>
              </tr>
            ) : (
              filteredMaterials.map((m) => {
                const isLowStock = (m.CANTIDAD ?? 0) <= (m.STOCK_MINIMO || 5);
                return (
                  <tr key={m.ID_MATERIAL}>
                    <td className="font-mono">#{m.CODIGO_UNICO}</td>
                    <td className="font-bold text-dark">{m.NOMBRE}</td>
                    <td>{renderCategoryBadge(m.CATEGORIA)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          className={`stock-indicator ${isLowStock ? "stock-low" : "stock-ok"}`}
                        >
                          {m.CANTIDAD ?? 0}
                        </span>
                        {isLowStock && (
                          <span style={{ fontSize: "0.7rem", color: "#dc2626", fontWeight: "bold" }}>
                            EN FALTA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted">{m.UNIDAD || m.UNIDAD_MEDIDA}</td>
                    <td style={{ textAlign: "right" }}>
                      {/* VER LOTES */}
                      <button
                        className="btn-icon"
                        onClick={() => openLotesModal(m)}
                        title="Gestionar Lotes y Transferencias"
                        style={{
                          color: "#6366f1",
                          backgroundColor: "#eef2ff",
                          marginRight: "5px",
                        }}
                      >
                        <Truck size={18} />
                      </button>

                      {/* EDITAR */}
                      <button className="btn-icon" onClick={() => openEditModal(m)} title="Editar">
                        <Edit size={18} />
                      </button>

                      {/* ELIMINAR */}
                      {hasAccess && (
                        <button
                          className="btn-icon danger"
                          onClick={() => handleDelete(m.ID_MATERIAL)}
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODALES */}
      {selectedMaterialLotes && (
        <LotesModal
          material={selectedMaterialLotes}
          depositos={depositos}
          onClose={() => {
            setSelectedMaterialLotes(null);
            loadData();
          }}
        />
      )}

      {showSolicitudModal && (
        <SolicitudModal
          materialInicial={solicitudMat}
          depositos={depositos}
          onClose={() => setShowSolicitudModal(false)}
          onConfirm={handleConfirmarSolicitud}
        />
      )}

      {showModal && (
        <div className="modal-backdrop">
          <div className="discord-card modal-material">
            <div className="modal-header-simple">
              <h2>{isEditing ? "Editar Material" : "Nuevo Material"}</h2>
              <button className="close-btn-simple" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <div className="input-group">
                  <label>
                    <Hash size={14} /> Código Único
                  </label>
                  <input
                    type="number"
                    name="codigo_unico"
                    required
                    value={formData.codigo_unico}
                    onChange={handleChange}
                    placeholder="Ej: 1001"
                    disabled={isEditing}
                  />
                </div>
                <div className="input-group">
                  <label>
                    <Layers size={14} /> Categoría
                  </label>
                  <select
                    name="categoria"
                    className="discord-select"
                    value={formData.categoria}
                    onChange={handleChange}
                  >
                    {categoriasPosibles
                      .filter((c) => c !== "Todas")
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>
                  <Box size={14} /> Nombre / Descripción
                </label>
                <input
                  type="text"
                  name="nombre"
                  required
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Cable Preensamblado 25mm"
                />
              </div>

              <div className="form-grid-3">
                <div className="input-group">
                  <label>Stock Inicial</label>
                  <input
                    type="number"
                    name="cantidad"
                    required
                    value={formData.cantidad}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </div>
                <div className="input-group">
                  <label>
                    <Ruler size={14} /> Unidad
                  </label>
                  <input
                    type="text"
                    name="unidad_medida"
                    required
                    value={formData.unidad_medida}
                    onChange={handleChange}
                    placeholder="m, unid..."
                  />
                </div>
                <div className="input-group">
                  <label>
                    <AlertTriangle size={14} /> Mínimo
                  </label>
                  <input
                    type="number"
                    name="stock_minimo"
                    value={formData.stock_minimo}
                    onChange={handleChange}
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-status" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save">
                  <Save size={16} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Materiales;
