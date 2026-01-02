import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, Clock, Trash2 } from "lucide-react"; // Iconos necesarios
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";
import "../styles/NotificationMenu.css"; // Asegúrate de crear este CSS (abajo te lo dejo)

const NotificationMenu = () => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // 1. Cargar notificaciones del backend
  const fetchNotificaciones = async () => {
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/notificaciones");
      if (Array.isArray(data)) {
        setNotificaciones(data);
      }
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    }
  };

  // 2. Polling: Actualizar cada 15 segundos
  useEffect(() => {
    fetchNotificaciones();
    const interval = setInterval(fetchNotificaciones, 15000);

    // Cerrar al hacer clic fuera
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 3. Calcular no leídas
  const unreadCount = notificaciones.filter(n => !n.leida).length;

  // 4. Manejar clic en una notificación
  const handleNotificationClick = async (noti) => {
    try {
      // Marcar como leída si no lo está
      if (!noti.leida) {
        await apiFetch(`http://127.0.0.1:5000/api/notificaciones/leer/${noti.id}`, { method: "PUT" });
        // Actualizar estado local rápido
        setNotificaciones(prev => 
          prev.map(n => n.id === noti.id ? { ...n, leida: true } : n)
        );
      }

      setIsOpen(false);

      // Redirigir a Órdenes si corresponde
      if (noti.id_orden) {
        navigate("/ordenes-trabajo");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 5. Marcar todo como leído
  const markAllRead = async () => {
    try {
        await apiFetch(`http://127.0.0.1:5000/api/notificaciones/leer-todas`, { method: "PUT" });
        setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (e) { console.error(e); }
  };

  return (
    <div className="notification-container" ref={menuRef}>
      
      {/* --- BOTÓN CAMPANA --- */}
      <button 
        className={`bell-btn ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={22} className={unreadCount > 0 ? "bell-ringing" : ""} />
        
        {/* Badge Rojo */}
        {unreadCount > 0 && (
          <span className="notification-badge bounce-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* --- MENÚ DROPDOWN --- */}
      {isOpen && (
        <div className="notification-dropdown fade-in-quick">
          <div className="dropdown-header">
            <h3>Notificaciones</h3>
            {unreadCount > 0 ? (
                <button className="mark-read-text" onClick={markAllRead}>
                    Marcar todo leido
                </button>
            ) : (
                <span className="status-text">Estás al día ✅</span>
            )}
          </div>

          <div className="dropdown-content-list">
            {notificaciones.length === 0 ? (
              <div className="empty-state">
                <Bell size={32} style={{opacity: 0.2, marginBottom: 10}} />
                <p>No tienes notificaciones nuevas</p>
              </div>
            ) : (
              notificaciones.map((n) => (
                <div 
                  key={n.id} 
                  className={`noti-item ${!n.leida ? "unread" : "read"}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="noti-indicator">
                    {!n.leida && <div className="blue-dot" />}
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