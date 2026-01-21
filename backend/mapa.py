# backend/mapa.py
from flask import Blueprint, request, jsonify
from flask_socketio import SocketIO
from datetime import datetime, timezone, timedelta
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Vehiculo, PosicionGps, Deposito, Vale, Usuario

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
        # 1. Traemos TODOS los vehículos registrados en el sistema
        # (Esto asegura que aparezcan los que insertaste por SQL manualmente)
        vehiculos = Vehiculo.query.all()
        
        result = []
        
        for v in vehiculos:
            # --- A. OBTENER ESTADO Y COLOR (Desde la nueva relación) ---
            nombre_estado = "Desconocido"
            color_estado = "#808080" # Gris por defecto si falla algo
            
            # Verificamos si existe la relación con la tabla estado_vehiculo
            if hasattr(v, 'estado_rel') and v.estado_rel:
                nombre_estado = v.estado_rel.NOMBRE
                color_estado = v.estado_rel.COLOR_HEX or "#808080"
            
            # --- B. DETERMINAR COORDENADAS (Lógica Híbrida) ---
            # Por defecto, usamos la coordenada 'estática' guardada en la tabla Vehículo
            lat = v.LATITUD
            lng = v.LONGITUD
            
            # Pero, si el vehículo tiene rastreo GPS real (ej: Raspberry), buscamos su última posición
            # Esto sobreescribe la posición estática con la real en vivo
            last_gps = PosicionGps.query.filter_by(ID_VEHICULO=v.ID_VEHICULO)\
                                        .order_by(PosicionGps.FECHA_HORA.desc())\
                                        .first()
            
            if last_gps:
                # Opcional: Podrías poner un límite de tiempo aquí (ej: si el GPS es de hace 1 año, ignorarlo)
                # Por ahora, usamos siempre el GPS si existe.
                lat = float(last_gps.LATITUD)
                lng = float(last_gps.LONGITUD)

            # --- C. CONSTRUIR RESPUESTA ---
            # Solo agregamos a la lista si tiene coordenadas válidas
           # ✅ BIEN
            if lat is not None and lng is not None:
                nombre_chofer_str = "Sin Chofer"
                if hasattr(v, 'chofer') and v.chofer:
                    nombre_chofer_str = f"{v.chofer.NOMBRE} {v.chofer.APELLIDO}"
                result.append({
                    'ID_VEHICULO': v.ID_VEHICULO,
                    'MATRICULA': v.MATRICULA,
                    'MODELO': getattr(v, 'MODELO', ''), # getattr evita error si columna no existe
                    'MARCA': getattr(v, 'MARCA', ''),
                    'NOMBRE_CHOFER': nombre_chofer_str,
                    
                    # Datos vitales para el mapa nuevo
                    'ESTADO': nombre_estado,
                    'COLOR_ESTADO': color_estado, 
                    
                    # Coordenadas finales (Estáticas o GPS)
                    'LATITUD': float(lat),
                    'LONGITUD': float(lng),
                    'TIPO': 'VEHICULO'
                })

        return jsonify(result), 200

    except Exception as e:
        print(f"❌ [ERROR /vehicles/active] {e}")
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


# ---------------- DEPÓSITOS (ACTUALIZADO CON DEPARTAMENTO) ----------------
@mapa_bp.route("/depositos", methods=["GET"])
@jwt_required()
def get_depositos():
    try:
        depositos = Deposito.query.all()
        result = []
        for dep in depositos:
            if dep.LATITUD and dep.LONGITUD:
                
                # --- AQUÍ ESTÁ EL CAMBIO CLAVE ---
                # Obtenemos el nombre del departamento a través de la relación
                nombre_depto = "Sin asignar"
                if dep.departamento_rel:
                    nombre_depto = dep.departamento_rel.departamento
                # ---------------------------------

                result.append({
                    'ID_DEPOSITO': dep.ID_DEPOSITO,
                    'NOMBRE': dep.NOMBRE,
                    'DIRECCION': getattr(dep, 'DIRECCION', 'Sin dirección'),
                    'DEPARTAMENTO': nombre_depto, # <--- Enviamos este campo al Frontend
                    'LATITUD': float(dep.LATITUD),
                    'LONGITUD': float(dep.LONGITUD),
                    'TIPO': 'DEPOSITO'
                })
        return jsonify(result), 200
    except Exception as e:
        print(f"[ERROR /depositos] {e}")
        return jsonify({'error': str(e)}), 500


# ---------------- RUTA ASIGNADA AL CHOFER ----------------
@mapa_bp.route("/chofer/mi_ruta", methods=["GET"])
@jwt_required()
def get_chofer_route():
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

        rutas_agrupadas = {}
        
        for vale in vales_activos:
            grupo_id = vale.GRUPO_RUTA or f"vale-{vale.ID_VALE}"
            
            if grupo_id not in rutas_agrupadas:
                rutas_agrupadas[grupo_id] = []
            
            if vale.origen.LATITUD and vale.origen.LONGITUD and vale.destino.LATITUD and vale.destino.LONGITUD:
                rutas_agrupadas[grupo_id].append({
                    "lat": vale.origen.LATITUD,
                    "lng": vale.origen.LONGITUD
                })
                rutas_agrupadas[grupo_id].append({
                    "lat": vale.destino.LATITUD,
                    "lng": vale.destino.LONGITUD
                })

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