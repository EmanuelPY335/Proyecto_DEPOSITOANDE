# backend/vales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from db import db, Vale, DetalleVale, Inventario, MovimientoMaterial, Notificacion, Usuario, Deposito, Lote, EstadoInventario

vales_bp = Blueprint("vales", __name__)

# ---------------------------------------------------------
# 1. CREAR VALE (Paso 1: Generación)
# ---------------------------------------------------------
@vales_bp.route("/vales", methods=["POST"])
@jwt_required()
def crear_vale():
    data = request.json
    current_user_id = get_jwt_identity()
    
    # --- 1. VERIFICACIÓN DE SEGURIDAD ---
    usuario = Usuario.query.get(current_user_id)
    
    # Si el rol es 'Admin' (u otro no autorizado), rechazamos la petición.
    # Solo permitimos a 'Master_Admin' y 'Personal_Inventario'.
    if usuario.rol.NOMBRE_ROL not in ["Master_Admin", "Personal_Inventario"]:
        return jsonify({"error": "Tu rol (Admin) solo tiene permiso de lectura."}), 403
    # ------------------------------------

    try:
        # Validar datos básicos
        if not data.get('items') or len(data['items']) == 0:
            return jsonify({"error": "El vale debe tener al menos un material"}), 400

        # Crear cabecera del Vale
        nuevo_vale = Vale(
            ID_USUARIO_SOLICITANTE=current_user_id,
            ID_DEPOSITO_ORIGEN=data['id_origen'],
            ID_DEPOSITO_DESTINO=data['id_destino'],
            ID_CHOFER=data.get('id_chofer'), # Asegúrate de tener este campo en tu modelo
            ID_VEHICULO=data.get('id_vehiculo'), # Asegúrate de tener este campo en tu modelo
            FECHA_CREACION=datetime.now(),
            ESTADO="Pendiente Aprobación", # Estados: Pendiente Aprobación, En Tránsito, Finalizado
            OBSERVACION=data.get('observacion', '')
        )
        db.session.add(nuevo_vale)
        db.session.flush() # Para obtener ID_VALE

        # Crear detalles (Items)
        for item in data['items']:
            # item: { id_lote, cantidad }
            detalle = DetalleVale(
                ID_VALE=nuevo_vale.ID_VALE,
                ID_LOTE=item['id_lote'],
                CANTIDAD=float(item['cantidad'])
            )
            db.session.add(detalle)

        # Crear Notificación para el Admin del Origen
        noti = Notificacion(
            ID_USUARIO=None, # O busca el admin del depósito origen
            MENSAJE=f"Nuevo Vale #{nuevo_vale.ID_VALE} requiere aprobación de salida.",
            TIPO="Alerta",
            LEIDA=False,
            FECHA_CREACION=datetime.now()
        )
        db.session.add(noti)

        db.session.commit()
        return jsonify({"success": True, "message": "Vale generado. Esperando aprobación de salida."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 2. APROBAR SALIDA (Paso 2: Admin Origen descuenta stock)
# ---------------------------------------------------------
@vales_bp.route("/vales/<int:id_vale>/aprobar_salida", methods=["PUT"])
@jwt_required()
def aprobar_salida(id_vale):
    try:
        vale = Vale.query.get(id_vale)
        if not vale: return jsonify({"error": "Vale no encontrado"}), 404
        if vale.ESTADO != "Pendiente Aprobación":
            return jsonify({"error": "El vale no está en estado pendiente"}), 400

        # Procesar cada item para descontar stock
        detalles = DetalleVale.query.filter_by(ID_VALE=id_vale).all()
        
        for det in detalles:
            # Buscar inventario en ORIGEN
            inv_origen = Inventario.query.filter_by(
                ID_LOTE=det.ID_LOTE, 
                ID_DEPOSITO=vale.ID_DEPOSITO_ORIGEN
            ).first()

            if not inv_origen or inv_origen.CANTIDAD_ACTUAL < det.CANTIDAD:
                raise Exception(f"Stock insuficiente para el lote {det.lote.CODIGO}")

            # Descontar Stock
            inv_origen.CANTIDAD_ACTUAL -= det.CANTIDAD

            # Registrar Movimiento
            mov = MovimientoMaterial(
                ID_LOTE=det.ID_LOTE,
                ID_USUARIO=get_jwt_identity(),
                TIPO_MOVIMIENTO="Salida Traslado",
                CANTIDAD=det.CANTIDAD,
                FECHA_MOVIMIENTO=datetime.now(),
                ID_DEPOSITO=vale.ID_DEPOSITO_ORIGEN,
                DESTINO_ORIGEN=f"Traslado a {vale.deposito_destino.NOMBRE} (Vale #{id_vale})"
            )
            db.session.add(mov)

        vale.ESTADO = "En Tránsito"
        # vale.FECHA_SALIDA = datetime.now() # Si tienes este campo
        
        db.session.commit()
        return jsonify({"success": True, "message": "Salida aprobada. Material en tránsito."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 3. CONFIRMAR RECEPCIÓN (Paso 3: Admin Destino suma stock)
# ---------------------------------------------------------
@vales_bp.route("/vales/<int:id_vale>/confirmar_recepcion", methods=["PUT"])
@jwt_required()
def confirmar_recepcion(id_vale):
    try:
        vale = Vale.query.get(id_vale)
        if not vale: return jsonify({"error": "Vale no encontrado"}), 404
        if vale.ESTADO != "En Tránsito":
            return jsonify({"error": "El vale no está en tránsito"}), 400

        detalles = DetalleVale.query.filter_by(ID_VALE=id_vale).all()
        
        for det in detalles:
            # Buscar inventario en DESTINO
            inv_destino = Inventario.query.filter_by(
                ID_LOTE=det.ID_LOTE, 
                ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO
            ).first()

            if not inv_destino:
                # Si no existe, lo creamos (manteniendo el estado 'Disponible')
                estado_disp = EstadoInventario.query.filter_by(ESTADO_INVENTARIO="Disponible").first()
                inv_destino = Inventario(
                    ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO,
                    ID_LOTE=det.ID_LOTE,
                    ID_ESTADO_INVENTARIO=estado_disp.ID_ESTADO_INVENTARIO,
                    CANTIDAD_ACTUAL=0
                )
                db.session.add(inv_destino)
                db.session.flush() # Para poder sumar abajo

            # Sumar Stock
            inv_destino.CANTIDAD_ACTUAL += det.CANTIDAD

            # Registrar Movimiento
            mov = MovimientoMaterial(
                ID_LOTE=det.ID_LOTE,
                ID_USUARIO=get_jwt_identity(),
                TIPO_MOVIMIENTO="Entrada Traslado",
                CANTIDAD=det.CANTIDAD,
                FECHA_MOVIMIENTO=datetime.now(),
                ID_DEPOSITO=vale.ID_DEPOSITO_DESTINO,
                DESTINO_ORIGEN=f"Recepción de {vale.deposito_origen.NOMBRE} (Vale #{id_vale})"
            )
            db.session.add(mov)

        vale.ESTADO = "Finalizado"
        # vale.FECHA_LLEGADA = datetime.now()

        db.session.commit()
        return jsonify({"success": True, "message": "Recepción confirmada. Stock actualizado."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500