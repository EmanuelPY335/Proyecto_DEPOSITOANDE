import React, { useState } from "react";
import { X, Send, Truck, MapPin, AlertCircle } from "lucide-react";
import { apiFetch } from "../utils/api";
import "../styles/Materiales.css";

const SolicitudModal = ({ material, depositos, onClose }) => {
  const [cantidad, setCantidad] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);

  const miDepositoId = parseInt(sessionStorage.getItem("user_deposito_id") || "0");
  const proveedoresDisponibles = depositos.filter(d => d.ID_DEPOSITO !== miDepositoId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proveedorId) return alert("Debes seleccionar un proveedor.");
    
    setLoading(true);
    try {
      // Asegúrate de que API_URL esté definido o usa la ruta relativa si tienes proxy
        const API_URL = "http://127.0.0.1:5000"; 
        await apiFetch(`${API_URL}/solicitudes`, { 
        method: "POST",
        body: JSON.stringify({
          id_material: material.ID_MATERIAL,
          id_deposito_proveedor: proveedorId,
          cantidad: cantidad,
          observacion: observacion
        })
      });
      alert("Solicitud Creada. El encargado del otro depósito podrá agruparla en el próximo camión.");
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div 
        className="discord-card modal-material" 
        style={{
          maxWidth: '500px', 
          width: '100%',
          /* CAMBIOS PARA EL SCROLL: */
          maxHeight: '85vh',       // Limita la altura al 85% de la pantalla
          display: 'flex',         // Usa flexbox para organizar header y body
          flexDirection: 'column'  // Coloca uno debajo del otro
        }}
      >
        {/* El Header se mantiene fijo arriba gracias al flex column del padre */}
        <div className="modal-header-simple" style={{ flexShrink: 0 }}>
          <h3>📦 Solicitar Material</h3>
          <button className="close-btn-simple" onClick={onClose}><X size={20}/></button>
        </div>
        
        {/* Cuerpo con Scroll */}
        <div 
          className="p-4" 
          style={{ 
            overflowY: 'auto', // Activa el scroll vertical si el contenido es largo
            padding: '20px'    // Aseguramos padding interno
          }}
        >
          <div className="info-box mb-4" style={{backgroundColor: '#e0e7ff', padding: '10px', borderRadius: '5px', color: '#3730a3'}}>
            <p className="text-sm">
              <strong>Material:</strong> {material.NOMBRE} <br/>
              <strong>Código:</strong> #{material.CODIGO_UNICO}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
                <br />
              <label className="flex items-center gap-2">
                <MapPin size={16}/> Depósito Proveedor
              </label>
              <select 
                className="discord-select" 
                required
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                <option value="">-- Seleccionar Depósito --</option>
                {proveedoresDisponibles.map(d => (
                  <option key={d.ID_DEPOSITO} value={d.ID_DEPOSITO}>
                    {d.NOMBRE} ({d.DIRECCION})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group mt-3">
              <label>Cantidad Requerida ({material.UNIDAD_MEDIDA})</label>
              <input 
                type="number" 
                className="discord-input"
                required 
                min="0.1"
                step="any"
                placeholder="Ej: 50"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>

            <div className="input-group mt-3">
              <label>Nota para el transporte (Opcional)</label>
              <textarea 
                className="discord-textarea"
                rows="2"
                placeholder="Ej: Urgente, enviar en camión refrigerado si es posible..."
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
              />
            </div>

            <div className="modal-footer mt-4">
              <button type="button" className="btn-status" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-save" disabled={loading} style={{backgroundColor: '#f59e0b'}}>
                {loading ? "Procesando..." : (
                    <><Truck size={18} style={{marginRight:5}}/> Crear Pedido</>
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-3 text-xs text-gray-500 flex gap-2 items-start">
            <AlertCircle size={14} className="mt-0.5"/>
            <p>Esta solicitud quedará como "Pendiente" hasta que el depósito proveedor asigne un camión para el traslado.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolicitudModal;