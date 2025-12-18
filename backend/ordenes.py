# backend/ordenes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import datetime
from db import db, OrdenTrabajo, EstadoOrden, Empleado, Usuario, AvanceOrden
from roles_permisos import role_required

ordenes_bp = Blueprint("ordenes", __name__)

# --- FUNCIÓN AUXILIAR PARA FORMATEAR NOMBRES ---
def format_nombre(text):
    if not text: return ""
    return " ".join(word.capitalize() for word in text.lower().split())

# --- 1. LISTAR ÓRDENES (CON AUTO-VERIFICACIÓN DE VENCIMIENTO) ---
@ordenes_bp.route("/ordenes", methods=["GET"])
@jwt_required()
def get_ordenes():
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    user_id = int(claims.get("sub"))
    
    usuario_actual = Usuario.query.get(user_id)
    empleado_id_actual = usuario_actual.empleado.ID_EMPLEADO if usuario_actual.empleado else None

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

        if rol not in ["Admin", "Master_Admin"]:
            if not empleado_id_actual:
                return jsonify([]), 200
            query = query.filter(OrdenTrabajo.ID_EMPLEADO == empleado_id_actual)
        
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
@role_required("Admin")
def create_orden():
    data = request.json
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    user_id = int(claims.get("sub"))

    try:
        estado_pendiente = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Pendiente")).first()
        if not estado_pendiente: return jsonify({"error": "Estado 'Pendiente' no configurado."}), 500

        id_deposito = None
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
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    
    try:
        orden = OrdenTrabajo.query.get(id_orden)
        if not orden: return jsonify({"error": "Orden no encontrada"}), 404

        # ---------------------------------------------------------------------
        # MODO EDICIÓN (Editar Info y Recalcular Estado por Fecha)
        # ---------------------------------------------------------------------
        if data.get("accion") == "editar_info":
            if rol not in ["Admin", "Master_Admin"]:
                return jsonify({"error": "No autorizado."}), 403
            
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
            # Si se tocó la fecha, verificamos si venció o si vuelve a estar activa
            if fecha_cambiada:
                estado_pendiente = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Pendiente")).first()
                estado_vencido = EstadoOrden.query.filter(EstadoOrden.ESTADO_ORDEN.ilike("Fin de tiempo limite")).first()
                
                if estado_pendiente and estado_vencido:
                    if orden.FECHA_LIMITE:
                        # Si tiene fecha límite...
                        if orden.FECHA_LIMITE < datetime.now():
                            # ... y ya pasó -> ESTADO: FIN DE TIEMPO LIMITE
                            orden.ID_ESTADO_ORDEN = estado_vencido.ID_ESTADO_ORDEN
                        else:
                            # ... y es futuro -> ESTADO: PENDIENTE (Reactiva la orden)
                            orden.ID_ESTADO_ORDEN = estado_pendiente.ID_ESTADO_ORDEN
                    else:
                        # Si se quitó la fecha límite -> ESTADO: PENDIENTE
                        orden.ID_ESTADO_ORDEN = estado_pendiente.ID_ESTADO_ORDEN
            
            db.session.commit()
            return jsonify({"success": True, "message": "Información y estado actualizados."}), 200

        # ---------------------------------------------------------------------
        # ACTUALIZACIÓN NORMAL (Cambio de estado por usuario, Herramientas, etc.)
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

        if rol in ["Admin", "Master_Admin"]:
            if "id_empleado" in data: orden.ID_EMPLEADO = data.get("id_empleado")
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
    rol = claims.get("rol_nombre")
    if rol in ["Admin", "Master_Admin"]:
        return jsonify({"error": "Solo lectura para admins."}), 403

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
    claims = get_jwt()
    if claims.get("rol_nombre") in ["Admin", "Master_Admin"]:
        orden = OrdenTrabajo.query.get(id_orden)
        if orden:
            orden.ELIMINADA = True
            db.session.commit()
            return jsonify({"message": "Enviada a papelera."}), 200
    return jsonify({"error": "No autorizado"}), 403

@ordenes_bp.route("/ordenes/<int:id_orden>/perma", methods=["DELETE"])
@jwt_required()
def perma_delete_orden(id_orden):
    if get_jwt().get("rol_nombre") != "Master_Admin":
        return jsonify({"error": "Solo Master Admin"}), 403
    orden = OrdenTrabajo.query.get(id_orden)
    if orden:
        db.session.delete(orden)
        db.session.commit()
        return jsonify({"message": "Eliminada permanentemente."}), 200
    return jsonify({"error": "No encontrada"}), 404

@ordenes_bp.route("/ordenes/empleado/<int:id_empleado>", methods=["GET"])
@jwt_required()
def get_ordenes_por_empleado(id_empleado):
    ordenes = OrdenTrabajo.query.filter_by(ID_EMPLEADO=id_empleado, ELIMINADA=False).order_by(OrdenTrabajo.FECHA_INICIO.desc()).all()
    return jsonify([o.to_dict() for o in ordenes]), 200