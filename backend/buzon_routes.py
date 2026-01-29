# backend/buzon.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from db import db, Notificacion
import json

buzon_bp = Blueprint("buzon_bp", __name__)

def current_user_id() -> int:
    ident = get_jwt_identity()
    if ident is not None:
        return int(ident)

    claims = get_jwt()
    uid = claims.get("ID_USUARIO") or claims.get("id") or claims.get("sub")
    if uid is None:
        raise ValueError("JWT no contiene ID de usuario (ID_USUARIO/id/sub)")
    return int(uid)

def _meta_obj(meta):
    if meta is None:
        return None
    if isinstance(meta, dict):
        return meta
    if isinstance(meta, (bytes, bytearray)):
        try:
            meta = meta.decode("utf-8", errors="ignore")
        except:
            return {"raw": "bytes"}
    if isinstance(meta, str):
        try:
            return json.loads(meta)
        except:
            return {"raw": meta}
    return {"raw": str(meta)}

def _to_payload(n: Notificacion):
    return {
        "id": n.ID_NOTIFICACION,
        "mensaje": getattr(n, "MENSAJE", ""),
        "leida": bool(getattr(n, "LEIDA", False)),
        "starred": bool(getattr(n, "STARRED", False)),
        "fecha_iso": n.FECHA_CREACION.isoformat() if getattr(n, "FECHA_CREACION", None) else "",
        "tipo": getattr(n, "TIPO", None) or "info.general",
        "link": getattr(n, "LINK_NOTI", None) or "#",
        "sender": getattr(n, "SENDER", "Sistema") or "Sistema",
        "deposito": getattr(n, "DEPOSITO", "") or "",
        "meta": _meta_obj(getattr(n, "META", None)),
    }

@buzon_bp.get("/api/buzon")
@jwt_required()
def get_buzon():
    uid = current_user_id()
    notis = (Notificacion.query
             .filter_by(ID_USUARIO=uid)
             .order_by(Notificacion.FECHA_CREACION.desc())
             .all())
    return jsonify([_to_payload(n) for n in notis]), 200

@buzon_bp.put("/api/buzon/<int:noti_id>/leer")
@jwt_required()
def marcar_leida(noti_id):
    uid = current_user_id()
    n = Notificacion.query.filter_by(ID_NOTIFICACION=noti_id, ID_USUARIO=uid).first_or_404()
    n.LEIDA = True
    db.session.commit()
    return jsonify({"ok": True}), 200

@buzon_bp.put("/api/buzon/<int:noti_id>/noleer")
@jwt_required()
def marcar_no_leida(noti_id):
    uid = current_user_id()
    n = Notificacion.query.filter_by(ID_NOTIFICACION=noti_id, ID_USUARIO=uid).first_or_404()
    n.LEIDA = False
    db.session.commit()
    return jsonify({"ok": True}), 200

@buzon_bp.put("/api/buzon/<int:noti_id>/star")
@jwt_required()
def set_star(noti_id):
    uid = current_user_id()
    body = request.get_json(silent=True) or {}
    starred = bool(body.get("starred", False))

    n = Notificacion.query.filter_by(ID_NOTIFICACION=noti_id, ID_USUARIO=uid).first_or_404()
    n.STARRED = starred
    db.session.commit()
    return jsonify({"ok": True}), 200

@buzon_bp.delete("/api/buzon/<int:noti_id>")
@jwt_required()
def delete_one(noti_id):
    uid = current_user_id()
    n = Notificacion.query.filter_by(ID_NOTIFICACION=noti_id, ID_USUARIO=uid).first_or_404()
    db.session.delete(n)
    db.session.commit()
    return jsonify({"ok": True}), 200

@buzon_bp.delete("/api/buzon/batch")
@jwt_required()
def delete_batch():
    uid = current_user_id()
    body = request.get_json(silent=True) or {}
    ids = body.get("ids", [])

    if ids:
        (Notificacion.query
         .filter(Notificacion.ID_USUARIO == uid, Notificacion.ID_NOTIFICACION.in_(ids))
         .delete(synchronize_session=False))
        db.session.commit()

    return jsonify({"ok": True}), 200

@buzon_bp.put("/api/buzon/batch/read")
@jwt_required()
def batch_read():
    uid = current_user_id()
    body = request.get_json(silent=True) or {}
    ids = body.get("ids", [])

    if ids:
        (Notificacion.query
         .filter(Notificacion.ID_USUARIO == uid, Notificacion.ID_NOTIFICACION.in_(ids))
         .update({"LEIDA": True}, synchronize_session=False))
        db.session.commit()

    return jsonify({"ok": True}), 200

@buzon_bp.put("/api/buzon/batch/unread")
@jwt_required()
def batch_unread():
    uid = current_user_id()
    body = request.get_json(silent=True) or {}
    ids = body.get("ids", [])

    if ids:
        (Notificacion.query
         .filter(Notificacion.ID_USUARIO == uid, Notificacion.ID_NOTIFICACION.in_(ids))
         .update({"LEIDA": False}, synchronize_session=False))
        db.session.commit()

    return jsonify({"ok": True}), 200

@buzon_bp.put("/api/buzon/batch/star")
@jwt_required()
def batch_star():
    uid = current_user_id()
    body = request.get_json(silent=True) or {}
    ids = body.get("ids", [])
    starred = bool(body.get("starred", False))

    if ids:
        (Notificacion.query
         .filter(Notificacion.ID_USUARIO == uid, Notificacion.ID_NOTIFICACION.in_(ids))
         .update({"STARRED": starred}, synchronize_session=False))
        db.session.commit()

    return jsonify({"ok": True}), 200

# Alias para NotificationMenu (si lo usas)
@buzon_bp.get("/api/notificaciones")
@jwt_required()
def get_notificaciones_alias():
    return get_buzon()

@buzon_bp.put("/api/notificaciones/leer/<int:noti_id>")
@jwt_required()
def leer_alias(noti_id):
    return marcar_leida(noti_id)  # ✅ sin coma
