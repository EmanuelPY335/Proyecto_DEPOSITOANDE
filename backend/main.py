# main.py
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from flask_cors import CORS

from mapa import mapa_bp, db, socketio


app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 🔹 Configuración SQLAlchemy para MySQL
app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+mysqlconnector://root:@127.0.0.1/proyecto_deposito_ande"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False  # 👈 RECOMENDADO agregar esto

db.init_app(app)
socketio.init_app(app, cors_allowed_origins="*")

# Registrar Blueprints
app.register_blueprint(mapa_bp, url_prefix="/api")


# ---------------- CONEXIÓN DIRECTA A MYSQL (usuarios) -----------------
def get_db_connection():
    return mysql.connector.connect(
        host="127.0.0.1",
        user="root",
        password="",
        database="proyecto_deposito_ande"
    )

# ---------------- LOGIN -----------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    contrasena = data.get("password")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM usuario WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user["contrasena"], contrasena):
            return jsonify({"success": True, "nombre": user["nombre"], "usuario_id": user["usuario_id"]})
        else:
            return jsonify({"success": False, "message": "Correo o contraseña incorrectos"})
    finally:
        cursor.close()
        conn.close()

# ---------------- REGISTRO -----------------
@app.route("/api/registro", methods=["POST"])
def registro():
    data = request.json
    nombre = data.get("nombre")
    apellido = data.get("apellido")
    fecha_nacimiento = data.get("fecha")
    cedula_identidad = data.get("cedula")
    cargo = data.get("cargo")
    telefono = data.get("telefono")
    email = data.get("correo")
    contrasena = data.get("contrasena")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        hashed_password = generate_password_hash(contrasena)

        cursor.execute("""
            INSERT INTO usuario (nombre, apellido, fecha_nacimiento, cedula_identidad, cargo, telefono, email, contrasena)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (nombre, apellido, fecha_nacimiento, cedula_identidad, cargo, telefono, email, hashed_password))

        conn.commit()
        return jsonify({"success": True, "message": "Usuario registrado exitosamente"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

    finally:
        cursor.close()
        conn.close()

# ---------------- RUN -----------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # crea tablas camiones y position si no existen
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)