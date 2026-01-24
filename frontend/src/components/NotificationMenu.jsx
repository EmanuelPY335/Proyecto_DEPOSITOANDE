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

  const rawRole = localStorage.getItem("user_role") || "invitado";
  const userRole = rawRole.toLowerCase().trim(); 
  const currentUserId = parseInt(localStorage.getItem("user_id") || "0"); 

  const fetchNotificaciones = async () => {
    try {
      const data = await apiFetch("/api/notificaciones");
      
      if (Array.isArray(data)) {
        
        const notificacionesFiltradas = data.filter(n => {
            const tipo = n.tipo ? n.tipo.trim().toLowerCase() : "info";
            const destinatarioId = n.usuario_id ? parseInt(n.usuario_id) : null;
            
            // ¿Es explícitamente para mí?
            const esParaMi = destinatarioId === currentUserId;
            
            // ¿Viene de la Base de Datos? (Si es así, el backend YA verificó que es mía)
            const esDeBaseDeDatos = n.origen === "db";

            // --- LÓGICA DE VISIBILIDAD ---

            // 1. ADMINS y MASTER
            if (userRole.includes("admin") || userRole.includes("master_admin")) {
                // A) Solicitudes de OTROS que debo atender (Vienen del sistema, no tienen mi ID)
                if (tipo === "pedido" || tipo === "orden") return true;

                // B) Respuestas a MIS solicitudes (Alertas/Checks)
                // SI VIENE DE LA BD, LA MOSTRAMOS SIEMPRE. 
                // Esto arregla el problema: confiamos en el backend.
                if (esDeBaseDeDatos) return true;

                // C) Si es dinámica y es para mí
                if (esParaMi) return true;

                return false;
            }

            // 2. CHOFERES
            if (userRole === "Chofer") {
                return (tipo === "ruta" && esParaMi) || esDeBaseDeDatos;
            }

            // 3. PERSONAL INVENTARIO
            if (userRole === "Personal_Inventario") {
                return esDeBaseDeDatos || ((tipo === "check" || tipo === "alerta" || tipo === "vale") && esParaMi);
            }

            return true; 
        });

        // Eliminar duplicados visuales (por si el backend manda repetidos)
        const uniqueNotificaciones = [];
        const seenIds = new Set();
        const getNotiId = (n) => n?.id ?? n?.ID_NOTIFICACION ?? `${n?.tipo}-${n?.fecha_iso}-${n?.mensaje}`;
        notificacionesFiltradas.forEach(noti => {
            if (!seenIds.has(getNotiId(noti))) {
                seenIds.add(getNotiId(noti));
                uniqueNotificaciones.push(noti);
            }
        });

        const finalData = uniqueNotificaciones.sort((a, b) => {
            if (a.leida === b.leida) return new Date(b.fecha_iso) - new Date(a.fecha_iso);
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
    const interval = setInterval(fetchNotificaciones, 5000); // Check cada 5s
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
    await apiFetch(`/api/notificaciones/leer/${n.id}`, { method: "PUT" });
    // 🔹 actualizar estado del menú inmediatamente
    setNotificaciones(prev => prev.map(item => item.id === n.id ? { ...item, leida: true } : item));
  };


const getIconAndColor = (tipoRaw) => {
  const tipo = (tipoRaw || "").toLowerCase().trim();

  if (tipo.startsWith("solicitud.")) return { icon: <MapPin size={18} />, color: "#3b82f6", bg: "#eff6ff" };
  if (tipo.startsWith("orden.")) return { icon: <Package size={18} />, color: "#f59e0b", bg: "#fffbeb" };
  if (tipo.startsWith("asignacion.")) return { icon: <ClipboardList size={18} />, color: "#8b5cf6", bg: "#f5f3ff" };
  if (tipo.startsWith("alerta.")) return { icon: <AlertTriangle size={18} />, color: "#ef4444", bg: "#fef2f2" };
  if (tipo.startsWith("check.")) return { icon: <CheckCircle size={18} />, color: "#22c55e", bg: "#f0fdf4" };
  if (tipo.startsWith("vale.")) return { icon: <ClipboardList size={18} />, color: "#10b981", bg: "#d1fae5" };
  if (tipo.startsWith("info.")) return { icon: <Info size={18} />, color: "#64748b", bg: "#f1f5f9" };

  // ✅ fallback SIEMPRE
  return { icon: <Info size={18} />, color: "#64748b", bg: "#f1f5f9" };
};

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="notification-container" ref={menuRef}>
      <button className={`bell-btn ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <Bell size={22} className={unreadCount > 0 ? "bell-ringing" : ""} />
        {unreadCount > 0 && <span className="notification-badge bounce-in">{unreadCount > 9 ? "9+" : unreadCount}</span>}
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
                    <div className="noti-indicator" style={{ backgroundColor: style.bg, color: style.color }}>{style.icon}</div>
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
          <div className="dropdown-footer" onClick={() => { navigate("/buzon"); setIsOpen(false); }}>Ver historial completo</div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;