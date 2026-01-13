from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import cross_origin 
from datetime import datetime
import uuid
# Importamos todos los modelos necesarios
from db import db, Vale, DetalleVale, Notificacion, Usuario, Vehiculo, OrdenTrabajo, Empleado, SolicitudStock, Inventario, MovimientoMaterial, Lote, EstadoVale

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

@vales_bp.route("/vehiculos", methods=["GET"])
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
    data = request.json
    current_user_id = get_jwt_identity()
    
    usuario = Usuario.query.get(current_user_id)
    if not usuario:
        return jsonify({"error": "Usuario no identificado"}), 403

    try:
        route_group_id = f"R-{uuid.uuid4().hex[:8].upper()}"
        
        stops = data.get('stops', [])
        if not stops:
            return jsonify({"error": "La ruta debe tener al menos una parada"}), 400

        es_admin = usuario.rol.NOMBRE_ROL in ["Master_Admin", "Administrador"]
        estado_inicial = 2 if es_admin else 1

        id_chofer = data.get('id_chofer')
        id_vehiculo = data.get('id_vehiculo')

        created_vales = []

        for stop in stops:
            nuevo_vale = Vale(
                ID_USUARIO_CREADOR=current_user_id,
                ID_DEPOSITO_ORIGEN=data.get('id_origen'),
                ID_DEPOSITO_DESTINO=stop['id_destino'],
                ID_CHOFER=id_chofer if id_chofer else None,
                ID_VEHICULO=id_vehiculo if id_vehiculo else None,
                FECHA_CREACION=datetime.now(),
                ID_ESTADO_VALE=estado_inicial, 
                OBSERVACIONES=data.get('observacion', ''),
                GRUPO_RUTA=route_group_id 
            )
            if estado_inicial == 2:
                nuevo_vale.ID_USUARIO_APROBADOR_SALIDA = current_user_id

            db.session.add(nuevo_vale)
            db.session.flush()

            for item in stop['items']:
                detalle = DetalleVale(
                    ID_VALE=nuevo_vale.ID_VALE,
                    ID_LOTE=item['id_lote'],
                    ID_MATERIAL=item['id_material'],
                    CANTIDAD_SOLICITADA=float(item['cantidad'])
                )
                db.session.add(detalle)
                
            created_vales.append(nuevo_vale)

        if estado_inicial == 2:
            for vale in created_vales:
                descontar_stock_salida(vale, current_user_id)
            
            if id_chofer:
                notificar_chofer(id_chofer, route_group_id)

        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Ruta generada." + (" Aprobada." if estado_inicial==2 else " Pendiente de aprobación."),
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