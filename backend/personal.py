# sisdepo/backend/personal.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from db import db, Empleado, Usuario, Rol
from roles_permisos import role_required

personal_bp = Blueprint("personal", __name__)

@personal_bp.route("/empleados", methods=["GET"])
@jwt_required()
@role_required("Admin")
def get_empleados():
    try:
        empleados_query = (
            db.session.query(Empleado, Usuario, Rol)
            .join(Usuario, Empleado.ID_EMPLEADO == Usuario.ID_EMPLEADO)
            .join(Rol, Usuario.ID_ROL == Rol.ID_ROL)
            .order_by(Empleado.APELLIDO, Empleado.NOMBRE)
            .all()
        )

        resultado = []
        for empleado, usuario, rol in empleados_query:
            # Formatear fecha de nacimiento si existe
            if empleado.FECHA_NACIMIENTO:
                fecha_nac_str = empleado.FECHA_NACIMIENTO.strftime("%d/%m/%Y")
            else:
                fecha_nac_str = None

            resultado.append({
                "id": empleado.ID_EMPLEADO,
                "nombre": empleado.NOMBRE,
                "apellido": empleado.APELLIDO,
                "telefono": str(empleado.TELEFONO) if empleado.TELEFONO else None,
                "correo": usuario.CORREO,
                "rol": rol.NOMBRE_ROL,
                "estado": empleado.ESTADO_ACTIVO,

                # Campos nuevos
                "NUMERO_DOCUMENTO": empleado.NUMERO_DOCUMENTO,
                "FECHA_NACIMIENTO": fecha_nac_str,
                "ID_DEPOSITO": empleado.ID_DEPOSITO,
            })

        return jsonify(resultado), 200

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR /api/empleados] {e}")
        return jsonify(
            {"error": "Error interno del servidor", "details": str(e)}
        ), 500
