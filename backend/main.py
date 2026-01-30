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
from asistencia import asistencia_bp
from perfil import perfil_bp
from buzon_routes import buzon_bp

from depositos import depositos_bp
from vehiculos import vehiculos_bp
from personal import personal_bp
from roles_permisos import role_required, crear_rol, roles_bp
from solicitudes import solicitudes_bp
from materiales import materiales_bp
from notificaciones import notificaciones_bp
from vales import vales_bp
from gastos import gastos_bp
from db import (
    db, Usuario, Empleado, Deposito, PasswordResetToken, Rol, Permiso, permiso_x_rol
)

# -----------------------------------------------------------------
# 🔧 CONFIGURACIÓN PRINCIPAL
# -----------------------------------------------------------------
app = Flask(__name__)
from werkzeug.exceptions import HTTPException

ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

# CORS normal (para /api)
CORS(
    app,
    resources={r"/api/*": {"origins": list(ALLOWED_ORIGINS)}},
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"]
)

# ✅ Fallback: asegura CORS incluso cuando hay error 500
@app.after_request
def add_cors_headers(resp):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Access-Control-Allow-Headers"] = "Authorization,Content-Type"
        resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return resp

# ✅ Para que el frontend vea el motivo real del 500 en JSON
@app.errorhandler(Exception)
def handle_any_error(e):
    code = 500
    if isinstance(e, HTTPException):
        code = e.code
    return jsonify({"error": str(e), "type": e.__class__.__name__}), code

# --- REGISTRO DE BLUEPRINTS ---
app.register_blueprint(ordenes_bp, url_prefix="/api")
app.register_blueprint(mapa_bp, url_prefix="/api")
app.register_blueprint(perfil_bp, url_prefix="/api")
app.register_blueprint(personal_bp, url_prefix="/api")
app.register_blueprint(asistencia_bp, url_prefix='/api/asistencia')
app.register_blueprint(roles_bp, url_prefix="/api")
app.register_blueprint(materiales_bp, url_prefix="/api")
app.register_blueprint(movimientos_bp, url_prefix="/api")
app.register_blueprint(solicitudes_bp)
app.register_blueprint(notificaciones_bp, url_prefix='/api')
app.register_blueprint(vales_bp, url_prefix="/api")
app.register_blueprint(gastos_bp, url_prefix="/api")
app.register_blueprint(depositos_bp)
app.register_blueprint(buzon_bp)
app.register_blueprint(vehiculos_bp, url_prefix="/api")

# --- CORS (Con soporte para React y Raspberry Pi) ---
# --- CORS (Con soporte para React y Raspberry Pi) ---

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
        "http://192.168.0.*",
        "http://172.20.10.*"
    ],
    cors_allowed_headers=["Authorization", "Content-Type"]
)

# -----------------------------------------------------------------
# 🧠 HELPERS (NUEVO) - Evita 500 por datetimes naive/aware
# -----------------------------------------------------------------
def utcnow_naive():
    """
    Retorna datetime UTC *naive* (sin tzinfo).
    Esto evita el crash típico de MySQL/SQLAlchemy devolviendo datetimes naive.
    """
    return datetime.utcnow()

def normalize_db_datetime(value):
    """
    Normaliza un datetime de DB para compararlo sin reventar:
    - Si viene string, intenta parsear.
    - Si viene aware, lo pasa a UTC y lo vuelve naive.
    - Si viene naive, lo deja igual.
    """
    if value is None:
        return None

    if isinstance(value, str):
        try:
            # Si tu DB devuelve strings ISO (raro pero posible)
            value = datetime.fromisoformat(value)
        except Exception:
            return None

    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    return None

