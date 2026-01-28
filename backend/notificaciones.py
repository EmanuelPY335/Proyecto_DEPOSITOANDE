# backend/notificaciones.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json

from db import db, Notificacion, Usuario, Vale, SolicitudStock

notificaciones_bp = Blueprint("notificaciones", __name__)

# =========================================================
# HELPERS
# =========================================================

def _uid():
    v = get_jwt_identity()
    try:
        return int(v)
    except:
        return v

def _meta_obj(meta):
    """META puede venir dict (JSON) o string. Normalizamos a dict."""
    if meta is None:
        return {}
    if isinstance(meta, dict):
        return meta
    if isinstance(meta, str):
        try:
            obj = json.loads(meta)
            return obj if isinstance(obj, dict) else {}
        except:
            return {}
    return {}

def _is_deleted(n):
    meta = _meta_obj(getattr(n, "META", None))
    return bool(meta.get("deleted", False))

def _soft_delete(n):
    meta = _meta_obj(getattr(n, "META", None))
    meta["deleted"] = True
    meta["deleted_at"] = datetime.now().isoformat()
    n.META = meta

def obtener_link_por_tipo(mensaje: str, id_referencia=None) -> str:
    if not mensaje:
        return "#"
    msg_lower = mensaje.lower()

    if "ruta" in msg_lower:
        return "/Mapa"

    if any(x in msg_lower for x in ["orden", "tarea", "asignación", "asignacion"]):
        return f"/ordenes-trabajo?id={id_referencia}" if id_referencia else "/ordenes-trabajo"

    if "solicitud" in msg_lower or "pedido" in msg_lower:
        return "/movimientos?tab=pedidos"

    return "#"

def detectar_tipo_visual(mensaje: str, tipo_bd=None) -> str:
    if tipo_bd:
        return str(tipo_bd)
    if not mensaje:
        return "Info"
    msg = mensaje.lower()

    if "rechaz" in msg or "cancelad" in msg or "anul" in msg:
        return "Alerta"
    if "ruta" in msg:
        return "Ruta"
    if "solicitud" in msg or "pedido" in msg:
        return "Pedido"
    if "llegada" in msg or "aprobada" in msg or "aprobado" in msg:
        return "Check"
    if "finaliz" in msg:
        return "Check"
    if "recib" in msg or "recepc" in msg:
        return "Check"
    if "orden" in msg:
        return "Orden"
    if "vale" in msg:
        return "Vale"
    return "Info"

def normalizar_tipo_para_front(tipo_bd, mensaje: str) -> str:
    base = (str(tipo_bd).strip().lower() if tipo_bd else str(detectar_tipo_visual(mensaje)).strip().lower())

    # si ya viene con "."
    if "." in base:
        return base

    if base in ("pedido", "solicitud"):
        return "solicitud.pedido"
    if base in ("ruta",):
        return "solicitud.ruta"
    if base in ("orden", "ordenes"):
        return "orden.trabajo"
    if base in ("asignacion", "asignación"):
        return "asignacion.orden"
    if base in ("alerta",):
        return "alerta.general"
    if base in ("check",):
        return "check.ok"
    if base in ("vale",):
        return "vale.general"

    return "info.general"

def _rol_nombre(usuario) -> str:
    try:
        if hasattr(usuario, "rol") and usuario.rol:
            if hasattr(usuario.rol, "NOMBRE_ROL"):
                return str(usuario.rol.NOMBRE_ROL)
            return str(usuario.rol)
    except:
        pass
    return ""

def _rol_lower(usuario) -> str:
    return (_rol_nombre(usuario) or "").strip().lower()

def _deposito_id(usuario):
    try:
        if usuario and getattr(usuario, "empleado", None) and getattr(usuario.empleado, "ID_DEPOSITO", None):
            return int(usuario.empleado.ID_DEPOSITO)
    except:
        pass
    return None

def _empleado_id(usuario):
    try:
        if usuario and getattr(usuario, "empleado", None) and getattr(usuario.empleado, "ID_EMPLEADO", None):
            return int(usuario.empleado.ID_EMPLEADO)
    except:
        pass
    return None

