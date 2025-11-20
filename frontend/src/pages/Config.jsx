import React from "react";
import { useTheme } from "../context/ThemeContext";
import { Moon, Sun, Monitor } from "lucide-react";
import "../styles/Config.css"; // Crearemos este CSS abajo

const Config = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="dashboard-layout">
      {/* Asumiendo que usas el Layout global o Navbar aquí */}
      <div className="content-dashboard">
        
        <div className="config-header">
            <h1>Configuración</h1>
            <p className="subtitle">Personaliza tu experiencia en SISDEPO.</p>
        </div>

        <div className="config-container">
            
            {/* TARJETA DE APARIENCIA */}
            <div className="config-card">
                <div className="card-title">
                    <Monitor size={20} />
                    <h3>Apariencia</h3>
                </div>
                <p className="card-desc">Elige cómo se ve la aplicación en tu dispositivo.</p>

                <div className="theme-toggle-row">
                    <span className="toggle-label">Modo Oscuro</span>
                    
                    <button 
                        className={`toggle-switch ${theme === 'dark' ? 'active' : ''}`} 
                        onClick={toggleTheme}
                    >
                        <div className="switch-handle">
                            {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                        </div>
                    </button>
                </div>
                
                <p className="status-text">
                    Tema actual: <strong>{theme === 'dark' ? 'Oscuro 🌙' : 'Claro ☀️'}</strong>
                </p>
            </div>

            {/* Aquí puedes agregar más tarjetas de configuración a futuro */}

        </div>
      </div>
    </div>
  );
};

export default Config;