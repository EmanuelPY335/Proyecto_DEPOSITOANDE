# backend/notificaciones.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json

from db import db, Notificacion, Usuario, Vale, SolicitudStock

notificaciones_bp = Blueprint("notificaciones", __name__)

# -----------------------------
# META helpers (SIEMPRE string)
# -----------------------------

def _meta_obj(meta):
    if meta is None:
        return {}
    if isinstance(meta, dict):
        return meta
    if isinstance(meta, (bytes, bytearray)):
        try:
            meta = meta.decode("utf-8", errors="ignore")
        except:
            return {}
    if isinstance(meta, str):
        try:
            obj = json.loads(meta)
            return obj if isinstance(obj, dict) else {}
        except:
            return {}
    return {}

def _meta_json(meta_dict):
    if meta_dict is None:
        return None
    if isinstance(meta_dict, str):
        return meta_dict
    try:
        return json.dumps(meta_dict, ensure_ascii=False)
    except:
        return json.dumps({"raw": str(meta_dict)}, ensure_ascii=False)

def _is_deleted(n):
    meta = _meta_obj(getattr(n, "META", None))
    return bool(meta.get("deleted", False))

def _soft_delete(n):
    meta = _meta_obj(getattr(n, "META", None))
    meta["deleted"] = True
    meta["deleted_at"] = datetime.now().isoformat()
    # ✅ IMPORTANTE: guardar como STRING
    n.META = _meta_json(meta)

def _uid():
    v = get_jwt_identity()
    try:
        return int(v)
    except:
        return v

def normalizar_tipo_para_front(tipo_bd, mensaje: str) -> str:
    base = (str(tipo_bd).strip().lower() if tipo_bd else "").strip().lower()
    if base:
        return base
    return "info.general"

# =========================================
# ENDPOINT PRINCIPAL (menu/notificaciones)
# =========================================

@notificaciones_bp.route("/notificaciones", methods=["GET"])
@jwt_required()
def get_notificaciones_menu():
    current_user_id = _uid()
    try:
        current_user_id = int(current_user_id)
    except:
        pass

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

        meta_obj = _meta_obj(getattr(n, "META", None))
        tipo_norm = normalizar_tipo_para_front(getattr(n, "TIPO", None), getattr(n, "MENSAJE", ""))

        data.append({
            "id": n.ID_NOTIFICACION,
            "usuario_id": n.ID_USUARIO,
            "mensaje": getattr(n, "MENSAJE", ""),
            "leida": bool(getattr(n, "LEIDA", False)),
            "starred": bool(getattr(n, "STARRED", False)),
            "fecha_iso": n.FECHA_CREACION.isoformat() if getattr(n, "FECHA_CREACION", None) else "",
            "tipo": tipo_norm,
            "link": getattr(n, "LINK_NOTI", None) or "#",
            "sender": getattr(n, "SENDER", "Sistema"),
            "deposito": getattr(n, "DEPOSITO", "") or "",
            "meta": meta_obj,
        })

    return jsonify(data), 200


# =========================================
# ACCIONES
# =========================================

@notificaciones_bp.route("/notificaciones/leer/<int:noti_id>", methods=["PUT"])
@jwt_required()
def marcar_leida(noti_id):
    uid = int(_uid())
    n = Notificacion.query.filter_by(ID_NOTIFICACION=noti_id, ID_USUARIO=uid).first()
    if not n:
        return jsonify({"error": "No encontrado"}), 404
    n.LEIDA = True
    db.session.commit()
    return jsonify({"ok": True}), 200


@notificaciones_bp.route("/notificaciones/noleer/<int:noti_id>", methods=["PUT"])
@jwt_required()
def marcar_no_leida(noti_id):
    uid = int(_uid())
    n = Notificacion.query.filter_by(ID_NOTIFICACION=noti_id, ID_USUARIO=uid).first()
    if not n:
        return jsonify({"error": "No encontrado"}), 404
    n.LEIDA = False
    db.session.commit()
    return jsonify({"ok": True}), 200


@notificaciones_bp.route("/notificaciones/star/<int:noti_id>", methods=["PUT"])
@jwt_required()
def set_star(noti_id):
    uid = int(_uid())
    body = request.get_json(silent=True) or {}
    starred = bool(body.get("starred", False))

    n = Notificacion.query.filter_by(ID_NOTIFICACION=noti_id, ID_USUARIO=uid).first()
    if not n:
        return jsonify({"error": "No encontrado"}), 404

    n.STARRED = starred
    db.session.commit()
    return jsonify({"ok": True}), 200


@notificaciones_bp.route("/notificaciones/<int:noti_id>", methods=["DELETE"])
@jwt_required()
def delete_one(noti_id):
    uid = int(_uid())
    n = Notificacion.query.filter_by(ID_NOTIFICACION=noti_id, ID_USUARIO=uid).first()
    if not n:
        return jsonify({"error": "No encontrado"}), 404

    _soft_delete(n)
    db.session.commit()
    return jsonify({"ok": True, "mode": "soft"}), 200
