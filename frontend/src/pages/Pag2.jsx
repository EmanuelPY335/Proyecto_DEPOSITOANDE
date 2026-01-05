// src/pages/Pag2.jsx
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../utils/api";
import { 
  Plus, Calendar, Trash2, TrendingDown, X // <--- 1. Agregamos la 'X' aquí
} from "lucide-react";
import "../styles/Ordenes.css"; 

const Pag2 = () => {
  const [gastos, setGastos] = useState([]);
  const [total, setTotal] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  // Filtros
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [year] = useState(new Date().getFullYear());

  // Formulario Nuevo Gasto
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    monto: "",
    id_categoria: "",
    fecha: new Date().toISOString().slice(0, 16) 
  });

  const loadData = useCallback(async () => {
    try {
      const resp = await apiFetch(`http://127.0.0.1:5000/api/gastos?mes=${mes}&year=${year}`);
      setGastos(resp.data || []);
      setTotal(resp.total || 0);
    } catch (e) { console.error(e); }
  }, [mes, year]); 

  const loadCategorias = useCallback(async () => {
    try {
      const data = await apiFetch("http://127.0.0.1:5000/api/gastos/categorias");
      setCategorias(data || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    loadData();
    loadCategorias();
  }, [loadData, loadCategorias]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!form.id_categoria) return alert("Selecciona una categoría");
    
    try {
      await apiFetch("http://127.0.0.1:5000/api/gastos", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setShowModal(false);
      setForm({ 
        titulo: "", 
        descripcion: "", 
        monto: "", 
        id_categoria: "", 
        fecha: new Date().toISOString().slice(0, 16) 
      });
      loadData(); 
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("¿Eliminar este registro?")) return;
    try {
      await apiFetch(`http://127.0.0.1:5000/api/gastos/${id}`, { method: "DELETE" });
      loadData(); 
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="dashboard-layout">
      <div className="content-dashboard">
        
        {/* ENCABEZADO Y FILTROS */}
        <div className="page-header">
          <div>
            <h1>Gestión de Gastos</h1>
            <p className="subtitle">Control de caja chica y egresos operativos.</p>
          </div>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
             <div className="input-group" style={{marginBottom:0, width:'120px'}}>
                <select className="discord-select" value={mes} onChange={e=>setMes(e.target.value)}>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
             </div>
             <button className="btn-new" onClick={() => setShowModal(true)}>
               <Plus size={18} /> Registrar Gasto
             </button>
          </div>
        </div>

        {/* TARJETA DE RESUMEN */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'20px', marginBottom:'25px'}}>
            <div className="discord-card" style={{background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color:'white'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                    <div>
                        <p style={{margin:0, opacity:0.9, fontSize:'0.9rem'}}>Total Egresos ({mes}/{year})</p>
                        <h2 style={{margin:'5px 0 0 0', fontSize:'2rem'}}>
                            Gs. {total.toLocaleString()}
                        </h2>
                    </div>
                    <div style={{background:'rgba(255,255,255,0.2)', padding:'8px', borderRadius:'8px'}}>
                        <TrendingDown size={24} color="white"/>
                    </div>
                </div>
            </div>
        </div>

        {/* TABLA DE GASTOS */}
        <div className="discord-card">
          <table className="discord-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th>Monto</th>
                <th>Autor</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.length === 0 ? (
                  <tr><td colSpan="6" style={{textAlign:'center', padding:'30px', color:'#999'}}>No hay gastos registrados en este periodo.</td></tr>
              ) : (
                  gastos.map((g) => (
                    <tr key={g.id}>
                      <td style={{color:'#666'}}>
                          <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                              <Calendar size={14}/> {g.fecha_iso}
                          </div>
                      </td>
                      <td>
                          <div style={{fontWeight:'600', color:'#333'}}>{g.titulo}</div>
                          {g.descripcion && <small>{g.descripcion}</small>}
                      </td>
                      <td>
                          <span className="badge-estado" style={{backgroundColor: g.color + '20', color: g.color}}>
                              {g.categoria}
                          </span>
                      </td>
                      <td style={{fontWeight:'bold', color:'#dc2626'}}>
                          - {g.monto.toLocaleString()} Gs.
                      </td>
                      <td style={{fontSize:'0.85rem'}}>{g.autor}</td>
                      <td>
                          <button className="btn-icon-simple danger" onClick={() => handleDelete(g.id)} title="Eliminar">
                              <Trash2 size={16}/>
                          </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- MODAL NUEVO GASTO CORREGIDO --- */}
        {showModal && (
          <div className="modal-backdrop">
            {/* Agregamos maxHeight y Flex para controlar el layout */}
            <div className="discord-card" style={{
                width:'450px', 
                maxHeight: '90vh', // 2. Límite de altura
                display: 'flex', 
                flexDirection: 'column' 
            }}>
                {/* Header fijo */}
                <div className="modal-header" style={{
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '10px'
                }}>
                    <h2 style={{margin: 0}}>Nuevo Gasto</h2>
                    {/* Botón de Cerrar */}
                    <button 
                        onClick={() => setShowModal(false)}
                        style={{background: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer'}}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Cuerpo con Scroll (overflow-y: auto) */}
                <div style={{overflowY: 'auto', paddingRight: '5px'}}>
                    <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px', marginTop:'5px'}}>
                        
                        <div className="input-group">
                            <label>Título / Concepto</label>
                            <input type="text" required autoFocus 
                                value={form.titulo} onChange={e=>setForm({...form, titulo: e.target.value})} 
                                placeholder="Ej: Compra de café"/>
                        </div>

                        <div className="row-2" style={{display:'flex', gap:'10px'}}>
                            <div className="input-group" style={{flex:1}}>
                                <label>Monto (Gs)</label>
                                <input type="number" required min="1"
                                    value={form.monto} onChange={e=>setForm({...form, monto: e.target.value})} />
                            </div>
                            <div className="input-group" style={{flex:1}}>
                                <label>Categoría</label>
                                <select className="discord-select" required
                                    value={form.id_categoria} onChange={e=>setForm({...form, id_categoria: e.target.value})}>
                                    <option value="">-- Seleccionar --</option>
                                    {categorias.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Fecha y Hora</label>
                            <input type="datetime-local" required className="discord-select"
                                value={form.fecha} onChange={e=>setForm({...form, fecha: e.target.value})} />
                        </div>

                        <div className="input-group">
                            <label>Descripción (Opcional)</label>
                            <textarea rows="2" 
                                value={form.descripcion} onChange={e=>setForm({...form, descripcion: e.target.value})}
                                placeholder="Detalles adicionales..."></textarea>
                        </div>

                        <div className="wizard-buttons" style={{marginTop:'10px'}}>
                            <button type="button" className="btn-status btn-danger" onClick={()=>setShowModal(false)}>Cancelar</button>
                            <button type="submit" className="btn-save">Registrar Salida</button>
                        </div>
                    </form>
                </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Pag2;