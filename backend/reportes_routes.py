# backend/reportes_routes.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from db import Auditoria, Usuario
from sqlalchemy import desc

reportes_bp = Blueprint('reportes', __name__)

@reportes_bp.route('/auditoria', methods=['GET'])
@jwt_required()
def get_auditoria():
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    rol = claims.get("rol_nombre")

    if rol not in ["Master_Admin", "Admin"]:
        return jsonify({"error": "Acceso denegado"}), 403

    query = Auditoria.query

    # LOGICA DE FILTRADO POR ROL
    if rol == "Master_Admin":
        # Ve todo, no aplicamos filtro
        pass
    elif rol == "Admin":
        # Buscamos el depósito del admin que consulta
        usuario = Usuario.query.get(user_id)
        if usuario and usuario.empleado and usuario.empleado.ID_DEPOSITO:
            mit_deposito = usuario.empleado.ID_DEPOSITO
            # Filtramos solo logs de SU depósito
            query = query.filter_by(ID_DEPOSITO=mit_deposito)
        else:
            return jsonify([]), 200

    # Filtros adicionales opcionales (búsqueda)
    search = request.args.get('search', '')
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Auditoria.NOMBRE_USUARIO.ilike(search_term)) |
            (Auditoria.DETALLE.ilike(search_term)) |
            (Auditoria.ACCION_REALIZADA.ilike(search_term))
        )

    # Ordenar y Limitar
    limit = request.args.get('limit', 200, type=int)
    logs = query.order_by(desc(Auditoria.FECHA_HORA)).limit(limit).all()

    return jsonify([l.to_dict() for l in logs]), 200