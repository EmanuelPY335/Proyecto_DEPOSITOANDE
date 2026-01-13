# backend/ordenes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime, date
from sqlalchemy import text
# 1. IMPORTAMOS Modelos necesarios (Incluyendo Inventario y Movimientos)
from db import db, OrdenTrabajo, EstadoOrden, Empleado, Usuario, AvanceOrden, Notificacion, Inventario, MovimientoMaterial, TipoMovimiento, SolicitudStock

ordenes_bp = Blueprint("ordenes", __name__)

# ---------------------------------------------------------
# 🛡️ HELPER: VERIFICACIÓN DE PERMISOS
# ---------------------------------------------------------
def tiene_permiso_ordenes():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)
        if not usuario or not usuario.rol: return False
        nombre_rol = usuario.rol.NOMBRE_ROL
        if nombre_rol in ["Master_Admin", "Admin"]: return True
        
        sql = text("""
            SELECT 1 FROM permiso_x_rol pxr
            JOIN permiso p ON pxr.ID_PERMISO = p.ID_PERMISO
            WHERE pxr.ID_ROL = :id_rol AND p.NOMBRE_PERMISO = 'gestion_ordenes'
        """)
        resultado = db.session.execute(sql, {'id_rol': usuario.ID_ROL}).fetchone()
        return True if resultado else False
    except: return False

def format_nombre(text):
    if not text: return ""
    return " ".join(word.capitalize() for word in text.lower().split())

# --- HELPER: OBTENER INVENTARIO PARA SELECTOR ---
@ordenes_bp.route("/recursos/inventario-local", methods=["GET"])
@jwt_required()
def get_inventario_local():
    """Retorna el stock disponible en el depósito del usuario actual para crear órdenes de movimiento."""
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    usuario = Usuario.query.get(user_id)
    
    if not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
        return jsonify([]), 200

    # Obtener inventario del depósito del usuario
    inventarios = Inventario.query.filter_by(ID_DEPOSITO=usuario.empleado.ID_DEPOSITO).all()
    lista = []
    for inv in inventarios:
        if inv.CANTIDAD_ACTUAL > 0:
            lista.append({
                "lote_id": inv.ID_LOTE,
                "material": inv.lote.material.NOMBRE,
                "codigo": inv.lote.material.CODIGO_UNICO,
                "cantidad": inv.CANTIDAD_ACTUAL,
                "unidad": inv.lote.material.UNIDAD_MEDIDA
            })
    return jsonify(lista), 200

# --- 1. LISTAR ÓRDENES ---
@ordenes_bp.route("/ordenes", methods=["GET"])
@jwt_required()
def get_ordenes():
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    usuario_actual = Usuario.query.get(user_id)
    empleado_id_actual = usuario_actual.empleado.ID_EMPLEADO if usuario_actual.empleado else None
    es_gestor = tiene_permiso_ordenes()

    try:
        # Lazy check de vencimientos
        estado_vencido = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Fin de tiempo limite")).first()
        if estado_vencido:
            now = datetime.now()
            estados_activos = ["Pendiente", "En Progreso"]
            # Join explícito para evitar errores si la relación no está cargada
            ordenes_vencidas = OrdenTrabajo.query.join(EstadoOrden).filter(
                OrdenTrabajo.FECHA_LIMITE != None,
                OrdenTrabajo.FECHA_LIMITE < now,
                EstadoOrden.ESTADO_ORDEN.in_(estados_activos)
            ).all()
            
            count = 0
            for o in ordenes_vencidas:
                o.ID_ESTADO_ORDEN = estado_vencido.ID_ESTADO_ORDEN
                count += 1
            if count > 0: db.session.commit()

        query = db.session.query(OrdenTrabajo, Empleado, Usuario)\
            .outerjoin(Empleado, OrdenTrabajo.ID_EMPLEADO == Empleado.ID_EMPLEADO)\
            .outerjoin(Usuario, Empleado.ID_EMPLEADO == Usuario.ID_EMPLEADO)\
            .filter(OrdenTrabajo.ELIMINADA == False)

        if not es_gestor:
            if not empleado_id_actual: return jsonify([]), 200
            query = query.filter(OrdenTrabajo.ID_EMPLEADO == empleado_id_actual)
        
        results = query.order_by(OrdenTrabajo.ID_ESTADO_ORDEN.asc(), OrdenTrabajo.FECHA_INICIO.desc()).all()
        
        lista_ordenes = []
        for orden, empleado_asignado, usuario_asignado in results:
            data = orden.to_dict()
            # Inyectar datos extra del movimiento si existen
            data["tipo_orden"] = orden.TIPO_ORDEN or "General"
            data["cantidad_mov"] = orden.CANTIDAD_MOVIMIENTO
            data["nueva_ubicacion"] = orden.NUEVA_UBICACION
            
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

