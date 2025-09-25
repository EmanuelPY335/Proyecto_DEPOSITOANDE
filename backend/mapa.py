# mapa.py (AGREGAR al final del archivo)
from flask import Blueprint, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
import datetime

mapa_bp = Blueprint("mapa", __name__)
db = SQLAlchemy()
socketio = SocketIO()

class Camion(db.Model):
    __tablename__ = "camiones"
    camion_id = db.Column(db.Integer, primary_key=True)
    patente = db.Column(db.String(20), nullable=False)
    modelo = db.Column(db.String(50))
    marca = db.Column(db.String(50))
    descripcion = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True)
    fecha_registro = db.Column(db.DateTime, default=datetime.datetime.now(datetime.timezone.utc))

class Position(db.Model):
    __tablename__ = "position"
    id = db.Column(db.Integer, primary_key=True)
    camion_id = db.Column(db.Integer, db.ForeignKey("camiones.camion_id"), nullable=False)
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.now(datetime.timezone.utc))

def parse_timestamp(ts):
    try:
        return datetime.datetime.fromisoformat(ts)
    except ValueError:
        return datetime.datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")

@mapa_bp.route("/positions", methods=["POST"])
def save_positions():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON received"}), 400

    positions = data if isinstance(data, list) else [data]

    saved = []
    for p in positions:
        if not all(k in p for k in ["camion_id", "lat", "lng", "timestamp"]):
            continue
        try:
            pos = Position(
                camion_id=p["camion_id"],
                lat=p["lat"],
                lng=p["lng"],
                timestamp=parse_timestamp(p["timestamp"])
            )
        except Exception as e:
            print("Error parseando posición:", e)
            continue
        db.session.add(pos)
        saved.append(p)
        socketio.emit("position_update", p, broadcast=True)

    db.session.commit()
    return jsonify({"status": "ok", "saved": len(saved)})

# 🔥 🔥 🔥 NUEVAS RUTAS GPS QUE AGREGASTE 🔥 🔥 🔥

@mapa_bp.route("/gps/tracking", methods=["POST"])
def receive_gps_data():
    """Recibe datos GPS del Raspberry Pi o emulador"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        if not data or 'camion_id' not in data or 'lat' not in data or 'lng' not in data:
            return jsonify({'error': 'Datos incompletos. Se requieren camion_id, lat y lng'}), 400
        
        # Crear nuevo registro de posición (usando tu modelo existente)
        pos = Position(
            camion_id=data['camion_id'],
            lat=data['lat'],
            lng=data['lng'],
            timestamp=datetime.datetime.now(datetime.timezone.utc)
        )
        
        db.session.add(pos)
        db.session.commit()
        
        # Emitir actualización en tiempo real
        socketio.emit("position_update", {
            "camion_id": data['camion_id'],
            "lat": data['lat'],
            "lng": data['lng'],
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }, broadcast=True)
        
        return jsonify({'message': 'Datos GPS recibidos correctamente', 'id': pos.id}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@mapa_bp.route("/vehicles/active", methods=["GET"])
def get_active_vehicles():
    """Obtiene camiones activos en las últimas 2 horas"""
    try:
        from datetime import timedelta
        two_hours_ago = datetime.datetime.now(datetime.timezone.utc) - timedelta(hours=2)
        
        # Última posición de cada camión
        latest_positions = db.session.query(
            Position.camion_id,
            db.func.max(Position.timestamp).label('max_timestamp')
        ).group_by(Position.camion_id).subquery()
        
        # Información completa de camiones activos
        active_camiones = db.session.query(
            Camion, Position
        ).join(
            Position, Camion.camion_id == Position.camion_id
        ).join(
            latest_positions,
            (Position.camion_id == latest_positions.c.camion_id) &
            (Position.timestamp == latest_positions.c.max_timestamp)
        ).filter(
            Position.timestamp >= two_hours_ago,
            Camion.activo == True
        ).all()
        
        result = []
        for camion, position in active_camiones:
            result.append({
                'camion_id': camion.camion_id,
                'patente': camion.patente,
                'modelo': camion.modelo,
                'marca': camion.marca,
                'lat': position.lat,
                'lng': position.lng,
                'last_update': position.timestamp.isoformat()
            })
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mapa_bp.route("/vehicles/<int:camion_id>/location", methods=["GET"])
def get_vehicle_location(camion_id):
    """Obtiene la última ubicación de un camión específico"""
    latest_position = Position.query.filter_by(camion_id=camion_id)\
        .order_by(Position.timestamp.desc()).first()
    
    if not latest_position:
        return jsonify({'error': 'Camión no encontrado'}), 404
    
    camion = Camion.query.get(camion_id)
    
    return jsonify({
        'camion_id': camion_id,
        'patente': camion.patente if camion else 'Desconocido',
        'lat': latest_position.lat,
        'lng': latest_position.lng,
        'timestamp': latest_position.timestamp.isoformat()
    })