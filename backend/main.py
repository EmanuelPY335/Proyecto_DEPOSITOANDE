# sisdepo/backend/main.py
from flask import Flask, request, jsonify
from sqlalchemy.exc import IntegrityError
from flask_cors import CORS
import secrets
from datetime import datetime, timezone, timedelta
from movimientos import movimientos_bp
from flask_jwt_extended import (
    create_access_token, jwt_required, JWTManager, get_jwt
)
from flask_mail import Mail, Message

# --- IMPORTACIONES DE BLUEPRINTS ---
from ordenes import ordenes_bp
from mapa import mapa_bp, socketio
from perfil import perfil_bp
from personal import personal_bp
from roles_permisos import role_required, crear_rol, roles_bp
# ✅ NUEVO IMPORT: Traemos el blueprint correcto
from materiales import materiales_bp

from db import (
    db, Usuario, Empleado, Deposito,
    Material, PasswordResetToken, Rol,
    Vehiculo, PosicionGps
)

# -----------------------------------------------------------------
# 🔧 CONFIGURACIÓN PRINCIPAL
# -----------------------------------------------------------------
app = Flask(__name__)

# --- REGISTRO DE BLUEPRINTS ---
app.register_blueprint(ordenes_bp, url_prefix="/api")
app.register_blueprint(mapa_bp, url_prefix="/api")
app.register_blueprint(perfil_bp, url_prefix="/api")
app.register_blueprint(personal_bp, url_prefix="/api")
app.register_blueprint(roles_bp, url_prefix="/api")
# ✅ NUEVO REGISTRO: Activamos el módulo de materiales
app.register_blueprint(materiales_bp, url_prefix="/api")
# Donde registras los blueprints (aprox línea 80):
app.register_blueprint(movimientos_bp, url_prefix="/api")

# --- CORS (Con soporte para React y Raspberry Pi) ---
CORS(
    app,
    resources={r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://192.168.100.*",
            "http://192.168.0.*"
        ]
    }},
    supports_credentials=True,
    allow_headers=["Authorization", "Content-Type"]
)

# --- JWT ---
app.config["JWT_SECRET_KEY"] = "clave_super_segura_sisdepo_2025"
app.config["JWT_TOKEN_LOCATION"] = ["headers"]
app.config["JWT_HEADER_NAME"] = "Authorization"
app.config["JWT_HEADER_TYPE"] = "Bearer"
jwt = JWTManager(app)

# --- FLASK-MAIL ---
app.config.update(
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=465,
    MAIL_USERNAME='obaezemanuel@gmail.com',
    MAIL_PASSWORD='gcipahijdcpvjika',
    MAIL_USE_TLS=False,
    MAIL_USE_SSL=True
)
mail = Mail(app)

# --- SQLALCHEMY ---
app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+mysqlconnector://root:pepitos9900.@127.0.0.1:3306/sisdepo"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

# --- SOCKET.IO ---
socketio.init_app(
    app,
    cors_allowed_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.100.*",
        "http://192.168.0.*"
    ],
    cors_allowed_headers=["Authorization", "Content-Type"]
)

# -----------------------------------------------------------------
# 🧩 AUTENTICACIÓN Y REGISTRO
# -----------------------------------------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    contrasena = data.get("password")
    try:
        user = Usuario.query.filter_by(CORREO=email).first()
        if user and user.check_password(contrasena):
            expires = timedelta(minutes=30)
            access_token = create_access_token(
                identity=str(user.ID_USUARIO),
                expires_delta=expires,
                additional_claims={
                    "rol_id": user.ID_ROL,
                    "rol_nombre": user.rol.NOMBRE_ROL
                }
            )
            return jsonify({
                "access_token": access_token,
                "user_nombre": user.empleado.NOMBRE if user.empleado else "Usuario",
                "rol": user.rol.NOMBRE_ROL
            }), 200
        return jsonify({"message": "Correo o contraseña incorrectos"}), 401
    except Exception as e:
        print(f"Error en login: {e}")
        return jsonify({"message": "Error interno del servidor"}), 500


