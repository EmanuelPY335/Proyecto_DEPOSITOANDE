# backend/vales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from flask_cors import cross_origin
from datetime import datetime
import uuid

from sqlalchemy import func, distinct
from sqlalchemy.orm import aliased, joinedload

from db import (
    db,
    Vale,
    DetalleVale,
    Notificacion,
    Usuario,
    Vehiculo,
    Empleado,
    SolicitudStock,
    Inventario,
    MovimientoMaterial,
    EstadoVale,
    Deposito,
)


vales_bp = Blueprint("vales", __name__)

# ==========================================
# FUNCIONES AUXILIARES
# ==========================================
def _recepcion_ya_aplicada(id_vale: int) -> bool:
    """
    ✅ Idempotencia real:
    Si ya existe un MovimientoMaterial de ENTRADA (tipo=1) asociado a este vale,
    asumimos que el stock ya fue sumado al destino y NO repetimos la operación.
    """
    try:
        q = db.session.query(MovimientoMaterial).filter(
            MovimientoMaterial.ID_VALE == int(id_vale),
            MovimientoMaterial.ID_TIPO_MOVIMIENTO == 1
        )
        return q.first() is not None
    except Exception as e:
        print("⚠️ _recepcion_ya_aplicada error:", e)
        return False

def _get_usuario_actual():
    uid = get_jwt_identity()
    try:
        uid = int(uid)
    except:
        pass
    return Usuario.query.get(uid)

def _deposito_id_usuario(usuario):
    try:
        if usuario and usuario.empleado and usuario.empleado.ID_DEPOSITO:
            return int(usuario.empleado.ID_DEPOSITO)
    except:
        pass
    return None

def _rol_lower_db(usuario):
    """
    ✅ Rol real desde BD (evita tokens viejos cuando se cambian roles).
    """
    try:
        if usuario and usuario.rol and getattr(usuario.rol, "NOMBRE_ROL", None):
            return str(usuario.rol.NOMBRE_ROL).strip().lower()
    except:
        pass
    # fallback a claim (por si acaso)
    try:
        return (get_jwt().get("rol_nombre") or "").strip().lower()
    except:
        return ""

def get_id_estado_vale_anulado():
    """
    Busca el estado 'Anulado' usando el nombre correcto de la columna (estado_vale)
    Si no existe, lo crea para evitar errores de llave foránea.
    """
    estado = EstadoVale.query.filter(EstadoVale.estado_vale.ilike("Anulado")).first()

    if not estado:
        print("El estado 'Anulado' no existe. Creándolo...")
        estado = EstadoVale()
        estado.estado_vale = "Anulado"

        # Aseguramos que el ID sea None para que actúe el Auto-Increment
        if hasattr(estado, "ID_ESTADO_VALE"):
            estado.ID_ESTADO_VALE = None

        db.session.add(estado)
        db.session.commit()
        print(f"Estado 'Anulado' creado con ID: {estado.ID_ESTADO_VALE}")

    return estado.ID_ESTADO_VALE


def descontar_stock_salida(vale, user_id):
    empleado = Usuario.query.get(user_id).empleado

    for det in (vale.detalles or []):
        inv = Inventario.query.filter_by(ID_LOTE=det.ID_LOTE, ID_DEPOSITO=vale.ID_DEPOSITO_ORIGEN).first()

        if inv and inv.CANTIDAD_ACTUAL >= det.CANTIDAD_SOLICITADA:
            inv.CANTIDAD_ACTUAL -= det.CANTIDAD_SOLICITADA

            mov = MovimientoMaterial(
                ID_TIPO_MOVIMIENTO=2,  # Salida
                ID_EMPLEADO=empleado.ID_EMPLEADO if empleado else None,
                ID_DEPOSITO=vale.ID_DEPOSITO_ORIGEN,
                ID_LOTE=det.ID_LOTE,
                ID_VALE=vale.ID_VALE,
                CANTIDAD=-(det.CANTIDAD_SOLICITADA),
                OBSERVACIONES="Salida por traslado (Aprobado)",
            )
            db.session.add(mov)
        else:
            raise Exception(f"Stock insuficiente en origen para el lote {det.ID_LOTE}")


