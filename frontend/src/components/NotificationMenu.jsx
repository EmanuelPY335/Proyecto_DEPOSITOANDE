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

  const fetchNotificaciones = async () => {
    try {
      const data = await apiFetch("/api/notificaciones");
      if (Array.isArray(data)) {
        
        // --- FILTRO DE TIEMPO (CONFIGURACIÓN) ---
        // 1. Obtenemos las horas configuradas (Default 24hs)
        const horasRetencion = parseInt(localStorage.getItem("noti_retention") || "24");
        const ahora = new Date();
        const limiteTiempo = new Date(ahora.getTime() - (horasRetencion * 60 * 60 * 1000));

        // 2. Filtramos
        const filtradas = data.filter(n => {
            // Si no tiene fecha ISO (legacy), la dejamos pasar por si acaso
            if (!n.fecha_iso) return true;
            
            const fechaNoti = new Date(n.fecha_iso);
            
            // REGLA: Mostrar si es MÁS NUEVA que el límite
            // Opcional: Si quieres que las NO LEÍDAS siempre aparezcan, agrega: || !n.leida
            return fechaNoti > limiteTiempo;
        });

        // 3. Ordenamos: Primero no leídas, luego por fecha
        const sorted = filtradas.sort((a, b) => {
            if (a.leida === b.leida) {
                return new Date(b.fecha_iso) - new Date(a.fecha_iso); // Más nueva primero
            }
            return a.leida ? 1 : -1; // No leídas primero
        });

        setNotificaciones(sorted);
      }
    } catch (error) { 
      console.error("Error notificaciones:", error); 
    }
  };

  useEffect(() => {
    fetchNotificaciones();
    // Bajamos el intervalo a 10s para que se sienta más rápido
    const interval = setInterval(fetchNotificaciones, 10000);

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
    
    // Marcar como leída visualmente al instante
    setNotificaciones(prev => prev.map(item => 
        item.id === n.id ? { ...item, leida: true } : item
    ));

    // Llamada a la API en segundo plano
    if (!n.leida) {
        try {
            await apiFetch(`/api/notificaciones/leer/${n.id}`, { method: "PUT" });
        } catch (error) {
            console.error("Error marcando leída:", error);
        }
    }

    // Navegación
    if (n.link && n.link !== "#") {
        navigate(n.link);
    }
  };

  const getIconAndColor = (tipo) => {
    switch (tipo) {
      case "Ruta": return { icon: <MapPin size={18} />, color: "#3b82f6", bg: "#eff6ff" }; 
      case "Pedido": return { icon: <Package size={18} />, color: "#f59e0b", bg: "#fffbeb" }; 
      case "Orden": return { icon: <ClipboardList size={18} />, color: "#8b5cf6", bg: "#f5f3ff" }; 
      case "Alerta": return { icon: <AlertTriangle size={18} />, color: "#ef4444", bg: "#fef2f2" }; 
      case "Check": return { icon: <CheckCircle size={18} />, color: "#22c55e", bg: "#f0fdf4" }; 
      default: return { icon: <Info size={18} />, color: "#64748b", bg: "#f1f5f9" }; 
    }
  };

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="notification-container" ref={menuRef}>
      
      <button 
        className={`bell-btn ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label={unreadCount > 0 ? `${unreadCount} notificaciones no leídas` : "Notificaciones"}
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
                {unreadCount > 0 && <span className="status-text">{unreadCount} nuevas</span>}
                <button 
                  className="btn-icon-tiny" 
                  onClick={() => { navigate("/buzon"); setIsOpen(false); }} 
                  title="Ir al Buzón"
                >
                    <Inbox size={16} />
                </button>
            </div>
          </div>
          
          <div className="dropdown-content-list">
            {notificaciones.length === 0 ? (
              <div className="empty-state">
                <Bell size={32} />
                <p>Estás al día</p>
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
                    
                    <div className="noti-indicator" style={{ 
                        backgroundColor: style.bg, 
                        color: style.color
                    }}>
                      {style.icon}
                    </div>

                    <div className="noti-body">
                      <p className="noti-msg">{n.mensaje}</p>
                      <span className="noti-date">
                        {/* Usamos fecha_display que es más bonita */}
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