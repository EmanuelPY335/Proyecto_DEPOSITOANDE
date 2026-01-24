from importlib.resources import simple
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from flask_cors import cross_origin
from datetime import datetime
import uuid

from sqlalchemy import func, distinct
from sqlalchemy.orm import aliased

# Importamos todos los modelos necesarios
from db import (
    db, Vale, DetalleVale, Notificacion, Usuario, Vehiculo, OrdenTrabajo, Empleado,
    SolicitudStock, Inventario, MovimientoMaterial, Lote, EstadoVale, Deposito
)


vales_bp = Blueprint("vales", __name__)

# ==========================================
# FUNCIONES AUXILIARES
# ==========================================

def get_id_estado_vale_anulado():
    """
    Busca el estado 'Anulado' usando el nombre correcto de la columna (estado_vale)
    Si no existe, lo crea para evitar errores de llave foránea.
    """
    # Usamos 'estado_vale' (minúsculas) según tu db.py
    estado = EstadoVale.query.filter(EstadoVale.estado_vale.ilike('Anulado')).first()
    
    if not estado:
        print("El estado 'Anulado' no existe. Creándolo...")
        estado = EstadoVale()
        estado.estado_vale = "Anulado" # Asignación explícita
        
        # Aseguramos que el ID sea None para que actúe el Auto-Increment
        if hasattr(estado, 'ID_ESTADO_VALE'):
            estado.ID_ESTADO_VALE = None

        db.session.add(estado)
        db.session.commit()
        print(f"Estado 'Anulado' creado con ID: {estado.ID_ESTADO_VALE}")
    
    return estado.ID_ESTADO_VALE

def descontar_stock_salida(vale, user_id):
    empleado = Usuario.query.get(user_id).empleado
    
    for det in vale.detalles:
        inv = Inventario.query.filter_by(ID_LOTE=det.ID_LOTE, ID_DEPOSITO=vale.ID_DEPOSITO_ORIGEN).first()
        
        if inv and inv.CANTIDAD_ACTUAL >= det.CANTIDAD_SOLICITADA:
            inv.CANTIDAD_ACTUAL -= det.CANTIDAD_SOLICITADA
            
            mov = MovimientoMaterial(
                ID_TIPO_MOVIMIENTO=2, # Salida
                ID_EMPLEADO=empleado.ID_EMPLEADO if empleado else None,
                ID_DEPOSITO=vale.ID_DEPOSITO_ORIGEN,
                ID_LOTE=det.ID_LOTE,
                ID_VALE=vale.ID_VALE,
                CANTIDAD=-(det.CANTIDAD_SOLICITADA),
                OBSERVACIONES="Salida por traslado (Aprobado)"
            )
            db.session.add(mov)
        else:
            raise Exception(f"Stock insuficiente en origen para el lote {det.ID_LOTE}")

def sumar_stock_destino(vale, user_id):
    empleado = Usuario.query.get(user_id).empleado

    for det in vale.detalles:
        inv_dest = Inventario.query.filter_by(ID_LOTE=det.ID_LOTE, ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO).first()
        
        if not inv_dest:
            inv_dest = Inventario(
                ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO,
                ID_LOTE=det.ID_LOTE,
                ID_ESTADO_INVENTARIO=1,
                CANTIDAD_ACTUAL=0
            )
            db.session.add(inv_dest)
        
        inv_dest.CANTIDAD_ACTUAL += det.CANTIDAD_SOLICITADA

        mov = MovimientoMaterial(
            ID_TIPO_MOVIMIENTO=1, # Entrada
            ID_EMPLEADO=empleado.ID_EMPLEADO if empleado else None,
            ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO,
            ID_LOTE=det.ID_LOTE,
            ID_VALE=vale.ID_VALE,
            CANTIDAD=det.CANTIDAD_SOLICITADA,
            OBSERVACIONES="Entrada por traslado (Recepción)"
        )
        db.session.add(mov)

