# backend/solicitudes.py
from flask import Blueprint, request, jsonify
# NOTA: Ya no importamos CORS aquí, lo maneja main.py
from flask_jwt_extended import get_jwt_identity, get_jwt, jwt_required, verify_jwt_in_request 
from sqlalchemy import func
from db import db, SolicitudStock, DetalleSolicitud, EstadoSolicitud, Usuario, Deposito, Material, Inventario, Lote, Notificacion, EstadoInventario
import datetime
from flask_cors import cross_origin # <--- AGREGAR ESTO
solicitudes_bp = Blueprint("solicitudes", __name__)

# --- UTILIDAD: Obtener ID Estado Solicitud ---
def get_id_estado_pendiente():
    estado = EstadoSolicitud.query.filter(EstadoSolicitud.NOMBRE.ilike('Pendiente')).first()
    if not estado:
        estado = EstadoSolicitud(NOMBRE="Pendiente")
        db.session.add(estado)
        db.session.commit()
    return estado.ID_ESTADO
def get_id_estado_rechazada():
    estado = EstadoSolicitud.query.filter(EstadoSolicitud.NOMBRE.ilike('Rechazada')).first()
    if not estado:
        estado = EstadoSolicitud(NOMBRE="Rechazada")
        db.session.add(estado)
        db.session.commit()
    return estado.ID_ESTADO
