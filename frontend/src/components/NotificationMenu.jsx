// src/components/NotificationMenu.jsx
import React, { useState, useEffect, useRef } from "react";
import { Bell, Inbox, ClipboardList, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/api";
import "../styles/NotificationMenu.css";

const NotificationMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState({ pedidos_pendientes: 0 });
  const menuRef = useRef(null);
  
  const userRole = sessionStorage.getItem("user_rol");
  const token = sessionStorage.getItem("token");
  const isAdminRole = ["Master_Admin", "Admin"].includes(userRole);

  // Carga de notificaciones
  useEffect(() => {
    if (!token || !isAdminRole) return;

    const fetchCounts = async () => {
      try {
        const data = await apiFetch("http://127.0.0.1:5000/notificaciones/conteo");
        setCounts(data);
      } catch (error) {
        console.error("Error notificaciones:", error);
      }
    };

    fetchCounts();
    // Podrías poner un setInterval aquí si quieres polling
  }, [token, isAdminRole]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determinar si hay algo pendiente (Estado "No Leído")
  const hasPending = counts.pedidos_pendientes > 0;

  return (
    <div className="notification-container" ref={menuRef}>
      {/* CAMPANA: Si no hay nada (hasPending es false), se ve normal sin punto rojo */}
      <button 
        className={`bell-btn ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={22} className={hasPending ? "bell-ringing" : ""} />
        
        {/* Solo mostramos el badge rojo si realmente hay algo */}
        {hasPending && isAdminRole && (
          <span className="notification-badge bounce-in">{counts.pedidos_pendientes}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown fade-in-quick">
          <div className="dropdown-header">
            <h3>Centro de Notificaciones</h3>
            {/* Mensaje de estado estilo bandeja de entrada */}
            <span className="status-text">
                {hasPending ? "Tienes tareas pendientes" : "Estás al día ✅"}
            </span>
          </div>
          
          <div className="dropdown-content">
            {isAdminRole && (
              <div className="menu-section">
                <span className="section-title">Gestión de Depósito</span>
                
                {/* ÍTEM ESTILO BUZÓN: Cambia según si hay pendientes o no */}
                <Link 
                    to="/pedidos-entrantes" 
                    className={`menu-item ${hasPending ? 'mailbox-unread' : 'mailbox-read'}`}
                    onClick={() => setIsOpen(false)}
                >
                  {/* Icono: Azul vibrante si hay pendientes, Gris si no */}
                  <div className={`menu-item-icon ${hasPending ? 'blue-pulse' : 'gray-dim'}`}>
                    <Inbox size={18} />
                  </div>
                  
                  <div className="menu-item-text">
                    <span>Pedidos de Material</span>
                    <small>
                        {hasPending 
                            ? "Solicitudes entrantes esperando aprobación" 
                            : "No hay solicitudes nuevas"
                        }
                    </small>
                  </div>
                  
                  {/* Contador: Solo sale si hay número mayor a 0 */}
                  {hasPending && (
                    <span className="counter-badge red">{counts.pedidos_pendientes}</span>
                  )}
                </Link>

              </div>
            )}

            <div className="menu-section border-top">
              <span className="section-title">Mis Tareas</span>
              <Link to="/mis-ordenes" className="menu-item mailbox-read" onClick={() => setIsOpen(false)}>
                <div className="menu-item-icon green-dim">
                  <ClipboardList size={18} />
                </div>
                <div className="menu-item-text">
                  <span>Órdenes de Trabajo</span>
                  <small>Ver mis asignaciones</small>
                </div>
                <ChevronRight size={16} className="chevron" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;