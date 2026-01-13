from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Notificacion, Usuario, Vale, OrdenTrabajo, SolicitudStock
from datetime import datetime

notificaciones_bp = Blueprint('notificaciones', __name__)

@notificaciones_bp.route('/notificaciones', methods=['GET'])
@jwt_required()
def get_notificaciones():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    rol_nombre = usuario.rol.NOMBRE_ROL
    mi_deposito_id = usuario.empleado.ID_DEPOSITO if usuario.empleado else None

    # --- PASO PREVIO: OBTENER "RECIBOS DE LECTURA" ---
    recibos = db.session.query(Notificacion.MENSAJE).filter(
        Notificacion.ID_USUARIO == current_user_id,
        Notificacion.MENSAJE.like("##SEEN##%")
    ).all()
    ids_ya_leidos = {r[0].replace("##SEEN##", "") for r in recibos}

    lista_final = []

    # ========================================================
    # A. NOTIFICACIONES PERSISTENTES (Historial en Base de Datos)
    # ========================================================
    db_notis = Notificacion.query.filter(
        Notificacion.ID_USUARIO == current_user_id,
        ~Notificacion.MENSAJE.startswith("##SEEN##") 
    ).order_by(Notificacion.FECHA_CREACION.desc()).limit(15).all()

    for n in db_notis:
        tipo = "Info"
        link = None
        if "Ruta" in n.MENSAJE:
            tipo = "Ruta"
            link = "/Mapa"
        elif "Orden" in n.MENSAJE:
            tipo = "Orden"
            link = "/ordenes-trabajo"
        elif "Solicitud" in n.MENSAJE or "rechazada" in n.MENSAJE:
             tipo = "Pedido"
             link = "/materiales" # O donde gestionen sus pedidos

        lista_final.append({
            "id": f"db-{n.ID_NOTIFICACION}",
            "mensaje": n.MENSAJE,
            "leida": n.LEIDA,
            "fecha": n.FECHA_CREACION.strftime('%d/%m %H:%M'),
            "tipo": tipo,
            "link": link
        })

    # ========================================================
    # B. NOTIFICACIONES EN TIEMPO REAL
    # ========================================================

    def esta_leida(id_dinamico):
        return id_dinamico in ids_ya_leidos

    # 1. ADMINS Y MASTER
    if rol_nombre in ["Master_Admin", "Administrador"]:
        
        # --- CASO A: Solicitudes (CORREGIDO PARA MÚLTIPLES ITEMS) ---
        q_sol = SolicitudStock.query.filter_by(ID_ESTADO=1)
        if rol_nombre == "Administrador" and mi_deposito_id:
            q_sol = q_sol.filter_by(ID_DEPOSITO_PROVEEDOR=mi_deposito_id)
        
        for s in q_sol.all():
            id_temp = f"sol-{s.ID_SOLICITUD}"
            
            # LÓGICA DE RESUMEN:
            cant_items = len(s.detalles)
            if cant_items == 0:
                texto_resumen = "sin items"
            elif cant_items == 1:
                # Si solo es 1, mostramos qué es: "50 Metros de Cable"
                d = s.detalles[0]
                texto_resumen = f"{d.CANTIDAD} {d.material.UNIDAD_MEDIDA} de {d.material.NOMBRE}"
            else:
                # Si son varios: "3 materiales variados"
                texto_resumen = f"{cant_items} materiales variados"

            lista_final.append({
                "id": id_temp,
                "mensaje": f"📦 Solicitud #{s.ID_SOLICITUD}: {s.dep_solicitante.NOMBRE} necesita {texto_resumen}.",
                "leida": esta_leida(id_temp),
                "fecha": s.FECHA_SOLICITUD.strftime('%d/%m %H:%M'),
                "tipo": "Pedido",
                "link": "/movimientos" # O la ruta de gestión de pedidos entrantes
            })

        # --- CASO B: Vales Pendientes ---
        q_vales = Vale.query.filter_by(ID_ESTADO_VALE=1)
        if rol_nombre == "Administrador" and mi_deposito_id:
             q_vales = q_vales.filter_by(ID_DEPOSITO_ORIGEN=mi_deposito_id)

        for v in q_vales.all():
            id_temp = f"apr-vale-{v.ID_VALE}"
            lista_final.append({
                "id": id_temp,
                "mensaje": f"🛡️ Aprobar Salida: Ruta #{v.GRUPO_RUTA} creada por personal. Revisar.",
                "leida": esta_leida(id_temp),
                "fecha": v.FECHA_CREACION.strftime('%d/%m %H:%M'),
                "tipo": "Alerta",
                "link": "/movimientos"
            })

        # --- CASO C: Recepción ---
        if mi_deposito_id:
            q_recepcion = Vale.query.filter_by(ID_ESTADO_VALE=3, ID_DEPOSITO_DESTINO=mi_deposito_id)
            for v in q_recepcion.all():
                id_temp = f"rec-vale-{v.ID_VALE}"
                lista_final.append({
                    "id": id_temp,
                    "mensaje": f"🏁 Llegada de material: Ruta #{v.GRUPO_RUTA} desde {v.origen.NOMBRE}. Confirmar recepción.",
                    "leida": esta_leida(id_temp),
                    "fecha": v.FECHA_SALIDA.strftime('%d/%m %H:%M') if v.FECHA_SALIDA else "",
                    "tipo": "Check",
                    "link": "/movimientos"
                })

    # 2. CHOFERES
    if rol_nombre == "Chofer":
        rutas_aprobadas = Vale.query.filter_by(ID_CHOFER=current_user_id, ID_ESTADO_VALE=2).all()
        for r in rutas_aprobadas:
            id_temp = f"ruta-{r.ID_VALE}"
            lista_final.append({
                "id": id_temp,
                "mensaje": f"🚚 Ruta Lista #{r.GRUPO_RUTA}: Destino {r.destino.NOMBRE}. ¡Iniciar viaje!",
                "leida": esta_leida(id_temp),
                "fecha": r.FECHA_CREACION.strftime('%H:%M'),
                "tipo": "Ruta",
                "link": "/Mapa"
            })

    # 3. PERSONAL INVENTARIO
    if rol_nombre == "Personal_Inventario":
        ordenes = OrdenTrabajo.query.filter_by(ID_EMPLEADO=current_user_id, ID_ESTADO_ORDEN=1).all()
        for o in ordenes:
            id_temp = f"ord-{o.ID_ORDEN}"
            lista_final.append({
                "id": id_temp,
                "mensaje": f"📋 Tarea Asignada: {o.TITULO}",
                "leida": esta_leida(id_temp),
                "fecha": o.FECHA_INICIO.strftime('%d/%m'),
                "tipo": "Orden",
                "link": "/ordenes-trabajo" 
            })

    # Ordenar: No leídas primero
    lista_final.sort(key=lambda x: (not x['leida'], x['fecha']), reverse=True)

    return jsonify(lista_final), 200


