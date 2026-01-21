from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Notificacion, Usuario, Vale, OrdenTrabajo, SolicitudStock
from datetime import datetime

notificaciones_bp = Blueprint('notificaciones', __name__)

# --- HELPER: GENERAR LINKS DE REDIRECCIÓN ---
def obtener_link_por_tipo(mensaje, id_referencia=None):
    msg_lower = mensaje.lower()
    
    # 1. Rutas y Viajes (Choferes) -> Al Mapa
    if "ruta" in msg_lower or "viaje" in msg_lower: 
        return "/Mapa"
    
    # 2. Tareas y Órdenes (Personal) -> A la orden específica
    if any(x in msg_lower for x in ["orden", "tarea", "preparar", "asignada", "asignación"]): 
        if id_referencia:
            return f"/ordenes-trabajo?id={id_referencia}"
        return "/ordenes-trabajo"
    
    # 3. Pedidos, Solicitudes y Vales (Admins/Encargados)
    if any(x in msg_lower for x in ["solicitud", "pedido", "aprobar", "vale"]): 
        return "/movimientos?tab=pedidos"
    
    # 4. Recepción de material
    if any(x in msg_lower for x in ["llegada", "recepción"]):
        return "/movimientos"

    return "#"

# ========================================================
# 1. NOTIFICACIONES RÁPIDAS (MINI MENU - NAVBAR)
# ========================================================
@notificaciones_bp.route('/notificaciones', methods=['GET'])
@jwt_required()
def get_notificaciones():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    rol_nombre = usuario.rol.NOMBRE_ROL
    mi_deposito_id = usuario.empleado.ID_DEPOSITO if usuario.empleado else None

    # Recibos de lectura temporales (##SEEN##) para notificaciones dinámicas
    recibos = db.session.query(Notificacion.MENSAJE).filter(
        Notificacion.ID_USUARIO == current_user_id,
        Notificacion.MENSAJE.like("##SEEN##%")
    ).all()
    ids_ya_leidos = {r[0].replace("##SEEN##", "") for r in recibos}

    def esta_leida(id_dinamico):
        return id_dinamico in ids_ya_leidos

    lista_final = []

    # -------------------------------------------------
    # A. NOTIFICACIONES PERSISTENTES (Base de Datos)
    # -------------------------------------------------
    # Traemos más (30) para que el frontend filtre por fecha
    db_notis = Notificacion.query.filter(
        Notificacion.ID_USUARIO == current_user_id,
        ~Notificacion.MENSAJE.startswith("##SEEN##") 
    ).order_by(Notificacion.FECHA_CREACION.desc()).limit(30).all()

    for n in db_notis:
        tipo_visual = "Info"
        if "Ruta" in n.MENSAJE: tipo_visual = "Ruta"
        elif "Orden" in n.MENSAJE: tipo_visual = "Orden"
        elif "Solicitud" in n.MENSAJE: tipo_visual = "Pedido"

        # Link inteligente usando ID guardado si existe
        id_ref = getattr(n, 'ID_ORDEN', None)
        link = obtener_link_por_tipo(n.MENSAJE, id_ref)

        lista_final.append({
            "id": f"db-{n.ID_NOTIFICACION}",
            "mensaje": n.MENSAJE,
            "leida": n.LEIDA,
            "fecha_display": n.FECHA_CREACION.strftime('%d/%m %H:%M'),
            "fecha_iso": n.FECHA_CREACION.isoformat(), # CLAVE PARA FILTRAR
            "tipo": tipo_visual,
            "link": link,
            "origen": "db"
        })

    # -------------------------------------------------
    # B. ALERTAS DINÁMICAS (Sistema en Tiempo Real)
    # -------------------------------------------------

    # 1. ADMINS Y MASTER
    if rol_nombre in ["Master_Admin", "Administrador"]:
        # Solicitudes Pendientes
        q_sol = SolicitudStock.query.filter_by(ID_ESTADO=1)
        if rol_nombre == "Administrador" and mi_deposito_id:
            q_sol = q_sol.filter_by(ID_DEPOSITO_PROVEEDOR=mi_deposito_id)
        
        for s in q_sol.all():
            id_temp = f"sol-{s.ID_SOLICITUD}"
            cant_items = len(s.detalles)
            txt_resumen = f"{cant_items} items" if cant_items > 1 else "materiales"
            
            lista_final.append({
                "id": id_temp,
                "mensaje": f"📦 Solicitud #{s.ID_SOLICITUD}: {s.dep_solicitante.NOMBRE} necesita {txt_resumen}.",
                "leida": esta_leida(id_temp),
                "fecha_display": s.FECHA_SOLICITUD.strftime('%d/%m %H:%M'),
                "fecha_iso": s.FECHA_SOLICITUD.isoformat(),
                "tipo": "Pedido",
                "link": "/movimientos?tab=pedidos",
                "origen": "sistema"
            })
            
        # Vales Pendientes de Aprobación
        q_vales = Vale.query.filter_by(ID_ESTADO_VALE=1)
        if rol_nombre == "Administrador" and mi_deposito_id:
             q_vales = q_vales.filter_by(ID_DEPOSITO_ORIGEN=mi_deposito_id)

        for v in q_vales.all():
            id_temp = f"apr-vale-{v.ID_VALE}"
            lista_final.append({
                "id": id_temp,
                "mensaje": f"🛡️ Aprobar Salida: Ruta #{v.GRUPO_RUTA} creada por personal.",
                "leida": esta_leida(id_temp),
                "fecha_display": v.FECHA_CREACION.strftime('%d/%m %H:%M'),
                "fecha_iso": v.FECHA_CREACION.isoformat(),
                "tipo": "Alerta",
                "link": "/movimientos?tab=pedidos",
                "origen": "sistema"
            })
            
        # Confirmación de Llegadas (Recepción)
        if mi_deposito_id:
            q_recepcion = Vale.query.filter_by(ID_ESTADO_VALE=3, ID_DEPOSITO_DESTINO=mi_deposito_id)
            for v in q_recepcion.all():
                id_temp = f"rec-vale-{v.ID_VALE}"
                # Usamos fecha de salida como referencia o fecha actual si no hay
                fecha_ref = v.FECHA_SALIDA if v.FECHA_SALIDA else datetime.now()
                
                lista_final.append({
                    "id": id_temp,
                    "mensaje": f"🏁 Llegada de material: Ruta #{v.GRUPO_RUTA} desde {v.origen.NOMBRE}. Confirmar.",
                    "leida": esta_leida(id_temp),
                    "fecha_display": fecha_ref.strftime('%d/%m %H:%M'),
                    "fecha_iso": fecha_ref.isoformat(),
                    "tipo": "Check",
                    "link": "/movimientos",
                    "origen": "sistema"
                })

    # 2. CHOFERES (Rutas Asignadas)
    if rol_nombre == "Chofer":
        # Estado 2 = En Tránsito / Asignado
        rutas_aprobadas = Vale.query.filter_by(ID_CHOFER=current_user_id, ID_ESTADO_VALE=2).all()
        for r in rutas_aprobadas:
            id_temp = f"ruta-{r.ID_VALE}"
            lista_final.append({
                "id": id_temp,
                "mensaje": f"🚚 Ruta Lista #{r.GRUPO_RUTA}: Destino {r.destino.NOMBRE}. ¡Ver Mapa!",
                "leida": esta_leida(id_temp),
                "fecha_display": r.FECHA_CREACION.strftime('%H:%M'),
                "fecha_iso": r.FECHA_CREACION.isoformat(),
                "tipo": "Ruta",
                "link": "/Mapa",
                "origen": "sistema"
            })

    # 3. PERSONAL (Tareas Asignadas)
    ordenes = OrdenTrabajo.query.filter_by(ID_EMPLEADO=current_user_id, ID_ESTADO_ORDEN=1).all()
    for o in ordenes:
        id_temp = f"ord-{o.ID_ORDEN}"
        lista_final.append({
            "id": id_temp,
            "mensaje": f"📋 Tarea Asignada: {o.TITULO}",
            "leida": esta_leida(id_temp),
            "fecha_display": o.FECHA_INICIO.strftime('%d/%m'),
            "fecha_iso": o.FECHA_INICIO.isoformat(),
            "tipo": "Orden",
            "link": f"/ordenes-trabajo?id={o.ID_ORDEN}", 
            "origen": "sistema"
        })

    # Ordenar todo: Primero las NO leídas, luego por fecha más reciente
    lista_final.sort(key=lambda x: (not x['leida'], x['fecha_iso']), reverse=True)
    return jsonify(lista_final), 200

