# backend/ordenes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime, date
from sqlalchemy import text

from db import (
    db,
    OrdenTrabajo,
    EstadoOrden,
    Empleado,
    Usuario,
    AvanceOrden,
    Notificacion,
    Inventario,
    MovimientoMaterial,
    TipoMovimiento,
    SolicitudStock,

    # ✅ NUEVOS MODELOS (agregalos en db.py)
    DepositoSector,
    Maquinaria,
)

ordenes_bp = Blueprint("ordenes", __name__)

# ---------------------------------------------------------
# 🛡️ HELPER: VERIFICACIÓN DE PERMISOS
# ---------------------------------------------------------
def tiene_permiso_ordenes():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)
        if not usuario or not usuario.rol:
            return False
        nombre_rol = usuario.rol.NOMBRE_ROL
        if nombre_rol in ["Master_Admin", "Admin"]:
            return True

        sql = text("""
            SELECT 1 FROM permiso_x_rol pxr
            JOIN permiso p ON pxr.ID_PERMISO = p.ID_PERMISO
            WHERE pxr.ID_ROL = :id_rol AND p.NOMBRE_PERMISO = 'gestion_ordenes'
        """)
        resultado = db.session.execute(sql, {"id_rol": usuario.ID_ROL}).fetchone()
        return True if resultado else False
    except:
        return False


def format_nombre(texto):
    if not texto:
        return ""
    return " ".join(word.capitalize() for word in str(texto).lower().split())


def _get_user():
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    usuario = Usuario.query.get(user_id)
    return claims, user_id, usuario


def _rol_lower(claims):
    return (claims.get("rol_nombre") or "").strip().lower()


def _deposito_efectivo_para_listados(usuario, claims):
    """
    Depósito del usuario actual, usado para scoping.
    """
    if not usuario or not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
        return None
    return usuario.empleado.ID_DEPOSITO


def _deposito_efectivo_para_master(usuario, claims, deposito_id_param):
    """
    Master_Admin puede pedir un depósito específico.
    Resto: solo su depósito.
    """
    role = _rol_lower(claims)
    dep_user = _deposito_efectivo_para_listados(usuario, claims)

    if role == "master_admin":
        if deposito_id_param:
            try:
                return int(deposito_id_param)
            except:
                return dep_user
        return dep_user
    return dep_user


# ---------------------------------------------------------
# ✅ RECURSOS: SECTORES
# ---------------------------------------------------------
@ordenes_bp.route("/recursos/sectores", methods=["GET"])
@jwt_required()
def get_sectores_deposito():
    if not tiene_permiso_ordenes():
        return jsonify({"error": "No autorizado"}), 403

    claims, _, usuario = _get_user()
    deposito_qs = request.args.get("deposito_id")
    dep_id = _deposito_efectivo_para_master(usuario, claims, deposito_qs)
    if not dep_id:
        return jsonify([]), 200

    sectores = DepositoSector.query.filter_by(ID_DEPOSITO=dep_id, ACTIVO=True).order_by(DepositoSector.CODIGO.asc()).all()
    return jsonify([
        {
            "id_sector": s.ID_SECTOR,
            "codigo": s.CODIGO,
            "nombre": s.NOMBRE,
            "id_deposito": s.ID_DEPOSITO
        } for s in sectores
    ]), 200


# ---------------------------------------------------------
# ✅ RECURSOS: MAQUINARIA
# ---------------------------------------------------------
@ordenes_bp.route("/recursos/maquinaria", methods=["GET"])
@jwt_required()
def get_maquinaria_deposito():
    if not tiene_permiso_ordenes():
        return jsonify({"error": "No autorizado"}), 403

    claims, _, usuario = _get_user()
    deposito_qs = request.args.get("deposito_id")
    dep_id = _deposito_efectivo_para_master(usuario, claims, deposito_qs)
    if not dep_id:
        return jsonify([]), 200

    maq = Maquinaria.query.filter_by(ID_DEPOSITO=dep_id, ACTIVA=True).order_by(Maquinaria.NOMBRE.asc()).all()
    return jsonify([
        {
            "id_maquinaria": m.ID_MAQUINARIA,
            "nombre": m.NOMBRE,
            "tipo": m.TIPO,
            "id_deposito": m.ID_DEPOSITO
        } for m in maq
    ]), 200


