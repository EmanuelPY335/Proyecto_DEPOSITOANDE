# backend/mapa.py
from flask import Blueprint, request, jsonify
from flask_socketio import SocketIO
from datetime import datetime, timezone, timedelta
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import func
from db import db, Vehiculo, PosicionGps, Deposito, Vale, Usuario, DetalleVale
from datetime import datetime
from sqlalchemy import or_




mapa_bp = Blueprint("mapa", __name__)
socketio = SocketIO()

def _get_user_deposito_id():
    """
    Devuelve el ID_DEPOSITO del empleado del usuario logueado.
    Si no existe, devuelve None.
    """
    try:
        uid = get_jwt_identity()
        u = Usuario.query.get(uid)
        if not u or not u.empleado:
            return None
        return u.empleado.ID_DEPOSITO
    except Exception:
        return None

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
            Vale.ID_ESTADO_VALE.in_([2])
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
 # ======================================================
# HISTORIAL DE RECORRIDOS FINALIZADOS (AUDITORÍA EN MAPA)
# ======================================================
@mapa_bp.route("/rutas/historial", methods=["GET"])
@jwt_required()
def rutas_historial():
    claims = get_jwt()
    rol = (claims.get("rol_nombre") or "").lower()

    # Solo admins para auditar
    if rol not in ["master_admin", "admin"]:
        return jsonify({"error": "No autorizado"}), 403

    try:
        q = (
            db.session.query(
                Vale.GRUPO_RUTA.label("grupo_ruta"),
                func.min(Vale.FECHA_CREACION).label("inicio"),
                func.max(Vale.FECHA_LLEGADA).label("fin"),
                func.max(Vale.ID_VEHICULO).label("id_vehiculo"),
                func.max(Vale.ID_CHOFER).label("id_chofer"),
                func.max(Vale.ID_ESTADO_VALE).label("estado"),
            )
            .filter(Vale.GRUPO_RUTA != None)
            .filter(Vale.ID_ESTADO_VALE >= 4)   # 4 = finalizado (según tu lógica actual)
            .group_by(Vale.GRUPO_RUTA)
            .order_by(func.max(Vale.FECHA_LLEGADA).desc())
            .limit(100)
            .all()
        )

        res = []
        for r in q:
            res.append({
                "grupo_ruta": r.grupo_ruta,
                "inicio": r.inicio.strftime("%d/%m/%Y %H:%M") if r.inicio else None,
                "fin": r.fin.strftime("%d/%m/%Y %H:%M") if r.fin else None,
                "id_vehiculo": r.id_vehiculo,
                "id_chofer": r.id_chofer,
                "estado": r.estado,
            })

        return jsonify(res), 200

    except Exception as e:
        print("Error rutas_historial:", e)
        return jsonify({"error": str(e)}), 500


# ======================================================
# TRAZA (GPS real si hay) + fallback (ruta planificada)
# ======================================================
@mapa_bp.route("/rutas/historial/<string:grupo_ruta>/traza", methods=["GET"])
@jwt_required()
def ruta_traza(grupo_ruta):
    claims = get_jwt()
    rol = (claims.get("rol_nombre") or "").lower()
    if rol not in ["master_admin", "admin"]:
        return jsonify({"error": "No autorizado"}), 403

    try:
        vales = (
            Vale.query
            .filter_by(GRUPO_RUTA=grupo_ruta)
            .order_by(Vale.FECHA_CREACION.asc())
            .all()
        )
        if not vales:
            return jsonify({"error": "Grupo no encontrado"}), 404

        # Ventana de tiempo del grupo
        inicio = min([v.FECHA_SALIDA for v in vales if v.FECHA_SALIDA] or [None])
        fin = max([v.FECHA_LLEGADA for v in vales if v.FECHA_LLEGADA] or [None])


        id_vehiculo = next((v.ID_VEHICULO for v in vales if v.ID_VEHICULO), None)

        # Ruta planificada (fallback)
        planned_points = []
        if vales[0].origen and vales[0].origen.LATITUD and vales[0].origen.LONGITUD:
            planned_points.append({"lat": float(vales[0].origen.LATITUD), "lng": float(vales[0].origen.LONGITUD)})

        for v in vales:
            if v.destino and v.destino.LATITUD and v.destino.LONGITUD:
                planned_points.append({"lat": float(v.destino.LATITUD), "lng": float(v.destino.LONGITUD)})

        gps_points = []
        if id_vehiculo and inicio:
            gps_q = PosicionGps.query.filter(PosicionGps.ID_VEHICULO == id_vehiculo)
            gps_q = gps_q.filter(PosicionGps.FECHA_HORA >= inicio)
            if fin:
                gps_q = gps_q.filter(PosicionGps.FECHA_HORA <= fin)

            gps_q = gps_q.order_by(PosicionGps.FECHA_HORA.asc()).all()

            for p in gps_q:
                gps_points.append({
                    "lat": float(p.LATITUD),
                    "lng": float(p.LONGITUD),
                    "ts": p.FECHA_HORA.strftime("%d/%m/%Y %H:%M:%S") if p.FECHA_HORA else None
                })

        return jsonify({
            "grupo_ruta": grupo_ruta,
            "id_vehiculo": id_vehiculo,
            "inicio": inicio.strftime("%d/%m/%Y %H:%M") if inicio else None,
            "fin": fin.strftime("%d/%m/%Y %H:%M") if fin else None,
            "gps_points": gps_points,
            "planned_points": planned_points
        }), 200

    except Exception as e:
        print("Error ruta_traza:", e)
        return jsonify({"error": str(e)}), 500