def _allow_for_role(rol_low: str, tipo_norm: str, mensaje: str) -> bool:
    """
    ✅ FIX IMPORTANTE:
    Si un usuario cambió de rol (ej: antes Personal_Inventario y ahora Chofer),
    NO debe seguir viendo notificaciones de gestión (solicitudes/pedidos).
    """
    rol_low = (rol_low or "").strip().lower()
    tipo = (tipo_norm or "").strip().lower()
    msg = (mensaje or "").strip().lower()

    if rol_low == "master_admin":
        return True

    # Chofer: SOLO cosas de ruta/vale asignado o genéricas
    if rol_low == "chofer":
        if tipo.startswith("solicitud.ruta"):
            return True
        if tipo.startswith("vale.ruta") or "ruta" in tipo or "ruta" in msg:
            return True
        # opcional: mensajes genéricos del sistema
        if tipo.startswith("info."):
            return True
        return False

    # Admin / Personal_Inventario: pueden ver solicitudes/vales/notificaciones de gestión
    if rol_low in ("admin", "personal_inventario"):
        return True

    # Empleado u otros: solo genéricas (evitar data sensible)
    if tipo.startswith("info.") or tipo.startswith("check."):
        return True

    return False

def _build_solicitud_detalle_items(solicitud: SolicitudStock, limit=25):
    out = []
    try:
        detalles = getattr(solicitud, "detalles", []) or []
        for d in detalles[:limit]:
            mat = getattr(d, "material", None)
            out.append({
                "id_material": getattr(d, "ID_MATERIAL", None),
                "codigo": getattr(mat, "CODIGO_UNICO", None) if mat else None,
                "material": getattr(mat, "NOMBRE", None) if mat else "Material",
                "unidad": getattr(mat, "UNIDAD_MEDIDA", None) if mat else "",
                "cantidad": float(getattr(d, "CANTIDAD", 0) or 0),
                "observacion": getattr(d, "OBSERVACION_ITEM", "") or "",
            })
    except:
        pass
    return out

# =========================================================
# SINCRONIZACIÓN (EVENTOS AUTOMÁTICOS)
# =========================================================
def sincronizar_eventos(usuario: Usuario) -> None:
    if not usuario:
        return

    rol = _rol_nombre(usuario)
    rol_low = (rol or "").strip().lower()
    mi_dep_id = _deposito_id(usuario)
    mi_emp_id = _empleado_id(usuario)

    nuevas = []

    try:
        # 1) ADMINS / MASTER: solicitudes pendientes
        if rol in ("Master_Admin", "Admin", "Personal_Inventario"):
            q_sol = SolicitudStock.query.filter_by(ID_ESTADO=1)

            # Admin/Personal: solo su depósito proveedor
            if rol in ("Admin", "Personal_Inventario") and mi_dep_id:
                q_sol = q_sol.filter_by(ID_DEPOSITO_PROVEEDOR=mi_dep_id)

            for s in q_sol.all():
                link_ref = f"/movimientos?tab=pedidos&highlight={s.ID_SOLICITUD}"

                existe = Notificacion.query.filter_by(
                    ID_USUARIO=usuario.ID_USUARIO,
                    LINK_NOTI=link_ref
                ).first()

                if existe:
                    continue

                cant = len(getattr(s, "detalles", []) or [])
                dep_nom = ""
                try:
                    dep_nom = s.dep_solicitante.NOMBRE if getattr(s, "dep_solicitante", None) else "Depósito"
                except:
                    dep_nom = "Depósito"

                meta = {
                    "id_solicitud": s.ID_SOLICITUD,
                    "items": cant,
                    "detalle_items": _build_solicitud_detalle_items(s)
                }

                nueva = Notificacion(
                    ID_USUARIO=usuario.ID_USUARIO,
                    MENSAJE=f"📦 Solicitud #{s.ID_SOLICITUD}: {dep_nom} pide {cant} items.",
                    TIPO="solicitud.creada",
                    LEIDA=False,
                    FECHA_CREACION=getattr(s, "FECHA_SOLICITUD", None) or datetime.now(),
                    LINK_NOTI=link_ref,
                    STARRED=False,
                    DEPOSITO=dep_nom,
                    SENDER="Sistema",
                    META=meta
                )
                db.session.add(nueva)
                nuevas.append(nueva)

        # 2) CHOFER: rutas/vales aprobados
        if rol_low == "chofer":
            if mi_emp_id:
                rutas = Vale.query.filter_by(ID_CHOFER=mi_emp_id, ID_ESTADO_VALE=2).all()
                for r in rutas:
                    link_ref = f"/Mapa?ruta={r.ID_VALE}"

                    existe = Notificacion.query.filter_by(
                        ID_USUARIO=usuario.ID_USUARIO,
                        LINK_NOTI=link_ref
                    ).first()

                    if existe:
                        continue

                    destino = "Destino"
                    origen = ""
                    try:
                        destino = r.destino.NOMBRE if getattr(r, "destino", None) else "Destino"
                    except:
                        destino = "Destino"
                    try:
                        origen = r.origen.NOMBRE if getattr(r, "origen", None) else ""
                    except:
                        origen = ""

                    nueva = Notificacion(
                        ID_USUARIO=usuario.ID_USUARIO,
                        MENSAJE=f"🚚 Ruta Asignada #{getattr(r, 'GRUPO_RUTA', '') or r.ID_VALE} a {destino}",
                        TIPO="solicitud.ruta",
                        LEIDA=False,
                        FECHA_CREACION=getattr(r, "FECHA_CREACION", None) or datetime.now(),
                        LINK_NOTI=link_ref,
                        STARRED=False,
                        DEPOSITO=origen or "",
                        SENDER="Sistema",
                        META={"id_vale": r.ID_VALE, "grupo_ruta": getattr(r, "GRUPO_RUTA", None)}
                    )
                    db.session.add(nueva)
                    nuevas.append(nueva)

        if nuevas:
            db.session.commit()

    except Exception as e:
        db.session.rollback()
        print("⚠️ sincronizar_eventos error:", e)

