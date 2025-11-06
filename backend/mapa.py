# mapa.py
from flask import Blueprint, request, jsonify
from flask_socketio import SocketIO
import datetime
from flask_jwt_extended import jwt_required 

# --- IMPORTACIONES MODIFICADAS ---
# Importamos 'db' y los modelos que necesitamos desde db.py
from db import db, Vehiculo, PosicionGps
# --- FIN DE MODIFICACIÓN ---

mapa_bp = Blueprint("mapa", __name__)

# SocketIO se define aquí, pero se inicializa en main.py
socketio = SocketIO()

# --- LOS MODELOS (Vehiculo, PosicionGps) FUERON ELIMINADOS DE AQUÍ ---

# ---------------- RUTAS GPS ----------------

@mapa_bp.route("/gps/tracking", methods=["POST"])
def receive_gps_data():
    """Recibe datos GPS del Raspberry Pi o emulador"""
    try:
        data = request.get_json()
        if not data or 'ID_VEHICULO' not in data or 'LATITUD' not in data or 'LONGITUD' not in data:
            return jsonify({'error': 'Datos incompletos. Se requieren ID_VEHICULO, LATITUD y LONGITUD'}), 400
        
        # Esta lógica ahora funciona porque el modelo está centralizado
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
        }, room='/')
        
        return jsonify({'message': 'Datos GPS recibidos correctamente', 'id': pos.ID_REGISTRO_GPS}), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"Error en /gps/tracking: {e}") # Añadido para mejor depuración
        return jsonify({'error': str(e)}), 500

@mapa_bp.route("/vehicles/active", methods=["GET"])
@jwt_required()
def get_active_vehicles():
    """Obtiene vehículos activos en las últimas 2 horas"""
    try:
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
        print(f"Error en /vehicles/active: {e}") # Añadido para mejor depuración
        return jsonify({'error': str(e)}), 500

@mapa_bp.route("/vehicles/<int:id_vehiculo>/location", methods=["GET"])
@jwt_required()
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