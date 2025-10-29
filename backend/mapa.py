# mapa.py
from flask import Blueprint, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
import datetime
from flask_jwt_extended import jwt_required # <--- CAMBIO: Importar

mapa_bp = Blueprint("mapa", __name__)
db = SQLAlchemy()
socketio = SocketIO()

# ... (Modelos Vehiculo y PosicionGps sin cambios) ...
class Vehiculo(db.Model):
    __tablename__ = "VEHICULO"
    ID_VEHICULO = db.Column(db.Integer, primary_key=True)
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey("EMPLEADO.ID_EMPLEADO"), nullable=False)
    MATRICULA = db.Column(db.String(10), nullable=False, unique=True)
    MARCA = db.Column(db.String(40))
    MODELO = db.Column(db.String(30))
    posiciones = db.relationship('PosicionGps', backref='vehiculo', lazy=True)

class PosicionGps(db.Model):
    __tablename__ = "REGISTRO_GPS"
    ID_REGISTRO_GPS = db.Column(db.Integer, primary_key=True)
    ID_VEHICULO = db.Column(db.Integer, db.ForeignKey("VEHICULO.ID_VEHICULO"), nullable=False)
    LATITUD = db.Column(db.DECIMAL(10, 7))
    LONGITUD = db.Column(db.DECIMAL(10, 7))
    FECHA_HORA = db.Column(db.DateTime, default=datetime.datetime.now(datetime.timezone.utc))

# ---------------- RUTAS GPS ----------------

@mapa_bp.route("/gps/tracking", methods=["POST"])
# --- (SIN @jwt_required() - Esta ruta es para el dispositivo GPS) ---
def receive_gps_data():
    """Recibe datos GPS del Raspberry Pi o emulador"""
    try:
        data = request.get_json()
        if not data or 'ID_VEHICULO' not in data or 'LATITUD' not in data or 'LONGITUD' not in data:
            return jsonify({'error': 'Datos incompletos. Se requieren ID_VEHICULO, LATITUD y LONGITUD'}), 400
        
        pos = PosicionGps(
            ID_VEHICULO=data['ID_VEHICULO'],
            LATITUD=data['LATITUD'],
            LONGITUD=data['LONGITUD'],
            FECHA_HORA=datetime.datetime.now(datetime.timezone.utc)
        )
        db.session.add(pos)
        db.session.commit()
        
        socketio.emit("position_update", {
            "ID_VEHICULO": data['ID_VEHICULO'],
            "LATITUD": float(data['LATITUD']), 
            "LONGITUD": float(data['LONGITUD']),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }, broadcast=True)
        
        return jsonify({'message': 'Datos GPS recibidos correctamente', 'id': pos.ID_REGISTRO_GPS}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@mapa_bp.route("/vehicles/active", methods=["GET"])
@jwt_required() # <--- CAMBIO: Ruta protegida
def get_active_vehicles():
    """Obtiene vehículos activos en las últimas 2 horas"""
    try:
        # ... (lógica interna sin cambios) ...
        from datetime import timedelta
        two_hours_ago = datetime.datetime.now(datetime.timezone.utc) - timedelta(hours=2)
        
        latest_positions = db.session.query(
            PosicionGps.ID_VEHICULO,
            db.func.max(PosicionGps.FECHA_HORA).label('max_timestamp')
        ).group_by(PosicionGps.ID_VEHICULO).subquery()
        
        active_vehiculos = db.session.query(
            Vehiculo, PosicionGps
        ).join(
            PosicionGps, Vehiculo.ID_VEHICULO == PosicionGps.ID_VEHICULO
        ).join(
            latest_positions,
            (PosicionGps.ID_VEHICULO == latest_positions.c.ID_VEHICULO) &
            (PosicionGps.FECHA_HORA == latest_positions.c.max_timestamp)
        ).filter(
            PosicionGps.FECHA_HORA >= two_hours_ago
        ).all()
        
        result = []
        for vehiculo, position in active_vehiculos:
            result.append({
                'ID_VEHICULO': vehiculo.ID_VEHICULO,
                'MATRICULA': vehiculo.MATRICULA,
                'MODELO': vehiculo.MODELO,
                'MARCA': vehiculo.MARCA,
                'LATITUD': float(position.LATITUD),
                'LONGITUD': float(position.LONGITUD),
                'last_update': position.FECHA_HORA.isoformat()
            })
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mapa_bp.route("/vehicles/<int:id_vehiculo>/location", methods=["GET"])
@jwt_required() # <--- CAMBIO: Ruta protegida
def get_vehicle_location(id_vehiculo):
    """Obtiene la última ubicación de un vehículo específico"""
    latest_position = PosicionGps.query.filter_by(ID_VEHICULO=id_vehiculo)\
        .order_by(PosicionGps.FECHA_HORA.desc()).first()
    
    if not latest_position:
        return jsonify({'error': 'Camión no encontrado'}), 404
    
    vehiculo = Vehiculo.query.get(id_vehiculo)
    
    return jsonify({
        'ID_VEHICULO': id_vehiculo,
        'MATRICULA': vehiculo.MATRICULA if vehiculo else 'Desconocido',
        'LATITUD': float(latest_position.LATITUD),
        'LONGITUD': float(latest_position.LONGITUD),
        'timestamp': latest_position.FECHA_HORA.isoformat()
    })