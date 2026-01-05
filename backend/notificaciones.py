# backend/notificaciones.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Notificacion, Usuario
from datetime import datetime

notificaciones_bp = Blueprint('notificaciones', __name__)

# 1. OBTENER NOTIFICACIONES (GET)
@notificaciones_bp.route('/notificaciones', methods=['GET'])
@jwt_required()
def get_notificaciones():
    current_user_id = get_jwt_identity()
    
    # Obtener últimas 20 notificaciones del usuario, ordenadas por fecha descendente
    notificaciones = Notificacion.query.filter_by(ID_USUARIO=current_user_id)\
        .order_by(Notificacion.FECHA_CREACION.desc())\
        .limit(20)\
        .all()
    
    result = []
    for n in notificaciones:
        result.append({
            "id": n.ID_NOTIFICACION,
            "mensaje": n.MENSAJE,
            "leida": n.LEIDA,
            "fecha": n.FECHA_CREACION.strftime('%d/%m %H:%M'), # Formato corto
            "id_orden": n.ID_ORDEN # Para la redirección
        })
        
    return jsonify(result), 200

# 2. MARCAR UNA COMO LEÍDA (PUT)
@notificaciones_bp.route('/notificaciones/leer/<int:id>', methods=['PUT'])
@jwt_required()
def marcar_leida(id):
    current_user_id = get_jwt_identity()
    
    notif = Notificacion.query.filter_by(ID_NOTIFICACION=id, ID_USUARIO=current_user_id).first()
    
    if not notif:
        return jsonify({"error": "Notificación no encontrada"}), 404
        
    notif.LEIDA = True
    db.session.commit()
    
    return jsonify({"success": True}), 200

# 3. MARCAR TODAS COMO LEÍDAS (PUT)
@notificaciones_bp.route('/notificaciones/leer-todas', methods=['PUT'])
@jwt_required()
def marcar_todas_leidas():
    current_user_id = get_jwt_identity()
    
    # Actualización masiva eficiente
    Notificacion.query.filter_by(ID_USUARIO=current_user_id, LEIDA=False)\
        .update({Notificacion.LEIDA: True})
        
    db.session.commit()
    
    return jsonify({"success": True}), 200