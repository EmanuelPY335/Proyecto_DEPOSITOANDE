# sisdepo/backend/personal.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

# Importamos los modelos necesarios
from db import db, Empleado, Usuario, Rol, Deposito
# Importamos el decorador de permisos
from roles_permisos import role_required

personal_bp = Blueprint("personal", __name__)

# ---------------------------------------------------------
# 1. OBTENER LISTA DE EMPLEADOS (GET)
# ---------------------------------------------------------
@personal_bp.route("/empleados", methods=["GET"])
@jwt_required()
@role_required("Admin")
def get_empleados():
    try:
        # Hacemos la consulta uniendo Empleado, Usuario y Rol
        empleados_query = (
            db.session.query(Empleado, Usuario, Rol)
            .outerjoin(Usuario, Empleado.ID_EMPLEADO == Usuario.ID_EMPLEADO)
            .outerjoin(Rol, Usuario.ID_ROL == Rol.ID_ROL)
            .order_by(Empleado.APELLIDO, Empleado.NOMBRE)
            .all()
        )

        resultado = []
        for empleado, usuario, rol in empleados_query:
            # Formatear fecha
            fecha_nac_str = ""
            if empleado.FECHA_NACIMIENTO:
                fecha_nac_str = empleado.FECHA_NACIMIENTO.strftime("%Y-%m-%d")

            # Construimos el objeto JSON
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

                # 🔥 AGREGAR ESTO 🔥
                "AVATAR": usuario.AVATAR if usuario else None,
                "BANNER_COLOR": usuario.BANNER_COLOR if usuario else "#5865F2",
                # -------------------------------------------------------

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
@role_required("Admin")
def empleados_simple():
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
# 2. EDITAR EMPLEADO (PUT)
# ---------------------------------------------------------
@personal_bp.route("/empleados/<int:id_empleado>", methods=["PUT"])
@jwt_required()
@role_required("Admin")
def update_empleado(id_empleado):
    try:
        empleado = Empleado.query.get(id_empleado)
        if not empleado:
            return jsonify({"error": "Empleado no encontrado"}), 404
            
        data = request.json
        
        # Actualizar datos de Empleado
        empleado.NOMBRE = data.get("nombre", empleado.NOMBRE)
        empleado.APELLIDO = data.get("apellido", empleado.APELLIDO)
        empleado.NUMERO_DOCUMENTO = data.get("NUMERO_DOCUMENTO", empleado.NUMERO_DOCUMENTO)
        empleado.TELEFONO = data.get("telefono", empleado.TELEFONO)
        empleado.FECHA_NACIMIENTO = data.get("FECHA_NACIMIENTO", empleado.FECHA_NACIMIENTO)
        empleado.ID_DEPOSITO = data.get("ID_DEPOSITO", empleado.ID_DEPOSITO)
        
        # Actualizar datos de Usuario (Correo y Rol)
        # NOTA: El Admin NO cambia el Avatar/Banner aquí, eso lo hace el usuario en su perfil.
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
# 3. CAMBIAR ESTADO (PUT)
# ---------------------------------------------------------
@personal_bp.route("/empleados/<int:id_empleado>/estado", methods=["PUT"])
@jwt_required()
@role_required("Admin")
def toggle_estado_empleado(id_empleado):
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