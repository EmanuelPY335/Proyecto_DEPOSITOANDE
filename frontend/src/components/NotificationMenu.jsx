import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Bell,
  Clock,
  MapPin,
  ClipboardList,
  Package,
  Info,
  AlertTriangle,
  CheckCircle,
  Inbox,
} from "lucide-react";
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";
import "../styles/NotificationMenu.css";

const NotificationMenu = () => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotificaciones = async () => {
    try {
      const data = await apiFetch("/api/notificaciones");
      if (!Array.isArray(data)) return;

      // dedupe por id
      const seen = new Set();
      const unique = [];
      for (const n of data) {
        const id = n?.id ?? n?.ID_NOTIFICACION ?? `${n?.tipo}-${n?.fecha_iso}-${n?.mensaje}`;
        if (seen.has(id)) continue;
        seen.add(id);
        unique.push({ ...n, id: n?.id ?? n?.ID_NOTIFICACION ?? id });
      }

      unique.sort((a, b) => {
        if (!!a.leida === !!b.leida) return new Date(b.fecha_iso || 0) - new Date(a.fecha_iso || 0);
        return a.leida ? 1 : -1;
      });

      setNotificaciones(unique);
    } catch (error) {
      console.error("Error notificaciones:", error);
    }
  };

  useEffect(() => {
    fetchNotificaciones();
    const interval = setInterval(fetchNotificaciones, 5000);

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNotificationClick = async (n) => {
    setIsOpen(false);

    // optimista
    setNotificaciones((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, leida: true } : item))
    );

    try {
      await apiFetch(`/api/notificaciones/leer/${n.id}`, { method: "PUT" });
    } catch (e) {
      // rollback si falla
      setNotificaciones((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, leida: false } : item))
      );
    }

    // ✅ lo que pediste: siempre al buzón para administrar
    navigate(`/buzon?focus=${encodeURIComponent(n.id)}`);
  };

  const getIconAndColor = (tipoRaw) => {
    const tipo = String(tipoRaw || "").toLowerCase().trim();

    if (tipo.startsWith("solicitud.") || tipo.includes("pedido") || tipo.includes("solicitud"))
      return { icon: <MapPin size={18} />, color: "#3b82f6", bg: "#eff6ff" };

    if (tipo.startsWith("orden.") || tipo.includes("orden"))
      return { icon: <Package size={18} />, color: "#f59e0b", bg: "#fffbeb" };

    if (tipo.startsWith("asignacion.") || tipo.includes("asignacion") || tipo.includes("asignación"))
      return { icon: <ClipboardList size={18} />, color: "#8b5cf6", bg: "#f5f3ff" };

    if (tipo.startsWith("alerta.") || tipo.includes("alerta") || tipo.includes("anul") || tipo.includes("rechaz") || tipo.includes("cancel"))
      return { icon: <AlertTriangle size={18} />, color: "#ef4444", bg: "#fef2f2" };

    if (tipo.startsWith("check.") || tipo.includes("check") || tipo.includes("aprob") || tipo.includes("finaliz") || tipo.includes("recib"))
      return { icon: <CheckCircle size={18} />, color: "#22c55e", bg: "#f0fdf4" };

    if (tipo.startsWith("vale.") || tipo.includes("vale"))
      return { icon: <ClipboardList size={18} />, color: "#10b981", bg: "#d1fae5" };

    return { icon: <Info size={18} />, color: "#64748b", bg: "#f1f5f9" };
  };

  const unreadCount = useMemo(() => notificaciones.filter((n) => !n.leida).length, [notificaciones]);

  return (
    <div className="notification-container" ref={menuRef}>
      <button className={`bell-btn ${isOpen ? "active" : ""}`} onClick={() => setIsOpen(!isOpen)}>
        <Bell size={22} className={unreadCount > 0 ? "bell-ringing" : ""} />
        {unreadCount > 0 && (
          <span className="notification-badge bounce-in">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown fade-in-quick">
          <div className="dropdown-header">
            <h3>Notificaciones</h3>
            <div className="header-actions">
              <button className="btn-icon-tiny" onClick={() => { navigate("/buzon"); setIsOpen(false); }}>
                <Inbox size={16} />
              </button>
            </div>
          </div>

          <div className="dropdown-content-list">
            {notificaciones.length === 0 ? (
              <div className="empty-state">
                <Bell size={32} />
                <p>Sin novedades</p>
              </div>
            ) : (
              notificaciones.map((n) => {
                const style = getIconAndColor(n.tipo);
                return (
                  <div
                    key={n.id}
                    className={`noti-item ${!n.leida ? "unread" : "read"}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="noti-indicator" style={{ backgroundColor: style.bg, color: style.color }}>
                      {style.icon}
                    </div>
                    <div className="noti-body">
                      <p className="noti-msg">{n.mensaje}</p>
                      <span className="noti-date">
                        <Clock size={10} /> {n.fecha_display || n.fecha}
                      </span>
                    </div>
                    {!n.leida && <div className="blue-dot"></div>}
                  </div>
                );
              })
            )}
          </div>

          <div className="dropdown-footer" onClick={() => { navigate("/buzon"); setIsOpen(false); }}>
            Ver historial completo
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;
