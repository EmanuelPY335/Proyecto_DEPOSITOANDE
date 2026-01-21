# backend/roles_permisos.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, verify_jwt_in_request, get_jwt_identity
from functools import wraps
from db import db, Rol, Permiso, Usuario
from sqlalchemy import text

roles_bp = Blueprint("roles_permisos", __name__)

# ==============================================================================
# 🛡️ DECORADOR 1: ROLE_REQUIRED (Nivel Alto - Para Admins)
# ==============================================================================
def role_required(*roles_permitidos):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            rol_usuario = claims.get("rol_nombre")
            if rol_usuario in roles_permitidos:
                return fn(*args, **kwargs)
            else:
                return jsonify({"error": f"Acceso denegado. Se requiere rol: {roles_permitidos}"}), 403
        return decorator
    return wrapper

# ==============================================================================
# 🛡️ DECORADOR 2: PERMISSION_REQUIRED (Nivel Granular - Para Funcionalidades)
# ==============================================================================
def permission_required(nombre_permiso_requerido):
    """
    Verifica si el ROL del usuario tiene asignado el PERMISO específico.
    Uso: @permission_required('gestion_movimientos')
    """
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            current_user_id = get_jwt_identity()
            
            # Master Admin siempre pasa (God Mode)
            claims = get_jwt()
            if claims.get("rol_nombre") == "Master_Admin":
                return fn(*args, **kwargs)

            # Consulta SQL optimizada para verificar permiso
            sql = text("""
                SELECT 1
                FROM usuario u
                JOIN rol r ON u.ID_ROL = r.ID_ROL
                JOIN permiso_x_rol pxr ON r.ID_ROL = pxr.ID_ROL
                JOIN permiso p ON pxr.ID_PERMISO = p.ID_PERMISO
                WHERE u.ID_USUARIO = :uid 
                AND p.NOMBRE_PERMISO = :p_nombre
            """)
            
            result = db.session.execute(sql, {
                "uid": current_user_id, 
                "p_nombre": nombre_permiso_requerido
            }).fetchone()

            if result:
                return fn(*args, **kwargs) # ✅ Tiene permiso
            else:
                print(f"⛔ Acceso denegado a {current_user_id} para {nombre_permiso_requerido}")
                return jsonify({"error": "No tienes permisos para realizar esta acción."}), 403
                
        return decorator
    return wrapper

# ==============================================================================
# 🧠 LÓGICA DE GESTIÓN (Mantenemos tu lógica existente)
# ==============================================================================

def check_admin_access():
    claims = get_jwt()
    rol_actual = claims.get("rol_nombre")
    if rol_actual not in ["Master_Admin", "Admin"]:
        return False, rol_actual
    return True, rol_actual

# ---------------------------------------------------------
# 1. LISTAR ROLES
# ---------------------------------------------------------
@roles_bp.route("/roles", methods=["GET"])
@jwt_required()
def get_roles():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)
        
        if not usuario or not usuario.rol:
            return jsonify({"error": "Usuario sin rol válido"}), 403

        # Si es Master Admin o Admin, ve todo. 
        # Si tiene permiso 'gestion_roles', también.
        
        # Verificamos permiso manualmente aquí para no usar el decorador en la lista completa
        # (ya que un Admin puede no tener el permiso explícito en la tabla pero ser Admin)
        es_admin = usuario.rol.NOMBRE_ROL in ["Master_Admin", "Admin"]
        
        # Check permiso base de datos
        sql_permiso = text("""
            SELECT 1 FROM permiso_x_rol pxr 
            JOIN permiso p ON pxr.ID_PERMISO = p.ID_PERMISO
            WHERE pxr.ID_ROL = :rid AND p.NOMBRE_PERMISO = 'gestion_roles'
        """)
        tiene_permiso = db.session.execute(sql_permiso, {"rid": usuario.ID_ROL}).fetchone()

        if not es_admin and not tiene_permiso:
             return jsonify({"error": "Acceso denegado a roles"}), 403

        roles = Rol.query.all()
        resultado = []
        for r in roles:
            # Ocultar Master_Admin para los mortales
            if usuario.rol.NOMBRE_ROL != "Master_Admin" and r.NOMBRE_ROL == "Master_Admin":
                continue
            resultado.append({
                "id": r.ID_ROL, 
                "nombre": r.NOMBRE_ROL, 
                "descripcion": r.DESCRIPCION_ROL or ""
            })
            
        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 2. LISTAR PERMISOS DISPONIBLES (Para asignar)
# ---------------------------------------------------------
@roles_bp.route("/permisos", methods=["GET"])
@role_required("Master_Admin", "Admin") # Solo admins pueden ver qué permisos existen para asignar
def get_all_permisos():
    permisos = Permiso.query.all()
    return jsonify([{
        "id": p.ID_PERMISO, 
        "nombre": p.NOMBRE_PERMISO, 
        "descripcion": p.DESCRIPCION
    } for p in permisos]), 200