# --- 2. CREAR ORDEN (MANUAL) ---
@ordenes_bp.route("/ordenes", methods=["POST"])
@jwt_required()
def create_orden():
    if not tiene_permiso_ordenes():
        return jsonify({"error": "No tienes permisos."}), 403

    data = request.json
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    user_id = int(claims.get("sub"))

    try:
        estado_pendiente = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Pendiente")).first()
        if not estado_pendiente: return jsonify({"error": "Estado Pendiente no configurado"}), 500

        # Lógica de Depósito
        id_deposito = None
        if rol == "Master_Admin":
            id_deposito = data.get("id_deposito")
        else:
            usuario = Usuario.query.get(user_id)
            if usuario.empleado: id_deposito = usuario.empleado.ID_DEPOSITO
        
        if not id_deposito: return jsonify({"error": "Falta depósito o usuario no asignado a uno."}), 400

        # Validar Empleado (Permite NULL)
        id_empleado = data.get("id_empleado")
        
        # --- NUEVO: DATOS DE MOVIMIENTO ---
        tipo_orden = data.get("tipo_orden", "General")
        id_lote = data.get("id_lote") if tipo_orden == "Movimiento" else None
        cantidad = float(data.get("cantidad", 0)) if tipo_orden == "Movimiento" else 0
        ubicacion = data.get("nueva_ubicacion") if tipo_orden == "Movimiento" else None

        fecha_limite = None
        if data.get("fecha_limite"):
            try:
                fecha_limite = datetime.strptime(data.get("fecha_limite"), "%Y-%m-%dT%H:%M")
            except ValueError: pass

        nueva_orden = OrdenTrabajo(
            TITULO=data.get("titulo"),
            DESCRIPCION=data.get("descripcion"),
            PRIORIDAD=data.get("prioridad", "Media"),
            ID_DEPOSITO=id_deposito,
            ID_EMPLEADO=id_empleado if id_empleado else None,
            ID_ESTADO_ORDEN=estado_pendiente.ID_ESTADO_ORDEN,
            FECHA_INICIO=datetime.now(),
            FECHA_LIMITE=fecha_limite,
            
            # Campos nuevos
            TIPO_ORDEN=tipo_orden,
            ID_LOTE_OBJETIVO=id_lote,
            CANTIDAD_MOVIMIENTO=cantidad,
            NUEVA_UBICACION=ubicacion
        )

        db.session.add(nueva_orden)
        db.session.flush()

        # Notificación (Solo si hay empleado asignado)
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

# --- 3. ACTUALIZAR ORDEN ---
@ordenes_bp.route("/ordenes/<int:id_orden>", methods=["PUT"])
@jwt_required()
def update_orden(id_orden):
    data = request.json
    es_gestor = tiene_permiso_ordenes()
    
    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden: return jsonify({"error": "No encontrada"}), 404

        # MODO EDICIÓN INFO
        if data.get("accion") == "editar_info":
            if not es_gestor: return jsonify({"error": "No autorizado"}), 403
            if "titulo" in data: orden.TITULO = data.get("titulo")
            if "descripcion" in data: orden.DESCRIPCION = data.get("descripcion")
            if "prioridad" in data: orden.PRIORIDAD = data.get("prioridad")
            if "fecha_limite" in data:
                val = data.get("fecha_limite")
                orden.FECHA_LIMITE = datetime.strptime(val, "%Y-%m-%dT%H:%M") if val else None
            db.session.commit()
            return jsonify({"success": True}), 200

        # ACTUALIZACIÓN ESTADO / HERRAMIENTAS
        if "herramientas" in data: orden.HERRAMIENTAS = data.get("herramientas")
            
        if "nuevo_estado" in data:
            nuevo_estado_str = data.get("nuevo_estado")
            st = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike(nuevo_estado_str)).first()
            
            if st: 
                orden.ID_ESTADO_ORDEN = st.ID_ESTADO_ORDEN
                
                # --- LÓGICA DE FINALIZACIÓN ---
                es_finalizada = st.ESTADO_ORDEN in ["Aprobada", "Completada", "Finalizada"]
                
                if es_finalizada:
                    orden.FECHA_CIERRE = datetime.now()
                    
                    # 🚀 REGISTRAR MOVIMIENTO SI CORRESPONDE
                    if orden.TIPO_ORDEN == "Movimiento" and orden.ID_LOTE_OBJETIVO:
                        tipo_mov = TipoMovimiento.query.filter_by(TIPO_MOVIMIENTO="Movimiento Interno").first()
                        if tipo_mov:
                            # Creamos el registro en historial
                            mov = MovimientoMaterial(
                                ID_TIPO_MOVIMIENTO=tipo_mov.ID_TIPO_MOVIMIENTO,
                                ID_EMPLEADO=orden.ID_EMPLEADO,
                                ID_DEPOSITO=orden.ID_DEPOSITO,
                                ID_LOTE=orden.ID_LOTE_OBJETIVO,
                                FECHA_MOVIMIENTO=date.today(),
                                CANTIDAD=orden.CANTIDAD_MOVIMIENTO,
                                OBSERVACIONES=f"Reubicación interna: {orden.NUEVA_UBICACION}. (Orden #{orden.ID_ORDEN})"
                            )
                            db.session.add(mov)
                            # Nota: No restamos del inventario total porque sigue en el mismo depósito,
                            # solo registramos que se movió de lugar.

                    # Calcular Tiempo
                    if orden.FECHA_INICIO:
                        diff = orden.FECHA_CIERRE - orden.FECHA_INICIO
                        dias, seconds = diff.days, diff.seconds
                        horas = seconds // 3600
                        mins = (seconds % 3600) // 60
                        txt = []
                        if dias>0: txt.append(f"{dias}d")
                        if horas>0: txt.append(f"{horas}h")
                        txt.append(f"{mins}m")
                        orden.TIEMPO_EMPLEADO = " ".join(txt) if txt else "1m"
            else:
                 return jsonify({"error": "Estado no existe"}), 400

        if es_gestor:
            if "id_empleado" in data and data.get("id_empleado") != orden.ID_EMPLEADO:
                orden.ID_EMPLEADO = data.get("id_empleado")
                # Notificar nuevo asignado
                u = Usuario.query.filter_by(ID_EMPLEADO=orden.ID_EMPLEADO).first()
                if u: db.session.add(Notificacion(ID_USUARIO=u.ID_USUARIO, ID_ORDEN=orden.ID_ORDEN, MENSAJE=f"Asignación: {orden.TITULO}"))
            if "prioridad" in data: orden.PRIORIDAD = data.get("prioridad")

        db.session.commit()
        return jsonify({"success": True}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- 4. AVANCES ---
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
            MENSAJE=request.json.get("mensaje"), 
            FECHA_HORA=datetime.now()
        )
        db.session.add(nuevo)
        db.session.commit()
        return jsonify({"success": True, "avance": nuevo.to_dict()}), 201
    except Exception as e: return jsonify({"error": str(e)}), 500