# ======================================================
# TRASLADOS (HISTORIAL PARA MOVIMIENTOS) - TAB NUEVO
# Devuelve: fecha_salida, fecha_entrega, chofer, vehiculo, items_count, etc.
# ======================================================
@mapa_bp.route("/traslados/historial", methods=["GET"])
@jwt_required()
def traslados_historial():
    try:
        claims = get_jwt()
        rol = (claims.get("rol_nombre") or "").lower()

        limit = request.args.get("limit", 100, type=int)
        limit = max(1, min(limit, 300))

        # Si NO es master_admin, filtramos por depósito del usuario
        deposito_user = None
        if rol != "master_admin":
            deposito_user = _get_user_deposito_id()

        q = (
            db.session.query(
                Vale.GRUPO_RUTA.label("grupo_ruta"),
                func.min(Vale.FECHA_SALIDA).label("fecha_salida"),
                func.max(Vale.FECHA_LLEGADA).label("fecha_entrega"),
                func.max(Vale.ID_VALE).label("id_vale_representativo"),
                func.max(Vale.ID_CHOFER).label("id_chofer"),
                func.max(Vale.ID_VEHICULO).label("id_vehiculo"),
                func.count(DetalleVale.ID_DETALLE_VALE).label("items_count"),
            )
            .outerjoin(DetalleVale, DetalleVale.ID_VALE == Vale.ID_VALE)
            .filter(Vale.GRUPO_RUTA != None)
            .filter(Vale.ID_ESTADO_VALE >= 4)
        )

        # ✅ FILTRO POR DEPÓSITO (solo si NO es master_admin)
        # El admin del depósito solo ve rutas donde su depósito es origen o destino.
        if deposito_user is not None:
            q = q.filter(or_(
                Vale.ID_DEPOSITO_ORIGEN == deposito_user,
                Vale.ID_DEPOSITO_DESTINO == deposito_user
            ))

        q = (
            q.group_by(Vale.GRUPO_RUTA)
             .order_by(func.max(Vale.FECHA_LLEGADA).desc())
             .limit(limit)
             .all()
        )

        res = []
        for r in q:
            vale_rep = Vale.query.get(r.id_vale_representativo)

            chofer_str = ""
            vehiculo_str = ""
            origen_str = ""
            destino_str = ""

            if vale_rep:
                if vale_rep.chofer:
                    chofer_str = f"{vale_rep.chofer.NOMBRE} {vale_rep.chofer.APELLIDO}"
                if vale_rep.vehiculo:
                    vehiculo_str = f"{vale_rep.vehiculo.MARCA} - {vale_rep.vehiculo.MATRICULA}"
                if vale_rep.origen:
                    origen_str = vale_rep.origen.NOMBRE
                if vale_rep.destino:
                    destino_str = vale_rep.destino.NOMBRE

            res.append({
                "grupo_ruta": r.grupo_ruta,
                "id_vale": r.id_vale_representativo,
                "fecha_salida": r.fecha_salida.strftime("%d/%m/%Y %H:%M") if r.fecha_salida else None,
                "fecha_entrega": r.fecha_entrega.strftime("%d/%m/%Y %H:%M") if r.fecha_entrega else None,
                "chofer": chofer_str,
                "vehiculo": vehiculo_str,
                "origen": origen_str,
                "destino": destino_str,
                "items_count": int(r.items_count or 0),
            })

        return jsonify(res), 200

    except Exception as e:
        print("Error traslados_historial:", e)
        return jsonify({"error": str(e)}), 500