# -------------------------------------------------------------------------
# RUTA 1: STOCK DISPONIBLE
# -------------------------------------------------------------------------
@solicitudes_bp.route('/api/solicitudes/stock-disponible/<int:id_material>', methods=['GET'])
def get_stock_disponible(id_material):
    # Verificación de JWT
    try:
        verify_jwt_in_request()
    except Exception:
        return jsonify({"error": "Token invalido o faltante"}), 401

    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    
    mi_deposito_id = usuario.empleado.ID_DEPOSITO if usuario.empleado else -1

    try:
        estado_disp = EstadoInventario.query.filter(EstadoInventario.ESTADO_INVENTARIO.ilike('Disponible')).first()
        id_estado_ok = estado_disp.ID_ESTADO_INVENTARIO if estado_disp else 1

        resultados = db.session.query(
            Deposito.ID_DEPOSITO,
            Deposito.NOMBRE,
            Material.UNIDAD_MEDIDA, 
            func.sum(Inventario.CANTIDAD_ACTUAL).label('total_stock')
        ).join(Inventario, Deposito.ID_DEPOSITO == Inventario.ID_DEPOSITO)\
         .join(Lote, Inventario.ID_LOTE == Lote.ID_LOTE)\
         .join(Material, Lote.ID_MATERIAL == Material.ID_MATERIAL)\
         .filter(Lote.ID_MATERIAL == id_material)\
         .filter(Inventario.CANTIDAD_ACTUAL > 0)\
         .filter(Inventario.ID_ESTADO_INVENTARIO == id_estado_ok)\
         .filter(Deposito.ID_DEPOSITO != mi_deposito_id)\
         .group_by(Deposito.ID_DEPOSITO, Deposito.NOMBRE, Material.UNIDAD_MEDIDA).all()

        lista = []
        for r in resultados:
            if r.total_stock > 0:
                lista.append({
                    "id_deposito": r.ID_DEPOSITO,
                    "nombre": r.NOMBRE,
                    "unidad": r.UNIDAD_MEDIDA,
                    "cantidad": float(r.total_stock)
                })
            
        return jsonify(lista), 200

    except Exception as e:
        print(f"Error stock: {e}")
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------------
# RUTA 2: CREAR SOLICITUD
# -------------------------------------------------------------------------
# -------------------------------------------------------------------------
# RUTA 2: CREAR SOLICITUD (Soporte Múltiple)
# -------------------------------------------------------------------------
@solicitudes_bp.route("/api/solicitudes", methods=["POST"])
def crear_solicitud():
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"error": "No autorizado"}), 401

    claims = get_jwt()
    current_user_id = get_jwt_identity()
    data = request.json

    try:
        usuario = Usuario.query.get(current_user_id)
        if not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
             return jsonify({"error": "Usuario sin depósito."}), 400
        
        id_origen = usuario.empleado.ID_DEPOSITO
        id_destino = data.get("id_deposito_proveedor") 
        items = data.get("items", []) # Esperamos el array del frontend

        if not id_destino: return jsonify({"error": "Selecciona un proveedor."}), 400
        if not items or len(items) == 0: return jsonify({"error": "La solicitud está vacía."}), 400
        
        id_destino = int(id_destino)
        if id_origen == id_destino: return jsonify({"error": "No puedes pedirte a ti mismo."}), 400

        # --- 1. VALIDAR STOCK DE TODOS LOS ITEMS ANTES DE CREAR ---
        estado_disp = EstadoInventario.query.filter(EstadoInventario.ESTADO_INVENTARIO.ilike('Disponible')).first()
        id_estado_ok = estado_disp.ID_ESTADO_INVENTARIO if estado_disp else 1
        
        errores = []
        for item in items:
            id_mat = item.get("id_material")
            cant = float(item.get("cantidad"))
            
            stock_real = db.session.query(func.sum(Inventario.CANTIDAD_ACTUAL))\
                .join(Lote).filter(
                    Inventario.ID_DEPOSITO == id_destino,
                    Lote.ID_MATERIAL == id_mat,
                    Inventario.ID_ESTADO_INVENTARIO == id_estado_ok
                ).scalar() or 0
            
            if cant > stock_real:
                mat_obj = Material.query.get(id_mat)
                errores.append(f"{mat_obj.NOMBRE}: Solicitado {cant}, Disponible {stock_real}")

        if errores:
            return jsonify({"error": "Stock insuficiente en algunos items", "detalles": errores}), 400

        # --- 2. CREAR CABECERA (MAESTRO) ---
        id_pendiente = get_id_estado_pendiente()
        
        nueva_solicitud = SolicitudStock(
            ID_DEPOSITO_SOLICITANTE=id_origen,
            ID_USUARIO_SOLICITANTE=current_user_id,
            ID_DEPOSITO_PROVEEDOR=id_destino,
            ID_ESTADO=id_pendiente,
            OBSERVACION_GENERAL=data.get("observacion", ""),
            FECHA_SOLICITUD=datetime.datetime.now()
        )
        db.session.add(nueva_solicitud)
        db.session.flush() # Genera el ID_SOLICITUD

        # --- 3. CREAR DETALLES ---
        for item in items:
            nuevo_detalle = DetalleSolicitud(
                ID_SOLICITUD=nueva_solicitud.ID_SOLICITUD,
                ID_MATERIAL=item['id_material'],
                CANTIDAD=float(item['cantidad']),
                OBSERVACION_ITEM=item.get('observacion', '')
            )
            db.session.add(nuevo_detalle)

        db.session.commit()

        # --- 4. NOTIFICACIÓN ---
        dep_nombre = usuario.empleado.deposito.NOMBRE
        total_items = len(items)
        admins_destino = Usuario.query.join(Usuario.rol).filter(
            ((Usuario.rol.has(NOMBRE_ROL='Administrador')) & (Usuario.empleado.has(ID_DEPOSITO=id_destino))) |
            (Usuario.rol.has(NOMBRE_ROL='Master_Admin'))
        ).all()

        for admin in admins_destino:
            notif = Notificacion(
                ID_USUARIO=admin.ID_USUARIO,
                MENSAJE=f"📦 Solicitud #{nueva_solicitud.ID_SOLICITUD}: {dep_nombre} pide {total_items} materiales.",
                LEIDA=False,
                FECHA_CREACION=datetime.datetime.now()
            )
            db.session.add(notif)
        db.session.commit()

        return jsonify({"success": True, "message": "Pedido enviado correctamente."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500



# -------------------------------------------------------------------------
# RUTA 3: CONTEO
# -------------------------------------------------------------------------
@solicitudes_bp.route("/api/notificaciones/conteo", methods=["GET"])
def get_notificaciones_conteo():
    try: verify_jwt_in_request()
    except: return jsonify({"error": "Auth"}), 401

    current_user_id = get_jwt_identity()
    try:
        usuario = Usuario.query.get(current_user_id)
        if not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
             return jsonify({"pedidos_pendientes": 0}), 200
        
        mi_deposito_id = usuario.empleado.ID_DEPOSITO
        id_estado_pendiente = get_id_estado_pendiente()

        conteo = SolicitudStock.query.filter_by(
            ID_DEPOSITO_PROVEEDOR=mi_deposito_id,
            ID_ESTADO=id_estado_pendiente
        ).count()

        return jsonify({"pedidos_pendientes": conteo}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------------
# RUTA 4: LISTAR PEDIDOS ENTRANTES (Para el Historial)
# -------------------------------------------------------------------------
   # --- ACTUALIZAR RUTA GET PARA EL HISTORIAL ---
@solicitudes_bp.route("/api/solicitudes/entrantes", methods=["GET"])
def get_pedidos_entrantes():
    # ... (Verificación JWT igual) ...
    try: verify_jwt_in_request()
    except: return jsonify({"error": "Token invalido"}), 401
    
    current_user_id = get_jwt_identity()
    try:
        usuario = Usuario.query.get(current_user_id)
        mi_deposito_id = usuario.empleado.ID_DEPOSITO
        
        # Obtenemos las CABECERAS
        solicitudes = SolicitudStock.query.filter_by(
            ID_DEPOSITO_PROVEEDOR=mi_deposito_id,
            ID_ESTADO=1 # Pendiente
        ).order_by(SolicitudStock.FECHA_SOLICITUD.desc()).all()
        
        resultado = []
        for s in solicitudes:
            # Generamos un resumen de texto para la tarjeta
            # Ej: "Cable (500m), Aislador (20u)..."
            items_desc = []
            for d in s.detalles:
                items_desc.append(f"{d.material.NOMBRE} ({d.CANTIDAD} {d.material.UNIDAD_MEDIDA})")
            
            resumen_texto = ", ".join(items_desc[:2]) # Solo los primeros 2
            if len(items_desc) > 2: resumen_texto += f" y {len(items_desc)-2} más..."

            resultado.append({
                "id_solicitud": s.ID_SOLICITUD,
                "deposito_solicitante": s.dep_solicitante.NOMBRE,
                "solicitante_usuario": f"{s.usuario.empleado.NOMBRE} {s.usuario.empleado.APELLIDO}",
                "fecha": s.FECHA_SOLICITUD.strftime("%d/%m/%Y %H:%M"),
                "observacion": s.OBSERVACION_GENERAL,
                
                # Campos adaptados para que HistorialPedidos no rompa
                "material": "Pedido Múltiple", # Título genérico
                "cantidad": len(s.detalles),
                "unidad": "items",
                "resumen": resumen_texto, # Nuevo campo útil
                
                # Lista completa para cuando quieras ver detalles
                "items": [
                    {
                        "material": d.material.NOMBRE,
                        "cantidad": d.CANTIDAD,
                        "unidad": d.material.UNIDAD_MEDIDA,
                        "codigo": d.material.CODIGO_UNICO
                    } for d in s.detalles
                ]
            })
            
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500 
# -------------------------------------------------------------------------
# RUTA 5: RECHAZAR SOLICITUD
# -------------------------------------------------------------------------
@solicitudes_bp.route('/api/solicitudes/<int:id>/rechazar', methods=['PUT'])
@cross_origin() # Para evitar problemas de CORS específicos en esta ruta
@jwt_required()
def rechazar_solicitud(id):
    try:
        data = request.json
        motivo = data.get("motivo", "Sin motivo especificado")

        # 1. Buscar la solicitud
        solicitud = SolicitudStock.query.get(id)
        if not solicitud:
            return jsonify({"error": "Solicitud no encontrada"}), 404

        # 2. Obtener el ID del estado "Rechazada"
        id_rechazada = get_id_estado_rechazada()

        # 3. Actualizar la solicitud
        solicitud.ID_ESTADO = id_rechazada
        
        # Concatenamos el motivo a la observación existente para no perder datos previos
        obs_actual = solicitud.OBSERVACION if solicitud.OBSERVACION else ""
        solicitud.OBSERVACION = f"{obs_actual} | [RECHAZADO]: {motivo}".strip()

        # 4. Guardar cambios
        db.session.commit()

        # Opcional: Crear notificación para el usuario que solicitó (Feedback)
        try:
            notif = Notificacion(
                ID_USUARIO=solicitud.ID_USUARIO_SOLICITANTE,
                MENSAJE=f"❌ Tu solicitud de {solicitud.material.NOMBRE} fue rechazada. Motivo: {motivo}",
                LEIDA=False,
                FECHA_CREACION=datetime.datetime.now()
            )
            db.session.add(notif)
            db.session.commit()
        except Exception as e_notif:
            print(f"No se pudo enviar notificación de rechazo: {e_notif}")

        return jsonify({"success": True, "message": "Solicitud rechazada correctamente"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al rechazar solicitud: {e}")
        return jsonify({"error": str(e)}), 500