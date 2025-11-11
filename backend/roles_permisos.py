# sisdepo/backend/roles_permisos.py
from functools import wraps
from flask import jsonify, Blueprint, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt, jwt_required

from db import db, Usuario, Rol

# 1. --- DEFINICIÓN DEL BLUEPRINT ---
roles_bp = Blueprint("roles", __name__)


ADMIN_ROLE_NAME = "Master_Admin"


def role_required(*roles_permitidos):
    """
    Restringe acceso a usuarios cuyo rol esté en roles_permitidos.
    El rol Master_Admin siempre tiene acceso.
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

# --- RUTAS DE GESTIÓN DE ROLES ---

@roles_bp.route("/roles", methods=["GET"])
@jwt_required()
@role_required("Master_Admin")
def listar_roles():
    """
    Ruta para obtener la lista de todos los roles.
    """
    return jsonify(obtener_roles()), 200

@roles_bp.route("/roles", methods=["POST"])
@jwt_required()
@role_required("Master_Admin")
def manejar_crear_rol():
    """
    Ruta para crear un nuevo rol.
    """
    data = request.get_json()
    nombre_rol = data.get("nombre_rol")
    if not nombre_rol:
        return jsonify(error="Se requiere 'nombre_rol'."), 400
    
    # Llama a la función de abajo
    resp, status = crear_rol(nombre_rol) 
    return jsonify(resp), status

@roles_bp.route("/roles/<int:id_rol>", methods=["PUT"])
@jwt_required()
@role_required("Master_Admin")
def manejar_actualizar_rol(id_rol):
    """
    Ruta para actualizar (renombrar) un rol existente.
    """
    rol = Rol.query.get(id_rol)
    if not rol:
        return jsonify(error="Rol no encontrado."), 404
    
    data = request.get_json()
    nuevo_nombre = data.get("nombre_rol")
    if not nuevo_nombre:
        return jsonify(error="Se requiere 'nombre_rol'."), 400
    
    # Verificar si ya existe otro rol con ese nombre
    existente = Rol.query.filter_by(NOMBRE_ROL=nuevo_nombre).first()
    if existente and existente.ID_ROL != id_rol:
        return jsonify(error=f"El nombre de rol '{nuevo_nombre}' ya existe."), 409

    rol.NOMBRE_ROL = nuevo_nombre
    db.session.commit()
    return jsonify(msg=f"Rol actualizado a '{nuevo_nombre}'."), 200

@roles_bp.route("/roles/<int:id_rol>", methods=["DELETE"])
@jwt_required()
@role_required("Master_Admin")
def manejar_eliminar_rol(id_rol):
    """
    Ruta para eliminar un rol.
    """
    rol = Rol.query.get(id_rol)
    if not rol:
        return jsonify(error="Rol no encontrado."), 404
    
    # Importante: Verificar si algún usuario tiene este rol
    usuarios_con_rol = Usuario.query.filter_by(ID_ROL=id_rol).first()
    if usuarios_con_rol:
        return jsonify(error="No se puede eliminar el rol, está asignado a uno o más usuarios."), 409

    # No se puede eliminar el rol Master_Admin
    if rol.NOMBRE_ROL == ADMIN_ROLE_NAME:
         return jsonify(error="El rol Master_Admin no puede ser eliminado."), 403

    nombre_rol = rol.NOMBRE_ROL # Guardamos el nombre para el mensaje
    db.session.delete(rol)
    db.session.commit()
    return jsonify(msg=f"Rol '{nombre_rol}' eliminado."), 200


# --- RUTAS DE ASIGNACIÓN (existentes) ---

@roles_bp.route("/asignar-rol", methods=["PUT"])
@jwt_required()
@role_required("Master_Admin")
def cambiar_rol():
    """
    Ruta para asignar un nuevo rol a un usuario.
    """
    data = request.get_json()
    user_id = data.get("usuario_id")
    nuevo_rol = data.get("rol")
    resp, status = asignar_rol(user_id, nuevo_rol) # Llama a la función de abajo
    return jsonify(resp), status


# --- FUNCIONES DE LÓGICA (llamadas por las rutas) ---

def asignar_rol(usuario_id: int, nuevo_rol_nombre: str):
    """
    Asigna el rol 'nuevo_rol_nombre' al usuario con id 'usuario_id'.
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
    """
    existente = Rol.query.filter_by(NOMBRE_ROL=nombre_rol).first()
    if existente:
        return {"error": f"El rol '{nombre_rol}' ya existe."}, 409

    nuevo = Rol(NOMBRE_ROL=nombre_rol)
    db.session.add(nuevo)
    db.session.commit()
    return {"msg": f"Rol '{nombre_rol}' creado exitosamente."}, 201


def obtener_roles():
    """
    Devuelve todos los roles registrados.
    (Corregido: el JSON era inválido)
    """
    roles = Rol.query.order_by(Rol.NOMBRE_ROL.asc()).all()
    # Corregido: La clave "nombre" estaba duplicada y una apuntaba a ID_ROL
    return [{"id": r.ID_ROL, "nombre": r.NOMBRE_ROL} for r in roles]