# ========================================================
# 2. BUZÓN COMPLETO (PÁGINA DEDICADA)
# ========================================================
@notificaciones_bp.route('/buzon', methods=['GET'])
@jwt_required()
def get_buzon_completo():
    current_user_id = get_jwt_identity()
    
    db_notis = Notificacion.query.filter(
        Notificacion.ID_USUARIO == current_user_id,
        ~Notificacion.MENSAJE.startswith("##SEEN##")
    ).order_by(Notificacion.FECHA_CREACION.desc()).limit(100).all()

    resultado = []
    for n in db_notis:
        # Link inteligente
        id_ref = getattr(n, 'ID_ORDEN', None)
        link = obtener_link_por_tipo(n.MENSAJE, id_ref)

        resultado.append({
            "id": n.ID_NOTIFICACION, 
            "mensaje": n.MENSAJE,
            "leida": n.LEIDA,
            "starred": getattr(n, 'STARRED', False),
            "fecha": n.FECHA_CREACION.strftime('%d/%m/%Y %H:%M'),
            "fecha_iso": n.FECHA_CREACION.isoformat(),
            "link": link,
            "sender": "Sistema SISDEPO"
        })
    
    return jsonify(resultado), 200

# ========================================================
# 3. ACCIONES DE LECTURA / ESCRITURA
# ========================================================

