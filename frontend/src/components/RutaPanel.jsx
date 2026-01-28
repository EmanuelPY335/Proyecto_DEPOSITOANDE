import React, { useMemo, useState } from "react";
import { Calendar } from "lucide-react";

export default function RutaPanel({
  open,
  onClose,

  roleLower,
  esAdminMapa,

  tabRutas,
  setTabRutas,

  mesFiltro,
  setMesFiltro,

  rutasChofer = [],
  rutaChoferSeleccionada,
  setRutaChoferSeleccionada,
  onSeleccionarRutaChofer,
  onIniciarRuta,
  onFinalizarRuta,
  rutaEnCurso,
  loadingAccion,

  rutaActiva,
  tramoIdx = 0,
  onSeleccionarTramo,
  onSetModoRuta,

  historialRutas = [],
  rutaSeleccionada,
  onSeleccionarRutaHistorial,

  trasladosMes = [],
  onSeleccionarTraslado,
  onDibujarMes,

  // ✅ NUEVO: filtros master_admin
  esMasterAdmin = false,
  depositos = [],
  depositoFiltro = "ALL",
  setDepositoFiltro,
  textoChoferFiltro = "",
  setTextoChoferFiltro,

  // ✅ NUEVO: para expand de traslados (paradas)
  fetchDetalleGrupo, // (grupo) => Promise<{meta, paradas}>
}) {
  const esChofer = roleLower === "chofer";

  // Para no mezclar expansions entre tabs, usamos keys con prefijo:
  // mis:<id_grupo>  |  tras:<grupo_ruta>
  const [expandedKey, setExpandedKey] = useState(null);

  const [detalleByGrupo, setDetalleByGrupo] = useState({});
  const [loadingGrupo, setLoadingGrupo] = useState({});

  const historialFiltrado = useMemo(() => {
    const arr = historialRutas || [];
    if (!mesFiltro) return arr;

    const toYYYYMM = (s) => {
      if (!s) return "";
      const [fecha] = String(s).split(" ");
      const [dd, mm, yyyy] = fecha.split("/");
      if (!dd || !mm || !yyyy) return "";
      return `${yyyy}-${mm.padStart(2, "0")}`;
    };

    return arr.filter((r) => toYYYYMM(r.inicio) === mesFiltro);
  }, [historialRutas, mesFiltro]);

  const handleToggleRutaChofer = (ruta) => {
    const id = String(ruta?.id_grupo ?? "");
    const key = `mis:${id}`;

    setRutaChoferSeleccionada?.(ruta);
    onSeleccionarRutaChofer?.(ruta);

    onSetModoRuta?.("completo");
    onSeleccionarTramo?.(0);

    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const getParadasForItem = (rutaItem) => {
    if (
      String(rutaActiva?.id_grupo) === String(rutaItem?.id_grupo) &&
      Array.isArray(rutaActiva?.paradas)
    ) {
      return rutaActiva.paradas;
    }

    if (Array.isArray(rutaItem?.paradas)) return rutaItem.paradas;
    if (Array.isArray(rutaItem?.puntos)) return rutaItem.puntos;

    return [];
  };

  const handleToggleTraslado = async (t) => {
    const grupo = String(t?.grupo_ruta || "");
    if (!grupo) {
      // fallback: igual permitimos seleccionar
      onSeleccionarTraslado?.(t);
      return;
    }

    // ✅ siempre seleccionar al click (mantiene lo que ya funcionaba)
    onSeleccionarTraslado?.(t);

    const key = `tras:${grupo}`;
    const nextExpanded = expandedKey === key ? null : key;
    setExpandedKey(nextExpanded);

    // ✅ si estamos expandiendo, buscamos detalle (si no está cacheado)
    if (nextExpanded === key && !detalleByGrupo[grupo] && typeof fetchDetalleGrupo === "function") {
      try {
        setLoadingGrupo((prev) => ({ ...prev, [grupo]: true }));
        const det = await fetchDetalleGrupo(grupo);
        setDetalleByGrupo((prev) => ({ ...prev, [grupo]: det || { meta: null, paradas: [] } }));
      } catch (e) {
        setDetalleByGrupo((prev) => ({ ...prev, [grupo]: { meta: null, paradas: [] } }));
      } finally {
        setLoadingGrupo((prev) => ({ ...prev, [grupo]: false }));
      }
    }
  };

  const formatMaybeDate = (v) => {
    if (!v) return "";
    // si ya viene formateado, lo devolvemos
    const s = String(v);
    return s;
  };

  return (
    <div className="ruta-panel-box">
      {/* Tabs */}
      <div className="ruta-modal-tabs">
        {esChofer && (
          <button
            className={`tab ${tabRutas === "mis" ? "active" : ""}`}
            onClick={() => setTabRutas("mis")}
          >
            Mis rutas
          </button>
        )}

        {esAdminMapa && (
          <button
            className={`tab ${tabRutas === "historial" ? "active" : ""}`}
            onClick={() => setTabRutas("historial")}
          >
            Historial
          </button>
        )}

        <button
          className={`tab ${tabRutas === "traslados" ? "active" : ""}`}
          onClick={() => setTabRutas("traslados")}
        >
          Traslados (mes)
        </button>
      </div>

      {/* Filtro mes */}
      <div className="ruta-modal-filter">
        <div className="filter-label">
          <Calendar size={16} />
          <span>Mes</span>
        </div>

        <input
          type="month"
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="ruta-month-input"
        />
      </div>

      {/* ✅ filtros master_admin (solo UI) */}
      {esMasterAdmin && tabRutas === "traslados" && (
        <div className="ruta-modal-filter" style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
            Filtros Master Admin
          </div>

          <select
            className="ruta-month-input"
            value={depositoFiltro}
            onChange={(e) => setDepositoFiltro?.(e.target.value)}
          >
            <option value="ALL">Todos los depósitos</option>
            {depositos.map((d) => (
              <option key={d.ID_DEPOSITO} value={String(d.ID_DEPOSITO)}>
                {d.NOMBRE}
              </option>
            ))}
          </select>

          <input
            className="ruta-month-input"
            placeholder="Filtrar por chofer (texto)"
            value={textoChoferFiltro}
            onChange={(e) => setTextoChoferFiltro?.(e.target.value)}
          />
        </div>
      )}

      {/* Body */}
      <div className="ruta-modal-body">
        {/* CHOFER */}
        {esChofer && tabRutas === "mis" && (
          <>
            {rutasChofer.length === 0 ? (
              <div className="no-data-card">No tenés rutas asignadas.</div>
            ) : (
              <div className="ruta-list">
                {rutasChofer.map((r) => {
                  const isSelected =
                    String(rutaChoferSeleccionada?.id_grupo) === String(r.id_grupo);

                  const key = `mis:${String(r.id_grupo)}`;
                  const isExpanded = expandedKey === key;
                  const paradas = isExpanded ? getParadasForItem(r) : [];

                  return (
                    <div
                      key={r.id_grupo}
                      className={`ruta-item ${isSelected ? "selected" : ""}`}
                      onClick={() => handleToggleRutaChofer(r)}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                      }}
                    >
                      {/* header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div className="ruta-item-main">
                          <div className="ruta-item-title">{r.id_grupo}</div>
                          <div className="ruta-item-sub">
                            {r.origen || "Origen"} → {r.destino || "Destino"}
                          </div>
                        </div>

                        <div className="ruta-item-badge">
                          {String(r.estado || "").toLowerCase() === "en_proceso"
                            ? "EN PROCESO"
                            : "PENDIENTE"}
                        </div>
                      </div>

                      {/* accordion */}
                      {isExpanded && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: "1px solid rgba(0,0,0,0.08)",
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: 8 }}>
                            Paradas
                          </div>

                          {paradas.length === 0 ? (
                            <div style={{ opacity: 0.7, fontSize: 13 }}>
                              Cargando paradas...
                            </div>
                          ) : (
                            <div style={{ display: "grid", gap: 6 }}>
                              {paradas.map((p, idx) => {
                                const esUltima = idx === paradas.length - 1;
                                const activo =
                                  String(rutaActiva?.id_grupo) ===
                                    String(r.id_grupo) && tramoIdx === idx;

                                return (
                                  <div
                                    key={idx}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 10,
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      background: "rgba(0,0,0,0.03)",
                                      fontSize: 13,
                                    }}
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <b>Parada #{idx + 1}:</b>{" "}
                                      {p?.nombre ||
                                        p?.NOMBRE ||
                                        `(${p?.lat}, ${p?.lng})`}
                                    </div>

                                    {!esUltima && (
                                      <button
                                        className={`btn-mini ${
                                          activo ? "success" : ""
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSeleccionarTramo?.(idx);
                                          onSetModoRuta?.("tramo");
                                        }}
                                      >
                                        Ver tramo
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="ruta-actions">
              <button
                className="btn-mini success"
                onClick={onIniciarRuta}
                disabled={
                  !rutaChoferSeleccionada?.id_grupo || rutaEnCurso || loadingAccion
                }
              >
                Iniciar
              </button>

              <button
                className="btn-mini danger"
                onClick={onFinalizarRuta}
                disabled={
                  !rutaChoferSeleccionada?.id_grupo ||
                  (!rutaEnCurso &&
                    String(rutaChoferSeleccionada?.estado || "").toLowerCase() !==
                      "en_proceso") ||
                  loadingAccion
                }
              >
                Finalizar
              </button>
            </div>
          </>
        )}

        {/* ADMIN HISTORIAL */}
        {esAdminMapa && tabRutas === "historial" && (
          <>
            {historialFiltrado.length === 0 ? (
              <div className="no-data-card">No hay recorridos para este mes.</div>
            ) : (
              <div className="ruta-list">
                {historialFiltrado.map((r) => (
                  <div
                    key={r.grupo_ruta}
                    className={`ruta-item ${
                      rutaSeleccionada === r.grupo_ruta ? "selected" : ""
                    }`}
                    onClick={() => onSeleccionarRutaHistorial(r.grupo_ruta)}
                  >
                    <div className="ruta-item-main">
                      <div className="ruta-item-title">{r.grupo_ruta}</div>
                      <div className="ruta-item-sub">
                        {r.inicio} → {r.fin}
                      </div>
                    </div>
                    <div className="ruta-item-badge">FINALIZADO</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TRASLADOS */}
        {tabRutas === "traslados" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <button
                className="btn-mini"
                onClick={onDibujarMes}
                disabled={!mesFiltro}
              >
                Dibujar todo el mes
              </button>
            </div>

            {trasladosMes.length === 0 ? (
              <div className="no-data-card">No hay traslados para este mes.</div>
            ) : (
              <div className="ruta-list">
                {trasladosMes.map((t) => {
                  const grupo = String(t?.grupo_ruta || "");
                  const key = `tras:${grupo}`;
                  const isExpanded = expandedKey === key;

                  const det = detalleByGrupo[grupo];
                  const paradas = det?.paradas || [];
                  const meta = det?.meta || null;
                  const cargando = !!loadingGrupo[grupo];

                  const badgeText = (() => {
                    if (paradas.length > 1) return "MULTI";
                    return `${t.items_count} items`;
                  })();

                  return (
                    <div
                      key={t.id_vale || t.id_vale_ref || grupo}
                      className="ruta-item"
                      onClick={() => handleToggleTraslado(t)}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div className="ruta-item-main">
                          <div className="ruta-item-title">{t.grupo_ruta}</div>
                          <div className="ruta-item-sub">
                            {t.origen} → {t.destino} •{" "}
                            {t.fecha_entrega || t.fecha_salida}
                          </div>
                          {!!t.chofer && (
                            <div className="ruta-item-sub" style={{ opacity: 0.8 }}>
                              {t.chofer}{t.vehiculo ? ` • ${t.vehiculo}` : ""}
                            </div>
                          )}
                        </div>

                        <div className="ruta-item-badge">{badgeText}</div>
                      </div>

                      {/* Accordion detalle */}
                      {isExpanded && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: "1px solid rgba(0,0,0,0.08)",
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: 8 }}>
                            Detalle del grupo
                          </div>

                          {cargando ? (
                            <div style={{ opacity: 0.7, fontSize: 13 }}>
                              Cargando paradas...
                            </div>
                          ) : (
                            <>
                              {meta && (
                                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
                                  <div><b>Origen:</b> {meta.origen || t.origen}</div>
                                  <div><b>Chofer:</b> {meta.chofer || t.chofer || "—"}</div>
                                  <div><b>Vehículo:</b> {meta.vehiculo || t.vehiculo || "—"}</div>
                                  {(meta.fecha_salida || meta.fecha_llegada) && (
                                    <div>
                                      <b>Fechas:</b>{" "}
                                      {formatMaybeDate(meta.fecha_salida) || "—"}{" "}
                                      → {formatMaybeDate(meta.fecha_llegada) || "—"}
                                    </div>
                                  )}
                                </div>
                              )}

                              {paradas.length === 0 ? (
                                <div style={{ opacity: 0.7, fontSize: 13 }}>
                                  Sin paradas (o no disponible).
                                </div>
                              ) : (
                                <div style={{ display: "grid", gap: 6 }}>
                                  {paradas.map((p, idx) => {
                                    const itemsCount = Array.isArray(p?.items)
                                      ? p.items.length
                                      : 0;

                                    return (
                                      <div
                                        key={idx}
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          gap: 10,
                                          padding: "8px 10px",
                                          borderRadius: 10,
                                          background: "rgba(0,0,0,0.03)",
                                          fontSize: 13,
                                        }}
                                      >
                                        <div style={{ minWidth: 0 }}>
                                          <b>Parada #{idx + 1}:</b>{" "}
                                          {p?.destino || "Destino"}
                                        </div>
                                        <div style={{ opacity: 0.85 }}>
                                          {itemsCount} items
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
