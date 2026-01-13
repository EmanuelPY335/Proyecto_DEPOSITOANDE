import React, { useState, useEffect, useRef } from "react";
import { 
  Bell, Clock, MapPin, ClipboardList, Package, Info, AlertTriangle, CheckCircle 
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
      const data = await apiFetch("http://127.0.0.1:5000/api/notificaciones");
      if (Array.isArray(data)) {
        // Ordenamos: No leídas primero, luego por fecha
        const sorted = data.sort((a, b) => (a.leida === b.leida ? 0 : a.leida ? 1 : -1));
        setNotificaciones(sorted);
      }
    } catch (error) { 
      console.error("Error notificaciones:", error); 
    }
  };

  useEffect(() => {
    fetchNotificaciones();
    // Polling: revisa cada 15 segundos para no saturar tanto si hay muchos usuarios
    const interval = setInterval(fetchNotificaciones, 15000); 

    const handleClickOutside = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        clearInterval(interval);
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- LÓGICA DE CLICK Y NAVEGACIÓN ---
  const handleNotificationClick = async (n) => {
    setIsOpen(false);
    
    // 1. Marcar como leída en BD (UX: que deje de salir como pendiente)
    if (!n.leida) {
        try {
            await apiFetch(`http://127.0.0.1:5000/api/notificaciones/leer/${n.id}`, { method: "PUT" });
            // Actualizamos estado local para reflejar lectura inmediata
            setNotificaciones(prev => prev.map(item => 
                item.id === n.id ? { ...item, leida: true } : item
            ));
        } catch (error) {
            console.error("Error marcando leída:", error);
        }
    }

    // 2. Navegación Inteligente
    switch (n.tipo) {
        case "Pedido": // Solicitud de stock (Admin/Master)
            // Vamos a Movimientos, forzando la vista de "solicitudes"
            navigate("/movimientos", { state: { activeTab: "pedidos", view: "solicitudes" } });
            break;

        case "Alerta": // Aprobar Vale (Admin)
        case "Check":  // Confirmar Recepción (Admin)
            // Vamos a Movimientos, forzando la vista de "vales"
            navigate("/movimientos", { state: { activeTab: "pedidos", view: "vales" } });
            break;

        case "Ruta": // Chofer
            // Mandamos al mapa. Podrías pasar el ID de ruta si quieres centrar el mapa
            navigate("/Mapa", { state: { rutaId: n.id } });
            break;

        case "Orden": // Personal Inventario
            // Mandamos directo a sus órdenes
            navigate("/ordenes-trabajo");
            break;

        default:
            // Si viene un link genérico desde el backend (ej: notificaciones persistentes)
            if (n.link) navigate(n.link);
            break;
    }
  };

  // Función auxiliar para iconos y colores
  const getIconAndColor = (tipo) => {
    switch (tipo) {
      case "Ruta":
        return { icon: <MapPin size={18} />, color: "#3b82f6", bg: "#eff6ff" }; 
      case "Pedido":
        return { icon: <Package size={18} />, color: "#f59e0b", bg: "#fffbeb" }; 
      case "Orden":
        return { icon: <ClipboardList size={18} />, color: "#8b5cf6", bg: "#f5f3ff" }; 
      case "Alerta":
        return { icon: <AlertTriangle size={18} />, color: "#ef4444", bg: "#fef2f2" }; 
      case "Check":
        return { icon: <CheckCircle size={18} />, color: "#22c55e", bg: "#f0fdf4" }; 
      default:
        return { icon: <Info size={18} />, color: "#64748b", bg: "#f1f5f9" }; 
    }
  };

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="notification-container" ref={menuRef} style={{ display: 'flex', alignItems: 'center', marginRight: '15px' }}>
      
      <button 
        className={`bell-btn ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
            background: 'transparent', border: 'none', cursor: 'pointer', 
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '8px', minWidth: '40px', minHeight: '40px' 
        }}
      >
        <Bell size={22} color="#64748b" className={unreadCount > 0 ? "bell-ringing" : ""} />
        
        {unreadCount > 0 && (
          <span className="notification-badge bounce-in" style={{
              position: 'absolute', top: 0, right: 0, 
              background: '#ef4444', color: 'white', fontSize: '10px', 
              borderRadius: '50%', padding: '2px 5px', border: '2px solid white'
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown fade-in-quick">
          <div className="dropdown-header">
            <h3>Notificaciones</h3>
            {unreadCount > 0 && <span className="status-text">{unreadCount} nuevas</span>}
          </div>
          <div className="dropdown-content-list">
            {notificaciones.length === 0 ? (
              <div className="empty-state">
                <Bell size={32} style={{opacity: 0.2, marginBottom: 10}} />
                <p>Estás al día</p>
              </div>
            ) : (
              notificaciones.map((n) => {
                const style = getIconAndColor(n.tipo);
                return (
                  <div key={n.id} className={`noti-item ${!n.leida ? "unread" : "read"}`} onClick={() => handleNotificationClick(n)}>
                    
                    <div className="noti-indicator" style={{ 
                        backgroundColor: style.bg, 
                        color: style.color,
                        padding: '8px',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginRight: '10px', minWidth: 'auto'
                    }}>
                      {style.icon}
                    </div>

                    <div className="noti-body">
                      <p className="noti-msg">{n.mensaje}</p>
                      <span className="noti-date">
                        <Clock size={10} style={{marginRight: 4}}/> {n.fecha}
                      </span>
                    </div>
                    
                    {!n.leida && <div className="blue-dot" style={{alignSelf: 'center'}}></div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;