def sumar_stock_destino(vale, user_id):
    empleado = Usuario.query.get(user_id).empleado

    for det in (vale.detalles or []):
        inv_dest = Inventario.query.filter_by(ID_LOTE=det.ID_LOTE, ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO).first()

        if not inv_dest:
            inv_dest = Inventario(
                ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO,
                ID_LOTE=det.ID_LOTE,
                ID_ESTADO_INVENTARIO=1,
                CANTIDAD_ACTUAL=0,
            )
            db.session.add(inv_dest)

        inv_dest.CANTIDAD_ACTUAL += det.CANTIDAD_SOLICITADA

        mov = MovimientoMaterial(
            ID_TIPO_MOVIMIENTO=1,  # Entrada
            ID_EMPLEADO=empleado.ID_EMPLEADO if empleado else None,
            ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO,
            ID_LOTE=det.ID_LOTE,
            ID_VALE=vale.ID_VALE,
            CANTIDAD=det.CANTIDAD_SOLICITADA,
            OBSERVACIONES="Entrada por traslado (Recepción)",
        )
        db.session.add(mov)

def aplicar_transferencia_por_recepcion(vale, user_id_receptor):
    """
    ✅ Transferencia real al confirmar recepción:
    - Valida stock en ORIGEN
    - Resta stock ORIGEN (mov salida)
    - Suma stock DESTINO (mov entrada)
    """
    # 1) Validar stock primero para no quedar a medias
    for det in (vale.detalles or []):
        inv_or = Inventario.query.filter_by(
            ID_LOTE=det.ID_LOTE,
            ID_DEPOSITO=vale.ID_DEPOSITO_ORIGEN
        ).first()

        if (not inv_or) or float(inv_or.CANTIDAD_ACTUAL or 0) < float(det.CANTIDAD_SOLICITADA or 0):
            raise Exception(f"Stock insuficiente en origen para el lote {det.ID_LOTE}")

    # 2) Aplicar salida + entrada (reusamos tus funciones)
    descontar_stock_salida(vale, user_id_receptor)
    sumar_stock_destino(vale, user_id_receptor)

def notificar_chofer(id_chofer_empleado, grupo_ruta, id_vale_ref=None, origen_nombre=""):
    """
    En tu sistema: Vale.ID_CHOFER guarda ID_EMPLEADO.
    Por eso buscamos Usuario por ID_EMPLEADO.
    """
    usuario_chofer = Usuario.query.filter_by(ID_EMPLEADO=id_chofer_empleado).first()
    if usuario_chofer:
        noti = Notificacion(
            ID_USUARIO=usuario_chofer.ID_USUARIO,
            MENSAJE=f"🚚 Ruta Lista {grupo_ruta}. ¡Ya puedes iniciar el viaje!",
            LEIDA=False,
            FECHA_CREACION=datetime.now(),
            TIPO="solicitud.ruta",
            LINK_NOTI=f"/Mapa?ruta={id_vale_ref}" if id_vale_ref else "/Mapa",
            DEPOSITO=origen_nombre or "",
            SENDER="Sistema",
            META={"grupo_ruta": grupo_ruta, "id_vale": id_vale_ref},
        )
        db.session.add(noti)


