# backend/perfil.py
import os
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Usuario

perfil_bp = Blueprint("perfil", __name__)

# Configuración de subida
UPLOAD_FOLDER = 'uploads/avatars'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@perfil_bp.route('/uploads/avatars/<filename>')
def uploaded_file(filename):
    return send_from_directory(os.path.join(current_app.root_path, UPLOAD_FOLDER), filename)

# --- 1. OBTENER PERFIL (GET) CON PERMISOS ---
@perfil_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    id_usuario_actual = get_jwt_identity()
    usuario = Usuario.query.get(id_usuario_actual)
    
    if not usuario:
        return jsonify({"success": False, "message": "Usuario no encontrado."}), 404
        
    # Obtener el diccionario base del perfil
    data = usuario.to_dict_profile()
    
    # AGREGADO: Obtener la lista de permisos del rol
    lista_permisos = []
    if usuario.rol and usuario.rol.permisos:
        # Usamos NOMBRE_PERMISO según tu db.py
        lista_permisos = [p.NOMBRE_PERMISO for p in usuario.rol.permisos]
    
    # Inyectamos el rol y los permisos en la respuesta
    data['rol'] = usuario.rol.NOMBRE_ROL if usuario.rol else "Sin Rol"
    data['permisos'] = lista_permisos
    
    return jsonify(data), 200

# --- 2. ACTUALIZAR PERFIL (PUT) ---
@perfil_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    try:
        id_usuario = get_jwt_identity()
        usuario = Usuario.query.get(id_usuario)
        data = request.json
        
        if usuario.empleado:
            usuario.empleado.NOMBRE = data.get("NOMBRE", usuario.empleado.NOMBRE)
            usuario.empleado.APELLIDO = data.get("APELLIDO", usuario.empleado.APELLIDO)
            usuario.empleado.TELEFONO = data.get("TELEFONO", usuario.empleado.TELEFONO)
        
        usuario.CORREO = data.get("CORREO", usuario.CORREO)
        usuario.BANNER_COLOR = data.get("BANNER_COLOR", usuario.BANNER_COLOR) 

        db.session.commit()
        return jsonify({"success": True, "message": "Perfil actualizado."})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating profile: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# --- 3. SUBIR AVATAR (POST) ---
@perfil_bp.route("/profile/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    if 'file' not in request.files:
        return jsonify({"message": "No se envió archivo"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "Nombre de archivo vacío"}), 400
        
    if file and allowed_file(file.filename):
        id_usuario = get_jwt_identity()
        usuario = Usuario.query.get(id_usuario)
        
        full_path = os.path.join(current_app.root_path, UPLOAD_FOLDER)
        os.makedirs(full_path, exist_ok=True)
        
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = secure_filename(f"avatar_{id_usuario}.{ext}")
        
        file.save(os.path.join(full_path, filename))
        
        usuario.AVATAR = f"/api/uploads/avatars/{filename}"
        db.session.commit()
        
        return jsonify({"success": True, "avatar_url": usuario.AVATAR})
    
    return jsonify({"message": "Formato no permitido"}), 400

# --- 4. CAMBIAR CONTRASEÑA (POST) ---
@perfil_bp.route("/profile/change-password", methods=["POST"])
@jwt_required()
def change_password():
    try:
        id_usuario_actual = get_jwt_identity()
        data = request.json
        
        current_password = data.get("current_password")
        new_password = data.get("new_password")

        if not current_password or not new_password:
            return jsonify({"success": False, "message": "Faltan contraseñas."}), 400

        usuario = Usuario.query.get(id_usuario_actual)
        
        if not usuario or not usuario.check_password(current_password):
            return jsonify({"success": False, "message": "La contraseña actual es incorrecta."}), 401
        
        usuario.set_password(new_password)
        db.session.commit()
        
        return jsonify({"success": True, "message": "Contraseña actualizada exitosamente."})

    except Exception as e:
        db.session.rollback()
        print(f"Error en change_password: {e}")
        return jsonify({"success": False, "message": "Error interno del servidor."}), 500