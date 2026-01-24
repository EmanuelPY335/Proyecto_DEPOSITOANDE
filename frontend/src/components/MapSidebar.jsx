import React, { useState, useEffect, useRef } from "react";
import { 
  Bell, Clock, MapPin, ClipboardList, Package, Info, AlertTriangle, CheckCircle, Inbox 
} from "lucide-react"; 
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";
import "../styles/NotificationMenu.css"; 

const NotificationMenu = () => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // 1. OBTENER ROL E ID DEL USUARIO ACTUAL
  // Asegúrate de guardar 'user_id' en el login igual que guardas el 'user_role'
  const userRole = localStorage.getItem("user_role") || "invitado";
  const currentUserId = parseInt(localStorage.getItem("user_id") || "0"); 

  const fetchNotificaciones = async () => {
    try {
      const data = await apiFetch("/api/notificaciones");
      
      if (Array.isArray(data)) {
        
        const notificacionesFiltradas = data.filter(n => {
            const tipo = n.tipo ? n.tipo.trim().toLowerCase() : "";
            
            // IMPORTANTE: Tu API debe devolver el ID del dueño de la notificación
            // Puede llamarse: n.usuario_id, n.target_id, n.solicitante_id
            // Aquí asumo que se llama n.usuario_id. Cámbialo si tu BD es distinta.
            const destinatarioId = n.usuario_id ? parseInt(n.usuario_id) : null;

            // --- LÓGICA DE FILTRADO ---

            // A) ADMINISTRADORES
            // Ven todo lo global (Pedidos, Ordenes) y alertas generales
            if (userRole === "admin" || userRole === "master_admin") {
                return tipo === "pedido" || tipo === "orden" || tipo === "alerta"; 
            }

            // B) CHOFERES
            // Solo ven Rutas asignadas a ELLOS
            if (userRole === "chofer") {
                if (tipo !== "ruta") return false;
                // Si la ruta tiene un ID de chofer asignado, verificamos que sea él
                if (destinatarioId && destinatarioId !== currentUserId) return false;
                return true;
            }

            // C) PERSONAL DE INVENTARIO (Aquí estaba el fallo)
            if (userRole === "personal_inventario") {
                // 1. Si es un 'check' (aprobación) o 'alerta' (rechazo), 
                // SOLO debe mostrarse si el ID coincide con el usuario actual.
                if (tipo === "check" || tipo === "alerta") {
                    return destinatarioId === currentUserId;
                }
                
                // 2. Si es un Vale, igual, solo si es para mí
                if (tipo === "vale") {
                    return destinatarioId === currentUserId;
                }

                return false;
            }

            return false; 
        });

        // --- FILTRO DE TIEMPO Y ORDEN (Igual que antes) ---
        const horasRetencion = parseInt(localStorage.getItem("noti_retention") || "24");
        const ahora = new Date();
        const limiteTiempo = new Date(ahora.getTime() - (horasRetencion * 60 * 60 * 1000));

        const finalData = notificacionesFiltradas
            .filter(n => !n.fecha_iso || new Date(n.fecha_iso) > limiteTiempo)
            .sort((a, b) => {
                if (a.leida === b.leida) {
                    return new Date(b.fecha_iso) - new Date(a.fecha_iso);
                }
                return a.leida ? 1 : -1;
            });

        setNotificaciones(finalData);
      }
    } catch (error) { 
      console.error("Error notificaciones:", error); 
    }
  };

  useEffect(() => {
    fetchNotificaciones();
    const interval = setInterval(fetchNotificaciones, 10000);
    const handleClickOutside = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        clearInterval(interval);
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []); // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleNotificationClick = async (n) => {
    setIsOpen(false);
    setNotificaciones(prev => prev.map(item => 
        item.id === n.id ? { ...item, leida: true } : item
    ));
    if (!n.leida) {
        try { await apiFetch(`/api/notificaciones/leer/${n.id}`, { method: "PUT" }); } 
        catch (e) { console.error(e); }
    }
    if (n.link && n.link !== "#") navigate(n.link);
  };

  const getIconAndColor = (tipoRaw) => {
    const tipo = tipoRaw ? tipoRaw.trim().toLowerCase() : "";
    switch (tipo) {
      case "ruta": return { icon: <MapPin size={18} />, color: "#3b82f6", bg: "#eff6ff" }; 
      case "pedido": return { icon: <Package size={18} />, color: "#f59e0b", bg: "#fffbeb" }; 
      case "orden": return { icon: <ClipboardList size={18} />, color: "#8b5cf6", bg: "#f5f3ff" }; 
      case "alerta": return { icon: <AlertTriangle size={18} />, color: "#ef4444", bg: "#fef2f2" }; 
      case "check": return { icon: <CheckCircle size={18} />, color: "#22c55e", bg: "#f0fdf4" }; 
      case "vale": return { icon: <ClipboardList size={18} />, color: "#10b981", bg: "#d1fae5" }; 
      default: return { icon: <Info size={18} />, color: "#64748b", bg: "#f1f5f9" }; 
    }
  };

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="notification-container" ref={menuRef}>
      <button 
        className={`bell-btn ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={22} className={unreadCount > 0 ? "bell-ringing" : ""} />
        {unreadCount > 0 && (
          <span className="notification-badge bounce-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
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
              <div className="empty-state"><Bell size={32} /><p>Sin novedades</p></div>
            ) : (
              notificaciones.map((n) => {
                const style = getIconAndColor(n.tipo);
                return (
                  <div key={n.id} className={`noti-item ${!n.leida ? "unread" : "read"}`} onClick={() => handleNotificationClick(n)}>
                    <div className="noti-indicator" style={{ backgroundColor: style.bg, color: style.color }}>
                      {style.icon}
                    </div>
                    <div className="noti-body">
                      <p className="noti-msg">{n.mensaje}</p>
                      <span className="noti-date"><Clock size={10} /> {n.fecha_display || n.fecha}</span>
                    </div>
                    {!n.leida && <div className="blue-dot"></div>}
                  </div>
                );
              })
            )}
          </div>
          <div className="dropdown-footer" onClick={() => { navigate("/buzon"); setIsOpen(false); }}>Ver todo</div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;