def notificar_usuario(user_id, mensaje, tipo="info.general", link=None, deposito="", sender="Sistema", meta=None):
    try:
        n = Notificacion(
            ID_USUARIO=user_id,
            MENSAJE=mensaje,
            LEIDA=False,
            FECHA_CREACION=datetime.now(),
            TIPO=tipo,
            LINK_NOTI=link,
            DEPOSITO=deposito or "",
            SENDER=sender or "Sistema",
            META=meta,
        )
        db.session.add(n)
    except Exception as e:
        print("⚠️ notificar_usuario error:", e)


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
            resultado.append({"id": v.ID_VEHICULO, "nombre": f"{v.MARCA} {v.MODELO} ({v.MATRICULA})"})
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

        # ✅ Validaciones fuertes
        id_origen = data.get("id_origen")
        id_chofer = data.get("id_chofer")  # ID_EMPLEADO del chofer
        id_vehiculo = data.get("id_vehiculo")

        if not id_origen:
            return jsonify({"error": "Falta id_origen"}), 400
        if not id_chofer:
            return jsonify({"error": "Falta id_chofer"}), 400
        if not id_vehiculo:
            return jsonify({"error": "Falta id_vehiculo"}), 400

        # ✅ estado inicial
        es_admin = usuario.rol and getattr(usuario.rol, "NOMBRE_ROL", "") in ["Master_Admin", "Admin"]
        estado_inicial = 2 if es_admin else 1  # 2=Aprobado directo, 1=Pendiente

        created_vales = []
        solicitudes_a_actualizar = set()

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
                OBSERVACIONES=data.get("observacion", "") or "",
                GRUPO_RUTA=route_group_id,
            )

            if estado_inicial == 2:
                nuevo_vale.ID_USUARIO_APROBADOR_SALIDA = current_user_id

            db.session.add(nuevo_vale)
            db.session.flush()

            for item in items:
                if not item.get("id_lote") or not item.get("id_material") or item.get("cantidad") is None:
                    return jsonify({"error": "Item incompleto (id_lote, id_material, cantidad)"}), 400

                detalle = DetalleVale(
                    ID_VALE=nuevo_vale.ID_VALE,
                    ID_LOTE=int(item["id_lote"]),
                    ID_MATERIAL=int(item["id_material"]),
                    CANTIDAD_SOLICITADA=float(item["cantidad"]),
                )
                db.session.add(detalle)

                if item.get("id_solicitud"):
                    solicitudes_a_actualizar.add(int(item["id_solicitud"]))

            created_vales.append(nuevo_vale)

        # ✅ Opcional: marcar solicitudes “en proceso/completado”
        if solicitudes_a_actualizar:
            for sid in solicitudes_a_actualizar:
                solicitud = SolicitudStock.query.get(sid)
                if solicitud:
                    solicitud.ID_ESTADO = 3  # ajusta según tu sistema

        # ✅ Si queda aprobado directo: descontar stock + notificar chofer
        if estado_inicial == 2:
            for vale in created_vales:
                descontar_stock_salida(vale, current_user_id)

            # noti chofer por el primer vale creado (sirve para link al mapa)
            primer = created_vales[0] if created_vales else None
            origen_nombre = ""
            try:
                origen_nombre = primer.origen.NOMBRE if primer and primer.origen else ""
            except:
                origen_nombre = ""
            notificar_chofer(int(id_chofer), route_group_id, id_vale_ref=(primer.ID_VALE if primer else None), origen_nombre=origen_nombre)

            # ✅ noti al creador: aprobada
            primer_dest = ""
            try:
                primer_dest = primer.destino.NOMBRE if primer and primer.destino else ""
            except:
                primer_dest = ""
            notificar_usuario(
                current_user_id,
                f"✅ Traslado {route_group_id} fue APROBADO y salió a ruta.",
                tipo="check.aprobacion",
                link=f"/movimientos?tab=traslados&highlight={route_group_id}",
                deposito=origen_nombre,
                sender="Sistema",
                meta={"grupo_ruta": route_group_id},
            )

        db.session.commit()

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Ruta generada." + (" Aprobada." if estado_inicial == 2 else " Pendiente de aprobación."),
                    "grupo_ruta": route_group_id,
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        print(f"Error creando vale: {str(e)}")
        return jsonify({"error": str(e)}), 500


