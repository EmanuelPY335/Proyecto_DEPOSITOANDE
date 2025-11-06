# sisdepo/backend/roles_permisos.py
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

# ⬇️ Usa este import si ejecutás con:  python backend/main.py  (estando dentro de /backend)
from db import db, Usuario, Rol

# ⬇️ Si ejecutás desde la raíz como paquete:  python -m backend.main
# entonces cambia la línea de arriba por:
# from .db import db, Usuario, Rol


ADMIN_ROLE_NAME = "Master_Admin"


def role_required(*roles_permitidos):
    """
    Restringe acceso a usuarios cuyo rol esté en roles_permitidos.
    El rol Master_Admin siempre tiene acceso.
    Uso:
        @jwt_required()
        @role_required("Personal_Inventario")
        def ruta():
            ...
    """
    def _wrap(fn):
        @wraps(fn)
        def _decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            rol_usuario = claims.get("rol_nombre")

            if not rol_usuario:
                return jsonify(msg="No se encontró el rol del usuario."), 403

            if rol_usuario == ADMIN_ROLE_NAME or rol_usuario in roles_permitidos:
                return fn(*args, **kwargs)

            return jsonify(msg="Acceso denegado: rol no autorizado."), 403

        return _decorator
    return _wrap


def asignar_rol(usuario_id: int, nuevo_rol_nombre: str):
    """
    Asigna el rol 'nuevo_rol_nombre' al usuario con id 'usuario_id'.
    Debe ser invocado desde una ruta protegida por @role_required('Master_Admin').
    """
    usuario = Usuario.query.get(usuario_id)
    if not usuario:
        return {"error": "Usuario no encontrado."}, 404

    rol = Rol.query.filter_by(NOMBRE_ROL=nuevo_rol_nombre).first()
    if not rol:
        return {"error": f"El rol '{nuevo_rol_nombre}' no existe."}, 404

    usuario.ID_ROL = rol.ID_ROL
    db.session.commit()
    return {"msg": f"Rol del usuario {usuario.CORREO} actualizado a {nuevo_rol_nombre}."}, 200


def crear_rol(nombre_rol: str):
    """
    Crea un rol si no existe. Idempotente.
    Retorna (mensaje, status_code).
    """
    existente = Rol.query.filter_by(NOMBRE_ROL=nombre_rol).first()
    if existente:
        return {"msg": f"El rol '{nombre_rol}' ya existe."}, 200

    nuevo = Rol(NOMBRE_ROL=nombre_rol)
    db.session.add(nuevo)
    db.session.commit()
    return {"msg": f"Rol '{nombre_rol}' creado exitosamente."}, 201


def obtener_roles():
    """
    Devuelve todos los roles registrados.
    """
    roles = Rol.query.order_by(Rol.NOMBRE_ROL.asc()).all()
    return [{"id": r.ID_ROL, "nombre": r.NOMBRE_ROL} for r in roles]
