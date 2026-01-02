# backend/ordenes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime
from sqlalchemy import text
# 1. IMPORTAMOS Notificacion
from db import db, OrdenTrabajo, EstadoOrden, Empleado, Usuario, AvanceOrden, Notificacion

ordenes_bp = Blueprint("ordenes", __name__)

# ---------------------------------------------------------
# 🛡️ HELPER: VERIFICACIÓN DE PERMISOS (Dinámico)
# ---------------------------------------------------------
def tiene_permiso_ordenes():
    """
    Verifica si el usuario tiene permiso de 'gestion_ordenes'.
    Master_Admin y Admin siempre pasan.
    Otros roles se verifican contra la BD.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)

        if not usuario or not usuario.rol:
            return False

        nombre_rol = usuario.rol.NOMBRE_ROL

        # 1. Acceso Directo para Superusuarios
        if nombre_rol in ["Master_Admin", "Admin"]:
            return True

        # 2. Verificación Dinámica en BD
        sql = text("""
            SELECT 1 
            FROM permiso_x_rol pxr
            JOIN permiso p ON pxr.ID_PERMISO = p.ID_PERMISO
            WHERE pxr.ID_ROL = :id_rol AND p.NOMBRE_PERMISO = 'gestion_ordenes'
        """)
        
        resultado = db.session.execute(sql, {'id_rol': usuario.ID_ROL}).fetchone()
        
        if resultado:
            return True
            
        return False

    except Exception as e:
        print(f"Error verificando permisos ordenes: {e}")
        return False

# --- FUNCIÓN AUXILIAR PARA FORMATEAR NOMBRES ---
def format_nombre(text):
    if not text: return ""
    return " ".join(word.capitalize() for word in text.lower().split())

# --- 1. LISTAR ÓRDENES (CON AUTO-VERIFICACIÓN DE VENCIMIENTO) ---
@ordenes_bp.route("/ordenes", methods=["GET"])
@jwt_required()
def get_ordenes():
    claims = get_jwt()
    # Obtenemos identidad para saber si es el empleado asignado
    user_id = int(claims.get("sub"))
    
    usuario_actual = Usuario.query.get(user_id)
    empleado_id_actual = usuario_actual.empleado.ID_EMPLEADO if usuario_actual.empleado else None
    
    # Verificamos si tiene "Poder de Gestión" (Admin/Gerente)
    es_gestor = tiene_permiso_ordenes()

    try:
        # === LAZY CHECK: Verificar vencimientos al listar ===
        estado_vencido = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Fin de tiempo limite")).first()
        
        if estado_vencido:
            now = datetime.now()
            # Solo verificamos estados activos que pueden vencer
            estados_activos_nombres = ["Pendiente", "En Progreso"] 
            estados_activos_objs = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.in_(estados_activos_nombres)).all()
            ids_activos = [e.ID_ESTADO_ORDEN for e in estados_activos_objs]

            if ids_activos:
                ordenes_vencidas = OrdenTrabajo.query.filter(
                    OrdenTrabajo.FECHA_LIMITE != None,
                    OrdenTrabajo.FECHA_LIMITE < now,
                    OrdenTrabajo.ID_ESTADO_ORDEN.in_(ids_activos)
                ).all()

                count = 0
                for o in ordenes_vencidas:
                    o.ID_ESTADO_ORDEN = estado_vencido.ID_ESTADO_ORDEN
                    count += 1
                
                if count > 0:
                    db.session.commit()
        # ====================================================

        query = db.session.query(OrdenTrabajo, Empleado, Usuario)\
            .outerjoin(Empleado, OrdenTrabajo.ID_EMPLEADO == Empleado.ID_EMPLEADO)\
            .outerjoin(Usuario, Empleado.ID_EMPLEADO == Usuario.ID_EMPLEADO)\
            .filter(OrdenTrabajo.ELIMINADA == False)

        # LÓGICA DE FILTRADO:
        # Si NO es gestor (Admin/Gerente), solo ve sus propias tareas.
        if not es_gestor:
            if not empleado_id_actual:
                return jsonify([]), 200 # Si no es empleado y no es gestor, no ve nada
            query = query.filter(OrdenTrabajo.ID_EMPLEADO == empleado_id_actual)
        
        # Si ES gestor, ve todo (la query no se filtra por empleado)
        
        results = query.order_by(OrdenTrabajo.ID_ESTADO_ORDEN.asc(), OrdenTrabajo.FECHA_INICIO.desc()).all()
        
        lista_ordenes = []
        for orden, empleado_asignado, usuario_asignado in results:
            data_orden = orden.to_dict()
            if empleado_asignado:
                 nombre_completo = f"{empleado_asignado.NOMBRE} {empleado_asignado.APELLIDO}"
                 data_orden["empleado_nombre"] = format_nombre(nombre_completo)
                 data_orden["empleado_avatar"] = usuario_asignado.AVATAR if usuario_asignado else None
            else:
                 data_orden["empleado_nombre"] = "Sin Asignar"
                 data_orden["empleado_avatar"] = None
            lista_ordenes.append(data_orden)
        
        return jsonify(lista_ordenes), 200

    except Exception as e:
        print(f"Error en get_ordenes: {e}")
        return jsonify({"error": str(e)}), 500


# --- 2. CREAR ORDEN ---
@ordenes_bp.route("/ordenes", methods=["POST"])
@jwt_required()
def create_orden():
    # 1. Verificación de permisos (Reemplaza al @role_required)
    if not tiene_permiso_ordenes():
        return jsonify({"error": "No tienes permisos para crear órdenes."}), 403

    data = request.json
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    user_id = int(claims.get("sub"))

    try:
        estado_pendiente = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Pendiente")).first()
        if not estado_pendiente: return jsonify({"error": "Estado 'Pendiente' no configurado."}), 500

        id_deposito = None
        
        # Lógica de Depósito:
        # Master_Admin puede elegir depósito.
        # Admin / Gerente usa SU PROPIO depósito.
        if rol == "Master_Admin":
            id_deposito = data.get("id_deposito")
            if not id_deposito: return jsonify({"error": "Falta depósito"}), 400
        else:
            usuario = Usuario.query.get(user_id)
            if not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
                return jsonify({"error": "Usuario sin depósito asignado."}), 400
            id_deposito = usuario.empleado.ID_DEPOSITO

        id_empleado = data.get("id_empleado")
        empleado_final = None
        if id_empleado:
             empleado_obj = Empleado.query.get(id_empleado)
             if not empleado_obj: return jsonify({"error": "Empleado no existe"}), 400
             empleado_final = empleado_obj.ID_EMPLEADO
        
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
            ID_EMPLEADO=empleado_final,
            ID_ESTADO_ORDEN=estado_pendiente.ID_ESTADO_ORDEN,
            FECHA_INICIO=datetime.now(),
            FECHA_LIMITE=fecha_limite
        )


        db.session.add(nueva_orden)
        db.session.flush()  # Obtener ID antes de commit

        # 2. LOGICA DE NOTIFICACION AL CREAR
        if nueva_orden.ID_EMPLEADO:
            # Buscamos el usuario asociado al empleado para notificarle
            usuario_dest = Usuario.query.filter_by(ID_EMPLEADO=nueva_orden.ID_EMPLEADO).first()
            if usuario_dest:
                noti = Notificacion(
                    ID_USUARIO=usuario_dest.ID_USUARIO,
                    ID_ORDEN=nueva_orden.ID_ORDEN,
                    MENSAJE=f"Nueva orden asignada: {nueva_orden.TITULO}"
                )
                db.session.add(noti)
                        
        db.session.commit()
        return jsonify({"success": True, "message": "Orden creada correctamente."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --- 3. ACTUALIZAR ORDEN ---
@ordenes_bp.route("/ordenes/<int:id_orden>", methods=["PUT"])
@jwt_required()
def update_orden(id_orden):
    data = request.json
    # Verificamos si es gestor (Admin/Gerente)
    es_gestor = tiene_permiso_ordenes()
    
    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden: return jsonify({"error": "Orden no encontrada"}), 404

        # ---------------------------------------------------------------------
        # MODO EDICIÓN (Editar Info y Recalcular Estado por Fecha)
        # ---------------------------------------------------------------------
        if data.get("accion") == "editar_info":
            # Reemplazamos el chequeo de rol fijo por el permiso
            if not es_gestor:
                return jsonify({"error": "No autorizado para editar información."}), 403
            
            # Actualizar datos básicos
            if "titulo" in data: orden.TITULO = data.get("titulo")
            if "descripcion" in data: orden.DESCRIPCION = data.get("descripcion")
            if "prioridad" in data: orden.PRIORIDAD = data.get("prioridad")
            
            # Actualizar Fecha Límite
            fecha_cambiada = False
            if "fecha_limite" in data:
                fecha_cambiada = True
                val = data.get("fecha_limite")
                if val:
                    try:
                        orden.FECHA_LIMITE = datetime.strptime(val, "%Y-%m-%dT%H:%M")
                    except ValueError: pass
                else:
                    orden.FECHA_LIMITE = None # Borrar límite
            
            # --- LÓGICA AUTOMÁTICA AL EDITAR FECHA ---
            if fecha_cambiada:
                estado_pendiente = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Pendiente")).first()
                estado_vencido = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Fin de tiempo limite")).first()
                
                if estado_pendiente and estado_vencido:
                    if orden.FECHA_LIMITE:
                        if orden.FECHA_LIMITE < datetime.now():
                            orden.ID_ESTADO_ORDEN = estado_vencido.ID_ESTADO_ORDEN
                        else:
                            orden.ID_ESTADO_ORDEN = estado_pendiente.ID_ESTADO_ORDEN
                    else:
                        orden.ID_ESTADO_ORDEN = estado_pendiente.ID_ESTADO_ORDEN
            
            db.session.commit()
            return jsonify({"success": True, "message": "Información y estado actualizados."}), 200

        # ---------------------------------------------------------------------
        # ACTUALIZACIÓN NORMAL (Cambio de estado, asignación rápida, herramientas)
        # ---------------------------------------------------------------------
        if "herramientas" in data: 
            orden.HERRAMIENTAS = data.get("herramientas")
            
        if "nuevo_estado" in data:
            nuevo_estado_str = data.get("nuevo_estado")
            st = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike(nuevo_estado_str)).first()
            
            if st: 
                orden.ID_ESTADO_ORDEN = st.ID_ESTADO_ORDEN
                
                # Calcular tiempo si finaliza
                if st.ESTADO_ORDEN in ["Aprobada", "Completada", "Finalizada"]:
                    orden.FECHA_CIERRE = datetime.now()
                    if orden.FECHA_INICIO:
                        diff = orden.FECHA_CIERRE - orden.FECHA_INICIO
                        dias = diff.days
                        horas = diff.seconds // 3600
                        mins = (diff.seconds % 3600) // 60
                        txt = []
                        if dias > 0: txt.append(f"{dias}d")
                        if horas > 0: txt.append(f"{horas}h")
                        txt.append(f"{mins}m")
                        orden.TIEMPO_EMPLEADO = " ".join(txt) if txt else "1m"
            else:
                 return jsonify({"error": f"Estado '{nuevo_estado_str}' no existe."}), 400

        # 3. LOGICA DE NOTIFICACION AL REASIGNAR
        # Permitir reasignar empleado/prioridad si tiene permiso
        if es_gestor:
            if "id_empleado" in data: 
                nuevo_id = data.get("id_empleado")
                # Si el ID ha cambiado, notificamos al nuevo
                if nuevo_id != orden.ID_EMPLEADO:
                    orden.ID_EMPLEADO = nuevo_id
                    usuario_dest = Usuario.query.filter_by(ID_EMPLEADO=nuevo_id).first()
                    if usuario_dest:
                         noti = Notificacion(
                            ID_USUARIO=usuario_dest.ID_USUARIO,
                            ID_ORDEN=orden.ID_ORDEN,
                            MENSAJE=f"Te han asignado una orden: {orden.TITULO}"
                        )
                         db.session.add(noti)

            if "prioridad" in data: orden.PRIORIDAD = data.get("prioridad")

        db.session.commit()
        return jsonify({"success": True, "message": "Orden actualizada.", "tiempo": orden.TIEMPO_EMPLEADO}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --- 4. AVANCES ---
@ordenes_bp.route("/ordenes/<int:id_orden>/avances", methods=["POST"])
@jwt_required()
def add_avance(id_orden):
    claims = get_jwt()
    
    # IMPORTANTE: Mantenemos la lógica de que los Administradores (y ahora Gerentes)
    # NO realizan avances, ellos gestionan. Los avances son para el personal técnico.
    if tiene_permiso_ordenes():
        return jsonify({"error": "Modo Administrador: Solo lectura en avances. Asigna tareas, no las ejecutes."}), 403

    data = request.json
    nombre_usuario = claims.get("user_nombre", "Empleado") 
    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden: return jsonify({"error": "Orden no encontrada"}), 404

        nuevo_avance = AvanceOrden(
            ID_ORDEN=id_orden, AUTOR=nombre_usuario, MENSAJE=data.get("mensaje"), FECHA_HORA=datetime.now()
        )
        db.session.add(nuevo_avance)
        db.session.commit()
        return jsonify({"success": True, "avance": nuevo_avance.to_dict()}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@ordenes_bp.route("/ordenes/<int:id_orden>/avances", methods=["GET"])
@jwt_required()
def get_avances(id_orden):
    avances = AvanceOrden.query.filter_by(ID_ORDEN=id_orden).order_by(AvanceOrden.FECHA_HORA.asc()).all()
    return jsonify([a.to_dict() for a in avances]), 200

# --- 5. DELETE ---
@ordenes_bp.route("/ordenes/<int:id_orden>", methods=["DELETE"])
@jwt_required()
def soft_delete_orden(id_orden):
    # Ahora quien tenga permiso de gestion puede eliminar (papelera)
    if tiene_permiso_ordenes():
        orden = OrdenTrabajo.query.get(id_orden)
        if orden:
            orden.ELIMINADA = True
            db.session.commit()
            return jsonify({"message": "Enviada a papelera."}), 200
        return jsonify({"error": "No encontrada"}), 404
        
    return jsonify({"error": "No autorizado para eliminar."}), 403

# backend/ordenes.py

@ordenes_bp.route("/ordenes/<int:id_orden>/perma", methods=["DELETE"])
@jwt_required()
def perma_delete_orden(id_orden):
    # La eliminación permanente se mantiene EXCLUSIVA para Master_Admin
    if get_jwt().get("rol_nombre") != "Master_Admin":
        return jsonify({"error": "Solo Master Admin puede borrar permanentemente."}), 403
    
    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden:
            return jsonify({"error": "No encontrada"}), 404

        # 1. Eliminar Notificaciones asociadas a esta orden
        # (Si no haces esto, la BD bloquea el borrado por seguridad)
        Notificacion.query.filter_by(ID_ORDEN=id_orden).delete()

        # 2. Eliminar Avances asociados a esta orden
        AvanceOrden.query.filter_by(ID_ORDEN=id_orden).delete()

        # 3. Ahora sí, eliminar la Orden
        db.session.delete(orden)
        db.session.commit()
        
        return jsonify({"message": "Eliminada permanentemente (y sus datos asociados)."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error borrando orden: {e}") # Esto te mostrará el error real en la terminal
        return jsonify({"error": str(e)}), 500

@ordenes_bp.route("/ordenes/empleado/<int:id_empleado>", methods=["GET"])
@jwt_required()
def get_ordenes_por_empleado(id_empleado):
    ordenes = OrdenTrabajo.query.filter_by(ID_EMPLEADO=id_empleado, ELIMINADA=False).order_by(OrdenTrabajo.FECHA_INICIO.desc()).all()
    return jsonify([o.to_dict() for o in ordenes]), 200