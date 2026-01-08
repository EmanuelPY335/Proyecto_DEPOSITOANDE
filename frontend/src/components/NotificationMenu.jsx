import React, { useState, useEffect, useRef } from "react";
import { Bell, Clock, MapPin, CheckCircle, Info } from "lucide-react";
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom"; // Hook para navegar
import "../styles/NotificationMenu.css";

const NotificationMenu = () => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotificaciones = async () => {
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/notificaciones");
      if (Array.isArray(data)) setNotificaciones(data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    fetchNotificaciones();
    const interval = setInterval(fetchNotificaciones, 10000); // Polling cada 10s
    
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
    // 1. Marcar como leída (Opcional: llamar a API aquí)
    
    // 2. Redirigir
    setIsOpen(false);
    if (n.link) {
        navigate(n.link); // Si es de tipo Ruta, va a /mapa
    } else if (n.id_orden) {
        navigate("/ordenes-trabajo"); // Si es orden normal
    }
  };

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="notification-wrapper" ref={menuRef}>
      <div className="notification-icon" onClick={() => setIsOpen(!isOpen)}>
        <Bell size={22} color="white" />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </div>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h3>Notificaciones</h3>
          </div>

          <div className="dropdown-content-list">
            {notificaciones.length === 0 ? (
              <div className="empty-state">
                <Bell size={32} style={{opacity: 0.2, marginBottom: 10}} />
                <p>Sin novedades</p>
              </div>
            ) : (
              notificaciones.map((n) => (
                <div 
                  key={n.id} 
                  className={`noti-item ${!n.leida ? "unread" : "read"}`}
                  onClick={() => handleNotificationClick(n)}
                  style={{cursor: 'pointer'}}
                >
                  <div className="noti-indicator">
                    {/* Icono diferenciado */}
                    {n.tipo === "Ruta" ? <MapPin size={18} color="#3b82f6"/> : 
                     n.tipo === "Alerta" ? <Info size={18} color="#f59e0b"/> :
                     <CheckCircle size={18} color="#10b981"/>}
                  </div>
                  <div className="noti-body">
                    <p className="noti-msg">{n.mensaje}</p>
                    <span className="noti-date">
                        <Clock size={10} style={{marginRight: 4}}/>
                        {n.fecha}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;