@vales_bp.route("/vales/<int:id_vale>/asignar", methods=["PUT"])
@jwt_required()
def asignar_chofer_vale(id_vale):
    data = request.json or {}
    id_chofer = data.get("id_chofer")  # ID_EMPLEADO
    id_vehiculo = data.get("id_vehiculo")

    if not id_chofer or not id_vehiculo:
        return jsonify({"error": "Faltan datos de asignación"}), 400

    try:
        vale = Vale.query.get(id_vale)
        if not vale:
            return jsonify({"error": "Vale no encontrado"}), 404

        vale.ID_CHOFER = int(id_chofer)
        vale.ID_VEHICULO = int(id_vehiculo)

        if vale.ID_ESTADO_VALE == 2:
            origen_nombre = vale.origen.NOMBRE if vale.origen else ""
            notificar_chofer(int(id_chofer), vale.GRUPO_RUTA or f"#{vale.ID_VALE}", id_vale_ref=vale.ID_VALE, origen_nombre=origen_nombre)

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

    if not vale:
        return jsonify({"error": "Vale no encontrado"}), 404
    if vale.ID_ESTADO_VALE != 1:
        return jsonify({"error": "El vale no está pendiente"}), 400

    try:
        if not vale.ID_CHOFER:
            return jsonify({"error": "Debes asignar un Chofer antes de aprobar la salida."}), 400

        vale.ID_ESTADO_VALE = 2
        vale.ID_USUARIO_APROBADOR_SALIDA = current_user_id
        vale.FECHA_SALIDA = datetime.now()

        descontar_stock_salida(vale, current_user_id)

        origen_nombre = vale.origen.NOMBRE if vale.origen else ""
        notificar_chofer(vale.ID_CHOFER, vale.GRUPO_RUTA, id_vale_ref=vale.ID_VALE, origen_nombre=origen_nombre)

        # ✅ Notificar al creador: aprobación
        notificar_usuario(
            vale.ID_USUARIO_CREADOR,
            f"✅ Vale/Traslado #{vale.GRUPO_RUTA or vale.ID_VALE} fue APROBADO.",
            tipo="check.aprobacion",
            link=f"/movimientos?tab=traslados&highlight={vale.GRUPO_RUTA or vale.ID_VALE}",
            deposito=origen_nombre,
            sender="Sistema",
            meta={"id_vale": vale.ID_VALE, "grupo_ruta": vale.GRUPO_RUTA},
        )

        db.session.commit()
        return jsonify({"success": True, "message": "Salida aprobada."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al aprobar: {str(e)}"}), 500


@vales_bp.route("/vales/<int:id_vale>/rechazar", methods=["PUT"])
@cross_origin()
@jwt_required()
def rechazar_vale(id_vale):
    data = request.json or {}
    motivo = (data.get("motivo") or "Sin motivo especificado").strip()

    vale = Vale.query.get(id_vale)

    if not vale:
        return jsonify({"error": "Vale no encontrado"}), 404
    if vale.ID_ESTADO_VALE != 1:
        return jsonify({"error": "El vale no está en estado pendiente"}), 400

    try:
        id_anulado = get_id_estado_vale_anulado()
        vale.ID_ESTADO_VALE = id_anulado

        obs_actual = vale.OBSERVACIONES or ""
        vale.OBSERVACIONES = f"{obs_actual} | [ANULADO]: {motivo}".strip(" |")

        # ✅ Notificar al creador (persistente + META con motivo)
        origen_nombre = vale.origen.NOMBRE if vale.origen else ""
        notificar_usuario(
            vale.ID_USUARIO_CREADOR,
            f"❌ Vale #{vale.ID_VALE} ANULADO. Motivo: {motivo}",
            tipo="alerta.anulacion",
            link=f"/movimientos?tab=traslados&highlight={vale.GRUPO_RUTA or vale.ID_VALE}",
            deposito=origen_nombre,
            sender="Sistema",
            meta={"motivo_anulacion": motivo, "id_vale": vale.ID_VALE, "grupo_ruta": vale.GRUPO_RUTA},
        )

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
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    # Traemos el vale con detalles cargados (evita sorpresas con lazy loading)
    vale = (
        Vale.query
        .options(joinedload(Vale.detalles))
        .filter(Vale.ID_VALE == id_vale)
        .first()
    )

    if not vale:
        return jsonify({"error": "Vale no encontrado"}), 404

    try:
        estado = int(vale.ID_ESTADO_VALE or 0)

        # Si aún no está aprobado/salió, no debería recepcionarse
        if estado < 2:
            return jsonify({"error": "El vale aún no está aprobado para ser recepcionado"}), 400

        # ✅ Si ya se aplicó la recepción (entrada a inventario), no repetir
        if _recepcion_ya_aplicada(vale.ID_VALE):
            # Asegurar campos finales (sin tocar stock)
            if int(vale.ID_ESTADO_VALE or 0) < 4:
                vale.ID_ESTADO_VALE = 4
            if not getattr(vale, "FECHA_LLEGADA", None):
                vale.FECHA_LLEGADA = datetime.now()
            if not getattr(vale, "ID_USUARIO_RECEPTOR", None):
                vale.ID_USUARIO_RECEPTOR = current_user_id

            db.session.commit()
            return jsonify({
                "success": True,
                "already_confirmed": True,
                "applied_stock": False,
                "message": "ℹ️ Este traslado ya estaba confirmado (stock ya actualizado)."
            }), 200

        # ✅ Si NO está aplicada, la aplicamos (aunque el vale esté “finalizado”)
        # Esto corrige vales que quedaron en estado 4 pero sin impactar stock.
        if int(vale.ID_ESTADO_VALE or 0) < 4:
            vale.ID_ESTADO_VALE = 4

        vale.ID_USUARIO_RECEPTOR = current_user_id
        vale.FECHA_LLEGADA = datetime.now()

        # 🔥 Aquí se actualiza stock destino (entrada)
        sumar_stock_destino(vale, current_user_id)

        # Notificación (la dejamos tal cual tu lógica)
        destino_nombre = vale.destino.NOMBRE if vale.destino else ""
        notificar_usuario(
            vale.ID_USUARIO_CREADOR,
            f"✅ Recepción confirmada del traslado #{vale.GRUPO_RUTA or vale.ID_VALE}.",
            tipo="check.recepcion",
            link=f"/movimientos?tab=traslados&highlight={vale.GRUPO_RUTA or vale.ID_VALE}",
            deposito=destino_nombre,
            sender="Sistema",
            meta={"id_vale": vale.ID_VALE, "grupo_ruta": vale.GRUPO_RUTA},
        )

        db.session.commit()
        return jsonify({
            "success": True,
            "already_confirmed": False,
            "applied_stock": True,
            "message": "✅ Recepción confirmada. Stock actualizado."
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al recepcionar: {str(e)}"}), 500



@vales_bp.route("/solicitudes/pendientes", methods=["GET"])
@jwt_required()
def get_solicitudes_pendientes():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    modo = request.args.get("modo", "pendientes")

    try:
        query = SolicitudStock.query

        if usuario and usuario.empleado and usuario.empleado.ID_DEPOSITO:
            mi_deposito_id = usuario.empleado.ID_DEPOSITO
            query = query.filter_by(ID_DEPOSITO_PROVEEDOR=mi_deposito_id)

        if modo == "pendientes":
            query = query.filter_by(ID_ESTADO=1)

        solicitudes = query.order_by(SolicitudStock.FECHA_SOLICITUD.desc()).limit(50).all()

        resultado = []
        for s in solicitudes:
            nombre_estado = {1: "Pendiente", 2: "En Proceso", 3: "Completado", 4: "Rechazado"}.get(s.ID_ESTADO, "Desconocido")

            # ⚠️ Esta sección depende de tu modelo real de SolicitudStock.
            # La dejo igual (compat) aunque en muchos modelos "material" no existe en cabecera.
            resultado.append(
                {
                    "id_solicitud": s.ID_SOLICITUD,
                    "deposito_solicitante": s.dep_solicitante.NOMBRE if getattr(s, "dep_solicitante", None) else "Desconocido",
                    "id_destino": getattr(s, "ID_DEPOSITO_SOLICITANTE", None),
                    "solicitante_usuario": f"{s.usuario.empleado.NOMBRE} {s.usuario.empleado.APELLIDO}" if getattr(s, "usuario", None) and getattr(s.usuario, "empleado", None) else "Usuario",
                    "material": getattr(getattr(s, "material", None), "NOMBRE", "Material"),
                    "id_material": getattr(s, "ID_MATERIAL", None),
                    "cantidad": getattr(s, "CANTIDAD", None),
                    "fecha": s.FECHA_SOLICITUD.strftime("%d/%m/%Y %H:%M") if s.FECHA_SOLICITUD else "",
                    "observacion": getattr(s, "OBSERVACION", "") or getattr(s, "OBSERVACION_GENERAL", "") or "",
                    "estado": nombre_estado,
                    "id_estado": s.ID_ESTADO,
                }
            )

        return jsonify(resultado), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@vales_bp.route("/vales/pendientes", methods=["GET"])
@jwt_required()
def get_vales_pendientes():
    vales = Vale.query.filter_by(ID_ESTADO_VALE=1).all()
    res = []
    for v in vales:
        nombre_chofer = f"{v.chofer.NOMBRE} {v.chofer.APELLIDO}" if getattr(v, "chofer", None) else "Sin Asignar"
        matricula_vehiculo = v.vehiculo.MATRICULA if getattr(v, "vehiculo", None) else "Sin Asignar"

        res.append(
            {
                "id": v.ID_VALE,
                "fecha": v.FECHA_CREACION.strftime("%d/%m %H:%M") if v.FECHA_CREACION else "",
                "destino": v.destino.NOMBRE if getattr(v, "destino", None) else "Desconocido",
                "chofer": nombre_chofer,
                "vehiculo": matricula_vehiculo,
                "origen": v.origen.NOMBRE if getattr(v, "origen", None) else "Desconocido",
                "detalles": [
                    {
                        "codigo": d.material.CODIGO_UNICO,
                        "material": d.material.NOMBRE,
                        "unidad": d.material.UNIDAD_MEDIDA,
                        "lote": d.lote.CODIGO,
                        "cantidad": d.CANTIDAD_SOLICITADA,
                    }
                    for d in (v.detalles or [])
                ],
            }
        )
    return jsonify(res), 200


@vales_bp.route("/traslados/historial", methods=["GET"])
@jwt_required()
def get_historial_traslados():
    """
    Historial de traslados agrupado por GRUPO_RUTA.
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

    es_admin = rol_low in ("master_admin", "admin")

    try:
        sub_min_fc = (
            db.session.query(Vale.GRUPO_RUTA.label("grupo"), func.min(Vale.FECHA_CREACION).label("min_fc"))
            .filter(Vale.GRUPO_RUTA != None)
            .group_by(Vale.GRUPO_RUTA)
            .subquery()
        )

        sub_max_fc = (
            db.session.query(Vale.GRUPO_RUTA.label("grupo"), func.max(Vale.FECHA_CREACION).label("max_fc"))
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

        if rol_low == "chofer":
            if not chofer_id_user:
                return jsonify({"error": "Usuario no vinculado a empleado/chofer"}), 400
            q = q.filter(Vale.ID_CHOFER == chofer_id_user)
        elif not es_admin:
            if not deposito_id_user:
                return jsonify({"error": "Usuario no vinculado a un depósito"}), 400
            q = q.filter((Vale.ID_DEPOSITO_ORIGEN == deposito_id_user) | (Vale.ID_DEPOSITO_DESTINO == deposito_id_user))

        q = q.group_by(Vale.GRUPO_RUTA, dep_or.NOMBRE, dep_de.NOMBRE).order_by(func.max(Vale.FECHA_CREACION).desc()).limit(limit)

        rows = q.all()

        chofer_cache = {}
        vehiculo_cache = {}

        res = []
        for r in rows:
            id_chofer = int(r.id_chofer) if r.id_chofer is not None else None
            id_vehiculo = int(r.id_vehiculo) if r.id_vehiculo is not None else None

            chofer_txt = "Sin Asignar"
            if id_chofer:
                if id_chofer not in chofer_cache:
                    c = Empleado.query.get(id_chofer)
                    chofer_cache[id_chofer] = f"{c.NOMBRE} {c.APELLIDO}" if c else "Sin Asignar"
                chofer_txt = chofer_cache[id_chofer]

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

            res.append(
                {
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
                }
            )

        return jsonify(res), 200

    except Exception as e:
        print("❌ Error get_historial_traslados:", e)
        return jsonify({"error": str(e)}), 500


@vales_bp.route("/traslados/grupo/<string:grupo_ruta>/detalle", methods=["GET", "OPTIONS"])
@jwt_required()
def get_detalle_traslado_grupo(grupo_ruta):
    try:
        vales = (
            Vale.query.filter(Vale.GRUPO_RUTA == grupo_ruta)
            .options(
                joinedload(Vale.origen),
                joinedload(Vale.destino),
                joinedload(Vale.chofer),
                joinedload(Vale.vehiculo),
                joinedload(Vale.detalles).joinedload(DetalleVale.material),
                joinedload(Vale.detalles).joinedload(DetalleVale.lote),
            )
            .order_by(Vale.FECHA_CREACION.asc())
            .all()
        )

        if not vales:
            return jsonify({"error": "Grupo no encontrado"}), 404

        first = vales[0]

        meta = {
            "grupo_ruta": grupo_ruta,
            "origen": first.origen.NOMBRE if first.origen else "N/A",
            "chofer": f"{first.chofer.NOMBRE} {first.chofer.APELLIDO}" if first.chofer else "Sin Asignar",
            "vehiculo": f"{first.vehiculo.MARCA} - {first.vehiculo.MATRICULA}" if first.vehiculo else "N/A",
            "fecha_salida": min([v.FECHA_SALIDA for v in vales if v.FECHA_SALIDA] or [None]),
            "fecha_llegada": max([v.FECHA_LLEGADA for v in vales if v.FECHA_LLEGADA] or [None]),
        }

        paradas = []
        for v in vales:
            items = []
            for d in (v.detalles or []):
                items.append(
                    {
                        "material": d.material.NOMBRE if d.material else "-",
                        "lote": d.lote.CODIGO if d.lote else "-",
                        "cantidad": d.CANTIDAD_SOLICITADA,
                        "unidad": d.material.UNIDAD_MEDIDA if d.material else "u.",
                    }
                )

            paradas.append({"destino": v.destino.NOMBRE if v.destino else "N/A", "items": items})

        return jsonify({"meta": meta, "paradas": paradas}), 200

    except Exception as e:
        print("❌ Error detalle grupo:", e)
        return jsonify({"error": str(e)}), 500


@vales_bp.route("/movimientos_ruta/<int:id_vale>/polyline", methods=["GET"])
@cross_origin()
@jwt_required()
def get_polyline_ruta(id_vale):
    """
    Devuelve:
      gps: [] (si no hay tracking)
      plan: [{lat,lng}, ...] usando depósitos del grupo
      meta: {grupo_ruta, ...}
    """
    try:
        vale_ref = Vale.query.get(id_vale)
        if not vale_ref:
            return jsonify({"error": "Vale no encontrado"}), 404

        grupo = vale_ref.GRUPO_RUTA
        if not grupo:
            vales = [vale_ref]
        else:
            vales = Vale.query.filter_by(GRUPO_RUTA=grupo).order_by(Vale.FECHA_CREACION.asc()).all()

        plan = []
        if vales:
            first = vales[0]
            if first.origen and first.origen.LATITUD and first.origen.LONGITUD:
                plan.append({"lat": float(first.origen.LATITUD), "lng": float(first.origen.LONGITUD)})

            for v in vales:
                if v.destino and v.destino.LATITUD and v.destino.LONGITUD:
                    plan.append({"lat": float(v.destino.LATITUD), "lng": float(v.destino.LONGITUD)})

        gps = []

        meta = {"grupo_ruta": grupo, "id_vale_ref": vale_ref.ID_VALE}

        return jsonify({"gps": gps, "plan": plan, "meta": meta}), 200

    except Exception as e:
        print("❌ Error get_polyline_ruta:", e)
        return jsonify({"error": str(e)}), 500