# =========================================================
# ENDPOINTS
# =========================================================

@notificaciones_bp.route("/notificaciones", methods=["GET"])
@jwt_required()
def get_notificaciones_menu():
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    usuario = Usuario.query.get(current_user_id)
    if not usuario:
        return jsonify([]), 200

    sincronizar_eventos(usuario)
    rol_low = _rol_lower(usuario)

    notis = (
        Notificacion.query
        .filter_by(ID_USUARIO=current_user_id)
        .order_by(Notificacion.FECHA_CREACION.desc())
        .limit(60)
        .all()
    )

    data = []
    for n in notis:
        if _is_deleted(n):
            continue

        tipo_norm = normalizar_tipo_para_front(getattr(n, "TIPO", None), getattr(n, "MENSAJE", ""))
        if not _allow_for_role(rol_low, tipo_norm, getattr(n, "MENSAJE", "")):
            continue

        link_final = getattr(n, "LINK_NOTI", None) or obtener_link_por_tipo(getattr(n, "MENSAJE", ""))

        data.append({
            "id": n.ID_NOTIFICACION,
            "usuario_id": n.ID_USUARIO,
            "origen": "db",
            "mensaje": getattr(n, "MENSAJE", ""),
            "leida": bool(getattr(n, "LEIDA", False)),
            "fecha_display": n.FECHA_CREACION.strftime("%d/%m %H:%M") if getattr(n, "FECHA_CREACION", None) else "",
            "fecha_iso": n.FECHA_CREACION.isoformat() if getattr(n, "FECHA_CREACION", None) else "",
            "tipo": tipo_norm,
            "link": link_final,
            "sender": getattr(n, "SENDER", "Sistema"),
            "deposito": getattr(n, "DEPOSITO", "") or "",
            "meta": _meta_obj(getattr(n, "META", None))
        })

        if len(data) >= 20:
            break

    return jsonify(data), 200


@notificaciones_bp.route("/buzon", methods=["GET"])
@jwt_required()
def get_buzon_completo():
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    usuario = Usuario.query.get(current_user_id)
    if not usuario:
        return jsonify([]), 200

    rol_low = _rol_lower(usuario)

    notis = (
        Notificacion.query
        .filter_by(ID_USUARIO=current_user_id)
        .order_by(Notificacion.FECHA_CREACION.desc())
        .limit(200)
        .all()
    )

    data = []
    for n in notis:
        if _is_deleted(n):
            continue

        tipo_norm = normalizar_tipo_para_front(getattr(n, "TIPO", None), getattr(n, "MENSAJE", ""))
        if not _allow_for_role(rol_low, tipo_norm, getattr(n, "MENSAJE", "")):
            continue

        link_final = getattr(n, "LINK_NOTI", None) or obtener_link_por_tipo(getattr(n, "MENSAJE", ""))

        data.append({
            "id": n.ID_NOTIFICACION,
            "usuario_id": n.ID_USUARIO,
            "origen": "db",
            "mensaje": getattr(n, "MENSAJE", ""),
            "leida": bool(getattr(n, "LEIDA", False)),
            "starred": bool(getattr(n, "STARRED", False)),
            "fecha": n.FECHA_CREACION.strftime("%d/%m/%Y %H:%M") if getattr(n, "FECHA_CREACION", None) else "",
            "fecha_iso": n.FECHA_CREACION.isoformat() if getattr(n, "FECHA_CREACION", None) else "",
            "tipo": tipo_norm,
            "link": link_final,
            "sender": getattr(n, "SENDER", "Sistema"),
            "deposito": getattr(n, "DEPOSITO", "") or "",
            "meta": _meta_obj(getattr(n, "META", None))
        })

    return jsonify(data), 200


