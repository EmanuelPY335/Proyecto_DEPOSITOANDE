# main.py
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from flask_cors import CORS
import secrets # Para generar la clave secreta
from datetime import datetime, timedelta # Para la expiración del token de reseteo

# Importar JWT
from flask_jwt_extended import create_access_token, jwt_required, JWTManager, get_jwt

# Importar Flask-Mail
from flask_mail import Mail, Message  

# Importar componentes del mapa
from mapa import mapa_bp, db, socketio


app = Flask(__name__)
# Permitir peticiones desde tu frontend (React corre en puerto 3000 por defecto)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Configuración de JWT
app.config["JWT_SECRET_KEY"] = secrets.token_hex(32) 
jwt = JWTManager(app)

# Configuración de Flask-Mail (Usando tu App Password)
app.config['MAIL_SERVER']='smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = 'obaezemanuel@gmail.com'
app.config['MAIL_PASSWORD'] = 'gcipahijdcpvjika'         
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True
mail = Mail(app)

# Configuración de SQLAlchemy (Base de Datos)
app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+mysqlconnector://root:@127.0.0.1/SISDEPO"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

# Inicializar SocketIO
socketio.init_app(app, cors_allowed_origins="http://localhost:3000")

# Registrar Blueprints (rutas del mapa)
app.register_blueprint(mapa_bp, url_prefix="/api")

# Función helper para conectar a la BBDD
def get_db_connection():
    return mysql.connector.connect(
        host="127.0.0.1", user="root", password="", database="SISDEPO"
    )

# --- RUTAS DE AUTENTICACIÓN ---

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    contrasena = data.get("password")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Obtenemos ID_ROL para incluirlo en el token
        cursor.execute("""
            SELECT 
                u.ID_USUARIO, 
                u.CONTRASENA, 
                e.NOMBRE,
                e.ID_EMPLEADO,
                u.ID_ROL 
            FROM USUARIO u
            JOIN EMPLEADO e ON u.ID_EMPLEADO = e.ID_EMPLEADO
            WHERE u.CORREO = %s
        """, (email,))
        
        user = cursor.fetchone()

        if user and check_password_hash(user["CONTRASENA"], contrasena):
            # Creamos el token JWT incluyendo el ROL
            access_token = create_access_token(
                identity=user["ID_USUARIO"], 
                additional_claims={"rol": user["ID_ROL"]}
            )
            return jsonify(
                access_token=access_token, 
                nombre=user["NOMBRE"]
            )
        else:
            return jsonify({"message": "Correo o contraseña incorrectos"}), 401
            
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