# -----------------------------------------------------------------
# 🧩 AUTENTICACIÓN Y REGISTRO
# -----------------------------------------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    correo = data.get("correo")
    contrasena = data.get("contrasena")

    user = Usuario.query.filter_by(CORREO=correo).first()

    if user and user.check_password(contrasena):
        rol_nombre = user.rol.NOMBRE_ROL if user.rol else "Sin Rol"

        permisos_query = db.session.query(Permiso.NOMBRE_PERMISO)\
            .join(permiso_x_rol)\
            .join(Rol)\
            .filter(Rol.ID_ROL == user.ID_ROL).all()

        lista_permisos = [p[0] for p in permisos_query]

        access_token = create_access_token(
            identity=str(user.ID_USUARIO),
            additional_claims={
                "rol_nombre": rol_nombre,
                "id_empleado": user.ID_EMPLEADO
            }
        )

        return jsonify({
            "message": "Login exitoso",
            "access_token": access_token,
            "user": user.to_dict_profile(),
            "rol": rol_nombre,
            "permisos": lista_permisos
        }), 200

    return jsonify({"error": "Credenciales inválidas"}), 401


@app.route("/api/registro", methods=["POST"])
def registro():
    data = request.json
    try:
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
    data = request.json or {}
    email = data.get("email")

    if not email:
        return jsonify({"success": False, "message": "Falta el campo email."}), 400

    try:
        user = Usuario.query.filter_by(CORREO=email).first()
        if not user:
            return jsonify({"success": False, "message": "El correo no está registrado."}), 404

        token = secrets.token_hex(32)

        # ✅ CAMBIO: usamos UTC naive para que MySQL/SQLAlchemy no “pierda” tz y rompa comparaciones
        expires_at = utcnow_naive() + timedelta(hours=1)

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
    data = request.json or {}
    token = data.get("token")
    new_password = data.get("password")

    # ✅ VALIDACIONES para evitar 500 por None
    if not token:
        return jsonify({"success": False, "message": "Falta el token."}), 400
    if not new_password:
        return jsonify({"success": False, "message": "Falta la nueva contraseña."}), 400

    try:
        token_data = PasswordResetToken.query.filter_by(TOKEN=token).first()
        if not token_data:
            return jsonify({"success": False, "message": "Token inválido o expirado."}), 400

        # ✅ CAMBIO CLAVE: normalizamos EXPIRES_AT para comparar sin naive/aware crash
        expires_at = normalize_db_datetime(token_data.EXPIRES_AT)
        now = utcnow_naive()

        if (expires_at is None) or (now > expires_at):
            # Si está expirado, borramos el token
            db.session.delete(token_data)
            db.session.commit()
            return jsonify({"success": False, "message": "Token inválido o expirado."}), 400

        usuario = Usuario.query.filter_by(CORREO=token_data.EMAIL).first()
        if not usuario:
            return jsonify({"success": False, "message": "Usuario no encontrado."}), 404

        usuario.set_password(new_password)

        # Consumimos el token
        db.session.delete(token_data)
        db.session.commit()

        return jsonify({"success": True, "message": "Contraseña actualizada exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error en reset_password: {e}")
        return jsonify({"success": False, "message": "Error al actualizar la contraseña."}), 500

# -----------------------------------------------------------------
# 🚀 EJECUCIÓN PRINCIPAL
# -----------------------------------------------------------------
ROLES_BASE = ["Empleado", "Chofer", "Personal_Inventario", "Admin", "Master_Admin"]

@app.route("/api/depositos_publico", methods=["GET"])
def depositos_publico():
    print("📢 ACCESO A RUTA PÚBLICA DE EMERGENCIA")
    try:
        depositos = Deposito.query.order_by(Deposito.NOMBRE).all()
        return jsonify([d.to_dict() for d in depositos]), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/_routes", methods=["GET"])
def list_routes():
    salida = []
    for r in app.url_map.iter_rules():
        salida.append({
            "rule": str(r),
            "methods": sorted([m for m in r.methods if m not in ("HEAD", "OPTIONS")]),
            "endpoint": r.endpoint
        })
    salida.sort(key=lambda x: x["rule"])
    return jsonify(salida), 200

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        for nombre in ROLES_BASE:
            try:
                crear_rol(nombre)
            except Exception:
                pass

    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        allow_unsafe_werkzeug=True,
        use_reloader=False
    )