# =========================================================
# CRUD BÁSICO / ACCIONES
# =========================================================

@notificaciones_bp.route("/notificaciones/leer/<string:id_str>", methods=["PUT"])
@jwt_required()
def marcar_leida_menu(id_str):
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    try:
        id_clean = str(id_str).replace("db-", "").strip()
        n = Notificacion.query.get(int(id_clean))
        if n and n.ID_USUARIO == current_user_id:
            n.LEIDA = True
            db.session.commit()
            return jsonify({"success": True}), 200
    except Exception as e:
        print("marcar_leida_menu error:", e)

    return jsonify({"error": "No encontrado"}), 404


@notificaciones_bp.route("/buzon/<int:id>/leer", methods=["PUT"])
@jwt_required()
def buzon_leer(id):
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    n = Notificacion.query.get_or_404(id)
    if n.ID_USUARIO != current_user_id:
        return jsonify({"error": "Forbidden"}), 403

    n.LEIDA = True
    db.session.commit()
    return jsonify({"success": True}), 200


@notificaciones_bp.route("/buzon/<int:id>/noleer", methods=["PUT"])
@jwt_required()
def buzon_noleer(id):
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    n = Notificacion.query.get_or_404(id)
    if n.ID_USUARIO != current_user_id:
        return jsonify({"error": "Forbidden"}), 403

    n.LEIDA = False
    db.session.commit()
    return jsonify({"success": True}), 200


@notificaciones_bp.route("/buzon/<int:id>/star", methods=["PUT"])
@jwt_required()
def buzon_star(id):
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    n = Notificacion.query.get_or_404(id)
    if n.ID_USUARIO != current_user_id:
        return jsonify({"error": "Forbidden"}), 403

    payload = request.json or {}
    n.STARRED = bool(payload.get("starred", True))
    db.session.commit()

    return jsonify({"success": True}), 200


@notificaciones_bp.route("/buzon/<int:id>", methods=["DELETE"])
@jwt_required()
def buzon_delete(id):
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    n = Notificacion.query.get_or_404(id)
    if n.ID_USUARIO != current_user_id:
        return jsonify({"error": "Forbidden"}), 403

    _soft_delete(n)
    db.session.commit()
    return jsonify({"success": True, "mode": "soft"}), 200


@notificaciones_bp.route("/buzon/batch", methods=["DELETE"])
@jwt_required()
def buzon_batch_delete():
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    payload = request.json or {}
    ids = payload.get("ids", []) or []

    if not ids:
        return jsonify({"success": True, "count": 0}), 200

    try:
        notis = Notificacion.query.filter(
            Notificacion.ID_USUARIO == current_user_id,
            Notificacion.ID_NOTIFICACION.in_(ids)
        ).all()

        for n in notis:
            _soft_delete(n)

        db.session.commit()
        return jsonify({"success": True, "mode": "soft", "count": len(notis)}), 200

    except Exception as e:
        db.session.rollback()
        print("buzon_batch_delete error:", e)
        return jsonify({"error": "Error en el servidor"}), 500


@notificaciones_bp.route("/buzon/batch/read", methods=["PUT"])
@jwt_required()
def buzon_batch_read():
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    payload = request.json or {}
    ids = payload.get("ids", []) or []

    if ids:
        Notificacion.query.filter(
            Notificacion.ID_USUARIO == current_user_id,
            Notificacion.ID_NOTIFICACION.in_(ids)
        ).update({Notificacion.LEIDA: True}, synchronize_session=False)
        db.session.commit()

    return jsonify({"success": True}), 200
