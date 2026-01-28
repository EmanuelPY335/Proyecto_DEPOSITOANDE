// src/pages/Buzon.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import "../styles/Buzon.css";

function normalizeId(id) {
  if (id === null || id === undefined) return null;
  const s = String(id).trim();
  const clean = s.replace("db-", "").trim();
  const n = parseInt(clean, 10);
  return Number.isFinite(n) ? n : null;
}

function safeMeta(meta) {
  if (!meta) return null;
  if (typeof meta === "object") return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return { raw: String(meta) };
  }
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function normText(v) {
  return String(v || "").trim();
}

function normKey(v) {
  return String(v || "").trim().toLowerCase();
}

function extractMotivoFromMensaje(mensaje) {
  const m = String(mensaje || "");
  const idx = m.toLowerCase().indexOf("motivo:");
  if (idx === -1) return "";
  return m.slice(idx + "motivo:".length).trim();
}

function extractSolicitudId(meta) {
  if (!meta) return null;
  const v =
    meta?.id_solicitud ??
    meta?.ID_SOLICITUD ??
    meta?.solicitud_id ??
    meta?.idSolicitud ??
    null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractValeId(meta) {
  if (!meta) return null;
  const v =
    meta?.id_vale ??
    meta?.ID_VALE ??
    meta?.id_vale_ref ??
    meta?.idVale ??
    null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractGrupoRuta(meta) {
  if (!meta) return "";
  return (
    meta?.grupo_ruta ??
    meta?.GRUPO_RUTA ??
    meta?.grupo ??
    meta?.grupoRuta ??
    ""
  );
}

/**
 * Si el backend no manda link o manda "#",
 * intentamos construir uno útil según meta/tipo.
 */
function computeLink(it) {
  const raw = normText(it?.link);
  if (raw && raw !== "#") return raw;

  const meta = it?.meta || {};
  const tipo = normKey(it?.tipo);

  const idSolicitud = extractSolicitudId(meta);
  const idVale = extractValeId(meta);
  const grupoRuta = extractGrupoRuta(meta);

  // solicitudes/pedidos
  if (idSolicitud) return `/movimientos?tab=pedidos&highlight=${encodeURIComponent(idSolicitud)}`;

  // traslados
  if (grupoRuta) return `/movimientos?tab=traslados&highlight=${encodeURIComponent(grupoRuta)}`;
  if (idVale) return `/movimientos?tab=traslados&highlight=${encodeURIComponent(idVale)}`;

  // fallback por tipo
  if (tipo.startsWith("solicitud.") || tipo.includes("pedido")) return `/movimientos?tab=pedidos`;
  if (tipo.includes("vale") || tipo.includes("traslado") || tipo.includes("ruta")) return `/movimientos?tab=traslados`;

  return "#";
}

function prettyPairsFromMeta(meta) {
  if (!meta || typeof meta !== "object") return [];

  const pairs = [];

  const idSolicitud = extractSolicitudId(meta);
  const items = meta?.items ?? meta?.ITEMS ?? meta?.cantidad_items ?? meta?.items_count;

  const idVale = extractValeId(meta);
  const grupoRuta = extractGrupoRuta(meta);

  if (idSolicitud) pairs.push(["Solicitud", `#${idSolicitud}`]);
  if (typeof items !== "undefined" && items !== null) {
    const n = Number(items);
    const txt = Number.isFinite(n) ? `${n} ${n === 1 ? "item" : "items"}` : String(items);
    pairs.push(["Items", txt]);
  }

  if (grupoRuta) pairs.push(["Grupo ruta", String(grupoRuta)]);
  if (idVale) pairs.push(["Vale", `#${idVale}`]);

  // extras útiles
  const extraKeys = [
    "deposito",
    "deposito_nombre",
    "deposito_proveedor",
    "deposito_solicitante",
    "origen",
    "destino",
  ];

  for (const k of extraKeys) {
    if (meta?.[k]) pairs.push([k, String(meta[k])]);
  }

  return pairs;
}

export default function Buzon() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState([]);

  // ✅ rol actual (para no mostrar acciones que no corresponden)
  const userRole = sessionStorage.getItem("user_rol") || "";
  const roleLow = normKey(userRole);
  const canRecepcionar = useMemo(() => {
    return ["admin", "master_admin", "personal_inventario"].includes(roleLow);
  }, [roleLow]);

  // filtros
  const [q, setQ] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [tipo, setTipo] = useState("ALL");
  const [deposito, setDeposito] = useState("ALL");

  // selección lote
  const [selectedSet, setSelectedSet] = useState(() => new Set());

  // modal
  const [openId, setOpenId] = useState(null);
  const modalRef = useRef(null);
  const rowRefs = useRef(new Map());

  // ✅ detalle de solicitud (materiales)
  const solicitudCacheRef = useRef(new Map()); // idSolicitud -> { items, raw }
  const [solLoading, setSolLoading] = useState(false);
  const [solError, setSolError] = useState("");
  const [solDetalle, setSolDetalle] = useState(null); // { items: [], raw: {} }

  const focusId = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return normalizeId(sp.get("focus"));
  }, [location.search]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/api/buzon");
      const normalized = (Array.isArray(data) ? data : []).map((n) => {
        const metaObj = safeMeta(n.meta);

        const dep =
          normText(n.deposito) ||
          normText(metaObj?.deposito) ||
          normText(metaObj?.deposito_nombre) ||
          normText(metaObj?.deposito_solicitante) ||
          normText(metaObj?.deposito_proveedor) ||
          "";

        const cleanId = normalizeId(n.id);

        const merged = {
          ...n,
          id: cleanId,
          tipo: normText(n.tipo),
          deposito: dep,
          sender: normText(n.sender) || "Sistema",
          mensaje: normText(n.mensaje),
          leida: !!n.leida,
          starred: !!n.starred,
          meta: metaObj,
        };

        // ✅ link inteligente (si el backend manda "#"/vacío)
        merged.link = computeLink(merged);

        return merged;
      });

      setItems(normalized);
      setLoading(false);

      if (focusId) {
        requestAnimationFrame(() => {
          const node = rowRefs.current.get(focusId);
          if (node?.scrollIntoView) node.scrollIntoView({ behavior: "smooth", block: "center" });
        });

        const exists = normalized.some((x) => x.id === focusId);
        if (exists) setOpenId(focusId);
      }
    } catch (e) {
      setLoading(false);
      setError(e?.message || "Error cargando buzón");
    }
  }, [focusId]);

  useEffect(() => {
    load();
  }, [load]);

  // cerrar modal clic afuera
  useEffect(() => {
    const handler = (e) => {
      if (!openId) return;
      if (modalRef.current && !modalRef.current.contains(e.target)) setOpenId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openId]);

  const depositosDisponibles = useMemo(() => {
    const set = new Set();
    for (const it of items) if (it.deposito) set.add(it.deposito);
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const tiposDisponibles = useMemo(() => {
    const set = new Set();
    for (const it of items) if (it.tipo) set.add(it.tipo);
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    const qq = normKey(q);
    const depKey = normKey(deposito);
    const tipoKey = normKey(tipo);

    return items
      .filter((it) => {
        if (onlyUnread && it.leida) return false;
        if (onlyStarred && !it.starred) return false;
        if (tipo !== "ALL" && normKey(it.tipo) !== tipoKey) return false;

        if (deposito !== "ALL") {
          const itDep = normKey(it.deposito);
          if (itDep !== depKey) return false;
        }

        if (!qq) return true;

        return (
          normKey(it.mensaje).includes(qq) ||
          normKey(it.sender).includes(qq) ||
          normKey(it.deposito).includes(qq) ||
          normKey(it.tipo).includes(qq)
        );
      })
      .sort((a, b) => {
        const da = a.fecha_iso ? new Date(a.fecha_iso).getTime() : 0;
        const db = b.fecha_iso ? new Date(b.fecha_iso).getTime() : 0;
        return db - da;
      });
  }, [items, q, onlyUnread, onlyStarred, tipo, deposito]);

  const unreadCount = useMemo(() => items.filter((x) => !x.leida).length, [items]);

  const selected = useMemo(() => {
    const nid = normalizeId(openId);
    return items.find((x) => x.id === nid) || null;
  }, [items, openId]);

  const motivo = useMemo(() => {
    if (!selected) return "";
    const m = selected.meta || null;
    const fromMeta = m?.motivo_anulacion || m?.motivo || m?.razon || m?.reason || m?.causa || "";
    return String(fromMeta || extractMotivoFromMensaje(selected.mensaje) || "").trim();
  }, [selected]);

  const prettyMetaPairs = useMemo(() => {
    if (!selected) return [];
    return prettyPairsFromMeta(selected.meta);
  }, [selected]);

  const updateLocal = (id, patch) => {
    const nid = normalizeId(id);
    setItems((prev) => prev.map((x) => (x.id === nid ? { ...x, ...patch } : x)));
  };

  const toggleSelect = (id) => {
    const nid = normalizeId(id);
    if (!nid) return;
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(nid)) next.delete(nid);
      else next.add(nid);
      return next;
    });
  };

  const clearSelection = () => setSelectedSet(new Set());
  const selectAllFiltered = () => setSelectedSet(new Set(filtered.map((x) => x.id).filter(Boolean)));
  const safeErr = (e) => e?.message || "Error en el servidor";

  const markRead = async (id, value) => {
    const nid = normalizeId(id);
    if (!nid) return;

    updateLocal(nid, { leida: !!value });
    try {
      await apiFetch(`/api/buzon/${nid}/${value ? "leer" : "noleer"}`, { method: "PUT" });
    } catch (e) {
      updateLocal(nid, { leida: !value });
      throw e;
    }
  };

  // ✅ FIX STAR: enviar JSON string + fallback (por si el backend no espera body)
  const toggleStar = async (id, value) => {
    const nid = normalizeId(id);
    if (!nid) return;

    updateLocal(nid, { starred: !!value });

    try {
      // Intento 1: body JSON (forma correcta si el backend valida "starred")
      await apiFetch(`/api/buzon/${nid}/star`, {
        method: "PUT",
        body: JSON.stringify({ starred: !!value }),
      });
    } catch (e1) {
      // Fallback: algunos backends "togglean" la estrella y no aceptan body
      try {
        await apiFetch(`/api/buzon/${nid}/star`, { method: "PUT" });
      } catch (e2) {
        // Revertimos estado local si falló todo
        updateLocal(nid, { starred: !value });
        throw e2;
      }
    }
  };

  const deleteOne = async (id) => {
    const nid = normalizeId(id);
    if (!nid) return;

    const snapshot = items;
    setItems((prev) => prev.filter((x) => x.id !== nid));

    try {
      await apiFetch(`/api/buzon/${nid}`, { method: "DELETE" });
      if (openId === nid) setOpenId(null);
    } catch (e) {
      setItems(snapshot);
      throw e;
    }
  };

  const batchDelete = async (ids) => {
    const clean = (ids || []).map(normalizeId).filter(Boolean);
    if (clean.length === 0) return;

    const snapshot = items;
    setItems((prev) => prev.filter((x) => !clean.includes(x.id)));

    try {
      await apiFetch(`/api/buzon/batch`, { method: "DELETE", body: { ids: clean } });
      clearSelection();
      if (clean.includes(openId)) setOpenId(null);
    } catch (e) {
      setItems(snapshot);
      throw e;
    }
  };

  const batchRead = async (ids) => {
    const clean = (ids || []).map(normalizeId).filter(Boolean);
    if (clean.length === 0) return;

    setItems((prev) => prev.map((x) => (clean.includes(x.id) ? { ...x, leida: true } : x)));
    try {
      await apiFetch(`/api/buzon/batch/read`, { method: "PUT", body: { ids: clean } });
      clearSelection();
    } catch (e) {
      await load();
      throw e;
    }
  };

  const openModal = async (it) => {
    if (!it?.id) return;
    setOpenId(it.id);

    if (!it.leida) {
      try {
        await markRead(it.id, true);
      } catch {}
    }
  };

  // ✅ detectar contexto por tipo/meta
  const modalContext = useMemo(() => {
    if (!selected) return { kind: "general", actionLabel: "Abrir enlace" };

    const tipoLow = normKey(selected.tipo);
    const meta = selected.meta || {};

    const idSolicitud = extractSolicitudId(meta);
    const idVale = extractValeId(meta);

    if (idSolicitud || tipoLow.includes("pedido") || tipoLow.startsWith("solicitud.")) {
      return { kind: "solicitud", actionLabel: "Ver pedido" };
    }

    if (idVale || tipoLow.includes("traslado") || tipoLow.includes("vale") || tipoLow.includes("ruta")) {
      return { kind: "traslado", actionLabel: "Ver traslado" };
    }

    return { kind: "general", actionLabel: "Abrir enlace" };
  }, [selected]);

  // ✅ botón “Traslado recibido”
  // FIX: solo mostrarlo si:
  // - hay idVale
  // - el rol actual puede recepcionar
  // - la notificación parece de recepción (tipo o meta.accion)
  const canConfirmRecepcion = useMemo(() => {
    if (!selected) return false;
    if (!canRecepcionar) return false;

    const meta = selected.meta || {};
    const idVale = extractValeId(meta);
    if (!idVale) return false;

    const tipoLow = normKey(selected.tipo);
    const accion = normKey(meta?.accion || meta?.action || "");

    const pareceRecepcion =
      tipoLow.includes("recepcion") ||
      accion.includes("recepcionar") ||
      accion.includes("recepcion");

    return !!pareceRecepcion;
  }, [selected, canRecepcionar]);

  const confirmRecepcion = async () => {
    if (!selected) return;

    if (!canRecepcionar) {
      alert("No autorizado: tu rol actual no puede confirmar recepción.");
      return;
    }

    const idVale = extractValeId(selected.meta || {});
    if (!idVale) return;

    const ok = window.confirm("¿Confirmar que el traslado fue RECIBIDO? Esto actualizará el stock.");
    if (!ok) return;

    setError("");
    setBusy(true);
    try {
      const res = await apiFetch(`/api/vales/${idVale}/confirmar_recepcion`, { method: "PUT" });
      await load();
      try {
        await markRead(selected.id, true);
      } catch {}
      if (res?.already_confirmed) {
          alert(res?.message || "ℹ️ Este traslado ya estaba confirmado (stock ya actualizado).");
        } else {
          alert(res?.message || "✅ Traslado recibido. Stock actualizado.");
        }
    } catch (e) {
      setError(safeErr(e));
    } finally {
      setBusy(false);
    }
  };

  // ✅ Cargar materiales de la solicitud (si hay id_solicitud)
  useEffect(() => {
    const run = async () => {
      setSolError("");
      setSolDetalle(null);
      setSolLoading(false);

      if (!selected) return;
      if (modalContext.kind !== "solicitud") return;

      const idSolicitud = extractSolicitudId(selected.meta || {});
      if (!idSolicitud) return;

      // cache
      const cached = solicitudCacheRef.current.get(idSolicitud);
      if (cached) {
        setSolDetalle(cached);
        return;
      }

      setSolLoading(true);
      try {
        // Estrategia: entrantes (devuelve items detallados)
        const entrantes = await apiFetch(`/api/solicitudes/entrantes`);
        const lista = Array.isArray(entrantes) ? entrantes : [];
        const found = lista.find((s) => Number(s?.id_solicitud) === Number(idSolicitud));

        if (found) {
          const detalle = {
            raw: found,
            items: Array.isArray(found?.items) ? found.items : [],
          };
          solicitudCacheRef.current.set(idSolicitud, detalle);
          setSolDetalle(detalle);
        } else {
          setSolError("No se pudo obtener el detalle de materiales para esta solicitud (no aparece en 'entrantes').");
        }
      } catch (e) {
        setSolError(e?.message || "Error obteniendo detalle de solicitud");
      } finally {
        setSolLoading(false);
      }
    };

    run();
  }, [selected, modalContext.kind]);

  return (
    <div className="bz-page">
      <div className="bz-header">
        <div className="bz-title">
          <h1>📬 Buzón</h1>
          <p>
            {unreadCount} sin leer · {items.length} total
          </p>
        </div>

        <div className="bz-head-actions">
          <button className="bz-btn" onClick={load} disabled={loading || busy}>
            🔄 Actualizar
          </button>
          <button className="bz-btn" onClick={() => navigate("/home")} disabled={busy}>
            ⬅ Volver
          </button>
        </div>
      </div>

      {error ? <div className="bz-error">{error}</div> : null}

      <div className="bz-filters">
        <input
          className="bz-input"
          placeholder="Buscar (mensaje, sender, depósito, tipo)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select className="bz-select" value={deposito} onChange={(e) => setDeposito(e.target.value)}>
          {depositosDisponibles.map((d) => (
            <option key={d} value={d}>
              {d === "ALL" ? "Todos los depósitos" : d}
            </option>
          ))}
        </select>

        <select className="bz-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {tiposDisponibles.map((t) => (
            <option key={t} value={t}>
              {t === "ALL" ? "Todos los tipos" : t}
            </option>
          ))}
        </select>

        <label className="bz-check">
          <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
          Solo sin leer
        </label>

        <label className="bz-check">
          <input type="checkbox" checked={onlyStarred} onChange={(e) => setOnlyStarred(e.target.checked)} />
          Solo destacados
        </label>
      </div>

      <div className="bz-batchbar">
        <button className="bz-btn" onClick={selectAllFiltered} disabled={busy || filtered.length === 0}>
          ✅ Seleccionar todo
        </button>

        <button
          className="bz-btn"
          onClick={async () => {
            setError("");
            try {
              setBusy(true);
              await batchRead(Array.from(selectedSet));
            } catch (e) {
              setError(safeErr(e));
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || selectedSet.size === 0}
        >
          📖 Marcar leído
        </button>

        <button
          className="bz-btn bz-danger"
          onClick={async () => {
            if (selectedSet.size === 0) return;
            const ok = window.confirm(`¿Borrar ${selectedSet.size} notificación(es)?`);
            if (!ok) return;

            setError("");
            try {
              setBusy(true);
              await batchDelete(Array.from(selectedSet));
            } catch (e) {
              setError(safeErr(e));
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || selectedSet.size === 0}
        >
          🗑️ Borrar selección
        </button>

        <button className="bz-btn bz-ghost" onClick={clearSelection} disabled={busy || selectedSet.size === 0}>
          Limpiar
        </button>

        <div className="bz-count">
          Mostrando <b>{filtered.length}</b>
        </div>
      </div>

      <div className="bz-list">
        {loading ? (
          <div className="bz-empty">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="bz-empty">No hay notificaciones con esos filtros.</div>
        ) : (
          filtered.map((it) => (
            <div
              key={it.id}
              className={`bz-row ${!it.leida ? "unread" : ""}`}
              ref={(node) => node && rowRefs.current.set(it.id, node)}
            >
              <div className="bz-row-left">
                <input type="checkbox" checked={selectedSet.has(it.id)} onChange={() => toggleSelect(it.id)} />
              </div>

              <div className="bz-row-body">
                <div className="bz-row-tags">
                  <span className="bz-tag">{it.tipo || "info.general"}</span>
                  {it.deposito ? <span className="bz-tag">🏬 {it.deposito}</span> : null}
                  {it.starred ? <span className="bz-tag">⭐ Destacado</span> : null}
                  {!it.leida ? <span className="bz-tag blue">Sin leer</span> : <span className="bz-tag">Leído</span>}
                </div>

                <div className="bz-msg">{it.mensaje || "(sin mensaje)"}</div>

                <div className="bz-sub">
                  <span>De: {it.sender || "Sistema"}</span>
                  <span>·</span>
                  <span>{fmtDate(it.fecha_iso)}</span>
                </div>
              </div>

              <div className="bz-row-actions">
                <button
                  className="bz-iconbtn"
                  onClick={async () => {
                    setError("");
                    try {
                      setBusy(true);
                      await toggleStar(it.id, !it.starred);
                    } catch (e) {
                      setError(safeErr(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  title="Destacar"
                >
                  {it.starred ? "⭐" : "☆"}
                </button>

                <button className="bz-btn bz-small" onClick={() => openModal(it)}>
                  Ver
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {openId && selected ? (
        <div className="bz-modal-overlay">
          <div className="bz-modal" ref={modalRef}>
            <div className="bz-modal-head">
              <div className="bz-modal-title">Detalle</div>
              <button className="bz-btn bz-ghost" onClick={() => setOpenId(null)}>
                ✖
              </button>
            </div>

            <div className="bz-detail-tags">
              <span className="bz-tag">{selected.tipo || "info.general"}</span>
              {selected.deposito ? <span className="bz-tag">🏬 {selected.deposito}</span> : null}
              <span className={`bz-tag ${selected.leida ? "" : "blue"}`}>{selected.leida ? "Leído" : "Sin leer"}</span>
              {selected.sender ? <span className="bz-tag">De: {selected.sender}</span> : null}
            </div>

            <h2 className="bz-detail-title">{selected.mensaje || "(sin mensaje)"}</h2>
            <div className="bz-detail-sub">
              <strong>Fecha:</strong> {fmtDate(selected.fecha_iso)}
            </div>

            {motivo ? (
              <div className="bz-motivo">
                <div className="bz-motivo-title">Motivo</div>
                <div className="bz-motivo-body">{motivo}</div>
              </div>
            ) : null}

            {/* ✅ Detalles útiles (sin JSON) */}
            {prettyMetaPairs.length > 0 ? (
              <div className="bz-meta">
                <div className="bz-meta-title">Detalles</div>

                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fafafa",
                    marginBottom: 10,
                  }}
                >
                  {prettyMetaPairs.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 10, padding: "6px 0" }}>
                      <div style={{ width: 140, fontWeight: 700, color: "#374151" }}>{k}</div>
                      <div style={{ color: "#111827" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ✅ Materiales solicitados */}
            {modalContext.kind === "solicitud" ? (
              <div className="bz-meta" style={{ marginTop: 8 }}>
                <div className="bz-meta-title">Materiales solicitados</div>

                {solLoading ? (
                  <div style={{ padding: 10, color: "#374151" }}>Cargando materiales…</div>
                ) : solError ? (
                  <div style={{ padding: 10, color: "#b91c1c", fontWeight: 600 }}>{solError}</div>
                ) : solDetalle && Array.isArray(solDetalle.items) && solDetalle.items.length > 0 ? (
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "white",
                    }}
                  >
                    <table className="styled-table" style={{ width: "100%", margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Material</th>
                          <th style={{ textAlign: "left" }}>Código</th>
                          <th style={{ textAlign: "right" }}>Cantidad</th>
                          <th style={{ textAlign: "left" }}>Obs.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {solDetalle.items.map((it, idx) => (
                          <tr key={`${it.codigo || it.material || idx}-${idx}`}>
                            <td style={{ fontWeight: 700 }}>{it.material || "-"}</td>
                            <td className="font-mono">{it.codigo || "-"}</td>
                            <td style={{ textAlign: "right" }}>{it.cantidad ?? "-"}</td>
                            <td>{it.observacion || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: 10, color: "#374151" }}>
                    No hay items para mostrar en esta solicitud.
                  </div>
                )}
              </div>
            ) : null}

            <div className="bz-modal-actions">
              <button
                className="bz-btn"
                onClick={async () => {
                  setError("");
                  try {
                    setBusy(true);
                    await markRead(selected.id, !selected.leida);
                  } catch (e) {
                    setError(safeErr(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                {selected.leida ? "Marcar NO leído" : "Marcar leído"}
              </button>

              <button
                className="bz-btn"
                onClick={async () => {
                  setError("");
                  try {
                    setBusy(true);
                    await toggleStar(selected.id, !selected.starred);
                  } catch (e) {
                    setError(safeErr(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                {selected.starred ? "Quitar ⭐" : "Destacar ⭐"}
              </button>

              {/* ✅ Acción contextual */}
              <button
                className="bz-btn"
                onClick={() => {
                  const link = computeLink(selected);
                  if (!link || link === "#") return;
                  setOpenId(null);
                  navigate(link);
                }}
                disabled={busy || !computeLink(selected) || computeLink(selected) === "#"}
              >
                {modalContext.actionLabel}
              </button>

              {/* ✅ Traslado recibido (solo roles autorizados y noti de recepción) */}
              {canConfirmRecepcion ? (
                <button className="bz-btn" onClick={confirmRecepcion} disabled={busy}>
                  📦 Traslado recibido
                </button>
              ) : null}

              <button
                className="bz-btn bz-danger"
                onClick={async () => {
                  const ok = window.confirm("¿Seguro que quieres borrar esta notificación?");
                  if (!ok) return;

                  setError("");
                  try {
                    setBusy(true);
                    await deleteOne(selected.id);
                    setOpenId(null);
                  } catch (e) {
                    setError(safeErr(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                🗑️ Borrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
