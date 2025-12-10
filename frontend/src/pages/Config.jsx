// src/pages/Config.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Bell, Map as MapIcon, Shield, ChevronRight, 
  Globe, Volume2, Truck 
} from "lucide-react";
import "../styles/Config.css";

const Config = () => {
  // Simulamos estados de configuración (estos luego se conectarían a tu backend o localStorage)
  const [notifications, setNotifications] = useState({
    email: true,
    browser: true,
    sound: false
  });

  const [mapSettings, setMapSettings] = useState({
    refreshRate: "30", // 30 segundos por defecto para el GPS
    showTraffic: false
  });

  // Manejadores de cambios
  const toggleNotif = (key) => setNotifications(prev => ({...prev, [key]: !prev[key]}));
  
  const handleMapChange = (e) => {
    setMapSettings({...mapSettings, [e.target.name]: e.target.value});
    // Aquí podrías guardar: localStorage.setItem('gpsRefresh', e.target.value);
  };

  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        
        <div className="config-header">
            <h1>Configuración del Sistema</h1>
            <p className="subtitle">Ajusta las preferencias de alertas y rastreo de SISDEPO.</p>
        </div>

        <div className="config-container">
            
            {/* --- 1. NOTIFICACIONES (Alertas del depósito) --- */}
            <div className="config-card">
                <div className="card-title">
                    <Bell size={22} />
                    <h3>Notificaciones</h3>
                </div>
                <p className="card-desc">Controla cómo recibes las alertas de inventario y flota.</p>

                <div className="config-item-row">
                    <span className="label-text">Alertas por Correo</span>
                    <input 
                        type="checkbox" 
                        className="checkbox-ios" 
                        checked={notifications.email} 
                        onChange={() => toggleNotif('email')}
                    />
                </div>
                <div className="config-item-row">
                    <span className="label-text">Pop-ups en Navegador</span>
                    <input 
                        type="checkbox" 
                        className="checkbox-ios" 
                        checked={notifications.browser} 
                        onChange={() => toggleNotif('browser')}
                    />
                </div>
                <div className="config-item-row">
                    <div className="row-center">
                        <Volume2 size={16} style={{marginRight: 5, color: '#666'}}/>
                        <span className="label-text">Sonidos de Alerta</span>
                    </div>
                    <input 
                        type="checkbox" 
                        className="checkbox-ios" 
                        checked={notifications.sound} 
                        onChange={() => toggleNotif('sound')}
                    />
                </div>
            </div>

            {/* --- 2. MAPA Y RASTREO (Importante para tu módulo GPS) --- */}
            <div className="config-card">
                <div className="card-title">
                    <MapIcon size={22} />
                    <h3>Mapa y GPS</h3>
                </div>
                <p className="card-desc">Optimiza el rendimiento del seguimiento vehicular.</p>

                <div className="config-input-group">
                    <label>Frecuencia de actualización del GPS</label>
                    <select 
                        name="refreshRate" 
                        value={mapSettings.refreshRate}
                        onChange={handleMapChange}
                        className="config-select"
                    >
                        <option value="5">Tiempo Real (5s) - Mayor consumo</option>
                        <option value="15">Rápido (15s)</option>
                        <option value="30">Normal (30s) - Recomendado</option>
                        <option value="60">Ahorro (1m)</option>
                    </select>
                </div>

                <div className="config-item-row">
                    <div className="row-center">
                        <Truck size={16} style={{marginRight: 5, color: '#666'}}/>
                        <span className="label-text">Mostrar tráfico en vivo</span>
                    </div>
                    <input 
                        type="checkbox" 
                        className="checkbox-ios" 
                        checked={mapSettings.showTraffic} 
                        onChange={() => setMapSettings({...mapSettings, showTraffic: !mapSettings.showTraffic})}
                    />
                </div>
            </div>

            {/* --- 3. CUENTA Y SEGURIDAD --- */}
            <div className="config-card">
                <div className="card-title">
                    <Shield size={22} />
                    <h3>Cuenta</h3>
                </div>
                <p className="card-desc">Accesos directos a la gestión de tu perfil.</p>
                
                <Link to="/profile" className="config-link-item">
                    <div className="row-center">
                        <div className="icon-bg"><Globe size={18}/></div>
                        <div className="link-text-group">
                            <span className="link-title">Editar Perfil</span>
                            <span className="link-subtitle">Avatar, teléfono y banner</span>
                        </div>
                    </div>
                    <ChevronRight size={18} color="#ccc" />
                </Link>

                <Link to="/profile" className="config-link-item">
                    <div className="row-center">
                        <div className="icon-bg sec"><Shield size={18}/></div>
                        <div className="link-text-group">
                            <span className="link-title">Seguridad</span>
                            <span className="link-subtitle">Cambiar contraseña</span>
                        </div>
                    </div>
                    <ChevronRight size={18} color="#ccc" />
                </Link>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Config;