# ---------------------------------------------------------
# ✅ INVENTARIO LOCAL (PARA SELECTOR DE MOVIMIENTO)
# ---------------------------------------------------------
@ordenes_bp.route("/recursos/inventario-local", methods=["GET"])
@jwt_required()
def get_inventario_local():
    """
    Retorna el stock disponible en el depósito del usuario actual
    (o depósito elegido si Master_Admin pasa ?deposito_id=).
    """
    claims, _, usuario = _get_user()
    deposito_qs = request.args.get("deposito_id")
    dep_id = _deposito_efectivo_para_master(usuario, claims, deposito_qs)

    if not dep_id:
        return jsonify([]), 200

    inventarios = Inventario.query.filter_by(ID_DEPOSITO=dep_id).all()

    lista = []
    for inv in inventarios:
        if inv.CANTIDAD_ACTUAL and inv.CANTIDAD_ACTUAL > 0:
            sector = getattr(inv, "sector_actual", None)  # si tenés relationship
            sector_codigo = getattr(sector, "CODIGO", None) if sector else None
            sector_nombre = getattr(sector, "NOMBRE", None) if sector else None

            # lote/material via relationships existentes
            mat = inv.lote.material if inv.lote and inv.lote.material else None
            estado_txt = inv.estado.ESTADO_INVENTARIO if getattr(inv, "estado", None) else "Disponible"
            lista.append({
                "id_inventario": inv.ID_INVENTARIO,
                "lote_id": inv.ID_LOTE,
                "lote_codigo": inv.lote.CODIGO if inv.lote else None,
                "material": mat.NOMBRE if mat else "Material",
                "codigo_material": mat.CODIGO_UNICO if mat else None,
                "cantidad": inv.CANTIDAD_ACTUAL,
                "unidad": mat.UNIDAD_MEDIDA if mat else "u.",
                "estado": estado_txt,
                "estado_id": getattr(inv, "ID_ESTADO_INVENTARIO", None),

                "sector_id": getattr(inv, "ID_SECTOR_ACTUAL", None),
                "sector_codigo": sector_codigo,
                "sector_nombre": sector_nombre,
                "ubicacion_detalle": getattr(inv, "UBICACION_DETALLE", None),
            })

    return jsonify(lista), 200


# ---------------------------------------------------------
# ✅ DETALLE DE INVENTARIO (BOTÓN INFO)
# ---------------------------------------------------------
@ordenes_bp.route("/recursos/inventario-detalle/<int:id_inventario>", methods=["GET"])
@jwt_required()
def inventario_detalle(id_inventario):
    if not tiene_permiso_ordenes():
        return jsonify({"error": "No autorizado"}), 403

    claims, _, usuario = _get_user()
    role = _rol_lower(claims)

    inv = Inventario.query.get(id_inventario)
    if not inv:
        return jsonify({"error": "No encontrado"}), 404

    # 🔒 Scoping: Master ve todo; Admin/otros solo su depósito
    if role != "master_admin":
        dep_user = _deposito_efectivo_para_listados(usuario, claims)
        if not dep_user or int(dep_user) != int(inv.ID_DEPOSITO):
            return jsonify({"error": "No autorizado"}), 403

    sector = getattr(inv, "sector_actual", None)
    mat = inv.lote.material if inv.lote and inv.lote.material else None
    estado_txt = inv.estado.ESTADO_INVENTARIO if getattr(inv, "estado", None) else "Disponible"
    return jsonify({
        "id_inventario": inv.ID_INVENTARIO,
        "id_deposito": inv.ID_DEPOSITO,

        "id_lote": inv.ID_LOTE,
        "lote_codigo": inv.lote.CODIGO if inv.lote else None,
        "fecha_ingreso": str(inv.lote.FECHA_INGRESO) if inv.lote and inv.lote.FECHA_INGRESO else None,
        "obs_lote": inv.lote.OBSERVACIONES if inv.lote else None,

        "material": mat.NOMBRE if mat else None,
        "codigo_material": mat.CODIGO_UNICO if mat else None,
        "unidad": mat.UNIDAD_MEDIDA if mat else "u.",
        "cantidad_disponible": inv.CANTIDAD_ACTUAL,

        "estado": estado_txt,
        "estado_id": getattr(inv, "ID_ESTADO_INVENTARIO", None),


        "sector_id": getattr(inv, "ID_SECTOR_ACTUAL", None),
        "sector_codigo": getattr(sector, "CODIGO", None) if sector else None,
        "sector_nombre": getattr(sector, "NOMBRE", None) if sector else None,
        "ubicacion_detalle": getattr(inv, "UBICACION_DETALLE", None),
    }), 200


