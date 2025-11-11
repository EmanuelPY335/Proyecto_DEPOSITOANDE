# sisdepo/backend/personal.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

# Importamos los helpers y modelos
from db import db, Empleado, Usuario, Rol
from roles_permisos import role_required

# 1. Definimos el Blueprint
personal_bp = Blueprint("personal", __name__)


# 2. Creamos la ruta para obtener todos los empleados
@personal_bp.route("/empleados", methods=["GET"])
@jwt_required()
@role_required("Master_Admin") # Solo los Master_Admin pueden ver esta lista
def get_empleados():
    """
    Obtiene la lista completa de empleados con su usuario y rol.
    """
    try:
        # Hacemos un join para obtener Empleado, Usuario (por el correo) y Rol (por el nombre)
        empleados_query = db.session.query(
            Empleado, Usuario, Rol
        ).join(
            Usuario, Empleado.ID_EMPLEADO == Usuario.ID_EMPLEADO
        ).join(
            Rol, Usuario.ID_ROL == Rol.ID_ROL
        ).order_by(
            Empleado.APELLIDO, Empleado.NOMBRE
        ).all()

        # Formateamos los datos para que coincidan con lo que tu frontend espera
        resultado = []
        for empleado, usuario, rol in empleados_query:
            resultado.append({
                "id": empleado.ID_EMPLEADO, # El ID principal
                "nombre": empleado.NOMBRE,
                "apellido": empleado.APELLIDO,
                "telefono": str(empleado.TELEFONO), # Convertir a string
                "correo": usuario.CORREO,
                "rol": rol.NOMBRE_ROL,
                "estado": empleado.ESTADO_ACTIVO
            })

        return jsonify(resultado), 200

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR /api/empleados] {e}")
        return jsonify({'error': 'Error interno del servidor', 'details': str(e)})