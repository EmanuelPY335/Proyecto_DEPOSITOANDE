// src/pages/Buzon.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import {
  Search, RefreshCcw,
  Star, Trash2, Mail, MailOpen, ArrowLeft,
  Filter, X, StarOff, Eye, EyeOff, Calendar, Building,
  CheckSquare, Square
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/Buzon.css";

const Buzon = () => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [filteredNotificaciones, setFilteredNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    year: "",
    deposito: "",
    starred: false,
    unread: false,
    read: false
  });
  const navigate = useNavigate();

  // Extraer años y depósitos únicos de las notificaciones
  const years = [...new Set(notificaciones
    .map(n => n.fecha ? new Date(n.fecha).getFullYear() : null)
    .filter(year => year)
  )].sort((a, b) => b - a);

  const depositos = [...new Set(notificaciones
    .map(n => n.deposito)
    .filter(deposito => deposito)
  )].sort();

  useEffect(() => {
    loadBuzon();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [notificaciones, filters, searchTerm]);

  const loadBuzon = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/buzon");
      const formatted = (data || []).map(n => ({
        ...n,
        sender: n.sender || "Sistema SISDEPO",
        starred: n.starred || false
      }));
      setNotificaciones(formatted);
      setFilteredNotificaciones(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...notificaciones];

    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(n =>
        n.mensaje?.toLowerCase().includes(term) ||
        n.sender?.toLowerCase().includes(term) ||
        n.deposito?.toLowerCase().includes(term)
      );
    }

    // Filtro por año
    if (filters.year) {
      filtered = filtered.filter(n => {
        const year = n.fecha ? new Date(n.fecha).getFullYear() : null;
        return year === parseInt(filters.year);
      });
    }

    // Filtro por depósito
    if (filters.deposito) {
      filtered = filtered.filter(n =>
        n.deposito === filters.deposito
      );
    }

    // Filtro por favoritos
    if (filters.starred) {
      filtered = filtered.filter(n => n.starred);
    }

    // Filtro por leído/no leído
    if (filters.unread) {
      filtered = filtered.filter(n => !n.leida);
    }

    if (filters.read) {
      filtered = filtered.filter(n => n.leida);
    }

    setFilteredNotificaciones(filtered);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.length === filteredNotificaciones.length
        ? []
        : filteredNotificaciones.map(n => n.id)
    );
  };

  const handleRowClick = (e, noti) => {
    if (e.target.closest(".no-click-propagation")) return;
    if (noti.link && noti.link !== "#") navigate(noti.link);
  };

  const marcarLeida = async (id, e) => {
    e.stopPropagation();
    setNotificaciones(prev =>
      prev.map(n => n.id === id ? { ...n, leida: true } : n)
    );
    try {
      await apiFetch(`/api/buzon/${id}/leer`, { method: "PUT" });
    } catch {}
  };

  const marcarNoLeida = async (id, e) => {
    e.stopPropagation();
    setNotificaciones(prev =>
      prev.map(n => n.id === id ? { ...n, leida: false } : n)
    );
    try {
      await apiFetch(`/api/buzon/${id}/noleer`, { method: "PUT" });
    } catch {}
  };

  const toggleStar = async (id, e) => {
    e.stopPropagation();
    const currentState = notificaciones.find(n => n.id === id)?.starred || false;
    
    setNotificaciones(prev =>
      prev.map(n => n.id === id ? { ...n, starred: !currentState } : n)
    );
    
    try {
      await apiFetch(`/api/buzon/${id}/star`, {
        method: "PUT",
        body: JSON.stringify({ starred: !currentState })
      });
    } catch {}
  };

  const deleteNotificacion = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de eliminar esta notificación?")) {
      setNotificaciones(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
      
      try {
        await apiFetch(`/api/buzon/${id}`, { method: "DELETE" });
      } catch {}
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    if (window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} notificación(es)?`)) {
      setNotificaciones(prev => prev.filter(n => !selectedIds.includes(n.id)));
      
      try {
        await apiFetch("/api/buzon/batch", {
          method: "DELETE",
          body: JSON.stringify({ ids: selectedIds })
        });
      } catch {}
      
      setSelectedIds([]);
    }
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.length === 0) return;
    
    setNotificaciones(prev =>
      prev.map(n => selectedIds.includes(n.id) ? { ...n, leida: true } : n)
    );
    
    try {
      await apiFetch("/api/buzon/batch/read", {
        method: "PUT",
        body: JSON.stringify({ ids: selectedIds })
      });
    } catch {}
  };

  const markSelectedAsUnread = async () => {
    if (selectedIds.length === 0) return;
    
    setNotificaciones(prev =>
      prev.map(n => selectedIds.includes(n.id) ? { ...n, leida: false } : n)
    );
    
    try {
      await apiFetch("/api/buzon/batch/unread", {
        method: "PUT",
        body: JSON.stringify({ ids: selectedIds })
      });
    } catch {}
  };

  const toggleStarSelected = async () => {
    if (selectedIds.length === 0) return;
    
    // Determinar si todas las seleccionadas están marcadas como favoritas
    const allStarred = selectedIds.every(id =>
      notificaciones.find(n => n.id === id)?.starred
    );
    
    setNotificaciones(prev =>
      prev.map(n => 
        selectedIds.includes(n.id) 
          ? { ...n, starred: !allStarred } 
          : n
      )
    );
    
    try {
      await apiFetch("/api/buzon/batch/star", {
        method: "PUT",
        body: JSON.stringify({ 
          ids: selectedIds,
          starred: !allStarred 
        })
      });
    } catch {}
  };

  const clearFilters = () => {
    setFilters({
      year: "",
      deposito: "",
      starred: false,
      unread: false,
      read: false
    });
    setSearchTerm("");
  };

  return (
    <div className="buzon-layout fade-in">
      {/* HEADER */}
      <div className="buzon-header">
        {/* IZQUIERDA */}
        <div className="buzon-left">
          <button className="back-btn" onClick={() => navigate("/home")}>
            <ArrowLeft size={18} />
            <span>Inicio</span>
          </button>
        </div>

        {/* BUSCADOR */}
        <div className="buzon-search-bar">
          <Search size={18} />
          <input 
            placeholder="Buscar mensajes" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* Este es el único botón de filtro que mantenemos */}
          <button 
            className={`filter-btn ${Object.values(filters).some(f => f) || searchTerm ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filtrar mensajes"
          >
            <Filter size={18} />
          </button>
        </div>
        <Mail size={22} className="mail-icon" />
        
        {/* DERECHA */}
        <div className="buzon-title-right">
          <span>Buzón ({filteredNotificaciones.length})</span>
        </div>
      </div>

      {/* FILTROS */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-header">
            <h4>Filtros</h4>
            <button onClick={clearFilters}>
              <X size={16} /> Limpiar
            </button>
          </div>
          
          <div className="filters-grid">
            <div className="filter-group">
              <label><Calendar size={14} /> Año</label>
              <select 
                value={filters.year}
                onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
              >
                <option value="">Todos los años</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label><Building size={14} /> Depósito</label>
              <select 
                value={filters.deposito}
                onChange={(e) => setFilters(prev => ({ ...prev, deposito: e.target.value }))}
              >
                <option value="">Todos los depósitos</option>
                {depositos.map(dep => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
            </div>

            <div className="filter-group checkboxes">
              <label>
                <input 
                  type="checkbox"
                  checked={filters.starred}
                  onChange={(e) => setFilters(prev => ({ ...prev, starred: e.target.checked }))}
                />
                <Star size={14} /> Solo favoritos
              </label>
              <label>
                <input 
                  type="checkbox"
                  checked={filters.unread}
                  onChange={(e) => setFilters(prev => ({ ...prev, unread: e.target.checked, read: false }))}
                />
                <EyeOff size={14} /> No leídos
              </label>
              <label>
                <input 
                  type="checkbox"
                  checked={filters.read}
                  onChange={(e) => setFilters(prev => ({ ...prev, read: e.target.checked, unread: false }))}
                />
                <Eye size={14} /> Leídos
              </label>
            </div>
          </div>
        </div>
      )}

      {/* BODY */}
      <div className="buzon-body">
        {/* TOOLBAR */}
        <div className="buzon-toolbar">
          <div className="toolbar-group">
            <div className="checkbox-wrapper no-click-propagation" onClick={toggleSelectAll}>
              {selectedIds.length === filteredNotificaciones.length && selectedIds.length > 0
                ? <CheckSquare size={18} />
                : <Square size={18} />}
            </div>

            <button 
              className="tool-btn" 
              onClick={loadBuzon}
              title="Actualizar"
            >
              <RefreshCcw size={16} />
            </button>

            {selectedIds.length > 0 && (
              <>
                <button 
                  className="tool-btn danger"
                  onClick={deleteSelected}
                  title="Eliminar seleccionados"
                >
                  <Trash2 size={16} />
                </button>
                <button 
                  className="tool-btn"
                  onClick={markSelectedAsRead}
                  title="Marcar como leído"
                >
                  <Eye size={16} />
                </button>
                <button 
                  className="tool-btn"
                  onClick={markSelectedAsUnread}
                  title="Marcar como no leído"
                >
                  <EyeOff size={16} />
                </button>
                <button 
                  className="tool-btn"
                  onClick={toggleStarSelected}
                  title="Marcar/desmarcar favorito"
                >
                  <Star size={16} />
                </button>
              </>
            )}

            {/* AQUÍ SE ELIMINÓ EL BOTÓN DE FILTRO DUPLICADO */}
          </div>

          <span className="page-info">
            Mostrando {filteredNotificaciones.length} de {notificaciones.length} mensajes
            {selectedIds.length > 0 && ` (${selectedIds.length} seleccionados)`}
          </span>
        </div>

        {/* LISTA */}
        <div className="buzon-list-container">
          {loading ? (
            <div className="loading-state">Cargando mensajes…</div>
          ) : filteredNotificaciones.length === 0 ? (
            <div className="empty-state">
              <MailOpen size={64} />
              <p>No hay mensajes que coincidan con los filtros</p>
              {(searchTerm || Object.values(filters).some(f => f)) && (
                <button className="clear-filters-btn" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="email-list">
              {filteredNotificaciones.map(n => {
                const selected = selectedIds.includes(n.id);
                return (
                  <div
                    key={n.id}
                    className={`email-row ${!n.leida ? "unread" : ""} ${selected ? "selected" : ""}`}
                    onClick={(e) => handleRowClick(e, n)}
                  >
                    <div className="row-controls no-click-propagation">
                      <div onClick={() => toggleSelect(n.id)}>
                        {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                      {/* Este es el botón de Estrella que MANTENEMOS (izquierda) */}
                      <button 
                        className={`star-btn ${n.starred ? 'starred' : ''}`}
                        onClick={(e) => toggleStar(n.id, e)}
                        title={n.starred ? "Quitar de favoritos" : "Marcar como favorito"}
                      >
                        {n.starred ? <Star size={16} fill="currentColor" /> : <Star size={16} />}
                      </button>
                    </div>

                    <div className="row-content">
                      <div className="sender-info">
                        <span className="sender-name">{n.sender}</span>
                        {n.deposito && (
                          <span className="deposito-badge">{n.deposito}</span>
                        )}
                      </div>
                      <span className="subject-text">{n.mensaje}</span>
                      {n.link && <span className="link-badge">Ir al módulo</span>}
                    </div>

                    <div className="row-meta">
                      <div className="meta-info">
                        <span className="email-date">{n.fecha}</span>
                        {/* Indicador visual pequeño si está en favoritos */}
                        {n.starred && <Star size={12} className="meta-star" />}
                      </div>
                      <div className="row-actions no-click-propagation">
                        <button 
                          onClick={(e) => n.leida ? marcarNoLeida(n.id, e) : marcarLeida(n.id, e)}
                          title={n.leida ? "Marcar como no leído" : "Marcar como leído"}
                        >
                          {n.leida ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button 
                          onClick={(e) => deleteNotificacion(n.id, e)}
                          title="Eliminar"
                          className="danger-action"
                        >
                          <Trash2 size={16} />
                        </button>
                        {/* AQUÍ SE ELIMINÓ EL BOTÓN DE ESTRELLA DUPLICADO (Derecha) */}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Buzon;