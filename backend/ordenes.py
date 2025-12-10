# backend/ordenes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import date
from db import db, OrdenTrabajo, EstadoOrden, Empleado, Usuario
from roles_permisos import role_required

ordenes_bp = Blueprint("ordenes", __name__)

# --- 1. LISTAR ÓRDENES ---
@ordenes_bp.route("/ordenes", methods=["GET"])
@jwt_required()
def get_ordenes():
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    user_id = int(claims.get("sub"))
    
    # Buscamos empleado del usuario
    usuario = Usuario.query.get(user_id)
    empleado_id = usuario.empleado.ID_EMPLEADO if usuario.empleado else None

    try:
        query = OrdenTrabajo.query.filter_by(ELIMINADA=False)

        # SI ES EMPLEADO: Solo ve las suyas
        if rol not in ["Admin", "Master_Admin"]:
            if not empleado_id:
                return jsonify([]), 200
            query = query.filter_by(ID_EMPLEADO=empleado_id)
        
        # SI ES ADMIN/MASTER: Ve todo
        ordenes = query.order_by(OrdenTrabajo.ID_ESTADO_ORDEN.asc(), OrdenTrabajo.FECHA_INICIO.desc()).all()
        
        return jsonify([o.to_dict() for o in ordenes]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- 2. CREAR ORDEN (LÓGICA LIMPIA - SIN FANTASMA) ---
@ordenes_bp.route("/ordenes", methods=["POST"])
@jwt_required()
@role_required("Admin")
def create_orden():
    data = request.json
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    user_id = int(claims.get("sub"))

    try:
        # 1. Estado Pendiente
        estado_pendiente = EstadoOrden.query.filter(
            EstadoOrden.ESTADO_ORDEN.ilike("Pendiente")
        ).first()
        if not estado_pendiente:
            return jsonify({"error": "Estado 'Pendiente' no configurado"}), 500

        # 2. Definir Depósito
        id_deposito = None
        if rol == "Master_Admin":
            id_deposito = data.get("id_deposito")
            if not id_deposito: return jsonify({"error": "Falta depósito"}), 400
        else:
            usuario = Usuario.query.get(user_id)
            if not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
                return jsonify({"error": "Gerente sin depósito"}), 400
            id_deposito = usuario.empleado.ID_DEPOSITO

        # 3. Empleado Opcional (NULL si no viene)
        id_empleado = data.get("id_empleado")
        empleado_final = None
        
        if id_empleado: # Solo verificamos si mandan un ID real
             empleado_obj = Empleado.query.get(id_empleado)
             if not empleado_obj:
                 return jsonify({"error": "Empleado no existe"}), 400
             empleado_final = empleado_obj.ID_EMPLEADO
        
        # 4. Crear la orden
        nueva_orden = OrdenTrabajo(
            TITULO=data.get("titulo"),
            DESCRIPCION=data.get("descripcion"),
            PRIORIDAD=data.get("prioridad", "Media"),
            ID_DEPOSITO=id_deposito,
            ID_EMPLEADO=empleado_final, # Puede ser None (SQL NULL)
            ID_ESTADO_ORDEN=estado_pendiente.ID_ESTADO_ORDEN,
            FECHA_INICIO=date.today()
        )

        db.session.add(nueva_orden)
        db.session.commit()
        return jsonify({"success": True, "message": "Orden creada correctamente."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --- 3. ACTUALIZAR ORDEN ---
@ordenes_bp.route("/ordenes/<int:id_orden>", methods=["PUT"])
@jwt_required()
def update_orden(id_orden):
    data = request.json
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    
    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden: return jsonify({"error": "Orden no encontrada"}), 404

        if rol not in ["Admin", "Master_Admin"]:
            # Lógica empleado (avances)
            if "herramientas" in data: orden.HERRAMIENTAS = data.get("herramientas")
            if "tiempo_empleado" in data: orden.TIEMPO_EMPLEADO = data.get("tiempo_empleado")
            if "nuevo_estado" in data:
                st = EstadoOrden.query.filter_by(ESTADO_ORDEN=data.get("nuevo_estado")).first()
                if st: orden.ID_ESTADO_ORDEN = st.ID_ESTADO_ORDEN
        else:
            # Lógica Admin (asignar/aprobar)
            if "id_empleado" in data: orden.ID_EMPLEADO = data.get("id_empleado")
            if "prioridad" in data: orden.PRIORIDAD = data.get("prioridad")
            if data.get("accion") == "aprobar":
                st_aprobada = EstadoOrden.query.filter_by(ESTADO_ORDEN="Aprobada").first()
                if st_aprobada:
                    orden.ID_ESTADO_ORDEN = st_aprobada.ID_ESTADO_ORDEN
                    orden.FECHA_CIERRE = date.today()

        db.session.commit()
        return jsonify({"success": True, "message": "Orden actualizada."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --- 4. BORRADO LÓGICO (ADMIN / MASTER) ---
@ordenes_bp.route("/ordenes/<int:id_orden>", methods=["DELETE"])
@jwt_required()
def soft_delete_orden(id_orden):
    claims = get_jwt()
    rol = claims.get("rol_nombre")

    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden: return jsonify({"error": "Orden no encontrada"}), 404

        # Permitimos a Admin y Master_Admin borrar visualmente
        # SIN RESTRICCIONES DE ESTADO (pendiente, progreso, etc.)
        if rol in ["Admin", "Master_Admin"]:
            orden.ELIMINADA = True
            db.session.commit()
            return jsonify({"message": "Orden enviada a papelera."}), 200

        return jsonify({"error": "No autorizado"}), 403

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --- 5. BORRADO PERMANENTE (SOLO MASTER) ---
@ordenes_bp.route("/ordenes/<int:id_orden>/perma", methods=["DELETE"])
@jwt_required()
def perma_delete_orden(id_orden):
    claims = get_jwt()
    rol = claims.get("rol_nombre")

    if rol != "Master_Admin":
        return jsonify({"error": "Solo Master_Admin puede destruir datos."}), 403

    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden: return jsonify({"error": "Orden no encontrada"}), 404

        # Borrado físico de la BD
        db.session.delete(orden)
        db.session.commit()
        return jsonify({"message": "Orden eliminada permanentemente."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
        
# ... Rutas de restore y eliminadas (opcionales) ...