# ---------------------------------------------------------
# 3. VER PERMISOS DE UN ROL
# ---------------------------------------------------------
@roles_bp.route("/roles/<int:id_rol>/permisos", methods=["GET"])
@jwt_required()
def get_rol_permisos(id_rol):
    # Cualquiera con acceso a gestion de roles puede ver esto
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    
    # Protegemos que un Admin no vea permisos del Master
    rol_target = Rol.query.get(id_rol)
    if not rol_target: return jsonify({"error": "Rol no encontrado"}), 404
    
    if usuario.rol.NOMBRE_ROL == "Admin" and rol_target.NOMBRE_ROL == "Master_Admin":
        return jsonify({"error": "Prohibido"}), 403

    query = text("SELECT ID_PERMISO FROM permiso_x_rol WHERE ID_ROL = :rid")
    result = db.session.execute(query, {"rid": id_rol}).fetchall()
    ids = [row[0] for row in result]
    return jsonify(ids), 200

# ---------------------------------------------------------
# 4. EDITAR PERMISOS DE UN ROL
# ---------------------------------------------------------
@roles_bp.route("/roles/<int:id_rol>/permisos", methods=["PUT"])
@role_required("Master_Admin", "Admin") # Estricto: Solo admins cambian permisos
def update_rol_permisos(id_rol):
    claims = get_jwt()
    rol_editor = claims.get("rol_nombre")

    rol_target = Rol.query.get(id_rol)
    if not rol_target: return jsonify({"error": "Rol no encontrado"}), 404

    # Protección crítica: Nadie toca al Master Admin excepto por BD directa
    if rol_target.NOMBRE_ROL == "Master_Admin":
        return jsonify({"error": "No se pueden modificar los permisos del Master Admin por seguridad."}), 403

    data = request.json
    nuevos_ids = data.get("permisos", [])

    try:
        # Borrar anteriores
        db.session.execute(text("DELETE FROM permiso_x_rol WHERE ID_ROL = :rid"), {"rid": id_rol})
        
        # Insertar nuevos
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

# ---------------------------------------------------------
# 5. CREAR ROL
# ---------------------------------------------------------
@roles_bp.route("/roles", methods=["POST"])
@role_required("Master_Admin", "Admin")
def create_rol_endpoint():
    data = request.json
    nombre = data.get("nombre")
    if not nombre: return jsonify({"error": "Nombre requerido"}), 400
    
    if "master" in nombre.lower(): 
        return jsonify({"error": "Nombre reservado"}), 400
    
    try:
        crear_rol(nombre, data.get("descripcion", ""))
        return jsonify({"success": True}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Helper
def crear_rol(nombre_rol, descripcion=""):
    existing_role = Rol.query.filter_by(NOMBRE_ROL=nombre_rol).first()
    if not existing_role:
        nuevo_rol = Rol(NOMBRE_ROL=nombre_rol, DESCRIPCION_ROL=descripcion)
        db.session.add(nuevo_rol)
        db.session.commit()
        return nuevo_rol
    return existing_role
# --- AGREGAR ESTO AL FINAL DE backend/roles_permisos.py ---

# 6. ELIMINAR ROL
@roles_bp.route("/roles/<int:id_rol>", methods=["DELETE"])
@role_required("Master_Admin", "Admin") # Solo admins pueden borrar
def delete_rol(id_rol):
    # 1. Validar que el rol exista
    rol = Rol.query.get(id_rol)
    if not rol:
        return jsonify({"error": "Rol no encontrado"}), 404

    # 2. PROTEGER ROLES DEL SISTEMA
    if rol.NOMBRE_ROL in ["Master_Admin", "Admin", "Chofer", "Encargado"]:
        return jsonify({"error": f"No se puede eliminar el rol base '{rol.NOMBRE_ROL}' por seguridad."}), 403

    # 3. VERIFICAR QUE NO TENGA USUARIOS ASIGNADOS
    # (Si borras un rol con usuarios, esos usuarios quedan 'huerfanos' y el sistema falla)
    usuarios_con_rol = Usuario.query.filter_by(ID_ROL=id_rol).count()
    if usuarios_con_rol > 0:
        return jsonify({"error": f"No se puede eliminar: Hay {usuarios_con_rol} usuarios con este rol."}), 400

    try:
        # Primero borramos los permisos asociados en la tabla intermedia
        db.session.execute(text("DELETE FROM permiso_x_rol WHERE ID_ROL = :rid"), {"rid": id_rol})
        
        # Ahora sí borramos el rol
        db.session.delete(rol)
        db.session.commit()
        return jsonify({"success": True, "message": "Rol eliminado correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500