# ---------------------------------------------------------
# --- 1. LISTAR ÓRDENES ---
# ---------------------------------------------------------
@ordenes_bp.route("/ordenes", methods=["GET"])
@jwt_required()
def get_ordenes():
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    rol = (claims.get("rol_nombre") or "").strip()

    usuario_actual = Usuario.query.get(user_id)
    if not usuario_actual:
        return jsonify([]), 200

    empleado_id_actual = usuario_actual.empleado.ID_EMPLEADO if usuario_actual.empleado else None
    deposito_id_user = usuario_actual.empleado.ID_DEPOSITO if usuario_actual.empleado else None

    try:
        # (0) Vencimientos (tu lógica intacta)
        estado_vencido = EstadoOrden.query.filter(
            EstadoOrden.ESTADO_ORDEN.ilike("Fin de tiempo limite")
        ).first()

        if estado_vencido:
            now = datetime.now()
            estados_activos = ["Pendiente", "En Progreso"]

            ordenes_vencidas = OrdenTrabajo.query.join(EstadoOrden).filter(
                OrdenTrabajo.FECHA_LIMITE != None,
                OrdenTrabajo.FECHA_LIMITE < now,
                EstadoOrden.ESTADO_ORDEN.in_(estados_activos)
            ).all()

            count = 0
            for o in ordenes_vencidas:
                o.ID_ESTADO_ORDEN = estado_vencido.ID_ESTADO_ORDEN
                count += 1
            if count > 0:
                db.session.commit()

        # (1) Query base + joins extra (sector/maquinaria)
        query = db.session.query(OrdenTrabajo, Empleado, Usuario, DepositoSector, Maquinaria)\
            .outerjoin(Empleado, OrdenTrabajo.ID_EMPLEADO == Empleado.ID_EMPLEADO)\
            .outerjoin(Usuario, Empleado.ID_EMPLEADO == Usuario.ID_EMPLEADO)\
            .outerjoin(DepositoSector, OrdenTrabajo.ID_SECTOR_DESTINO == DepositoSector.ID_SECTOR)\
            .outerjoin(Maquinaria, OrdenTrabajo.ID_MAQUINARIA == Maquinaria.ID_MAQUINARIA)\
            .filter(OrdenTrabajo.ELIMINADA == False)

        role_lower = rol.lower()

        # (2) Scoping
        if role_lower == "master_admin":
            deposito_qs = request.args.get("deposito_id")
            if deposito_qs and str(deposito_qs).upper() != "TODOS":
                try:
                    query = query.filter(OrdenTrabajo.ID_DEPOSITO == int(deposito_qs))
                except:
                    pass
        elif role_lower == "admin":
            if not deposito_id_user:
                return jsonify([]), 200
            query = query.filter(OrdenTrabajo.ID_DEPOSITO == deposito_id_user)
        else:
            if not empleado_id_actual:
                return jsonify([]), 200
            query = query.filter(OrdenTrabajo.ID_EMPLEADO == empleado_id_actual)

        results = query.order_by(OrdenTrabajo.ID_ESTADO_ORDEN.asc(), OrdenTrabajo.FECHA_INICIO.desc()).all()

        lista_ordenes = []
        for orden, empleado_asignado, usuario_asignado, sector_dest, maquinaria in results:
            data = orden.to_dict()

            data["tipo_orden"] = orden.TIPO_ORDEN or "General"
            data["cantidad_mov"] = orden.CANTIDAD_MOVIMIENTO
            data["nueva_ubicacion"] = orden.NUEVA_UBICACION

            # ✅ extras movimiento
            data["sector_destino_codigo"] = sector_dest.CODIGO if sector_dest else None
            data["sector_destino_nombre"] = sector_dest.NOMBRE if sector_dest else None
            data["maquinaria_nombre"] = maquinaria.NOMBRE if maquinaria else None
            data["maquinaria_tipo"] = maquinaria.TIPO if maquinaria else None

            if empleado_asignado:
                data["empleado_nombre"] = format_nombre(f"{empleado_asignado.NOMBRE} {empleado_asignado.APELLIDO}")
                data["empleado_avatar"] = usuario_asignado.AVATAR if usuario_asignado else None
            else:
                data["empleado_nombre"] = "Sin Asignar"
                data["empleado_avatar"] = None

            lista_ordenes.append(data)

        return jsonify(lista_ordenes), 200

    except Exception as e:
        print(f"Error get_ordenes: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# --- 2. CREAR ORDEN (MANUAL) ---
# ---------------------------------------------------------
@ordenes_bp.route("/ordenes", methods=["POST"])
@jwt_required()
def create_orden():
    if not tiene_permiso_ordenes():
        return jsonify({"error": "No tienes permisos."}), 403

    data = request.json or {}
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    role_lower = (rol or "").strip().lower()
    user_id = int(claims.get("sub"))

    try:
        estado_pendiente = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Pendiente")).first()
        if not estado_pendiente:
            return jsonify({"error": "Estado Pendiente no configurado"}), 500

        # Depósito
        id_deposito = None
        if role_lower == "master_admin":
            id_deposito = data.get("id_deposito")
        else:
            usuario = Usuario.query.get(user_id)
            if usuario and usuario.empleado:
                id_deposito = usuario.empleado.ID_DEPOSITO

        if not id_deposito:
            return jsonify({"error": "Falta depósito o usuario no asignado a uno."}), 400

        # Empleado (puede ser NULL)
        id_empleado = data.get("id_empleado")

        tipo_orden = data.get("tipo_orden", "General")

        # Fecha límite
        fecha_limite = None
        if data.get("fecha_limite"):
            try:
                fecha_limite = datetime.strptime(data.get("fecha_limite"), "%Y-%m-%dT%H:%M")
            except ValueError:
                pass

        # ✅ Campos movimiento
        id_lote = None
        cantidad = 0
        ubicacion_detalle = None
        id_sector_destino = None
        id_maquinaria = None

        if tipo_orden == "Movimiento":
            id_lote = data.get("id_lote")
            try:
                cantidad = float(data.get("cantidad", 0))
            except:
                cantidad = 0

            ubicacion_detalle = data.get("nueva_ubicacion")  # detalle opcional
            id_sector_destino = data.get("id_sector_destino")
            id_maquinaria = data.get("id_maquinaria")

            if not id_lote:
                return jsonify({"error": "Falta lote para movimiento."}), 400
            if not cantidad or cantidad <= 0:
                return jsonify({"error": "Cantidad inválida."}), 400
            if not id_sector_destino:
                return jsonify({"error": "Falta sector destino."}), 400
            if not id_maquinaria:
                return jsonify({"error": "Falta maquinaria."}), 400

            # ✅ validar sector destino pertenece al depósito
            sec = DepositoSector.query.filter_by(ID_SECTOR=int(id_sector_destino), ID_DEPOSITO=int(id_deposito), ACTIVO=True).first()
            if not sec:
                return jsonify({"error": "Sector destino inválido para este depósito."}), 400

            # ✅ validar maquinaria pertenece al depósito
            maq = Maquinaria.query.filter_by(ID_MAQUINARIA=int(id_maquinaria), ID_DEPOSITO=int(id_deposito), ACTIVA=True).first()
            if not maq:
                return jsonify({"error": "Maquinaria inválida para este depósito."}), 400

            # ✅ validar inventario: existe, stock suficiente, (opcional) estado permitido
            inv = Inventario.query.filter_by(ID_DEPOSITO=int(id_deposito), ID_LOTE=int(id_lote)).first()
            if not inv:
                return jsonify({"error": "No hay inventario para ese lote en este depósito."}), 400
            if not inv.CANTIDAD_ACTUAL or float(inv.CANTIDAD_ACTUAL) < float(cantidad):
                return jsonify({"error": "Stock insuficiente para el movimiento."}), 400

            estado_inv = getattr(inv, "ESTADO", None) or getattr(inv, "estado", None) or "Disponible"
            # Si querés permitir mover dañados/antiguos, comentá este check.
            if estado_inv in ["Dañado"]:
                return jsonify({"error": "No se puede mover un lote Dañado."}), 400

        nueva_orden = OrdenTrabajo(
            TITULO=data.get("titulo"),
            DESCRIPCION=data.get("descripcion"),
            PRIORIDAD=data.get("prioridad", "Media"),
            ID_DEPOSITO=id_deposito,
            ID_EMPLEADO=id_empleado if id_empleado else None,
            ID_ESTADO_ORDEN=estado_pendiente.ID_ESTADO_ORDEN,
            FECHA_INICIO=datetime.now(),
            FECHA_LIMITE=fecha_limite,

            TIPO_ORDEN=tipo_orden,
            ID_LOTE_OBJETIVO=id_lote,
            CANTIDAD_MOVIMIENTO=cantidad,
            NUEVA_UBICACION=ubicacion_detalle,

            # ✅ nuevos
            ID_SECTOR_DESTINO=int(id_sector_destino) if id_sector_destino else None,
            ID_MAQUINARIA=int(id_maquinaria) if id_maquinaria else None,
        )

        db.session.add(nueva_orden)
        db.session.flush()

        # Notificación si hay empleado asignado
        if nueva_orden.ID_EMPLEADO:
            usuario_dest = Usuario.query.filter_by(ID_EMPLEADO=nueva_orden.ID_EMPLEADO).first()
            if usuario_dest:
                noti = Notificacion(
                    ID_USUARIO=usuario_dest.ID_USUARIO,
                    ID_ORDEN=nueva_orden.ID_ORDEN,
                    MENSAJE=f"Nueva tarea ({tipo_orden}): {nueva_orden.TITULO}"
                )
                db.session.add(noti)

        db.session.commit()
        return jsonify({"success": True, "message": "Orden creada."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# --- 3. ACTUALIZAR ORDEN ---
# ---------------------------------------------------------
@ordenes_bp.route("/ordenes/<int:id_orden>", methods=["PUT"])
@jwt_required()
def update_orden(id_orden):
    data = request.json or {}
    es_gestor = tiene_permiso_ordenes()

    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden:
            return jsonify({"error": "No encontrada"}), 404

        # EDICIÓN INFO
        if data.get("accion") == "editar_info":
            if not es_gestor:
                return jsonify({"error": "No autorizado"}), 403
            if "titulo" in data:
                orden.TITULO = data.get("titulo")
            if "descripcion" in data:
                orden.DESCRIPCION = data.get("descripcion")
            if "prioridad" in data:
                orden.PRIORIDAD = data.get("prioridad")
            if "fecha_limite" in data:
                val = data.get("fecha_limite")
                orden.FECHA_LIMITE = datetime.strptime(val, "%Y-%m-%dT%H:%M") if val else None
            db.session.commit()
            return jsonify({"success": True}), 200

        if "herramientas" in data:
            orden.HERRAMIENTAS = data.get("herramientas")

        if "nuevo_estado" in data:
            nuevo_estado_str = data.get("nuevo_estado")
            st = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike(nuevo_estado_str)).first()
            if not st:
                return jsonify({"error": "Estado no existe"}), 400

            orden.ID_ESTADO_ORDEN = st.ID_ESTADO_ORDEN

            # Finalización
            es_finalizada = st.ESTADO_ORDEN in ["Aprobada", "Completada", "Finalizada"]
            if es_finalizada:
                orden.FECHA_CIERRE = datetime.now()

                # ✅ MOVIMIENTO INTERNO: registrar + actualizar sector
                if orden.TIPO_ORDEN == "Movimiento" and orden.ID_LOTE_OBJETIVO:
                    tipo_mov = TipoMovimiento.query.filter_by(TIPO_MOVIMIENTO="Movimiento Interno").first()
                    inv = Inventario.query.filter_by(ID_DEPOSITO=orden.ID_DEPOSITO, ID_LOTE=orden.ID_LOTE_OBJETIVO).first()

                    # sector origen/destino para observación
                    sector_origen = None
                    if inv and getattr(inv, "ID_SECTOR_ACTUAL", None):
                        sector_origen = DepositoSector.query.get(inv.ID_SECTOR_ACTUAL)

                    sector_dest = DepositoSector.query.get(getattr(orden, "ID_SECTOR_DESTINO", None)) if getattr(orden, "ID_SECTOR_DESTINO", None) else None

                    if tipo_mov:
                        obs = f"Reubicación interna"
                        if sector_origen:
                            obs += f" {sector_origen.CODIGO}"
                        obs += " -> "
                        if sector_dest:
                            obs += f"{sector_dest.CODIGO}"
                        if orden.NUEVA_UBICACION:
                            obs += f" ({orden.NUEVA_UBICACION})"
                        obs += f". (Orden #{orden.ID_ORDEN})"

                        mov = MovimientoMaterial(
                            ID_TIPO_MOVIMIENTO=tipo_mov.ID_TIPO_MOVIMIENTO,
                            ID_EMPLEADO=orden.ID_EMPLEADO,
                            ID_DEPOSITO=orden.ID_DEPOSITO,
                            ID_LOTE=orden.ID_LOTE_OBJETIVO,
                            FECHA_MOVIMIENTO=date.today(),
                            CANTIDAD=orden.CANTIDAD_MOVIMIENTO,
                            OBSERVACIONES=obs
                        )
                        db.session.add(mov)

                    # ✅ actualizar inventario: sector actual + detalle
                    if inv and getattr(orden, "ID_SECTOR_DESTINO", None):
                        inv.ID_SECTOR_ACTUAL = orden.ID_SECTOR_DESTINO
                        inv.UBICACION_DETALLE = orden.NUEVA_UBICACION

                # Calcular tiempo (tu lógica)
                if orden.FECHA_INICIO:
                    diff = orden.FECHA_CIERRE - orden.FECHA_INICIO
                    dias, seconds = diff.days, diff.seconds
                    horas = seconds // 3600
                    mins = (seconds % 3600) // 60
                    txt = []
                    if dias > 0:
                        txt.append(f"{dias}d")
                    if horas > 0:
                        txt.append(f"{horas}h")
                    txt.append(f"{mins}m")
                    orden.TIEMPO_EMPLEADO = " ".join(txt) if txt else "1m"

        if es_gestor:
            if "id_empleado" in data and data.get("id_empleado") != orden.ID_EMPLEADO:
                orden.ID_EMPLEADO = data.get("id_empleado")
                u = Usuario.query.filter_by(ID_EMPLEADO=orden.ID_EMPLEADO).first()
                if u:
                    db.session.add(Notificacion(
                        ID_USUARIO=u.ID_USUARIO,
                        ID_ORDEN=orden.ID_ORDEN,
                        MENSAJE=f"Asignación: {orden.TITULO}"
                    ))
            if "prioridad" in data:
                orden.PRIORIDAD = data.get("prioridad")

        db.session.commit()
        return jsonify({"success": True}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# --- 4. AVANCES ---
# ---------------------------------------------------------
@ordenes_bp.route("/ordenes/<int:id_orden>/avances", methods=["POST"])
@jwt_required()
def add_avance(id_orden):
    if tiene_permiso_ordenes():
        return jsonify({"error": "Admin solo lee, no crea avances."}), 403
    claims = get_jwt()
    try:
        nuevo = AvanceOrden(
            ID_ORDEN=id_orden,
            AUTOR=claims.get("user_nombre", "Empleado"),
            MENSAJE=(request.json or {}).get("mensaje"),
            FECHA_HORA=datetime.now()
        )
        db.session.add(nuevo)
        db.session.commit()
        return jsonify({"success": True, "avance": nuevo.to_dict()}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ordenes_bp.route("/ordenes/<int:id_orden>/avances", methods=["GET"])
@jwt_required()
def get_avances(id_orden):
    avances = AvanceOrden.query.filter_by(ID_ORDEN=id_orden).order_by(AvanceOrden.FECHA_HORA.asc()).all()
    return jsonify([a.to_dict() for a in avances]), 200


# ---------------------------------------------------------
# --- 5. DELETE ---
# ---------------------------------------------------------
@ordenes_bp.route("/ordenes/<int:id_orden>", methods=["DELETE"])
@jwt_required()
def soft_delete_orden(id_orden):
    if tiene_permiso_ordenes():
        o = OrdenTrabajo.query.get(id_orden)
        if o:
            o.ELIMINADA = True
            db.session.commit()
            return jsonify({"message": "Papelera"}), 200
    return jsonify({"error": "No autorizado"}), 403


@ordenes_bp.route("/ordenes/<int:id_orden>/perma", methods=["DELETE"])
@jwt_required()
def perma_delete_orden(id_orden):
    if get_jwt().get("rol_nombre") != "Master_Admin":
        return jsonify({"error": "Solo Master Admin"}), 403
    try:
        Notificacion.query.filter_by(ID_ORDEN=id_orden).delete()
        AvanceOrden.query.filter_by(ID_ORDEN=id_orden).delete()
        OrdenTrabajo.query.filter_by(ID_ORDEN=id_orden).delete()
        db.session.commit()
        return jsonify({"message": "Eliminado permanentemente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@ordenes_bp.route("/ordenes/empleado/<int:id_empleado>", methods=["GET"])
@jwt_required()
def get_ordenes_por_empleado(id_empleado):
    ordenes = OrdenTrabajo.query.filter_by(ID_EMPLEADO=id_empleado, ELIMINADA=False).order_by(OrdenTrabajo.FECHA_INICIO.desc()).all()
    return jsonify([o.to_dict() for o in ordenes]), 200


# ---------------------------------------------------------
# --- 6. CREAR ORDEN DESDE SOLICITUD (TU CÓDIGO INTACTO) ---
# (lo dejo igual para no romperte nada)
# ---------------------------------------------------------
@ordenes_bp.route('/ordenes/crear-desde-solicitud', methods=['POST'])
@jwt_required()
def crear_orden_solicitud():
    if not tiene_permiso_ordenes():
        return jsonify({"error": "No autorizado"}), 403

    data = request.json or {}
    id_solicitud = data.get('id_solicitud')
    id_empleado = data.get('id_empleado')

    if not id_solicitud:
        return jsonify({"error": "Faltan datos (solicitud)"}), 400

    try:
        solicitud = SolicitudStock.query.get(id_solicitud)
        if not solicitud:
            return jsonify({"error": "Solicitud no encontrada"}), 404

        items_desc = []
        if solicitud.detalles:
            for d in solicitud.detalles:
                nombre_mat = d.material.NOMBRE if d.material else "Material desconocido"
                unidad_mat = d.material.UNIDAD_MEDIDA if d.material else "u."
                items_desc.append(f"- {nombre_mat}: {d.CANTIDAD} {unidad_mat}")
            texto_detalle = "\n".join(items_desc)
        else:
            texto_detalle = "Sin detalles registrados."

        obs_solicitud = solicitud.OBSERVACION_GENERAL or 'Ninguna'

        descripcion_final = (
            f"Armar pedido para {solicitud.dep_solicitante.NOMBRE}.\n\n"
            f"Items:\n{texto_detalle}\n\n"
            f"Obs Solicitud: {obs_solicitud}"
        )

        nueva_orden = OrdenTrabajo(
            ID_ESTADO_ORDEN=1,
            ID_DEPOSITO=solicitud.ID_DEPOSITO_PROVEEDOR,
            ID_EMPLEADO=id_empleado if id_empleado else None,
            TITULO=f"Preparar Pedido #{id_solicitud} - {solicitud.dep_solicitante.NOMBRE}",
            DESCRIPCION=descripcion_final,
            PRIORIDAD="Alta",
            FECHA_INICIO=datetime.now(),
            TIPO_ORDEN="Logistica",
            FECHA_LIMITE=None
        )
        db.session.add(nueva_orden)

        solicitud.ID_ESTADO = 2

        usuario_empleado = None
        if id_empleado:
            usuario_empleado = Usuario.query.filter_by(ID_EMPLEADO=id_empleado).first()
            if usuario_empleado:
                noti = Notificacion(
                    ID_USUARIO=usuario_empleado.ID_USUARIO,
                    ID_ORDEN=None,
                    MENSAJE=f"📋 Tarea Asignada: Preparar pedido #{id_solicitud}",
                    LEIDA=False,
                    FECHA_CREACION=datetime.now(),
                )
                db.session.add(noti)

        db.session.commit()

        if usuario_empleado and 'noti' in locals():
            noti.ID_ORDEN = nueva_orden.ID_ORDEN
            db.session.commit()

        return jsonify({
            "success": True,
            "message": "Orden creada." + (" Pendiente de asignación." if not id_empleado else " Asignada correctamente."),
            "orden_id": nueva_orden.ID_ORDEN
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creando orden: {e}")
        return jsonify({"error": str(e)}), 500
