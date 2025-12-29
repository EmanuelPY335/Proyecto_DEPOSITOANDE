# backend/roles_permisos.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, verify_jwt_in_request
from functools import wraps
from db import db, Rol, Permiso
from sqlalchemy import text

roles_bp = Blueprint("roles_permisos", __name__)

# ==============================================================================
# 🛡️ DECORADOR: ROLE_REQUIRED
# ==============================================================================
def role_required(*roles_permitidos):
    """
    Decorador para proteger rutas. 
    Uso: @role_required("Admin", "Master_Admin")
    """
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request() # Verifica que el token sea válido
            claims = get_jwt()
            rol_usuario = claims.get("rol_nombre") # Extraemos el rol del token
            
            # Si el rol del usuario está en la lista permitida
            if rol_usuario in roles_permitidos:
                return fn(*args, **kwargs)
            else:
                return jsonify({"error": f"Acceso denegado. Se requiere: {roles_permitidos}"}), 403
        return decorator
    return wrapper

# ==============================================================================
# 🧠 LÓGICA DE GESTIÓN DE ROLES Y PERMISOS
# ==============================================================================

def check_admin_access():
    claims = get_jwt()
    rol_actual = claims.get("rol_nombre")
    if rol_actual not in ["Master_Admin", "Admin"]:
        return False, rol_actual
    return True, rol_actual

# 1. LISTAR ROLES
@roles_bp.route("/roles", methods=["GET"])
@jwt_required()
def get_roles():
    permitido, rol_usuario = check_admin_access()
    if not permitido: return jsonify({"error": "Acceso denegado"}), 403

    roles = Rol.query.all()
    resultado = []
    for r in roles:
        # Admin no ve a Master_Admin
        if rol_usuario == "Admin" and r.NOMBRE_ROL == "Master_Admin":
            continue
        resultado.append({
            "id": r.ID_ROL, 
            "nombre": r.NOMBRE_ROL, 
            "descripcion": r.DESCRIPCION_ROL or ""
        })
    return jsonify(resultado), 200

# 2. LISTAR PERMISOS
@roles_bp.route("/permisos", methods=["GET"])
@jwt_required()
def get_all_permisos():
    permitido, _ = check_admin_access()
    if not permitido: return jsonify({"error": "Acceso denegado"}), 403

    permisos = Permiso.query.all()
    return jsonify([{
        "id": p.ID_PERMISO, 
        "nombre": p.NOMBRE_PERMISO, 
        "descripcion": p.DESCRIPCION
    } for p in permisos]), 200

# 3. VER PERMISOS DE UN ROL
@roles_bp.route("/roles/<int:id_rol>/permisos", methods=["GET"])
@jwt_required()
def get_rol_permisos(id_rol):
    permitido, rol_usuario = check_admin_access()
    if not permitido: return jsonify({"error": "Acceso denegado"}), 403

    rol_target = Rol.query.get(id_rol)
    if not rol_target: return jsonify({"error": "Rol no encontrado"}), 404

    if rol_usuario == "Admin" and rol_target.NOMBRE_ROL == "Master_Admin":
        return jsonify({"error": "Prohibido ver permisos del Master."}), 403

    query = text("SELECT ID_PERMISO FROM permiso_x_rol WHERE ID_ROL = :rid")
    result = db.session.execute(query, {"rid": id_rol}).fetchall()
    ids = [row[0] for row in result]
    return jsonify(ids), 200

# 4. EDITAR PERMISOS DE UN ROL
@roles_bp.route("/roles/<int:id_rol>/permisos", methods=["PUT"])
@jwt_required()
def update_rol_permisos(id_rol):
    permitido, rol_usuario = check_admin_access()
    if not permitido: return jsonify({"error": "Acceso denegado"}), 403

    rol_target = Rol.query.get(id_rol)
    if not rol_target: return jsonify({"error": "Rol no encontrado"}), 404

    if rol_usuario == "Admin" and rol_target.NOMBRE_ROL == "Master_Admin":
        return jsonify({"error": "Prohibido modificar al Master."}), 403

    data = request.json
    nuevos_ids = data.get("permisos", [])

    try:
        db.session.execute(text("DELETE FROM permiso_x_rol WHERE ID_ROL = :rid"), {"rid": id_rol})
        if nuevos_ids:
            for pid in nuevos_ids:
                db.session.execute(
                    text("INSERT INTO permiso_x_rol (ID_ROL, ID_PERMISO) VALUES (:rid, :pid)"),
                    {"rid": id_rol, "pid": pid}
                )
        db.session.commit()
        return jsonify({"success": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# 5. CREAR ROL (ENDPOINT API)
@roles_bp.route("/roles", methods=["POST"])
@jwt_required()
def create_rol_endpoint():
    permitido, _ = check_admin_access()
    if not permitido: return jsonify({"error": "Sin permisos"}), 403
    
    data = request.json
    nombre = data.get("nombre")
    if not nombre: return jsonify({"error": "Nombre requerido"}), 400
    if nombre.strip() == "Master_Admin": return jsonify({"error": "Reservado"}), 400
    
    try:
        crear_rol(nombre, data.get("descripcion", "")) # Reusamos la funcion helper
        return jsonify({"success": True}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================================================================
# 🔧 HELPER: FUNCIÓN PARA CREAR ROLES (USADA POR MAIN.PY)
# ==============================================================================
def crear_rol(nombre_rol, descripcion=""):
    """
    Función auxiliar usada por main.py para sembrar roles al inicio.
    Verifica si existe, si no, lo crea.
    """
    existing_role = Rol.query.filter_by(NOMBRE_ROL=nombre_rol).first()
    if not existing_role:
        nuevo_rol = Rol(NOMBRE_ROL=nombre_rol, DESCRIPCION_ROL=descripcion)
        db.session.add(nuevo_rol)
        db.session.commit()
        print(f"Rol creado: {nombre_rol}")
        return nuevo_rol
    return existing_role