@app.route("/api/registro", methods=["POST"])
def registro():
    data = request.json
    try:
        # Rol base por defecto: Empleado (se crea si no existe)
        rol_empleado = Rol.query.filter_by(NOMBRE_ROL="Empleado").first()
        if not rol_empleado:
            rol_empleado = Rol(NOMBRE_ROL="Empleado")
            db.session.add(rol_empleado)
            db.session.commit()

        nuevo_empleado = Empleado(
            ID_DEPOSITO=data.get("deposito"),
            NUMERO_DOCUMENTO=data.get("cedula"),
            NOMBRE=data.get("nombre"),
            APELLIDO=data.get("apellido"),
            ESTADO_ACTIVO=True,
            TELEFONO=data.get("telefono"),
            FECHA_NACIMIENTO=data.get("fecha")
        )

        nuevo_usuario = Usuario(
            ID_ROL=rol_empleado.ID_ROL,
            CORREO=data.get("correo")
        )
        nuevo_usuario.set_password(data.get("contrasena"))
        nuevo_usuario.empleado = nuevo_empleado

        db.session.add(nuevo_empleado)
        db.session.add(nuevo_usuario)
        db.session.commit()

        return jsonify({"success": True, "message": "Usuario registrado exitosamente."}), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "message": "El correo, número de documento o teléfono ya está en uso."}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error en registro: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# -----------------------------------------------------------------
# 🔐 INFO USUARIO (ME)
# -----------------------------------------------------------------
@app.route("/api/me", methods=["GET"])
@jwt_required()
def me():
    claims = get_jwt()
    return jsonify({
        "rol_id": claims.get("rol_id"),
        "rol_nombre": claims.get("rol_nombre")
    }), 200

# -----------------------------------------------------------------
# 🔁 RECUPERACIÓN DE CONTRASEÑA
# -----------------------------------------------------------------
@app.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    data = request.json
    email = data.get("email")
    try:
        user = Usuario.query.filter_by(CORREO=email).first()
        if not user:
            return jsonify({"success": False, "message": "El correo no está registrado."}), 404

        token = secrets.token_hex(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        nuevo_token = PasswordResetToken(EMAIL=email, TOKEN=token, EXPIRES_AT=expires_at)
        db.session.add(nuevo_token)
        db.session.commit()

        reset_link = f"http://localhost:3000/reset-password/{token}"
        msg = Message(
            'Restablecimiento de Contraseña - SISDEPO',
            sender=app.config['MAIL_USERNAME'], recipients=[email]
        )
        msg.body = (
            f"Para restablecer tu contraseña, haz clic en el siguiente enlace:\n\n"
            f"{reset_link}\n\nEste enlace expira en 1 hora.\n"
            "Si no solicitaste esto, ignora este mensaje."
        )
        mail.send(msg)
        return jsonify({"message": "Se envió un enlace de restablecimiento al correo registrado."}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error en forgot_password: {e}")
        return jsonify({"error": "Hubo un problema al procesar la solicitud."}), 500


@app.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.json
    token = data.get("token")
    new_password = data.get("password")
    try:
        token_data = PasswordResetToken.query.filter_by(TOKEN=token).first()
        
        is_expired = not token_data or datetime.now(timezone.utc) > token_data.EXPIRES_AT

        if is_expired:
            if token_data:
                db.session.delete(token_data)
                db.session.commit()
            return jsonify({"success": False, "message": "Token inválido o expirado."}), 400

        usuario = Usuario.query.filter_by(CORREO=token_data.EMAIL).first()
        if not usuario:
            return jsonify({"success": False, "message": "Usuario no encontrado."}), 404

        usuario.set_password(new_password)
        db.session.delete(token_data)
        db.session.commit()
        return jsonify({"success": True, "message": "Contraseña actualizada exitosamente."}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error en reset_password: {e}")
        return jsonify({"success": False, "message": "Error al actualizar la contraseña."}), 500

# -----------------------------------------------------------------
# 📦 DEPÓSITOS (Materiales ahora se maneja en materiales.py)
# -----------------------------------------------------------------
@app.route("/api/depositos", methods=["GET"])
def get_depositos():
    try:
        depositos = Deposito.query.order_by(Deposito.NOMBRE).all()
        return jsonify([d.to_dict() for d in depositos]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------
# 🚀 EJECUCIÓN PRINCIPAL
# -----------------------------------------------------------------
ROLES_BASE = ["Empleado", "Chofer", "Personal_Inventario", "Admin", "Master_Admin"]

if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # Asegura tablas
        # Siembra de roles
        for nombre in ROLES_BASE:
            try:
                # Usamos la función del helper roles_permisos
                crear_rol(nombre)  
            except Exception:
                pass

    # ⚙️ Ejecución
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        allow_unsafe_werkzeug=True,
        use_reloader=False
    )