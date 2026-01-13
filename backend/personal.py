# backend/personal.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from db import db, Empleado, Usuario, Rol, Deposito

personal_bp = Blueprint("personal", __name__)

# ---------------------------------------------------------
# HELPER: VERIFICACIÓN DE PERMISOS
# ---------------------------------------------------------
def tiene_permiso_gestion_empleados():
    """
    Verifica si el usuario tiene permisos de ALTO NIVEL (Crear/Editar/Borrar).
    """
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)

        if not usuario or not usuario.rol:
            return False

        nombre_rol = usuario.rol.NOMBRE_ROL

        if nombre_rol in ["Master_Admin", "Admin"]:
            return True

        sql = text("""
            SELECT 1 
            FROM permiso_x_rol pxr
            JOIN permiso p ON pxr.ID_PERMISO = p.ID_PERMISO
            WHERE pxr.ID_ROL = :id_rol AND p.NOMBRE_PERMISO = 'gestion_empleados'
        """)
        
        resultado = db.session.execute(sql, {'id_rol': usuario.ID_ROL}).fetchone()
        
        if resultado:
            return True
            
        return False

    except Exception as e:
        print(f"Error verificando permisos: {e}")
        return False

# ---------------------------------------------------------
# 1. OBTENER LISTA DE EMPLEADOS (GET)
# ---------------------------------------------------------
@personal_bp.route("/empleados", methods=["GET"])
@jwt_required()
def get_empleados():
    # Obtener el usuario actual para verificar su rol
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    
    if not usuario:
        return jsonify({"message": "Usuario no identificado"}), 401

    nombre_rol = usuario.rol.NOMBRE_ROL if usuario.rol else ""

    # --- CORRECCIÓN DE SEGURIDAD ---
    # Permitimos ver la lista si:
    # 1. Tiene permiso de gestión total (Admin/Master)
    # 2. O SI ES 'Personal_Inventario' (Necesario para asignar órdenes de trabajo)
    permiso_lectura = (nombre_rol == "Personal_Inventario") or tiene_permiso_gestion_empleados()

    if not permiso_lectura:
        return jsonify({"message": "No tienes permisos para ver el personal."}), 403

    try:
        empleados_query = (
            db.session.query(Empleado, Usuario, Rol)
            .outerjoin(Usuario, Empleado.ID_EMPLEADO == Usuario.ID_EMPLEADO)
            .outerjoin(Rol, Usuario.ID_ROL == Rol.ID_ROL)
            .order_by(Empleado.APELLIDO, Empleado.NOMBRE)
            .all()
        )

        resultado = []
        for empleado, usuario, rol in empleados_query:
            fecha_nac_str = ""
            if empleado.FECHA_NACIMIENTO:
                fecha_nac_str = empleado.FECHA_NACIMIENTO.strftime("%Y-%m-%d")

            data_empleado = {
                "id": empleado.ID_EMPLEADO,
                "nombre": empleado.NOMBRE,
                "apellido": empleado.APELLIDO,
                "telefono": str(empleado.TELEFONO) if empleado.TELEFONO else "",
                "NUMERO_DOCUMENTO": empleado.NUMERO_DOCUMENTO,
                "FECHA_NACIMIENTO": fecha_nac_str,
                "ID_DEPOSITO": empleado.ID_DEPOSITO,
                "estado": empleado.ESTADO_ACTIVO,
                
                # Datos de la cuenta (Usuario)
                "correo": usuario.CORREO if usuario else "",
                "AVATAR": usuario.AVATAR if usuario else None,
                "BANNER_COLOR": usuario.BANNER_COLOR if usuario else "#5865F2",

                "rol": rol.NOMBRE_ROL if rol else "Sin Rol",
                "rol_id": rol.ID_ROL if rol else None,
            }
            resultado.append(data_empleado)

        return jsonify(resultado), 200

    except Exception as e:
        print(f"[ERROR /api/empleados] {e}")
        return jsonify(
            {"error": "Error interno del servidor", "details": str(e)}
        ), 500

