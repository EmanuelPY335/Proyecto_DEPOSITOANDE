# backend/notificaciones.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Notificacion

notificaciones_bp = Blueprint("notificaciones", __name__)

@notificaciones_bp.route("/notificaciones", methods=["GET"])
@jwt_required()
def get_notificaciones():
    user_id = get_jwt_identity()
    # Traemos las no leídas primero
    notis = Notificacion.query.filter_by(ID_USUARIO=user_id)\
        .order_by(Notificacion.LEIDA.asc(), Notificacion.FECHA_CREACION.desc())\
        .limit(20).all()
    
    return jsonify([n.to_dict() for n in notis]), 200

@notificaciones_bp.route("/notificaciones/leer/<int:id>", methods=["PUT"])
@jwt_required()
def marcar_leida(id):
    noti = Notificacion.query.get(id)
    if noti and str(noti.ID_USUARIO) == str(get_jwt_identity()):
        noti.LEIDA = True
        db.session.commit()
        return jsonify({"success": True}), 200
    return jsonify({"error": "No encontrada"}), 404

@notificaciones_bp.route("/notificaciones/leer-todas", methods=["PUT"])
@jwt_required()
def marcar_todas_leidas():
    user_id = get_jwt_identity()
    Notificacion.query.filter_by(ID_USUARIO=user_id, LEIDA=False).update({Notificacion.LEIDA: True})
    db.session.commit()
    return jsonify({"success": True}), 200