# ---------------------------------------------------------
# 2. MARCAR LEÍDA
# ---------------------------------------------------------
@notificaciones_bp.route('/notificaciones/leer/<string:id_completo>', methods=['PUT'])
@jwt_required()
def marcar_leida(id_completo):
    current_user_id = get_jwt_identity()
    
    # 1. SI ES NOTIFICACIÓN DE BASE DE DATOS (db-123)
    if id_completo.startswith("db-"):
        try:
            id_real = int(id_completo.split("-")[1])
            notif = Notificacion.query.filter_by(ID_NOTIFICACION=id_real, ID_USUARIO=current_user_id).first()
            if notif:
                notif.LEIDA = True
                db.session.commit()
                return jsonify({"success": True}), 200
            else:
                return jsonify({"error": "Notificación no encontrada"}), 404
        except:
            return jsonify({"error": "ID inválido"}), 400

    # 2. SI ES NOTIFICACIÓN DINÁMICA (sol-1, ruta-5, etc.)
    else:
        marca_existe = Notificacion.query.filter_by(
            ID_USUARIO=current_user_id, 
            MENSAJE=f"##SEEN##{id_completo}"
        ).first()

        if not marca_existe:
            nueva_marca = Notificacion(
                ID_USUARIO=current_user_id,
                MENSAJE=f"##SEEN##{id_completo}",
                LEIDA=True,
                FECHA_CREACION=datetime.now()
            )
            db.session.add(nueva_marca)
            db.session.commit()
        
        return jsonify({"success": True, "message": "Marcada como leída en memoria"}), 200

# 3. MARCAR TODAS
@notificaciones_bp.route('/notificaciones/leer-todas', methods=['PUT'])
@jwt_required()
def marcar_todas_leidas():
    current_user_id = get_jwt_identity()
    
    Notificacion.query.filter(
        Notificacion.ID_USUARIO == current_user_id, 
        Notificacion.LEIDA == False,
        ~Notificacion.MENSAJE.startswith("##SEEN##")
    ).update({Notificacion.LEIDA: True})

    db.session.commit()
    return jsonify({"success": True}), 200