def notificar_chofer(id_chofer_empleado, grupo_ruta):
    usuario_chofer = Usuario.query.filter_by(ID_EMPLEADO=id_chofer_empleado).first()
    if usuario_chofer:
        noti = Notificacion(
            ID_USUARIO=usuario_chofer.ID_USUARIO,
            MENSAJE=f"🚚 Ruta Lista {grupo_ruta}. ¡Ya puedes iniciar el viaje!",
            LEIDA=False,
            FECHA_CREACION=datetime.now(),
            ID_ORDEN=None, 
        )
        db.session.add(noti)

# ==========================================
# RUTAS (ENDPOINTS)
# ==========================================

@vales_bp.route("/vehiculos/simple", methods=["GET"])
@jwt_required()
def get_vehiculos():
    try:
        vehiculos = Vehiculo.query.all()
        resultado = []
        for v in vehiculos:
            resultado.append({
                "id": v.ID_VEHICULO,
                "nombre": f"{v.MARCA} {v.MODELO} ({v.MATRICULA})"
            })
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@vales_bp.route("/vales", methods=["POST"])
@jwt_required()
def crear_vale():
    data = request.json or {}
    current_user_id = get_jwt_identity()

    usuario = Usuario.query.get(current_user_id)
    if not usuario:
        return jsonify({"error": "Usuario no identificado"}), 403

    try:
        route_group_id = f"R-{uuid.uuid4().hex[:8].upper()}"

        stops = data.get("stops") or []
        if not stops:
            return jsonify({"error": "La ruta debe tener al menos una parada"}), 400

        # ✅ Validaciones fuertes (por tu modelo nullable=False)
        id_origen = data.get("id_origen")
        id_chofer = data.get("id_chofer")
        id_vehiculo = data.get("id_vehiculo")

        if not id_origen:
            return jsonify({"error": "Falta id_origen"}), 400
        if not id_chofer:
            return jsonify({"error": "Falta id_chofer"}), 400
        if not id_vehiculo:
            return jsonify({"error": "Falta id_vehiculo"}), 400

        # ✅ estado inicial
        es_admin = usuario.rol and usuario.rol.NOMBRE_ROL in ["Master_Admin", "Admin"]
        estado_inicial = 2 if es_admin else 1  # 2 = Aprobado salida directo, 1 = Pendiente

        created_vales = []
        solicitudes_a_actualizar = set()  # opcional, si llega id_solicitud

        for stop in stops:
            id_destino = stop.get("id_destino")
            items = stop.get("items") or []

            if not id_destino:
                return jsonify({"error": "Una parada no tiene id_destino"}), 400
            if not items:
                return jsonify({"error": "Una parada no tiene items"}), 400

            nuevo_vale = Vale(
                ID_USUARIO_CREADOR=current_user_id,
                ID_DEPOSITO_ORIGEN=int(id_origen),
                ID_DEPOSITO_DESTINO=int(id_destino),

                ID_CHOFER=int(id_chofer),
                ID_VEHICULO=int(id_vehiculo),

                FECHA_CREACION=datetime.now(),
                FECHA_SALIDA=datetime.now() if estado_inicial == 2 else None,
                ID_ESTADO_VALE=estado_inicial,
                OBSERVACIONES=data.get("observacion", ""),
                GRUPO_RUTA=route_group_id
            )

            if estado_inicial == 2:
                nuevo_vale.ID_USUARIO_APROBADOR_SALIDA = current_user_id

            db.session.add(nuevo_vale)
            db.session.flush()  # para obtener ID_VALE

            for item in items:
                # Validación item
                if not item.get("id_lote") or not item.get("id_material") or item.get("cantidad") is None:
                    return jsonify({"error": "Item incompleto (id_lote, id_material, cantidad)"}), 400

                detalle = DetalleVale(
                    ID_VALE=nuevo_vale.ID_VALE,
                    ID_LOTE=int(item["id_lote"]),
                    ID_MATERIAL=int(item["id_material"]),
                    CANTIDAD_SOLICITADA=float(item["cantidad"])
                )
                db.session.add(detalle)

                # ✅ Opcional: si el frontend manda id_solicitud en el item
                if item.get("id_solicitud"):
                    solicitudes_a_actualizar.add(int(item["id_solicitud"]))

            created_vales.append(nuevo_vale)

        # ✅ Si querés marcar solicitudes como “en proceso” (solo si llega id_solicitud)
        # (Ajustá el estado según tu tabla: 2/3/etc.)
        if solicitudes_a_actualizar:
            for sid in solicitudes_a_actualizar:
                solicitud = SolicitudStock.query.get(sid)
                if solicitud:
                    solicitud.ID_ESTADO = 3  # ejemplo: 3 = Completado/Atendido (ajusta a tu sistema)

        # ✅ Si queda aprobado directo: descontar stock + notificar chofer
        if estado_inicial == 2:
            for vale in created_vales:
                descontar_stock_salida(vale, current_user_id)
            notificar_chofer(int(id_chofer), route_group_id)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Ruta generada." + (" Aprobada." if estado_inicial == 2 else " Pendiente de aprobación."),
            "grupo_ruta": route_group_id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creando vale: {str(e)}")
        return jsonify({"error": str(e)}), 500