@personal_bp.route("/empleados/simple", methods=["GET"])
@jwt_required()
def empleados_simple():
    # Misma lógica de permiso de lectura relajado para selectores
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    nombre_rol = usuario.rol.NOMBRE_ROL if usuario and usuario.rol else ""
    
    permiso_lectura = (nombre_rol == "Personal_Inventario") or tiene_permiso_gestion_empleados()

    if not permiso_lectura:
        return jsonify({"message": "Acceso denegado"}), 403

    try:
        empleados = Empleado.query.filter_by(ESTADO_ACTIVO=True).all()
        lista = []
        for e in empleados:
            lista.append({
                "ID_EMPLEADO": e.ID_EMPLEADO,
                "NOMBRE": e.NOMBRE,
                "APELLIDO": e.APELLIDO,
                "ID_DEPOSITO": e.ID_DEPOSITO
            })
        return jsonify(lista), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 2. EDITAR EMPLEADO (PUT) - Mantiene seguridad estricta
# ---------------------------------------------------------
@personal_bp.route("/empleados/<int:id_empleado>", methods=["PUT"])
@jwt_required()
def update_empleado(id_empleado):
    if not tiene_permiso_gestion_empleados():
        return jsonify({"message": "No tienes permisos para editar empleados."}), 403

    try:
        empleado = Empleado.query.get(id_empleado)
        if not empleado:
            return jsonify({"error": "Empleado no encontrado"}), 404
            
        data = request.json
        
        empleado.NOMBRE = data.get("nombre", empleado.NOMBRE)
        empleado.APELLIDO = data.get("apellido", empleado.APELLIDO)
        empleado.NUMERO_DOCUMENTO = data.get("NUMERO_DOCUMENTO", empleado.NUMERO_DOCUMENTO)
        empleado.TELEFONO = data.get("telefono", empleado.TELEFONO)
        empleado.FECHA_NACIMIENTO = data.get("FECHA_NACIMIENTO", empleado.FECHA_NACIMIENTO)
        empleado.ID_DEPOSITO = data.get("ID_DEPOSITO", empleado.ID_DEPOSITO)
        
        if empleado.usuario:
            if "correo" in data:
                empleado.usuario.CORREO = data.get("correo")
            if "rol_id" in data:
                nuevo_rol_id = data.get("rol_id")
                if nuevo_rol_id:
                    empleado.usuario.ID_ROL = nuevo_rol_id

        db.session.commit()
        return jsonify({"message": "Datos actualizados correctamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR UPDATE] {e}")
        return jsonify({"error": "Error al actualizar", "details": str(e)}), 500

# ---------------------------------------------------------
# 3. CAMBIAR ESTADO (PUT) - Mantiene seguridad estricta
# ---------------------------------------------------------
@personal_bp.route("/empleados/<int:id_empleado>/estado", methods=["PUT"])
@jwt_required()
def toggle_estado_empleado(id_empleado):
    if not tiene_permiso_gestion_empleados():
        return jsonify({"message": "No tienes permisos para cambiar estado."}), 403

    try:
        empleado = Empleado.query.get(id_empleado)
        if not empleado:
            return jsonify({"error": "Empleado no encontrado"}), 404
            
        empleado.ESTADO_ACTIVO = not empleado.ESTADO_ACTIVO
        db.session.commit()
        
        estado_str = "activado" if empleado.ESTADO_ACTIVO else "desactivado"
        return jsonify({"message": f"Empleado {estado_str} exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Error al cambiar estado", "details": str(e)}), 500

# ---------------------------------------------------------
# 4. CHOFERES
# ---------------------------------------------------------
@personal_bp.route("/personal/choferes", methods=["GET"])
@jwt_required()
def get_choferes():
    try:
        choferes = Usuario.query.join(Rol).filter(Rol.NOMBRE_ROL == 'Chofer').all()
        resultado = []
        for u in choferes:
            if u.empleado:
                resultado.append({
                    "id": u.empleado.ID_EMPLEADO, 
                    "nombre": f"{u.empleado.NOMBRE} {u.empleado.APELLIDO}",
                    "estado": "Disponible" 
                })
        return jsonify(resultado), 200
    except Exception as e:
        print(f"Error cargando choferes: {e}") 
        return jsonify({"error": str(e)}), 500