import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import {
  Search, RefreshCcw, Star, Trash2, Mail, MailOpen, ArrowLeft,
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
    year: "", deposito: "", starred: false, unread: false, read: false
  });
  const navigate = useNavigate();

  // Años y depósitos únicos para filtros
  const years = [...new Set(notificaciones.map(n => n.fecha ? new Date(n.fecha_iso || n.fecha).getFullYear() : null).filter(y => y))].sort((a, b) => b - a);
  const depositos = [...new Set(notificaciones.map(n => n.deposito).filter(d => d))].sort();

  useEffect(() => { loadBuzon(); }, []);
  useEffect(() => { applyFilters(); }, [notificaciones, filters, searchTerm]);

  const loadBuzon = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/buzon");
      // Mapeo seguro de datos
      const formatted = (data || []).map(n => ({
        id: n.id, 
        mensaje: n.mensaje,
        leida: Boolean(n.leida),
        fecha: n.fecha,
        fecha_iso: n.fecha_iso || n.fecha, // Respaldo para ordenamiento
        link: n.link,
        tipo: n.tipo ? n.tipo.toLowerCase() : "info",
        starred: Boolean(n.starred),
        sender: n.sender || "Sistema",
        deposito: n.deposito || ""
      }));

      // YA NO FILTRAMOS POR ROL AQUÍ. 
      // Confiamos en que la API (backend) ya filtró y sincronizó los datos.
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

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(n =>
        (n.mensaje && n.mensaje.toLowerCase().includes(term)) ||
        (n.sender && n.sender.toLowerCase().includes(term))
      );
    }
    if (filters.year) {
      filtered = filtered.filter(n => {
        const d = new Date(n.fecha_iso || n.fecha);
        return d.getFullYear() === parseInt(filters.year);
      });
    }
    if (filters.deposito) filtered = filtered.filter(n => n.deposito === filters.deposito);
    if (filters.starred) filtered = filtered.filter(n => n.starred);
    if (filters.unread) filtered = filtered.filter(n => !n.leida);
    if (filters.read) filtered = filtered.filter(n => n.leida);

    setFilteredNotificaciones(filtered);
  };

  // --- HANDLERS (Sin cambios lógicos, solo limpieza) ---
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === filteredNotificaciones.length ? [] : filteredNotificaciones.map(n => n.id));

  const handleRowClick = (e, noti) => {
    if (e.target.closest(".no-click-propagation")) return;
    if (noti.link && noti.link !== "#") navigate(noti.link);
  };

  const marcarLeida = async (id, e) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/buzon/${id}/leer`, { method: "PUT" });
      setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    } catch (err) { console.error(err); }
  };

  const marcarNoLeida = async (id, e) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/buzon/${id}/noleer`, { method: "PUT" });
      setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: false } : n));
    } catch (err) { console.error(err); }
  };

  const toggleStar = async (id, e) => {
    e.stopPropagation();
    const target = notificaciones.find(n => n.id === id);
    if (!target) return;
    const newState = !target.starred;

    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, starred: newState } : n));
    try {
      await apiFetch(`/api/buzon/${id}/star`, { method: "PUT", body: JSON.stringify({ starred: newState }) });
    } catch (err) { console.error(err); }
  };

  const deleteNotificacion = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de eliminar esta notificación?")) {
      setNotificaciones(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
      try { await apiFetch(`/api/buzon/${id}`, { method: "DELETE" }); } catch {}
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`¿Eliminar ${selectedIds.length} mensajes?`)) {
      setNotificaciones(prev => prev.filter(n => !selectedIds.includes(n.id)));
      try { await apiFetch("/api/buzon/batch", { method: "DELETE", body: JSON.stringify({ ids: selectedIds }) }); } catch {}
      setSelectedIds([]);
    }
  };

  const markSelectedAsRead = async () => {
    if (!selectedIds.length) return;
    setNotificaciones(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, leida: true } : n));
    try { await apiFetch("/api/buzon/batch/read", { method: "PUT", body: JSON.stringify({ ids: selectedIds }) }); } catch {}
  };

  const markSelectedAsUnread = async () => {
    if (!selectedIds.length) return;
    setNotificaciones(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, leida: false } : n));
    try { await apiFetch("/api/buzon/batch/unread", { method: "PUT", body: JSON.stringify({ ids: selectedIds }) }); } catch {}
  };

  const toggleStarSelected = async () => {
    if (!selectedIds.length) return;
    const allStarred = selectedIds.every(id => notificaciones.find(n => n.id === id)?.starred);
    setNotificaciones(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, starred: !allStarred } : n));
    try { await apiFetch("/api/buzon/batch/star", { method: "PUT", body: JSON.stringify({ ids: selectedIds, starred: !allStarred }) }); } catch {}
  };

  const clearFilters = () => {
    setFilters({ year: "", deposito: "", starred: false, unread: false, read: false });
    setSearchTerm("");
  };

  return (
    <div className="buzon-layout fade-in">
      <div className="buzon-header">
        <div className="buzon-left">
          <button className="back-btn" onClick={() => navigate("/home")}>
            <ArrowLeft size={18} /> <span>Inicio</span>
          </button>
        </div>
        <div className="buzon-search-bar">
          <Search size={18} />
          <input placeholder="Buscar mensajes" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button className={`filter-btn ${Object.values(filters).some(f => f) || searchTerm ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <Filter size={18} />
          </button>
        </div>
        <div className="buzon-title-right"><span>Buzón ({filteredNotificaciones.length})</span></div>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-header"><h4>Filtros</h4><button onClick={clearFilters}><X size={16} /> Limpiar</button></div>
          <div className="filters-grid">
            <div className="filter-group"><label><Calendar size={14} /> Año</label>
              <select value={filters.year} onChange={(e) => setFilters(p => ({ ...p, year: e.target.value }))}>
                <option value="">Todos</option>{years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="filter-group"><label><Building size={14} /> Depósito</label>
              <select value={filters.deposito} onChange={(e) => setFilters(p => ({ ...p, deposito: e.target.value }))}>
                <option value="">Todos</option>{depositos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="filter-group checkboxes">
              <label><input type="checkbox" checked={filters.starred} onChange={(e) => setFilters(p => ({ ...p, starred: e.target.checked }))} /> <Star size={14} /> Favoritos</label>
              <label><input type="checkbox" checked={filters.unread} onChange={(e) => setFilters(p => ({ ...p, unread: e.target.checked, read: false }))} /> <EyeOff size={14} /> No leídos</label>
              <label><input type="checkbox" checked={filters.read} onChange={(e) => setFilters(p => ({ ...p, read: e.target.checked, unread: false }))} /> <Eye size={14} /> Leídos</label>
            </div>
          </div>
        </div>
      )}

      <div className="buzon-body">
        <div className="buzon-toolbar">
          <div className="toolbar-group">
            <div className="checkbox-wrapper no-click-propagation" onClick={toggleSelectAll}>
              {selectedIds.length === filteredNotificaciones.length && selectedIds.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
            </div>
            <button className="tool-btn" onClick={loadBuzon} title="Actualizar"><RefreshCcw size={16} /></button>
            {selectedIds.length > 0 && (
              <>
                <button className="tool-btn danger" onClick={deleteSelected} title="Eliminar"><Trash2 size={16} /></button>
                <button className="tool-btn" onClick={markSelectedAsRead} title="Marcar leído"><Eye size={16} /></button>
                <button className="tool-btn" onClick={markSelectedAsUnread} title="Marcar no leído"><EyeOff size={16} /></button>
                <button className="tool-btn" onClick={toggleStarSelected} title="Favorito"><Star size={16} /></button>
              </>
            )}
          </div>
          <span className="page-info">Mostrando {filteredNotificaciones.length} de {notificaciones.length}</span>
        </div>

        <div className="buzon-list-container">
          {loading ? <div className="loading-state">Cargando mensajes...</div> : filteredNotificaciones.length === 0 ? (
            <div className="empty-state"><MailOpen size={64} /><p>No hay mensajes</p></div>
          ) : (
            <div className="email-list">
              {filteredNotificaciones.map(n => {
                const selected = selectedIds.includes(n.id);
                return (
                  <div key={n.id} className={`email-row ${!n.leida ? "unread" : ""} ${selected ? "selected" : ""}`} onClick={(e) => handleRowClick(e, n)}>
                    <div className="row-controls no-click-propagation">
                      <div onClick={() => toggleSelect(n.id)}>{selected ? <CheckSquare size={16} /> : <Square size={16} />}</div>
                      <button className={`star-btn ${n.starred ? 'starred' : ''}`} onClick={(e) => toggleStar(n.id, e)}>
                        {n.starred ? <Star size={16} fill="currentColor" /> : <Star size={16} />}
                      </button>
                    </div>
                    <div className="row-content">
                      <div className="sender-info"><span className="sender-name">{n.sender}</span>{n.deposito && <span className="deposito-badge">{n.deposito}</span>}</div>
                      <span className="subject-text">{n.mensaje}</span>
                      {n.link && <span className="link-badge">Ir</span>}
                    </div>
                    <div className="row-meta">
                      <div className="meta-info"><span className="email-date">{n.fecha_display || n.fecha.substring(0, 10)}</span></div>
                      <div className="row-actions no-click-propagation">
                        <button onClick={(e) => n.leida ? marcarNoLeida(n.id, e) : marcarLeida(n.id, e)}>{n.leida ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                        <button onClick={(e) => deleteNotificacion(n.id, e)} className="danger-action"><Trash2 size={16} /></button>
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