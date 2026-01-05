from flask import Blueprint, request, jsonify
from flask_socketio import SocketIO
from datetime import datetime, timezone, timedelta
from flask_jwt_extended import jwt_required
# 1. AGREGAMOS 'Deposito' A LAS IMPORTACIONES
from db import db, Vehiculo, PosicionGps, Deposito 

mapa_bp = Blueprint("mapa", __name__)
socketio = SocketIO()

# ---------------- RUTA GPS (Raspberry Pi) ----------------
@mapa_bp.route("/gps/tracking", methods=["POST"])
def receive_gps_data():
    """
    Recibe los datos GPS enviados desde la Raspberry Pi (agente).
    Guarda las coordenadas en la base y emite la posición actualizada al mapa.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No se recibieron datos JSON'}), 400

        id_vehiculo = data.get("ID_VEHICULO")
        lat = data.get("LATITUD")
        lon = data.get("LONGITUD")

        # Validar campos
        if id_vehiculo is None or lat is None or lon is None:
            return jsonify({
                'error': 'Datos incompletos. Se requieren ID_VEHICULO, LATITUD y LONGITUD'
            }), 400

        # Validar que el vehículo exista antes de insertar
        vehiculo = Vehiculo.query.get(id_vehiculo)
        if not vehiculo:
            return jsonify({'error': f'El vehículo {id_vehiculo} no existe en la base de datos'}), 400

        # Conversión segura a float
        try:
            lat = float(lat)
            lon = float(lon)
        except ValueError:
            return jsonify({'error': 'LATITUD y LONGITUD deben ser valores numéricos'}), 400

        # Usamos datetime.now(timezone.utc)
        ahora_utc = datetime.now(timezone.utc)

        # Registrar posición en la base
        pos = PosicionGps(
            ID_VEHICULO=id_vehiculo,
            LATITUD=lat,
            LONGITUD=lon,
            FECHA_HORA=ahora_utc
        )
        db.session.add(pos)
        db.session.commit()

        # Emitir la actualización en tiempo real
        socketio.emit("position_update", {
            "ID_VEHICULO": id_vehiculo,
            "LATITUD": lat,
            "LONGITUD": lon,
            "timestamp": ahora_utc.isoformat()
        })

        return jsonify({
            'message': f'Coordenadas recibidas correctamente para vehículo {id_vehiculo}',
            'id_registro': pos.ID_REGISTRO_GPS
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR /gps/tracking] {e}")
        return jsonify({'error': 'Error interno del servidor', 'details': str(e)}), 500


# ---------------- VEHÍCULOS ACTIVOS ----------------
@mapa_bp.route("/vehicles/active", methods=["GET"])
@jwt_required()
def get_active_vehicles():
    """Obtiene vehículos activos en las últimas 2 horas"""
    try:
        two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)

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
                'last_update': position.FECHA_HORA.isoformat(),
                'TIPO': 'VEHICULO' # Útil para el frontend diferenciar íconos
            })

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR /vehicles/active] {e}")
        return jsonify({'error': str(e)}), 500


# ---------------- ÚLTIMA UBICACIÓN DE UN VEHÍCULO ----------------
@mapa_bp.route("/vehicles/<int:id_vehiculo>/location", methods=["GET"])
@jwt_required()
def get_vehicle_location(id_vehiculo):
    """Obtiene la última ubicación registrada de un vehículo específico"""
    try:
        latest_position = PosicionGps.query.filter_by(ID_VEHICULO=id_vehiculo)\
            .order_by(PosicionGps.FECHA_HORA.desc()).first()

        if not latest_position:
            return jsonify({'error': 'No se encontraron registros GPS para este vehículo'}), 404

        vehiculo = Vehiculo.query.get(id_vehiculo)

        # Conversión a hora local Paraguay
        from datetime import timezone, timedelta
        PY_TZ = timezone(timedelta(hours=-3))
        fecha_local = latest_position.FECHA_HORA.astimezone(PY_TZ)

        return jsonify({
            'ID_VEHICULO': id_vehiculo,
            'MATRICULA': vehiculo.MATRICULA if vehiculo else 'Desconocido',
            'LATITUD': float(latest_position.LATITUD),
            'LONGITUD': float(latest_position.LONGITUD),
            'timestamp_utc': latest_position.FECHA_HORA.isoformat(),
            'timestamp_local': fecha_local.isoformat()
        }), 200

    except Exception as e:
        print(f"[ERROR /vehicles/<id>/location] {e}")
        return jsonify({'error': str(e)}), 500


# ---------------- NUEVA RUTA: OBTENER DEPÓSITOS ----------------
@mapa_bp.route("/depositos", methods=["GET"])
@jwt_required()
def get_depositos():
    """
    Obtiene la lista de depósitos con sus coordenadas para mostrarlos 
    como marcadores estáticos en el mapa.
    """
    try:
        depositos = Deposito.query.all()
        result = []

        for dep in depositos:
            # Solo enviamos depósitos que tengan coordenadas configuradas
            if dep.LATITUD and dep.LONGITUD:
                result.append({
                    'ID_DEPOSITO': dep.ID_DEPOSITO,
                    'NOMBRE': dep.NOMBRE,
                    'DIRECCION': getattr(dep, 'DIRECCION', 'Sin dirección'),
                    'LATITUD': float(dep.LATITUD),
                    'LONGITUD': float(dep.LONGITUD),
                    'TIPO': 'DEPOSITO' # Identificador para usar icono de "casa/bodega"
                })

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR /depositos] {e}")
        return jsonify({'error': str(e)}), 500