@app.route("/api/registro", methods=["POST"])
def registro():
    data = request.json
    nombre = data.get("nombre")
    apellido = data.get("apellido")
    fecha_nacimiento = data.get("fecha")
    cedula_identidad = data.get("cedula")
    telefono = data.get("telefono")
    email = data.get("correo")
    contrasena = data.get("contrasena")
    id_deposito = data.get("deposito") 

    if not id_deposito:
        return jsonify({"success": False, "message": "Debe seleccionar un depósito."}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        id_rol_a_asignar = 1 # Rol Empleado por defecto
        estado_activo = 1

        # Insertar Empleado (sin ID_CARGO)
        cursor.execute("""
            INSERT INTO EMPLEADO (ID_DEPOSITO, NUMERO_DOCUMENTO, NOMBRE, APELLIDO, ESTADO_ACTIVO, TELEFONO, FECHA_NACIMIENTO)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (id_deposito, cedula_identidad, nombre, apellido, estado_activo, telefono, fecha_nacimiento))
        
        id_empleado_creado = cursor.lastrowid
        hashed_password = generate_password_hash(contrasena)

        # Insertar Usuario con el ROL por defecto
        cursor.execute("""
            INSERT INTO USUARIO (ID_ROL, ID_EMPLEADO, CORREO, CONTRASENA)
            VALUES (%s, %s, %s, %s)
        """, (id_rol_a_asignar, id_empleado_creado, email, hashed_password))
        
        conn.commit()
        return jsonify({"success": True, "message": "Usuario registrado exitosamente"})

    except mysql.connector.Error as err:
        if err.errno == 1062: 
             return jsonify({"success": False, "message": "El correo o número de documento ya está en uso."})
        if err.errno == 1452:
             return jsonify({"success": False, "message": "Error de datos. Asegúrate de que el depósito o rol existan."})
        return jsonify({"success": False, "message": str(err)})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

# --- RUTAS DE RECUPERACIÓN DE CONTRASEÑA ---

@app.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    data = request.json
    email = data.get("email")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT ID_USUARIO FROM USUARIO WHERE CORREO = %s", (email,))
        user = cursor.fetchone()

        if not user:
            # Por seguridad, no revelamos si existe o no
            return jsonify({"message": "Si tu correo está registrado, se intentará enviar un enlace."})

        # Generar token y fecha de expiración
        token = secrets.token_hex(32)
        expires_at = datetime.now() + timedelta(hours=1) # Válido por 1 hora

        # Guardar token en BBDD
        cursor.execute("""
            INSERT INTO password_reset_tokens (EMAIL, TOKEN, EXPIRES_AT)
            VALUES (%s, %s, %s)
        """, (email, token, expires_at))
        conn.commit()

        # Crear enlace y enviar correo
        reset_link = f"http://localhost:3000/reset-password/{token}" 
        
        msg = Message(
            'Restablecimiento de Contraseña - SISDEPO',
            sender=app.config['MAIL_USERNAME'], # Usa el correo configurado
            recipients=[email]
        )
        msg.body = f"Para restablecer tu contraseña, haz clic en el siguiente enlace:\n\n{reset_link}\n\nEste enlace expira en 1 hora.\nSi no solicitaste esto, ignora este mensaje."
        
        mail.send(msg) # Enviar correo

        return jsonify({"message": "Si tu correo está registrado, se intentará enviar un enlace."})

    except Exception as e:
        print(f"Error en forgot_password: {e}") # Log del error real en consola
        return jsonify({"error": "Hubo un problema al procesar la solicitud."}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.json
    token = data.get("token")
    new_password = data.get("password")

    if not token or not new_password:
        return jsonify({"success": False, "message": "Faltan datos (token o contraseña)."}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Validar el token y que no haya expirado
        cursor.execute("SELECT EMAIL, EXPIRES_AT FROM password_reset_tokens WHERE TOKEN = %s", (token,))
        token_data = cursor.fetchone()

        if not token_data:
            return jsonify({"success": False, "message": "Token inválido."}), 400
        
        if datetime.now() > token_data["EXPIRES_AT"]:
            # Opcional: Borrar token expirado
            cursor.execute("DELETE FROM password_reset_tokens WHERE TOKEN = %s", (token,))
            conn.commit()
            return jsonify({"success": False, "message": "El token ha expirado."}), 400
        
        email = token_data["EMAIL"]

        # Actualizar contraseña del usuario
        hashed_password = generate_password_hash(new_password)
        cursor.execute("UPDATE USUARIO SET CONTRASENA = %s WHERE CORREO = %s", (hashed_password, email))
        
        # Eliminar el token usado
        cursor.execute("DELETE FROM password_reset_tokens WHERE TOKEN = %s", (token,))
        
        conn.commit()
        return jsonify({"success": True, "message": "Contraseña actualizada exitosamente."})

    except Exception as e:
        print(f"Error en reset_password: {e}") # Log del error real
        return jsonify({"success": False, "message": "Error al actualizar la contraseña."}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# --- RUTAS PÚBLICAS AUXILIARES ---

@app.route("/api/depositos", methods=["GET"])
def get_depositos():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT ID_DEPOSITO, NOMBRE FROM DEPOSITO ORDER BY NOMBRE")
        depositos = cursor.fetchall()
        return jsonify(depositos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

# --- RUTAS PROTEGIDAS (Requieren Login) ---

@app.route("/api/materiales", methods=["GET"])
@jwt_required() # Protegida
def get_materiales():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT ID_MATERIAL, CODIGO_UNICO, NOMBRE FROM MATERIAL ORDER BY NOMBRE")
        materiales = cursor.fetchall()
        return jsonify(materiales)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

@app.route("/api/materiales", methods=["POST"])
@jwt_required() # Protegida
def add_material():
    # Opcional: Verificar rol admin
    # claims = get_jwt()
    # if claims.get("rol") != 99: return jsonify({"message": "Acceso denegado"}), 403
            
    data = request.json
    codigo_unico = data.get("codigo_unico")
    nombre = data.get("nombre")

    if not codigo_unico or not nombre:
        return jsonify({"success": False, "message": "Código y Nombre son requeridos"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("INSERT INTO MATERIAL (CODIGO_UNICO, NOMBRE) VALUES (%s, %s)", (codigo_unico, nombre))
        
        conn.commit()
        return jsonify({"success": True, "message": "Material creado exitosamente", "id": cursor.lastrowid})

    except mysql.connector.Error as err:
        if err.errno == 1062: return jsonify({"success": False, "message": "El Código Único ya existe."})
        return jsonify({"success": False, "message": str(err)})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

# --- RUTAS DE ADMIN (Protegidas y requieren Rol 99) ---
# (Aquí irían las rutas /api/admin/usuarios y /api/admin/force-reset si las necesitas ahora)

# --- EJECUCIÓN PRINCIPAL ---
if __name__ == "__main__":
    with app.app_context():
        # Puedes añadir db.create_all() aquí si quieres que SQLAlchemy cree las tablas del mapa
        # si no existen al iniciar, aunque ya las creaste con SQL.
        pass 
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)