@vales_bp.route("/vales/<int:id_vale>/asignar", methods=["PUT"])
@jwt_required()
def asignar_chofer_vale(id_vale):
    data = request.json
    id_chofer = data.get("id_chofer")
    id_vehiculo = data.get("id_vehiculo")

    if not id_chofer or not id_vehiculo:
        return jsonify({"error": "Faltan datos de asignación"}), 400

    try:
        vale = Vale.query.get(id_vale)
        if not vale: return jsonify({"error": "Vale no encontrado"}), 404

        vale.ID_CHOFER = id_chofer
        vale.ID_VEHICULO = id_vehiculo
        
        if vale.ID_ESTADO_VALE == 2:
             notificar_chofer(id_chofer, vale.GRUPO_RUTA or f"#{vale.ID_VALE}")

        db.session.commit()
        return jsonify({"success": True, "message": "Asignación completada"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@vales_bp.route("/vales/<int:id_vale>/aprobar_salida", methods=["PUT"])
@jwt_required()
def aprobar_salida(id_vale):
    current_user_id = get_jwt_identity()
    vale = Vale.query.get(id_vale)
    
    if not vale: return jsonify({"error": "Vale no encontrado"}), 404
    if vale.ID_ESTADO_VALE != 1: return jsonify({"error": "El vale no está pendiente"}), 400

    try:
        if not vale.ID_CHOFER:
            return jsonify({"error": "Debes asignar un Chofer antes de aprobar la salida."}), 400

        vale.ID_ESTADO_VALE = 2 
        vale.ID_USUARIO_APROBADOR_SALIDA = current_user_id
        vale.FECHA_SALIDA = datetime.now()

        descontar_stock_salida(vale, current_user_id)
        notificar_chofer(vale.ID_CHOFER, vale.GRUPO_RUTA)

        db.session.commit()
        return jsonify({"success": True, "message": "Salida aprobada."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al aprobar: {str(e)}"}), 500

@vales_bp.route("/vales/<int:id_vale>/rechazar", methods=["PUT"])
@cross_origin()
@jwt_required()
def rechazar_vale(id_vale):
    data = request.json
    motivo = data.get('motivo', 'Sin motivo especificado')
    
    vale = Vale.query.get(id_vale)
    
    if not vale: return jsonify({"error": "Vale no encontrado"}), 404
    if vale.ID_ESTADO_VALE != 1: return jsonify({"error": "El vale no está en estado pendiente"}), 400

    try:
        # Usamos la función auxiliar corregida
        id_anulado = get_id_estado_vale_anulado()
        
        vale.ID_ESTADO_VALE = id_anulado
        
        obs_actual = vale.OBSERVACIONES or ""
        vale.OBSERVACIONES = f"{obs_actual} | [ANULADO]: {motivo}".strip()
        
        usuario_creador = Usuario.query.get(vale.ID_USUARIO_CREADOR)
        if usuario_creador:
            noti = Notificacion(
                ID_USUARIO=usuario_creador.ID_USUARIO,
                MENSAJE=f"❌ Vale #{vale.ID_VALE} ANULADO. Motivo: {motivo}",
                LEIDA=False,
                FECHA_CREACION=datetime.now(),
                ID_ORDEN=None
            )
            db.session.add(noti)

        db.session.commit()
        return jsonify({"success": True, "message": "Vale anulado correctamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al rechazar vale: {e}")
        return jsonify({"error": f"Error al rechazar: {str(e)}"}), 500

@vales_bp.route("/vales/<int:id_vale>/confirmar_recepcion", methods=["PUT"])
@jwt_required()
def confirmar_recepcion(id_vale):
    current_user_id = get_jwt_identity()
    vale = Vale.query.get(id_vale)
    
    if not vale: return jsonify({"error": "Vale no encontrado"}), 404
    if vale.ID_ESTADO_VALE >= 4: return jsonify({"error": "Este vale ya fue finalizado"}), 400

    try:
        vale.ID_ESTADO_VALE = 4
        vale.ID_USUARIO_RECEPTOR = current_user_id
        vale.FECHA_LLEGADA = datetime.now()

        sumar_stock_destino(vale, current_user_id)

        db.session.commit()
        return jsonify({"success": True, "message": "Recepción confirmada."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al recepcionar: {str(e)}"}), 500

@vales_bp.route("/solicitudes/pendientes", methods=["GET"])
@jwt_required()
def get_solicitudes_pendientes():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    modo = request.args.get('modo', 'pendientes')

    try:
        query = SolicitudStock.query
        
        if usuario.empleado and usuario.empleado.ID_DEPOSITO:
            mi_deposito_id = usuario.empleado.ID_DEPOSITO
            query = query.filter_by(ID_DEPOSITO_PROVEEDOR=mi_deposito_id)
        
        if modo == 'pendientes':
            query = query.filter_by(ID_ESTADO=1)

        solicitudes = query.order_by(SolicitudStock.FECHA_SOLICITUD.desc()).limit(50).all()
        
        resultado = []
        for s in solicitudes:
            nombre_estado = {1:"Pendiente", 2:"En Proceso", 3:"Completado", 4:"Rechazado"}.get(s.ID_ESTADO, "Desconocido")
            
            resultado.append({
                "id_solicitud": s.ID_SOLICITUD,
                "deposito_solicitante": s.dep_solicitante.NOMBRE if s.dep_solicitante else "Desconocido",
                "id_destino": s.ID_DEPOSITO_SOLICITANTE,
                "solicitante_usuario": f"{s.usuario.empleado.NOMBRE} {s.usuario.empleado.APELLIDO}" if s.usuario and s.usuario.empleado else "Usuario",
                "material": s.material.NOMBRE if s.material else "Material",
                "id_material": s.ID_MATERIAL,
                "cantidad": s.CANTIDAD,
                "fecha": s.FECHA_SOLICITUD.strftime('%d/%m/%Y %H:%M'),
                "observacion": s.OBSERVACION,
                "estado": nombre_estado,
                "id_estado": s.ID_ESTADO
            })
            
        return jsonify(resultado), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@vales_bp.route("/vales/pendientes", methods=["GET"])
@jwt_required()
def get_vales_pendientes():
    # Obtener vales en estado 1 (Pendiente Aprobación)
    vales = Vale.query.filter_by(ID_ESTADO_VALE=1).all()
    res = []
    for v in vales:
        nombre_chofer = f"{v.chofer.NOMBRE} {v.chofer.APELLIDO}" if v.chofer else "Sin Asignar"
        matricula_vehiculo = v.vehiculo.MATRICULA if v.vehiculo else "Sin Asignar"

        res.append({
            "id": v.ID_VALE,
            "fecha": v.FECHA_CREACION.strftime('%d/%m %H:%M'),
            "destino": v.destino.NOMBRE if v.destino else "Desconocido",
            "chofer": nombre_chofer,
            "vehiculo": matricula_vehiculo,
            "origen": v.origen.NOMBRE if v.origen else "Desconocido", 
            "detalles": [
                {
                    "codigo": d.material.CODIGO_UNICO, 
                    "material": d.material.NOMBRE, 
                    "unidad": d.material.UNIDAD_MEDIDA, # <--- ¡ESTO FALTABA!
                    "lote": d.lote.CODIGO, 
                    "cantidad": d.CANTIDAD_SOLICITADA
                } 
                for d in v.detalles
            ]
        })
    return jsonify(res), 200

@vales_bp.route("/traslados/historial", methods=["GET"])
@jwt_required()
def get_historial_traslados():
    """
    Historial de traslados agrupado por GRUPO_RUTA.
    Devuelve:
      grupo_ruta, fecha_salida(min), fecha_llegada(max),
      chofer, vehiculo, items_count(sum detalles),
      id_vale_ref, origen/destino (resumen)
    Query params opcionales:
      - limit=100
      - estado_min=2
      - solo_finalizados=0|1  (si es 1 => estado_min=4 por defecto)
    """
    claims = get_jwt()
    sub = claims.get("sub")
    user_id = int(sub) if sub is not None else int(get_jwt_identity())

    rol = (claims.get("rol_nombre") or "").strip()
    rol_low = rol.lower()

    limit = int(request.args.get("limit", 100))
    solo_finalizados = str(request.args.get("solo_finalizados", "0")).lower() in ("1", "true", "yes", "si")
    estado_min_default = 4 if solo_finalizados else 2
    estado_min = int(request.args.get("estado_min", estado_min_default))

    usuario = Usuario.query.get(user_id)
    deposito_id_user = usuario.empleado.ID_DEPOSITO if (usuario and usuario.empleado) else None
    chofer_id_user = usuario.empleado.ID_EMPLEADO if (usuario and usuario.empleado) else None

    # --- Seguridad por rol (similar a movimientos.py) ---
    # master/admin ven todo
    es_admin = rol_low in ("master_admin", "admin", "administrador", "gerente", "it_support")

    try:
        # Subqueries para obtener ORIGEN del primer vale del grupo y DESTINO del último vale del grupo
        sub_min_fc = (
            db.session.query(
                Vale.GRUPO_RUTA.label("grupo"),
                func.min(Vale.FECHA_CREACION).label("min_fc")
            )
            .filter(Vale.GRUPO_RUTA != None)
            .group_by(Vale.GRUPO_RUTA)
            .subquery()
        )

        sub_max_fc = (
            db.session.query(
                Vale.GRUPO_RUTA.label("grupo"),
                func.max(Vale.FECHA_CREACION).label("max_fc")
            )
            .filter(Vale.GRUPO_RUTA != None)
            .group_by(Vale.GRUPO_RUTA)
            .subquery()
        )

        v_first = aliased(Vale)
        v_last = aliased(Vale)
        dep_or = aliased(Deposito)
        dep_de = aliased(Deposito)

        q = (
            db.session.query(
                Vale.GRUPO_RUTA.label("grupo_ruta"),

                func.min(Vale.FECHA_SALIDA).label("fecha_salida"),
                func.max(Vale.FECHA_LLEGADA).label("fecha_llegada"),

                func.min(Vale.ID_VALE).label("id_vale_ref"),
                func.max(Vale.ID_VEHICULO).label("id_vehiculo"),
                func.max(Vale.ID_CHOFER).label("id_chofer"),
                func.max(Vale.ID_ESTADO_VALE).label("estado_id"),

                func.count(distinct(Vale.ID_VALE)).label("vales_count"),
                func.count(DetalleVale.ID_DETALLE_VALE).label("items_count"),

                dep_or.NOMBRE.label("origen"),
                dep_de.NOMBRE.label("destino"),
            )
            .outerjoin(DetalleVale, DetalleVale.ID_VALE == Vale.ID_VALE)
            .join(sub_min_fc, sub_min_fc.c.grupo == Vale.GRUPO_RUTA)
            .join(v_first, (v_first.GRUPO_RUTA == sub_min_fc.c.grupo) & (v_first.FECHA_CREACION == sub_min_fc.c.min_fc))
            .outerjoin(dep_or, dep_or.ID_DEPOSITO == v_first.ID_DEPOSITO_ORIGEN)
            .join(sub_max_fc, sub_max_fc.c.grupo == Vale.GRUPO_RUTA)
            .join(v_last, (v_last.GRUPO_RUTA == sub_max_fc.c.grupo) & (v_last.FECHA_CREACION == sub_max_fc.c.max_fc))
            .outerjoin(dep_de, dep_de.ID_DEPOSITO == v_last.ID_DEPOSITO_DESTINO)
            .filter(Vale.GRUPO_RUTA != None)
            .filter(Vale.ID_ESTADO_VALE >= estado_min)
        )

        # Filtros por rol
        if rol_low == "chofer":
            if not chofer_id_user:
                return jsonify({"error": "Usuario no vinculado a empleado/chofer"}), 400
            q = q.filter(Vale.ID_CHOFER == chofer_id_user)
        elif not es_admin:
            # usuarios normales ven solo lo que toca su depósito
            if not deposito_id_user:
                return jsonify({"error": "Usuario no vinculado a un depósito"}), 400
            q = q.filter(
                (Vale.ID_DEPOSITO_ORIGEN == deposito_id_user) |
                (Vale.ID_DEPOSITO_DESTINO == deposito_id_user)
            )

        q = (
            q.group_by(Vale.GRUPO_RUTA, dep_or.NOMBRE, dep_de.NOMBRE)
             .order_by(func.max(Vale.FECHA_CREACION).desc())
             .limit(limit)
        )

        rows = q.all()

        # Cache para evitar N+1 pesado
        chofer_cache = {}
        vehiculo_cache = {}

        res = []
        for r in rows:
            id_chofer = int(r.id_chofer) if r.id_chofer is not None else None
            id_vehiculo = int(r.id_vehiculo) if r.id_vehiculo is not None else None

            # Chofer
            chofer_txt = "Sin Asignar"
            if id_chofer:
                if id_chofer not in chofer_cache:
                    c = Empleado.query.get(id_chofer)
                    chofer_cache[id_chofer] = f"{c.NOMBRE} {c.APELLIDO}" if c else "Sin Asignar"
                chofer_txt = chofer_cache[id_chofer]

            # Vehículo
            vehiculo_txt = "N/A"
            if id_vehiculo:
                if id_vehiculo not in vehiculo_cache:
                    v = Vehiculo.query.get(id_vehiculo)
                    if v:
                        marca = getattr(v, "MARCA", "") or ""
                        matricula = getattr(v, "MATRICULA", "") or ""
                        vehiculo_cache[id_vehiculo] = f"{marca} ({matricula})".strip()
                    else:
                        vehiculo_cache[id_vehiculo] = "N/A"
                vehiculo_txt = vehiculo_cache[id_vehiculo]

            fecha_salida = r.fecha_salida.strftime("%d/%m/%Y %H:%M") if r.fecha_salida else None
            fecha_llegada = r.fecha_llegada.strftime("%d/%m/%Y %H:%M") if r.fecha_llegada else None

            res.append({
                "grupo_ruta": r.grupo_ruta,
                "fecha_salida": fecha_salida,
                "fecha_llegada": fecha_llegada,
                "chofer": chofer_txt,
                "vehiculo": vehiculo_txt,
                "items_count": int(r.items_count or 0),
                "vales_count": int(r.vales_count or 0),
                "id_vale_ref": int(r.id_vale_ref) if r.id_vale_ref else None,
                "origen": r.origen or "N/A",
                "destino": r.destino or "N/A",
                "estado_id": int(r.estado_id) if r.estado_id else None,
            })

        return jsonify(res), 200

    except Exception as e:
        print("❌ Error get_historial_traslados:", e)
        return jsonify({"error": str(e)}), 500