@ordenes_bp.route("/ordenes/<int:id_orden>/avances", methods=["GET"])
@jwt_required()
def get_avances(id_orden):
    avances = AvanceOrden.query.filter_by(ID_ORDEN=id_orden).order_by(AvanceOrden.FECHA_HORA.asc()).all()
    return jsonify([a.to_dict() for a in avances]), 200

# --- 5. DELETE ---
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

@ordenes_bp.route('/ordenes/crear-desde-solicitud', methods=['POST'])
@jwt_required()
def crear_orden_solicitud():
    """
    Convierte una Solicitud de Material en una Orden de Trabajo.
    Puede crearse SIN empleado asignado (pendiente de asignación).
    """
    if not tiene_permiso_ordenes():
        return jsonify({"error": "No autorizado"}), 403

    data = request.json
    id_solicitud = data.get('id_solicitud')
    id_empleado = data.get('id_empleado') # Puede ser None o no venir
    
    if not id_solicitud:
        return jsonify({"error": "Faltan datos (solicitud)"}), 400

    try:
        solicitud = SolicitudStock.query.get(id_solicitud)
        if not solicitud: return jsonify({"error": "Solicitud no encontrada"}), 404

        # --- CORRECCIÓN AQUÍ: Construir descripción desde los detalles ---
        items_desc = []
        if solicitud.detalles:
            for d in solicitud.detalles:
                # Accedemos a la relación .material para obtener nombre y unidad
                nombre_mat = d.material.NOMBRE if d.material else "Material desconocido"
                unidad_mat = d.material.UNIDAD_MEDIDA if d.material else "u."
                items_desc.append(f"- {nombre_mat}: {d.CANTIDAD} {unidad_mat}")
            
            texto_detalle = "\n".join(items_desc)
        else:
            texto_detalle = "Sin detalles registrados."

        # Usamos OBSERVACION_GENERAL en lugar de OBSERVACION
        obs_solicitud = solicitud.OBSERVACION_GENERAL or 'Ninguna'
        
        descripcion_final = (
            f"Armar pedido para {solicitud.dep_solicitante.NOMBRE}.\n\n"
            f"Items:\n{texto_detalle}\n\n"
            f"Obs Solicitud: {obs_solicitud}"
        )
        # -------------------------------------------------------------

        # 1. Crear la Orden
        nueva_orden = OrdenTrabajo(
            ID_ESTADO_ORDEN=1, # Pendiente
            ID_DEPOSITO=solicitud.ID_DEPOSITO_PROVEEDOR, 
            ID_EMPLEADO=id_empleado if id_empleado else None,
            TITULO=f"Preparar Pedido #{id_solicitud} - {solicitud.dep_solicitante.NOMBRE}",
            DESCRIPCION=descripcion_final, # <--- Usamos la descripción generada arriba
            PRIORIDAD="Alta",
            FECHA_INICIO=datetime.now(),
            TIPO_ORDEN="Logistica",
            FECHA_LIMITE=None 
        )
        db.session.add(nueva_orden)
        
        # 2. Actualizar Estado de la Solicitud -> 2 (En Proceso)
        solicitud.ID_ESTADO = 2
        
        # 3. Notificar al Empleado (SOLO SI SE ASIGNÓ AHORA)
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
        
        # Actualizar ID de orden en notificación si hubo asignación
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
        print(f"Error creando orden: {e}") # Importante para ver errores en consola
        return jsonify({"error": str(e)}), 500