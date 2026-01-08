# backend/mapa.py
from flask import Blueprint, request, jsonify
from flask_socketio import SocketIO
from datetime import datetime, timezone, timedelta
from flask_jwt_extended import jwt_required, get_jwt_identity # <--- IMPORTANTE: get_jwt_identity
from db import db, Vehiculo, PosicionGps, Deposito, Vale, Usuario # <--- IMPORTANTE: Vale, Usuario

mapa_bp = Blueprint("mapa", __name__)
socketio = SocketIO()

# ---------------- RUTA GPS (Raspberry Pi) ----------------
@mapa_bp.route("/gps/tracking", methods=["POST"])
def receive_gps_data():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No se recibieron datos JSON'}), 400

        id_vehiculo = data.get("ID_VEHICULO")
        lat = data.get("LATITUD")
        lon = data.get("LONGITUD")

        if id_vehiculo is None or lat is None or lon is None:
            return jsonify({'error': 'Datos incompletos'}), 400

        vehiculo = Vehiculo.query.get(id_vehiculo)
        if not vehiculo:
            return jsonify({'error': f'El vehículo {id_vehiculo} no existe'}), 400

        try:
            lat = float(lat)
            lon = float(lon)
        except ValueError:
            return jsonify({'error': 'LATITUD y LONGITUD deben ser numéricos'}), 400

        ahora_utc = datetime.now(timezone.utc)

        pos = PosicionGps(
            ID_VEHICULO=id_vehiculo,
            LATITUD=lat,
            LONGITUD=lon,
            FECHA_HORA=ahora_utc
        )
        db.session.add(pos)
        db.session.commit()

        socketio.emit("position_update", {
            "ID_VEHICULO": id_vehiculo,
            "LATITUD": lat,
            "LONGITUD": lon,
            "timestamp": ahora_utc.isoformat()
        })

        return jsonify({'message': 'OK', 'id_registro': pos.ID_REGISTRO_GPS}), 201

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR /gps/tracking] {e}")
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500


# ---------------- VEHÍCULOS ACTIVOS ----------------
@mapa_bp.route("/vehicles/active", methods=["GET"])
@jwt_required()
def get_active_vehicles():
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
                'TIPO': 'VEHICULO'
            })

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR /vehicles/active] {e}")
        return jsonify({'error': str(e)}), 500


# ---------------- ÚLTIMA UBICACIÓN ----------------
@mapa_bp.route("/vehicles/<int:id_vehiculo>/location", methods=["GET"])
@jwt_required()
def get_vehicle_location(id_vehiculo):
    try:
        latest_position = PosicionGps.query.filter_by(ID_VEHICULO=id_vehiculo)\
            .order_by(PosicionGps.FECHA_HORA.desc()).first()

        if not latest_position:
            return jsonify({'error': 'No se encontraron registros GPS'}), 404

        vehiculo = Vehiculo.query.get(id_vehiculo)
        
        return jsonify({
            'ID_VEHICULO': id_vehiculo,
            'MATRICULA': vehiculo.MATRICULA if vehiculo else 'Desconocido',
            'LATITUD': float(latest_position.LATITUD),
            'LONGITUD': float(latest_position.LONGITUD),
            'timestamp_utc': latest_position.FECHA_HORA.isoformat()
        }), 200

    except Exception as e:
        print(f"[ERROR /vehicles/<id>/location] {e}")
        return jsonify({'error': str(e)}), 500


# ---------------- DEPÓSITOS ----------------
@mapa_bp.route("/depositos", methods=["GET"])
@jwt_required()
def get_depositos():
    try:
        depositos = Deposito.query.all()
        result = []
        for dep in depositos:
            if dep.LATITUD and dep.LONGITUD:
                result.append({
                    'ID_DEPOSITO': dep.ID_DEPOSITO,
                    'NOMBRE': dep.NOMBRE,
                    'DIRECCION': getattr(dep, 'DIRECCION', 'Sin dirección'),
                    'LATITUD': float(dep.LATITUD),
                    'LONGITUD': float(dep.LONGITUD),
                    'TIPO': 'DEPOSITO'
                })
        return jsonify(result), 200
    except Exception as e:
        print(f"[ERROR /depositos] {e}")
        return jsonify({'error': str(e)}), 500


# ---------------- [NUEVO] RUTA ASIGNADA AL CHOFER ----------------
@mapa_bp.route("/chofer/mi_ruta", methods=["GET"])
@jwt_required()
def get_chofer_route():
    """
    Busca los vales asignados al usuario (chofer) que están pendientes o en tránsito
    y devuelve las coordenadas para dibujar la ruta en el mapa.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)
        
        if not usuario or not usuario.empleado:
            return jsonify({"error": "Usuario no es empleado"}), 400

        # Buscamos vales asignados a este chofer que estén Pendientes (1) o En Tránsito (2)
        vales_activos = Vale.query.filter(
            Vale.ID_CHOFER == usuario.empleado.ID_EMPLEADO,
            Vale.ID_ESTADO_VALE.in_([1, 2])
        ).all()

        if not vales_activos:
            return jsonify([]), 200

        # Construimos la estructura para el mapa
        rutas_agrupadas = {}
        
        for vale in vales_activos:
            # Usamos el grupo o el ID individual
            grupo_id = vale.GRUPO_RUTA or f"vale-{vale.ID_VALE}"
            
            if grupo_id not in rutas_agrupadas:
                rutas_agrupadas[grupo_id] = []
            
            # Agregamos el segmento: Origen -> Destino
            # Nota: Si los depósitos no tienen coordenadas, esto fallará, 
            # así que validamos antes.
            if vale.origen.LATITUD and vale.origen.LONGITUD and vale.destino.LATITUD and vale.destino.LONGITUD:
                rutas_agrupadas[grupo_id].append({
                    "lat": vale.origen.LATITUD,
                    "lng": vale.origen.LONGITUD
                })
                rutas_agrupadas[grupo_id].append({
                    "lat": vale.destino.LATITUD,
                    "lng": vale.destino.LONGITUD
                })

        # Formato final para React Leaflet (Array de objetos)
        trayectos_finales = []
        for gid, puntos in rutas_agrupadas.items():
            trayectos_finales.append({
                "id_grupo": gid,
                "puntos": puntos
            })

        return jsonify(trayectos_finales), 200

    except Exception as e:
        print(f"[ERROR /chofer/mi_ruta] {e}")
        return jsonify({'error': str(e)}), 500