# ======================================================
# DETALLE DE TRASLADO (PARA PDF)
# Devuelve meta + items reales (material, lote, cantidad, unidad)
# ======================================================
@mapa_bp.route("/traslados/<int:id_vale>/detalle", methods=["GET"])
@jwt_required()
def traslado_detalle(id_vale):
    try:
        claims = get_jwt()
        rol = (claims.get("rol_nombre") or "").lower()

        vale = Vale.query.get(id_vale)
        if not vale:
            return jsonify({"error": "Vale no encontrado"}), 404

        # Si NO es master_admin, verificamos que el vale "interactúe" con su depósito
        if rol != "master_admin":
            deposito_user = _get_user_deposito_id()
            if deposito_user is not None:
                # Permitido si el vale es origen o destino del depósito del usuario
                if not (vale.ID_DEPOSITO_ORIGEN == deposito_user or vale.ID_DEPOSITO_DESTINO == deposito_user):
                    return jsonify({"error": "No autorizado"}), 403

        grupo = vale.GRUPO_RUTA
        if grupo:
            vales = Vale.query.filter_by(GRUPO_RUTA=grupo).order_by(Vale.FECHA_CREACION.asc()).all()
        else:
            vales = [vale]

        v0 = vales[0]
        vN = vales[-1]

        chofer_str = f"{v0.chofer.NOMBRE} {v0.chofer.APELLIDO}" if v0.chofer else ""
        vehiculo_str = f"{v0.vehiculo.MARCA} - {v0.vehiculo.MATRICULA}" if v0.vehiculo else ""

        items = []
        for v in vales:
            for det in (v.detalles or []):
                material = det.material.NOMBRE if det.material else ""
                unidad = det.material.UNIDAD_MEDIDA if (det.material and det.material.UNIDAD_MEDIDA) else "Unid."
                lote_codigo = det.lote.CODIGO if (det.lote and det.lote.CODIGO) else ""
                items.append({
                    "codigo": lote_codigo,
                    "material": material,
                    "lote": lote_codigo,
                    "cantidad": float(det.CANTIDAD_SOLICITADA or 0),
                    "unidad": unidad
                })

        return jsonify({
            "meta": {
                "id_vale": vale.ID_VALE,
                "grupo_ruta": grupo or f"vale-{vale.ID_VALE}",
                "fecha_salida": (v0.FECHA_SALIDA.isoformat() if v0.FECHA_SALIDA else None),
                "fecha_entrega": (vN.FECHA_LLEGADA.isoformat() if vN.FECHA_LLEGADA else None),
                "origen": v0.origen.NOMBRE if v0.origen else "",
                "destino": vN.destino.NOMBRE if vN.destino else "",
                "chofer": chofer_str,
                "vehiculo": vehiculo_str,
            },
            "items": items
        }), 200

    except Exception as e:
        print("Error traslado_detalle:", e)
        return jsonify({"error": str(e)}), 500

# ======================================================
# POLYLINE POR VALE (GPS real + fallback plan)
# ======================================================


@mapa_bp.route("/movimientos_ruta/<int:id_vale>/polyline", methods=["GET"])
@jwt_required()
def get_polyline_vale(id_vale):
    vale = Vale.query.get(id_vale)
    claims = get_jwt()
    rol = (claims.get("rol_nombre") or "").lower()

    if rol != "master_admin":
        deposito_user = _get_user_deposito_id()
        if deposito_user is not None:
            if not (vale.ID_DEPOSITO_ORIGEN == deposito_user or vale.ID_DEPOSITO_DESTINO == deposito_user):
                return jsonify({"error": "No autorizado"}), 403

    if not vale:
        return jsonify({"error": "Vale no encontrado"}), 404

    # Puntos planificados (si no hay gps)
    plan = _plan_points(vale)

    # Si no tiene salida, todavía no hay ventana de GPS
    if not vale.FECHA_SALIDA:
        return jsonify({"gps": [], "plan": plan, "meta": {
            "id_vale": vale.ID_VALE,
            "grupo": vale.GRUPO_RUTA,
            "vehiculo_id": vale.ID_VEHICULO,
            "fecha_salida": None,
            "fecha_llegada": None,
        }}), 200

    t0 = vale.FECHA_SALIDA
    t1 = vale.FECHA_LLEGADA or datetime.now()

    puntos = (
        PosicionGps.query
        .filter(PosicionGps.ID_VEHICULO == vale.ID_VEHICULO)
        .filter(PosicionGps.FECHA_HORA >= t0)
        .filter(PosicionGps.FECHA_HORA <= t1)
        .order_by(PosicionGps.FECHA_HORA.asc())
        .all()
    )

    gps_points = [{
        "lat": float(p.LATITUD),
        "lng": float(p.LONGITUD),
        "t": p.FECHA_HORA.isoformat() if p.FECHA_HORA else None
    } for p in puntos]

    return jsonify({
        "gps": gps_points,
        "plan": plan,
        "meta": {
            "id_vale": vale.ID_VALE,
            "grupo": vale.GRUPO_RUTA,
            "vehiculo_id": vale.ID_VEHICULO,
            "fecha_salida": vale.FECHA_SALIDA.isoformat() if vale.FECHA_SALIDA else None,
            "fecha_llegada": vale.FECHA_LLEGADA.isoformat() if vale.FECHA_LLEGADA else None,
        }
    }), 200


def _plan_points(vale):
    pts = []
    if vale.origen and vale.origen.LATITUD and vale.origen.LONGITUD:
        pts.append({"lat": float(vale.origen.LATITUD), "lng": float(vale.origen.LONGITUD)})
    if vale.destino and vale.destino.LATITUD and vale.destino.LONGITUD:
        pts.append({"lat": float(vale.destino.LATITUD), "lng": float(vale.destino.LONGITUD)})
    return pts
