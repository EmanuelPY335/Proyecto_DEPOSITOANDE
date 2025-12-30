# backend/solicitudes.py
from flask import Blueprint, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import func
from db import db, SolicitudMaterial, EstadoSolicitud, Usuario, Deposito, Material
import datetime

solicitudes_bp = Blueprint("solicitudes", __name__)
CORS(solicitudes_bp)

# --- UTILIDAD: Obtener ID Estado (Insensible a mayúsculas) ---
def get_id_estado_pendiente():
    # Busca "Pendiente", "PENDIENTE", "pendiente"...
    estado = EstadoSolicitud.query.filter(EstadoSolicitud.NOMBRE.ilike('Pendiente')).first()
    if not estado:
        # Si no existe, lo crea
        estado = EstadoSolicitud(NOMBRE="Pendiente")
        db.session.add(estado)
        db.session.commit()
    return estado.ID_ESTADO

# --- RUTA 1: CREAR SOLICITUD ---
@solicitudes_bp.route("/solicitudes", methods=["POST"])
@jwt_required()
def crear_solicitud():
    claims = get_jwt()
    # Permitimos roles de gestión
    if claims.get("rol_nombre") not in ["Master_Admin", "Admin", "Gerente", "Personal_Inventario"]:
        return jsonify({"error": "No tienes permiso."}), 403

    current_user_id = get_jwt_identity()
    data = request.json

    try:
        usuario = Usuario.query.get(current_user_id)
        if not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
             return jsonify({"error": "Usuario sin depósito asignado."}), 400
        
        id_origen = usuario.empleado.ID_DEPOSITO
        id_destino = int(data.get("id_deposito_proveedor"))
        
        if id_origen == id_destino:
            return jsonify({"error": "No puedes pedirte a ti mismo."}), 400

        # Usamos la función auxiliar para obtener el ID correcto
        id_estado_pendiente = get_id_estado_pendiente()

        nueva_solicitud = SolicitudMaterial(
            ID_DEPOSITO_SOLICITANTE=id_origen,
            ID_USUARIO_SOLICITANTE=current_user_id,
            ID_DEPOSITO_PROVEEDOR=id_destino,
            ID_MATERIAL=data.get("id_material"),
            CANTIDAD=float(data.get("cantidad")),
            ID_ESTADO=id_estado_pendiente, # Usamos el ID seguro
            OBSERVACION=data.get("observacion", ""),
            FECHA_SOLICITUD=datetime.datetime.now()
        )

        db.session.add(nueva_solicitud)
        db.session.commit()

        return jsonify({"success": True, "message": "Solicitud enviada."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- RUTA 2: CONTEO NOTIFICACIONES ---
@solicitudes_bp.route("/notificaciones/conteo", methods=["GET"])
@jwt_required()
def get_notificaciones_conteo():
    current_user_id = get_jwt_identity()
    try:
        usuario = Usuario.query.get(current_user_id)
        if not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
             return jsonify({"pedidos_pendientes": 0}), 200
        
        mi_deposito_id = usuario.empleado.ID_DEPOSITO

        # Buscamos por el ID del estado "Pendiente" directamente
        # Esto evita problemas de JOIN con nombres
        id_estado_pendiente = get_id_estado_pendiente()

        conteo = SolicitudMaterial.query.filter_by(
            ID_DEPOSITO_PROVEEDOR=mi_deposito_id,
            ID_ESTADO=id_estado_pendiente
        ).count()

        return jsonify({"pedidos_pendientes": conteo}), 200

    except Exception as e:
        print(f"Error Conteo: {e}")
        return jsonify({"error": str(e)}), 500

# --- RUTA 3: LISTAR PEDIDOS ENTRANTES (Para la página de gestión) ---
@solicitudes_bp.route("/solicitudes/entrantes", methods=["GET"])
@jwt_required()
def get_pedidos_entrantes():
    current_user_id = get_jwt_identity()
    try:
        usuario = Usuario.query.get(current_user_id)
        mi_deposito_id = usuario.empleado.ID_DEPOSITO
        
        # Obtenemos todas las solicitudes que me hicieron a mí
        solicitudes = SolicitudMaterial.query.filter_by(ID_DEPOSITO_PROVEEDOR=mi_deposito_id).all()
        
        resultado = []
        for s in solicitudes:
            resultado.append({
                "id_solicitud": s.ID_SOLICITUD,
                "origen": s.dep_solicitante.NOMBRE if s.dep_solicitante else "Desconocido",
                "material": s.material.NOMBRE if s.material else "Desconocido",
                "cantidad": s.CANTIDAD,
                "fecha": s.FECHA_SOLICITUD.strftime("%d/%m/%Y %H:%M"),
                "estado": s.estado.NOMBRE if s.estado else "Sin Estado",
                "observacion": s.OBSERVACION
            })
            
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- RUTA DEBUG: VER TODO (Úsala en el navegador si algo falla) ---
@solicitudes_bp.route("/debug/ver-todo", methods=["GET"])
def debug_ver_todo():
    # Devuelve JSON puro de todas las tablas implicadas
    try:
        solicitudes = SolicitudMaterial.query.all()
        data = []
        for s in solicitudes:
            data.append({
                "ID": s.ID_SOLICITUD,
                "PROVEEDOR_ID": s.ID_DEPOSITO_PROVEEDOR,
                "SOLICITANTE_ID": s.ID_DEPOSITO_SOLICITANTE,
                "ESTADO_ID": s.ID_ESTADO
            })
        return jsonify({
            "solicitudes_raw": data,
            "estados": [{"id": e.ID_ESTADO, "nombre": e.NOMBRE} for e in EstadoSolicitud.query.all()]
        })
    except Exception as e:
        return str(e)