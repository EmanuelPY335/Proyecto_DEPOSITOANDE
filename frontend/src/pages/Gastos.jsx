// src/pages/Gastos.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { Plus, Trash2, Calendar, DollarSign, Filter, X, Truck, FileText, ShieldAlert } from "lucide-react";
import { generarReporteGastosPDF } from "../utils/pdfGenerator";
import "../styles/Gastos.css";

const Gastos = () => {
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const [filtroCat, setFiltroCat] = useState("");
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1); 
  const [filtroAnio, setFiltroAnio] = useState(currentYear); 
  
  const [newGasto, setNewGasto] = useState({
    titulo: "", monto: "", categoria_id: "", descripcion: "", id_vehiculo: ""
  });

  const userRole = sessionStorage.getItem("user_rol");
  const userPermissions = JSON.parse(sessionStorage.getItem("user_permissions") || "[]");
  
  const puedeGestionarGastos = () => {
    if (userRole === "Master_Admin") return true;
    return userPermissions.includes("gestion_gastos");
  };

  useEffect(() => {
    if (puedeGestionarGastos()) {
      fetchData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [filtroMes, filtroAnio]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroMes) params.append("mes", filtroMes);
      if (filtroAnio) params.append("year", filtroAnio);

      const [gastosData, auxData] = await Promise.all([
        apiFetch(`/api/gastos?${params.toString()}`),
        apiFetch("/api/gastos/auxiliar")
      ]);

      setGastos(Array.isArray(gastosData) ? gastosData : []);
      if (auxData) {
        setCategorias(auxData.categorias || []);
        setVehiculos(auxData.vehiculos || []);
      }
    } catch (error) {
      console.error(error);
      setGastos([]);
    } finally {
      setLoading(false);
    }
  };

  if (!puedeGestionarGastos()) {
    return (
      <div className="fade-in" style={{textAlign:'center', padding:'50px', color:'#4b5563'}}>
        <ShieldAlert size={64} style={{color:'#ef4444', marginBottom:20}} />
        <h1>Acceso Restringido</h1>
      </div>
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiFetch("/api/gastos", { method: "POST", body: JSON.stringify(newGasto) });
      setShowModal(false);
      setNewGasto({ titulo: "", monto: "", categoria_id: "", descripcion: "", id_vehiculo: "" });
      fetchData();
    } catch (error) { alert("Error al guardar"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar?")) return;
    try {
      await apiFetch(`/api/gastos/${id}`, { method: "DELETE" });
      setGastos(prev => prev.filter(g => g.id !== id));
    } catch (error) { console.error(error); }
  };

  const gastosFiltrados = gastos.filter(g => filtroCat ? g.categoria === filtroCat : true);

  const handleDownloadPDF = () => {
    const userName = sessionStorage.getItem("user_nombre") || "Usuario";
    
    // --- LÓGICA CORREGIDA PARA EL NOMBRE DEL DEPÓSITO ---
    let nombreDeposito = "Mi Depósito";

    if (userRole === "Master_Admin") {
        nombreDeposito = "Global (Todos los Depósitos)";
    } else {
        // 1. Intentamos sacar el nombre real del primer gasto de la lista (viene del backend)
        if (gastosFiltrados.length > 0 && gastosFiltrados[0].deposito) {
            nombreDeposito = gastosFiltrados[0].deposito;
        } 
        // 2. Si la lista está vacía, intentamos usar la sesión
        else {
            nombreDeposito = sessionStorage.getItem("user_deposito_nombre") || "Mi Depósito";
        }
    }
    // ----------------------------------------------------

    const meses = ["Todo", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const nombrePeriodo = `${filtroMes ? meses[filtroMes] : "Todos"} ${filtroAnio}`;
    
    generarReporteGastosPDF(gastosFiltrados, userName, nombrePeriodo, nombreDeposito);
  };

  const totalGastos = gastosFiltrados.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);
  
  // Lógica para mostrar select de vehículo
  const catSeleccionada = categorias.find(c => String(c.id) === String(newGasto.categoria_id));
  const nombreCat = catSeleccionada ? catSeleccionada.nombre.toLowerCase() : "";
  const requiereVehiculo = nombreCat.includes("mantenimiento") || nombreCat.includes("viáticos") || nombreCat.includes("peaje") || nombreCat.includes("combustible");

  return (
    <div className="gastos-page fade-in">
      <div className="gastos-header">
        <div>
          <h1>Gestión de Gastos</h1>
          <p className="subtitle">Control financiero</p>
        </div>
        <div style={{display:'flex', gap:'10px'}}>
            <button className="btn-secondary" onClick={handleDownloadPDF}><FileText size={18} /> PDF</button>
            <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Nuevo</button>
        </div>
      </div>

      <div className="gastos-stats">
        <div className="stat-card total">
          <div className="icon-circle"><DollarSign size={20} /></div>
          <div><h3>Total</h3><p className="stat-value">Gs. {totalGastos.toLocaleString()}</p></div>
        </div>
        <div className="stat-card count">
          <div className="icon-circle"><Calendar size={20} /></div>
          <div><h3>Registros</h3><p className="stat-value">{gastosFiltrados.length}</p></div>
        </div>
      </div>

      <div className="filters-bar">
          <div className="filter-group">
            <label>Año</label>
            <select className="filter-select" value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)}>
              <option value="">Todos</option>
              {[currentYear, currentYear-1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Mes</label>
            <select className="filter-select" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
              <option value="">Todos</option>
              {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => (
                  <option key={i} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Categoría</label>
            <select className="filter-select" value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </div>
      </div>

      <div className="table-container">
        <table className="gastos-table">
          <thead>
            <tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Vehículo</th><th>Monto</th><th></th></tr>
          </thead>
          <tbody>
            {gastosFiltrados.map((g) => (
              <tr key={g.id}>
                <td>{g.fecha_iso}</td>
                <td><span style={{fontWeight:600}}>{g.titulo}</span><br/><small style={{color:'#999'}}>{g.descripcion}</small></td>
                <td><span className="cat-badge" style={{color:g.color, background: g.color+'20'}}>{g.categoria}</span></td>
                <td>{g.vehiculo ? <><Truck size={12}/> {g.vehiculo}</> : "-"}</td>
                <td className="monto-cell">Gs. {g.monto.toLocaleString()}</td>
                <td><button className="btn-icon" onClick={() => handleDelete(g.id)}><Trash2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="gastos-modal-overlay">
          <div className="gastos-modal-content">
            <div className="gastos-modal-header">
              <h3>Nuevo Gasto</h3>
              <button onClick={() => setShowModal(false)} style={{background:'none', border:'none', cursor:'pointer'}}><X size={20}/></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Título</label>
                <input className="form-input" autoFocus type="text" value={newGasto.titulo} onChange={e => setNewGasto({...newGasto, titulo: e.target.value})} required />
              </div>
              <div style={{display:'flex', gap:'15px'}}>
                  <div className="form-group" style={{flex:1}}>
                    <label>Monto</label>
                    <input className="form-input" type="number" value={newGasto.monto} onChange={e => setNewGasto({...newGasto, monto: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{flex:1}}>
                    <label>Categoría</label>
                    <select className="form-select" value={newGasto.categoria_id} onChange={e => setNewGasto({...newGasto, categoria_id: e.target.value, id_vehiculo: ""})} required>
                        <option value="">Seleccionar...</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
              </div>
              {requiereVehiculo && (
                  <div className="form-group slide-in-animation">
                    <label style={{color: '#2563eb'}}>Asignar Vehículo *</label>
                    <select className="form-select" value={newGasto.id_vehiculo} onChange={e => setNewGasto({...newGasto, id_vehiculo: e.target.value})} required>
                        <option value="">-- Seleccionar --</option>
                        {vehiculos.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                  </div>
              )}
              <div className="form-group">
                <label>Descripción</label>
                <textarea className="form-textarea" rows="2" value={newGasto.descripcion} onChange={e => setNewGasto({...newGasto, descripcion: e.target.value})}></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gastos;