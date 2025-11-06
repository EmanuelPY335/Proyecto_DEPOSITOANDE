# sisdepo/backend/perfil.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError 

# Importamos 'db' y los Modelos desde nuestro archivo db.py
from db import db, Usuario, Empleado

perfil_bp = Blueprint("perfil", __name__)

@perfil_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    id_usuario_actual = get_jwt_identity()
    usuario = Usuario.query.get(id_usuario_actual)
    if not usuario:
        return jsonify({"success": False, "message": "Usuario no encontrado."}), 404
    return jsonify(usuario.to_dict_profile()), 200

@perfil_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    try:
        id_usuario_actual = int(get_jwt_identity())
        data = request.json
        
        nombre = data.get("NOMBRE")
        apellido = data.get("APELLIDO")
        telefono = data.get("TELEFONO")
        correo = data.get("CORREO")

        if not all([nombre, apellido, telefono, correo]):
            return jsonify({"success": False, "message": "Faltan datos."}), 400

        usuario = Usuario.query.get(id_usuario_actual)
        if not usuario or not usuario.empleado:
            return jsonify({"success": False, "message": "Usuario o empleado no encontrado."}), 404

        usuario.empleado.NOMBRE = nombre
        usuario.empleado.APELLIDO = apellido
        usuario.empleado.TELEFONO = telefono
        usuario.CORREO = correo
        
        db.session.commit()
        
        return jsonify({"success": True, "message": "Perfil actualizado exitosamente."})

    except IntegrityError as err:
        db.session.rollback() 
        return jsonify({"success": False, "message": "El correo o teléfono ya está en uso por otra cuenta."})
    except Exception as e:
        db.session.rollback() 
        print(f"Error en update_profile: {e}")
        return jsonify({"success": False, "message": "Error interno del servidor."}), 500

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