@notificaciones_bp.route('/notificaciones/leer/<string:id_completo>', methods=['PUT'])
@jwt_required()
def marcar_leida_dinamica(id_completo):
    current_user_id = get_jwt_identity()
    
    # Caso 1: Notificación de Base de Datos (db-123)
    if id_completo.startswith("db-"):
        try:
            id_real = int(id_completo.split("-")[1])
            notif = Notificacion.query.filter_by(ID_NOTIFICACION=id_real, ID_USUARIO=current_user_id).first()
            if notif:
                notif.LEIDA = True
                db.session.commit()
            return jsonify({"success": True}), 200
        except: return jsonify({"error": "ID invalido"}), 400
    
    # Caso 2: Notificación Dinámica (ruta-123, sol-456)
    # Creamos una marca "fantasma" en la BD para recordar que se leyó
    marca_existe = Notificacion.query.filter_by(ID_USUARIO=current_user_id, MENSAJE=f"##SEEN##{id_completo}").first()
    if not marca_existe:
        nueva_marca = Notificacion(
            ID_USUARIO=current_user_id, 
            MENSAJE=f"##SEEN##{id_completo}", 
            LEIDA=True, 
            FECHA_CREACION=datetime.now()
        )
        db.session.add(nueva_marca)
        db.session.commit()
    return jsonify({"success": True}), 200

@notificaciones_bp.route('/buzon/leer-todas', methods=['PUT'])
@jwt_required()
def marcar_todas_buzon():
    current_user_id = get_jwt_identity()
    Notificacion.query.filter(
        Notificacion.ID_USUARIO == current_user_id,
        Notificacion.LEIDA == False,
        ~Notificacion.MENSAJE.startswith("##SEEN##")
    ).update({Notificacion.LEIDA: True})
    db.session.commit()
    return jsonify({"success": True}), 200

# --- ACCIONES INDIVIDUALES BUZÓN ---

@notificaciones_bp.route('/buzon/<int:id>/leer', methods=['PUT'])
@jwt_required()
def buzon_marcar_leida(id):
    noti = Notificacion.query.get_or_404(id)
    noti.LEIDA = True
    db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/<int:id>/noleer', methods=['PUT'])
@jwt_required()
def buzon_marcar_noleida(id):
    noti = Notificacion.query.get_or_404(id)
    noti.LEIDA = False
    db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/<int:id>/star', methods=['PUT'])
@jwt_required()
def buzon_toggle_star(id):
    data = request.json
    estado = data.get('starred', True)
    noti = Notificacion.query.get_or_404(id)
    if hasattr(noti, 'STARRED'):
        noti.STARRED = estado
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"error": "Campo STARRED no existe en BD"}), 500

@notificaciones_bp.route('/buzon/<int:id>', methods=['DELETE'])
@jwt_required()
def buzon_eliminar(id):
    noti = Notificacion.query.get_or_404(id)
    db.session.delete(noti)
    db.session.commit()
    return jsonify({"success": True})

# --- ACCIONES BATCH (LOTE) ---

@notificaciones_bp.route('/buzon/batch', methods=['DELETE'])
@jwt_required()
def buzon_batch_delete():
    ids = request.json.get('ids', [])
    if ids:
        Notificacion.query.filter(Notificacion.ID_NOTIFICACION.in_(ids)).delete(synchronize_session=False)
        db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/batch/read', methods=['PUT'])
@jwt_required()
def buzon_batch_read():
    ids = request.json.get('ids', [])
    if ids:
        Notificacion.query.filter(Notificacion.ID_NOTIFICACION.in_(ids)).update({Notificacion.LEIDA: True}, synchronize_session=False)
        db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/batch/unread', methods=['PUT'])
@jwt_required()
def buzon_batch_unread():
    ids = request.json.get('ids', [])
    if ids:
        Notificacion.query.filter(Notificacion.ID_NOTIFICACION.in_(ids)).update({Notificacion.LEIDA: False}, synchronize_session=False)
        db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/batch/star', methods=['PUT'])
@jwt_required()
def buzon_batch_star():
    data = request.json
    ids = data.get('ids', [])
    estado = data.get('starred', True)
    if ids and hasattr(Notificacion, 'STARRED'):
        Notificacion.query.filter(Notificacion.ID_NOTIFICACION.in_(ids)).update({Notificacion.STARRED: estado}, synchronize_session=False)
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "No soportado o sin IDs"}), 200